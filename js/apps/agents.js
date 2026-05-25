import { VFS } from '../fs.js';
import { WM } from '../wm.js';

class AgentsApp {
  constructor() {
    this.id = 'agents';
    this.agents = [];
    this.selectedAgentId = null;
  }

  loadAgents() {
    const raw = localStorage.getItem('halo_agents_registry');
    if (raw) {
      this.agents = JSON.parse(raw);
    } else {
      this.agents = [
        { id: 'agent-1', name: 'Halo Copilot', role: 'General Assistant', model: 'default', status: 'active', tokenUsage: 12540, lastActive: Date.now(), isSystem: true, systemPrompt: 'You are Halo Copilot, the primary AI assistant for Halo OS. Help the user navigate and manage their sovereign environment.' },
        { id: 'agent-2', name: 'Security Auditor', role: 'Security Analyst', model: 'default', status: 'idle', tokenUsage: 3200, lastActive: Date.now() - 86400000, isSystem: false, systemPrompt: 'Analyze VFS logs and system configs for vulnerabilities. Alert user of unsecured permissions.' },
        { id: 'agent-3', name: 'Code Assistant', role: 'Developer', model: 'default', status: 'idle', tokenUsage: 54000, lastActive: Date.now() - 3600000, isSystem: false, systemPrompt: 'Write and review ES6 code. Adhere to Halo OS glassmorphic design principles.' }
      ];
      this.saveAgents();
    }
  }

  saveAgents() {
    localStorage.setItem('halo_agents_registry', JSON.stringify(this.agents));
  }

  launch() {
    this.loadAgents();
    const win = WM.createWindow({
      id: this.id,
      title: 'Agent Hub Manager',
      width: 660,
      height: 440,
      x: window.innerWidth / 2 - 330,
      y: window.innerHeight / 2 - 220,
      icon: `<svg viewBox="0 0 24 24" class="window-title-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`
    });

    if (win) {
      win.content = win.querySelector('.window-content');
      this.setupStyles();
      this.renderContent(win);
      this.attachEvents(win);
      if (this.agents.length > 0) {
        this.selectAgent(win, this.agents[0].id);
      }
    }
  }

  setupStyles() {
    if (document.getElementById('agents-styles')) return;
    const style = document.createElement('style');
    style.id = 'agents-styles';
    style.innerHTML = `
      #win-agents .window-content {
        background: #0c0f13;
        color: var(--text-primary);
        font-family: var(--font-family-sans);
        display: flex;
        height: 100%;
      }
      .agt-sidebar {
        width: 220px;
        background: rgba(0, 0, 0, 0.3);
        border-right: 1px solid var(--panel-border);
        display: flex;
        flex-direction: column;
      }
      .agt-list {
        flex-grow: 1;
        overflow-y: auto;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .agt-card {
        padding: 10px 12px;
        border-radius: 8px;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.2s ease;
        border: 1px solid transparent;
      }
      .agt-card:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .agt-card.active {
        background: rgba(0, 229, 255, 0.1);
        border-color: rgba(0, 229, 255, 0.3);
      }
      .agt-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .agt-dot.active { background-color: var(--success-color); box-shadow: 0 0 8px var(--success-color); }
      .agt-dot.idle { background-color: var(--warning-color); }
      .agt-dot.disabled { background-color: #666; }
      .agt-info { display: flex; flex-direction: column; }
      .agt-name { font-size: 12px; font-weight: 600; }
      .agt-role { font-size: 10px; color: var(--text-secondary); }
      
      .agt-bottom-bar {
        padding: 12px;
        border-top: 1px solid var(--panel-border);
      }
      .agt-btn {
        width: 100%;
        background: rgba(0, 229, 255, 0.1);
        border: 1px solid var(--accent-color);
        color: var(--text-primary);
        padding: 8px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        transition: all 0.2s ease;
      }
      .agt-btn:hover { background: rgba(0, 229, 255, 0.2); }
      .agt-btn.danger { border-color: var(--danger-color); background: rgba(255, 59, 48, 0.1); }
      .agt-btn.danger:hover { background: rgba(255, 59, 48, 0.2); }

      .agt-panel {
        flex-grow: 1;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow-y: auto;
      }
      .agt-input-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .agt-input-group label { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; }
      .agt-input, .agt-textarea, .agt-select {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--panel-border);
        padding: 10px;
        border-radius: 8px;
        color: var(--text-primary);
        font-family: var(--font-family-sans);
        font-size: 13px;
        outline: none;
      }
      .agt-input:focus, .agt-textarea:focus, .agt-select:focus { border-color: var(--accent-color); }
      .agt-textarea { resize: vertical; min-height: 80px; }
      .agt-status-toggles { display: flex; gap: 8px; }
      .agt-toggle-btn {
        flex: 1;
        padding: 8px;
        background: rgba(255,255,255,0.05);
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s ease;
      }
      .agt-toggle-btn.active[data-status="active"] { background: rgba(52, 199, 89, 0.2); border-color: var(--success-color); color: var(--text-primary); }
      .agt-toggle-btn.active[data-status="idle"] { background: rgba(255, 204, 0, 0.2); border-color: var(--warning-color); color: var(--text-primary); }
      .agt-toggle-btn.active[data-status="disabled"] { background: rgba(255, 255, 255, 0.1); border-color: #888; color: var(--text-primary); }
      
      .agt-stats {
        display: flex;
        gap: 20px;
        padding: 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
      }
      .agt-stat-item { display: flex; flex-direction: column; }
      .agt-stat-value { font-size: 16px; font-weight: 700; color: var(--accent-color); }
      .agt-stat-label { font-size: 10px; color: var(--text-secondary); }
    `;
    document.head.appendChild(style);
  }

