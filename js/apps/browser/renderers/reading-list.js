import { Store } from '../persistence.js';

export async function render(viewport, browser, tab) {
  browser.setTabTitle(tab, 'Reading List');
  paint(viewport, browser);
}

function paint(viewport, browser) {
  const list = Store.loadReadingList();
  viewport.innerHTML = `
    <div class="rl-root">
      <header class="rl-header"><h1>Reading List</h1></header>
      <div class="rl-list">
        ${list.length ? list.map(r => `
          <div class="rl-item" data-id="${escapeAttr(r.id)}">
            <div class="rl-meta-col" data-url="${escapeAttr(r.url)}">
              <strong>${escapeHtml(r.title)}</strong>
              <p>${escapeHtml((r.excerpt || '').slice(0, 240))}</p>
              <small>${escapeHtml(r.url)} · ${new Date(r.ts).toLocaleDateString()}</small>
            </div>
            <button class="rl-rm" data-id="${escapeAttr(r.id)}">×</button>
          </div>
        `).join('') : '<div class="rl-empty">No saved articles yet. Use the bookmark menu or click "Save to reading list" inside Wikipedia articles.</div>'}
      </div>
    </div>
  `;
  viewport.querySelectorAll('.rl-meta-col').forEach(el => el.addEventListener('click', () => browser.navigate(el.dataset.url)));
  viewport.querySelectorAll('.rl-rm').forEach(el => el.addEventListener('click', (e) => {
    e.stopPropagation();
    Store.removeReading(el.dataset.id);
    paint(viewport, browser);
  }));
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
