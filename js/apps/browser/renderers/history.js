import { Store } from '../persistence.js';

export async function render(viewport, browser, tab) {
  browser.setTabTitle(tab, 'History');
  const all = Store.loadHistory();
  paint(viewport, browser, all, '');

  viewport.addEventListener('input', (e) => {
    if (e.target.id === 'hist-search') {
      const q = e.target.value.toLowerCase();
      const filtered = all.filter(h => (h.title || '').toLowerCase().includes(q) || h.url.toLowerCase().includes(q));
      paintList(viewport.querySelector('#hist-list'), filtered, browser);
    }
  });
}

function paint(viewport, browser, all, q) {
  viewport.innerHTML = `
    <div class="hist-root">
      <header class="hist-header">
        <h1>History</h1>
        <input type="search" id="hist-search" placeholder="Search history…" value="${q}">
        <button id="hist-clear">Clear all</button>
      </header>
      <div class="hist-list" id="hist-list"></div>
    </div>
  `;
  paintList(viewport.querySelector('#hist-list'), all, browser);
  viewport.querySelector('#hist-clear').addEventListener('click', () => {
    if (confirm('Clear all browsing history?')) {
      Store.clearHistory();
      paint(viewport, browser, [], '');
    }
  });
}

function paintList(el, items, browser) {
  if (!items.length) { el.innerHTML = '<div class="hist-empty">No history.</div>'; return; }
  const byDay = new Map();
  items.forEach(it => {
    const day = new Date(it.ts).toDateString();
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(it);
  });
  el.innerHTML = '';
  byDay.forEach((arr, day) => {
    const sec = document.createElement('div');
    sec.className = 'hist-day';
    sec.innerHTML = `<h3>${day}</h3>` + arr.map(h => `
      <div class="hist-item" data-url="${escapeAttr(h.url)}">
        <span class="hist-time">${new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <strong>${escapeHtml(h.title || h.url)}</strong>
        <small>${escapeHtml(h.url)}</small>
      </div>
    `).join('');
    sec.querySelectorAll('.hist-item').forEach(it => it.addEventListener('click', () => browser.navigate(it.dataset.url)));
    el.appendChild(sec);
  });
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
