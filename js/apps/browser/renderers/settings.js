import { Store } from '../persistence.js';

export async function render(viewport, browser, tab) {
  browser.setTabTitle(tab, 'Settings');
  paint(viewport, browser);
}

function paint(viewport, browser) {
  const s = Store.loadSettings();
  viewport.innerHTML = `
    <div class="settings-root">
      <header class="settings-header"><h1>Browser Settings</h1></header>

      <section class="settings-section">
        <h2>Startup</h2>
        <label>
          <span>Homepage</span>
          <input type="text" id="set-home" value="${escapeAttr(s.homepage)}">
        </label>
        <label class="settings-row">
          <input type="checkbox" id="set-restore" ${s.restoreTabs ? 'checked' : ''}>
          <span>Restore tabs from last session</span>
        </label>
      </section>

      <section class="settings-section">
        <h2>Search</h2>
        <label>
          <span>Default search</span>
          <select id="set-engine">
            <option value="wikipedia" ${s.searchEngine === 'wikipedia' ? 'selected' : ''}>Wikipedia</option>
            <option value="hn" ${s.searchEngine === 'hn' ? 'selected' : ''}>Hacker News</option>
            <option value="github" ${s.searchEngine === 'github' ? 'selected' : ''}>GitHub</option>
            <option value="all" ${s.searchEngine === 'all' ? 'selected' : ''}>All engines</option>
          </select>
        </label>
      </section>

      <section class="settings-section">
        <h2>Privacy</h2>
        <label class="settings-row">
          <input type="checkbox" id="set-track" ${s.trackerBlocking ? 'checked' : ''}>
          <span>Block trackers (simulated counter shown in toolbar)</span>
        </label>
        <label class="settings-row">
          <input type="checkbox" id="set-proxy" ${s.readerProxy ? 'checked' : ''}>
          <span>Reader Proxy for embed-blocked sites
            <small>Uses r.jina.ai to fetch a readable, text-only view when X-Frame-Options blocks embedding.</small>
          </span>
        </label>
      </section>

      <section class="settings-section">
        <h2>Appearance</h2>
        <label>
          <span>Default zoom</span>
          <select id="set-zoom">
            <option value="0.9" ${s.defaultZoom == 0.9 ? 'selected' : ''}>90%</option>
            <option value="1" ${s.defaultZoom == 1 ? 'selected' : ''}>100%</option>
            <option value="1.1" ${s.defaultZoom == 1.1 ? 'selected' : ''}>110%</option>
            <option value="1.25" ${s.defaultZoom == 1.25 ? 'selected' : ''}>125%</option>
          </select>
        </label>
      </section>

      <section class="settings-section">
        <h2>Auto-pilot (agent)</h2>
        <label>
          <span>Vision mode
            <small>Attach a screenshot of the page to each LLM step. Requires a vision-capable model (GPT-4o, Claude 3+, Gemini). Auto = use when supported.</small>
          </span>
          <select id="set-vision">
            <option value="auto" ${(localStorage.getItem('halo_autopilot_vision') || 'auto') === 'auto' ? 'selected' : ''}>Auto (detect by model)</option>
            <option value="on" ${localStorage.getItem('halo_autopilot_vision') === 'on' ? 'selected' : ''}>Always on</option>
            <option value="off" ${localStorage.getItem('halo_autopilot_vision') === 'off' ? 'selected' : ''}>Off (text only)</option>
          </select>
        </label>
        <p style="font-size: 10px; color: var(--text-secondary); margin-top: 6px;">
          Current model: <code>${escapeAttr(currentModelLabel())}</code>
        </p>
        <label>
          <span>Permission gating
            <small>Prompt for confirmation before risky actions (delete, send, pay, transfer, …). Strict prompts on every click/fill.</small>
          </span>
          <select id="set-gating">
            <option value="strict" ${(localStorage.getItem('halo_autopilot_gating') || 'standard') === 'strict' ? 'selected' : ''}>Strict (confirm everything)</option>
            <option value="standard" ${(localStorage.getItem('halo_autopilot_gating') || 'standard') === 'standard' ? 'selected' : ''}>Standard (risky keywords only)</option>
            <option value="off" ${localStorage.getItem('halo_autopilot_gating') === 'off' ? 'selected' : ''}>Off (full autonomy — risky)</option>
          </select>
        </label>
      </section>

      <section class="settings-section">
        <h2>Data</h2>
        <p><strong>Persistence:</strong> all browser data is in the local VFS under <code>/System/Browser/</code>. Nothing leaves your machine.</p>
        <button id="set-clear">Clear browsing data (history, downloads, reading list)</button>
      </section>
    </div>
  `;

  const bind = (id, prop, val = (e) => e.target.value) => {
    const el = viewport.querySelector(`#${id}`);
    el.addEventListener('change', (e) => Store.saveSettings({ [prop]: val(e) }));
  };
  bind('set-home', 'homepage');
  bind('set-restore', 'restoreTabs', (e) => e.target.checked);
  bind('set-engine', 'searchEngine');
  bind('set-track', 'trackerBlocking', (e) => e.target.checked);
  bind('set-proxy', 'readerProxy', (e) => e.target.checked);
  bind('set-zoom', 'defaultZoom', (e) => parseFloat(e.target.value));

  viewport.querySelector('#set-vision').addEventListener('change', (e) => {
    localStorage.setItem('halo_autopilot_vision', e.target.value);
  });
  viewport.querySelector('#set-gating').addEventListener('change', (e) => {
    localStorage.setItem('halo_autopilot_gating', e.target.value);
  });

  viewport.querySelector('#set-clear').addEventListener('click', () => {
    if (!confirm('Clear history, downloads, and reading list?')) return;
    Store.clearHistory();
    Store._cache.downloads = [];
    Store._cache.readingList = [];
    Store._scheduleWrite('downloads');
    Store._scheduleWrite('readingList');
    Store.flush();
    paint(viewport, browser);
  });
}

function escapeAttr(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function currentModelLabel() {
  try {
    const raw = localStorage.getItem('halo_api_config');
    if (!raw) return 'not configured';
    const cfg = JSON.parse(raw);
    return cfg.model || 'unknown';
  } catch (e) { return 'unknown'; }
}
