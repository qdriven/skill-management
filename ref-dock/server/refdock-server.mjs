/* RefDock companion service — zero-dependency Node ≥ 18.
 *
 * Endpoints (all GET unless noted, JSON):
 *   GET /api/ping                 → { ok, version, workspaces: [...] }
 *   GET /api/workspaces           → [{ id, name, referencesExists, categories: [...] }]
 *   GET /api/tree?workspace=<id>  → { categories: ["skills/agent", ...] } (dir listing of references/)
 *   GET /api/registry?workspace=  → { projects: [{ name, repo, path }] } parsed from registry_references.yaml
 *   GET /api/list?workspace=&category=  → existing repo dirs in that category
 *   POST /api/clone               → body { workspace, category, url, name? }
 *                                    queues the clone and returns 202 immediately (async);
 *                                    git runs in background — GET /api/jobs tracks it
 *   GET /api/jobs                 → recent clone records { id, status, url, category, path, error, command }
 *   POST /api/retry               → body { id } re-queues a failed clone record
 *
 * Flags:
 *   --workspace <dir>      repeatable; default = cwd (this repo)
 *   --port <n>             default 7420
 *   --token <secret>       require X-RefDock-Token header on every request
 *   --watch-clipboard      poll clipboard for "REFDOCK://clone?..." sentinel commands
 *   --no-pull              never auto-pull; refuse when dir exists
 */
'use strict';

import http from 'node:http';
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERSION = '0.1.0';
const DEFAULT_PORT = 7420;
const ORIGIN_ALLOW = new Set([
  'chrome-extension://', // + extension id, checked by prefix below
  'moz-extension://',
]);

// ---------- args ----------
const argv = process.argv.slice(2);
function argVal(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const flags = new Set(argv.filter((a) => a.startsWith('--') && !argVal(a)));
const PORT = Number(argVal('--port') || DEFAULT_PORT);
const TOKEN = argVal('--token') || null;
const WATCH_CLIPBOARD = flags.has('--watch-clipboard');
const NO_PULL = flags.has('--no-pull');
const FULL = flags.has('--full'); // disable --depth=1 shallow clone
const CLONE_TIMEOUT = Number(argVal('--clone-timeout')) || 0; // 0 = no timeout: git runs until done
const MIRROR = argVal('--mirror') || null;   // e.g. https://ghfast.top — prefixes github urls for slow links
const PROXY = argVal('--proxy') || null;     // e.g. http://127.0.0.1:7890 — passed to git via -c http.proxy
const RETRY = Number(argVal('--retry')) || 3; // auto-retries per job before marking failed

// ---------- workspaces ----------
const wsArgs = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--workspace' && argv[i + 1]) wsArgs.push(argv[i + 1]);
}
const WORKSPACES = (wsArgs.length ? wsArgs : [process.cwd()]).map((dir, i) => {
  const abs = path.resolve(dir);
  let name = path.basename(abs);
  try {
    // prefer repo folder name; fall back to full path tail
    if (!name || name === path.sep) name = 'ws' + i;
  } catch {}
  return { id: 'ws' + i, name, dir: abs };
});

function wsById(id) {
  return WORKSPACES.find((w) => w.id === id) || WORKSPACES[0];
}
function referencesRoot(ws) {
  return path.join(ws.dir, 'references');
}

// ---------- helpers ----------
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}
function ok(res, obj) { send(res, 200, { ok: true, ...obj }); }
function fail(res, code, msg, extra) { send(res, code, { ok: false, error: msg, ...(extra || {}) }); }

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, windowsHide: true });
    let stdout = '', stderr = '';
    let done = false;
    const finish = (code) => {
      if (done) return;
      done = true;
      resolve({ code: code ?? (child.exitCode ?? 1), stdout, stderr });
    };
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { stderr += '\n' + e.message; finish(1); });
    child.on('close', (code) => finish(code));
    // No timeout: git owns the network — it retries internally and slow links
    // just take longer. The job queue serializes ops, so a slow clone can't
    // block forever in a bad state; the next job waits its turn.
  });
}

/** git args for network ops with optional mirror prefix / proxy. */
function netArgs(url) {
  const finalUrl = MIRROR && /^https:\/\/github\.com\//i.test(url) ? MIRROR.replace(/\/$/, '') + '/' + url : url;
  const args = [];
  if (PROXY) args.push('-c', `http.proxy=${PROXY}`, '-c', `https.proxy=${PROXY}`);
  return { url: finalUrl, args };
}

