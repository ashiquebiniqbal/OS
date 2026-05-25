import { VFS } from '../fs.js';
import { WM } from '../wm.js';

/**
 * Halo OS Agent Workflow Automator
 * Visual step compiler featuring live visual desktop executions, delays, and custom recipes.
 */
class WorkflowAutomatorApp {
  constructor() {
    this.workflowBlocks = [];
    this.isRunning = false;
    this.currentStepIdx = -1;
  }

  launch() {
    const id = 'automator';
    const contentHtml = `
      <div class="automator-container">
        <!-- Sidebar Block Tool Chest -->
        <div class="automator-sidebar">
          <h3>Block Library</h3>
          <p class="sidebar-help">Stack actions to compile your local automated agent routine.</p>
          
          <div class="block-buttons-grid">
            <button class="block-add-btn" data-type="launch_app">🚀 Launch App</button>
            <button class="block-add-btn" data-type="create_dir">📂 Create Folder</button>
            <button class="block-add-btn" data-type="write_file">📄 Write VFS File</button>
            <button class="block-add-btn" data-type="term_exec">⌨️ Exec Command</button>
            <button class="block-add-btn" data-type="copilot_prompt">🤖 Copilot Prompt</button>
            <button class="block-add-btn" data-type="delay">⏱️ Delay Wait</button>
            <button class="block-add-btn" data-type="alert">🔔 Trigger Alert</button>
          </div>

          <div class="preset-recipes-section">
            <h4>Preset Recipes</h4>
            <button class="recipe-btn" id="recipe-sec-init">🛡️ Secure Node Init</button>
            <button class="recipe-btn" id="recipe-matrix">💚 Matrix Rain Routine</button>
            <button class="recipe-btn" id="recipe-file-sys">💾 VFS Sandbox Prep</button>
          </div>
        </div>

        <!-- Compiled workflow compiler space -->
        <div class="automator-workbench">
          <div class="workbench-header">
            <h3>Active Workflow Workbench</h3>
            <div class="workbench-actions">
              <button class="workbench-btn primary" id="auto-run-btn">Execute Agentic Workflow</button>
              <button class="workbench-btn danger" id="auto-clear-btn">Wipe Steps</button>
            </div>
          </div>

          <!-- Vertical stack list of compiled block items -->
          <div class="automator-steps-list" id="automator-steps-list">
            <!-- Dynamic block element tags -->
          </div>
        </div>
      </div>
    `;

    WM.createWindow({
      id,
      title: 'Workflow Automator',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><polyline points="9 17 15 12 9 7"></polyline></svg>`,
      width: 680,
      height: 440,
      contentHtml
    });

    this.setupStyles();
    this.bindEvents();
    
    // Load default secure init recipe on startup to show how it works immediately!
    this.loadRecipeSecInit();
  }

  bindEvents() {
    const list = document.getElementById('automator-steps-list');
    if (!list) return;

    // Block Add clicks
    const addBtns = document.querySelectorAll('.block-add-btn');
    addBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        this.addBlock(type);
      });
    });

    // Preset recipe bindings
    document.getElementById('recipe-sec-init').addEventListener('click', () => this.loadRecipeSecInit());
    document.getElementById('recipe-matrix').addEventListener('click', () => this.loadRecipeMatrix());
    document.getElementById('recipe-file-sys').addEventListener('click', () => this.loadRecipeFileSys());

    // Execution run clicks
    document.getElementById('auto-run-btn').addEventListener('click', () => this.runWorkflow());
    
    // Workbench wipe steps
    document.getElementById('auto-clear-btn').addEventListener('click', () => {
      if (this.isRunning) return;
      this.workflowBlocks = [];
      this.renderWorkbench();
    });
  }

  /**
   * Stacks visual step instruction blocks.
   */
  addBlock(type, val1 = '', val2 = '') {
    if (this.isRunning) return;

    const blockId = 'block-' + Date.now() + Math.random().toString(36).substring(2, 5);
    let blockObj = { id: blockId, type, val1, val2 };

    // Set smart defaults depending on type
    if (type === 'launch_app' && !val1) blockObj.val1 = 'vpn';
    if (type === 'create_dir' && !val1) blockObj.val1 = 'Project_Folder';
    if (type === 'write_file' && !val1) { blockObj.val1 = 'Desktop/notes.txt'; blockObj.val2 = 'Private notes inside sandbox.'; }
    if (type === 'term_exec' && !val1) blockObj.val1 = 'neofetch';
    if (type === 'copilot_prompt' && !val1) blockObj.val1 = 'open terminal';
    if (type === 'delay' && !val1) blockObj.val1 = '2';
    if (type === 'alert' && !val1) blockObj.val1 = 'Secure Routine Executed successfully.';

    this.workflowBlocks.push(blockObj);
    this.renderWorkbench();
  }

  /**
   * Compiles the Workbench editor list.
   */
  renderWorkbench() {
    const list = document.getElementById('automator-steps-list');
    if (!list) return;

    list.innerHTML = '';

    if (this.workflowBlocks.length === 0) {
      list.innerHTML = `
        <div class="workbench-empty">
          <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <path d="M9 17l6-5-6-5"></path>
          </svg>
          <span>Workbench is empty. Click block blocks on the left to stack routines!</span>
        </div>
      `;
      return;
    }

    this.workflowBlocks.forEach((block, idx) => {
      const el = document.createElement('div');
      el.className = `workbench-block-item type-${block.type}`;
      el.id = `work-${block.id}`;
      
      let typeLabel = '';
      let inputsHtml = '';

      switch (block.type) {
        case 'launch_app':
          typeLabel = '🚀 Launch Application';
          inputsHtml = `
            <select class="block-select" id="input-v1-${block.id}">
              <option value="explorer" ${block.val1 === 'explorer' ? 'selected' : ''}>File Explorer</option>
              <option value="notepad" ${block.val1 === 'notepad' ? 'selected' : ''}>Notepad Editor</option>
              <option value="terminal" ${block.val1 === 'terminal' ? 'selected' : ''}>Console Terminal</option>
              <option value="vpn" ${block.val1 === 'vpn' ? 'selected' : ''}>Secure VPN</option>
              <option value="shield" ${block.val1 === 'shield' ? 'selected' : ''}>Privacy Shield</option>
              <option value="paint" ${block.val1 === 'paint' ? 'selected' : ''}>Canvas Paint</option>
              <option value="monitor" ${block.val1 === 'monitor' ? 'selected' : ''}>Task Manager</option>
            </select>
          `;
          break;

        case 'create_dir':
          typeLabel = '📂 Create Sandboxed Folder';
          inputsHtml = `<input type="text" class="block-input" id="input-v1-${block.id}" value="${block.val1}" placeholder="Directory name">`;
          break;

        case 'write_file':
          typeLabel = '📄 Write Sandboxed File';
          inputsHtml = `
            <input type="text" class="block-input" id="input-v1-${block.id}" value="${block.val1}" placeholder="VFS path (e.g. Desktop/log.txt)">
            <textarea class="block-textarea" id="input-v2-${block.id}" placeholder="File contents text">${block.val2}</textarea>
          `;
          break;

        case 'term_exec':
          typeLabel = '⌨️ Execute Terminal Command';
          inputsHtml = `<input type="text" class="block-input" id="input-v1-${block.id}" value="${block.val1}" placeholder="e.g. neofetch, ls, clear">`;
          break;

        case 'copilot_prompt':
          typeLabel = '🤖 AI Copilot Prompt';
          inputsHtml = `<input type="text" class="block-input" id="input-v1-${block.id}" value="${block.val1}" placeholder="Command (e.g. open vpn, set background light)">`;
          break;

        case 'delay':
          typeLabel = '⏱️ Delay Wait Execution';
          inputsHtml = `<input type="number" class="block-input size-short" id="input-v1-${block.id}" value="${block.val1}" min="1" max="15"> <span style="font-size:11px; font-weight:700;">Seconds</span>`;
          break;

        case 'alert':
          typeLabel = '🔔 Trigger Alert Notification';
          inputsHtml = `<input type="text" class="block-input" id="input-v1-${block.id}" value="${block.val1}" placeholder="Notification message text">`;
          break;
      }

      el.innerHTML = `
        <div class="block-drag-idx">${idx + 1}</div>
        <div class="block-meta-wrapper">
          <span class="block-badge">${typeLabel}</span>
          <div class="block-inputs-row">${inputsHtml}</div>
        </div>
        <button class="block-remove-btn" title="Delete Step">✕</button>
      `;

      // Track input changes to update model state in real-time
      const v1 = el.querySelector(`#input-v1-${block.id}`);
      if (v1) {
        v1.addEventListener('input', (e) => { block.val1 = e.target.value; });
        v1.addEventListener('change', (e) => { block.val1 = e.target.value; });
      }
      
      const v2 = el.querySelector(`#input-v2-${block.id}`);
      if (v2) {
        v2.addEventListener('input', (e) => { block.val2 = e.target.value; });
      }

      // Delete block item
      el.querySelector('.block-remove-btn').addEventListener('click', () => {
        if (this.isRunning) return;
        this.workflowBlocks.splice(idx, 1);
        this.renderWorkbench();
      });

      list.appendChild(el);
    });
  }

