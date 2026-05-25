/**
 * halo://weather — Open-Meteo, with city search via geocoding API.
 */
export async function render(viewport, browser, tab, { params }) {
  const city = params.get('city') || '';
  browser.setTabTitle(tab, city ? `Weather — ${city}` : 'Weather');

  viewport.innerHTML = `
    <div class="weather-root">
      <header class="weather-header">
        <h1>Weather</h1>
        <form class="weather-search" id="weather-form">
          <input type="text" id="weather-q" value="${escapeHtml(city)}" placeholder="City name (e.g. Tokyo)…" autocomplete="off">
          <button type="submit">Search</button>
          <button type="button" id="weather-locate">📍 Use my location</button>
        </form>
      </header>
      <div id="weather-body"><p class="weather-hint">Enter a city or use your location.</p></div>
    </div>
  `;

  viewport.querySelector('#weather-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = viewport.querySelector('#weather-q').value.trim();
    if (v) browser.navigate(`halo://weather?city=${encodeURIComponent(v)}`);
  });

  viewport.querySelector('#weather-locate').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p => {
      loadWeather(viewport.querySelector('#weather-body'), p.coords.latitude, p.coords.longitude, 'My location');
    }, () => {
      viewport.querySelector('#weather-body').innerHTML = '<div class="search-error">Location permission denied.</div>';
    });
  });

  if (!city) return;

  // Geocode then fetch
  const body = viewport.querySelector('#weather-body');
  body.innerHTML = `<div class="halo-loading"><span class="halo-spinner"></span>Finding ${escapeHtml(city)}…</div>`;
  try {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const gd = await geo.json();
    if (!gd.results || !gd.results.length) {
      body.innerHTML = `<div class="search-empty">City not found: ${escapeHtml(city)}</div>`;
      return;
    }
    const place = gd.results[0];
    await loadWeather(body, place.latitude, place.longitude, `${place.name}, ${place.country}`);
  } catch (e) {
    body.innerHTML = '<div class="search-error">Weather lookup failed.</div>';
  }
}

async function loadWeather(body, lat, lon, label) {
  body.innerHTML = `<div class="halo-loading"><span class="halo-spinner"></span>Loading forecast…</div>`;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`);
    const data = await r.json();
    const cw = data.current_weather;
    const daily = data.daily;
    body.innerHTML = `
      <div class="weather-now-card">
        <h2>${escapeHtml(label)}</h2>
        <div class="weather-now-big">${Math.round(cw.temperature)}°C</div>
        <div class="weather-now-meta">${weatherEmoji(cw.weathercode)} ${weatherText(cw.weathercode)} · Wind ${Math.round(cw.windspeed)} km/h</div>
      </div>
      <div class="weather-week">
        ${daily.time.map((d, i) => `
          <div class="weather-day">
            <span class="weather-day-label">${new Date(d).toLocaleDateString(undefined, { weekday: 'short' })}</span>
            <span class="weather-day-ico">${weatherEmoji(daily.weathercode[i])}</span>
            <span class="weather-day-temp">${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    body.innerHTML = '<div class="search-error">Forecast unavailable.</div>';
  }
}

function weatherEmoji(c) {
  if (c === 0) return '☀️';
  if (c < 3) return '🌤️';
  if (c < 50) return '☁️';
  if (c < 70) return '🌧️';
  if (c < 80) return '❄️';
  return '⛈️';
}
function weatherText(c) {
  if (c === 0) return 'Clear';
  if (c < 3) return 'Mostly clear';
  if (c < 50) return 'Cloudy';
  if (c < 70) return 'Rain';
  if (c < 80) return 'Snow';
  return 'Thunder';
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