/** Clone or update a repo under referencesRoot/<category>/<name>. */
async function doClone({ workspace, category, url, name }) {
  const ws = wsById(workspace);
  if (!ws) return { code: 400, body: { ok: false, error: 'unknown workspace: ' + workspace } };

  // --- validate inputs ---
  if (typeof url !== 'string' || !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/i.test(url)) {
    return { code: 400, body: { ok: false, error: 'url must be an https github repo url' } };
  }
  if (typeof category !== 'string' || /[\\]|\.\.|^\/|^$|[\x00-\x1f]/.test(category)) {
    return { code: 400, body: { ok: false, error: 'invalid category (single relative path, no .. or backslash)' } };
  }
  const urlNorm = url.replace(/\.git$/i, '');
  const repoName = name && /^[\w.-]+$/.test(name) ? name : urlNorm.split('/').pop();
  if (!repoName) return { code: 400, body: { ok: false, error: 'cannot derive repo name' } };

  const catDir = path.join(referencesRoot(ws), category);
  const dest = path.join(catDir, repoName);

  fs.mkdirSync(catDir, { recursive: true });

  // path-traversal guard: resolved dest must stay inside references root
  const rootReal = fs.realpathSync.native(referencesRoot(ws));
  const destReal = fs.realpathSync.native(catDir);
  if (!destReal.startsWith(rootReal + path.sep) && destReal !== rootReal) {
    return { code: 400, body: { ok: false, error: 'destination escapes references root' } };
  }

  // shallow by default (--full disables); depth keeps clones fast & small
  const depthArgs = FULL ? [] : ['--depth=1'];

  const gitDir = path.join(dest, '.git');
  let exists = fs.existsSync(gitDir);

  // heal broken clones: .git present but HEAD can't resolve to a commit →
  // leftover of a killed clone; wipe it so we get a clean clone instead of a
  // forever-failing pull. (--is-inside-work-tree alone still passes on broken
  // repos, and the HEAD *file* exists with a ref whose object is missing.)
  if (exists) {
    const probe = await run('git', ['-C', dest, 'rev-parse', '--verify', 'HEAD']);
    if (probe.code !== 0) {
      try { fs.rmSync(dest, { recursive: true, force: true }); } catch {}
      exists = false;
    }
  }

  if (exists && NO_PULL) {
    return { code: 409, body: { ok: false, error: 'already cloned (and --no-pull set)', path: dest } };
  }

  if (!exists) {
    // clear stale lock files left by killed git processes, else clone dies
    // immediately with "Unable to create ... .git/shallow.lock: File exists"
    for (const lock of ['shallow.lock', 'index.lock', 'config.lock']) {
      try { fs.rmSync(path.join(gitDir, lock), { force: true }); } catch {}
    }
    const net = netArgs(urlNorm + '.git');
    const r = await run('git', [...net.args, 'clone', ...depthArgs, net.url, dest], ws.dir);
    if (r.code !== 0) {
      // wipe partial clone so retry does a clean clone, not a broken pull
      try { if (fs.existsSync(gitDir) && !fs.existsSync(path.join(gitDir, 'HEAD'))) fs.rmSync(dest, { recursive: true, force: true }); } catch {}
      return { code: 500, body: { ok: false, error: 'git clone failed: ' + (r.stderr || r.stdout || 'unknown').trim().split('\n').slice(-3).join(' | ') } };
    }
    return { code: 200, body: { ok: true, action: 'clone', path: dest, name: repoName } };
  }

  // exists → verify same origin then ff-pull
  const remote = await run('git', ['remote', 'get-url', 'origin'], dest);
  const sameRemote = remote.code === 0 && String(remote.stdout).trim().replace(/\.git$/i, '') === urlNorm;
  if (!sameRemote) {
    return { code: 409, body: { ok: false, error: 'directory exists with a different origin: ' + dest, path: dest } };
  }
  const net = netArgs(urlNorm + '.git');
  const pr = await run('git', [...net.args, '-C', dest, 'pull', '--ff-only', ...(FULL ? [] : ['--depth=1'])]);
  if (pr.code !== 0) {
    return { code: 500, body: { ok: false, error: 'git pull failed: ' + (pr.stderr || pr.stdout).trim().split('\n').slice(-3).join(' | '), path: dest } };
  }
  return { code: 200, body: { ok: true, action: 'pull', path: dest, name: repoName } };
}

// ---------- clone job queue (async: 202 on enqueue, git runs in background) ----------
const JOBS = []; // records, newest first
let jobSeq = 0;
const pending = [];   // queued job runners — FIFO
let draining = false; // one git op at a time; event-loop serializes the rest
const JOBS_FILE = path.join(__dirname, 'jobs.json');

