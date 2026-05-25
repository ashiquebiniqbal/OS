/**
 * Halo Browser — top-level orchestrator.
 * Tabs, navigation, persistence, keyboard scope, network instrumentation, page saving.
 */
import { WM } from '../../wm.js';
import { VFS } from '../../fs.js';
import { Shortcuts, Toast, ContextMenu } from '../../ui.js';
import { Tab } from './tab.js';
import { TabStrip } from './tabstrip.js';
import { Omnibox } from './omnibox.js';
import { Chrome } from './chrome.js';
import { Store } from './persistence.js';
import * as Router from './router.js';
import { AutoPilot } from './autopilot.js';

const WIN_ID = 'browser';
const TRACKER_HOSTS = new Set(); // populated as we encounter cross-origin third parties

class BrowserApp {
  constructor() {
    this.tabs = [];
    this.activeId = null;
    this.zoom = 1.0;
    this.networkLog = [];
    this.trackerCount = 0;
    this._tabCleanups = new Map(); // tabId -> fn[]
    this._lastClosedTabs = []; // for Ctrl+Shift+T
    this._reopenedFromSession = false;
  }

  launch() {
    const settings = Store.loadSettings();
    this.zoom = settings.defaultZoom || 1.0;

    const contentHtml = `
      <div class="halo-browser-root" style="--browser-zoom: ${this.zoom};">
        <div class="browser-tabstrip" id="browser-tabstrip"></div>
        <div class="browser-chrome" id="browser-chrome"></div>
        <div class="browser-viewport-wrap">
          <div class="browser-viewport" id="browser-viewport" tabindex="0"></div>
          <div class="autopilot-panel" id="autopilot-panel" hidden>
            <header class="autopilot-header">
              <span class="autopilot-title">⚡ Auto-pilot ${AutoPilot.isElectron() ? '' : '<small class="autopilot-warn">(requires desktop app)</small>'}</span>
              <button class="autopilot-close" id="autopilot-close" title="Close">×</button>
            </header>
            <nav class="autopilot-tabs" id="autopilot-tabs">
              <button class="autopilot-tab active" data-tab="run">Run</button>
              <button class="autopilot-tab" data-tab="history">History</button>
            </nav>
            <div class="autopilot-view" id="autopilot-view-run">
              <form class="autopilot-form" id="autopilot-form">
                <textarea id="autopilot-goal" placeholder="What should the agent do? e.g. 'Go to wikipedia and tell me the 3 most recent featured articles.'" rows="3" required></textarea>
                <div class="autopilot-controls">
                  <button type="submit" id="autopilot-run">Run</button>
                  <button type="button" id="autopilot-stop" hidden>Stop</button>
                  <label class="autopilot-steps">max steps <input type="number" id="autopilot-max" value="12" min="1" max="40"></label>
                </div>
              </form>
              <div class="autopilot-log" id="autopilot-log"></div>
            </div>
            <div class="autopilot-view" id="autopilot-view-history" hidden>
              <div class="autopilot-history-list" id="autopilot-history-list"></div>
              <div class="autopilot-history-detail" id="autopilot-history-detail" hidden></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const winEl = WM.createWindow({
      id: WIN_ID,
      title: 'Halo Browser',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
      width: 1100,
      height: 720,
      minWidth: 720,
      minHeight: 460,
      contentHtml,
    });
    if (!winEl) return;

    this.root = winEl.querySelector('.halo-browser-root');
    this.tabStrip = new TabStrip(this, this.root.querySelector('#browser-tabstrip'));
    this.chrome = new Chrome(this, this.root.querySelector('#browser-chrome'));
    this.omnibox = new Omnibox(this, this.chrome.omniboxHost());

    this._installNetworkInstrumentation();
    this._registerShortcuts();
    this._wireAutoPilot();
    this._restoreOrCreateTabs();

    // Expose navigate so autopilot's "navigate" action can use it
    window.__haloBrowserNavigate = (url) => this.navigate(url);

    WM.onClose(WIN_ID, () => this._teardown());
    // Show first-run shortcut tip
    if (!localStorage.getItem('halo_browser_seen_v2')) {
      Toast.info('Tip: Ctrl+T/Ctrl+W would close your real browser. Use Ctrl+Alt+T / Ctrl+Alt+W inside Halo.', 7000);
      localStorage.setItem('halo_browser_seen_v2', '1');
    }
  }

  /* =================================
     Tab lifecycle
     ================================= */
  _restoreOrCreateTabs() {
    const settings = Store.loadSettings();
    const session = Store.loadSession();
    if (settings.restoreTabs && session.tabs && session.tabs.length) {
      session.tabs.forEach(t => {
        const tab = new Tab({ url: t.url, pinned: t.pinned });
        tab.id = t.id; tab.title = t.title || tab.url; tab.color = t.color;
        this.tabs.push(tab);
      });
      this.activeId = session.activeId && this.tabs.some(t => t.id === session.activeId) ? session.activeId : this.tabs[0].id;
      this._reopenedFromSession = true;
      this.refreshChrome();
      this._render();
    } else {
      this.newTab({ url: settings.homepage });
    }
  }

  newTab({ url, incognito = false } = {}) {
    const settings = Store.loadSettings();
    const tab = new Tab({ url: url || (incognito ? 'halo://newtab' : settings.homepage), incognito });
    this.tabs.push(tab);
    this.activeId = tab.id;
    this.refreshChrome();
    this._render();
    return tab;
  }

  closeTab(id) {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx < 0) return;
    const tab = this.tabs[idx];
    this._runTabCleanups(id);
    this._lastClosedTabs.push({ url: tab.url, title: tab.title });
    if (this._lastClosedTabs.length > 10) this._lastClosedTabs.shift();
    this.tabs.splice(idx, 1);
    if (this.activeId === id) {
      this.activeId = this.tabs[Math.max(0, idx - 1)]?.id || null;
    }
    if (!this.tabs.length) this.newTab();
    else { this.refreshChrome(); this._render(); }
    this._persistSession();
  }

  closeOthers(keepId) {
    this.tabs.slice().forEach(t => { if (t.id !== keepId) this.closeTab(t.id); });
  }

  reopenLast() {
    const last = this._lastClosedTabs.pop();
    if (!last) return Toast.info('No recently closed tabs.');
    this.newTab({ url: last.url });
  }

  duplicateTab(id) {
    const t = this.tabById(id);
    if (!t) return;
    this.newTab({ url: t.url });
  }

  togglePin(id) {
    const t = this.tabById(id);
    if (!t) return;
    t.pinned = !t.pinned;
    // Move pinned tabs to the front
    if (t.pinned) {
      const i = this.tabs.indexOf(t);
      this.tabs.splice(i, 1);
      const firstUnpinned = this.tabs.findIndex(x => !x.pinned);
      this.tabs.splice(firstUnpinned < 0 ? this.tabs.length : firstUnpinned, 0, t);
    }
    this.refreshChrome();
    this._persistSession();
  }

  reorderTab(fromId, toId) {
    const from = this.tabs.findIndex(t => t.id === fromId);
    const to = this.tabs.findIndex(t => t.id === toId);
    if (from < 0 || to < 0) return;
    const [t] = this.tabs.splice(from, 1);
    this.tabs.splice(to, 0, t);
    this.refreshChrome();
    this._persistSession();
  }

  activate(id) {
    if (!this.tabs.some(t => t.id === id)) return;
    this.activeId = id;
    this.refreshChrome();
    this._render();
  }

  tabById(id) { return this.tabs.find(t => t.id === id); }
  activeTab() { return this.tabById(this.activeId); }

  cycleTab(dir = 1) {
    if (!this.tabs.length) return;
    const i = this.tabs.findIndex(t => t.id === this.activeId);
    const next = (i + dir + this.tabs.length) % this.tabs.length;
    this.activate(this.tabs[next].id);
  }

  /* =================================
     Navigation
     ================================= */
  navigate(url) {
    const tab = this.activeTab();
    if (!tab) return;
    if (url === tab.url) { this.reload(); return; }
    tab.navigate(url);
    tab.title = url;
    this._renderTab(tab);
    if (!tab.incognito) {
      Store.pushHistory({ url, title: tab.title, ts: Date.now() });
    }
    this.refreshChrome();
    this._persistSession();
  }

  back() {
    const tab = this.activeTab();
    if (!tab || !tab.canBack()) return;
    tab.back();
    this._renderTab(tab);
    this.refreshChrome();
  }
  forward() {
    const tab = this.activeTab();
    if (!tab || !tab.canForward()) return;
    tab.forward();
    this._renderTab(tab);
    this.refreshChrome();
  }
  jumpToHistory(idx) {
    const tab = this.activeTab();
    if (!tab) return;
    tab.historyIndex = Math.max(0, Math.min(tab.history.length - 1, idx));
    tab.url = tab.history[tab.historyIndex];
    this._renderTab(tab);
    this.refreshChrome();
  }
  reload() {
    const tab = this.activeTab();
    if (!tab) return;
    this._renderTab(tab);
  }

  /* =================================
     Rendering
     ================================= */
  refreshChrome() {
    this.tabStrip.render(this.tabs, this.activeId);
    const tab = this.activeTab();
    this.chrome.syncFromTab(tab);
    if (tab) this.omnibox.setUrl(tab.url, !tab.url.startsWith('http://'));
    this.chrome.setTrackerCount(this.trackerCount);
  }

  _render() {
    this.refreshChrome();
    const tab = this.activeTab();
    if (tab) this._renderTab(tab);
  }

  async _renderTab(tab) {
    // Cleanup previous tab-scoped resources
    this._runTabCleanups(tab.id);
    tab.loading = true;
    this.refreshChrome();
    await Router.render(tab.url, this.viewport(), this, tab);
    tab.loading = false;
    if (tab === this.activeTab()) this.refreshChrome();
  }

  viewport() { return this.root.querySelector('#browser-viewport'); }

  /* =================================
     Auto-pilot — agent drives the webview
     ================================= */
  _wireAutoPilot() {
    const panel = this.root.querySelector('#autopilot-panel');
    const form = this.root.querySelector('#autopilot-form');
    const goalEl = this.root.querySelector('#autopilot-goal');
    const runBtn = this.root.querySelector('#autopilot-run');
    const stopBtn = this.root.querySelector('#autopilot-stop');
    const maxEl = this.root.querySelector('#autopilot-max');
    const log = this.root.querySelector('#autopilot-log');
    const closeBtn = this.root.querySelector('#autopilot-close');

    closeBtn.addEventListener('click', () => this.closeAutoPilot());

    // Tab switching
    this.root.querySelectorAll('.autopilot-tab').forEach(btn => {
      btn.addEventListener('click', () => this._switchAutoPilotTab(btn.dataset.tab));
    });

    let stopRequested = false;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const goal = goalEl.value.trim();
      if (!goal) return;
      if (!AutoPilot.isElectron()) {
        Toast.warn('Auto-pilot needs the desktop app — run `npm start` to launch Halo OS in Electron.');
        return;
      }
      const tab = this.activeTab();
      if (!tab || !tab.url.startsWith('http')) {
        Toast.info('Open a website in this tab first, then run Auto-pilot.');
        return;
      }
      const wvId = `wv-${tab.id}`;
      log.innerHTML = '';
      this._logAutoPilot(`<strong>Goal:</strong> ${escapeHtml(goal)}`, 'system');
      runBtn.disabled = true; stopBtn.hidden = false; stopRequested = false;
      stopBtn.onclick = () => { stopRequested = true; this._logAutoPilot('Stop requested…', 'system'); };

      try {
        const result = await AutoPilot.runAutoPilot({
          wvId,
          goal,
          maxSteps: parseInt(maxEl.value, 10) || 12,
          onStep: ({ step, snapshot, decision, result, error }) => {
            if (stopRequested) throw new Error('user-stopped');
            if (error) { this._logAutoPilot(`✗ Step ${step} error: ${escapeHtml(error)}`, 'error'); return; }
            const thought = decision?.thought ? `<em>${escapeHtml(decision.thought)}</em>` : '';
            const actStr = decision?.action ? renderActionLine(decision.action) : '(no action)';
            const gateNote = result?.gated ? ' <span class="autopilot-gate">⛔ blocked</span>' : '';
            this._logAutoPilot(`<strong>Step ${step}.</strong> ${thought}<br><code>${escapeHtml(actStr)}</code> → ${result?.ok ? '✓' : '✗ ' + escapeHtml(result?.error || '')}${gateNote}`, 'step');
          },
          onConfirm: (info) => this._confirmAutoPilotAction(info),
        });
        if (result.ok) {
          this._logAutoPilot(`<strong>✓ Done.</strong> ${escapeHtml(result.answer || '')}`, 'success');
        } else {
          this._logAutoPilot(`<strong>✗ Stopped:</strong> ${escapeHtml(result.error || '')}`, 'error');
        }
      } catch (err) {
        this._logAutoPilot(`✗ ${escapeHtml(err.message)}`, 'error');
      } finally {
        runBtn.disabled = false; stopBtn.hidden = true;
      }
    });
  }

  openAutoPilot() {
    const panel = this.root.querySelector('#autopilot-panel');
    if (!panel) return;
    panel.hidden = false;
    this.root.querySelector('#autopilot-goal')?.focus();
  }
  closeAutoPilot() {
    const panel = this.root.querySelector('#autopilot-panel');
    if (panel) panel.hidden = true;
  }

  _switchAutoPilotTab(tab) {
    this.root.querySelectorAll('.autopilot-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    this.root.querySelector('#autopilot-view-run').hidden = tab !== 'run';
    this.root.querySelector('#autopilot-view-history').hidden = tab !== 'history';
    if (tab === 'history') this._renderAutoPilotHistory();
  }

  _renderAutoPilotHistory() {
    const list = this.root.querySelector('#autopilot-history-list');
    const detail = this.root.querySelector('#autopilot-history-detail');
    if (!list) return;
    detail.hidden = true;
    const runs = AutoPilot.listRuns();
    if (!runs.length) {
      list.innerHTML = `<div class="autopilot-empty">No saved runs yet. When you run Auto-pilot, the result is persisted to <code>/System/AutoPilot/</code>.</div>`;
      return;
    }
    list.innerHTML = '';
    runs.forEach(r => {
      const when = new Date(r.startedAt).toLocaleString();
      const goalText = (r.goal || '').slice(0, 80);
      const row = document.createElement('div');
      row.className = `autopilot-history-item status-${r.status}`;
      row.innerHTML = `
        <div class="autopilot-h-head">
          <span class="autopilot-h-status">${statusBadge(r.status)}</span>
          <span class="autopilot-h-when">${escapeHtml(when)}</span>
          <span class="autopilot-h-steps">${r.steps} step${r.steps === 1 ? '' : 's'}</span>
        </div>
        <div class="autopilot-h-goal">${escapeHtml(goalText)}${r.goal && r.goal.length > 80 ? '…' : ''}</div>
        ${r.answer ? `<div class="autopilot-h-answer">${escapeHtml(r.answer.slice(0, 140))}${r.answer.length > 140 ? '…' : ''}</div>` : ''}
      `;
      row.addEventListener('click', () => this._showAutoPilotRun(r.id));
      list.appendChild(row);
    });
  }

  _showAutoPilotRun(id) {
    const detail = this.root.querySelector('#autopilot-history-detail');
    const list = this.root.querySelector('#autopilot-history-list');
    const run = AutoPilot.loadRun(id);
    if (!run) return;
    list.hidden = true;
    detail.hidden = false;
    const startedStr = new Date(run.startedAt).toLocaleString();
    const durationMs = (run.endedAt || Date.now()) - run.startedAt;
    detail.innerHTML = `
      <div class="autopilot-h-back"><button id="autopilot-h-back-btn">← Back to list</button></div>
      <div class="autopilot-h-detail-head">
        <h3>${escapeHtml(run.goal)}</h3>
        <div class="autopilot-h-meta">${statusBadge(run.status)} · ${escapeHtml(startedStr)} · ${Math.round(durationMs / 100) / 10}s · ${run.steps?.length || 0} steps</div>
        ${run.answer ? `<div class="autopilot-h-answer-final"><strong>Answer:</strong> ${escapeHtml(run.answer)}</div>` : ''}
        ${run.error ? `<div class="autopilot-h-error">✗ ${escapeHtml(run.error)}</div>` : ''}
      </div>
      <div class="autopilot-h-steps-list">
        ${(run.steps || []).map(s => `
          <div class="autopilot-row autopilot-step">
            <strong>Step ${s.step}.</strong>
            <em>${escapeHtml(s.thought || '')}</em>
            <div><code>${escapeHtml(renderActionLine(s.action))}</code> ${s.result?.ok ? '✓' : '✗ ' + escapeHtml(s.result?.error || '')}</div>
            <div class="autopilot-h-step-url">at ${escapeHtml(s.url || '')}</div>
          </div>
        `).join('')}
      </div>
    `;
    detail.querySelector('#autopilot-h-back-btn').addEventListener('click', () => {
      detail.hidden = true; list.hidden = false;
    });
  }

  _logAutoPilot(html, kind = 'step') {
    const log = this.root.querySelector('#autopilot-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = `autopilot-row autopilot-${kind}`;
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  /**
   * Permission-gate confirmation dialog. Returns a Promise<boolean>.
   * Embedded in the autopilot log so the user sees it inline with steps.
   */
  _confirmAutoPilotAction({ summary, target, action }) {
    return new Promise((resolve) => {
      const log = this.root.querySelector('#autopilot-log');
      if (!log) return resolve(true);
      const card = document.createElement('div');
      card.className = 'autopilot-row autopilot-gate-card';
      card.innerHTML = `
        <div class="gate-head">⛔ Permission required</div>
        <div class="gate-summary">${escapeHtml(summary)}</div>
        ${target?.text ? `<div class="gate-target">Element: <code>${escapeHtml((target.text || '').slice(0, 100))}</code></div>` : ''}
        ${action.type === 'navigate' ? `<div class="gate-target">URL: <code>${escapeHtml(action.url || '')}</code></div>` : ''}
        <div class="gate-actions">
          <button class="gate-allow">Allow</button>
          <button class="gate-block">Block</button>
        </div>
      `;
      log.appendChild(card);
      log.scrollTop = log.scrollHeight;
      const finish = (ok) => {
        card.querySelector('.gate-actions').innerHTML = `<span class="gate-result">${ok ? '✓ allowed' : '✗ blocked'}</span>`;
        resolve(ok);
      };
      card.querySelector('.gate-allow').addEventListener('click', () => finish(true));
      card.querySelector('.gate-block').addEventListener('click', () => finish(false));
    });
  }

  setTabTitle(tab, title) {
    tab.title = title;
    if (tab === this.activeTab()) {
      // Update title in tabstrip
      this.tabStrip.render(this.tabs, this.activeId);
    }
  }

  /* =================================
     Tab cleanup registry (for renderer-side resources: intervals, listeners)
     ================================= */
  registerTabCleanup(tabId, fn) {
    if (!this._tabCleanups.has(tabId)) this._tabCleanups.set(tabId, []);
    this._tabCleanups.get(tabId).push(fn);
  }
  _runTabCleanups(tabId) {
    const list = this._tabCleanups.get(tabId);
    if (!list) return;
    list.forEach(fn => { try { fn(); } catch (e) {} });
    this._tabCleanups.delete(tabId);
  }

  /* =================================
     Zoom
     ================================= */
  zoom(delta) { this.setZoom(this.zoom + delta); }
  setZoom(v) {
    this.zoom = Math.max(0.5, Math.min(2, v));
    this.root.style.setProperty('--browser-zoom', this.zoom);
    Toast.info(`Zoom: ${Math.round(this.zoom * 100)}%`);
  }

  /* =================================
     Save page to VFS
     ================================= */
  savePage() {
    const tab = this.activeTab();
    if (!tab) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(tab.title)}</title></head><body>${this.viewport().innerHTML}</body></html>`;
    if (!VFS.exists('/Downloads')) VFS.mkdir('/Downloads');
    const safe = (tab.title || 'page').replace(/[^a-z0-9_\- ]/gi, '').slice(0, 60) + '_' + Date.now() + '.html';
    const path = `/Downloads/${safe}`;
    VFS.write(path, html);
    Store.addDownload({ name: safe, path, url: tab.url });
    Toast.success(`Saved to ${path}`);
  }

