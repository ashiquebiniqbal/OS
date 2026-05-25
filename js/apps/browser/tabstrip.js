/**
 * Tab strip — drag-reorder, pin, close, color groups, scroll overflow.
 * Accessible: role=tablist; arrow keys cycle.
 */
import { ContextMenu } from '../../ui.js';

const TAB_COLORS = [null, '#00e5ff', '#39ff14', '#ff007f', '#ffd60a', '#bf5af2', '#ff9500'];

export class TabStrip {
  constructor(browser, hostEl) {
    this.browser = browser;
    this.host = hostEl;
    this.build();
  }

  build() {
    this.host.innerHTML = `
      <div class="tabstrip" role="tablist">
        <div class="tabstrip-tabs" id="tabstrip-tabs"></div>
        <button class="tabstrip-new" id="tabstrip-new" title="New tab (Ctrl+Alt+T)" aria-label="New tab">+</button>
      </div>
    `;
    this.tabsEl = this.host.querySelector('#tabstrip-tabs');
    this.host.querySelector('#tabstrip-new').addEventListener('click', () => this.browser.newTab());
  }

  render(tabs, activeId) {
    this.tabsEl.innerHTML = '';
    tabs.forEach(tab => this.tabsEl.appendChild(this.makeTabEl(tab, tab.id === activeId)));
  }

  makeTabEl(tab, active) {
    const el = document.createElement('div');
    el.className = `tab ${active ? 'active' : ''} ${tab.pinned ? 'pinned' : ''} ${tab.incognito ? 'incognito' : ''}`;
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', active ? 'true' : 'false');
    el.setAttribute('draggable', 'true');
    el.dataset.id = tab.id;
    if (tab.color) el.style.borderTopColor = tab.color;

    el.innerHTML = `
      <span class="tab-favicon">${tab.incognito ? '🕶️' : (tab.loading ? '<span class="tab-spinner"></span>' : '◈')}</span>
      <span class="tab-title">${tab.pinned ? '' : escapeHtml(tab.title || 'New Tab')}</span>
      ${tab.pinned ? '' : '<button class="tab-close" title="Close (middle-click)">×</button>'}
    `;

    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) return;
      this.browser.activate(tab.id);
    });
    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) { e.preventDefault(); this.browser.closeTab(tab.id); }
    });
    el.querySelector('.tab-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.browser.closeTab(tab.id);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      ContextMenu.show(e.clientX, e.clientY, [
        { label: tab.pinned ? 'Unpin tab' : 'Pin tab', icon: '📌', onClick: () => this.browser.togglePin(tab.id) },
        { label: 'Duplicate tab', icon: '⎘', onClick: () => this.browser.duplicateTab(tab.id) },
        { label: 'Reload', icon: '↻', onClick: () => { this.browser.activate(tab.id); this.browser.reload(); } },
        { separator: true },
        { label: 'Color', icon: '🎨', onClick: () => this.cycleColor(tab.id) },
        { separator: true },
        { label: 'Close tab', icon: '×', danger: true, onClick: () => this.browser.closeTab(tab.id) },
        { label: 'Close other tabs', onClick: () => this.browser.closeOthers(tab.id) },
      ]);
    });

    // Drag reorder
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/halotab', tab.id);
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop-target'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop-target');
      const fromId = e.dataTransfer.getData('text/halotab');
      if (fromId && fromId !== tab.id) this.browser.reorderTab(fromId, tab.id);
    });

    return el;
  }

  cycleColor(tabId) {
    const tab = this.browser.tabById(tabId);
    if (!tab) return;
    const i = TAB_COLORS.indexOf(tab.color);
    tab.color = TAB_COLORS[(i + 1) % TAB_COLORS.length];
    this.browser.refreshChrome();
  }
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
