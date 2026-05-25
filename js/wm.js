/**
 * Halo OS Window Manager (WM)
 * Handles coordinate-tracked dragging, resizing, depth focus, minimizing, maximizing.
 */
class WindowManager {
  constructor() {
    this.container = null;
    this.windows = new Map(); // id -> Window object
    this.zCounter = 10;
    this.activeWindowId = null;
    this.onStateChangeCallback = null;
    this._closeCallbacks = new Map(); // id -> fn[]
    this._focusCallbacks = new Map(); // id -> fn[]
  }

  /**
   * Register a per-window close callback. Fires before DOM removal so
   * cleanup code can still access window elements. Apps use this instead
   * of MutationObserver hacks. Returns an unsubscribe function.
   */
  onClose(id, fn) {
    if (!this._closeCallbacks.has(id)) this._closeCallbacks.set(id, []);
    this._closeCallbacks.get(id).push(fn);
    return () => this.offClose(id, fn);
  }

  offClose(id, fn) {
    const list = this._closeCallbacks.get(id);
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  }

  /**
   * Register a per-window focus callback. Fires when the window becomes active.
   */
  onFocus(id, fn) {
    if (!this._focusCallbacks.has(id)) this._focusCallbacks.set(id, []);
    this._focusCallbacks.get(id).push(fn);
    return () => {
      const list = this._focusCallbacks.get(id);
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  _fireCallbacks(map, id) {
    const list = map.get(id);
    if (!list) return;
    list.slice().forEach(fn => {
      try { fn(); } catch (e) { console.error(`[WM callback ${id}]`, e); }
    });
  }

  init(containerElement) {
    this.container = containerElement;
    this.setupGlobalEvents();
  }

  /**
   * Register a callback to notify the Shell when windows open/close/active state changes.
   */
  onStateChange(callback) {
    this.onStateChangeCallback = callback;
  }

  triggerStateChange() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback();
    }
  }

  /**
   * Spawns a beautiful, custom glassmorphic Window.
   */
  createWindow({ id, title, icon, width = 640, height = 480, minWidth = 320, minHeight = 240, contentHtml = '' }) {
    if (this.windows.has(id)) {
      this.restoreWindow(id);
      this.focusWindow(id);
      return this.windows.get(id).element;
    }

    // Default centered position on desktop
    const desktopWidth = this.container.clientWidth;
    const desktopHeight = this.container.clientHeight;
    const left = Math.max(20, Math.floor((desktopWidth - width) / 2) + (this.windows.size * 25) % 150);
    const top = Math.max(20, Math.floor((desktopHeight - height) / 2) + (this.windows.size * 25) % 150);

    // Create Window Element
    const win = document.createElement('div');
    win.id = `win-${id}`;
    win.className = 'window glass-panel';
    win.style.width = `${width}px`;
    win.style.height = `${height}px`;
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    win.style.zIndex = ++this.zCounter;

    // Window Inner HTML template
    win.innerHTML = `
      <div class="resize-handle resize-top"></div>
      <div class="resize-handle resize-bottom"></div>
      <div class="resize-handle resize-left"></div>
      <div class="resize-handle resize-right"></div>
      <div class="resize-handle resize-tl"></div>
      <div class="resize-handle resize-tr"></div>
      <div class="resize-handle resize-bl"></div>
      <div class="resize-handle resize-br"></div>
      
      <div class="window-header">
        <div class="window-controls-mac">
          <button class="win-dot win-dot-close" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <button class="win-dot win-dot-min" title="Minimize">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button class="win-dot win-dot-max" title="Maximize">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
          </button>
        </div>
        <div class="window-title-container">
          <span class="window-title-icon">${icon || ''}</span>
          <span class="window-title">${title}</span>
        </div>
        <div style="width: 50px;"></div> <!-- visual spacer -->
      </div>
      
      <div class="window-content">
        ${contentHtml}
      </div>
    `;

    this.container.appendChild(win);

    // Apply scale-in display animations
    setTimeout(() => {
      win.classList.add('window-shown');
    }, 20);

    const winObj = {
      id,
      title,
      icon,
      element: win,
      width,
      height,
      minWidth,
      minHeight,
      left,
      top,
      isMaximized: false,
      isMinimized: false,
      restoreLeft: left,
      restoreTop: top,
      restoreWidth: width,
      restoreHeight: height
    };

    this.windows.set(id, winObj);
    this.setupWindowControls(winObj);
    this.focusWindow(id);
    this.triggerStateChange();

    return win;
  }

  /**
   * Bind dragging, resizing, focus, and header click controls to a window.
   */
  setupWindowControls(winObj) {
    const el = winObj.element;
    const header = el.querySelector('.window-header');
    
    // Focus trigger
    el.addEventListener('mousedown', () => this.focusWindow(winObj.id));

    // Close dot
    el.querySelector('.win-dot-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeWindow(winObj.id);
    });

