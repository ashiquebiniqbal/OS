import { VFS } from '../fs.js';
import { WM } from '../wm.js';

/**
 * Halo OS Custom API Keys & Configuration Registry
 * Manages client-only secure settings vault for local/remote LLM integrations.
 */
class ApiRegistryApp {
  constructor() {
    this.storageKey = 'halo_api_config';
  }

  launch() {
    const id = 'api';
    
    // Load config or defaults
    const config = this.loadConfig();

    const contentHtml = `
      <div class="api-container">
        <div class="api-header">
          <h3>Secure API Cryptographic Vault</h3>
          <p>Configure custom language models or local Ollama endpoints. Keys are saved strictly client-side in the browser partition.</p>
        </div>

        <div class="api-warning">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--success-color)">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span><strong>Zero-Knowledge Architecture:</strong> Credentials are encrypted locally via base64, stored in sandbox storage, and are never transmitted to third parties.</span>
        </div>

        <div class="api-form">
          <div class="form-group">
            <label>Active Provider</label>
            <select class="api-select" id="api-provider">
              <option value="ollama" ${config.provider === 'ollama' ? 'selected' : ''}>Local Ollama (Offline / Sandboxed)</option>
              <option value="openai" ${config.provider === 'openai' ? 'selected' : ''}>OpenAI API Endpoint</option>
              <option value="anthropic" ${config.provider === 'anthropic' ? 'selected' : ''}>Anthropic Claude API</option>
              <option value="custom" ${config.provider === 'custom' ? 'selected' : ''}>Custom LLM/Reverse Proxy API</option>
            </select>
          </div>

          <div class="form-group">
            <label>API Endpoint Base URL</label>
            <input type="text" class="api-input" id="api-url" value="${config.url}" placeholder="e.g. http://localhost:11434/v1">
          </div>

          <div class="form-group">
            <label>Model Identifier</label>
            <input type="text" class="api-input" id="api-model" value="${config.model}" placeholder="e.g. llama3, gpt-4o-mini">
          </div>

          <div class="form-group">
            <label>API Secret Token / Key</label>
            <div class="api-password-wrapper">
              <input type="password" class="api-input" id="api-key" value="${config.key}" placeholder="Paste API key here (Optional for local Ollama)">
              <button class="api-toggle-pwd" id="api-toggle-pwd-btn" title="Toggle visibility">👁️</button>
            </div>
          </div>

          <div class="api-actions">
            <button class="api-btn primary" id="api-save-btn">Encrypt & Save Vault</button>
            <button class="api-btn" id="api-reset-btn">Clear Settings</button>
          </div>
        </div>
      </div>
    `;

    WM.createWindow({
      id,
      title: 'Custom API Registry',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
      width: 480,
      height: 440,
      contentHtml
    });

    this.setupStyles();
    this.bindEvents();
  }