  /* ----------------------------------------------------
     PRESETS RECIPES LOADER ACTIONS
  ---------------------------------------------------- */
  loadRecipeSecInit() {
    if (this.isRunning) return;
    this.workflowBlocks = [];
    this.addBlock('launch_app', 'vpn');
    this.addBlock('delay', '2');
    this.addBlock('launch_app', 'shield');
    this.addBlock('alert', 'System enclave initialized. Zero telemetry verified.');
  }

  loadRecipeMatrix() {
    if (this.isRunning) return;
    this.workflowBlocks = [];
    this.addBlock('launch_app', 'terminal');
    this.addBlock('delay', '2');
    this.addBlock('term_exec', 'matrix');
  }

  loadRecipeFileSys() {
    if (this.isRunning) return;
    this.workflowBlocks = [];
    this.addBlock('create_dir', 'Secrets');
    this.addBlock('write_file', 'Secrets/keys.txt', 'CIPHER_SUITE=ChaCha20\nMASTER_KEY=isolated_browser_key_55a2');
    this.addBlock('launch_app', 'explorer');
    this.addBlock('alert', 'Virtual sandboxed folders created and written securely.');
  }

  /* ----------------------------------------------------
     LIVE RUNTIME VISUAL ORCHESTRATOR
  ---------------------------------------------------- */
  async runWorkflow() {
    if (this.isRunning || this.workflowBlocks.length === 0) return;
    
    this.isRunning = true;
    const runBtn = document.getElementById('auto-run-btn');
    runBtn.innerText = 'Executing...';
    runBtn.className = 'workbench-btn warning';

    VFS.logAction("Started visual agentic workflow automation loop.");

    for (let i = 0; i < this.workflowBlocks.length; i++) {
      this.currentStepIdx = i;
      const block = this.workflowBlocks[i];
      const blockNode = document.getElementById(`work-${block.id}`);

      // Add visual active glowing highlights
      if (blockNode) blockNode.classList.add('step-active');

      await this.executeStep(block);

      // Remove glowing highlights
      if (blockNode) blockNode.classList.remove('step-active');
      
      // Verification safety check
      if (!this.isRunning) break;
    }

    this.isRunning = false;
    this.currentStepIdx = -1;
    
    if (runBtn) {
      runBtn.innerText = 'Execute Agentic Workflow';
      runBtn.className = 'workbench-btn primary';
    }

    VFS.logAction("Completed visual agentic workflow automation loop.");
  }

