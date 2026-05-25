/**
 * halo://news — live Hacker News top stories (Firebase API + Algolia for content).
 */
export async function render(viewport, browser, tab) {
  browser.setTabTitle(tab, 'Hacker News — Halo');
  viewport.innerHTML = `
    <div class="news-root">
      <header class="news-header">
        <h1>Hacker News</h1>
        <span class="news-meta">Live feed · top stories</span>
      </header>
      <div class="news-list" id="news-list"><div class="halo-loading"><span class="halo-spinner"></span>Loading stories…</div></div>
    </div>
  `;
  try {
    const idsResp = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = (await idsResp.json()).slice(0, 25);
    const stories = await Promise.all(ids.map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
    ));
    const list = viewport.querySelector('#news-list');
    list.innerHTML = '';
    stories.forEach((s, i) => {
      if (!s) return;
      const item = document.createElement('div');
      item.className = 'news-item';
      const host = s.url ? new URL(s.url).hostname.replace(/^www\./, '') : 'news.ycombinator.com';
      item.innerHTML = `
        <div class="news-rank">${i + 1}</div>
        <div class="news-body">
          <a class="news-title" data-url="${s.url || `https://news.ycombinator.com/item?id=${s.id}`}">${escapeHtml(s.title)}</a>
          <div class="news-meta-row">
            <span class="news-host">${host}</span> ·
            <span>${s.score} pts</span> ·
            <span>by ${s.by}</span> ·
            <span>${s.descendants || 0} comments</span>
          </div>
        </div>
      `;
      item.querySelector('.news-title').addEventListener('click', (e) => {
        e.preventDefault();
        browser.navigate(s.url || `https://news.ycombinator.com/item?id=${s.id}`);
      });
      list.appendChild(item);
    });
  } catch (e) {
    viewport.querySelector('#news-list').innerHTML = '<div class="search-error">Could not reach Hacker News.</div>';
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
