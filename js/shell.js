import { WM } from './wm.js';

/**
 * Halo OS Desktop Shell Coordinator
 * Orchestrates wallpaper particle loops, centered magnifying docks, Clock, start search filters, and tray themes.
 */
class DesktopShell {
  constructor() {
    this.apps = [];
    this.particleAnimationId = null;
    this.particleSettings = { active: true, color: 'rgba(0, 229, 255, 0.3)', speed: 0.8 };
  }

  init(registeredApps) {
    this.apps = registeredApps;
    
    this.setupWallpaperEngine();
    this.renderDesktopIcons();
    this.renderDockItems();
    this.renderStartMenuApps();
    this.setupShellListeners();
    this.startClock();
    
    // Initial WM bindings to synchronize dock active light indicators
    WM.onStateChange(() => this.syncDockIndicators());
  }

  /**
   * High-End Canvas Particle Network Background
   * Spawns floating nodes that establish connections when proximate.
   */
  setupWallpaperEngine() {
    const canvas = document.getElementById('wallpaper-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Cancel any prior animation loop so toggling particles doesn't stack RAFs.
    if (this.particleAnimationId) {
      cancelAnimationFrame(this.particleAnimationId);
      this.particleAnimationId = null;
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    // Bind resize listener only once across the lifetime of the shell.
    if (!this._resizeBound) {
      window.addEventListener('resize', resizeCanvas);
      this._resizeBound = true;
    }

    const particles = [];
    const count = 40;
    
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * this.particleSettings.speed,
        vy: (Math.random() - 0.5) * this.particleSettings.speed,
        r: Math.random() * 2 + 1
      });
    }

    const animate = () => {
      if (!this.particleSettings.active) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Determine theme base overlay shading
      const isLightTheme = document.body.classList.contains('theme-light');
      const isCyberTheme = document.body.classList.contains('theme-cyberpunk');
      const isOledTheme = document.body.classList.contains('theme-oled');
      
      let baseGrad;
      if (isLightTheme) {
        baseGrad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 50, canvas.width / 2, canvas.height / 2, canvas.width);
        baseGrad.addColorStop(0, '#f5f7fb');
        baseGrad.addColorStop(1, '#e1e5eb');
        this.particleSettings.color = 'rgba(0, 102, 204, 0.15)';
      } else if (isCyberTheme) {
        baseGrad = ctx.createRadialGradient(canvas.width * 0.7, canvas.height * 0.3, 50, canvas.width / 2, canvas.height / 2, canvas.width);
        baseGrad.addColorStop(0, '#2d144d');
        baseGrad.addColorStop(1, '#0e051c');
        this.particleSettings.color = 'rgba(255, 0, 127, 0.3)';
      } else if (isOledTheme) {
        baseGrad = '#000000';
        this.particleSettings.color = 'rgba(255, 255, 255, 0.15)';
      } else { // Dark default
        baseGrad = ctx.createRadialGradient(canvas.width * 0.8, canvas.height * 0.2, 50, canvas.width / 2, canvas.height / 2, canvas.width);
        baseGrad.addColorStop(0, '#1a2436');
        baseGrad.addColorStop(1, '#0a0d14');
        this.particleSettings.color = 'rgba(0, 229, 255, 0.25)';
      }

      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render Nodes & Edges
      for (let i = 0; i < count; i++) {
        const p1 = particles[i];
        p1.x += p1.vx;
        p1.y += p1.vy;

        // Bouncing walls
        if (p1.x < 0 || p1.x > canvas.width) p1.vx *= -1;
        if (p1.y < 0 || p1.y > canvas.height) p1.vy *= -1;

        ctx.fillStyle = this.particleSettings.color;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.r, 0, Math.PI * 2);
        ctx.fill();

        // Connect proximate nodes
        for (let j = i + 1; j < count; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.18;
            ctx.strokeStyle = this.particleSettings.color.replace(/[\d.]+\)$/, `${alpha})`);
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      this.particleAnimationId = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Generates desktop grid icon shortcuts.
   */
  renderDesktopIcons() {
    const grid = document.getElementById('desktop-icons');
    if (!grid) return;
    grid.innerHTML = '';

    this.apps.forEach(app => {
      if (app.hideDesktop) return;
      const btn = document.createElement('button');
      btn.className = 'desktop-icon-btn';
      btn.setAttribute('data-id', app.id);
      btn.innerHTML = `
        ${app.icon}
        <span>${app.title}</span>
      `;
      
      // Double click launches or focuses
      btn.addEventListener('dblclick', () => app.launch());
      btn.addEventListener('touchend', () => app.launch()); // Mobile fallback
      grid.appendChild(btn);
    });
  }

