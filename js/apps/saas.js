import { VFS } from '../fs.js';
import { WM } from '../wm.js';

class SaaSApp {
  constructor() {
    this.id = 'saas';
    this.activeTab = 'docs';
  }

  launch() {
    const win = WM.createWindow({
      id: this.id,
      title: 'Halo Productivity Suite',
      width: 720,
      height: 500,
      x: window.innerWidth / 2 - 360,
      y: window.innerHeight / 2 - 250,
      icon: `<svg viewBox="0 0 24 24" class="window-title-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`
    });

    if (win) {
      win.content = win.querySelector('.window-content');
      this.setupStyles();
      this.renderContent(win);
      this.attachEvents(win);
      this.switchTab(win, 'docs');
    }
  }

  setupStyles() {
    if (document.getElementById('saas-styles')) return;
    const style = document.createElement('style');
    style.id = 'saas-styles';
    style.innerHTML = `
      #win-saas .window-content {
        background: #0c0f13;
        color: var(--text-primary);
        font-family: var(--font-family-sans);
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .saas-tab-bar {
        display: flex;
        background: rgba(0, 0, 0, 0.4);
        border-bottom: 1px solid var(--panel-border);
      }
      .saas-tab {
        padding: 12px 24px;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
      }
      .saas-tab:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
      .saas-tab.active { color: var(--accent-color); border-bottom-color: var(--accent-color); background: rgba(0, 229, 255, 0.05); }
      
      .saas-view {
        flex-grow: 1;
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      .saas-view.active { display: flex; }

      /* DOCS STYLES */
      .docs-toolbar {
        padding: 8px 16px;
        border-bottom: 1px solid var(--panel-border);
        display: flex;
        gap: 8px;
        background: rgba(255,255,255,0.02);
      }
      .docs-btn {
        background: transparent;
        border: 1px solid transparent;
        color: var(--text-primary);
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      }
      .docs-btn:hover { background: rgba(255,255,255,0.1); }
      .docs-editor {
        flex-grow: 1;
        padding: 40px 60px;
        outline: none;
        overflow-y: auto;
        font-size: 15px;
        line-height: 1.6;
        color: #e0e0e0;
      }
      .docs-editor h1, .docs-editor h2 { color: #fff; margin-top: 1em; }
      .docs-editor hr { border-color: rgba(255,255,255,0.1); margin: 2em 0; }
      
      /* SHEETS STYLES */
      .sheets-toolbar {
        padding: 8px 16px;
        border-bottom: 1px solid var(--panel-border);
        display: flex;
        gap: 8px;
        background: rgba(255,255,255,0.02);
        align-items: center;
      }
      .sheets-formula-bar {
        flex-grow: 1;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .sheets-formula-bar input {
        flex-grow: 1;
        background: rgba(0,0,0,0.3);
        border: 1px solid var(--panel-border);
        color: var(--text-primary);
        padding: 6px 10px;
        border-radius: 4px;
        outline: none;
        font-family: var(--font-family-mono);
      }
      .sheets-grid-container {
        flex-grow: 1;
        overflow: auto;
        background: #111418;
      }
      .sheets-grid {
        border-collapse: collapse;
        table-layout: fixed;
      }
      .sheets-grid th, .sheets-grid td {
        border: 1px solid var(--panel-border);
        min-width: 80px;
        height: 28px;
        padding: 0;
        margin: 0;
      }
      .sheets-grid th {
        background: rgba(255,255,255,0.05);
        color: var(--text-secondary);
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        position: sticky;
        top: 0;
        z-index: 1;
      }
      .sheets-grid th.row-header {
        left: 0;
        width: 40px;
        min-width: 40px;
        z-index: 2;
      }
      .sheets-grid th.corner { z-index: 3; }
      .sheets-cell {
        width: 100%;
        height: 100%;
        border: none;
        background: transparent;
        color: var(--text-primary);
        padding: 4px 6px;
        outline: none;
        font-size: 12px;
        font-family: var(--font-family-sans);
      }
      .sheets-cell:focus {
        background: rgba(0, 229, 255, 0.05);
        box-shadow: inset 0 0 0 2px var(--accent-color);
      }
    `;
    document.head.appendChild(style);
  }

