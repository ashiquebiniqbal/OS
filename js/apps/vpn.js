import { VFS } from '../fs.js';
import { WM } from '../wm.js';

/**
 * Halo OS Secure VPN & Cryptographic Tunnel Simulator
 * Visualizes simulated proxy nodes, Diffie-Hellman key handshakes, and SVG world maps with glowing data streams.
 */
class SecureVPNApp {
  constructor() {
    this.connectionState = 'disconnected'; // disconnected, handshaking, connected
    this.handshakeInterval = null;
    this.statsInterval = null;
    this.bandwidthOut = 0;
    this.bandwidthIn = 0;
    this.latency = 0;
  }

  launch() {
    const id = 'vpn';
    const contentHtml = `
      <div class="vpn-container">
        <!-- Sidebar Setup Form -->
        <div class="vpn-setup-panel">
          <h3>Tunnel Configuration</h3>
          
          <div class="form-group">
            <label>Tunnel Protocol</label>
            <select class="vpn-select" id="vpn-protocol">
              <option value="wireguard">WireGuard (ChaCha20)</option>
              <option value="socks5">SOCKS5 Proxy (Simulated)</option>
              <option value="tor">Multi-Hop Onion (Tor-Sim)</option>
            </select>
          </div>

          <div class="form-group" id="wg-config-group">
            <label>WireGuard Client Profile</label>
            <textarea class="vpn-textarea" id="vpn-wg-config" placeholder="[Interface]\\nPrivateKey = e3b0c442...\\nAddress = 10.0.0.2/32\\n\\n[Peer]\\nPublicKey = 4c546e30...\\nEndpoint = 192.168.1.1:51820"></textarea>
          </div>

          <button class="vpn-action-btn" id="vpn-connect-btn">Initiate Secure Tunnel</button>
          
          <div class="vpn-crypto-logs" id="vpn-crypto-logs">
            <div class="crypto-log-line opacity-5">Ready to initialize symmetric cipher...</div>
          </div>
        </div>

        <!-- Visual Interactive Tunnel Map -->
        <div class="vpn-visual-panel">
          <div class="visual-header">
            <span class="shield-tag" id="vpn-shield-tag">UNPROTECTED LINK</span>
            <span class="visual-metric" id="vpn-latency-metric">Latency: -- ms</span>
          </div>

          <!-- SVG Vector World Map Grid -->
          <div class="world-map-wrapper">
            <svg class="world-map-svg" viewBox="0 0 800 400" id="vpn-svg-map">
              <!-- Grid background lines -->
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.02)" stroke-width="1"/>
                </pattern>
                
                <!-- Glowing linear gradient for secure pathways -->
                <linearGradient id="glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ff007f" />
                  <stop offset="100%" stop-color="#00e5ff" />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              <!-- Vector outline world shapes -->
              <!-- Continent Paths (Sleek minimalist representation) -->
              <path class="map-continent" d="M120,80 L200,80 L220,120 L280,100 L240,180 L180,240 L160,280 L130,220 L100,160 Z" />
              <path class="map-continent" d="M380,60 L460,50 L520,80 L560,140 L480,260 L440,240 L380,180 Z" />
              <path class="map-continent" d="M420,240 L500,280 L520,320 L480,360 Z" />
              <path class="map-continent" d="M600,120 L680,80 L760,140 L700,280 L620,220 Z" />
              
              <!-- Connection Pathway line (Dynamic loaded) -->
              <path class="tunnel-path hidden" id="tunnel-path-svg" d="M180,120 Q320,60 480,110 T680,160" />

              <!-- SVG Interactive Server Nodes -->
              <!-- Client node -->
              <g class="node-group" id="node-local" transform="translate(180, 120)">
                <circle class="node-glow" r="14" />
                <circle class="node-core client" r="6" />
                <text y="-18" class="node-label">Local Host</text>
              </g>

              <!-- Relaying Secure Server (e.g. Zurich) -->
              <g class="node-group" id="node-relay" transform="translate(450, 100)">
                <circle class="node-glow" r="14" />
                <circle class="node-core server" r="6" />
                <text y="-18" class="node-label">Sovereign Relay</text>
              </g>

              <!-- Target Secure Target (e.g. Reykjavik) -->
              <g class="node-group" id="node-target" transform="translate(680, 160)">
                <circle class="node-glow" r="14" />
                <circle class="node-core target" r="6" />
                <text y="-18" class="node-label">Target Sandbox</text>
              </g>
            </svg>
          </div>

          <!-- Bottom Realtime Connection stats graphs -->
          <div class="vpn-stats-panel">
            <div class="stat-box">
              <span class="stat-label">BANDWIDTH OUT</span>
              <strong class="stat-value" id="vpn-stat-out">0.00 KB/s</strong>
            </div>
            <div class="stat-box">
              <span class="stat-label">BANDWIDTH IN</span>
              <strong class="stat-value" id="vpn-stat-in">0.00 KB/s</strong>
            </div>
            <div class="stat-box">
              <span class="stat-label">CIPHER SYSTEM</span>
              <strong class="stat-value" id="vpn-stat-cipher">NONE (CLEAR TEXT)</strong>
            </div>
          </div>
        </div>
      </div>
    `;

    WM.createWindow({
      id,
      title: 'Halo VPN & Secure Tunnel Simulator',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
      width: 760,
      height: 460,
      contentHtml
    });

    this.setupStyles();
    this.bindEvents();
    this.syncUIState();
  }