  renderContent(win) {
    win.content.innerHTML = `
      <div class="agt-sidebar">
        <div class="agt-list" id="agt-list"></div>
        <div class="agt-bottom-bar">
          <button class="agt-btn" id="agt-new-btn">+ Add New Agent</button>
        </div>
      </div>
      <div class="agt-panel" id="agt-panel" style="display: none;">
        <div class="agt-input-group">
          <label>Agent Name</label>
          <input type="text" class="agt-input" id="agt-edit-name">
        </div>
        <div class="agt-input-group">
          <label>Role / Badge</label>
          <input type="text" class="agt-input" id="agt-edit-role">
        </div>
        <div class="agt-input-group">
          <label>Model Engine</label>
          <select class="agt-select" id="agt-edit-model">
            <option value="default">Halo OS Core API</option>
            <option value="local">Local Ollama (Llama3)</option>
            <option value="custom">Custom Endpoint</option>
          </select>
        </div>
        <div class="agt-input-group">
          <label>System Prompt</label>
          <textarea class="agt-textarea" id="agt-edit-prompt"></textarea>
        </div>
        <div class="agt-input-group">
          <label>Current Status</label>
          <div class="agt-status-toggles" id="agt-edit-status-group">
            <button class="agt-toggle-btn" data-status="active">Active</button>
            <button class="agt-toggle-btn" data-status="idle">Idle</button>
            <button class="agt-toggle-btn" data-status="disabled">Disabled</button>
          </div>
        </div>
        <div class="agt-stats">
          <div class="agt-stat-item">
            <span class="agt-stat-value" id="agt-stat-tokens">0</span>
            <span class="agt-stat-label">Tokens Processed</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px; margin-top: auto;">
          <button class="agt-btn" id="agt-save-btn">Save Agent</button>
          <button class="agt-btn danger" id="agt-delete-btn">Delete Agent</button>
        </div>
      </div>
    `;
    this.renderList(win);
  }

  renderList(win) {
    const list = win.content.querySelector('#agt-list');
    list.innerHTML = '';
    this.agents.forEach(a => {
      const card = document.createElement('div');
      card.className = `agt-card ${a.id === this.selectedAgentId ? 'active' : ''}`;
      card.innerHTML = `
        <div class="agt-dot ${a.status}"></div>
        <div class="agt-info">
          <span class="agt-name">${a.name}</span>
          <span class="agt-role">${a.role}</span>
        </div>
      `;
      card.addEventListener('click', () => this.selectAgent(win, a.id));
      list.appendChild(card);
    });
  }

  selectAgent(win, id) {
    this.selectedAgentId = id;
    this.renderList(win);
    
    const panel = win.content.querySelector('#agt-panel');
    const agent = this.agents.find(a => a.id === id);
    if (!agent) {
      panel.style.display = 'none';
      return;
    }
    
    panel.style.display = 'flex';
    win.content.querySelector('#agt-edit-name').value = agent.name;
    win.content.querySelector('#agt-edit-role').value = agent.role;
    win.content.querySelector('#agt-edit-model').value = agent.model;
    win.content.querySelector('#agt-edit-prompt').value = agent.systemPrompt || '';
    
    const toggles = win.content.querySelectorAll('.agt-toggle-btn');
    toggles.forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-status') === agent.status);
    });
    
    win.content.querySelector('#agt-stat-tokens').innerText = agent.tokenUsage || 0;
    
    const delBtn = win.content.querySelector('#agt-delete-btn');
    if (agent.isSystem) {
      delBtn.style.display = 'none';
    } else {
      delBtn.style.display = 'block';
    }
  }

  attachEvents(win) {
    win.content.querySelector('#agt-new-btn').addEventListener('click', () => {
      const newId = 'agent-' + Date.now();
      this.agents.push({
        id: newId, name: 'New Agent', role: 'Custom', model: 'default', status: 'idle', tokenUsage: 0, lastActive: Date.now(), isSystem: false, systemPrompt: ''
      });
      this.saveAgents();
      this.selectAgent(win, newId);
    });

    win.content.querySelectorAll('.agt-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        win.content.querySelectorAll('.agt-toggle-btn').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    win.content.querySelector('#agt-save-btn').addEventListener('click', () => {
      const agent = this.agents.find(a => a.id === this.selectedAgentId);
      if (!agent) return;
      
      agent.name = win.content.querySelector('#agt-edit-name').value || 'Unnamed Agent';
      agent.role = win.content.querySelector('#agt-edit-role').value;
      agent.model = win.content.querySelector('#agt-edit-model').value;
      agent.systemPrompt = win.content.querySelector('#agt-edit-prompt').value;
      
      const activeToggle = win.content.querySelector('.agt-toggle-btn.active');
      if (activeToggle) agent.status = activeToggle.getAttribute('data-status');
      
      this.saveAgents();
      this.renderList(win);
      alert('Agent settings saved securely.');
    });

    win.content.querySelector('#agt-delete-btn').addEventListener('click', () => {
      const agent = this.agents.find(a => a.id === this.selectedAgentId);
      if (agent && !agent.isSystem) {
        if(confirm('Are you sure you want to terminate this agent?')) {
          this.agents = this.agents.filter(a => a.id !== this.selectedAgentId);
          this.saveAgents();
          this.selectAgent(win, this.agents.length > 0 ? this.agents[0].id : null);
        }
      }
    });
  }
}

export default new AgentsApp();
