import { Store } from '../persistence.js';

export async function render(viewport, browser, tab) {
  browser.setTabTitle(tab, 'Bookmarks');
  paint(viewport, browser);
}

function paint(viewport, browser) {
  const list = Store.loadBookmarks();
  viewport.innerHTML = `
    <div class="bm-root">
      <header class="bm-header">
        <h1>Bookmarks</h1>
        <button id="bm-add">+ Add current page</button>
      </header>
      <div class="bm-list" id="bm-list">
        ${list.map(b => `
          <div class="bm-item" data-url="${escapeAttr(b.url)}">
            <span class="bm-ico">${b.icon || '🔖'}</span>
            <div class="bm-meta">
              <strong>${escapeHtml(b.title)}</strong>
              <small>${escapeHtml(b.url)}</small>
            </div>
            <button class="bm-rm" data-url="${escapeAttr(b.url)}" title="Remove">×</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  viewport.querySelectorAll('.bm-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('bm-rm')) return;
      browser.navigate(el.dataset.url);
    });
  });
  viewport.querySelectorAll('.bm-rm').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      Store.removeBookmark(el.dataset.url);
      paint(viewport, browser);
    });
  });
  viewport.querySelector('#bm-add').addEventListener('click', () => {
    const active = browser.activeTab();
    if (active) {
      Store.addBookmark({ title: active.title || active.url, url: active.url, icon: '🔖' });
      paint(viewport, browser);
    }
  });
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
