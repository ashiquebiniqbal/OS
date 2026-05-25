import { VFS } from '../fs.js';
import { WM } from '../wm.js';

/**
 * Halo OS Procedural Chiptune Synthesizer & Audio Visualizer
 * Synthesizes nostalgic retro video game background loops purely in code using the browser Web Audio API.
 */
class ChiptuneSynthApp {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.activeTrack = 'runner'; // runner, silicon, enclave
    this.sequenceInterval = null;
    this.visualizerId = null;
    this.beatIndex = 0;
  }

  launch() {
    const id = 'music';
    const contentHtml = `
      <div class="synth-container">
        <!-- Playback Panel Controls -->
        <div class="synth-control-panel">
          <h3>Procedural Chiptune</h3>
          
          <div class="track-list">
            <button class="track-btn active" id="track-runner" data-id="runner">
              <span class="track-icon">🕹️</span>
              <div class="track-meta">
                <strong>Sovereign Runner</strong>
                <small>8-bit Cyber Synthwave</small>
              </div>
            </button>
            <button class="track-btn" id="track-silicon" data-id="silicon">
              <span class="track-icon">💾</span>
              <div class="track-meta">
                <strong>Silicon Dreams</strong>
                <small>Ambient Chip Chime</small>
              </div>
            </button>
            <button class="track-btn" id="track-enclave" data-id="enclave">
              <span class="track-icon">⚡</span>
              <div class="track-meta">
                <strong>Cyberpunk Enclave</strong>
                <small>Intense 8-bit Baseline</small>
              </div>
            </button>
          </div>

          <div class="playback-controls">
            <button class="play-action-btn" id="synth-play-btn">Play Track</button>
            <button class="play-action-btn stop" id="synth-stop-btn">Stop</button>
          </div>
        </div>

        <!-- Dynamic Equalizer Visualizer -->
        <div class="synth-visual-panel">
          <div class="visual-header">
            <span>SYNTH AUDIO VISUALIZER</span>
            <span class="visual-status-tag" id="synth-status-tag">MUTED</span>
          </div>

          <canvas class="synth-viz-canvas" id="synth-viz-canvas"></canvas>
          
          <div class="synth-synth-info">
            <small>Procedural synth active. Zero network bytes downloaded.</small>
          </div>
        </div>
      </div>
    `;

    WM.createWindow({
      id,
      title: 'Chiptune Synthesizer',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
      width: 540,
      height: 320,
      contentHtml
    });

    this.setupStyles();
    this.setupVisualizer();
    this.bindEvents();
  }

  bindEvents() {
    const playBtn = document.getElementById('synth-play-btn');
    const stopBtn = document.getElementById('synth-stop-btn');
    const trackBtns = document.querySelectorAll('.track-btn');

    if (!playBtn) return;

    playBtn.addEventListener('click', () => this.play());
    stopBtn.addEventListener('click', () => this.stop());

    trackBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        trackBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTrack = btn.getAttribute('data-id');
        
        // Auto-restart if already playing
        if (this.isPlaying) {
          this.stop();
          this.play();
        }
      });
    });

    // WM lifecycle cleanup: stop audio + visualizer when window closes
    WM.onClose('music', () => this.stop());
  }

  setupVisualizer() {
    const canvas = document.getElementById('synth-viz-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 24;
    canvas.height = 140;

    ctx.fillStyle = '#0c0f13';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Starts procedural synth sequence play.
   */
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Initialize Web Audio context
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.audioCtx = new AudioCtx();

    document.getElementById('synth-status-tag').innerText = 'SYNTHESIZING';
    document.getElementById('synth-status-tag').className = 'visual-status-tag green';

    this.beatIndex = 0;
    this.startSynthLoop();
    this.startVisualizer();

    VFS.logAction(`Started procedural audio synth: ${this.activeTrack}`);
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    clearInterval(this.sequenceInterval);
    cancelAnimationFrame(this.visualizerId);

    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }

    const tag = document.getElementById('synth-status-tag');
    if (tag) {
      tag.innerText = 'MUTED';
      tag.className = 'visual-status-tag';
    }

    // Reset visualizer canvas
    const canvas = document.getElementById('synth-viz-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0c0f13';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    VFS.logAction(`Stopped procedural audio synth.`);
  }

  /**
   * Synthesizes 8-bit scales in real-time step sequencers.
   */
  startSynthLoop() {
    const tempo = 125; // BPM
    const stepDuration = 60 / tempo / 2; // eighth notes

    // Musical scale notes mappings (C minor pentatonic, etc.)
    const scales = {
      runner: [130.81, 146.83, 155.56, 174.61, 196.00, 220.00, 261.63, 293.66], // Melodic
      silicon: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25], // Joyful pentatonic
      enclave: [65.41, 73.42, 82.41, 98.00, 110.00, 130.81, 146.83, 164.81] // Heavy Bass
    };

    const notes = scales[this.activeTrack];

    this.sequenceInterval = setInterval(() => {
      if (!this.isPlaying || !this.audioCtx) return;

      const time = this.audioCtx.currentTime;

      // 1. Synthesize Bass Baseline Beat
      if (this.beatIndex % 2 === 0) {
        const bassOsc = this.audioCtx.createOscillator();
        const bassGain = this.audioCtx.createGain();
        bassOsc.type = 'sawtooth';
        
        // Dynamic bass rhythm scale
        const bassFreq = notes[this.beatIndex % 4];
        bassOsc.frequency.setValueAtTime(bassFreq / 2, time);

        bassGain.gain.setValueAtTime(0.04, time);
        bassGain.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 0.8);

        bassOsc.connect(bassGain);
        bassGain.connect(this.audioCtx.destination);
        bassOsc.start(time);
        bassOsc.stop(time + stepDuration * 0.9);
      }

      // 2. Synthesize High Melodic Arpeggios (runner & silicon tracks)
      if (this.activeTrack !== 'enclave' && (this.beatIndex % 3 === 0 || this.beatIndex % 8 === 2)) {
        const melOsc = this.audioCtx.createOscillator();
        const melGain = this.audioCtx.createGain();
        
        melOsc.type = this.activeTrack === 'silicon' ? 'sine' : 'square';
        
        // Random arpeggiator scale walk
        const melFreq = notes[Math.floor(Math.random() * notes.length)];
        melOsc.frequency.setValueAtTime(melFreq * (this.activeTrack === 'silicon' ? 2 : 1), time);

        melGain.gain.setValueAtTime(0.02, time);
        melGain.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 1.5);

        melOsc.connect(melGain);
        melGain.connect(this.audioCtx.destination);
        melOsc.start(time);
        melOsc.stop(time + stepDuration * 1.6);
      }

      // 3. Synthesize Noise Snare Beat
      if (this.beatIndex % 4 === 2) {
        this.playNoiseSnare(time, stepDuration);
      }

      this.beatIndex = (this.beatIndex + 1) % 16;
    }, stepDuration * 1000);
  }

  /**
   * Procedural retro chiptune snare noise synthesis using dynamic random buffer nodes.
   */
  playNoiseSnare(time, duration) {
    if (!this.audioCtx) return;

    const bufferSize = this.audioCtx.sampleRate * duration * 0.4;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Fill buffer with white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.audioCtx.createBufferSource();
    noiseNode.buffer = buffer;

    // Filter white noise to chiptune snare frequencies
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, time);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.03, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.6);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    noiseNode.start(time);
    noiseNode.stop(time + duration * 0.7);
  }

  /**
   * Animated simulated frequency bars visualizer.
   */
  startVisualizer() {
    const canvas = document.getElementById('synth-viz-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const barCount = 24;
    const barWidth = canvas.width / barCount - 3;
    const heights = Array(barCount).fill(4);

    const draw = () => {
      if (!document.getElementById('synth-viz-canvas')) return;

      ctx.fillStyle = '#0c0f13';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = this.activeTrack === 'silicon' ? '#ffcc00' : (this.activeTrack === 'enclave' ? '#ff007f' : '#00e5ff');

      for (let i = 0; i < barCount; i++) {
        // Adjust heights dynamically to visual sync
        const target = this.isPlaying 
          ? Math.random() * 80 + 10 + (Math.sin(Date.now() * 0.01 + i) * 20)
          : 4;
        
        // Smooth transitions
        heights[i] += (target - heights[i]) * 0.2;

        const x = i * (barWidth + 3);
        const y = canvas.height - heights[i];
        
        ctx.fillRect(x, y, barWidth, heights[i]);
      }

      this.visualizerId = requestAnimationFrame(draw);
    };

    draw();
  }

  setupStyles() {
    if (document.getElementById('music-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'music-dynamic-style';
    style.textContent = `
      .synth-container {
        display: flex;
        height: 100%;
        color: var(--text-primary);
        background-color: #0c0f13;
      }
      .synth-control-panel {
        width: 220px;
        min-width: 220px;
        background: rgba(0, 0, 0, 0.2);
        border-right: 1px solid var(--panel-border);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .synth-control-panel h3 {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.6px;
        border-bottom: 1px solid var(--panel-border);
        padding-bottom: 6px;
      }
      .track-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .track-btn {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        padding: 8px 10px;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
        transition: all 0.2s ease;
      }
      .track-btn:hover {
        background: rgba(255,255,255,0.06);
        color: var(--text-primary);
      }
      .track-btn.active {
        background: rgba(0, 229, 255, 0.08);
        border-color: var(--accent-color);
        color: var(--text-primary);
        box-shadow: 0 0 10px rgba(0, 229, 255, 0.1);
      }
      .track-icon { font-size: 16px; }
      .track-meta { display: flex; flex-direction: column; }
      .track-meta strong { font-size: 11px; font-weight: 700; }
      .track-meta small { font-size: 9px; color: var(--text-secondary); }
      
      .playback-controls {
        display: flex;
        gap: 8px;
        margin-top: auto;
      }
      .play-action-btn {
        flex-grow: 2;
        background: var(--accent-color);
        border: none;
        color: #121820;
        padding: 8px;
        border-radius: 8px;
        font-family: var(--font-family-sans);
        font-weight: 700;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .play-action-btn:hover { background: #00b8cc; box-shadow: var(--accent-glowing); }
      .play-action-btn.stop {
        flex-grow: 1;
        background: rgba(255, 59, 48, 0.15);
        border: 1px solid rgba(255, 59, 48, 0.2);
        color: var(--danger-color);
      }
      .play-action-btn.stop:hover { background: var(--danger-color); color: #ffffff; }

      /* Visualizer Section Right */
      .synth-visual-panel {
        flex-grow: 1;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow: hidden;
      }
      .visual-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .visual-header span {
        font-size: 10px;
        font-weight: 700;
        color: var(--text-secondary);
        letter-spacing: 0.6px;
      }
      .visual-status-tag {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.6px;
        padding: 2px 8px;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        color: var(--text-secondary);
      }
      .visual-status-tag.green {
        background: rgba(52, 199, 89, 0.12);
        color: var(--success-color);
        box-shadow: 0 0 10px rgba(52, 199, 89, 0.15);
        border: 1px solid rgba(52, 199, 89, 0.2);
      }
      
      .synth-viz-canvas {
        flex-grow: 1;
        background: rgba(0,0,0,0.3);
        border: 1px solid var(--panel-border);
        border-radius: 10px;
      }
      .synth-synth-info {
        font-size: 9px;
        color: var(--text-secondary);
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }
}

export const ChiptuneSynth = new ChiptuneSynthApp();
export default ChiptuneSynth;