  bindEvents() {
    const connectBtn = document.getElementById('vpn-connect-btn');
    if (!connectBtn) return;

    connectBtn.addEventListener('click', () => {
      if (this.connectionState === 'disconnected') {
        this.startHandshake();
      } else {
        this.disconnectTunnel();
      }
    });

    // Handle Protocol selections to show appropriate help text
    const protocolSelect = document.getElementById('vpn-protocol');
    const wgGroup = document.getElementById('wg-config-group');
    protocolSelect.addEventListener('change', (e) => {
      if (e.target.value === 'wireguard') {
        wgGroup.style.display = 'block';
      } else {
        wgGroup.style.display = 'none';
      }
    });
  }

  syncUIState() {
    const connectBtn = document.getElementById('vpn-connect-btn');
    const shieldTag = document.getElementById('vpn-shield-tag');
    const pathSvg = document.getElementById('tunnel-path-svg');
    const cipherVal = document.getElementById('vpn-stat-cipher');
    const logs = document.getElementById('vpn-crypto-logs');
    
    if (!connectBtn) return;

    if (this.connectionState === 'disconnected') {
      connectBtn.innerText = 'Initiate Secure Tunnel';
      connectBtn.className = 'vpn-action-btn';
      
      shieldTag.innerText = 'UNPROTECTED LINK';
      shieldTag.className = 'shield-tag red';
      
      pathSvg.classList.add('hidden');
      cipherVal.innerText = 'NONE (CLEAR TEXT)';
    } else if (this.connectionState === 'handshaking') {
      connectBtn.innerText = 'Handshaking...';
      connectBtn.className = 'vpn-action-btn warning';
      
      shieldTag.innerText = 'HANDSHAKING';
      shieldTag.className = 'shield-tag warning';
      
      pathSvg.classList.add('hidden');
    } else if (this.connectionState === 'connected') {
      connectBtn.innerText = 'Disconnect Tunnel';
      connectBtn.className = 'vpn-action-btn active';
      
      shieldTag.innerText = 'TUNNEL SECURED';
      shieldTag.className = 'shield-tag green';
      
      pathSvg.classList.remove('hidden');
      
      const proto = document.getElementById('vpn-protocol').value;
      if (proto === 'wireguard') {
        cipherVal.innerText = 'ChaCha20-Poly1305';
      } else if (proto === 'socks5') {
        cipherVal.innerText = 'SOCKS5 Encrypted';
      } else {
        cipherVal.innerText = 'AES-256 Multi-Hop';
      }
    }
  }

