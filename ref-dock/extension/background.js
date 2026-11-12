/* RefDock background service worker — keyboard shortcut → open popup near current tab. */
'use strict';

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open-refdock') return;
  // Chrome opens the action popup only via user gesture on the icon; from a
  // command we can't open the popup programmatically, so fall back to opening
  // the popup as a small window anchored to the current tab.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const w = await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    focused: true,
    width: 400,
    height: 600,
    ...(tab ? { top: Math.max(0, (tab.windowId ? 100 : 100)) } : {}),
  });
  void w;
});
