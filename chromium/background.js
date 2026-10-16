console.log('[copy-ui-path-lite] background loaded');

// ── Inject picker into a tab ──────────────────────────────────────

async function injectPicker(tabId) {
  console.log('[copy-ui-path-lite] injecting picker into tab', tabId);
  try {
    await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['picker.js'] });
    console.log('[copy-ui-path-lite] picker injected OK');
  } catch (err) {
    console.error('[copy-ui-path-lite] injection failed:', err.message);
  }
}

// ── Icon click ────────────────────────────────────────────────────

chrome.action.onClicked.addListener(function (tab) {
  injectPicker(tab.id);
});

// ── Keyboard shortcut (Ctrl+Shift+X) ─────────────────────────────

chrome.commands.onCommand.addListener(function (command) {
  console.log('[copy-ui-path-lite] command received:', command);
  if (command === 'pick-element') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      if (tabs[0]) injectPicker(tabs[0].id);
    });
  }
});

// ── Right-click context menu ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: 'copy-path-lite',
    title: 'Copy Path',
    contexts: ['all']
  });
});
try {
  chrome.contextMenus.create({
    id: 'copy-path-lite',
    title: 'Copy Path',
    contexts: ['all']
  });
} catch (e) {}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === 'copy-path-lite') {
    injectPicker(tab.id);
  }
});

// ── Capture visible tab for an element screenshot ──────────────────

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.action !== 'ctp-capture-visible') return;
  var windowId = (sender && sender.tab && sender.tab.windowId) ? sender.tab.windowId : null;
  var opts = { format: 'png' };
  var done = function (dataUrl) {
    if (chrome.runtime.lastError) sendResponse({ dataUrl: null, error: chrome.runtime.lastError.message });
    else sendResponse({ dataUrl: dataUrl });
  };
  if (windowId === null) chrome.tabs.captureVisibleTab(opts, done);
  else chrome.tabs.captureVisibleTab(windowId, opts, done);
  return true;
});