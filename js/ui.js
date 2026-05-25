/**
 * Halo OS Shared UI Primitives.
 * Provides ContextMenu, Toast, Shortcuts, CommandPalette, Logger.
 * All apps should reuse these instead of reinventing.
 */
import { WM } from './wm.js';
import { VFS } from './fs.js';

/* ------------------------------------------------------------------
   ContextMenu — single floating menu, one instance reused.
   Items: { label, icon?, shortcut?, onClick, danger?, separator?, disabled? }
------------------------------------------------------------------- */
class ContextMenuMgr {
  constructor() {
    this.el = null;
    this._onDoc = null;
  }

  ensure() {
    if (this.el) return;
    const m = document.createElement('div');
    m.id = 'halo-context-menu';
    m.className = 'halo-ctxmenu hidden';
    document.body.appendChild(m);
    this.el = m;
  }

  show(x, y, items) {
    this.ensure();
    const m = this.el;
    m.innerHTML = '';

    items.forEach(item => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'halo-ctxmenu-sep';
        m.appendChild(sep);
        return;
      }
      const it = document.createElement('div');
      it.className = 'halo-ctxmenu-item' + (item.danger ? ' danger' : '') + (item.disabled ? ' disabled' : '');
      it.innerHTML = `
        <span class="halo-ctxmenu-icon">${item.icon || ''}</span>
        <span class="halo-ctxmenu-label">${item.label}</span>
        <span class="halo-ctxmenu-shortcut">${item.shortcut || ''}</span>
      `;
      if (!item.disabled) {
        it.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hide();
          try { item.onClick && item.onClick(); } catch (err) { console.error(err); }
        });
      }
      m.appendChild(it);
    });

    m.classList.remove('hidden');
    // Position with viewport overflow guard
    const rect = { w: 220, h: items.length * 32 };
    let left = x, top = y;
    if (left + rect.w > window.innerWidth - 8) left = window.innerWidth - rect.w - 8;
    if (top + rect.h > window.innerHeight - 8) top = window.innerHeight - rect.h - 8;
    m.style.left = `${left}px`;
    m.style.top = `${top}px`;

    // Outside-click & escape dismiss
    if (this._onDoc) document.removeEventListener('mousedown', this._onDoc);
    this._onDoc = (e) => {
      if (!m.contains(e.target)) this.hide();
    };
    setTimeout(() => document.addEventListener('mousedown', this._onDoc), 0);
    document.addEventListener('keydown', this._onKey = (e) => {
      if (e.key === 'Escape') this.hide();
    }, { once: true });
  }

  hide() {
    if (!this.el) return;
    this.el.classList.add('hidden');
    if (this._onDoc) {
      document.removeEventListener('mousedown', this._onDoc);
      this._onDoc = null;
    }
  }
}

export const ContextMenu = new ContextMenuMgr();

/* ------------------------------------------------------------------
   Toast — stacked bottom-right notifications.
------------------------------------------------------------------- */
class ToastMgr {
  constructor() {
    this.root = null;
  }

  ensure() {
    if (this.root) return;
    const r = document.createElement('div');
    r.id = 'halo-toast-root';
    document.body.appendChild(r);
    this.root = r;
  }

  show(message, kind = 'info', ms = 4000) {
    this.ensure();
    const t = document.createElement('div');
    t.className = `halo-toast halo-toast-${kind}`;
    t.innerHTML = `<span class="halo-toast-msg">${message}</span><span class="halo-toast-close">×</span>`;
    this.root.appendChild(t);

    requestAnimationFrame(() => t.classList.add('show'));

    const dismiss = () => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 200);
    };
    t.querySelector('.halo-toast-close').addEventListener('click', dismiss);
    if (ms > 0) setTimeout(dismiss, ms);
    return dismiss;
  }

  info(m, ms) { return this.show(m, 'info', ms); }
  success(m, ms) { return this.show(m, 'success', ms); }
  warn(m, ms) { return this.show(m, 'warn', ms); }
  error(m, ms) { return this.show(m, 'error', ms); }
}

export const Toast = new ToastMgr();

