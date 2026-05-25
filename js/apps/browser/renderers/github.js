/**
 * halo://github — trending repos and user search.
 */
export async function render(viewport, browser, tab, { params }) {
  const q = params.get('q') || '';
  browser.setTabTitle(tab, q ? `${q} — GitHub` : 'GitHub Trending');

  viewport.innerHTML = `
    <div class="gh-root">
      <header class="gh-header">
        <h1>🐙 GitHub</h1>
        <form class="gh-search" id="gh-form">
          <input type="text" id="gh-q" value="${escapeHtml(q)}" placeholder="Search repositories…" autocomplete="off">
          <button type="submit">Search</button>
        </form>
      </header>
      <div id="gh-body"><div class="halo-loading"><span class="halo-spinner"></span>Loading trending repos…</div></div>
    </div>
  `;
  viewport.querySelector('#gh-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = viewport.querySelector('#gh-q').value.trim();
    if (v) browser.navigate(`halo://github?q=${encodeURIComponent(v)}`);
  });

  const body = viewport.querySelector('#gh-body');
  const url = q
    ? `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=20`
    : `https://api.github.com/search/repositories?q=stars:>10000&sort=stars&order=desc&per_page=20`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    if (!data.items) throw new Error('rate-limited');
    body.innerHTML = `<div class="gh-grid">${data.items.map(repo => `
      <a class="gh-card" data-url="${repo.html_url}">
        <div class="gh-card-head">
          <strong>${escapeHtml(repo.full_name)}</strong>
          <span class="gh-card-star">★ ${repo.stargazers_count.toLocaleString()}</span>
        </div>
        <p>${escapeHtml(repo.description || '')}</p>
        <div class="gh-card-meta">${escapeHtml(repo.language || '')} · ${repo.forks_count} forks · updated ${new Date(repo.pushed_at).toLocaleDateString()}</div>
      </a>
    `).join('')}</div>`;
    body.querySelectorAll('[data-url]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); browser.navigate(el.dataset.url); });
    });
  } catch (e) {
    body.innerHTML = '<div class="search-error">GitHub API unavailable (rate-limit or network).</div>';
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