  /* =================================
     Shortcuts
     ================================= */
  _registerShortcuts() {
    const id = WIN_ID;
    const reg = (combo, fn) => Shortcuts.register(id, combo, fn);
    reg('ctrl+l', () => this.omnibox.focus());
    reg('ctrl+f', () => this.chrome.openFind());
    reg('ctrl+d', () => this.chrome.host.querySelector('#omni-bookmark').click());
    reg('ctrl+r', () => this.reload());
    reg('f5', () => this.reload());
    reg('escape', () => { if (!this.chrome.findbar.hidden) this.chrome.closeFind(); });
    reg('alt+arrowleft', () => this.back());
    reg('alt+arrowright', () => this.forward());
    reg('ctrl+alt+t', () => this.newTab());
    reg('ctrl+alt+w', () => this.activeId && this.closeTab(this.activeId));
    reg('ctrl+shift+t', () => this.reopenLast());
    reg('ctrl+tab', () => this.cycleTab(1));
    reg('ctrl+shift+tab', () => this.cycleTab(-1));
    reg('ctrl+h', () => this.navigate('halo://history'));
    reg('ctrl+j', () => this.navigate('halo://downloads'));
    reg('ctrl+=', () => this.zoom(0.1));
    reg('ctrl++', () => this.zoom(0.1));
    reg('ctrl+-', () => this.zoom(-0.1));
    reg('ctrl+0', () => this.setZoom(1));
    reg('ctrl+shift+i', () => this.navigate('halo://devtools'));
    reg('ctrl+/', () => this.openAutoPilot());
  }