/* ------------------------------------------------------------------
   Shortcuts — single delegated keydown listener.
   Combo syntax: "ctrl+k", "ctrl+shift+t", "alt+arrowleft", "f5", "escape"
   Scope: 'global' or a WM window id. Window-scoped fires only when that
   window is active.
------------------------------------------------------------------- */
class ShortcutsMgr {
  constructor() {
    this.map = new Map(); // scope -> Map<combo, fn>
    document.addEventListener('keydown', (e) => this._dispatch(e), true);
  }

  _norm(combo) {
    return combo
      .toLowerCase()
      .split('+')
      .map(s => s.trim())
      .sort((a, b) => {
        // canonical order: ctrl, alt, shift, meta, then key
        const order = { ctrl: 0, alt: 1, shift: 2, meta: 3 };
        const oa = order[a] ?? 9, ob = order[b] ?? 9;
        if (oa !== ob) return oa - ob;
        return a.localeCompare(b);
      })
      .join('+');
  }

  _eventCombo(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    if (e.metaKey) parts.push('meta');
    let key = e.key.toLowerCase();
    if (key === ' ') key = 'space';
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) parts.push(key);
    return this._norm(parts.join('+'));
  }

  register(scope, combo, fn) {
    const k = this._norm(combo);
    if (!this.map.has(scope)) this.map.set(scope, new Map());
    this.map.get(scope).set(k, fn);
    return () => this.unregister(scope, combo);
  }

  unregister(scope, combo) {
    const k = this._norm(combo);
    const m = this.map.get(scope);
    if (m) m.delete(k);
  }

  clearScope(scope) {
    this.map.delete(scope);
  }

  _dispatch(e) {
    const combo = this._eventCombo(e);
    const active = WM.activeWindowId;

    // First try window-scoped
    if (active && this.map.has(active)) {
      const fn = this.map.get(active).get(combo);
      if (fn) {
        e.preventDefault();
        e.stopPropagation();
        try { fn(e); } catch (err) { console.error(err); }
        return;
      }
    }
    // Then global
    if (this.map.has('global')) {
      const fn = this.map.get('global').get(combo);
      if (fn) {
        e.preventDefault();
        e.stopPropagation();
        try { fn(e); } catch (err) { console.error(err); }
        return;
      }
    }
  }
}

export const Shortcuts = new ShortcutsMgr();

/* ------------------------------------------------------------------
   Logger — namespaced, debounced VFS sink.
------------------------------------------------------------------- */
class LoggerMgr {
  constructor() {
    this.buf = [];
    this.timer = null;
  }

  _flush() {
    if (!this.buf.length) return;
    try {
      let logs = VFS.read('/Security/Sandbox.log') || '';
      logs += '\n' + this.buf.join('\n');
      const lines = logs.split('\n');
      if (lines.length > 200) logs = lines.slice(lines.length - 200).join('\n');
      VFS.write('/Security/Sandbox.log', logs);
    } catch (e) { /* VFS unavailable */ }
    this.buf = [];
  }

  _schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this._flush(); }, 1500);
  }

  for(ns) {
    return {
      info: (...args) => this._log(ns, 'INFO', args),
      warn: (...args) => this._log(ns, 'WARN', args),
      error: (...args) => this._log(ns, 'ERROR', args),
    };
  }

  _log(ns, level, args) {
    const stamp = new Date().toISOString();
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    const line = `[${stamp}] [${level}] [${ns}] ${msg}`;
    if (level === 'ERROR') console.error(line); else console.log(line);
    this.buf.push(line);
    this._schedule();
  }
}

export const Logger = new LoggerMgr();

/* ------------------------------------------------------------------
   CommandPalette — Cmd+K / Ctrl+K fuzzy palette.
   Sources: registered apps, open windows, halo:// destinations, recent VFS files.
------------------------------------------------------------------- */
class CommandPaletteMgr {
  constructor() {
    this.apps = [];
    this.haloDestinations = [];
    this.el = null;
    this.input = null;
    this.list = null;
    this.results = [];
    this.cursor = 0;
  }

  setApps(apps) { this.apps = apps; }
  setHaloDestinations(urls) { this.haloDestinations = urls; }

