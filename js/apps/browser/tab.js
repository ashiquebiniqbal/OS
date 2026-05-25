/**
 * Tab model. Each tab owns its own back/forward history.
 */
let nextId = 1;

export class Tab {
  constructor({ url = 'halo://newtab', pinned = false, incognito = false } = {}) {
    this.id = 't' + (nextId++);
    this.url = url;
    this.title = 'New Tab';
    this.favicon = null;
    this.history = [url];
    this.historyIndex = 0;
    this.pinned = pinned;
    this.incognito = incognito;
    this.scrollY = 0;
    this.loading = false;
    this.color = null; // tab group color
  }

  canBack() { return this.historyIndex > 0; }
  canForward() { return this.historyIndex < this.history.length - 1; }

  navigate(url) {
    // Truncate forward stack on new nav
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(url);
    this.historyIndex = this.history.length - 1;
    this.url = url;
  }

  back() {
    if (!this.canBack()) return null;
    this.historyIndex--;
    this.url = this.history[this.historyIndex];
    return this.url;
  }

  forward() {
    if (!this.canForward()) return null;
    this.historyIndex++;
    this.url = this.history[this.historyIndex];
    return this.url;
  }

  reload() { return this.url; }
}
