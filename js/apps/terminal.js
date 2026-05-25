import { VFS } from '../fs.js';
import { WM } from '../wm.js';

/**
 * Halo OS Sandboxed Interactive Terminal
 * Complete command parser with persisted history, tab completion, and a live canvas Matrix screensaver.
 */
class TerminalApp {
  constructor() {
    this.history = [];
    this.historyIndex = -1;
    this.currentDir = '/Desktop';
    this.matrixInterval = null;
    this.HISTORY_PATH = '/System/terminal_history.json';
    this.HISTORY_CAP = 200;
  }

  launch() {
    const id = 'terminal';
    this._loadHistory();
    const contentHtml = `
      <div class="terminal-container" id="terminal-container">
        <!-- Terminal Scrolling Output -->
        <div class="terminal-output" id="terminal-output">
          <div class="term-line welcome">HALO PRIVACY TERMINAL v1.0.0 (Zero-Knowledge Node)</div>
          <div class="term-line welcome">Type 'help' to list available command utilities.</div>
          <br>
        </div>
        
        <!-- Interactive Prompt Panel -->
        <div class="terminal-prompt-line">
          <span class="terminal-prompt">sandbox@halo:${this.currentDir}$</span>
          <input type="text" class="terminal-input" id="terminal-input" autocomplete="off" spellcheck="false">
        </div>

        <!-- Matrix Screensaver Canvas (Hidden by default) -->
        <canvas class="matrix-canvas hidden" id="matrix-canvas"></canvas>
      </div>
    `;

    WM.createWindow({
      id,
      title: 'Halo Shell Terminal',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
      width: 620,
      height: 420,
      contentHtml
    });

    this.setupStyles();
    this.bindEvents();
    this.focusInput();
    WM.onClose(id, () => this._teardown());
  }

