console.log('[copy-ui-path-lite] background loaded');

// Capture listener registered first so message API stays usable even if UI APIs fail.
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.action !== 'ctp-capture-visible') return;
  var opts = { format: 'png' };
  var done = function (dataUrl) {
    if (chrome.runtime.lastError) sendResponse({ dataUrl: null, error: chrome.runtime.lastError.message });
    else sendResponse({ dataUrl: dataUrl });
  };
  try {
    chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, opts, done);
  } catch (e) {
    chrome.tabs.captureVisibleTab(opts, done);
  }
  return true;
});

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

if (chrome && chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(function (tab) { injectPicker(tab.id); });
}

// ── Keyboard shortcut (Ctrl+Shift+X) ─────────────────────────────

if (chrome && chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(function (command) {
    console.log('[copy-ui-path-lite] command received:', command);
    if (command === 'pick-element') {
      chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
        if (tabs[0]) injectPicker(tabs[0].id);
      });
    }
  });
}

// ── Right-click context menu ──────────────────────────────────────

if (chrome && chrome.contextMenus) {
  try {
    function createContextMenus() {
      chrome.contextMenus.removeAll(function () {
        chrome.contextMenus.create({ id: 'copy-path-lite', title: 'Copy Path', contexts: ['all'] }, function () {
          if (chrome.runtime.lastError) { /* ignore */ }
        });
      });
    }
    chrome.runtime.onInstalled.addListener(createContextMenus);
    createContextMenus();
  } catch (e) {}
  if (chrome.contextMenus.onClicked) {
    chrome.contextMenus.onClicked.addListener(function (info, tab) {
      if (info.menuItemId === 'copy-path-lite' && tab) {
        injectPicker(tab.id);
      }
    });
  }
}