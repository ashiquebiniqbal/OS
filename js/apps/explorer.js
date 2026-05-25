import { VFS } from '../fs.js';
import { WM } from '../wm.js';
import { ContextMenu, Toast, Shortcuts } from '../ui.js';

/**
 * Halo OS File Explorer
 * Manages persistent visual directories, folder creation, and file launches.
 * Supports multi-select (Shift+click range, Ctrl+click toggle), right-click context
 * menu, F2 inline rename, Delete-key delete. Cleanup via WM.onClose.
 */
class FileExplorer {
  constructor() {
    this.currentPath = '/Desktop';
    this.selection = new Set();
    this._lastClickedIdx = -1;
    this._items = []; // last rendered items, indexed
    this._renaming = null; // path currently being renamed
  }

  launch() {
    const id = 'explorer';
    const contentHtml = `
      <div class="explorer-container">
        <div class="explorer-bar">
          <button class="explorer-nav-btn" id="explorer-back-btn" title="Up one folder">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div class="explorer-breadcrumbs" id="explorer-breadcrumbs"></div>
          <div class="explorer-actions">
            <button class="explorer-action-btn" id="explorer-new-folder" title="New Folder">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
            </button>
            <button class="explorer-action-btn" id="explorer-new-file" title="New Notepad File">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="explorer-grid" id="explorer-grid"></div>
      </div>
    `;

    WM.createWindow({
      id,
      title: 'File Explorer',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
      width: 580,
      height: 400,
      contentHtml
    });

    this.setupStyles();
    this.renderDirectory();
    this.bindEvents();
    this._registerShortcuts();
    WM.onClose(id, () => this._teardown());
  }

