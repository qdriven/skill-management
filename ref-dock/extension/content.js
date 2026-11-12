/* RefDock content script — GitHub repo page badge.
 * Detects owner/repo on repo pages and shows a small floating hint that the
 * RefDock extension is ready. Kept minimal: no interference with GitHub UI.
 */
'use strict';

(() => {
  if (window.__refdockInjected) return;
  window.__refdockInjected = true;

  const m = location.pathname.match(/^\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/);
  if (!m) return;
  const [, owner, name] = m;
  if (!name || ['orgs', 'topics', 'explore', 'marketplace', 'trending', 'collections', 'settings', 'features'].includes(owner)) return;

  // Signal availability: the popup reads the URL itself; the badge is just a
  // quiet affordance so the user knows RefDock is active on this page.
  const badge = document.createElement('div');
  badge.className = 'refdock-badge';
  badge.textContent = 'R';
  badge.title = `RefDock 就绪: ${owner}/${name} — 点击工具栏图标或按 Alt+R 一键 clone`;
  badge.addEventListener('click', () => {
    badge.classList.add('pulse');
    setTimeout(() => badge.classList.remove('pulse'), 900);
  });
  document.documentElement.appendChild(badge);
})();