    // Minimize dot
    el.querySelector('.win-dot-min').addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimizeWindow(winObj.id);
    });

    // Maximize dot
    el.querySelector('.win-dot-max').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize(winObj.id);
    });

    // Header Double-Click Maximize
    header.addEventListener('doubleclick', () => this.toggleMaximize(winObj.id));

    // Mouse Dragging on header
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.win-dot') || winObj.isMaximized) return;
      e.preventDefault();
      
      this.focusWindow(winObj.id);

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = winObj.left;
      const startTop = winObj.top;

      const onMouseMove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;
        
        let newLeft = startLeft + dx;
        let newTop = startTop + dy;

        // Visual screen bounds snap helper
        if (newTop < 0) newTop = 0;

        winObj.left = newLeft;
        winObj.top = newTop;
        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Edge and Corner Resizing Engine
    const handles = el.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.focusWindow(winObj.id);

        if (winObj.isMaximized) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = winObj.width;
        const startHeight = winObj.height;
        const startLeft = winObj.left;
        const startTop = winObj.top;
        const classes = handle.className;

        const onMouseMove = (moveEvt) => {
          const dx = moveEvt.clientX - startX;
          const dy = moveEvt.clientY - startY;

          let newWidth = startWidth;
          let newHeight = startHeight;
          let newLeft = startLeft;
          let newTop = startTop;

          // Compute sizing depending on handle vectors
          if (classes.includes('resize-right') || classes.includes('resize-tr') || classes.includes('resize-br')) {
            newWidth = Math.max(winObj.minWidth, startWidth + dx);
          }
          if (classes.includes('resize-bottom') || classes.includes('resize-bl') || classes.includes('resize-br')) {
            newHeight = Math.max(winObj.minHeight, startHeight + dy);
          }
          if (classes.includes('resize-left') || classes.includes('resize-tl') || classes.includes('resize-bl')) {
            const possibleWidth = startWidth - dx;
            if (possibleWidth >= winObj.minWidth) {
              newWidth = possibleWidth;
              newLeft = startLeft + dx;
            }
          }
          if (classes.includes('resize-top') || classes.includes('resize-tl') || classes.includes('resize-tr')) {
            const possibleHeight = startHeight - dy;
            if (possibleHeight >= winObj.minHeight) {
              newHeight = possibleHeight;
              newTop = startTop + dy;
            }
          }

          // Apply dimensions
          winObj.width = newWidth;
          winObj.height = newHeight;
          winObj.left = newLeft;
          winObj.top = newTop;

          el.style.width = `${newWidth}px`;
          el.style.height = `${newHeight}px`;
          el.style.left = `${newLeft}px`;
          el.style.top = `${newTop}px`;
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  /**
   * Sets z-index active ordering on target window.
   */
  focusWindow(id) {
    if (!this.windows.has(id)) return;
    const winObj = this.windows.get(id);

    if (this.activeWindowId === id) return;

    // Reset old focused elements
    this.windows.forEach(w => {
      w.element.classList.remove('active-window');
    });

    winObj.element.classList.add('active-window');
    winObj.element.style.zIndex = ++this.zCounter;
    this.activeWindowId = id;

    if (winObj.isMinimized) {
      this.restoreWindow(id);
    }

    this._fireCallbacks(this._focusCallbacks, id);
    this.triggerStateChange();
  }

  /**
   * Graceful window scaling fade-out removal.
   */
  closeWindow(id) {
    if (!this.windows.has(id)) return;
    const winObj = this.windows.get(id);
    const el = winObj.element;

    // Fire close callbacks BEFORE DOM removal so cleanup can read state
    this._fireCallbacks(this._closeCallbacks, id);

    el.classList.remove('window-shown');
    el.style.transform = 'scale(0.85)';
    el.style.opacity = '0';

    setTimeout(() => {
      if (this.container.contains(el)) {
        this.container.removeChild(el);
      }
      this.windows.delete(id);
      this._closeCallbacks.delete(id);
      this._focusCallbacks.delete(id);
      if (this.activeWindowId === id) {
        this.activeWindowId = null;
        // Focus the next highest window
        let nextToFocus = null;
        let maxZ = 0;
        this.windows.forEach(w => {
          const z = parseInt(w.element.style.zIndex);
          if (z > maxZ && !w.isMinimized) {
            maxZ = z;
            nextToFocus = w.id;
          }
        });
        if (nextToFocus) this.focusWindow(nextToFocus);
      }
      this.triggerStateChange();
    }, 250);
  }

  /**
   * Scales window down into the Dock bounds.
   */
  minimizeWindow(id) {
    if (!this.windows.has(id)) return;
    const winObj = this.windows.get(id);
    winObj.element.classList.add('window-minimized');
    winObj.isMinimized = true;

    // Remove active z-index focus
    if (this.activeWindowId === id) {
      winObj.element.classList.remove('active-window');
      this.activeWindowId = null;
    }
    this.triggerStateChange();
  }

  /**
   * Restores minimized window.
   */
  restoreWindow(id) {
    if (!this.windows.has(id)) return;
    const winObj = this.windows.get(id);
    winObj.element.classList.remove('window-minimized');
    winObj.isMinimized = false;
    this.focusWindow(id);
    this.triggerStateChange();
  }

  /**
   * Toggles Maximized coordinates layout.
   */
  toggleMaximize(id) {
    if (!this.windows.has(id)) return;
    const winObj = this.windows.get(id);
    const el = winObj.element;

    if (winObj.isMaximized) {
      // Restore coordinates
      winObj.isMaximized = false;
      el.classList.remove('window-maximized');
      el.style.width = `${winObj.restoreWidth}px`;
      el.style.height = `${winObj.restoreHeight}px`;
      el.style.left = `${winObj.restoreLeft}px`;
      el.style.top = `${winObj.restoreTop}px`;
      
      winObj.width = winObj.restoreWidth;
      winObj.height = winObj.restoreHeight;
      winObj.left = winObj.restoreLeft;
      winObj.top = winObj.restoreTop;
    } else {
      // Stash current bounds first
      winObj.restoreWidth = winObj.width;
      winObj.restoreHeight = winObj.height;
      winObj.restoreLeft = winObj.left;
      winObj.restoreTop = winObj.top;

      winObj.isMaximized = true;
      el.classList.add('window-maximized');
    }
    this.triggerStateChange();
  }

  setupGlobalEvents() {
    // Escape starts close process for high-priority windows, etc if configured.
  }
}

export const WM = new WindowManager();
export default WM;
