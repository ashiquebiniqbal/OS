import { VFS } from '../fs.js';
import { WM } from '../wm.js';
import { Shortcuts, Toast } from '../ui.js';

/**
 * Halo OS Notepad (Text Editor)
 * Multi-instance, with VFS save/save-as, host export, word/char count, Ctrl+S
 * via Shortcuts registry, WM.onClose-driven cleanup.
 */
class NotepadApp {
  constructor() {
    this.activeFiles = new Map(); // winId -> activePath
  }

  launch(filePath = null) {
    const winId = 'notepad' + (filePath ? `-${filePath.replace(/[^a-zA-Z0-9]/g, '_')}` : `-${Date.now()}`);
    let content = '';
    let displayTitle = 'Notepad - Untitled';

    if (filePath) {
      const readContent = VFS.read(filePath);
      if (readContent !== null) {
        content = readContent;
        this.activeFiles.set(winId, filePath);
        displayTitle = `Notepad - ${filePath.substring(filePath.lastIndexOf('/') + 1)}`;
      }
    }

    const contentHtml = `
      <div class="notepad-container" id="notepad-container-${winId}">
        <div class="notepad-menu">
          <button class="notepad-menu-btn" id="notepad-save-${winId}" title="Save (Ctrl+S)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span>Save</span>
          </button>
          <button class="notepad-menu-btn" id="notepad-saveas-${winId}" title="Save to a new VFS path">
            <span>Save As</span>
          </button>
          <button class="notepad-menu-btn" id="notepad-download-${winId}" title="Export to host machine">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Export</span>
          </button>
          <div class="notepad-status" id="notepad-status-${winId}">${filePath || 'Unsaved Sandbox Document'}</div>
        </div>

        <textarea class="notepad-editor" id="notepad-editor-${winId}" placeholder="Start writing private notes here...">${escapeHtml(content)}</textarea>

        <div class="notepad-footer">
          <span class="notepad-count" id="notepad-count-${winId}">0 words · 0 chars</span>
        </div>
      </div>
    `;

    WM.createWindow({
      id: winId,
      title: displayTitle,
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
      width: 520,
      height: 400,
      contentHtml
    });

    this.setupStyles();
    this.bindEditorEvents(winId);
    this.updateCount(winId);
    WM.onClose(winId, () => this._teardown(winId));
  }

  bindEditorEvents(winId) {
    const saveBtn = document.getElementById(`notepad-save-${winId}`);
    const saveAsBtn = document.getElementById(`notepad-saveas-${winId}`);
    const downloadBtn = document.getElementById(`notepad-download-${winId}`);
    const editor = document.getElementById(`notepad-editor-${winId}`);
    const status = document.getElementById(`notepad-status-${winId}`);

    editor.addEventListener('input', () => {
      const activePath = this.activeFiles.get(winId);
      status.innerText = (activePath || 'Unsaved Sandbox Document') + ' *';
      this.updateCount(winId);
    });

    const saveFile = () => {
      const activePath = this.activeFiles.get(winId);
      if (activePath) {
        VFS.write(activePath, editor.value);
        status.innerText = activePath;
        Toast.success(`Saved ${activePath}`);
        this.refreshExplorerIfActive();
      } else {
        saveAsFile();
      }
    };

    const saveAsFile = () => {
      let defaultPath = '/Desktop/Untitled.txt';
      const activePath = this.activeFiles.get(winId);
      if (activePath) defaultPath = activePath;

      const userPath = prompt("Enter VFS path:", defaultPath);
      if (!userPath) return;

      const cleanPath = userPath.startsWith('/') ? userPath : '/' + userPath;
      VFS.write(cleanPath, editor.value);
      this.activeFiles.set(winId, cleanPath);
      status.innerText = cleanPath;

      const winNode = document.getElementById(`win-${winId}`);
      if (winNode) {
        const titleNode = winNode.querySelector('.window-title');
        const name = cleanPath.substring(cleanPath.lastIndexOf('/') + 1);
        if (titleNode) titleNode.innerText = `Notepad - ${name}`;
      }
      Toast.success(`Saved as ${cleanPath}`);
      this.refreshExplorerIfActive();
    };

    saveBtn.addEventListener('click', saveFile);
    saveAsBtn.addEventListener('click', saveAsFile);

    downloadBtn.addEventListener('click', () => {
      const content = editor.value;
      const activePath = this.activeFiles.get(winId) || 'halo_document.txt';
      const filename = activePath.substring(activePath.lastIndexOf('/') + 1);

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      VFS.logAction(`Exported File: ${filename} to Host machine.`);
      Toast.info(`Exported ${filename} to host downloads.`);
    });

    // Window-scoped Ctrl+S via Shortcuts registry — fires whether or not the textarea is focused
    Shortcuts.register(winId, 'ctrl+s', saveFile);
    Shortcuts.register(winId, 'meta+s', saveFile);
  }

  updateCount(winId) {
    const editor = document.getElementById(`notepad-editor-${winId}`);
    const count = document.getElementById(`notepad-count-${winId}`);
    if (!editor || !count) return;
    const text = editor.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split('\n').length : 0;
    count.innerText = `${words} word${words === 1 ? '' : 's'} · ${chars} char${chars === 1 ? '' : 's'} · ${lines} line${lines === 1 ? '' : 's'}`;
  }

  async refreshExplorerIfActive() {
    if (WM.windows.has('explorer')) {
      const explorerModule = await import('./explorer.js');
      explorerModule.default.renderDirectory();
    }
  }

  _teardown(winId) {
    Shortcuts.clearScope(winId);
    this.activeFiles.delete(winId);
  }

  setupStyles() {
    if (document.getElementById('notepad-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'notepad-dynamic-style';
    style.textContent = `
      .notepad-container {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .notepad-menu {
        height: 38px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid var(--panel-border);
        display: flex;
        align-items: center;
        padding: 0 10px;
        gap: 8px;
        flex-shrink: 0;
      }
      .notepad-menu-btn {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        padding: 4px 10px;
        font-family: var(--font-family-sans);
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }
      .notepad-menu-btn:hover {
        background: rgba(0, 229, 255, 0.08);
        border-color: var(--accent-color);
        color: var(--accent-color);
      }
      .notepad-status {
        flex-grow: 1;
        text-align: right;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--text-secondary);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        padding-left: 10px;
      }
      .notepad-editor {
        flex-grow: 1;
        background: transparent;
        border: none;
        outline: none;
        resize: none;
        padding: 16px;
        color: var(--text-primary);
        font-family: var(--font-family-mono);
        font-size: 13px;
        line-height: 1.6;
        scrollbar-width: thin;
        user-select: text;
      }
      .notepad-footer {
        height: 22px;
        background: rgba(0, 0, 0, 0.18);
        border-top: 1px solid var(--panel-border);
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 0 12px;
        flex-shrink: 0;
      }
      .notepad-count {
        font-family: var(--font-family-mono);
        font-size: 10px;
        color: var(--text-secondary);
        letter-spacing: 0.3px;
      }
    `;
    document.head.appendChild(style);
  }
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export const Notepad = new NotepadApp();
export default Notepad;
