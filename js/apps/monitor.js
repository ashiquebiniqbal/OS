import { VFS } from '../fs.js';
import { WM } from '../wm.js';

/**
 * Halo OS Task Manager & Performance Monitor
 * Provides live canvas metrics plotting and active process termination bounds.
 */
class TaskManagerApp {
  constructor() {
    this.animationId = null;
    this.historyLength = 50;
    this.cpuHistory = Array(this.historyLength).fill(15);
    this.ramHistory = Array(this.historyLength).fill(40);
  }

  launch() {
    const id = 'monitor';
    const contentHtml = `
      <div class="monitor-container">
        <!-- Live Graph Monitors -->
        <div class="monitor-graphs">
          <div class="graph-card">
            <div class="card-header">
              <span>CPU UTILIZATION</span>
              <strong id="cpu-metric-val">15%</strong>
            </div>
            <canvas class="monitor-canvas" id="monitor-cpu-canvas"></canvas>
          </div>
          <div class="graph-card">
            <div class="card-header">
              <span>RAM ALLOCATION</span>
              <strong id="ram-metric-val">42%</strong>
            </div>
            <canvas class="monitor-canvas" id="monitor-ram-canvas"></canvas>
          </div>
        </div>

        <!-- Processes List -->
        <div class="monitor-processes">
          <h3>Active Sandboxed Processes</h3>
          <div class="process-table-wrapper">
            <table class="process-table">
              <thead>
                <tr>
                  <th>Process Name</th>
                  <th style="width: 70px; text-align: center;">PID</th>
                  <th style="width: 80px; text-align: right;">CPU</th>
                  <th style="width: 80px; text-align: right;">Mem</th>
                  <th style="width: 90px; text-align: center;">Action</th>
                </tr>
              </thead>
              <tbody id="monitor-process-rows">
                <!-- Dynamic processes row tags -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    WM.createWindow({
      id,
      title: 'Task Manager',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
      width: 520,
      height: 400,
      contentHtml
    });

    this.setupStyles();
    this.startPerformancePlots();
    this.syncProcessesTable();
    
    // Bind WM state changes to update the processes list dynamically
    WM.onStateChange(() => this.syncProcessesTable());
  }

  /**
   * Performance metrics graph drawing loops.
   */
  startPerformancePlots() {
    const cpuCanvas = document.getElementById('monitor-cpu-canvas');
    const ramCanvas = document.getElementById('monitor-ram-canvas');
    const cpuVal = document.getElementById('cpu-metric-val');
    const ramVal = document.getElementById('ram-metric-val');
    
    if (!cpuCanvas || !ramCanvas) return;

    const cpuCtx = cpuCanvas.getContext('2d');
    const ramCtx = ramCanvas.getContext('2d');

    const resizeCanvases = () => {
      const rect = cpuCanvas.parentElement.getBoundingClientRect();
      cpuCanvas.width = rect.width - 24;
      cpuCanvas.height = 70;
      ramCanvas.width = rect.width - 24;
      ramCanvas.height = 70;
    };
    resizeCanvases();

    const drawGrid = (ctx, w, h) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      // Verticals
      for (let x = 0; x < w; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // Horizontals
      for (let y = 0; y < h; y += 15) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    };

    const drawPlot = (ctx, history, w, h, color) => {
      ctx.clearRect(0, 0, w, h);
      drawGrid(ctx, w, h);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const step = w / (this.historyLength - 1);
      history.forEach((val, idx) => {
        const x = idx * step;
        const y = h - (val / 100) * h;
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Draw gradient under-fill
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
      fillGrad.addColorStop(0, color.replace('1)', '0.12)'));
      fillGrad.addColorStop(1, color.replace('1)', '0)'));
      ctx.fillStyle = fillGrad;
      ctx.fill();
    };

    const loop = () => {
      if (!document.getElementById('monitor-cpu-canvas')) {
        cancelAnimationFrame(this.animationId);
        return;
      }

      // Generate realistic spikes
      const activeWinsCount = WM.windows.size;
      const baseCpu = 3 + activeWinsCount * 2;
      const currentCpu = Math.max(3, Math.min(99, baseCpu + (Math.random() - 0.5) * 8));
      const currentRam = Math.max(30, Math.min(95, 38 + activeWinsCount * 3.5 + (Math.random() - 0.5) * 1.5));

      // Push metrics and shift history
      this.cpuHistory.push(currentCpu);
      this.cpuHistory.shift();
      this.ramHistory.push(currentRam);
      this.ramHistory.shift();

      if (cpuVal) cpuVal.innerText = `${currentCpu.toFixed(0)}%`;
      if (ramVal) ramVal.innerText = `${currentRam.toFixed(0)}%`;

      drawPlot(cpuCtx, this.cpuHistory, cpuCanvas.width, cpuCanvas.height, 'rgba(0, 229, 255, 1)');
      drawPlot(ramCtx, this.ramHistory, ramCanvas.width, ramCanvas.height, 'rgba(255, 0, 127, 1)');

      this.animationId = requestAnimationFrame(loop);
    };

    loop();
  }

  /**
   * Active processes synchronizer row items.
   */
  syncProcessesTable() {
    const rows = document.getElementById('monitor-process-rows');
    if (!rows) return;

    rows.innerHTML = '';

    // Standard static system kernel processes
    const sysProcesses = [
      { name: 'Halo Kernel', pid: 100, cpu: '0.4%', mem: '1.2 MB', system: true },
      { name: 'Desktop UI Shell', pid: 102, cpu: '1.2%', mem: '3.4 MB', system: true },
      { name: 'Zero-Telemetry Shield', pid: 104, cpu: '0.1%', mem: '0.8 MB', system: true }
    ];

    // Dynamic application window processes
    const appProcesses = [];
    WM.windows.forEach(w => {
      appProcesses.push({
        name: `App: ${w.title}`,
        pid: Math.floor(110 + w.element.style.zIndex),
        cpu: `${(Math.random() * 2 + 0.5).toFixed(1)}%`,
        mem: `${(Math.random() * 4 + 4).toFixed(1)} MB`,
        id: w.id,
        system: false
      });
    });

    const all = [...sysProcesses, ...appProcesses];

    all.forEach(p => {
      const tr = document.createElement('tr');
      
      const actionBtn = p.system 
        ? '<span class="status-sys-tag">Locked</span>'
        : `<button class="process-kill-btn" data-id="${p.id}">End Task</button>`;

      tr.innerHTML = `
        <td>
          <div class="proc-name-td">
            <span class="proc-bullet ${p.system ? 'system' : 'app'}"></span>
            <strong>${p.name}</strong>
          </div>
        </td>
        <td style="text-align: center; color: var(--text-secondary); font-family: var(--font-family-mono); font-size:10px;">${p.pid}</td>
        <td style="text-align: right; font-family: var(--font-family-mono); font-size:11px;">${p.cpu}</td>
        <td style="text-align: right; font-family: var(--font-family-mono); font-size:11px;">${p.mem}</td>
        <td style="text-align: center;">${actionBtn}</td>
      `;

      if (!p.system) {
        tr.querySelector('.process-kill-btn').addEventListener('click', () => {
          WM.closeWindow(p.id);
          this.syncProcessesTable();
        });
      }

      rows.appendChild(tr);
    });
  }

  setupStyles() {
    if (document.getElementById('monitor-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'monitor-dynamic-style';
    style.textContent = `
      .monitor-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        color: var(--text-primary);
        padding: 14px;
        gap: 16px;
        background-color: #0c0f13;
      }
      .monitor-graphs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-gap: 12px;
      }
      .graph-card {
        background: rgba(0,0,0,0.3);
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .card-header span {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.6px;
        color: var(--text-secondary);
      }
      .card-header strong {
        font-size: 13px;
        color: var(--accent-color);
        text-shadow: var(--accent-glowing);
      }
      .monitor-canvas {
        width: 100%;
        height: 70px;
        background: rgba(0,0,0,0.2);
        border-radius: 6px;
      }
      
      .monitor-processes {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow: hidden;
      }
      .monitor-processes h3 {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.6px;
        border-bottom: 1px solid var(--panel-border);
        padding-bottom: 6px;
      }
      .process-table-wrapper {
        flex-grow: 1;
        overflow: auto;
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.2);
      }
      .process-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        text-align: left;
      }
      .process-table th {
        background: rgba(0, 0, 0, 0.3);
        padding: 10px 14px;
        font-size: 9px;
        font-weight: 700;
        color: var(--text-secondary);
        text-transform: uppercase;
        border-bottom: 1px solid var(--panel-border);
      }
      .process-table td {
        padding: 8px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.02);
      }
      .proc-name-td {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .proc-bullet {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
      .proc-bullet.system { background-color: var(--accent-color); }
      .proc-bullet.app { background-color: var(--success-color); }
      
      .status-sys-tag {
        font-size: 9px;
        font-weight: 700;
        color: var(--text-secondary);
        background: rgba(255,255,255,0.04);
        padding: 2px 6px;
        border-radius: 4px;
      }
      
      .process-kill-btn {
        background: rgba(255, 59, 48, 0.1);
        border: 1px solid rgba(255, 59, 48, 0.2);
        color: var(--danger-color);
        font-family: var(--font-family-sans);
        font-size: 10px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .process-kill-btn:hover {
        background: var(--danger-color);
        color: #ffffff;
      }
    `;
    document.head.appendChild(style);
  }
}

export const TaskManager = new TaskManagerApp();
export default TaskManager;
