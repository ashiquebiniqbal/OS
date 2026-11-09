import { WM } from '../wm.js';

class AppStoreApp {
  constructor() {
    this.id = 'store';
    this.packages = [
      { id: 'pkg-media', name: 'Media Player', desc: 'Play local videos and view image galleries.', installed: false },
      { id: 'pkg-chat', name: 'P2P Messenger', desc: 'Secure WebRTC peer-to-peer encrypted chat.', installed: false },
      { id: 'pkg-mail', name: 'Secure Mail', desc: 'PGP encrypted email client simulator.', installed: false },
      { id: 'pkg-games', name: 'Arcade Hub', desc: 'Collection of 8-bit retro games.', installed: false }
    ];
  }

  launch() {
    const win = WM.createWindow({
      id: this.id,
      title: 'Decentralized App Store',
      width: 720,
      height: 500,
      icon: `<svg viewBox="0 0 24 24" class="window-title-icon" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>`
    });

    if (win) {
      this.setupStyles();
      this.renderContent(win);
      this.attachEvents(win);
    }
  }

  setupStyles() {
    if (document.getElementById('store-styles')) return;
    const style = document.createElement('style');
    style.id = 'store-styles';
    style.innerHTML = `
      #win-store .window-content {
        background: #0b0f14;
        color: var(--text-primary);
        padding: 20px;
        overflow-y: auto;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .store-header {
        text-align: center;
        margin-bottom: 24px;
      }
      .store-header h2 {
        color: var(--accent-color);
        margin: 0 0 8px 0;
      }
      .store-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }
      .pkg-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: transform 0.2s;
      }
      .pkg-card:hover {
        transform: translateY(-4px);
        border-color: rgba(0, 229, 255, 0.4);
      }
      .pkg-card h3 {
        margin: 0 0 8px 0;
        font-size: 16px;
      }
      .pkg-card p {
        color: var(--text-secondary);
        font-size: 12px;
        line-height: 1.4;
        margin: 0 0 16px 0;
        flex-grow: 1;
      }
      .pkg-btn {
        background: var(--accent-color);
        color: #000;
        border: none;
        padding: 8px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .pkg-btn:hover { opacity: 0.8; }
      .pkg-btn.installed {
        background: rgba(255,255,255,0.1);
        color: var(--text-primary);
        cursor: default;
      }
    `;
    document.head.appendChild(style);
  }

  renderContent(win) {
    const content = win.querySelector('.window-content');
    content.innerHTML = `
      <div class="store-header">
        <h2>Sovereign App Repository</h2>
        <p style="color:var(--text-secondary); font-size: 13px;">Install verified, client-side only decentralized applications.</p>
      </div>
      <div class="store-grid" id="store-grid"></div>
    `;
    this.renderPackages(content);
  }

  renderPackages(content) {
    const grid = content.querySelector('#store-grid');
    grid.innerHTML = '';
    
    this.packages.forEach(pkg => {
      const card = document.createElement('div');
      card.className = 'pkg-card';
      card.innerHTML = `
        <div>
          <h3>${pkg.name}</h3>
          <p>${pkg.desc}</p>
        </div>
        <button class="pkg-btn ${pkg.installed ? 'installed' : ''}" data-id="${pkg.id}">
          ${pkg.installed ? 'Installed' : 'Install Package'}
        </button>
      `;
      grid.appendChild(card);
    });
  }

  attachEvents(win) {
    const content = win.querySelector('.window-content');
    content.addEventListener('click', (e) => {
      if (e.target.classList.contains('pkg-btn') && !e.target.classList.contains('installed')) {
        const id = e.target.getAttribute('data-id');
        const pkg = this.packages.find(p => p.id === id);
        if (pkg) {
          e.target.textContent = 'Installing...';
          e.target.style.opacity = '0.5';
          
          // Simulate network install
          setTimeout(() => {
            pkg.installed = true;
            this.renderPackages(content);
            alert(\`Successfully installed \${pkg.name} to local environment.\`);
          }, 1500);
        }
      }
    });
  }
}

export default new AppStoreApp();