  /**
   * Driver to trigger desktop environment actions step-by-step.
   */
  async executeStep(block) {
    switch (block.type) {
      case 'launch_app':
        const appBtn = document.querySelector(`.desktop-icon-btn[data-id="${block.val1}"]`);
        if (appBtn) appBtn.click();
        break;

      case 'create_dir':
        VFS.mkdir('/Desktop/' + block.val1);
        // Refresh explorer if open
        if (WM.windows.has('explorer')) {
          const explorerModule = await import('./explorer.js');
          explorerModule.default.renderDirectory();
        }
        break;

      case 'write_file':
        VFS.write('/' + block.val1, block.val2);
        // Refresh explorer if open
        if (WM.windows.has('explorer')) {
          const explorerModule = await import('./explorer.js');
          explorerModule.default.renderDirectory();
        }
        break;

      case 'term_exec':
        // If terminal is open, execute command string directly
        if (WM.windows.has('terminal')) {
          const input = document.getElementById('terminal-input');
          if (input) {
            input.value = block.val1;
            const e = new KeyboardEvent('keydown', { key: 'Enter' });
            input.dispatchEvent(e);
          }
        }
        break;

      case 'copilot_prompt':
        // Feed instruction directly into Agent parser
        if (window.haloAgentTrigger) {
          window.haloAgentTrigger(block.val1);
        }
        break;

      case 'delay':
        const seconds = parseFloat(block.val1) || 2;
        await this.sleep(seconds * 1000);
        break;

      case 'alert':
        alert(`[Automator System Alert] ${block.val1}`);
        break;
    }

    // Standard safety sleep between steps to keep visual timings readable
    await this.sleep(600);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setupStyles() {
    if (document.getElementById('automator-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'automator-dynamic-style';
    style.textContent = `
      .automator-container {
        display: flex;
        height: 100%;
        color: var(--text-primary);
      }
      
      /* Block Toolbox Left */
      .automator-sidebar {
        width: 220px;
        min-width: 220px;
        background: rgba(0, 0, 0, 0.2);
        border-right: 1px solid var(--panel-border);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .automator-sidebar h3 {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.6px;
        border-bottom: 1px solid var(--panel-border);
        padding-bottom: 6px;
      }
      .sidebar-help {
        font-size: 9px;
        color: var(--text-secondary);
        line-height: 1.4;
      }
      .block-buttons-grid {
        display: grid;
        grid-template-columns: 1fr;
        grid-gap: 6px;
      }
      .block-add-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        padding: 8px 10px;
        color: var(--text-primary);
        font-family: var(--font-family-sans);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s ease;
      }
      .block-add-btn:hover {
        background: rgba(0, 229, 255, 0.08);
        border-color: var(--accent-color);
        transform: translateX(4px);
      }
      
      .preset-recipes-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
      }
      .preset-recipes-section h4 {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-secondary);
      }
      .recipe-btn {
        background: rgba(255, 255, 255, 0.02);
        border: 1px dashed var(--panel-border);
        border-radius: 6px;
        padding: 6px 8px;
        color: var(--text-secondary);
        font-family: var(--font-family-sans);
        font-size: 10px;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .recipe-btn:hover {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-primary);
        border-style: solid;
      }

      /* Compiler workbench Right */
      .automator-workbench {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .workbench-header {
        height: 46px;
        background: rgba(0, 0, 0, 0.1);
        border-bottom: 1px solid var(--panel-border);
        padding: 0 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .workbench-header h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); }
      .workbench-actions { display: flex; gap: 8px; }
      .workbench-btn {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        padding: 6px 14px;
        font-family: var(--font-family-sans);
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .workbench-btn:hover { background: rgba(255, 255, 255, 0.08); }
      .workbench-btn.primary { background: var(--accent-color); color: #121820; border-color: var(--accent-color); }
      .workbench-btn.primary:hover { background: #00b8cc; box-shadow: var(--accent-glowing); }
      .workbench-btn.warning { background: rgba(255, 204, 0, 0.1); border-color: var(--warning-color); color: var(--warning-color); }
      .workbench-btn.danger:hover { background: rgba(255, 59, 48, 0.15); border-color: var(--danger-color); color: var(--danger-color); }

      .automator-steps-list {
        flex-grow: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        scrollbar-width: thin;
      }
      
      .workbench-block-item {
        display: flex;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        padding: 10px 14px;
        align-items: center;
        gap: 12px;
        position: relative;
        transition: all 0.3s ease;
      }
      
      .workbench-block-item.step-active {
        border-color: var(--accent-color) !important;
        background: rgba(0, 229, 255, 0.06) !important;
        box-shadow: 0 0 12px rgba(0, 229, 255, 0.2);
        transform: scale(1.02);
      }
      
      .block-drag-idx {
        font-size: 12px;
        font-weight: 700;
        color: var(--text-secondary);
        background: rgba(255,255,255,0.03);
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .block-meta-wrapper {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .block-badge {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--accent-color);
        letter-spacing: 0.4px;
      }
      
      .block-inputs-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .block-select {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--panel-border);
        color: var(--text-primary);
        border-radius: 6px;
        padding: 6px 10px;
        font-family: var(--font-family-sans);
        font-size: 11px;
        outline: none;
      }
      .block-input {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--panel-border);
        color: var(--text-primary);
        border-radius: 6px;
        padding: 6px 10px;
        font-family: var(--font-family-sans);
        font-size: 11px;
        outline: none;
        flex-grow: 1;
      }
      .block-input.size-short {
        width: 60px;
        flex-grow: 0;
        text-align: center;
      }
      .block-textarea {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--panel-border);
        color: var(--text-primary);
        border-radius: 6px;
        padding: 6px 10px;
        font-family: var(--font-family-mono);
        font-size: 9px;
        outline: none;
        flex-grow: 1;
        height: 48px;
        resize: none;
      }
      
      .block-remove-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        opacity: 0.6;
        font-size: 11px;
        transition: opacity 0.15s ease, color 0.15s ease;
      }
      .block-remove-btn:hover { opacity: 1; color: var(--danger-color); }
      
      .workbench-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 180px;
        color: var(--text-secondary);
        gap: 12px;
        text-align: center;
        padding: 0 40px;
      }
      .workbench-empty span {
        font-size: 11px;
        font-weight: 500;
        line-height: 1.5;
      }
    `;
    document.head.appendChild(style);
  }
}

export const Automator = new WorkflowAutomatorApp();
export default Automator;
