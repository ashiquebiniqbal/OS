import { VFS } from '../fs.js';
import { WM } from '../wm.js';

/**
 * Halo OS Paint (Canvas Sketch App)
 * Interactive sketching app with brush sizing, custom neon color blocks, and direct PNG image download.
 */
class PaintApp {
  constructor() {
    this.isDrawing = false;
    this.activeTool = 'brush'; // brush, eraser
    this.brushColor = '#00e5ff';
    this.brushSize = 6;
  }

  launch() {
    const id = 'paint';
    const contentHtml = `
      <div class="paint-container">
        <!-- Control Palette Sidebar -->
        <div class="paint-sidebar">
          <h3>Palette Tools</h3>
          
          <div class="paint-tool-section">
            <button class="paint-btn active" id="paint-tool-brush" title="Brush Tool">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.35857 19.5 5.5 20 5.5 20.5C5.5 21.3284 4.82843 22 4 22C3.5 22 3 21.5 2.5 21C1.5 20 1 18.5 1 17"></path>
              </svg>
              <span>Brush</span>
            </button>
            <button class="paint-btn" id="paint-tool-eraser" title="Eraser Tool">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              </svg>
              <span>Eraser</span>
            </button>
          </div>

          <div class="paint-tool-section slider-group">
            <label>Brush Size (<span id="paint-size-label">6px</span>)</label>
            <input type="range" min="1" max="40" value="6" class="sys-slider" id="paint-brush-size">
          </div>

          <div class="paint-tool-section">
            <label class="section-title">Accent Colors</label>
            <div class="paint-colors-grid">
              <span class="color-chip active" data-color="#00e5ff" style="background-color: #00e5ff;"></span>
              <span class="color-chip" data-color="#ff007f" style="background-color: #ff007f;"></span>
              <span class="color-chip" data-color="#39ff14" style="background-color: #39ff14;"></span>
              <span class="color-chip" data-color="#ffcc00" style="background-color: #ffcc00;"></span>
              <span class="color-chip" data-color="#9d4edd" style="background-color: #9d4edd;"></span>
              <span class="color-chip" data-color="#ffffff" style="background-color: #ffffff;"></span>
            </div>
            <!-- Custom Color Picker -->
            <input type="color" class="paint-color-picker" id="paint-custom-color" value="#00e5ff">
          </div>

          <button class="paint-action-btn danger" id="paint-clear" style="margin-top: auto;">Clear Canvas</button>
          <button class="paint-action-btn" id="paint-export">Download Drawing</button>
        </div>

        <!-- HTML5 Canvas Visual panel -->
        <div class="paint-viewport">
          <canvas class="paint-canvas-element" id="paint-canvas"></canvas>
        </div>
      </div>
    `;

    WM.createWindow({
      id,
      title: 'Canvas Drawing Paint',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.35857 19.5 5.5 20 5.5 20.5C5.5 21.3284 4.82843 22 4 22C3.5 22 3 21.5 2.5 21C1.5 20 1 18.5 1 17"></path><circle cx="7.5" cy="10.5" r="1.5"></circle><circle cx="11.5" cy="7.5" r="1.5"></circle><circle cx="16.5" cy="9.5" r="1.5"></circle></svg>`,
      width: 600,
      height: 400,
      contentHtml
    });

    this.setupStyles();
    this.setupCanvas();
    this.bindEvents();
  }

