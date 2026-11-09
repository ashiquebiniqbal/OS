import { VFS } from '../fs.js';
import { WM } from '../wm.js';

class CodeIDEApp {
  constructor() {
    this.id = 'ide';
    this.currentFile = null;
  }

  launch() {
    const win = WM.createWindow({
      id: this.id,
      title: 'Sovereign IDE',
      width: 800,
      height: 600,
      icon: `<svg viewBox="0 0 24 24" class="window-title-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>`
    });

    if (win) {
      this.setupStyles();
      this.renderContent(win);
      this.attachEvents(win);
    }
  }

  setupStyles() {
    if (document.getElementById('ide-styles')) return;
    const style = document.createElement('style');
    style.id = 'ide-styles';
    style.innerHTML = `
      #win-ide .window-content {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: var(--font-family-mono, monospace);
      }
      .ide-toolbar {
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        background: #252526;
        border-bottom: 1px solid #333;
      }
      .ide-btn {
        background: #333;
        border: 1px solid #444;
        color: #ccc;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      }
      .ide-btn:hover { background: #444; }
      .ide-main {
        display: flex;
        flex-grow: 1;
        overflow: hidden;
      }
      .ide-sidebar {
        width: 200px;
        background: #252526;
        border-right: 1px solid #333;
        padding: 8px 0;
        overflow-y: auto;
      }
      .ide-file-item {
        padding: 4px 16px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ide-file-item:hover { background: #2a2d2e; }
      .ide-editor-container {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        position: relative;
      }
      .ide-tabs {
        display: flex;
        background: #2d2d2d;
      }
      .ide-tab {
        padding: 6px 16px;
        background: #1e1e1e;
        border-right: 1px solid #333;
        font-size: 12px;
        color: #fff;
        border-top: 2px solid var(--accent-color);
      }
      .ide-textarea {
        flex-grow: 1;
        background: transparent;
        color: inherit;
        border: none;
        padding: 16px;
        font-family: inherit;
        font-size: 14px;
        resize: none;
        outline: none;
        line-height: 1.5;
        white-space: pre;
      }
      .ide-status {
        height: 24px;
        background: #007acc;
        color: white;
        display: flex;
        align-items: center;
        padding: 0 16px;
        font-size: 11px;
        justify-content: space-between;
      }
    `;
    document.head.appendChild(style);
  }

  renderContent(win) {
    const content = win.querySelector('.window-content');
    content.innerHTML = `
      <div class="ide-toolbar">
        <button class="ide-btn" id="ide-new">New File</button>
        <button class="ide-btn" id="ide-save">Save</button>
        <button class="ide-btn" id="ide-run" style="background:#28a745; border-color:#28a745; color:#fff;">Run Script</button>
      </div>
      <div class="ide-main">
        <div class="ide-sidebar" id="ide-file-tree">
          <!-- Populated dynamically -->
        </div>
        <div class="ide-editor-container">
          <div class="ide-tabs">
            <div class="ide-tab" id="ide-active-tab">untitled.js</div>
          </div>
          <textarea class="ide-textarea" id="ide-editor" spellcheck="false" placeholder="// Write code here..."></textarea>
        </div>
      </div>
      <div class="ide-status">
        <span id="ide-status-msg">Ready</span>
        <span id="ide-status-lang">JavaScript</span>
      </div>
    `;
  }

  attachEvents(win) {
    const content = win.querySelector('.window-content');
    const newBtn = content.querySelector('#ide-new');
    const saveBtn = content.querySelector('#ide-save');
    const runBtn = content.querySelector('#ide-run');
    const editor = content.querySelector('#ide-editor');
    const tab = content.querySelector('#ide-active-tab');
    const tree = content.querySelector('#ide-file-tree');
    const statusMsg = content.querySelector('#ide-status-msg');

    const updateTree = () => {
      tree.innerHTML = '<div style="padding:4px 16px; font-size:10px; color:#888; text-transform:uppercase; margin-bottom:4px;">Workspace</div>';
      const renderDir = (path, depth = 0) => {
        const items = VFS.readDir(path);
        items.forEach(item => {
          const fullPath = path === '/' ? '/' + item.name : path + '/' + item.name;
          const el = document.createElement('div');
          el.className = 'ide-file-item';
          el.style.paddingLeft = (16 + depth * 12) + 'px';
          
          if (item.type === 'dir') {
            el.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dcb67a" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> ${item.name}`;
            tree.appendChild(el);
            renderDir(fullPath, depth + 1);
          } else {
            let icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#519aba" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
            if (item.name.endsWith('.js')) icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f1e05a" stroke-width="2"><path d="M12 2L2 22h20L12 2z"></path></svg>';
            el.innerHTML = icon + ' ' + item.name;
            el.onclick = () => {
              this.currentFile = fullPath;
              editor.value = VFS.read(fullPath);
              tab.innerText = item.name;
              statusMsg.innerText = 'Loaded ' + fullPath;
            };
            tree.appendChild(el);
          }
        });
      };
      renderDir('/');
    };
    
    updateTree();

    newBtn.onclick = () => {
      this.currentFile = null;
      editor.value = '';
      tab.innerText = 'untitled.js';
      statusMsg.innerText = 'New File';
    };

    saveBtn.onclick = () => {
      if (!this.currentFile) {
        const name = prompt('Enter filename (e.g., /Desktop/script.js):', '/Desktop/untitled.js');
        if (!name) return;
        this.currentFile = name;
        tab.innerText = name.split('/').pop();
      }
      VFS.write(this.currentFile, editor.value);
      statusMsg.innerText = 'Saved ' + this.currentFile;
      updateTree();
    };

    runBtn.onclick = () => {
      if (!this.currentFile || !this.currentFile.endsWith('.js')) {
        alert("Please save as a .js file before running.");
        return;
      }
      try {
        const func = new Function(editor.value);
        func();
        statusMsg.innerText = 'Script executed successfully.';
        VFS.logAction('IDE: Executed script ' + this.currentFile);
      } catch (err) {
        alert("Runtime Error: " + err.message);
        statusMsg.innerText = 'Execution Failed';
      }
    };
  }
}

export default new CodeIDEApp();