// restore records from the previous run so the popup history survives restarts;
// anything found mid-flight is marked failed (its git process died with the server)
try {
  for (const j of JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'))) {
    if (j && j.id && j.status) {
      if (j.status === 'running' || j.status === 'queued' || j.status === 'retrying') {
        j.status = 'failed';
        j.error = 'server restarted while this job was in flight — use 重跑 to retry';
      }
      JOBS.push(j);
      jobSeq = Math.max(jobSeq, Number((j.id || '').split('-').pop()) || 0);
    }
  }
  if (JOBS.length) console.log(`[refdock]   restored ${JOBS.length} job records from jobs.json`);
} catch {}

function persistJobs() {
  try { fs.writeFileSync(JOBS_FILE, JSON.stringify(JOBS.slice(0, 100), null, 2)); } catch {}
}

function drain() {
  if (draining) return;
  const next = pending.shift();
  if (!next) return;
  draining = true;
  next().catch(() => {}).finally(() => { draining = false; persistJobs(); drain(); });
}

function jobCommand(ws, j) {
  const root = path.join(ws.dir, 'references');
  const depth = FULL ? '' : ' --depth=1';
  const shownUrl = MIRROR && /^https:\/\/github\.com\//i.test(j.url) ? MIRROR.replace(/\/$/, '') + '/' + j.url.replace(/\.git$/i, '') + '.git' : j.url.replace(/\.git$/i, '') + '.git';
  return j.kind === 'pull'
    ? `git -C "${path.join(root, j.category, j.name)}" pull --ff-only${depth}`
    : `git clone${depth} ${shownUrl} "${path.join(root, j.category, j.name)}"`;
}

