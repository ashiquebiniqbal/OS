import { VFS } from './fs.js';
import { WM } from './wm.js';
import { Shell } from './shell.js';
import { initUI } from './ui.js';

/**
 * Halo OS System Bootloader & Core Orchestrator
 * Spawns Web Audio retro beeps, runs progress indicators, and registers dynamic ES6 applications.
 */
class HaloKernel {
  constructor() {
    this.apps = [];

    
  }

  async boot() {
    console.log("Kernel booting up...");
    
    // 1. Initialize Window Manager
    const windowsContainer = document.getElementById('windows-container');
    WM.init(windowsContainer);

    // 2. Define & Register Shell Applications
    this.registerApplications();

    // 2b. Initialize shared UI primitives (ContextMenu, Toast, Shortcuts, CommandPalette)
    initUI(this.apps);

    // 3. Initialize Shell Desktop Environment
    Shell.init(this.apps);

    // 4. Run visual boot loader bar and chime synthesizer
    await this.runBootSequence();
  }

  /**
   * Application Registry with High-End Outline SVGs
   */
  registerApplications() {
    this.apps = [
      {
        id: 'explorer',
        title: 'File Explorer',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/explorer.js');
          module.default.launch();
        }
      },
      {
        id: 'notepad',
        title: 'Notepad',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/notepad.js');
          module.default.launch();
        }
      },
      {
        id: 'calculator',
        title: 'Calculator',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                <line x1="8" y1="6" x2="16" y2="6"></line>
                <line x1="8" y1="11" x2="8" y2="11"></line>
                <line x1="12" y1="11" x2="12" y2="11"></line>
                <line x1="16" y1="11" x2="16" y2="11"></line>
                <line x1="8" y1="15" x2="8" y2="15"></line>
                <line x1="12" y1="15" x2="12" y2="15"></line>
                <line x1="16" y1="14" x2="16" y2="18"></line>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/calculator.js');
          module.default.launch();
        }
      },
      {
        id: 'terminal',
        title: 'Terminal',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/terminal.js');
          module.default.launch();
        }
      },
      {
        id: 'vpn',
        title: 'Secure VPN',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <circle cx="12" cy="11" r="3"></circle>
                <path d="M12 2v2"></path>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/vpn.js');
          module.default.launch();
        }
      },
      {
        id: 'automator',
        title: 'Workflow Automator',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <polyline points="9 17 15 12 9 7"></polyline>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/automator.js');
          module.default.launch();
        }
      },
      {
        id: 'api',
        title: 'API Registry',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                <circle cx="12" cy="16" r="1"></circle>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/api.js');
          module.default.launch();
        }
      },
      {
        id: 'shield',
        title: 'Privacy Shield',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/shield.js');
          module.default.launch();
        }
      },
      {
        id: 'browser',
        title: 'Sovereign Web',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/browser/index.js');
          module.default.launch();
        }
      },
      {
        id: 'paint',
        title: 'Canvas Paint',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.35857 19.5 5.5 20 5.5 20.5C5.5 21.3284 4.82843 22 4 22C3.5 22 3 21.5 2.5 21C1.5 20 1 18.5 1 17"></path>
                <circle cx="7.5" cy="10.5" r="1.5"></circle>
                <circle cx="11.5" cy="7.5" r="1.5"></circle>
                <circle cx="16.5" cy="9.5" r="1.5"></circle>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/paint.js');
          module.default.launch();
        }
      },
      {
        id: 'monitor',
        title: 'Task Manager',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/monitor.js');
          module.default.launch();
        }
      },
      {
        id: 'music',
        title: 'Chiptune Synthesizer',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/music.js');
          module.default.launch();
        }
      },
      {
        id: 'bridge',
        title: 'Secure PC-Bridge',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="M12 8v4"></path>
                <path d="M12 16h.01"></path>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/bridge.js');
          module.default.launch();
        }
      },
      {
        id: 'blockchain',
        title: 'Web3 Node',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/blockchain.js');
          module.default.launch();
        }
      },
      {
        id: 'agents',
        title: 'Multi-Agent Hub',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/agents.js');
          module.default.launch();
        }
      },
      {
        id: 'saas',
        title: 'Halo Productivity',
        icon: `<svg viewBox="0 0 24 24" class="dock-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>`,
        launch: async () => {
          const module = await import('./apps/saas.js');
          module.default.launch();
        }
      }
    ];
  }

  /**
   * Procedural Audio Boot Chime & Progress Synchronization
   */
  async runBootSequence() {
    const loader = document.getElementById('boot-loader');
    const progressBar = document.querySelector('.boot-progress');
    const subtitle = document.querySelector('.boot-subtitle');
    
    const steps = [
      { progress: 15, msg: "Initializing kernel security registers..." },
      { progress: 40, msg: "Mounting persistent Virtual File System..." },
      { progress: 65, msg: "Encrypting local sandbox tokens..." },
      { progress: 85, msg: "Binding local Agent Workflow Engine..." },
      { progress: 100, msg: "Halo sovereign node authenticated." }
    ];

    for (const step of steps) {
      await this.sleep(400 + Math.random() * 400);
      progressBar.style.width = `${step.progress}%`;
      subtitle.innerText = step.msg;

      // Play short procedural blip sound on load stages
      this.playBootBlip(step.progress);
    }

    // Play final rich chord synthesis on complete
    await this.sleep(600);
    this.playChordBeep();

    loader.classList.add('boot-hidden');
    
    // Log complete secure system mount
    VFS.logAction("Halo OS Desktop environment loaded securely.");
  }

  /**
   * Sound Design: Generates a short electronic synth beep using browser Web Audio API
   */
  playBootBlip(frequencyMultiplier) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440 + frequencyMultiplier * 3, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // Audio blocked or unsupported, fail silently
    }
  }

  /**
   * Sound Design: Play a glorious synthesized retro complete chord
   */
  playChordBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const freqs = [261.63, 329.63, 392.00, 523.25]; // C major chord
      
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, ctx.currentTime);

        gain.gain.setValueAtTime(0.02, ctx.currentTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8 + idx * 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.05);
        osc.stop(ctx.currentTime + 1.0 + idx * 0.05);
      });
    } catch (e) {
      // Audio blocked
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Bootstrap Kernel on Load
const Kernel = new HaloKernel();
window.addEventListener('DOMContentLoaded', () => {
  Kernel.boot();
});
export default Kernel;
export { Kernel };
