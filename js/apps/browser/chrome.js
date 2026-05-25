/**
 * Browser chrome: nav buttons (back/forward/reload/home), menu button, find-in-page overlay.
 */
import { ContextMenu, Toast } from '../../ui.js';
import { Store } from './persistence.js';

export class Chrome {
  constructor(browser, hostEl) {
    this.browser = browser;
    this.host = hostEl;
    this.build();
  }

  build() {
    this.host.innerHTML = `
      <div class="chrome-nav">
        <button class="chrome-btn" id="ch-back" title="Back (Alt+←)" aria-label="Back">‹</button>
        <button class="chrome-btn" id="ch-fwd" title="Forward (Alt+→)" aria-label="Forward">›</button>
        <button class="chrome-btn" id="ch-reload" title="Reload (Ctrl+R)" aria-label="Reload">↻</button>
        <button class="chrome-btn" id="ch-home" title="Home" aria-label="Home">⌂</button>
      </div>
      <div class="chrome-omnibox" id="chrome-omnibox-host"></div>
      <div class="chrome-actions">
        <span class="chrome-tracker" id="chrome-tracker" title="Blocked trackers (simulated)">🛡 <span id="chrome-tracker-count">0</span></span>
        <button class="chrome-btn" id="ch-menu" title="Menu" aria-haspopup="true" aria-label="Browser menu">⋮</button>
      </div>
      <div class="chrome-findbar" id="chrome-findbar" hidden>
        <input type="text" id="findbar-q" placeholder="Find in page…" autocomplete="off">
        <span class="findbar-count" id="findbar-count">0/0</span>
        <button id="findbar-prev" title="Previous">↑</button>
        <button id="findbar-next" title="Next">↓</button>
        <button id="findbar-close" title="Close (Esc)">×</button>
      </div>
    `;
    this.backBtn = this.host.querySelector('#ch-back');
    this.fwdBtn = this.host.querySelector('#ch-fwd');
    this.reloadBtn = this.host.querySelector('#ch-reload');
    this.homeBtn = this.host.querySelector('#ch-home');
    this.menuBtn = this.host.querySelector('#ch-menu');
    this.trackerCount = this.host.querySelector('#chrome-tracker-count');

    this.backBtn.addEventListener('click', () => this.browser.back());
    this.fwdBtn.addEventListener('click', () => this.browser.forward());
    this.reloadBtn.addEventListener('click', () => this.browser.reload());
    this.homeBtn.addEventListener('click', () => this.browser.navigate(Store.loadSettings().homepage));
    this.menuBtn.addEventListener('click', (e) => this.openMenu(e));

    // Long-press back/forward for history dropdown
    this._wireLongPress(this.backBtn, () => this.openHistoryDropdown('back'));
    this._wireLongPress(this.fwdBtn, () => this.openHistoryDropdown('forward'));

    // Find bar
    this.findbar = this.host.querySelector('#chrome-findbar');
    this.findInput = this.host.querySelector('#findbar-q');
    this.findCount = this.host.querySelector('#findbar-count');
    this.findInput.addEventListener('input', () => this.runFind());
    this.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.findNext(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') this.closeFind();
    });
    this.host.querySelector('#findbar-prev').addEventListener('click', () => this.findNext(-1));
    this.host.querySelector('#findbar-next').addEventListener('click', () => this.findNext(1));
    this.host.querySelector('#findbar-close').addEventListener('click', () => this.closeFind());
  }

  omniboxHost() { return this.host.querySelector('#chrome-omnibox-host'); }

  syncFromTab(tab) {
    this.backBtn.disabled = !tab || !tab.canBack();
    this.fwdBtn.disabled = !tab || !tab.canForward();
  }

  setTrackerCount(n) {
    this.trackerCount.textContent = n;
  }

  _wireLongPress(btn, fn) {
    let timer = null;
    btn.addEventListener('mousedown', () => {
      timer = setTimeout(() => { timer = null; fn(); }, 420);
    });
    const cancel = () => { if (timer) clearTimeout(timer); timer = null; };
    btn.addEventListener('mouseup', cancel);
    btn.addEventListener('mouseleave', cancel);
  }

  openHistoryDropdown(which) {
    const tab = this.browser.activeTab();
    if (!tab) return;
    const items = [];
    if (which === 'back') {
      for (let i = tab.historyIndex - 1; i >= 0 && items.length < 10; i--) {
        const u = tab.history[i];
        items.push({ label: u, onClick: () => this.browser.jumpToHistory(i) });
      }
    } else {
      for (let i = tab.historyIndex + 1; i < tab.history.length && items.length < 10; i++) {
        const u = tab.history[i];
        items.push({ label: u, onClick: () => this.browser.jumpToHistory(i) });
      }
    }
    if (!items.length) items.push({ label: '(no entries)', disabled: true });
    const r = (which === 'back' ? this.backBtn : this.fwdBtn).getBoundingClientRect();
    ContextMenu.show(r.left, r.bottom + 4, items);
  }

  openMenu(e) {
    e.stopPropagation();
    const r = this.menuBtn.getBoundingClientRect();
    ContextMenu.show(r.right - 220, r.bottom + 4, [
      { label: 'New tab', shortcut: 'Ctrl+Alt+T', icon: '＋', onClick: () => this.browser.newTab() },
      { label: 'New incognito tab', icon: '🕶', onClick: () => this.browser.newTab({ incognito: true }) },
      { separator: true },
      { label: 'History', shortcut: 'Ctrl+H', icon: '🕒', onClick: () => this.browser.navigate('halo://history') },
      { label: 'Bookmarks', icon: '★', onClick: () => this.browser.navigate('halo://bookmarks') },
      { label: 'Downloads', shortcut: 'Ctrl+J', icon: '⤓', onClick: () => this.browser.navigate('halo://downloads') },
      { label: 'Reading list', icon: '📑', onClick: () => this.browser.navigate('halo://reading-list') },
      { separator: true },
      { label: 'Find in page', shortcut: 'Ctrl+F', icon: '🔍', onClick: () => this.openFind() },
      { label: 'Zoom in', shortcut: 'Ctrl++', icon: '＋', onClick: () => this.browser.zoom(0.1) },
      { label: 'Zoom out', shortcut: 'Ctrl+-', icon: '－', onClick: () => this.browser.zoom(-0.1) },
      { label: 'Reset zoom', shortcut: 'Ctrl+0', onClick: () => this.browser.setZoom(1) },
      { separator: true },
      { label: 'Save page to VFS', icon: '💾', onClick: () => this.browser.savePage() },
      { label: 'Reader mode', icon: '📖', onClick: () => Toast.info('Reader mode available on Wikipedia articles via "Save to reading list".') },
      { separator: true },
      { label: 'Auto-pilot ⚡', icon: '🤖', shortcut: 'Ctrl+/', onClick: () => this.browser.openAutoPilot() },
      { separator: true },
      { label: 'Settings', icon: '⚙', onClick: () => this.browser.navigate('halo://settings') },
      { label: 'Extensions', onClick: () => this.browser.navigate('halo://extensions') },
      { label: 'DevTools', shortcut: 'Ctrl+Shift+I', icon: '🛠', onClick: () => this.browser.navigate('halo://devtools') },
      { label: 'About Halo', onClick: () => this.browser.navigate('halo://about') },
    ]);
  }

  /* ---- Find in page ---- */
  openFind() {
    this.findbar.hidden = false;
    this.findInput.focus();
    this.findInput.select();
  }
  closeFind() {
    this.findbar.hidden = true;
    this._clearFindHighlights();
  }
  runFind() {
    const q = this.findInput.value.trim();
    this._clearFindHighlights();
    if (!q) { this.findCount.textContent = '0/0'; return; }
    const vp = this.browser.viewport();
    if (!vp) return;
    const re = new RegExp(escapeRegex(q), 'gi');
    let count = 0;
    walkText(vp, (node) => {
      const txt = node.nodeValue;
      if (!re.test(txt)) return;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0; let m;
      while ((m = re.exec(txt)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        const mark = document.createElement('mark');
        mark.className = 'halo-find-hit';
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
        count++;
      }
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
    this._findIndex = 0;
    this._highlightActive();
    this.findCount.textContent = `${count ? 1 : 0}/${count}`;
  }
  findNext(dir = 1) {
    const hits = this.browser.viewport().querySelectorAll('.halo-find-hit');
    if (!hits.length) return;
    this._findIndex = (this._findIndex + dir + hits.length) % hits.length;
    this._highlightActive();
    this.findCount.textContent = `${this._findIndex + 1}/${hits.length}`;
  }
  _highlightActive() {
    const hits = this.browser.viewport().querySelectorAll('.halo-find-hit');
    hits.forEach((h, i) => h.classList.toggle('current', i === this._findIndex));
    if (hits[this._findIndex]) hits[this._findIndex].scrollIntoView({ block: 'center' });
  }
  _clearFindHighlights() {
    const vp = this.browser.viewport();
    if (!vp) return;
    vp.querySelectorAll('.halo-find-hit').forEach(m => {
      const parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }
}

function walkText(root, visit) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentNode.closest('script,style,mark.halo-find-hit') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  let n; while ((n = w.nextNode())) nodes.push(n);
  nodes.forEach(visit);
}
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
