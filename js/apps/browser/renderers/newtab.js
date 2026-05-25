import { Store } from '../persistence.js';

const TOP_HALO = [
  { url: 'halo://search', label: 'Search', icon: '🔍' },
  { url: 'halo://news', label: 'Hacker News', icon: '📰' },
  { url: 'halo://wiki', label: 'Wikipedia', icon: '📚' },
  { url: 'halo://weather', label: 'Weather', icon: '⛅' },
  { url: 'halo://github', label: 'GitHub', icon: '🐙' },
  { url: 'halo://dictionary', label: 'Dictionary', icon: '📖' },
  { url: 'halo://snake', label: 'Games', icon: '🎮' },
  { url: 'halo://reading-list', label: 'Reading List', icon: '📑' },
];

export async function render(viewport, browser, tab) {
  browser.setTabTitle(tab, 'New Tab');
  const hist = Store.loadHistory().slice(0, 8);
  const topSites = topFromHistory(Store.loadHistory());

  viewport.innerHTML = `
    <div class="newtab-root">
      <div class="newtab-logo">HALO</div>
      <form class="newtab-search" id="newtab-search-form">
        <input type="text" id="newtab-q" placeholder="Search Wikipedia, Hacker News, GitHub, or type a halo:// URL…" autocomplete="off">
        <button type="submit">Go</button>
      </form>
      <div class="newtab-grid">
        ${TOP_HALO.map(s => `
          <button class="newtab-tile" data-url="${s.url}">
            <span class="newtab-tile-ico">${s.icon}</span>
            <span class="newtab-tile-label">${s.label}</span>
          </button>
        `).join('')}
      </div>
      ${topSites.length ? `
        <h3 class="newtab-section">Frequently visited</h3>
        <div class="newtab-frequent">
          ${topSites.map(s => `
            <button class="newtab-frequent-item" data-url="${s.url}">
              <strong>${escapeHtml(s.title || s.url)}</strong>
              <small>${escapeHtml(s.url)}</small>
            </button>
          `).join('')}
        </div>
      ` : ''}
      <div class="newtab-widgets">
        <div class="newtab-widget" id="weather-widget">
          <h4>Weather</h4>
          <div id="weather-widget-body">Detecting location…</div>
        </div>
        <div class="newtab-widget" id="featured-widget">
          <h4>Featured Article</h4>
          <div id="featured-widget-body">Loading…</div>
        </div>
      </div>
    </div>
  `;

  viewport.querySelector('#newtab-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = viewport.querySelector('#newtab-q').value.trim();
    if (!q) return;
    if (q.startsWith('halo://') || q.startsWith('http://') || q.startsWith('https://')) {
      browser.navigate(q);
    } else {
      browser.navigate(`halo://search?q=${encodeURIComponent(q)}`);
    }
  });

  viewport.querySelectorAll('[data-url]').forEach(el => {
    el.addEventListener('click', () => browser.navigate(el.dataset.url));
  });

  loadWeatherWidget(viewport.querySelector('#weather-widget-body'));
  loadFeaturedWidget(viewport.querySelector('#featured-widget-body'), browser);
}

function topFromHistory(hist) {
  const counts = new Map();
  hist.forEach(h => {
    const c = counts.get(h.url) || { url: h.url, title: h.title, n: 0 };
    c.n++;
    counts.set(h.url, c);
  });
  return Array.from(counts.values())
    .filter(c => !c.url.startsWith('halo://newtab') && !c.url.startsWith('halo://error'))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
}

function loadWeatherWidget(el) {
  if (!navigator.geolocation) { el.textContent = 'Geolocation unavailable.'; return; }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { latitude, longitude } = pos.coords;
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
      const data = await r.json();
      const w = data.current_weather;
      el.innerHTML = `<div class="weather-now"><strong>${w.temperature}°C</strong><span>Wind ${w.windspeed} km/h</span></div>`;
    } catch (e) {
      el.textContent = 'Weather unavailable.';
    }
  }, () => { el.textContent = 'Permission denied.'; });
}

async function loadFeaturedWidget(el, browser) {
  try {
    const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
    const data = await r.json();
    el.innerHTML = `
      <strong>${escapeHtml(data.title)}</strong>
      <p>${escapeHtml((data.extract || '').slice(0, 220))}…</p>
      <button class="newtab-widget-link" id="featured-read">Read article</button>
    `;
    el.querySelector('#featured-read').addEventListener('click', () => {
      browser.navigate(`halo://wiki?q=${encodeURIComponent(data.title)}`);
    });
  } catch (e) {
    el.textContent = 'Featured article unavailable.';
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
