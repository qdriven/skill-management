/* RefDock options page. */
'use strict';
const $ = (id) => document.getElementById(id);

async function load() {
  const got = await chrome.storage.local.get({ serverUrl: 'http://127.0.0.1:7420', token: '' });
  $('serverUrl').value = got.serverUrl;
  $('token').value = got.token;
  try {
    const r = await fetch(got.serverUrl.replace(/\/+$/, '') + '/api/workspaces');
    const body = await r.json();
    const tb = $('wsTable').querySelector('tbody');
    tb.innerHTML = (body.workspaces || [])
      .map((w) => `<tr><td class="mono">${w.id}</td><td>${w.name}</td><td class="mono">${w.dir}</td></tr>`)
      .join('') || '<tr><td colspan="3" style="color:#7d8f84">无法读取</td></tr>';
  } catch {}
}

$('save').onclick = async () => {
  await chrome.storage.local.set({
    serverUrl: $('serverUrl').value.trim().replace(/\/+$/, '') || 'http://127.0.0.1:7420',
    token: $('token').value.trim(),
  });
  msg('已保存', 'ok');
};

$('test').onclick = async () => {
  const base = $('serverUrl').value.trim().replace(/\/+$/, '');
  const headers = $('token').value.trim() ? { 'X-RefDock-Token': $('token').value.trim() } : {};
  try {
    const r = await fetch(base + '/api/ping', { headers });
    const body = await r.json();
    if (!body.ok) throw new Error('bad response');
    msg(`连接成功 v${body.version} · ${(body.workspaces || []).length} 个 workspace`, 'ok');
  } catch (e) {
    msg('连接失败: ' + e.message, 'err');
  }
};

function msg(t, k) {
  const el = $('msg');
  el.textContent = t;
  el.className = k;
}

load();
