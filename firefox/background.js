console.log('[copy-ui-path-lite] background loaded');

browser.runtime.onMessage.addListener(function (msg, sender) {
  if (!msg || msg.action !== 'ctp-capture-visible') return;
  var opts = { format: 'png' };
  try {
    return browser.tabs.captureVisibleTab(browser.windows.WINDOW_ID_CURRENT, opts)
      .then(function (dataUrl) { return { dataUrl: dataUrl }; })
      .catch(function (err) { return { dataUrl: null, error: String(err && err.message || err) }; });
  } catch (e) {
    return browser.tabs.captureVisibleTab(opts)
      .then(function (dataUrl) { return { dataUrl: dataUrl }; })
      .catch(function (err) { return { dataUrl: null, error: String(err && err.message || err) }; });
  }
});

// ── Inject picker into a tab ──────────────────────────────────────

function injectPicker(tabId) {
  console.log('[copy-ui-path-lite] injecting picker into tab', tabId);
  browser.tabs.executeScript(tabId, { file: 'picker.js' })
    .then(function () { console.log('[copy-ui-path-lite] picker injected OK'); })
    .catch(function (err) { console.error('[copy-ui-path-lite] injection failed:', err.message); });
}

// ── Icon click ────────────────────────────────────────────────────

if (browser && browser.browserAction && browser.browserAction.onClicked) {
  browser.browserAction.onClicked.addListener(function (tab) { injectPicker(tab.id); });
}

// ── Keyboard shortcut (Ctrl+Shift+X) ─────────────────────────────

if (browser && browser.commands && browser.commands.onCommand) {
  browser.commands.onCommand.addListener(function (command) {
    console.log('[copy-ui-path-lite] command received:', command);
    if (command === 'pick-element') {
      browser.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
        if (tabs[0]) injectPicker(tabs[0].id);
      });
    }
  });
}

// ── Right-click context menu ──────────────────────────────────────

if (browser && browser.contextMenus) {
  function createContextMenus() {
    try {
      browser.contextMenus.create({ id: 'copy-path-lite', title: 'Copy Path', contexts: ['all'] }, function () {
        if (browser.runtime.lastError) { /* item already exists on reload */ }
      });
    } catch (e) {}
  }
  browser.runtime.onInstalled.addListener(createContextMenus);
  createContextMenus();
  if (browser.contextMenus.onClicked) {
    browser.contextMenus.onClicked.addListener(function (info, tab) {
      if (info.menuItemId === 'copy-path-lite' && tab) {
        injectPicker(tab.id);
      }
    });
  }
}