  renderDirectory() {
    const grid = document.getElementById('explorer-grid');
    const breadcrumbs = document.getElementById('explorer-breadcrumbs');
    if (!grid || !breadcrumbs) return;

    grid.innerHTML = '';
    breadcrumbs.innerHTML = '';

    const segments = this.currentPath.split('/').filter(s => s !== '');
    const rootSpan = document.createElement('span');
    rootSpan.className = 'breadcrumb-link';
    rootSpan.innerText = 'Root';
    rootSpan.addEventListener('click', () => { this.currentPath = '/'; this.selection.clear(); this.renderDirectory(); });
    breadcrumbs.appendChild(rootSpan);

    let accumulatedPath = '';
    segments.forEach((seg) => {
      accumulatedPath += '/' + seg;
      const arrow = document.createElement('span');
      arrow.className = 'breadcrumb-separator';
      arrow.innerText = '›';
      breadcrumbs.appendChild(arrow);
      const link = document.createElement('span');
      link.className = 'breadcrumb-link';
      link.innerText = seg;
      const target = accumulatedPath;
      link.addEventListener('click', () => { this.currentPath = target; this.selection.clear(); this.renderDirectory(); });
      breadcrumbs.appendChild(link);
    });

    const items = VFS.ls(this.currentPath);
    this._items = items;

    // Prune selection of any paths no longer in this folder
    const validPaths = new Set(items.map(i => i.path));
    [...this.selection].forEach(p => { if (!validPaths.has(p)) this.selection.delete(p); });

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="explorer-empty">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <span>Folder is empty</span>
        </div>
      `;
      return;
    }

    items.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'explorer-item' + (this.selection.has(item.path) ? ' selected' : '');
      el.dataset.path = item.path;
      el.dataset.idx = String(idx);

      const isDir = item.type === 'dir';
      const icon = isDir
        ? `<svg viewBox="0 0 24 24" class="exp-folder-icon" fill="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
        : `<svg viewBox="0 0 24 24" class="exp-file-icon" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;

      el.innerHTML = `
        <div class="item-icon-wrapper">${icon}</div>
        <span class="item-name" data-path="${item.path}">${escapeHtml(item.name)}</span>
      `;

      // Single click: select (with modifiers)
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleClick(idx, item, e);
      });

      // Double click: open / navigate
      el.addEventListener('dblclick', () => this._open(item));

      // Right-click: context menu for this item
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // If not already in selection, replace selection with just this one
        if (!this.selection.has(item.path)) {
          this.selection.clear();
          this.selection.add(item.path);
          this._refreshSelectionVisuals();
        }
        this._showItemMenu(e.clientX, e.clientY, item);
      });

      // Mobile touch
      el.addEventListener('touchstart', (e) => { this._touchStart = e.touches[0].clientY; }, { passive: true });
      el.addEventListener('touchend', (e) => {
        const dy = Math.abs(e.changedTouches[0].clientY - (this._touchStart || 0));
        if (dy < 10) this._open(item);
      });

      grid.appendChild(el);
    });
  }

  _handleClick(idx, item, e) {
    if (e.shiftKey && this._lastClickedIdx >= 0) {
      // Range select
      const [a, b] = [this._lastClickedIdx, idx].sort((x, y) => x - y);
      this.selection.clear();
      for (let i = a; i <= b; i++) this.selection.add(this._items[i].path);
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle
      if (this.selection.has(item.path)) this.selection.delete(item.path);
      else this.selection.add(item.path);
      this._lastClickedIdx = idx;
    } else {
      this.selection.clear();
      this.selection.add(item.path);
      this._lastClickedIdx = idx;
    }
    this._refreshSelectionVisuals();
  }

  _refreshSelectionVisuals() {
    const grid = document.getElementById('explorer-grid');
    if (!grid) return;
    grid.querySelectorAll('.explorer-item').forEach(el => {
      el.classList.toggle('selected', this.selection.has(el.dataset.path));
    });
  }

  async _open(item) {
    if (item.type === 'dir') {
      this.currentPath = item.path;
      this.selection.clear();
      this.renderDirectory();
    } else {
      const mod = await import('./notepad.js');
      mod.default.launch(item.path);
    }
  }

  _showItemMenu(x, y, item) {
    const multi = this.selection.size > 1;
    ContextMenu.show(x, y, [
      { label: multi ? `Open ${this.selection.size} items` : 'Open', icon: '↗', onClick: () => {
          if (multi) [...this.selection].forEach(p => {
            const it = this._items.find(i => i.path === p);
            if (it) this._open(it);
          });
          else this._open(item);
        } },
      { label: 'Rename', icon: '✎', shortcut: 'F2', disabled: multi, onClick: () => this._beginRename(item.path) },
      { label: 'Copy path', icon: '⎘', onClick: () => this._copyPath() },
      { separator: true },
      { label: 'New folder', icon: '📁', onClick: () => this._newFolder() },
      { label: 'New file', icon: '📄', onClick: () => this._newFile() },
      { separator: true },
      { label: multi ? `Delete ${this.selection.size} items` : 'Delete', icon: '×', shortcut: 'Del', danger: true, onClick: () => this._deleteSelection() },
    ]);
  }

  _showEmptyMenu(x, y) {
    ContextMenu.show(x, y, [
      { label: 'New folder', icon: '📁', onClick: () => this._newFolder() },
      { label: 'New file', icon: '📄', onClick: () => this._newFile() },
      { separator: true },
      { label: 'Refresh', icon: '↻', onClick: () => this.renderDirectory() },
    ]);
  }

  _copyPath() {
    const paths = [...this.selection];
    if (!paths.length) return;
    const text = paths.join('\n');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => Toast.success(`Copied ${paths.length === 1 ? 'path' : paths.length + ' paths'} to clipboard.`),
        () => Toast.error('Clipboard unavailable.')
      );
    } else {
      Toast.warn('Clipboard API not supported in this browser.');
    }
  }

  _beginRename(path) {
    const grid = document.getElementById('explorer-grid');
    if (!grid) return;
    const el = grid.querySelector(`.explorer-item[data-path="${cssEscape(path)}"] .item-name`);
    if (!el) return;
    this._renaming = path;
    const oldName = el.textContent;
    el.setAttribute('contenteditable', 'true');
    el.classList.add('renaming');
    el.focus();
    document.getSelection().selectAllChildren(el);

    const commit = () => {
      el.removeAttribute('contenteditable');
      el.classList.remove('renaming');
      const newName = el.textContent.trim();
      this._renaming = null;
      if (!newName || newName === oldName) { this.renderDirectory(); return; }
      if (newName.includes('/')) { Toast.error('Name cannot contain "/"'); this.renderDirectory(); return; }
      const parts = path.substring(0, path.lastIndexOf('/')) || '/';
      const newPath = parts === '/' ? `/${newName}` : `${parts}/${newName}`;
      if (VFS.exists(newPath)) { Toast.error(`"${newName}" already exists.`); this.renderDirectory(); return; }
      if (VFS.mv(path, newPath)) {
        Toast.success(`Renamed to ${newName}`);
        this.selection.delete(path);
        this.selection.add(newPath);
      } else {
        Toast.error('Rename failed.');
      }
      this.renderDirectory();
    };

    const cancel = () => { el.removeAttribute('contenteditable'); el.classList.remove('renaming'); this._renaming = null; this.renderDirectory(); };

    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    el.addEventListener('blur', commit, { once: true });
  }

  _deleteSelection() {
    const paths = [...this.selection];
    if (!paths.length) return;
    const label = paths.length === 1
      ? `Permanently delete "${paths[0].split('/').pop()}"?`
      : `Permanently delete ${paths.length} items?`;
    if (!confirm(label)) return;
    paths.forEach(p => VFS.rm(p));
    Toast.success(paths.length === 1 ? 'Deleted.' : `Deleted ${paths.length} items.`);
    this.selection.clear();
    this.renderDirectory();
  }

  _newFolder() {
    const name = prompt('Enter new folder name:');
    if (!name) return;
    const path = this.currentPath === '/' ? `/${name}` : `${this.currentPath}/${name}`;
    if (VFS.exists(path)) { Toast.error('That name already exists.'); return; }
    VFS.mkdir(path);
    this.renderDirectory();
  }

  async _newFile() {
    const name = prompt('Enter new file name (e.g. notes.txt):');
    if (!name) return;
    const cleanName = /\./.test(name) ? name : `${name}.txt`;
    const path = this.currentPath === '/' ? `/${cleanName}` : `${this.currentPath}/${cleanName}`;
    if (VFS.exists(path)) { Toast.error('That name already exists.'); return; }
    VFS.write(path, '');
    this.renderDirectory();
    const mod = await import('./notepad.js');
    mod.default.launch(path);
  }

  bindEvents() {
    const backBtn = document.getElementById('explorer-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => {
      if (this.currentPath === '/') return;
      const i = this.currentPath.lastIndexOf('/');
      this.currentPath = i === 0 ? '/' : this.currentPath.substring(0, i);
      this.selection.clear();
      this.renderDirectory();
    });

    const newFolderBtn = document.getElementById('explorer-new-folder');
    if (newFolderBtn) newFolderBtn.addEventListener('click', () => this._newFolder());

    const newFileBtn = document.getElementById('explorer-new-file');
    if (newFileBtn) newFileBtn.addEventListener('click', () => this._newFile());

    // Click on empty grid area clears selection; right-click shows empty menu
    const grid = document.getElementById('explorer-grid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        if (e.target === grid) {
          this.selection.clear();
          this._lastClickedIdx = -1;
          this._refreshSelectionVisuals();
        }
      });
      grid.addEventListener('contextmenu', (e) => {
        if (e.target === grid || e.target.classList.contains('explorer-empty')) {
          e.preventDefault();
          this._showEmptyMenu(e.clientX, e.clientY);
        }
      });
    }
  }

  _registerShortcuts() {
    Shortcuts.register('explorer', 'f2', () => {
      if (this._renaming) return;
      if (this.selection.size === 1) this._beginRename([...this.selection][0]);
    });
    Shortcuts.register('explorer', 'delete', () => {
      if (this._renaming) return;
      if (this.selection.size) this._deleteSelection();
    });
    Shortcuts.register('explorer', 'ctrl+a', () => {
      this.selection = new Set(this._items.map(i => i.path));
      this._refreshSelectionVisuals();
    });
    Shortcuts.register('explorer', 'escape', () => {
      if (this._renaming) return;
      this.selection.clear();
      this._refreshSelectionVisuals();
    });
  }

  _teardown() {
    Shortcuts.clearScope('explorer');
    ContextMenu.hide();
  }

  setupStyles() {
    if (document.getElementById('explorer-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'explorer-dynamic-style';
    style.textContent = `
      .explorer-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        color: var(--text-primary);
      }
      .explorer-bar {
        height: 42px;
        background: rgba(0, 0, 0, 0.15);
        border-bottom: 1px solid var(--panel-border);
        display: flex;
        align-items: center;
        padding: 0 12px;
        gap: 12px;
        flex-shrink: 0;
      }
      .explorer-nav-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 4px;
        border-radius: 6px;
        transition: background 0.2s ease;
      }
      .explorer-nav-btn:hover { background: rgba(255, 255, 255, 0.06); color: var(--text-primary); }
      .explorer-breadcrumbs {
        flex-grow: 1;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 600;
        overflow: hidden;
      }
      .breadcrumb-link {
        cursor: pointer;
        color: var(--text-secondary);
        transition: color 0.15s ease;
        padding: 2px 4px;
        border-radius: 4px;
      }
      .breadcrumb-link:hover { color: var(--accent-color); background: rgba(255, 255, 255, 0.04); }
      .breadcrumb-separator { color: var(--panel-border); }
      .explorer-actions { display: flex; gap: 6px; }
      .explorer-action-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        padding: 6px;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        transition: all 0.2s ease;
      }
      .explorer-action-btn:hover {
        background: rgba(0, 229, 255, 0.1);
        border-color: var(--accent-color);
        color: var(--accent-color);
      }
      .explorer-grid {
        flex-grow: 1;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
        grid-auto-rows: max-content;
        grid-gap: 12px;
        padding: 16px;
        overflow: auto;
        align-content: start;
      }
      .explorer-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 10px;
        border-radius: 10px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: background 0.15s ease, border-color 0.15s ease;
        position: relative;
        user-select: none;
      }
      .explorer-item:hover { background: rgba(255, 255, 255, 0.05); border-color: var(--panel-border); }
      .explorer-item.selected {
        background: rgba(0, 229, 255, 0.12);
        border-color: var(--accent-color);
      }
      .item-icon-wrapper { margin-bottom: 8px; display: flex; align-items: center; justify-content: center; }
      .exp-folder-icon { width: 38px; height: 38px; color: var(--accent-color); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15)); }
      .exp-file-icon { width: 34px; height: 34px; color: var(--text-secondary); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15)); }
      .item-name {
        font-size: 11px;
        font-weight: 500;
        text-align: center;
        max-width: 80px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 2px 4px;
        border-radius: 4px;
      }
      .item-name.renaming {
        background: rgba(0, 0, 0, 0.4);
        outline: 1px solid var(--accent-color);
        overflow: visible;
        max-width: 100px;
        white-space: normal;
        user-select: text;
      }
      .explorer-empty {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        height: 150px;
        gap: 12px;
      }
      .explorer-empty span { font-size: 12px; font-weight: 500; }
    `;
    document.head.appendChild(style);
  }
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function cssEscape(s) { return String(s).replace(/(["\\])/g, '\\$1'); }

export const Explorer = new FileExplorer();
export default Explorer;