function enqueueClone({ workspace, category, url, name }) {
  const ws = wsById(workspace);
  const urlNorm = url.replace(/\.git$/i, '');
  const repoName = name && /^[\w.-]+$/.test(name) ? name : urlNorm.split('/').pop();
  const job = {
    id: 'job-' + Date.now().toString(36) + '-' + (++jobSeq),
    status: 'queued',        // queued | running | done | failed
    kind: 'clone',
    workspace: ws.id,
    category, url: urlNorm, name: repoName,
    command: jobCommand(ws, { kind: 'clone', category, url: urlNorm, name: repoName }),
    path: path.join(ws.dir, 'references', category, repoName),
    error: null,
    attempt: 0,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
  JOBS.unshift(job);
  if (JOBS.length > 200) JOBS.pop();

  // push the runner into the FIFO; drain() runs them strictly one-by-one on the
  // event loop — HTTP already returned 202, so nothing here can time a request out
  pending.push(async () => {
    job.status = 'running';
    persistJobs();
    while (job.attempt < RETRY) {
      job.attempt++;
      try {
        const r = await doClone({ workspace: ws.id, category, url, name });
        if (r.code < 400) {
          job.status = 'done';
          job.kind = r.body.action === 'pull' ? 'pull' : 'clone';
          job.command = jobCommand(ws, job);
          job.error = null;
          break;
        }
        // 4xx = bad request (bad url/category/origin) — retrying won't help
        if (r.code < 500) { job.error = (r.body && r.body.error) || 'unknown error'; break; }
        job.error = (r.body && r.body.error) || 'unknown error';
      } catch (e) {
        job.error = e.message;
      }
      // 5xx/network failure: back off (2s, 8s) then retry, unless it was the last attempt
      if (job.attempt < RETRY) {
        job.status = 'retrying';
        job.retryAt = new Date().toISOString();
        await new Promise((r2) => setTimeout(r2, 2000 * Math.pow(2, job.attempt - 1)));
        job.status = 'running';
      }
    }
    if (job.status !== 'done') job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    console.log(`[refdock] job ${job.id} ${job.status}${job.error ? ' — ' + job.error : ''}`);
  });
  drain();
  return job;
}

// ---------- registry yaml (minimal parser, supports v1 flat & v2 nested) ----------
function parseYamlMini(text) {
  const lines = [];
  for (const l of text.split(/\r?\n/)) {
    if (!l.trim() || l.trim().startsWith('#')) continue;
    lines.push(l);
  }
  let pos = 0;
  const indentOf = (s) => s.match(/^ */)[0].length;
  const scalar = (s) => {
    s = s.trim();
    if (s === '[]') return [];
    if (s === '{}') return {};
    if ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'"))) return s.slice(1, -1);
    return s;
  };
  function parseValue(minIndent) {
    if (pos >= lines.length) return null;
    const ind = indentOf(lines[pos]);
    if (ind < minIndent) return null;
    const t = lines[pos].trim();
    return t.startsWith('- ') ? parseList(ind) : parseMap(ind);
  }
  function parseList(indent) {
    const out = [];
    while (pos < lines.length) {
      const ind = indentOf(lines[pos]);
      if (ind !== indent) break;
      const t = lines[pos].trim();
      if (!t.startsWith('- ')) break;
      const rest = t.slice(2);
      const kv = rest.match(/^([\w.-]+):\s*(.*)$/);
      if (kv) {
        const item = { [kv[1]]: kv[2] === '' ? null : scalar(kv[2]) };
        pos++;
        parseMapRest(item, indent + 2);
        out.push(item);
      } else {
        out.push(scalar(rest));
        pos++;
      }
    }
    return out;
  }
  function parseMap(indent) {
    const obj = {};
    parseMapRest(obj, indent);
    return obj;
  }
  function parseMapRest(obj, indent) {
    while (pos < lines.length) {
      const ind = indentOf(lines[pos]);
      if (ind < indent) break;
      if (ind > indent) { pos++; continue; }
      const t = lines[pos].trim();
      const kv = t.match(/^([\w.-]+):\s*(.*)$/);
      if (!kv) break; // list item at this level → belongs to parent
      if (kv[2] === '') { pos++; obj[kv[1]] = parseValue(indent + 1); }
      else { obj[kv[1]] = scalar(kv[2]); pos++; }
    }
    return obj;
  }
  return parseValue(0);
}

function flattenRegistry(doc) {
  if (!doc || typeof doc !== 'object') return [];
  // v2: categories[].subcategories[].projects[]
  if (Array.isArray(doc.categories)) {
    const out = [];
    for (const cat of doc.categories) {
      for (const sub of cat && cat.subcategories || []) {
        for (const p of sub && sub.projects || []) {
          if (p && p.name && p.repo) {
            const catPath = cat.name + '/' + (sub.name || '');
            out.push({
              name: p.name,
              repo: p.repo,
              path: p.path || (catPath + '/' + p.name),
              category: catPath,
            });
          }
        }
      }
    }
    return out;
  }
  // v1: top-level projects[]
  if (Array.isArray(doc.projects)) {
    return doc.projects.filter((p) => p && p.name && p.repo && p.path);
  }
  return [];
}

function parseRegistry(text) {
  return flattenRegistry(parseYamlMini(text));
}

// ---------- categories ----------
function listCategories(ws) {
  const root = referencesRoot(ws);
  const out = [];
  const walk = (dir, prefix, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const rel = prefix ? prefix + '/' + e.name : e.name;
      // A category is any dir that contains at least one git repo OR is a plain grouping dir
      const p = path.join(dir, e.name);
      let hasGit = false;
      try { hasGit = fs.existsSync(path.join(p, '.git')); } catch {}
      const kids = fs.readdirSync(p, { withFileTypes: true }).filter((k) => k.isDirectory() && !k.name.startsWith('.'));
      const kidHasGit = kids.some((k) => { try { return fs.existsSync(path.join(p, k.name, '.git')); } catch { return false; } });
      if (hasGit || kidHasGit) out.push({ category: rel, leaf: hasGit });
      if (!hasGit && depth < 3) walk(p, rel, depth + 1);
    }
  };
  walk(root, '', 0);
  return out;
}

function listCategoryRepos(ws, category) {
  if (typeof category !== 'string' || /[\\]|\.\./.test(category)) return null;
  const dir = path.join(referencesRoot(ws), category);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && fs.existsSync(path.join(dir, e.name, '.git')))
    .map((e) => e.name);
}

// ---------- clipboard sentinel watcher ----------
async function watchClipboardLoop() {
  const pbpaste = os.platform() === 'win32' ? 'powershell' : 'pbpaste';
  const psArgs = ['-NoProfile', '-Command', 'Get-Clipboard -Raw'];
  let last = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, 500));
    let text = '';
    try {
      if (os.platform() === 'win32') {
        const r = await run('powershell', psArgs, process.cwd(), 5000);
        text = r.stdout;
      } else {
        const r = await run('pbpaste', [], process.cwd(), 5000);
        text = r.stdout;
      }
    } catch { continue; }
    const m = text.match(/REFDOCK:\/\/clone\?(\S+)/);
    if (!m || text === last) continue;
    last = text;
    const params = new URLSearchParams(m[1]);
    const req = {
      workspace: params.get('workspace') || WORKSPACES[0].id,
      category: params.get('category') || '',
      url: params.get('url') || '',
    };
    console.log('[refdock] clipboard sentinel →', req.url, '→', req.category);
    const res = await doClone(req);
    console.log('[refdock] clipboard result:', JSON.stringify(res.body));
  }
}