  renderContent(win) {
    win.content.innerHTML = `
      <div class="saas-tab-bar">
        <div class="saas-tab" data-tab="docs">Halo Docs</div>
        <div class="saas-tab" data-tab="sheets">Halo Sheets</div>
      </div>
      
      <!-- Halo Docs View -->
      <div class="saas-view" id="saas-view-docs">
        <div class="docs-toolbar">
          <button class="docs-btn" id="docs-bold">B</button>
          <button class="docs-btn" id="docs-italic">I</button>
          <button class="docs-btn" id="docs-h1">H1</button>
          <button class="docs-btn" id="docs-h2">H2</button>
          <button class="docs-btn" id="docs-list">• List</button>
          <div style="flex-grow:1;"></div>
          <button class="docs-btn" id="docs-load" style="color:var(--accent-color);">Load</button>
          <button class="docs-btn" id="docs-save" style="background:var(--accent-color); color:#000;">Save</button>
        </div>
        <div class="docs-editor" id="docs-editor" contenteditable="true">
          <h1>Sovereign Document</h1>
          <p>Start typing here...</p>
        </div>
      </div>

      <!-- Halo Sheets View -->
      <div class="saas-view" id="saas-view-sheets">
        <div class="sheets-toolbar">
          <div style="width: 40px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text-secondary);" id="sheets-active-cell">A1</div>
          <div class="sheets-formula-bar">
            <span style="font-size: 14px; color: var(--text-secondary);">fx</span>
            <input type="text" id="sheets-formula-input" placeholder="Value or =FORMULA">
          </div>
          <button class="docs-btn" id="sheets-load" style="color:var(--accent-color);">Load</button>
          <button class="docs-btn" id="sheets-save" style="background:var(--accent-color); color:#000;">Save</button>
        </div>
        <div class="sheets-grid-container">
          <table class="sheets-grid" id="sheets-grid">
            <!-- Rendered by JS -->
          </table>
        </div>
      </div>
    `;
    this.renderSheetsGrid(win);
  }

  renderSheetsGrid(win) {
    const table = win.content.querySelector('#sheets-grid');
    const cols = 10;
    const rows = 20;
    let html = '<tr><th class="corner"></th>';
    
    // Headers
    for (let c = 0; c < cols; c++) {
      html += `<th>${String.fromCharCode(65 + c)}</th>`;
    }
    html += '</tr>';

    for (let r = 1; r <= rows; r++) {
      html += `<tr><th class="row-header">${r}</th>`;
      for (let c = 0; c < cols; c++) {
        const cellId = `${String.fromCharCode(65 + c)}${r}`;
        html += `<td><input type="text" class="sheets-cell" data-cell="${cellId}"></td>`;
      }
      html += '</tr>';
    }
    table.innerHTML = html;
  }