  /* =================================
     Network instrumentation (records fetches initiated by renderers)
     ================================= */
  _installNetworkInstrumentation() {
    if (window.__haloBrowserPatched) return;
    window.__haloBrowserPatched = true;
    const orig = window.fetch.bind(window);
    const self = this;
    window.fetch = async function (url, init) {
      const t0 = performance.now();
      try {
        const r = await orig(url, init);
        const ms = Math.round(performance.now() - t0);
        const urlStr = typeof url === 'string' ? url : url.url;
        // Heuristic tracker counter: count 3rd-party hosts not in our explicit allowlist
        try {
          const u = new URL(urlStr, location.href);
          if (u.hostname !== location.hostname && !ALLOWLIST.has(u.hostname)) {
            TRACKER_HOSTS.add(u.hostname);
            self.trackerCount = TRACKER_HOSTS.size;
          }
        } catch (e) {}
        self.networkLog.unshift({ method: (init && init.method) || 'GET', url: urlStr, status: r.status, ok: r.ok, ms });
        if (self.networkLog.length > 100) self.networkLog.length = 100;
        return r;
      } catch (e) {
        const ms = Math.round(performance.now() - t0);
        self.networkLog.unshift({ method: (init && init.method) || 'GET', url: String(url), status: 0, ok: false, ms });
        throw e;
      }
    };
  }