  _loadHistory() {
    try {
      const raw = VFS.read(this.HISTORY_PATH);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.history = parsed.slice(-this.HISTORY_CAP);
      }
    } catch (e) { /* malformed history; ignore */ }
    this.historyIndex = this.history.length;
  }

  _saveHistory() {
    try {
      if (!VFS.exists('/System')) VFS.mkdir('/System');
      const trimmed = this.history.slice(-this.HISTORY_CAP);
      VFS.write(this.HISTORY_PATH, JSON.stringify(trimmed));
    } catch (e) { /* VFS unavailable */ }
  }

  _teardown() {
    if (this.matrixInterval) {
      clearInterval(this.matrixInterval);
      this.matrixInterval = null;
    }
    this._saveHistory();
  }

  focusInput() {
    const input = document.getElementById('terminal-input');
    if (input) input.focus();
  }

  bindEvents() {
    const container = document.getElementById('terminal-container');
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    
    if (!input || !container) return;

    // Focus input on console background click
    container.addEventListener('click', () => {
      if (!document.getElementById('matrix-canvas').classList.contains('hidden')) {
        this.stopMatrixRain(); // Exit matrix on click
      } else {
        input.focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim();
        input.value = '';
        if (cmd) {
          // Don't add consecutive duplicates
          if (this.history[this.history.length - 1] !== cmd) {
            this.history.push(cmd);
            if (this.history.length > this.HISTORY_CAP) this.history.shift();
            this._saveHistory();
          }
          this.historyIndex = this.history.length;
          this.executeCommand(cmd);
        } else {
          this.writeLine(`sandbox@halo:${this.currentDir}$`);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.history.length > 0 && this.historyIndex > 0) {
          this.historyIndex--;
          input.value = this.history[this.historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          input.value = this.history[this.historyIndex];
        } else {
          this.historyIndex = this.history.length;
          input.value = '';
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.handleAutocomplete(input);
      } else if (e.key === 'Escape') {
        // Exit matrix rain if active
        this.stopMatrixRain();
      }
    });
  }

  writeLine(text, type = 'output') {
    const output = document.getElementById('terminal-output');
    if (!output) return;

    const line = document.createElement('div');
    line.className = `term-line term-${type}`;
    
    // Support basic HTML formatting securely (replaces < and > except safe code highlights)
    if (type === 'raw-html') {
      line.innerHTML = text;
    } else {
      line.textContent = text;
    }
    
    output.appendChild(line);
    
    // Scroll container down
    const container = output.parentElement;
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Evaluates console inputs.
   */
  async executeCommand(rawCmd) {
    const output = document.getElementById('terminal-output');
    const promptInput = document.getElementById('terminal-input');
    
    this.writeLine(`sandbox@halo:${this.currentDir}$ ${rawCmd}`, 'prompt-echo');
    
    const parts = rawCmd.split(' ').filter(p => p !== '');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        this.writeLine(`Halo Terminal Shell - Built-in Commands:
  help               Show this information menu
  ls [path]          List directory items
  cd <dir>           Change active path
  cat <file>         Print file contents
  mkdir <dir>        Create virtual folder
  touch <file>       Create virtual empty file
  rm <path>          Delete file/folder recursively
  neofetch           System banner specifications
  sysinfo            Sandbox security audit
  open <app>         Launches workspace apps directly
  clear              Empty console terminal
  matrix             Trigger full-canvas retro Matrix rain (Esc to close)`, 'info');
        break;

      case 'clear':
        if (output) output.innerHTML = '';
        break;

      case 'ls':
        const targetPath = args[0] ? this.resolvePath(args[0]) : this.currentDir;
        if (VFS.exists(targetPath)) {
          const items = VFS.ls(targetPath);
          if (items.length === 0) {
            this.writeLine("Empty Directory.");
          } else {
            const formatted = items.map(item => {
              const color = item.type === 'dir' ? '#00e5ff' : '#f4f7fa';
              return `<span style="color:${color}; font-weight:700; margin-right:16px;">${item.name}${item.type === 'dir' ? '/' : ''}</span>`;
            }).join('');
            this.writeLine(formatted, 'raw-html');
          }
        } else {
          this.writeLine(`ls: cannot access '${args[0]}': No such file or directory`, 'error');
        }
        break;

      case 'cd':
        if (!args[0]) {
          this.currentDir = '/';
        } else {
          const target = this.resolvePath(args[0]);
          if (VFS.exists(target) && VFS.fs[target].type === 'dir') {
            this.currentDir = target;
          } else {
            this.writeLine(`cd: no such directory: ${args[0]}`, 'error');
          }
        }
        // Update prompt text label
        const promptLabel = document.querySelector('.terminal-prompt');
        if (promptLabel) promptLabel.innerText = `sandbox@halo:${this.currentDir}$`;
        break;

      case 'cat':
        if (!args[0]) {
          this.writeLine("cat: missing file argument", "error");
        } else {
          const file = this.resolvePath(args[0]);
          if (VFS.exists(file) && VFS.fs[file].type === 'file') {
            const content = VFS.read(file);
            this.writeLine(content);
          } else {
            this.writeLine(`cat: ${args[0]}: No such file`, 'error');
          }
        }
        break;

      case 'mkdir':
        if (!args[0]) {
          this.writeLine("mkdir: missing directory name", "error");
        } else {
          const folderPath = this.resolvePath(args[0]);
          if (VFS.mkdir(folderPath)) {
            this.writeLine(`Directory created: ${folderPath}`);
          } else {
            this.writeLine("mkdir: failed to create folder (already exists)", "error");
          }
        }
        break;

      case 'touch':
        if (!args[0]) {
          this.writeLine("touch: missing file argument", "error");
        } else {
          const filePath = this.resolvePath(args[0]);
          if (VFS.write(filePath, `// File: ${args[0]}\nCreated strictly client-side.`)) {
            this.writeLine(`File created: ${filePath}`);
          } else {
            this.writeLine("touch: failed to write file", "error");
          }
        }
        break;

      case 'rm':
        if (!args[0]) {
          this.writeLine("rm: missing operand", "error");
        } else {
          const delPath = this.resolvePath(args[0]);
          if (VFS.rm(delPath)) {
            this.writeLine(`Successfully deleted recursively: ${delPath}`);
          } else {
            this.writeLine(`rm: failed to remove '${args[0]}': Path does not exist`, "error");
          }
        }
        break;

      case 'neofetch':
        const asciiLogo = `
<pre style="color:#00e5ff; font-weight:700; line-height:1.2; font-family:var(--font-family-mono); float:left; margin-right:20px;">
      /\\
     /  \\
    /____\\
   /\\    /\\
  /  \\  /  \\
 /____\\/____\\
 \\    /\\    /
  \\  /  \\  /
   \\/____\\/
</pre>
<div style="font-family:var(--font-family-mono); line-height:1.6;">
  <strong style="color:#ff007f;">sandbox@halo-os</strong><br>
  ---------------------<br>
  <strong>OS:</strong> Halo Agentic Privacy Sandbox v1.0.0<br>
  <strong>Kernel:</strong> Web Client SPA ES6 Engine<br>
  <strong>Terminal:</strong> CRT XTerm Emulation Node<br>
  <strong>Display:</strong> ${window.innerWidth}x${window.innerHeight} Sandboxed Canvas<br>
  <strong>Memory:</strong> 100% Sovereign (localStorage persistent)<br>
  <strong>Telemetry:</strong> <span style="color:#39ff14; font-weight:700;">BLOCK_ALL (Shield Active)</span>
</div>
<div style="clear:both;"></div>
`;
        this.writeLine(asciiLogo, 'raw-html');
        break;

      case 'sysinfo':
        this.writeLine(`=============================================
 HALO PRIVACY SANDBOX SECURITY SYSTEM DIAGNOSTIC
=============================================
* TELEMETRY POLICY: REJECT OUTBOUND PINGS
* STORAGE PARTITION: isolated Client localStorage
* ENCRYPTION ALGORITHMS: SOCKS5 Simulated / Local Base64 Vault
* ACTIVE PORTS: [Simulated] 443 Encrypted, 22 Local Shell
* SANDBOX ISOLATION: True (Iframe Boundary locks)
=============================================`, 'info');
        break;

      case 'open':
        if (!args[0]) {
          this.writeLine("open: specify application name (e.g. explorer, notepad, settings)", "error");
        } else {
          const appName = args[0].toLowerCase();
          // Look up app from global list
          const launcher = document.querySelector(`.desktop-icon-btn[data-id="${appName}"]`) ||
                           document.querySelector(`.start-app-btn[data-id="${appName}"]`);
          if (launcher) {
            this.writeLine(`Spawning workspace app: ${appName}...`);
            launcher.click();
          } else {
            this.writeLine(`open: application '${appName}' not found in registry`, 'error');
          }
        }
        break;

      case 'matrix':
        this.startMatrixRain();
        break;

      default:
        this.writeLine(`halo: command not found: ${cmd}. Type 'help' to review utils.`, 'error');
    }
  }

  resolvePath(path) {
    if (path.startsWith("/")) return path;
    if (this.currentDir === "/") return "/" + path;
    return this.currentDir + "/" + path;
  }

  /**
   * Terminal command string Tab auto-complete.
   */
  handleAutocomplete(input) {
    const text = input.value.trim();
    const parts = text.split(' ');
    if (parts.length === 0) return;

    const cmd = parts[0];
    const arg = parts.slice(1).join(' ');

    if (parts.length === 1) {
      // Complete commands
      const commands = ['help', 'ls', 'cd', 'cat', 'mkdir', 'touch', 'rm', 'neofetch', 'sysinfo', 'open', 'clear', 'matrix'];
      const matches = commands.filter(c => c.startsWith(cmd));
      if (matches.length === 1) {
        input.value = matches[0] + ' ';
      }
    } else {
      // Complete VFS folder/file items
      const items = VFS.ls(this.currentDir);
      const matches = items.filter(item => item.name.startsWith(arg));
      if (matches.length === 1) {
        input.value = `${cmd} ${matches[0].name}`;
      }
    }
  }

  /**
   * High-Performance Canvas Matrix digital rain screensaver.
   */
  startMatrixRain() {
    const canvas = document.getElementById('matrix-canvas');
    const inputLine = document.querySelector('.terminal-prompt-line');
    const output = document.getElementById('terminal-output');
    
    if (!canvas) return;

    canvas.classList.remove('hidden');
    inputLine.style.display = 'none';
    output.style.display = 'none';

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    const katakana = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const alphabet = katakana.split("");

    const fontSize = 12;
    const columns = canvas.width / fontSize;

    const rainDrops = [];
    for (let x = 0; x < columns; x++) {
      rainDrops[x] = 1;
    }

    const draw = () => {
      // Semi-transparent black overlay to leave trails
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#39ff14'; // Bright green glowing Matrix text
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet[Math.floor(Math.random() * alphabet.length)];
        ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);

        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
    };

    this.matrixInterval = setInterval(draw, 30);
  }

  stopMatrixRain() {
    const canvas = document.getElementById('matrix-canvas');
    const inputLine = document.querySelector('.terminal-prompt-line');
    const output = document.getElementById('terminal-output');
    
    if (!canvas || canvas.classList.contains('hidden')) return;

    clearInterval(this.matrixInterval);
    canvas.classList.add('hidden');
    inputLine.style.display = 'flex';
    output.style.display = 'block';
    
    // Focus terminal input
    this.focusInput();
    this.writeLine("Exited digital rain screensaver.");
  }

  setupStyles() {
    if (document.getElementById('terminal-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'terminal-dynamic-style';
    style.textContent = `
      .terminal-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #0c0f13;
        font-family: var(--font-family-mono);
        color: #f4f7fa;
        padding: 12px;
        position: relative;
        overflow: hidden;
      }
      .terminal-output {
        flex-grow: 1;
        overflow-y: auto;
        font-size: 12px;
        line-height: 1.6;
        margin-bottom: 8px;
        scrollbar-width: thin;
      }
      .term-line {
        white-space: pre-wrap;
        margin-bottom: 2px;
      }
      .term-welcome { color: var(--text-secondary); }
      .term-prompt-echo { color: var(--text-secondary); font-weight: 500; }
      .term-info { color: #88ff88; }
      .term-error { color: var(--danger-color); font-weight: 600; }
      
      .terminal-prompt-line {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 24px;
        border-top: 1px dashed rgba(255,255,255,0.06);
        padding-top: 8px;
      }
      .terminal-prompt {
        font-size: 12px;
        color: var(--accent-color);
        font-weight: 700;
        white-space: nowrap;
      }
      .terminal-input {
        flex-grow: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #f4f7fa;
        font-family: var(--font-family-mono);
        font-size: 12px;
      }
      
      .matrix-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999;
        background-color: transparent;
        cursor: pointer;
      }
      .hidden {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

export const Terminal = new TerminalApp();
export default Terminal;