  /**
   * Generates centering Dock items.
   */
  renderDockItems() {
    const dockApps = document.getElementById('dock-apps');
    if (!dockApps) return;
    dockApps.innerHTML = '';

    this.apps.forEach(app => {
      if (app.hideDock) return;
      const item = document.createElement('div');
      item.className = 'dock-item';
      item.id = `dock-item-${app.id}`;
      item.setAttribute('data-tooltip', app.title);
      item.innerHTML = app.icon;

      item.addEventListener('click', () => {
        const win = WM.windows.get(app.id);
        if (win) {
          if (win.isMinimized) {
            WM.restoreWindow(app.id);
          } else if (WM.activeWindowId === app.id) {
            WM.minimizeWindow(app.id);
          } else {
            WM.focusWindow(app.id);
          }
        } else {
          app.launch();
        }
      });

      dockApps.appendChild(item);
    });
  }

  /**
   * Generates start overlay application elements.
   */
  renderStartMenuApps() {
    const startAppList = document.getElementById('start-app-list');
    if (!startAppList) return;
    startAppList.innerHTML = '';

    this.apps.forEach(app => {
      const btn = document.createElement('button');
      btn.className = 'start-app-btn';
      btn.setAttribute('data-id', app.id);
      btn.innerHTML = `
        ${app.icon}
        <span>${app.title}</span>
      `;
      btn.addEventListener('click', () => {
        app.launch();
        this.toggleStartMenu(false);
      });
      startAppList.appendChild(btn);
    });
  }