  /**
   * Cryptographic Handshake Simulation sequence.
   */
  startHandshake() {
    this.connectionState = 'handshaking';
    this.syncUIState();

    const logs = document.getElementById('vpn-crypto-logs');
    logs.innerHTML = '';

    const logLines = [
      { text: "[INIT] Starting tunnel connection request...", delay: 200 },
      { text: "[KEYGEN] Creating local Ephemeral Key Pair...", delay: 600 },
      { text: "[DH-KEY] SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", delay: 1000 },
      { text: "[HANDSHAKE] Sending cipher handshake packet to relay node...", delay: 1400 },
      { text: "[DH-EXCH] Diffie-Hellman cryptographic exchange initialized...", delay: 2000 },
      { text: "[VERIFY] Handshake verified with sovereign relay node (Zurich).", delay: 2500 },
      { text: "[ROUTING] Binding secure UDP endpoints to Reykjavik...", delay: 3000 },
      { text: "[CONNECTED] Tunnel established successfully.", delay: 3400 }
    ];

    logLines.forEach(line => {
      setTimeout(() => {
        if (this.connectionState !== 'handshaking') return;
        
        const lineEl = document.createElement('div');
        lineEl.className = 'crypto-log-line';
        lineEl.innerText = line.text;
        logs.appendChild(lineEl);
        logs.scrollTop = logs.scrollHeight;

        if (line.text.startsWith('[CONNECTED]')) {
          this.connectionState = 'connected';
          this.syncUIState();
          this.startRealtimeStats();
          VFS.logAction("Secure VPN Tunnel established successfully.");
        }
      }, line.delay);
    });
  }

  /**
   * Live statistics updates (throughput and latency).
   */
  startRealtimeStats() {
    const outVal = document.getElementById('vpn-stat-out');
    const inVal = document.getElementById('vpn-stat-in');
    const latencyVal = document.getElementById('vpn-latency-metric');

    this.statsInterval = setInterval(() => {
      if (this.connectionState !== 'connected') {
        clearInterval(this.statsInterval);
        return;
      }

      this.bandwidthOut = (Math.random() * 200 + 50).toFixed(2);
      this.bandwidthIn = (Math.random() * 800 + 200).toFixed(2);
      this.latency = Math.floor(Math.random() * 10 + 25);

      if (outVal) outVal.innerText = `${this.bandwidthOut} KB/s`;
      if (inVal) inVal.innerText = `${this.bandwidthIn} KB/s`;
      if (latencyVal) latencyVal.innerText = `Latency: ${this.latency} ms`;
    }, 1000);
  }

  disconnectTunnel() {
    clearInterval(this.statsInterval);
    this.connectionState = 'disconnected';
    this.syncUIState();
    
    const logs = document.getElementById('vpn-crypto-logs');
    logs.innerHTML = '<div class="crypto-log-line opacity-5">Tunnel disconnected safely. Sockets flushed.</div>';
    
    const latencyVal = document.getElementById('vpn-latency-metric');
    if (latencyVal) latencyVal.innerText = 'Latency: -- ms';

    document.getElementById('vpn-stat-out').innerText = '0.00 KB/s';
    document.getElementById('vpn-stat-in').innerText = '0.00 KB/s';
    
    VFS.logAction("Secure VPN Tunnel terminated.");
  }