  attachEvents(win) {
    // Tabs
    const tabs = win.content.querySelectorAll('.saas-tab');
    tabs.forEach(t => {
      t.addEventListener('click', () => this.switchTab(win, t.getAttribute('data-tab')));
    });

    // Docs Events
    const exec = (cmd, val) => document.execCommand(cmd, false, val);
    win.content.querySelector('#docs-bold').addEventListener('click', () => exec('bold'));
    win.content.querySelector('#docs-italic').addEventListener('click', () => exec('italic'));
    win.content.querySelector('#docs-h1').addEventListener('click', () => exec('formatBlock', 'H1'));
    win.content.querySelector('#docs-h2').addEventListener('click', () => exec('formatBlock', 'H2'));
    win.content.querySelector('#docs-list').addEventListener('click', () => exec('insertUnorderedList'));
    
    win.content.querySelector('#docs-save').addEventListener('click', () => {
      const content = win.content.querySelector('#docs-editor').innerHTML;
      if (!VFS.exists('/Documents')) VFS.mkdir('/Documents');
      VFS.write('/Documents/HaloDoc.html', content);
      VFS.logAction('Saved HaloDoc.html');
      alert('Document saved to VFS.');
    });

    win.content.querySelector('#docs-load').addEventListener('click', () => {
      const content = VFS.read('/Documents/HaloDoc.html');
      if (content !== null) {
        win.content.querySelector('#docs-editor').innerHTML = content;
      } else {
        alert('No saved document found at /Documents/HaloDoc.html');
      }
    });

    // Sheets Events
    const cells = win.content.querySelectorAll('.sheets-cell');
    const activeLabel = win.content.querySelector('#sheets-active-cell');
    const formulaInput = win.content.querySelector('#sheets-formula-input');
    let activeCellInput = null;

    // We store raw formulas here, while inputs show evaluated values (simple implementation)
    this.sheetData = {}; 

    cells.forEach(cell => {
      cell.addEventListener('focus', (e) => {
        const id = e.target.getAttribute('data-cell');
        activeLabel.textContent = id;
        activeCellInput = e.target;
        formulaInput.value = this.sheetData[id] || e.target.value;
      });

      cell.addEventListener('input', (e) => {
        const id = e.target.getAttribute('data-cell');
        this.sheetData[id] = e.target.value;
        formulaInput.value = e.target.value;
      });

      cell.addEventListener('blur', (e) => {
        // Simple evaluation on blur
        this.evaluateSheet(win);
      });
    });

    formulaInput.addEventListener('input', (e) => {
      if (activeCellInput) {
        const id = activeCellInput.getAttribute('data-cell');
        this.sheetData[id] = e.target.value;
        activeCellInput.value = e.target.value;
      }
    });
    formulaInput.addEventListener('blur', () => this.evaluateSheet(win));

    win.content.querySelector('#sheets-save').addEventListener('click', () => {
      if (!VFS.exists('/Documents')) VFS.mkdir('/Documents');
      VFS.write('/Documents/HaloSheet.json', JSON.stringify(this.sheetData));
      VFS.logAction('Saved HaloSheet.json');
      alert('Spreadsheet saved to VFS.');
    });

    win.content.querySelector('#sheets-load').addEventListener('click', () => {
      const raw = VFS.read('/Documents/HaloSheet.json');
      if (raw !== null) {
        try {
          this.sheetData = JSON.parse(raw);
          // populate
          for (let id in this.sheetData) {
            const input = win.content.querySelector(`.sheets-cell[data-cell="${id}"]`);
            if (input) input.value = this.sheetData[id];
          }
          this.evaluateSheet(win);
        } catch (e) {
          alert('Error loading spreadsheet data.');
        }
      } else {
        alert('No saved spreadsheet found.');
      }
    });
  }

  evaluateSheet(win) {
    // Simple SUM(A1:A5) evaluation
    const cells = win.content.querySelectorAll('.sheets-cell');
    
    // First pass: restore raw formulas
    cells.forEach(c => {
      const id = c.getAttribute('data-cell');
      if (this.sheetData[id] && this.sheetData[id].toString().startsWith('=')) {
        c.value = this.sheetData[id];
      }
    });

    // Second pass: evaluate
    cells.forEach(c => {
      const id = c.getAttribute('data-cell');
      const val = this.sheetData[id] || '';
      if (val.toString().startsWith('=')) {
        try {
          if (val.toUpperCase().startsWith('=SUM(')) {
            // Very naive SUM(A1:A5)
            const rangeStr = val.substring(5, val.length - 1);
            const parts = rangeStr.split(':');
            if (parts.length === 2) {
              const startCell = parts[0];
              const endCell = parts[1];
              // Assuming same column for simplicity e.g. A1:A5
              const col = startCell.charAt(0);
              const startRow = parseInt(startCell.substring(1));
              const endRow = parseInt(endCell.substring(1));
              let sum = 0;
              for (let r = startRow; r <= endRow; r++) {
                const checkId = `${col}${r}`;
                const cellVal = parseFloat(this.sheetData[checkId]);
                if (!isNaN(cellVal)) sum += cellVal;
              }
              c.value = sum;
            }
          }
        } catch(e) {
          c.value = '#ERROR';
        }
      }
    });
  }

  switchTab(win, tabName) {
    this.activeTab = tabName;
    win.content.querySelectorAll('.saas-tab').forEach(t => t.classList.remove('active'));
    win.content.querySelector(`.saas-tab[data-tab="${tabName}"]`).classList.add('active');

    win.content.querySelectorAll('.saas-view').forEach(v => v.classList.remove('active'));
    win.content.querySelector(`#saas-view-${tabName}`).classList.add('active');
  }
}

export default new SaaSApp();
