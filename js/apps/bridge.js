import { VFS } from '../fs.js';
import { WM } from '../wm.js';

class BridgeApp {
  constructor() {
    this.id = 'bridge';
  }

  launch() {
    const win = WM.createWindow({
      id: this.id,
      title: 'Secure PC-Bridge',
      width: 560,
      height: 420,
      icon: `<svg viewBox="0 0 24 24" class="window-title-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>`
    });

    if (win) {
      this.setupStyles();
      const content = win.querySelector('.window-content');
      this.renderContent(content);
      this.attachEvents(content);
    }
  }

  setupStyles() {
    if (document.getElementById('bridge-styles')) return;
    const style = document.createElement('style');
    style.id = 'bridge-styles';
    style.innerHTML = `
      #win-bridge .window-content {
        background: #0c0f13;
        color: var(--text-primary);
        font-family: var(--font-family-sans);
        display: flex;
        flex-direction: column;
        padding: 16px;
      }
      .bridge-security-banner {
        background: rgba(0, 229, 255, 0.1);
        border: 1px solid var(--accent-color);
        border-radius: 8px;
        padding: 10px;
        font-size: 11px;
        color: var(--accent-color);
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      }
      .bridge-dropzone {
        border: 2px dashed var(--accent-color);
        border-radius: 16px;
        background: rgba(0, 229, 255, 0.03);
        padding: 40px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        min-height: 160px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .bridge-dropzone.drag-active {
        background: rgba(0, 229, 255, 0.08);
        border-color: var(--success-color);
        transform: scale(1.02);
        box-shadow: 0 0 30px rgba(0, 229, 255, 0.15);
      }
      .bridge-dropzone svg { width: 48px; height: 48px; color: var(--accent-color); opacity: 0.6; }
      .bridge-dropzone h3 { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0; }
      .bridge-dropzone p { font-size: 11px; color: var(--text-secondary); text-align: center; margin: 0; }
      
      .bridge-file-input-hidden {
        display: none;
      }

      .bridge-queue {
        flex-grow: 1;
        margin-top: 16px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        border: 1px solid var(--panel-border);
        overflow: auto;
      }
      .bridge-queue-header {
        padding: 8px 12px;
        border-bottom: 1px solid var(--panel-border);
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        display: flex;
        justify-content: space-between;
      }
      .bridge-queue-list {
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .bridge-queue-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        font-size: 11px;
      }
      .bridge-queue-item .filename { font-weight: 600; color: var(--text-primary); }
      .bridge-queue-item .hash { color: var(--text-secondary); font-family: var(--font-family-mono); font-size: 9px; }
      .bridge-queue-item .status { color: var(--success-color); font-weight: 600; }
    `;
    document.head.appendChild(style);
  }

  renderContent(content) {
    content.innerHTML = `
      <div class="bridge-security-banner">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
        <span>Files are parsed client-side only. Zero server uploads. Sandbox enforced.</span>
      </div>
      <div class="bridge-dropzone" id="bridge-dropzone">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <h3>Drag & Drop Files Here</h3>
        <p>Supports .txt, .json, .md, .csv, .js, .html, .css, .png, .jpg</p>
        <button id="bridge-browse-btn" style="background: rgba(0, 229, 255, 0.2); border: 1px solid var(--accent-color); color: var(--text-primary); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; margin-top: 8px;">Browse Files</button>
      </div>
      <input type="file" id="bridge-file-input" class="bridge-file-input-hidden" multiple accept=".txt,.json,.md,.csv,.js,.html,.css,.png,.jpg,.jpeg">
      <div class="bridge-queue">
        <div class="bridge-queue-header">
          <span>Transfer Log</span>
          <span style="cursor: pointer; color: var(--accent-color);" id="bridge-export-btn">Export VFS to PC</span>
        </div>
        <div class="bridge-queue-list" id="bridge-queue-list">
          <!-- Items go here -->
        </div>
      </div>
    `;
  }

  attachEvents(content) {
    const dropzone = content.querySelector('#bridge-dropzone');
    const fileInput = content.querySelector('#bridge-file-input');
    const browseBtn = content.querySelector('#bridge-browse-btn');
    const queueList = content.querySelector('#bridge-queue-list');
    const exportBtn = content.querySelector('#bridge-export-btn');

    const handleFiles = (files) => {
      Array.from(files).forEach(file => this.processFile(file, queueList));
    };

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      handleFiles(e.dataTransfer.files);
    });

    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      fileInput.value = '';
    });

    exportBtn.addEventListener('click', () => {
      this.showExportDialog(content);
    });
  }

  async processFile(file, queueList) {
    const reader = new FileReader();
    const isImage = file.type.startsWith('image/');

    reader.onload = async (e) => {
      const content = e.target.result;
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content.toString()));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

      const filePath = `/Desktop/${file.name}`;
      VFS.write(filePath, content);

      const item = document.createElement('div');
      item.className = 'bridge-queue-item';
      item.innerHTML = `
        <div>
          <div class="filename">${file.name}</div>
          <div class="hash">SHA-256: ${hashHex}...</div>
        </div>
        <div class="status">✓ Imported</div>
      `;
      queueList.prepend(item);
      VFS.logAction(`Bridge imported ${file.name}`);
    };

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }

  showExportDialog(content) {
    // Walk the VFS recursively to collect all files
    const walk = (dir) => {
      const out = [];
      VFS.ls(dir).forEach(e => {
        if (e.type === 'dir') out.push(...walk(e.path));
        else out.push(e);
      });
      return out;
    };
    const files = walk('/');
    let html = '<div style="padding: 10px; display: flex; flex-direction: column; gap: 8px;">';
    html += '<h4 style="margin: 0; font-size: 12px;">Export Files from VFS</h4>';
    files.forEach(f => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px;">
          <span style="font-size: 11px;">${f.path}</span>
          <button onclick="window.downloadVFSFile('${f.path}')" style="background: var(--accent-color); color: #000; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">Download</button>
        </div>
      `;
    });
    html += '</div>';

    // A hack to allow global download function since inline onclick needs global context
    window.downloadVFSFile = (path) => {
      const data = VFS.read(path);
      if (data !== null) {
        const blob = new Blob([data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = path.split('/').pop();
        a.click();
        URL.revokeObjectURL(url);
      }
    };

    const qList = content.querySelector('#bridge-queue-list');
    qList.innerHTML = html;
  }
}

export default new BridgeApp();
