/**
 * iframe-fallback for http(s) URLs.
 *
 * Strategy (system architect approach):
 *   1. Consult `site-adapters.js` first — rewrite known URLs (YouTube → /embed/,
 *      Vimeo → player, Wikipedia → halo://wiki, etc.).
 *   2. If the adapter says `mode: 'external'`, render a clean card with three
 *      escape hatches (open externally, reader mode, search alternative).
 *      **Exception:** when running inside Electron, X-Frame-Options is stripped
 *      at the main-process layer, so "known-blocked" is treated as embeddable
 *      and we render a <webview> directly.
 *   3. If `mode: 'iframe'`, render a <webview> (Electron) or <iframe> (browser).
 *   4. If the user prefers, Reader Proxy (Settings) bypasses everything.
 */
import { Store } from '../persistence.js';
import { adaptUrl } from '../site-adapters.js';
import * as errorPage from './error.js';

const IS_ELECTRON = typeof window !== 'undefined' && !!window.HALO_ELECTRON;

export async function render(viewport, browser, tab, { url }) {
  browser.setTabTitle(tab, prettyTitle(url));
  const s = Store.loadSettings();

  // User explicitly preferred reader mode — honor it for all http(s) URLs.
  if (s.readerProxy) {
    return renderReaderProxy(viewport, browser, tab, url);
  }

  const adapted = adaptUrl(url);

  // Adapter said "route to a halo:// page" — always honor.
  if (adapted.mode === 'route') {
    return browser.navigate(adapted.url);
  }

  // Adapter said "skip the iframe, this won't work" — but in Electron we
  // *can* load it because XFO is stripped, so fall through to webview.
  if (adapted.mode === 'external' && !IS_ELECTRON) {
    return renderExternalCard(viewport, browser, tab, url, adapted.reason);
  }

  // Render the (possibly rewritten) URL in the most permissive embed
  // mechanism available.
  const embedUrl = adapted.mode === 'external' ? url : adapted.url;
  const reason = adapted.mode === 'external' && IS_ELECTRON
    ? 'Loaded as desktop webview (X-Frame-Options stripped).'
    : adapted.reason;
  return renderEmbed(viewport, browser, tab, url, embedUrl, reason);
}

/* ------------------------------------------------------------------
   Mode: external — site is known un-embeddable. Show three options.
   (Only reachable in plain-browser mode; Electron embeds everything.)
------------------------------------------------------------------- */
function renderExternalCard(viewport, browser, tab, url, reason) {
  const host = safeHostname(url);
  viewport.innerHTML = `
    <div class="ifr-root">
      <div class="ifr-external-card">
        <div class="err-ico">🔒</div>
        <h1>${escapeHtml(host)} can't be embedded</h1>
        <p class="ifr-reason">${escapeHtml(reason || 'This site sends X-Frame-Options to prevent embedding.')}</p>
        <p class="err-url"><code>${escapeHtml(url)}</code></p>
        <div class="ifr-actions">
          <a class="err-btn primary" href="${escapeAttr(url)}" target="_blank" rel="noopener">Open in real browser ↗</a>
          <button class="err-btn" id="ifr-reader">Try Reader Mode</button>
          <button class="err-btn" id="ifr-search">Search instead</button>
        </div>
        <p class="ifr-explain">
          Halo runs inside your host browser, which enforces the site's
          embedding policy. Reader Mode fetches a text-only version via
          <code>r.jina.ai</code>; "Search instead" looks the page up on
          Wikipedia. To embed any site directly, launch Halo as the desktop
          app (<code>npm start</code>).
        </p>
      </div>
    </div>
  `;
  viewport.querySelector('#ifr-reader').addEventListener('click', () => renderReaderProxy(viewport, browser, tab, url));
  viewport.querySelector('#ifr-search').addEventListener('click', () => {
    const q = host.replace(/^www\./, '');
    browser.navigate(`halo://search?q=${encodeURIComponent(q)}`);
  });
}

