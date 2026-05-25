/**
 * Omnibox (address bar) with debounced multi-source suggestions.
 * Sources: halo:// matches, history matches, bookmark matches, Wikipedia opensearch.
 */
import { Store } from './persistence.js';
import { HALO_DESTINATIONS } from './router.js';

export class Omnibox {
  constructor(browser, hostEl) {
    this.browser = browser;
    this.host = hostEl;
    this.suggestions = [];
    this.cursor = 0;
    this._debounceTimer = null;
    this._abort = null;
    this.build();
  }

  build() {
    this.host.innerHTML = `
      <div class="omni-wrap">
        <span class="omni-icon" id="omni-secure">🔒</span>
        <input type="text" class="omni-input" id="omni-input" placeholder="Search or type a URL…" autocomplete="off" spellcheck="false" aria-label="Address and search bar" role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="omni-suggest-list">
        <button class="omni-action" id="omni-bookmark" title="Bookmark this page (Ctrl+D)" aria-label="Bookmark">☆</button>
      </div>
      <ul class="omni-suggest" id="omni-suggest-list" role="listbox" hidden></ul>
    `;
    this.input = this.host.querySelector('#omni-input');
    this.list = this.host.querySelector('#omni-suggest-list');
    this.bookmarkBtn = this.host.querySelector('#omni-bookmark');

    this.input.addEventListener('input', () => this._scheduleSuggest());
    this.input.addEventListener('keydown', (e) => this._key(e));
    this.input.addEventListener('focus', () => { this.input.select(); this._scheduleSuggest(); });
    this.input.addEventListener('blur', () => setTimeout(() => this.hideSuggest(), 120));

    this.bookmarkBtn.addEventListener('click', () => {
      const t = this.browser.activeTab();
      if (!t) return;
      if (Store.isBookmarked(t.url)) {
        Store.removeBookmark(t.url);
      } else {
        Store.addBookmark({ title: t.title || t.url, url: t.url, icon: '🔖' });
      }
      this.refreshBookmarkState();
    });
  }

  setUrl(url, isSecure) {
    if (document.activeElement !== this.input) this.input.value = url;
    this.host.querySelector('#omni-secure').textContent = isSecure ? '🔒' : (url.startsWith('halo://') ? '◈' : '⚠');
    this.refreshBookmarkState();
  }

  refreshBookmarkState() {
    const t = this.browser.activeTab();
    if (!t) return;
    this.bookmarkBtn.textContent = Store.isBookmarked(t.url) ? '★' : '☆';
    this.bookmarkBtn.classList.toggle('on', Store.isBookmarked(t.url));
  }

  focus() {
    this.input.focus();
    this.input.select();
  }

  _scheduleSuggest() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._suggest(), 130);
  }

  async _suggest() {
    const q = this.input.value.trim();
    const out = [];
    if (!q) {
      // surface recent history when empty
      const hist = Store.loadHistory().slice(0, 6);
      hist.forEach(h => out.push({ kind: 'history', label: h.title || h.url, hint: h.url, url: h.url }));
      this.suggestions = out;
      this.cursor = 0;
      this.renderSuggest();
      return;
    }

    // halo:// matches
    HALO_DESTINATIONS.forEach(u => {
      if (u.includes(q.toLowerCase())) out.push({ kind: 'halo', label: u, hint: 'Internal', url: u });
    });

    // history & bookmark matches
    const lc = q.toLowerCase();
    Store.loadHistory().slice(0, 200).forEach(h => {
      if ((h.title || '').toLowerCase().includes(lc) || h.url.toLowerCase().includes(lc)) {
        out.push({ kind: 'history', label: h.title || h.url, hint: h.url, url: h.url });
      }
    });
    Store.loadBookmarks().forEach(b => {
      if (b.title.toLowerCase().includes(lc) || b.url.toLowerCase().includes(lc)) {
        out.push({ kind: 'bookmark', label: b.title, hint: b.url, url: b.url });
      }
    });

    // dedupe by url, cap
    const seen = new Set();
    const deduped = [];
    for (const it of out) {
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      deduped.push(it);
      if (deduped.length >= 8) break;
    }

    // Wikipedia opensearch for general queries (async)
    if (!q.startsWith('halo://') && !q.startsWith('http')) {
      try {
        if (this._abort) this._abort.abort();
        this._abort = new AbortController();
        const r = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&format=json&origin=*`, { signal: this._abort.signal });
        const data = await r.json();
        (data[1] || []).forEach((t, i) => {
          if (!seen.has(`halo://wiki?q=${encodeURIComponent(t)}`)) {
            deduped.push({ kind: 'wiki', label: t, hint: data[2][i] || '', url: `halo://wiki?q=${encodeURIComponent(t)}` });
          }
        });
      } catch (e) { /* aborted */ }
    }

    // Top-level "search for…" item
    deduped.unshift({ kind: 'search', label: `Search for "${q}"`, hint: 'halo://search', url: `halo://search?q=${encodeURIComponent(q)}` });

    this.suggestions = deduped.slice(0, 9);
    this.cursor = 0;
    this.renderSuggest();
  }

  renderSuggest() {
    if (!this.suggestions.length) { this.hideSuggest(); return; }
    this.list.innerHTML = '';
    this.suggestions.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = `omni-suggest-item ${i === this.cursor ? 'active' : ''}`;
      li.setAttribute('role', 'option');
      li.innerHTML = `
        <span class="omni-suggest-kind k-${s.kind}">${s.kind}</span>
        <span class="omni-suggest-label">${escapeHtml(s.label)}</span>
        <span class="omni-suggest-hint">${escapeHtml(s.hint)}</span>
      `;
      li.addEventListener('mousedown', (e) => { e.preventDefault(); this.cursor = i; this.commit(); });
      this.list.appendChild(li);
    });
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  hideSuggest() {
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
  }

  _key(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); this.commit(); }
    else if (e.key === 'Escape') { this.hideSuggest(); }
  }
  move(d) {
    if (!this.suggestions.length) return;
    this.cursor = (this.cursor + d + this.suggestions.length) % this.suggestions.length;
    this.renderSuggest();
  }
  commit() {
    let url;
    if (this.suggestions.length && this.list.hidden === false) {
      url = this.suggestions[this.cursor].url;
    } else {
      url = this.input.value.trim();
      if (!url) return;
      if (!url.startsWith('halo://') && !/^https?:\/\//.test(url)) {
        // No scheme — treat as search unless it's a bare domain
        if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(url)) url = 'https://' + url;
        else url = `halo://search?q=${encodeURIComponent(url)}`;
      }
    }
    this.hideSuggest();
    this.browser.navigate(url);
  }
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