  ensure() {
    if (this.el) return;
    const root = document.createElement('div');
    root.id = 'halo-cmdk';
    root.className = 'halo-cmdk hidden';
    root.innerHTML = `
      <div class="halo-cmdk-panel">
        <div class="halo-cmdk-header">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="halo-cmdk-input" placeholder="Search apps, windows, pages, files..." autocomplete="off">
          <span class="halo-cmdk-hint">Esc</span>
        </div>
        <div class="halo-cmdk-list"></div>
        <div class="halo-cmdk-footer">
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    this.el = root;
    this.input = root.querySelector('.halo-cmdk-input');
    this.list = root.querySelector('.halo-cmdk-list');

    root.addEventListener('mousedown', (e) => {
      if (e.target === root) this.close();
    });
    this.input.addEventListener('input', () => this.update());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.execute(); }
    });
  }

  open() {
    this.ensure();
    this.el.classList.remove('hidden');
    this.input.value = '';
    this.cursor = 0;
    this.update();
    setTimeout(() => this.input.focus(), 50);
  }

  close() {
    if (!this.el) return;
    this.el.classList.add('hidden');
  }

  toggle() {
    if (!this.el || this.el.classList.contains('hidden')) this.open();
    else this.close();
  }

  _gatherSources() {
    const items = [];
    this.apps.forEach(a => {
      items.push({ kind: 'app', label: a.title, hint: 'App', icon: a.icon, action: () => a.launch() });
    });
    if (WM && WM.windows) {
      WM.windows.forEach(w => {
        items.push({ kind: 'win', label: w.title, hint: 'Open window', icon: w.icon, action: () => WM.focusWindow(w.id) });
      });
    }
    this.haloDestinations.forEach(u => {
      items.push({ kind: 'halo', label: u.url, hint: u.desc || 'halo://', icon: '🌐', action: () => u.action() });
    });
    try {
      const recent = VFS.ls('/Documents').concat(VFS.ls('/Desktop'));
      recent.forEach(f => {
        if (f.type === 'file') {
          items.push({ kind: 'file', label: f.name, hint: f.path, icon: '📄', action: async () => {
            const mod = await import('./apps/notepad.js');
            mod.default.launch(f.path);
          }});
        }
      });
    } catch (e) {}
    return items;
  }

  _fuzzy(q, items) {
    if (!q) return items.slice(0, 25);
    const lc = q.toLowerCase();
    const scored = [];
    items.forEach(it => {
      const label = it.label.toLowerCase();
      let s = 0;
      if (label === lc) s = 1000;
      else if (label.startsWith(lc)) s = 500;
      else if (label.includes(lc)) s = 100;
      else {
        // subsequence
        let i = 0;
        for (const c of label) { if (c === lc[i]) i++; if (i === lc.length) break; }
        if (i === lc.length) s = 10;
      }
      if (s > 0) scored.push({ it, s });
    });
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, 25).map(o => o.it);
  }

  update() {
    const q = this.input.value.trim();
    this.results = this._fuzzy(q, this._gatherSources());
    this.cursor = 0;
    this.render();
  }

  render() {
    this.list.innerHTML = '';
    if (!this.results.length) {
      this.list.innerHTML = `<div class="halo-cmdk-empty">No matches.</div>`;
      return;
    }
    this.results.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'halo-cmdk-row' + (i === this.cursor ? ' active' : '');
      row.innerHTML = `
        <span class="halo-cmdk-icon">${r.icon || ''}</span>
        <span class="halo-cmdk-label">${r.label}</span>
        <span class="halo-cmdk-hint">${r.hint}</span>
      `;
      row.addEventListener('click', () => { this.cursor = i; this.execute(); });
      this.list.appendChild(row);
    });
  }

  move(delta) {
    if (!this.results.length) return;
    this.cursor = (this.cursor + delta + this.results.length) % this.results.length;
    this.render();
    const active = this.list.querySelector('.halo-cmdk-row.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  execute() {
    const r = this.results[this.cursor];
    if (!r) return;
    this.close();
    try { r.action(); } catch (e) { Toast.error('Command failed'); console.error(e); }
  }
}

export const CommandPalette = new CommandPaletteMgr();

/* ------------------------------------------------------------------
   Init — wire global shortcut + register palette opener.
------------------------------------------------------------------- */
export function initUI(apps) {
  CommandPalette.setApps(apps || []);
  Shortcuts.register('global', 'ctrl+k', () => CommandPalette.toggle());
  Shortcuts.register('global', 'meta+k', () => CommandPalette.toggle());
}
