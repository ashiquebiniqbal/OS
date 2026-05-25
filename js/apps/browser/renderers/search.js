/**
 * halo://search?q=... — multi-engine results (Wikipedia + Hacker News Algolia + GitHub repos).
 */
export async function render(viewport, browser, tab, { params }) {
  const q = params.get('q') || '';
  browser.setTabTitle(tab, q ? `${q} — Halo Search` : 'Search');

  viewport.innerHTML = `
    <div class="search-root">
      <form class="search-bar" id="search-form">
        <input type="text" id="search-q" value="${escapeHtml(q)}" placeholder="Search the open web…" autocomplete="off" autofocus>
        <button type="submit">Search</button>
      </form>
      <div class="search-tabs">
        <button class="search-tab active" data-engine="all">All</button>
        <button class="search-tab" data-engine="wiki">Wikipedia</button>
        <button class="search-tab" data-engine="hn">Hacker News</button>
        <button class="search-tab" data-engine="gh">GitHub</button>
      </div>
      <div class="search-results" id="search-results"></div>
    </div>
  `;

  const form = viewport.querySelector('#search-form');
  const input = viewport.querySelector('#search-q');
  let engine = 'all';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const newQ = input.value.trim();
    if (newQ) browser.navigate(`halo://search?q=${encodeURIComponent(newQ)}`);
  });

  viewport.querySelectorAll('.search-tab').forEach(t => {
    t.addEventListener('click', () => {
      viewport.querySelectorAll('.search-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      engine = t.dataset.engine;
      runSearch(q, engine, viewport, browser);
    });
  });

  if (q) await runSearch(q, engine, viewport, browser);
  else viewport.querySelector('#search-results').innerHTML = '<div class="search-empty">Enter a query to search the open web.</div>';
}

async function runSearch(q, engine, viewport, browser) {
  const out = viewport.querySelector('#search-results');
  out.innerHTML = '<div class="halo-loading"><span class="halo-spinner"></span>Searching…</div>';

  const fetches = [];
  if (engine === 'all' || engine === 'wiki') fetches.push(searchWiki(q));
  if (engine === 'all' || engine === 'hn') fetches.push(searchHN(q));
  if (engine === 'all' || engine === 'gh') fetches.push(searchGH(q));

  const results = (await Promise.all(fetches)).flat();
  out.innerHTML = '';
  if (!results.length) {
    out.innerHTML = '<div class="search-empty">No results.</div>';
    return;
  }
  results.forEach(r => {
    const card = document.createElement('div');
    card.className = 'search-result';
    card.innerHTML = `
      <span class="search-result-engine ${r.engine}">${r.engineLabel}</span>
      <h4>${escapeHtml(r.title)}</h4>
      <small>${escapeHtml(r.url)}</small>
      <p>${r.snippet || ''}</p>
    `;
    card.addEventListener('click', () => browser.navigate(r.haloUrl || r.url));
    out.appendChild(card);
  });
}

async function searchWiki(q) {
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=8`);
    const data = await r.json();
    return data.query.search.map(s => ({
      engine: 'wiki', engineLabel: 'Wikipedia',
      title: s.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title)}`,
      haloUrl: `halo://wiki?q=${encodeURIComponent(s.title)}`,
      snippet: s.snippet,
    }));
  } catch (e) { return []; }
}

async function searchHN(q) {
  try {
    const r = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&hitsPerPage=6`);
    const data = await r.json();
    return data.hits.map(h => ({
      engine: 'hn', engineLabel: 'Hacker News',
      title: h.title || h.story_title || '(comment)',
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      snippet: `${h.points || 0} pts · ${h.num_comments || 0} comments · by ${h.author}`,
    }));
  } catch (e) { return []; }
}

async function searchGH(q) {
  try {
    const r = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=6`);
    const data = await r.json();
    return (data.items || []).map(g => ({
      engine: 'gh', engineLabel: 'GitHub',
      title: g.full_name,
      url: g.html_url,
      snippet: `★ ${g.stargazers_count.toLocaleString()} — ${escapeHtml(g.description || '')}`,
    }));
  } catch (e) { return []; }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