/* ------------------------------------------------------------------
   Mode: embed — render the (possibly rewritten) URL.
   In Electron: <webview> (no XFO enforcement, full agent control)
   In browser: <iframe>     (XFO enforced by host)
------------------------------------------------------------------- */
function renderEmbed(viewport, browser, tab, originalUrl, embedUrl, reason) {
  const rewritten = embedUrl !== originalUrl;
  const bannerText = rewritten
    ? `↺ ${escapeHtml(reason || 'URL rewritten for embedding.')}`
    : (IS_ELECTRON
        ? '◈ Live webview — agent can drive this page.'
        : '⚠ Embedded view — the site may block this via X-Frame-Options.');

  if (IS_ELECTRON) {
    const wvId = `wv-${tab.id}`;
    viewport.innerHTML = `
      <div class="ifr-root">
        <div class="ifr-banner ${rewritten ? 'rewritten' : 'live'}">
          <span>${bannerText}</span>
          <button id="ifr-enable-proxy">Reader Mode</button>
        </div>
        <webview id="${wvId}" src="${escapeAttr(embedUrl)}" allowpopups partition="persist:halo"></webview>
      </div>
    `;
    const wv = viewport.querySelector('webview');
    let registered = false;
    const tryRegister = async () => {
      if (registered) return;
      try {
        const wcid = wv.getWebContentsId();
        const r = await window.haloAgent.registerWebview(wvId, wcid);
        if (r?.ok) registered = true;
      } catch (e) { /* webview not attached yet, retry on next event */ }
    };
    // Register at every plausible point. The bridge is idempotent on the main side.
    wv.addEventListener('did-attach', tryRegister);
    wv.addEventListener('dom-ready', async () => {
      await tryRegister();
      const t = wv.getTitle?.();
      if (t) browser.setTabTitle(tab, t);
    });
    wv.addEventListener('did-finish-load', tryRegister);
    wv.addEventListener('did-navigate', tryRegister);
    wv.addEventListener('page-title-updated', (e) => browser.setTabTitle(tab, e.title));
    wv.addEventListener('did-fail-load', (e) => {
      // Ignore generic "ERR_ABORTED" from sub-frame redirects
      if (e.errorCode === -3) return;
      errorPage.render(viewport, browser, tab, { code: 'NETWORK', url: originalUrl, message: e.errorDescription });
    });
    viewport.querySelector('#ifr-enable-proxy').addEventListener('click', () =>
      renderReaderProxy(viewport, browser, tab, originalUrl));
    return;
  }

  // Plain-browser fallback: iframe + XFO timeout heuristic.
  viewport.innerHTML = `
    <div class="ifr-root">
      <div class="ifr-banner ${rewritten ? 'rewritten' : ''}">
        <span>${bannerText}</span>
        <button id="ifr-enable-proxy">Reader Mode</button>
      </div>
      <iframe id="ifr" src="${escapeAttr(embedUrl)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="no-referrer"></iframe>
    </div>
  `;
  const iframe = viewport.querySelector('#ifr');
  let loaded = false;
  iframe.addEventListener('load', () => { loaded = true; });
  setTimeout(() => {
    if (!loaded) errorPage.render(viewport, browser, tab, { code: 'CORS_BLOCKED', url: originalUrl });
  }, 4000);
  viewport.querySelector('#ifr-enable-proxy').addEventListener('click', () =>
    renderReaderProxy(viewport, browser, tab, originalUrl));
}

/* ------------------------------------------------------------------
   Mode: reader — fetch via r.jina.ai which returns readable markdown.
------------------------------------------------------------------- */
async function renderReaderProxy(viewport, browser, tab, url) {
  viewport.innerHTML = `
    <div class="ifr-reader">
      <header class="ifr-reader-header">
        <span class="ifr-reader-source">Reader proxy via r.jina.ai · ${escapeHtml(url)}</span>
        <a href="${escapeAttr(url)}" target="_blank" rel="noopener">Open original ↗</a>
      </header>
      <div id="ifr-reader-body"><div class="halo-loading"><span class="halo-spinner"></span>Fetching readable view…</div></div>
    </div>
  `;
  try {
    const r = await fetch(`https://r.jina.ai/${url}`);
    if (!r.ok) throw new Error('proxy failed');
    const text = await r.text();
    viewport.querySelector('#ifr-reader-body').innerHTML = `<pre class="ifr-reader-text">${escapeHtml(text)}</pre>`;
  } catch (e) {
    return errorPage.render(viewport, browser, tab, { code: 'NETWORK', url, message: 'Reader proxy could not fetch this URL.' });
  }
}

function prettyTitle(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
}
function safeHostname(url) {
  try { return new URL(url).hostname; } catch (e) { return url; }
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
