/**
 * halo://devtools — inspect the active tab: URL breakdown, DOM tree (of viewport),
 * network log of fetches our renderers made (intercepted via window.fetch override).
 */
export async function render(viewport, browser, tab) {
  browser.setTabTitle(tab, 'DevTools');
  const active = browser.activeTab();
  const inspectUrl = active && active !== tab ? active.url : tab.url;

  viewport.innerHTML = `
    <div class="dev-root">
      <header class="dev-header"><h1>DevTools</h1><span class="dev-meta">Inspecting: <code>${escapeHtml(inspectUrl)}</code></span></header>
      <nav class="dev-nav">
        <button class="active" data-panel="url">URL</button>
        <button data-panel="net">Network</button>
        <button data-panel="storage">Storage</button>
      </nav>
      <div class="dev-body" id="dev-body"></div>
    </div>
  `;

  const body = viewport.querySelector('#dev-body');
  const render = (panel) => {
    if (panel === 'url') body.innerHTML = renderUrl(inspectUrl);
    else if (panel === 'net') body.innerHTML = renderNetwork(browser);
    else if (panel === 'storage') body.innerHTML = renderStorage();
  };
  render('url');
  viewport.querySelectorAll('.dev-nav button').forEach(b => b.addEventListener('click', () => {
    viewport.querySelectorAll('.dev-nav button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    render(b.dataset.panel);
  }));
}

function renderUrl(url) {
  try {
    const u = new URL(url.replace('halo://', 'halo:///'));
    const isHalo = url.startsWith('halo://');
    return `
      <table class="dev-table">
        <tr><th>Raw</th><td>${escapeHtml(url)}</td></tr>
        <tr><th>Protocol</th><td>${escapeHtml(isHalo ? 'halo:' : u.protocol)}</td></tr>
        <tr><th>Host / page</th><td>${escapeHtml(isHalo ? u.pathname.replace(/^\//, '') : u.hostname)}</td></tr>
        <tr><th>Path</th><td>${escapeHtml(isHalo ? '/' : u.pathname)}</td></tr>
        <tr><th>Query params</th><td>${[...u.searchParams.entries()].map(([k, v]) => `<code>${escapeHtml(k)}=${escapeHtml(v)}</code>`).join('<br>') || '<em>none</em>'}</td></tr>
      </table>
    `;
  } catch (e) {
    return `<div class="search-error">Could not parse URL.</div>`;
  }
}

function renderNetwork(browser) {
  const log = browser.networkLog || [];
  if (!log.length) return '<div class="dev-empty">No network requests recorded yet. Visit a page to populate.</div>';
  return `
    <table class="dev-table dev-net">
      <thead><tr><th>Method</th><th>Status</th><th>URL</th><th>ms</th></tr></thead>
      <tbody>
        ${log.slice(0, 50).map(r => `
          <tr class="${r.ok ? 'ok' : 'fail'}">
            <td>${escapeHtml(r.method)}</td>
            <td>${r.status}</td>
            <td><code>${escapeHtml(r.url)}</code></td>
            <td>${r.ms}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderStorage() {
  const usage = ((new Blob(Object.values(localStorage)).size) / 1024).toFixed(1);
  return `
    <p class="dev-meta">Local storage usage: <strong>${usage} KB</strong></p>
    <table class="dev-table">
      <thead><tr><th>Key</th><th>Size (B)</th></tr></thead>
      <tbody>
        ${Object.keys(localStorage).map(k => `
          <tr><td><code>${escapeHtml(k)}</code></td><td>${(localStorage.getItem(k) || '').length}</td></tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
