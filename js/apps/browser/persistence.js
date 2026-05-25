import { VFS } from '../../fs.js';

/**
 * Browser persistence layer.
 * Debounced writes; cap history at 1000 entries (LRU); batch on beforeunload.
 * All state under /System/Browser/*.json in the VFS.
 */
const BASE = '/System/Browser';
const FILES = {
  session: `${BASE}/session.json`,
  history: `${BASE}/history.json`,
  bookmarks: `${BASE}/bookmarks.json`,
  downloads: `${BASE}/downloads.json`,
  readingList: `${BASE}/reading-list.json`,
  settings: `${BASE}/settings.json`,
};
const HISTORY_CAP = 1000;
const DEBOUNCE_MS = 1500;

const DEFAULT_SETTINGS = {
  homepage: 'halo://newtab',
  searchEngine: 'wikipedia',
  trackerBlocking: true,
  readerProxy: false,
  restoreTabs: true,
  defaultZoom: 1.0,
};

const DEFAULT_BOOKMARKS = [
  { id: 'b1', title: 'New Tab', url: 'halo://newtab', icon: '⭐' },
  { id: 'b2', title: 'Search', url: 'halo://search', icon: '🔍' },
  { id: 'b3', title: 'News', url: 'halo://news', icon: '📰' },
  { id: 'b4', title: 'Weather', url: 'halo://weather', icon: '⛅' },
  { id: 'b5', title: 'GitHub Trending', url: 'halo://github', icon: '🐙' },
  { id: 'b6', title: 'Wikipedia', url: 'halo://wiki', icon: '📚' },
  { id: 'b7', title: 'Dictionary', url: 'halo://dictionary', icon: '📖' },
];

class Persistence {
  constructor() {
    this._timer = null;
    this._dirty = new Set();
    this._cache = {};
    window.addEventListener('beforeunload', () => this.flush());
  }

  _ensureDir() {
    if (!VFS.exists(BASE)) VFS.mkdir(BASE);
  }

  _read(file, fallback) {
    try {
      const raw = VFS.read(file);
      if (raw == null) return structuredClone(fallback);
      return JSON.parse(raw);
    } catch (e) {
      return structuredClone(fallback);
    }
  }

  _scheduleWrite(key) {
    this._dirty.add(key);
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.flush();
    }, DEBOUNCE_MS);
  }

  flush() {
    if (!this._dirty.size) return;
    this._ensureDir();
    this._dirty.forEach(k => {
      try { VFS.write(FILES[k], JSON.stringify(this._cache[k])); }
      catch (e) { console.error('[browser persist]', k, e); }
    });
    this._dirty.clear();
  }

  /* ---- Session (open tabs) ---- */
  loadSession() {
    if (!this._cache.session) this._cache.session = this._read(FILES.session, { tabs: [], activeId: null });
    return this._cache.session;
  }
  saveSession(tabs, activeId) {
    this._cache.session = {
      tabs: tabs.filter(t => !t.incognito).map(t => ({
        id: t.id, url: t.url, title: t.title, pinned: t.pinned, color: t.color || null,
      })),
      activeId,
    };
    this._scheduleWrite('session');
  }

  /* ---- History ---- */
  loadHistory() {
    if (!this._cache.history) this._cache.history = this._read(FILES.history, []);
    return this._cache.history;
  }
  pushHistory(entry) {
    const h = this.loadHistory();
    // Dedupe: if same URL as most recent, just bump timestamp
    if (h.length && h[0].url === entry.url) {
      h[0].ts = entry.ts;
      h[0].title = entry.title || h[0].title;
    } else {
      h.unshift(entry);
    }
    if (h.length > HISTORY_CAP) h.length = HISTORY_CAP;
    this._scheduleWrite('history');
  }
  clearHistory() {
    this._cache.history = [];
    this._scheduleWrite('history');
  }

  /* ---- Bookmarks ---- */
  loadBookmarks() {
    if (!this._cache.bookmarks) this._cache.bookmarks = this._read(FILES.bookmarks, DEFAULT_BOOKMARKS);
    return this._cache.bookmarks;
  }
  addBookmark(b) {
    const list = this.loadBookmarks();
    if (list.some(x => x.url === b.url)) return false;
    list.push({ id: 'b' + Date.now(), ...b });
    this._scheduleWrite('bookmarks');
    return true;
  }
  removeBookmark(url) {
    const list = this.loadBookmarks();
    const idx = list.findIndex(b => b.url === url);
    if (idx >= 0) { list.splice(idx, 1); this._scheduleWrite('bookmarks'); return true; }
    return false;
  }
  isBookmarked(url) {
    return this.loadBookmarks().some(b => b.url === url);
  }

  /* ---- Downloads ---- */
  loadDownloads() {
    if (!this._cache.downloads) this._cache.downloads = this._read(FILES.downloads, []);
    return this._cache.downloads;
  }
  addDownload(d) {
    const list = this.loadDownloads();
    list.unshift({ id: 'd' + Date.now(), ts: Date.now(), ...d });
    if (list.length > 200) list.length = 200;
    this._scheduleWrite('downloads');
  }

  /* ---- Reading list ---- */
  loadReadingList() {
    if (!this._cache.readingList) this._cache.readingList = this._read(FILES.readingList, []);
    return this._cache.readingList;
  }
  addReading(item) {
    const list = this.loadReadingList();
    if (list.some(x => x.url === item.url)) return false;
    list.unshift({ id: 'r' + Date.now(), ts: Date.now(), ...item });
    if (list.length > 100) list.length = 100;
    this._scheduleWrite('readingList');
    return true;
  }
  removeReading(id) {
    const list = this.loadReadingList();
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) { list.splice(idx, 1); this._scheduleWrite('readingList'); }
  }

  /* ---- Settings ---- */
  loadSettings() {
    if (!this._cache.settings) this._cache.settings = { ...DEFAULT_SETTINGS, ...this._read(FILES.settings, {}) };
    return this._cache.settings;
  }
  saveSettings(patch) {
    Object.assign(this.loadSettings(), patch);
    this._scheduleWrite('settings');
  }
}

export const Store = new Persistence();
