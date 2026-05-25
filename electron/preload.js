// Halo OS — Electron preload bridge.
//
// Exposes a tiny, well-typed API to the renderer (Halo OS UI code) so it
// can detect it's running inside Electron and drive embedded <webview>
// elements via the main process. The renderer never has direct access to
// Node, Electron internals, or arbitrary webContents handles — it goes
// through these IPC channels.
//
// The whole point of this bridge: the agent (LLM-driven loop inside
// Halo's UI) needs to *act* on real websites — click links, fill forms,
// scrape DOM. In a plain browser tab this is impossible across origins.
// In Electron, the main process holds the webContents and exposes
// narrowly-scoped capabilities.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('HALO_ELECTRON', {
  version: process.versions.electron,
  platform: process.platform,
});

contextBridge.exposeInMainWorld('haloAgent', {
  /**
   * Register a <webview> element's webContents ID so the agent can drive it.
   * Call once after the webview emits `dom-ready`.
   *   await haloAgent.registerWebview(id, webview.getWebContentsId());
   */
  registerWebview: (id, webContentsId) =>
    ipcRenderer.invoke('agent:registerWebview', { id, webContentsId }),

  /**
   * Execute arbitrary JS inside the webview and return whatever it returns.
   * Use for everything: clicks, fills, DOM scraping. Code runs in the
   * webview's isolated world.
   */
  executeJS: (id, code) =>
    ipcRenderer.invoke('agent:executeJS', { id, code }),

  /** Capture the webview as a base64 PNG data URL — for screenshot-to-LLM. */
  screenshot: (id) =>
    ipcRenderer.invoke('agent:screenshot', { id }),

  /** Get current URL + page title of the webview. */
  getURL: (id) =>
    ipcRenderer.invoke('agent:getURL', { id }),

  /** Enumerate all webviews currently registered with the bridge. */
  list: () => ipcRenderer.invoke('agent:listWebviews'),
});