  /**
   * Sets up click handlers for global drawers, slides, start, search and chips.
   */
  setupShellListeners() {
    const startTrigger = document.getElementById('start-menu-trigger');
    const systemTrigger = document.getElementById('system-tray-trigger');
    const startMenu = document.getElementById('start-menu');
    const settingsTray = document.getElementById('settings-tray');
    
    // Toggles Start Menu
    startTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleStartMenu();
      this.toggleSettingsTray(false);
    });

    // Toggles Quick settings panel
    systemTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSettingsTray();
      this.toggleStartMenu(false);
    });

    // Hide overlays on desktop body click
    document.getElementById('desktop-grid').addEventListener('mousedown', () => {
      this.toggleStartMenu(false);
      this.toggleSettingsTray(false);
    });

    // Global Key Events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Meta' || e.key === 'Super') {
        e.preventDefault();
        this.toggleStartMenu();
      }
    });

    // Start Menu Search filter engine
    const searchInput = document.getElementById('start-search');
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const buttons = document.querySelectorAll('.start-app-btn');
      buttons.forEach(btn => {
        const text = btn.innerText.toLowerCase();
        if (text.includes(query)) {
          btn.style.display = 'flex';
        } else {
          btn.style.display = 'none';
        }
      });
    });

    // Quick Settings sliders & triggers
    const volumeSlider = document.getElementById('volume-slider');
    const blurSlider = document.getElementById('blur-slider');
    const toggleParticles = document.getElementById('toggle-particles-btn');
    const toggleSidebar = document.getElementById('toggle-agent-sidebar-btn');
    const closeSidebar = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('agent-sidebar');

    // Volumes
    volumeSlider.addEventListener('input', (e) => {
      // Mock sound indicator volume
      localStorage.setItem('halo_sys_volume', e.target.value);
    });

    // Glass backdrop custom filter scale
    blurSlider.addEventListener('input', (e) => {
      document.documentElement.style.setProperty('--blur-strength', `${e.target.value}px`);
    });

    // Active particle toggles
    toggleParticles.addEventListener('click', () => {
      this.particleSettings.active = !this.particleSettings.active;
      toggleParticles.classList.toggle('active', this.particleSettings.active);
      this.setupWallpaperEngine();
    });

    // Copilot slide panel toggles
    const toggleSidebarFn = (force) => {
      const active = sidebar.classList.toggle('sidebar-collapsed', force !== undefined ? !force : undefined);
      toggleSidebar.classList.toggle('active', !active);
    };

    toggleSidebar.addEventListener('click', () => toggleSidebarFn());
    closeSidebar.addEventListener('click', () => toggleSidebarFn(false));

    // Shortcut VPN App launch
    document.getElementById('tray-toggle-vpn-btn').addEventListener('click', () => {
      const vpnApp = this.apps.find(a => a.id === 'vpn');
      if (vpnApp) vpnApp.launch();
      this.toggleSettingsTray(false);
    });

    // Shortcut Privacy Shield App launch
    document.getElementById('toggle-shield-btn').addEventListener('click', () => {
      const shieldApp = this.apps.find(a => a.id === 'shield');
      if (shieldApp) shieldApp.launch();
      this.toggleSettingsTray(false);
    });

    // Theme Selector Chip handler
    const chips = document.querySelectorAll('.theme-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        const theme = chip.getAttribute('data-theme');
        document.body.className = `theme-${theme}`;
        
        // Custom visual tweaks depending on the selected profile
        localStorage.setItem('halo_sys_theme', theme);
      });
    });

    // ========== DOCK AUTOHIDE & POSITION CONTROLS ==========
    const dockContainer = document.getElementById('dock-container');
    const dockChips = document.querySelectorAll('.dock-chip');
    const dockAutohideToggle = document.getElementById('dock-autohide-toggle');

    // Dock Position Selector
    dockChips.forEach(chip => {
      chip.addEventListener('click', () => {
        dockChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        const pos = chip.getAttribute('data-pos');
        document.body.classList.remove('dock-top', 'dock-left', 'dock-right', 'dock-bottom');
        if (pos !== 'bottom') {
          document.body.classList.add(`dock-${pos}`);
        }
        localStorage.setItem('halo_dock_pos', pos);
      });
    });

    // Dock Autohide Toggle
    if (dockAutohideToggle) {
      dockAutohideToggle.addEventListener('change', (e) => {
        const isAutohide = e.target.checked;
        document.body.classList.toggle('dock-autohide', isAutohide);
        localStorage.setItem('halo_dock_autohide', isAutohide);
      });

      // Load initial state
      if (localStorage.getItem('halo_dock_autohide') === 'true') {
        dockAutohideToggle.checked = true;
        document.body.classList.add('dock-autohide');
      }
      
      const savedPos = localStorage.getItem('halo_dock_pos');
      if (savedPos) {
        const savedChip = document.querySelector(`.dock-chip[data-pos="${savedPos}"]`);
        if (savedChip) savedChip.click();
      }
    }

    // Autohide mouse proximity trigger
    document.addEventListener('mousemove', (e) => {
      if (!document.body.classList.contains('dock-autohide')) return;
      const dockEdge = document.body.classList.contains('dock-top') ? 'top' :
                       document.body.classList.contains('dock-left') ? 'left' :
                       document.body.classList.contains('dock-right') ? 'right' : 'bottom';
      let show = false;
      if (dockEdge === 'bottom') show = e.clientY > window.innerHeight - 10;
      if (dockEdge === 'top') show = e.clientY < 10;
      if (dockEdge === 'left') show = e.clientX < 10;
      if (dockEdge === 'right') show = e.clientX > window.innerWidth - 10;
      
      if (show) {
        dockContainer.classList.add('dock-peek');
      } else if (!dockContainer.matches(':hover')) {
        dockContainer.classList.remove('dock-peek');
      }
    });

    dockContainer.addEventListener('mouseleave', () => {
      if (document.body.classList.contains('dock-autohide')) {
        dockContainer.classList.remove('dock-peek');
      }
    });

    // Power off handler
    document.getElementById('shutdown-btn').addEventListener('click', () => {
      const boot = document.getElementById('boot-loader');
      boot.classList.remove('boot-hidden');
      document.querySelector('.boot-subtitle').innerText = "System shut down secure.";
      document.querySelector('.boot-spinner').style.display = 'none';
      document.querySelector('.boot-progress-bar').style.display = 'none';
      setTimeout(() => {
        window.close();
        alert("Halo OS Sandboxed node deactivated safely.");
      }, 1000);
    });
  }

  toggleStartMenu(force) {
    const el = document.getElementById('start-menu');
    const trigger = document.getElementById('start-menu-trigger');
    const show = force !== undefined ? force : el.classList.contains('hidden');
    
    if (show) {
      el.classList.remove('hidden');
      setTimeout(() => el.classList.add('start-shown'), 10);
      trigger.classList.add('dock-active');
      document.getElementById('start-search').focus();
    } else {
      el.classList.remove('start-shown');
      trigger.classList.remove('dock-active');
      setTimeout(() => el.classList.add('hidden'), 250);
    }
  }

  toggleSettingsTray(force) {
    const el = document.getElementById('settings-tray');
    const show = force !== undefined ? force : el.classList.contains('hidden');
    
    if (show) {
      el.classList.remove('hidden');
      setTimeout(() => el.classList.add('tray-shown'), 10);
    } else {
      el.classList.remove('tray-shown');
      setTimeout(() => el.classList.add('hidden'), 250);
    }
  }

  /**
   * Running apps status dot synchronization.
   */
  syncDockIndicators() {
    this.apps.forEach(app => {
      const item = document.getElementById(`dock-item-${app.id}`);
      if (!item) return;

      const isRunning = WM.windows.has(app.id);
      const isActive = WM.activeWindowId === app.id;

      item.classList.toggle('dock-running', isRunning && !isActive);
      item.classList.toggle('dock-active', isRunning && isActive);
    });
  }

  /**
   * System Tray Clock Interval.
   */
  startClock() {
    const trayTime = document.getElementById('tray-time');
    const updateTime = () => {
      const d = new Date();
      let hrs = d.getHours();
      const mins = d.getMinutes().toString().padStart(2, '0');
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      hrs = hrs % 12;
      hrs = hrs ? hrs : 12; // 0 should be 12
      trayTime.innerText = `${hrs}:${mins} ${ampm}`;
    };
    updateTime();
    setInterval(updateTime, 1000);
  }
}

export const Shell = new DesktopShell();
export default Shell;
