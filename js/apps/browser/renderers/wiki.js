/**
 * halo://wiki — Wikipedia reader (search + article view).
 */
import { Store } from '../persistence.js';

export async function render(viewport, browser, tab, { params }) {
  const q = params.get('q') || '';
  browser.setTabTitle(tab, q ? `${q} — Wikipedia` : 'Wikipedia');

  viewport.innerHTML = `
    <div class="wiki-root">
      <header class="wiki-header">
        <h1>Wikipedia</h1>
        <form class="wiki-search" id="wiki-form">
          <input type="text" id="wiki-q" value="${escapeHtml(q)}" placeholder="Search Wikipedia…" autocomplete="off" autofocus>
          <button type="submit">Search</button>
        </form>
      </header>
      <div id="wiki-body">
        ${q ? `<div class="halo-loading"><span class="halo-spinner"></span>Loading…</div>` : `<p class="wiki-hint">The free encyclopedia, fetched live from en.wikipedia.org.</p>`}
      </div>
    </div>
  `;

  viewport.querySelector('#wiki-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = viewport.querySelector('#wiki-q').value.trim();
    if (v) browser.navigate(`halo://wiki?q=${encodeURIComponent(v)}`);
  });

  if (!q) return;

  // Try to fetch article directly; if no exact match, fall back to search.
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
    if (r.ok) {
      const data = await r.json();
      if (data.type !== 'disambiguation' && data.extract) {
        renderArticle(viewport, browser, tab, data, q);
        return;
      }
    }
  } catch (e) {}

  // Fall back to search results
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=12`);
    const data = await r.json();
    const body = viewport.querySelector('#wiki-body');
    if (!body) return; // viewport navigated away while we were fetching
    body.innerHTML = '<h3 class="wiki-results-title">Search results</h3>';
    const list = document.createElement('div');
    list.className = 'wiki-results';
    (data?.query?.search || []).forEach(s => {
      const item = document.createElement('div');
      item.className = 'wiki-result';
      item.innerHTML = `<h4>${escapeHtml(s.title)}</h4><p>${s.snippet}…</p>`;
      item.addEventListener('click', () => browser.navigate(`halo://wiki?q=${encodeURIComponent(s.title)}`));
      list.appendChild(item);
    });
    body.appendChild(list);
  } catch (e) {
    const body = viewport.querySelector('#wiki-body');
    if (body) body.innerHTML = '<div class="search-error">Search failed.</div>';
  }
}

function renderArticle(viewport, browser, tab, data, slug) {
  browser.setTabTitle(tab, `${data.title} — Wikipedia`);
  const body = viewport.querySelector('#wiki-body');
  if (!body) return; // viewport navigated away
  body.innerHTML = `
    <article class="wiki-article">
      ${data.thumbnail ? `<img class="wiki-thumb" src="${data.thumbnail.source}" alt="">` : ''}
      <h2>${escapeHtml(data.title)}</h2>
      <p class="wiki-meta">${escapeHtml(data.description || '')}</p>
      <p class="wiki-extract">${escapeHtml(data.extract)}</p>
      <div class="wiki-actions">
        <button id="wiki-save-reading">📑 Save to reading list</button>
        <a class="wiki-source" target="_blank" rel="noopener" href="${data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`}">Open on wikipedia.org ↗</a>
      </div>
    </article>
  `;
  body.querySelector('#wiki-save-reading').addEventListener('click', () => {
    const ok = Store.addReading({
      title: data.title,
      url: `halo://wiki?q=${encodeURIComponent(slug)}`,
      excerpt: data.extract.slice(0, 240),
      source: 'wikipedia',
    });
    body.querySelector('#wiki-save-reading').textContent = ok ? '✓ Saved' : 'Already saved';
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
