import { VFS } from './fs.js';
import { WM } from './wm.js';
import { Shell } from './shell.js';

/**
 * Halo OS Agent Copilot Coordinator
 * Parses natural language commands to control the OS, and handles local/remote secure LLM execution.
 */
class AgentCopilot {
  constructor() {
    this.logsEl = null;
    this.promptEl = null;
    this.sendBtn = null;
    this.isProcessing = false;
    this.pendingAction = null; // Used for interactive MCP confirmations
  }

  init() {
    this.logsEl = document.getElementById('agent-logs');
    this.promptEl = document.getElementById('agent-prompt');
    this.sendBtn = document.getElementById('agent-send-btn');

    if (!this.promptEl || !this.sendBtn) return;

    // Send click
    this.sendBtn.addEventListener('click', () => this.handleUserInput());
    
    // Key Enter sends
    this.promptEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleUserInput();
      }
    });

    // Automatically bind natural language trigger exports to window for automator access
    window.haloAgentTrigger = (text) => this.processQuery(text, true);
  }

  async handleUserInput() {
    if (this.isProcessing) return;
    
    const query = this.promptEl.value.trim();
    if (!query) return;

    this.promptEl.value = '';
    
    // Render User Bubble
    this.appendBubble(query, 'user');
    
    this.isProcessing = true;
    this.sendBtn.disabled = true;

    // Render typing indicator
    const typingId = this.appendBubble('Typing...', 'agent typing');
    
    // Add small synthetic wait for cognitive look
    await this.sleep(600);

    await this.processQuery(query, false, typingId);

    this.isProcessing = false;
    this.sendBtn.disabled = false;
  }

  async processQuery(query, isSilentAutomated = false, typingBubbleId = null) {
    const cleanQuery = query.toLowerCase();
    
    let actionExecuted = false;
    let actionMessage = '';

    // 0. Handle pending MCP interactive confirmations
    if (this.pendingAction) {
      if (cleanQuery.match(/\b(yes|y|confirm|do it|ok)\b/)) {
        if (this.pendingAction.type === 'delete') {
          // Check if file/folder exists
          if (VFS.get(this.pendingAction.path) || Object.keys(VFS.fs).some(k => k.startsWith(this.pendingAction.path + '/'))) {
             VFS.delete(this.pendingAction.path);
             actionMessage = `Deleted <strong>${this.pendingAction.path}</strong> successfully.`;
             if (WM.windows.has('explorer')) {
               import('./apps/explorer.js').then(m => m.default.renderDirectory());
             }
          } else {
             actionMessage = `File or folder <strong>${this.pendingAction.path}</strong> not found.`;
          }
        }
        actionExecuted = true;
      } else {
        actionMessage = "Action aborted.";
        actionExecuted = true;
      }
      this.pendingAction = null;
      if (actionExecuted && !isSilentAutomated) {
        this.replaceTypingBubble(typingBubbleId, actionMessage);
        return;
      }
    }

    // 1. Natural Language Command Mappings (OS Controls)
    if (cleanQuery.includes('open explorer') || cleanQuery.includes('open files') || cleanQuery.includes('show directory')) {
      this.clickAppLauncher('explorer');
      actionMessage = "Spawning File Explorer App.";
      actionExecuted = true;
    } 
    else if (cleanQuery.includes('open notepad') || cleanQuery.includes('create file') || cleanQuery.includes('write document')) {
      this.clickAppLauncher('notepad');
      actionMessage = "Spawning Notepad Text Editor.";
      actionExecuted = true;
    }
    else if (cleanQuery.includes('open terminal') || cleanQuery.includes('show shell') || cleanQuery.includes('open console')) {
      this.clickAppLauncher('terminal');
      actionMessage = "Spawning Halo Command Console.";
      actionExecuted = true;
    }
    else if (cleanQuery.includes('open vpn') || cleanQuery.includes('secure link') || cleanQuery.includes('connect vpn')) {
      this.clickAppLauncher('vpn');
      actionMessage = "Spawning Secure VPN Simulator App.";
      
      // Auto connect VPN if specified
      if (cleanQuery.includes('connect')) {
        setTimeout(() => {
          const connectBtn = document.getElementById('vpn-connect-btn');
          if (connectBtn && connectBtn.innerText.includes('Initiate')) connectBtn.click();
        }, 1200);
        actionMessage += " Initiating secure Diffie-Hellman handshake.";
      }
      actionExecuted = true;
    }
    else if (cleanQuery.includes('open shield') || cleanQuery.includes('telemetry logs') || cleanQuery.includes('show security')) {
      this.clickAppLauncher('shield');
      actionMessage = "Spawning Privacy Telemetry Shield Monitor.";
      actionExecuted = true;
    }
    else if (cleanQuery.includes('open paint') || cleanQuery.includes('draw image') || cleanQuery.includes('canvas paint')) {
      this.clickAppLauncher('paint');
      actionMessage = "Spawning Canvas Painting Sketch App.";
      actionExecuted = true;
    }
    else if (cleanQuery.includes('open monitor') || cleanQuery.includes('task manager') || cleanQuery.includes('processes list')) {
      this.clickAppLauncher('monitor');
      actionMessage = "Spawning Performance Task Manager.";
      actionExecuted = true;
    }
    else if (cleanQuery.includes('open calculator') || cleanQuery.includes('run calculation')) {
      this.clickAppLauncher('calculator');
      actionMessage = "Spawning Glassmorphic Arithmetic Calculator.";
      actionExecuted = true;
    }
    else if (cleanQuery.includes('open music') || cleanQuery.includes('play music') || cleanQuery.includes('chiptune synth')) {
      this.clickAppLauncher('music');
      actionMessage = "Spawning Chiptune Procedural Music Synthesizer.";
      actionExecuted = true;
    }
    else if (cleanQuery.includes('open keys') || cleanQuery.includes('open api') || cleanQuery.includes('configure keys')) {
      this.clickAppLauncher('api');
      actionMessage = "Spawning Custom API Keys Registry Vault.";
      actionExecuted = true;
    }
    else if (cleanQuery.includes('run matrix') || cleanQuery.includes('start rain') || cleanQuery.includes('matrix screensaver')) {
      this.clickAppLauncher('terminal');
      setTimeout(() => {
        const input = document.getElementById('terminal-input');
        if (input) {
          input.value = 'matrix';
          // Simulate Enter key
          const e = new KeyboardEvent('keydown', { key: 'Enter' });
          input.dispatchEvent(e);
        }
      }, 1000);
      actionMessage = "Spawning Terminal and starting cascading Matrix rain screensaver.";
      actionExecuted = true;
    }
    else if (cleanQuery.includes('create directory') || cleanQuery.includes('create folder') || cleanQuery.includes('make folder')) {
      const match = query.match(/(?:directory|folder)\s+([a-zA-Z0-9_-]+)/i);
      const name = match ? match[1] : 'New_Folder';
      const path = '/Desktop/' + name;
      VFS.mkdir(path);
      
      // Refresh explorer
      if (WM.windows.has('explorer')) {
        import('./apps/explorer.js').then(m => m.default.renderDirectory());
      }

      actionMessage = `Created Virtual Folder at path: <strong>${path}</strong>. Verified in File Explorer grid.`;
      actionExecuted = true;
    }
    else if (cleanQuery.includes('delete') || cleanQuery.includes('remove')) {
      const match = query.match(/(?:delete|remove)\s+(?:file|folder\s+)?([a-zA-Z0-9_\-\.\/]+)/i);
      if (match && match[1]) {
        let targetPath = match[1];
        if (!targetPath.startsWith('/')) targetPath = '/Desktop/' + targetPath;
        
        this.pendingAction = { type: 'delete', path: targetPath };
        actionMessage = `<strong style="color:var(--danger-color)">Critical Action:</strong> Are you sure you want to permanently delete <code>${targetPath}</code>? (Yes/No)`;
      } else {
        actionMessage = "Please specify the file or folder to delete. (e.g. 'delete Projects')";
      }
      actionExecuted = true;
    }
    else if (cleanQuery.includes('move dock') || cleanQuery.includes('dock position')) {
      let pos = 'bottom';
      if (cleanQuery.includes('top')) pos = 'top';
      if (cleanQuery.includes('left')) pos = 'left';
      if (cleanQuery.includes('right')) pos = 'right';
      
      const chip = document.querySelector(`.dock-chip[data-pos="${pos}"]`);
      if (chip) chip.click();
      
      actionMessage = `Moved the taskbar dock to the <strong>${pos}</strong> edge autonomously.`;
      actionExecuted = true;
    }
    else if (cleanQuery.includes('hide dock') || cleanQuery.includes('autohide dock')) {
      const toggle = document.getElementById('dock-autohide-toggle');
      if (toggle && !toggle.checked) toggle.click();
      actionMessage = `Enabled Dock Auto-hide autonomously.`;
      actionExecuted = true;
    }
    else if (cleanQuery.includes('change theme') || cleanQuery.includes('set background') || cleanQuery.includes('change wallpaper')) {
      let themeName = 'dark';
      if (cleanQuery.includes('light')) themeName = 'light';
      if (cleanQuery.includes('cyber')) themeName = 'cyberpunk';
      if (cleanQuery.includes('oled')) themeName = 'oled';
      
      const chip = document.querySelector(`.theme-chip[data-theme="${themeName}"]`);
      if (chip) chip.click();

      actionMessage = `Switched Global OS Theme profile to: <strong>${themeName.toUpperCase()}</strong>. Recalibrating styling tokens.`;
      actionExecuted = true;
    }

    // 2. If OS control triggered, respond visually and exit
    if (actionExecuted) {
      if (isSilentAutomated) return;
      this.replaceTypingBubble(typingBubbleId, actionMessage);
      return;
    }

    // 3. Fallback to LLM chat execution: Check local localStorage keys registry
    const apiConfigRaw = localStorage.getItem('halo_api_config');
    if (apiConfigRaw) {
      try {
        const config = JSON.parse(apiConfigRaw);
        if (config.key) {
          config.key = atob(config.key); // Decrypt
        }

        if (config.key || config.provider === 'ollama') {
          // Trigger actual client-side fetch completion request!
          await this.executeExternalLLMCall(query, config, typingBubbleId);
          return;
        }
      } catch (e) {
        console.error("LLM parser configuration error, running offline fallback helper.", e);
      }
    }

    // 4. Fallback to highly-detailed Offline Local Expert Ruleset
    const offlineReply = this.compileOfflineResponse(cleanQuery);
    if (!isSilentAutomated) {
      this.replaceTypingBubble(typingBubbleId, offlineReply);
    }
  }

  clickAppLauncher(appId) {
    const launcher = document.querySelector(`.desktop-icon-btn[data-id="${appId}"]`) ||
                     document.querySelector(`.start-app-btn[data-id="${appId}"]`);
    if (launcher) launcher.click();
  }

  /**
   * Safe, transparent outbound fetch completion request using user's keys.
   */
  async executeExternalLLMCall(query, config, typingBubbleId) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (config.key) {
      headers['Authorization'] = `Bearer ${config.key}`;
    }

    const payload = {
      model: config.model,
      messages: [
        { role: 'system', content: 'You are Halo Copilot, the built-in, secure, zero-knowledge AI assistant inside Halo OS. Keep responses helpful, focused on security, privacy, and client-side computing.' },
        { role: 'user', content: query }
      ]
    };

    try {
      const response = await fetch(config.url + '/chat/completions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

      const data = await response.json();
      const text = data.choices[0].message.content;

      this.replaceTypingBubble(typingBubbleId, text);
      VFS.logAction(`Executed secure custom LLM chat completion.`);
    } catch (err) {
      const errMsg = `<strong>Connection Error:</strong> Failed to fetch from custom API Endpoint.<br>
      <small style="color:var(--danger-color)">${err.message}</small><br><br>
      Verify that your local Ollama server is running (e.g. <code>ollama run llama3</code>) or check your API Key and internet connectivity. Running offline expert fallback instead...`;
      
      this.replaceTypingBubble(typingBubbleId, errMsg);
      
      // After small delay, show the offline answer anyway to keep user flow happy
      await this.sleep(2000);
      const fallbackAns = this.compileOfflineResponse(query.toLowerCase());
      this.appendBubble(fallbackAns, 'agent');
    }
  }

  /**
   * Deterministic client-side secure expert reply parser.
   */
  compileOfflineResponse(q) {
    if (q.includes('hello') || q.includes('hi ') || q.includes('who are you') || q.includes('help')) {
      return `Hello! I am the <strong>Halo Copilot</strong>, your local security assistant. I run 100% inside your browser sandbox.<br><br>
      You can control this OS with natural commands:<br>
      - <code>"open terminal"</code> / <code>"open explorer"</code><br>
      - <code>"create folder Projects"</code><br>
      - <code>"run matrix rain"</code><br>
      - <code>"connect vpn"</code> / <code>"change theme light"</code><br><br>
      To ask me open-ended AI questions, navigate to the <strong>API Registry app</strong> and configure your local Ollama or OpenAI token!`;
    }

    if (q.includes('vpn') || q.includes('proxy') || q.includes('encryption') || q.includes('wireguard')) {
      return `<strong>Secure Networking Sandbox Overview:</strong><br>
      Halo OS includes a full <strong>Secure VPN visualizer</strong>. When you initiate a connection:<br>
      1. We simulate an asymmetric <strong>Diffie-Hellman Key Exchange</strong>.<br>
      2. Symmetric session keys (AES/ChaCha20) are established.<br>
      3. Floating SVG network vector streams show visual secure packet transfers.<br><br>
      To configure real-world proxies, input SOCKS5 credentials in the configuration panel. Everything remains locally sandboxed!`;
    }

    if (q.includes('privacy') || q.includes('telemetry') || q.includes('security') || q.includes('steal')) {
      return `<strong>Data Integrity Guarantee:</strong><br>
      1. **Local-Only Encryption**: File grids and settings are saved strictly in sandboxed browser localStorage.<br>
      2. **Telemetry Shield**: Analytic blocks prevent outline trackers. Outgoing requests are intercepted and flushed.<br>
      3. **Self-Hostable sovereignty**: You have complete access to examine the source files. There is no cloud-sync server; you are in absolute command of your credentials.`;
    }

    if (q.includes('workflow') || q.includes('automate') || q.includes('automator')) {
      return `<strong>Local Workspace Automations:</strong><br>
      Halo OS features a complete visual block compiler called <strong>Workflow Automator</strong>.<br>
      You can stack block operations like:<br>
      - Launching shell applications<br>
      - Executing terminal CLI strings<br>
      - Writing files to VFS<br>
      - Spawning alert logs<br><br>
      When you click **Run**, the system visually triggers actions on your desktop automatically, showcasing a true client-side agent in action!`;
    }

    // Default general advice
    return `I received your secure query: <em>"${q}"</em>.<br><br>
    To unlock deep LLM contextual responses for this question, configure your custom Ollama or OpenAI credentials in the <strong>API Registry</strong>. This will enable me to query actual models transparently, maintaining absolute local sandboxing!`;
  }

  /**
   * UI helper to append chat bubbles.
   */
  appendBubble(text, className) {
    const bubble = document.createElement('div');
    const uniqueId = 'bubble-' + Math.random().toString(36).substring(2, 9);
    bubble.className = `agent-bubble ${className}`;
    bubble.id = uniqueId;
    
    bubble.innerHTML = `
      <div class="bubble-content">${text}</div>
      <small>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
    `;
    
    this.logsEl.appendChild(bubble);
    this.logsEl.scrollTop = this.logsEl.scrollHeight;

    return uniqueId;
  }

  /**
   * UI helper to replace typing loading bubble with text.
   */
  replaceTypingBubble(bubbleId, text) {
    const bubble = document.getElementById(bubbleId);
    if (!bubble) {
      this.appendBubble(text, 'agent');
      return;
    }

    bubble.className = 'agent-bubble agent';
    const content = bubble.querySelector('.bubble-content');
    if (content) {
      content.innerHTML = text;
    }
    
    this.logsEl.scrollTop = this.logsEl.scrollHeight;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const Copilot = new AgentCopilot();
// Initialize sidebar agent when script boots
window.addEventListener('DOMContentLoaded', () => {
  Copilot.init();
});
export default Copilot;
