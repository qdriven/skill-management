/* RefDock popup — repo detection, category pick, clone/copy. */
'use strict';

const $ = (id) => document.getElementById(id);
// fixed top-level categories; subcategory comes from the references tree
const FIXED_CATS = ['skills', 'plugins', 'products', 'others'];
const state = {
  repo: null,        // { owner, name, branch, desc }
  workspace: null,   // ws id
  categories: [],    // [{category, leaf}] from /api/tree
  picked: null,      // fixed category string
  pickedSub: null,   // subcategory under picked (may be null)
  serverUp: false,
};

const SETTINGS_DEFAULTS = { serverUrl: 'http://127.0.0.1:7420', token: '' };

async function settings() {
  const got = await chrome.storage.local.get(SETTINGS_DEFAULTS);
  return got;
}

function setStatus(msg, kind = 'busy', spin = false) {
  const el = $('status');
  el.className = 'status show ' + kind;
  el.innerHTML = (spin ? '<span class="spin"></span>' : '') + escapeHtml(msg);
}
function clearStatus() { $('status').className = 'status'; }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function apiBase(s) { return s.serverUrl.replace(/\/+$/, ''); }
function headers(s) { return s.token ? { 'X-RefDock-Token': s.token } : {}; }

async function fetchApi(pathname, opts = {}) {
  const s = await settings();
  const r = await fetch(apiBase(s) + pathname, { ...opts, headers: { ...headers(s), ...(opts.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.ok === false) throw new Error(body.error || ('HTTP ' + r.status));
  return body;
}

// ---------- current tab repo detection ----------
async function detectRepo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/github\.com\//.test(tab.url || '')) return null;
  const m = tab.url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/);
  if (!m) return null;
  const [, owner, name] = m;
  if (owner === 'orgs' || name === 'orgs' || ['settings', 'explore', 'marketplace', 'topics', 'features', 'collections', 'trending'].includes(owner)) return null;
  return { owner, name, url: `https://github.com/${owner}/${name}` };
}

// ---------- render ----------
function renderRepo() {
  const r = state.repo;
  $('repoName').textContent = r ? `${r.owner}/${r.name}` : '未检测到仓库 — 请打开 GitHub 项目页';
  $('repoBranch').style.display = 'none';
  $('repoDesc').style.display = 'none';
  $('go').disabled = !(r && state.picked);
  $('copy').disabled = !r;
}

// children of references/<picked>/ that are grouping dirs (leaf:false in tree)
function subCatsFor(picked) {
  const prefix = picked + '/';
  return state.categories.filter((c) => c.category.startsWith(prefix) && !c.leaf)
    .map((c) => c.category.slice(prefix.length).split('/')[0]);
}

function renderCats() {
  const box = $('cats');
  box.innerHTML = '';
  for (const name of FIXED_CATS) {
    const b = document.createElement('button');
    b.className = 'cat-chip' + (state.picked === name ? ' on' : '');
    b.textContent = name;
    b.title = `clone 到 references/${name}/`;
    b.onclick = () => {
      state.picked = name; state.pickedSub = null;
      renderCats(); renderSubs(); renderRepo();
    };
    box.appendChild(b);
  }
  if (!state.serverUp) box.innerHTML = '<span class="pill gray">服务离线 — 仍可选择类别,clone 将复制命令</span>';
}

function renderSubs() {
  const row = $('subRow'), sel = $('sub');
  const subs = state.picked ? subCatsFor(state.picked) : [];
  if (!subs.length) { row.style.display = 'none'; state.pickedSub = null; return; }
  row.style.display = '';
  sel.innerHTML = '';
  const o0 = document.createElement('option');
  o0.value = ''; o0.textContent = `(直接放在 ${state.picked}/)`;
  sel.appendChild(o0);
  for (const s of subs) {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    sel.appendChild(o);
  }
  sel.value = state.pickedSub || '';
  sel.onchange = () => { state.pickedSub = sel.value || null; };
}

function renderServer(up, text) {
  $('dot').className = 'dot' + (up ? ' on' : '');
  $('srv').textContent = text;
}

// ---------- actions ----------
async function pingServer() {
  try {
    const s = await settings();
    const r = await fetch(apiBase(s) + '/api/ping', { headers: headers(s) });
    const body = await r.json();
    if (!body.ok) throw new Error('bad pong');
    state.serverUp = true;
    const names = (body.workspaces || []).map((w) => w.name).join(', ');
    renderServer(true, names ? `服务在线 (${names})` : '服务在线');
    return body.workspaces || [];
  } catch {
    state.serverUp = false;
    renderServer(false, '服务离线 — clone 将复制命令');
    return [];
  }
}

function cloneCommand() {
  const r = state.repo;
  const ws = WORKSPACES_CACHE.find((w) => w.id === state.workspace);
  const root = ws ? ws.dir.replace(/[\\/]+$/, '') + '\\references' : '<workspace>\\references';
  const cat = state.pickedSub ? `${state.picked}/${state.pickedSub}` : (state.picked || '<category>');
  return `git clone ${r.url}.git "${root}\\${cat}\\${r.name}"`;
}

let WORKSPACES_CACHE = [];

async function loadAll() {
  const wss = await pingServer();
  WORKSPACES_CACHE = wss;
  const sel = $('ws');
  if (wss.length) {
    sel.innerHTML = '';
    for (const w of wss) {
      const o = document.createElement('option');
      o.value = w.id; o.textContent = w.name; o.title = w.dir;
      sel.appendChild(o);
    }
    const remembered = (await chrome.storage.local.get('ws')).ws;
    state.workspace = remembered && wss.some((w) => w.id === remembered) ? remembered : wss[0].id;
    sel.value = state.workspace;
  } else {
    sel.innerHTML = '<option>—</option>';
    state.workspace = 'ws0';
  }
  sel.onchange = async () => {
    state.workspace = sel.value;
    await chrome.storage.local.set({ ws: sel.value });
    state.picked = null;
    await loadCatsAndTree();
  };

  await loadCatsAndTree();
}

async function loadCatsAndTree() {
  $('cats').innerHTML = '<span class="pill gray">加载中…</span>';
  if (!state.serverUp) {
    state.categories = [];
    renderCats(); renderSubs(); renderRepo();
    return;
  }
  try {
    const tree = await fetchApi(`/api/tree?workspace=${state.workspace}`);
    state.categories = tree.categories || [];
    renderCats(); renderSubs();
  } catch (e) {
    state.categories = [];
    renderCats(); renderSubs();
    setStatus(e.message, 'err');
  }
  renderRepo();
}

$('go').onclick = async () => {
  const r = state.repo;
  if (!r || !state.picked) return;
  const btn = $('go');
  btn.disabled = true;

  if (!state.serverUp) { await doCopy(); btn.disabled = false; return; }

  const category = state.pickedSub ? `${state.picked}/${state.pickedSub}` : state.picked;
  setStatus('已提交 clone 请求 — 后台执行中', 'busy');
  try {
    const body = JSON.stringify({ workspace: state.workspace, category, url: r.url, name: r.name });
    const res = await fetchApi('/api/clone', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
    setStatus(`已入队 (${res.job.id}) — ${res.job.path}`, 'ok');
    renderJobs(); // refresh records if open
  } catch (e) {
    setStatus('失败: ' + e.message, 'err');
  }
  btn.disabled = false;
};

// ---------- clone records (async job log) ----------
let jobsOpen = false;

async function renderJobs() {
  if (!jobsOpen) return;
  const list = $('jobsList');
  try {
    const { jobs } = await fetchApi('/api/jobs?limit=30');
    if (!jobs.length) { list.innerHTML = '<span class="pill gray">暂无记录</span>'; return; }
    const ICON = { queued: '⏳', running: '🔄', retrying: '🔁', done: '✅', failed: '❌' };
    const now = Date.now();
    list.innerHTML = jobs.map((j) => {
      const active = j.status === 'running' || j.status === 'queued' || j.status === 'retrying';
      const mins = j.createdAt ? Math.max(1, Math.round((now - Date.parse(j.createdAt)) / 60000)) : null;
      const activeTag = active && mins ? `<span class="pill gray">${mins}min${j.attempt > 1 ? ' · 第' + j.attempt + '次' : ''}</span>` : '';
      return `
      <div class="job ${j.status}" title="${escapeHtml(j.command)}">
        <span class="ji">${ICON[j.status] || '·'}</span>
        <div class="jbody">
          <div class="jline"><b>${escapeHtml(j.name || '')}</b><span class="pill gray">${escapeHtml(j.category)}</span>${activeTag}</div>
          <div class="jcmd">${escapeHtml(j.command)}</div>
          ${j.error ? `<div class="jerr">${escapeHtml(j.error)}</div>` : ''}
        </div>
        ${j.status === 'failed' ? `<button class="retry" data-id="${escapeHtml(j.id)}">重跑</button>` : ''}
      </div>`;
    }).join('');
    list.querySelectorAll('.retry').forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        try {
          await fetchApi('/api/retry', { method: 'POST', body: JSON.stringify({ id: b.dataset.id }), headers: { 'Content-Type': 'application/json' } });
          setStatus('已重新入队 — 后台执行中', 'ok');
          setTimeout(renderJobs, 300);
        } catch (e) { setStatus('重跑失败: ' + e.message, 'err'); }
      };
    });
  } catch (e) {
    list.innerHTML = `<span class="pill gray">${escapeHtml(e.message)}</span>`;
  }
}

$('jobsBtn').onclick = () => {
  jobsOpen = !jobsOpen;
  $('jobsCard').style.display = jobsOpen ? '' : 'none';
  if (jobsOpen) renderJobs();
};
$('jobsClose').onclick = (e) => { e.preventDefault(); jobsOpen = false; $('jobsCard').style.display = 'none'; };

async function doCopy() {
  const cmd = cloneCommand();
  await navigator.clipboard.writeText(cmd);
  setStatus('已复制命令 → 粘贴到终端执行', 'ok');
}
$('copy').onclick = () => doCopy();

// ---------- boot ----------
(async function boot() {
  renderServer(false, '检查服务…');
  state.repo = await detectRepo();
  renderRepo();
  await loadAll();
})();
