export async function render(viewport, browser, tab, { code = 'UNKNOWN', url = '', message = '' } = {}) {
  browser.setTabTitle(tab, 'Page can’t load');

  const MESSAGES = {
    PAGE_NOT_FOUND: { title: 'No such halo:// page', detail: 'This internal address is not registered.' },
    RENDER_ERROR: { title: 'Renderer crashed', detail: 'The page failed while rendering.' },
    CORS_BLOCKED: { title: 'Site blocked embedding', detail: 'This site sets X-Frame-Options to prevent being shown inside other browsers. The host browser would refuse to render it.' },
    NETWORK: { title: 'Network error', detail: 'The request did not reach the server.' },
    UNKNOWN: { title: 'Page can’t load', detail: 'Something went wrong.' },
  };
  const m = MESSAGES[code] || MESSAGES.UNKNOWN;

  viewport.innerHTML = `
    <div class="err-root">
      <div class="err-card">
        <div class="err-ico">⚠</div>
        <h1>${m.title}</h1>
        <p class="err-detail">${m.detail}</p>
        ${url ? `<p class="err-url"><code>${escapeHtml(url)}</code></p>` : ''}
        ${message ? `<p class="err-msg">${escapeHtml(message)}</p>` : ''}
        <div class="err-actions">
          ${url.startsWith('http') ? `<a class="err-btn" href="${escapeAttr(url)}" target="_blank" rel="noopener">Open in real browser ↗</a>` : ''}
          <button class="err-btn" id="err-home">Go home</button>
          <button class="err-btn" id="err-back">Back</button>
        </div>
      </div>
    </div>
  `;
  viewport.querySelector('#err-home').addEventListener('click', () => browser.navigate('halo://newtab'));
  viewport.querySelector('#err-back').addEventListener('click', () => browser.back());
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