// ---------- http server ----------
function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // security: loopback only is enforced by bind; check token & origin
  if (TOKEN) {
    if (req.headers['x-refdock-token'] !== TOKEN) return fail(res, 401, 'bad token');
  }
  const origin = req.headers.origin || '';
  if (origin && ![...ORIGIN_ALLOW].some((p) => origin.startsWith(p))) {
    return fail(res, 403, 'origin not allowed');
  }
  const u = new URL(req.url, 'http://127.0.0.1');
  const q = u.searchParams;

  try {
    if (u.pathname === '/api/ping') {
      return ok(res, { version: VERSION, workspaces: WORKSPACES.map((w) => ({ id: w.id, name: w.name, dir: w.dir })) });
    }
    if (u.pathname === '/api/workspaces') {
      return ok(res, {
        workspaces: WORKSPACES.map((w) => ({
          id: w.id, name: w.name, dir: w.dir,
          referencesExists: fs.existsSync(referencesRoot(w)),
        })),
      });
    }
    if (u.pathname === '/api/tree') {
      const ws = wsById(q.get('workspace'));
      return ok(res, { categories: listCategories(ws) });
    }
    if (u.pathname === '/api/registry') {
      const ws = wsById(q.get('workspace'));
      const file = path.join(ws.dir, 'registry_references.yaml');
      if (!fs.existsSync(file)) return ok(res, { projects: [], missing: true });
      return ok(res, { projects: parseRegistry(fs.readFileSync(file, 'utf8')) });
    }
    if (u.pathname === '/api/list') {
      const ws = wsById(q.get('workspace'));
      const list = listCategoryRepos(ws, q.get('category') || '');
      if (list === null) return fail(res, 400, 'invalid category');
      return ok(res, { repos: list });
    }
    if (u.pathname === '/api/clone' && req.method === 'POST') {
      let body;
      try { body = JSON.parse(await readBody(req)); } catch { return fail(res, 400, 'bad json'); }
      // async: validate cheaply, enqueue, return 202 immediately; git runs in background
      if (typeof body.url !== 'string' || !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/i.test(body.url)) {
        return fail(res, 400, 'url must be an https github repo url');
      }
      if (typeof body.category !== 'string' || /[\\]|\.\.|^\/|^$|[\x00-\x1f]/.test(body.category)) {
        return fail(res, 400, 'invalid category (single relative path, no .. or backslash)');
      }
      const job = enqueueClone(body);
      return send(res, 202, { ok: true, queued: true, job: { id: job.id, status: job.status, path: job.path } });
    }
    if (u.pathname === '/api/jobs') {
      const limit = Math.min(Number(q.get('limit')) || 50, 200);
      return ok(res, { jobs: JOBS.slice(0, limit) });
    }
    if (u.pathname === '/api/retry' && req.method === 'POST') {
      let body;
      try { body = JSON.parse(await readBody(req)); } catch { return fail(res, 400, 'bad json'); }
      const job = JOBS.find((j) => j.id === body.id);
      if (!job) return fail(res, 404, 'unknown job: ' + body.id);
      if (job.status === 'queued' || job.status === 'running') {
        return ok(res, { job: { id: job.id, status: job.status } });
      }
      const fresh = enqueueClone({ workspace: job.workspace, category: job.category, url: job.url, name: job.name });
      return send(res, 202, { ok: true, queued: true, job: { id: fresh.id, status: fresh.status, retriedFrom: job.id } });
    }
    return fail(res, 404, 'not found: ' + u.pathname);
  } catch (e) {
    return fail(res, 500, 'server error: ' + e.message);
  }
});

// guard against binding failures with a clear message
server.on('error', (e) => {
  console.error('[refdock] server error:', e.message);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[refdock] v${VERSION} listening on http://127.0.0.1:${PORT}`);
  for (const w of WORKSPACES) console.log(`[refdock]   workspace ${w.id}: ${w.dir}`);
  if (TOKEN) console.log('[refdock]   token auth enabled');
  if (WATCH_CLIPBOARD) console.log('[refdock]   clipboard sentinel watching (REFDOCK://clone?...)');
  if (MIRROR) console.log('[refdock]   mirror: ' + MIRROR);
  if (PROXY) console.log('[refdock]   proxy: ' + PROXY);
  if (CLONE_TIMEOUT) console.log('[refdock]   clone timeout: ' + CLONE_TIMEOUT + 'ms');
  console.log('[refdock]   retries per job: ' + RETRY + ', git ops unlimited-time');
});

if (WATCH_CLIPBOARD) watchClipboardLoop().catch((e) => console.error('[refdock] clipboard watcher crashed:', e));