  _teardown() {
    // Cleanup all tab cleanups
    [...this._tabCleanups.keys()].forEach(id => this._runTabCleanups(id));
    // Persist final state
    this._persistSession();
    Store.flush();
    Shortcuts.clearScope(WIN_ID);
    ContextMenu.hide();
  }

  _persistSession() {
    Store.saveSession(this.tabs, this.activeId);
  }
}

const ALLOWLIST = new Set([
  'en.wikipedia.org',
  'hacker-news.firebaseio.com',
  'hn.algolia.com',
  'api.github.com',
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'api.dictionaryapi.dev',
  'r.jina.ai',
]);

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function statusBadge(s) {
  const map = { done: '✓ done', running: '… running', error: '✗ error', 'max-steps': '⊘ max-steps' };
  return map[s] || s || '?';
}
function renderActionLine(a) {
  if (!a) return '';
  if (a.type === 'navigate') return `navigate → ${a.url}`;
  if (a.type === 'click') return `click ${a.ref}`;
  if (a.type === 'fill') return `fill ${a.ref} "${a.text}"`;
  if (a.type === 'press') return `press ${a.key} on ${a.ref}`;
  if (a.type === 'scroll') return `scroll ${a.dy || 600}px`;
  if (a.type === 'wait') return `wait ${a.ms || 1500}ms`;
  if (a.type === 'done') return `done — ${a.answer || ''}`;
  return JSON.stringify(a);
}

export const Browser = new BrowserApp();
export default Browser;