  setupCanvas() {
    const canvas = document.getElementById('paint-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Fit canvas bounds to window viewport size
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width || 420;
    canvas.height = rect.height || 360;

    // Fill canvas background with clean opaque white (so transparent image downloads look pristine)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set drawing line dynamics
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  bindEvents() {
    const canvas = document.getElementById('paint-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let lastX = 0;
    let lastY = 0;

    // 1. Core Mouse drawing events
    const startDraw = (e) => {
      this.isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      lastX = e.clientX - rect.left;
      lastY = e.clientY - rect.top;
    };

    const draw = (e) => {
      if (!this.isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(currentX, currentY);
      
      // Select styling parameters depending on active tools
      if (this.activeTool === 'eraser') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = this.brushSize * 2; // eraser double size for smooth wiping
      } else {
        ctx.strokeStyle = this.brushColor;
        ctx.lineWidth = this.brushSize;
      }
      
      ctx.stroke();

      lastX = currentX;
      lastY = currentY;
    };

    const stopDraw = () => {
      this.isDrawing = false;
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);

    // Support mobile touch events
    canvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      lastX = touch.clientX - rect.left;
      lastY = touch.clientY - rect.top;
      this.isDrawing = true;
    });
    canvas.addEventListener('touchmove', (e) => {
      if (!this.isDrawing) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const currentX = touch.clientX - rect.left;
      const currentY = touch.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(currentX, currentY);
      if (this.activeTool === 'eraser') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = this.brushSize * 2;
      } else {
        ctx.strokeStyle = this.brushColor;
        ctx.lineWidth = this.brushSize;
      }
      ctx.stroke();
      lastX = currentX;
      lastY = currentY;
    });
    canvas.addEventListener('touchend', () => this.isDrawing = false);

    // 2. Toolbar controllers binding
    const brushTool = document.getElementById('paint-tool-brush');
    const eraserTool = document.getElementById('paint-tool-eraser');
    const sizeSlider = document.getElementById('paint-brush-size');
    const sizeLabel = document.getElementById('paint-size-label');
    const clearBtn = document.getElementById('paint-clear');
    const exportBtn = document.getElementById('paint-export');
    const colorChips = document.querySelectorAll('.color-chip');
    const customPicker = document.getElementById('paint-custom-color');

    // Brush Tool Activation
    brushTool.addEventListener('click', () => {
      this.activeTool = 'brush';
      brushTool.classList.add('active');
      eraserTool.classList.remove('active');
    });

    // Eraser Tool Activation
    eraserTool.addEventListener('click', () => {
      this.activeTool = 'eraser';
      eraserTool.classList.add('active');
      brushTool.classList.remove('active');
    });

    // Brush sizing slider
    sizeSlider.addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
      sizeLabel.innerText = `${this.brushSize}px`;
    });

    // Colors chips select
    colorChips.forEach(chip => {
      chip.addEventListener('click', () => {
        colorChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.brushColor = chip.getAttribute('data-color');
        customPicker.value = this.brushColor;
        
        // Auto return to brush if color selected
        if (this.activeTool === 'eraser') {
          brushTool.click();
        }
      });
    });

    // Custom Color picker selector
    customPicker.addEventListener('input', (e) => {
      colorChips.forEach(c => c.classList.remove('active'));
      this.brushColor = e.target.value;
      if (this.activeTool === 'eraser') {
        brushTool.click();
      }
    });

    // Canvas Clear
    clearBtn.addEventListener('click', () => {
      if (confirm("Reset current sketching canvas?")) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    });

    // PNG Download Export
    exportBtn.addEventListener('click', () => {
      const dataUrl = canvas.toDataURL("image/png");
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `halo_painting_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      VFS.logAction("Exported Canvas Painting to Host.");
    });
  }

  setupStyles() {
    if (document.getElementById('paint-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'paint-dynamic-style';
    style.textContent = `
      .paint-container {
        display: flex;
        height: 100%;
        color: var(--text-primary);
      }
      .paint-sidebar {
        width: 160px;
        min-width: 160px;
        background: rgba(0, 0, 0, 0.2);
        border-right: 1px solid var(--panel-border);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .paint-sidebar h3 {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.6px;
        border-bottom: 1px solid var(--panel-border);
        padding-bottom: 6px;
      }
      .paint-tool-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .paint-tool-section label {
        font-size: 10px;
        font-weight: 700;
        color: var(--text-secondary);
        text-transform: uppercase;
      }
      .paint-btn {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        padding: 8px;
        color: var(--text-secondary);
        font-family: var(--font-family-sans);
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .paint-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-primary);
      }
      .paint-btn.active {
        background: rgba(0, 229, 255, 0.12);
        border-color: var(--accent-color);
        color: var(--accent-color);
      }
      .paint-btn svg { width: 14px; height: 14px; }
      
      .paint-colors-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-gap: 6px;
      }
      .color-chip {
        height: 24px;
        border-radius: 6px;
        cursor: pointer;
        border: 1.5px solid transparent;
        transition: transform 0.15s ease;
      }
      .color-chip:hover {
        transform: scale(1.1);
      }
      .color-chip.active {
        border-color: #000000;
        box-shadow: 0 0 6px rgba(255, 255, 255, 0.4);
      }
      .paint-color-picker {
        -webkit-appearance: none;
        width: 100%;
        height: 24px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
      }
      .paint-color-picker::-webkit-color-swatch {
        border: none;
        border-radius: 4px;
      }
      .paint-action-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        color: var(--text-primary);
        padding: 8px;
        font-family: var(--font-family-sans);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .paint-action-btn:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .paint-action-btn.danger:hover {
        background: rgba(255, 59, 48, 0.15);
        border-color: var(--danger-color);
        color: var(--danger-color);
      }
      
      .paint-viewport {
        flex-grow: 1;
        background: #ffffff;
        position: relative;
        overflow: hidden;
      }
      .paint-canvas-element {
        position: absolute;
        top: 0;
        left: 0;
        cursor: crosshair;
      }
    `;
    document.head.appendChild(style);
  }
}

export const Paint = new PaintApp();
export default Paint;
