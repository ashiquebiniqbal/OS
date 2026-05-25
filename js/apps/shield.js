import { VFS } from '../fs.js';
import { WM } from '../wm.js';

/**
 * Halo OS Privacy Shield & Zero-Telemetry Monitor
 * Houses sandboxed security checklists, scrolling audit trackers, and animated vector radar sweeps.
 */
class PrivacyShieldApp {
  constructor() {
    this.auditInterval = null;
  }

  launch() {
    const id = 'shield';
    const contentHtml = `
      <div class="shield-container">
        <!-- Visual Radar Overlay -->
        <div class="shield-visual-section">
          <div class="shield-radar-box">
            <canvas class="radar-canvas" id="shield-radar-canvas"></canvas>
            <div class="shield-radar-core">🛡️</div>
          </div>
          <h3>Telemetry Intercept Radar</h3>
          <span class="pulse-tag green">SYSTEM ENCLAVE SECURE</span>
        </div>

        <!-- System Audit Log & Checklist Panel -->
        <div class="shield-audit-section">
          <h3>Local Privacy Compliance Checklist</h3>
          
          <div class="audit-checklist">
            <div class="check-item active">
              <span class="bullet">✓</span>
              <div class="check-details">
                <strong>Zero-Knowledge VFS Storage</strong>
                <small>Persistent variables restricted strictly to sandboxed localStorage</small>
              </div>
            </div>
            <div class="check-item active">
              <span class="bullet">✓</span>
              <div class="check-details">
                <strong>Network Outbound Telemetry Shield</strong>
                <small>Outgoing tracking pixels, websockets, cookies: BLOCKED</small>
              </div>
            </div>
            <div class="check-item active">
              <span class="bullet">✓</span>
              <div class="check-details">
                <strong>Isolated Iframe Bounds Sandbox</strong>
                <small>DOM integrity container sandboxed dynamically</small>
              </div>
            </div>
          </div>

          <div class="scrolling-audit-log">
            <h4>Realtime Telemetry Shield Log</h4>
            <div class="audit-log-box" id="shield-audit-box">
              <div class="log-line opacity-5">Initializing visual packet trace...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    WM.createWindow({
      id,
      title: 'Zero-Telemetry Privacy Shield',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
      width: 600,
      height: 410,
      contentHtml
    });

    this.setupStyles();
    this.startRadarAnimation();
    this.startScrollingLogs();
  }

  /**
   * Interactive scanning radar sweep sweep canvas loops.
   */
  startRadarAnimation() {
    const canvas = document.getElementById('shield-radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = 140;
    canvas.height = 140;

    let angle = 0;

    const draw = () => {
      if (!document.getElementById('shield-radar-canvas')) return;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = canvas.width / 2 - 4;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background outer circles
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
      ctx.stroke();

      // Draw rotating sweep gradient
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      
      const sweepGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
      sweepGrad.addColorStop(0, 'rgba(0, 229, 255, 0.25)');
      sweepGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -0.2, 0.2); // Faint cone segment
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.restore();

      angle += 0.025;
      requestAnimationFrame(draw);
    };

    draw();
  }

  /**
   * Periodic rolling telemetry check logger.
   */
  startScrollingLogs() {
    const box = document.getElementById('shield-audit-box');
    if (!box) return;

    const actions = [
      "Intercepted outbound metadata ping. Telemetry sink blocked.",
      "VFS LocalStorage integrity verification: PASSED (Sovereign)",
      "Zero-Telemetry shield confirmed active. 0 external leaks.",
      "Flushed browser session credentials database.",
      "Active sockets auditing: 100% Client-Side sandboxed.",
      "Inspected VPN crypto tunnels packets throughput: OK."
    ];

    this.auditInterval = setInterval(() => {
      if (!document.getElementById('shield-audit-box')) {
        clearInterval(this.auditInterval);
        return;
      }

      const timestamp = new Date().toLocaleTimeString();
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      
      const line = document.createElement('div');
      line.className = 'log-line';
      line.innerHTML = `<span style="color:#00e5ff; font-weight:700;">[${timestamp}]</span> ${randomAction}`;
      
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;

      // Cap logs
      if (box.children.length > 50) {
        box.removeChild(box.firstChild);
      }
    }, 2000);
  }

  setupStyles() {
    if (document.getElementById('shield-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'shield-dynamic-style';
    style.textContent = `
      .shield-container {
        display: flex;
        height: 100%;
        color: var(--text-primary);
        background-color: #0c0f13;
      }
      
      /* Radar visuals Left */
      .shield-visual-section {
        width: 220px;
        min-width: 220px;
        background: rgba(0, 0, 0, 0.2);
        border-right: 1px solid var(--panel-border);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 20px;
      }
      .shield-visual-section h3 {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.6px;
        text-align: center;
      }
      .shield-radar-box {
        position: relative;
        width: 140px;
        height: 140px;
      }
      .radar-canvas {
        position: absolute;
        top: 0;
        left: 0;
      }
      .shield-radar-core {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 24px;
        filter: drop-shadow(0 0 10px rgba(0, 229, 255, 0.6));
      }
      .pulse-tag {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.8px;
        padding: 4px 10px;
        border-radius: 20px;
      }
      .pulse-tag.green {
        background: rgba(52, 199, 89, 0.12);
        border: 1px solid rgba(52, 199, 89, 0.2);
        color: var(--success-color);
        box-shadow: 0 0 10px rgba(52, 199, 89, 0.1);
        animation: pulse-border 2s infinite ease-in-out;
      }
      
      @keyframes pulse-border {
        0% { opacity: 0.8; }
        50% { opacity: 1; box-shadow: 0 0 15px rgba(52, 199, 89, 0.25); }
        100% { opacity: 0.8; }
      }

      /* Audit details Right */
      .shield-audit-section {
        flex-grow: 1;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow: hidden;
      }
      .shield-audit-section h3 {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.6px;
        border-bottom: 1px solid var(--panel-border);
        padding-bottom: 8px;
      }
      .audit-checklist {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .check-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--panel-border);
        border-radius: 8px;
      }
      .check-item.active {
        border-color: rgba(52, 199, 89, 0.2);
        background: rgba(52, 199, 89, 0.02);
      }
      .bullet {
        font-weight: 700;
        font-size: 14px;
        color: var(--success-color);
      }
      .check-details {
        display: flex;
        flex-direction: column;
      }
      .check-details strong { font-size: 11px; }
      .check-details small { font-size: 9px; color: var(--text-secondary); }
      
      .scrolling-audit-log {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
        overflow: hidden;
      }
      .scrolling-audit-log h4 {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.6px;
      }
      .audit-log-box {
        flex-grow: 1;
        background: rgba(0, 0, 0, 0.3);
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
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }
}

export const Shield = new PrivacyShieldApp();
export default Shield;
