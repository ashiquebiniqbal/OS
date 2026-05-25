import { Store } from '../persistence.js';
import { VFS } from '../../../fs.js';

export async function render(viewport, browser, tab) {
  browser.setTabTitle(tab, 'Downloads');
  paint(viewport, browser);
}

function paint(viewport, browser) {
  const list = Store.loadDownloads();
  viewport.innerHTML = `
    <div class="dl-root">
      <header class="dl-header"><h1>Downloads</h1><span class="dl-meta">${list.length} item${list.length === 1 ? '' : 's'}</span></header>
      <div class="dl-list">
        ${list.length ? list.map(d => `
          <div class="dl-item">
            <div class="dl-meta-col">
              <strong>${escapeHtml(d.name)}</strong>
              <small>${escapeHtml(d.url || '')} · ${new Date(d.ts).toLocaleString()}</small>
            </div>
            <div class="dl-actions">
              <button class="dl-open" data-path="${escapeAttr(d.path || '')}">Open in VFS</button>
              <button class="dl-save" data-path="${escapeAttr(d.path || '')}" data-name="${escapeAttr(d.name)}">Save to PC</button>
            </div>
          </div>
        `).join('') : '<div class="dl-empty">No downloads yet. Use "Save page" from the menu to capture pages here.</div>'}
      </div>
    </div>
  `;
  viewport.querySelectorAll('.dl-open').forEach(b => b.addEventListener('click', async () => {
    const mod = await import('../../notepad.js');
    mod.default.launch(b.dataset.path);
  }));
  viewport.querySelectorAll('.dl-save').forEach(b => b.addEventListener('click', () => {
    const data = VFS.read(b.dataset.path);
    if (data == null) return;
    const blob = new Blob([data], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = b.dataset.name;
    a.click(); URL.revokeObjectURL(a.href);
  }));
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
