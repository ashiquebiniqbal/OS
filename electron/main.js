// Halo OS — Electron main process.
//
// What this does:
//   1. Creates a frameless BrowserWindow that loads index.html locally.
//   2. Strips X-Frame-Options and `frame-ancestors` from incoming responses
//      so <webview> elements inside Halo's Browser app can embed any site
//      (YouTube, Gmail, Salesforce, etc.) without the host browser refusing.
//   3. Enables the <webview> tag (off by default since Electron 5+).
//   4. Wires IPC channels the renderer needs to drive the active webview:
//      - 'agent:executeJS'   run JS inside the active webview and return the result
//      - 'agent:screenshot'  capture the active webview as a base64 PNG
//      - 'agent:listWebviews' list webview ids registered by the renderer
//
// Security note: stripping XFO is a deliberate trade-off for an agentic
// desktop OS. The user trusts Halo with the sites they embed (it's their
// own desktop app), same as Camoufox / holaOS / any other agent-driven
// browser. We never proxy traffic — fetches go user→origin directly.

const { app, BrowserWindow, session, ipcMain, Menu } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;
let mainWindow = null;

function stripFrameRestrictions(headers) {
  // Headers come in mixed-case from Chromium; iterate all keys, normalize.
  const out = {};
  for (const [key, val] of Object.entries(headers || {})) {
    const k = key.toLowerCase();
    if (k === 'x-frame-options') continue; // drop
    if (k === 'content-security-policy' || k === 'content-security-policy-report-only') {
      // Strip frame-ancestors directive but keep the rest of the CSP intact
      const cleaned = (Array.isArray(val) ? val : [val]).map(line =>
        String(line)
          .split(';')
          .map(s => s.trim())
          .filter(s => s && !/^frame-ancestors\b/i.test(s))
          .join('; ')
      ).filter(Boolean);
      if (cleaned.length) out[key] = cleaned;
      continue;
    }
    out[key] = val;
  }
  return out;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0c0f13',
    title: 'Halo OS',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,        // preload needs require()
      webviewTag: true,      // enable <webview> inside Halo Browser
      spellcheck: true,
    },
  });

  // Strip XFO + frame-ancestors from every response so <webview> can load any site
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: stripFrameRestrictions(details.responseHeaders) });
  });

  // Open external `_blank` links in the host browser, not a new Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load Halo OS — file:// in production, dev server in dev so live edits show
  const startUrl = isDev && process.env.HALO_DEV_URL
    ? process.env.HALO_DEV_URL
    : `file://${path.join(__dirname, '..', 'index.html')}`;
  mainWindow.loadURL(startUrl);

  if (process.env.HALO_OPEN_DEVTOOLS) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// ----- IPC: renderer → main → active webview ----------------------------

// The renderer registers webview <webContents> handles by id.
// We look them up at request time so the renderer never holds a privileged handle.
const webviewRegistry = new Map(); // id -> webContents

ipcMain.handle('agent:registerWebview', (event, { id, webContentsId }) => {
  try {
    const wc = require('electron').webContents.fromId(webContentsId);
    if (!wc) return { ok: false, error: 'no webContents' };
    webviewRegistry.set(id, wc);
    wc.on('destroyed', () => webviewRegistry.delete(id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('agent:executeJS', async (event, { id, code }) => {
  const wc = webviewRegistry.get(id);
  if (!wc) return { ok: false, error: 'unknown webview id' };
  try {
    const result = await wc.executeJavaScript(code, true);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('agent:screenshot', async (event, { id }) => {
  const wc = webviewRegistry.get(id);
  if (!wc) return { ok: false, error: 'unknown webview id' };
  try {
    const img = await wc.capturePage();
    return { ok: true, dataUrl: img.toDataURL() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('agent:getURL', (event, { id }) => {
  const wc = webviewRegistry.get(id);
  if (!wc) return { ok: false, error: 'unknown webview id' };
  return { ok: true, url: wc.getURL(), title: wc.getTitle() };
});

ipcMain.handle('agent:listWebviews', () => {
  return [...webviewRegistry.entries()].map(([id, wc]) => ({
    id, url: wc.getURL(), title: wc.getTitle(),
  }));
});

// ----- App lifecycle ----------------------------------------------------

app.whenReady().then(() => {
  // Minimal menu — hide default to give Halo's own dock the real estate
  Menu.setApplicationMenu(null);
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