  setupStyles() {
    if (document.getElementById('vpn-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'vpn-dynamic-style';
    style.textContent = `
      .vpn-container {
        display: flex;
        height: 100%;
        color: var(--text-primary);
      }
      
      /* Config Sidebar */
      .vpn-setup-panel {
        width: 250px;
        min-width: 250px;
        background: rgba(0, 0, 0, 0.2);
        border-right: 1px solid var(--panel-border);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .vpn-setup-panel h3 {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.6px;
        border-bottom: 1px solid var(--panel-border);
        padding-bottom: 8px;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .form-group label {
        font-size: 10px;
        font-weight: 700;
        color: var(--text-secondary);
        text-transform: uppercase;
      }
      .vpn-select {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--panel-border);
        color: var(--text-primary);
        border-radius: 8px;
        padding: 8px;
        font-family: var(--font-family-sans);
        font-size: 11px;
        outline: none;
      }
      .vpn-textarea {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--panel-border);
        color: var(--font-family-mono);
        color: var(--text-primary);
        border-radius: 8px;
        padding: 8px;
        height: 110px;
        resize: none;
        font-family: var(--font-family-mono);
        font-size: 9px;
        outline: none;
      }
      .vpn-action-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--panel-border);
        color: var(--text-primary);
        padding: 10px;
        border-radius: 10px;
        font-family: var(--font-family-sans);
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .vpn-action-btn:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .vpn-action-btn.warning {
        background: rgba(255, 204, 0, 0.1);
        border-color: var(--warning-color);
        color: var(--warning-color);
      }
      .vpn-action-btn.active {
        background: rgba(255, 59, 48, 0.15);
        border-color: var(--danger-color);
        color: var(--danger-color);
      }
      
      .vpn-crypto-logs {
        flex-grow: 1;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        padding: 10px;
        font-family: var(--font-family-mono);
        font-size: 9px;
        color: var(--text-secondary);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .crypto-log-line {
        line-height: 1.4;
      }
      
      /* Visual Map Section */
      .vpn-visual-panel {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
      }
      .visual-header {
        height: 42px;
        padding: 0 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(0, 0, 0, 0.1);
        border-bottom: 1px solid var(--panel-border);
      }
      .shield-tag {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.6px;
        padding: 4px 10px;
        border-radius: 20px;
        border: 1px solid transparent;
      }
      .shield-tag.red {
        background: rgba(255, 59, 48, 0.12);
        color: var(--danger-color);
        border-color: rgba(255, 59, 48, 0.2);
        box-shadow: 0 0 10px rgba(255, 59, 48, 0.1);
      }
      .shield-tag.warning {
        background: rgba(255, 204, 0, 0.12);
        color: var(--warning-color);
        border-color: rgba(255, 204, 0, 0.2);
      }
      .shield-tag.green {
        background: rgba(52, 199, 89, 0.12);
        color: var(--success-color);
        border-color: rgba(52, 199, 89, 0.2);
        box-shadow: 0 0 10px rgba(52, 199, 89, 0.15);
      }
      .visual-metric {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
      }
      
      .world-map-wrapper {
        flex-grow: 1;
        background: rgba(0, 0, 0, 0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      
      .world-map-svg {
        width: 100%;
        height: 100%;
        max-height: 280px;
      }
      
      .map-continent {
        fill: rgba(255, 255, 255, 0.04);
        stroke: rgba(255, 255, 255, 0.06);
        stroke-width: 1;
        transition: all 0.5s ease;
      }
      
      .node-glow {
        fill: none;
        stroke: var(--accent-color);
        stroke-width: 1.5;
        opacity: 0.15;
        animation: pulse 2s infinite ease-in-out;
      }
      
      .node-core {
        stroke-width: 2;
      }
      .node-core.client { fill: #ff007f; stroke: #ff007f; }
      .node-core.server { fill: #ffcc00; stroke: #ffcc00; }
      .node-core.target { fill: #39ff14; stroke: #39ff14; }
      
      .node-label {
        font-size: 8px;
        font-weight: 700;
        fill: var(--text-secondary);
        text-anchor: middle;
        text-transform: uppercase;
      }
      
      .tunnel-path {
        fill: none;
        stroke: url(#glow-grad);
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-dasharray: 8 6;
        animation: stream 15s linear infinite;
        filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.5));
      }
      
      @keyframes pulse {
        0% { transform: scale(0.8); opacity: 0.4; }
        50% { transform: scale(1.6); opacity: 0.05; }
        100% { transform: scale(0.8); opacity: 0.4; }
      }
      
      @keyframes stream {
        from { stroke-dashoffset: 200; }
        to { stroke-dashoffset: 0; }
      }
      
      .vpn-stats-panel {
        height: 60px;
        border-top: 1px solid var(--panel-border);
        background: rgba(0, 0, 0, 0.1);
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        align-items: center;
        padding: 0 16px;
      }
      .stat-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-right: 1px dashed var(--panel-border);
      }
      .stat-box:last-child {
        border-right: none;
      }
      .stat-label {
        font-size: 9px;
        font-weight: 700;
        color: var(--text-secondary);
      }
      .stat-value {
        font-size: 12px;
        font-weight: 700;
        color: var(--text-primary);
      }
    `;
    document.head.appendChild(style);
  }
}

export const VPN = new SecureVPNApp();
export default VPN;