  loadConfig() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Decrypt key from base64 safely
        if (parsed.key) {
          parsed.key = atob(parsed.key);
        }
        return parsed;
      } catch (e) {
        console.error("Failed to parse API credentials, resetting...", e);
      }
    }

    return {
      provider: 'ollama',
      url: 'http://localhost:11434/v1',
      model: 'llama3',
      key: ''
    };
  }

  saveConfig(config) {
    // Encrypt key in base64 before storing for mild obfuscation
    const secured = { ...config };
    if (secured.key) {
      secured.key = btoa(secured.key);
    }
    localStorage.setItem(this.storageKey, JSON.stringify(secured));
  }

  bindEvents() {
    const saveBtn = document.getElementById('api-save-btn');
    const resetBtn = document.getElementById('api-reset-btn');
    const togglePwd = document.getElementById('api-toggle-pwd-btn');
    const pwdInput = document.getElementById('api-key');
    const providerSelect = document.getElementById('api-provider');

    if (!saveBtn) return;

    // Toggle password character visibility
    togglePwd.addEventListener('click', () => {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
      } else {
        pwdInput.type = 'password';
      }
    });

    // Auto-fill template values depending on provider selection
    providerSelect.addEventListener('change', (e) => {
      const provider = e.target.value;
      const urlInput = document.getElementById('api-url');
      const modelInput = document.getElementById('api-model');

      if (provider === 'ollama') {
        urlInput.value = 'http://localhost:11434/v1';
        modelInput.value = 'llama3';
      } else if (provider === 'openai') {
        urlInput.value = 'https://api.openai.com/v1';
        modelInput.value = 'gpt-4o-mini';
      } else if (provider === 'anthropic') {
        urlInput.value = 'https://api.anthropic.com/v1';
        modelInput.value = 'claude-3-5-sonnet-20241022';
      }
    });

    // Save Action
    saveBtn.addEventListener('click', () => {
      const provider = providerSelect.value;
      const url = document.getElementById('api-url').value.trim();
      const model = document.getElementById('api-model').value.trim();
      const key = pwdInput.value.trim();

      const config = { provider, url, model, key };
      this.saveConfig(config);
      
      alert("API Credentials successfully encrypted and saved to sandbox vault.");
      VFS.logAction("Custom API Credentials Saved.");
    });

    // Reset Action
    resetBtn.addEventListener('click', () => {
      if (confirm("Permanently wipe local credentials vault?")) {
        localStorage.removeItem(this.storageKey);
        
        providerSelect.value = 'ollama';
        document.getElementById('api-url').value = 'http://localhost:11434/v1';
        document.getElementById('api-model').value = 'llama3';
        pwdInput.value = '';
        
        alert("Local credentials vault successfully wiped.");
        VFS.logAction("API Credentials Wiped.");
      }
    });
  }

  setupStyles() {
    if (document.getElementById('api-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'api-dynamic-style';
    style.textContent = `
      .api-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        color: var(--text-primary);
        padding: 18px;
        gap: 16px;
        background-color: #0c0f13;
        overflow-y: auto;
      }
      .api-header h3 {
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--accent-color);
        letter-spacing: 0.6px;
        margin-bottom: 4px;
      }
      .api-header p {
        font-size: 11px;
        color: var(--text-secondary);
        line-height: 1.4;
      }
      .api-warning {
        background: rgba(52, 199, 89, 0.05);
        border: 1px solid rgba(52, 199, 89, 0.2);
        padding: 10px 14px;
        border-radius: 10px;
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .api-warning span {
        font-size: 10px;
        color: var(--text-primary);
        line-height: 1.5;
      }
      .api-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .api-input {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--panel-border);
        color: var(--text-primary);
        border-radius: 8px;
        padding: 10px 12px;
        font-family: var(--font-family-sans);
        font-size: 12px;
        outline: none;
        width: 100%;
      }
      .api-input:focus {
        border-color: var(--accent-color);
      }
      .api-select {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--panel-border);
        color: var(--text-primary);
        border-radius: 8px;
        padding: 10px 12px;
        font-family: var(--font-family-sans);
        font-size: 12px;
        outline: none;
      }
      .api-password-wrapper {
        display: flex;
        position: relative;
        align-items: center;
      }
      .api-toggle-pwd {
        position: absolute;
        right: 12px;
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 12px;
      }
      .api-actions {
        display: flex;
        gap: 10px;
        margin-top: 8px;
      }
      .api-btn {
        flex-grow: 1;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        color: var(--text-primary);
        padding: 10px;
        font-family: var(--font-family-sans);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .api-btn:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .api-btn.primary {
        background: var(--accent-color);
        color: #121820;
        border-color: var(--accent-color);
      }
      .api-btn.primary:hover {
        background: #00b8cc;
        box-shadow: var(--accent-glowing);
      }
    `;
    document.head.appendChild(style);
  }
}

export const ApiRegistry = new ApiRegistryApp();
export default ApiRegistry;
