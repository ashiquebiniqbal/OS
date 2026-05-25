/**
 * halo://dictionary — DictionaryAPI definitions.
 */
export async function render(viewport, browser, tab, { params }) {
  const word = params.get('w') || '';
  browser.setTabTitle(tab, word ? `${word} — Dictionary` : 'Dictionary');

  viewport.innerHTML = `
    <div class="dict-root">
      <header class="dict-header">
        <h1>📖 Dictionary</h1>
        <form class="dict-search" id="dict-form">
          <input type="text" id="dict-q" value="${escapeHtml(word)}" placeholder="Look up a word…" autocomplete="off" autofocus>
          <button type="submit">Lookup</button>
        </form>
      </header>
      <div id="dict-body">${word ? `<div class="halo-loading"><span class="halo-spinner"></span>Looking up…</div>` : `<p class="dict-hint">Powered by api.dictionaryapi.dev — no key required.</p>`}</div>
    </div>
  `;

  viewport.querySelector('#dict-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = viewport.querySelector('#dict-q').value.trim();
    if (v) browser.navigate(`halo://dictionary?w=${encodeURIComponent(v)}`);
  });

  if (!word) return;

  const body = viewport.querySelector('#dict-body');
  try {
    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!r.ok) {
      body.innerHTML = `<div class="search-empty">No definition found for "${escapeHtml(word)}".</div>`;
      return;
    }
    const data = await r.json();
    body.innerHTML = data.map(entry => `
      <article class="dict-entry">
        <h2>${escapeHtml(entry.word)}</h2>
        ${entry.phonetic ? `<span class="dict-phonetic">${escapeHtml(entry.phonetic)}</span>` : ''}
        ${entry.meanings.map(m => `
          <section class="dict-meaning">
            <span class="dict-pos">${escapeHtml(m.partOfSpeech)}</span>
            <ol>
              ${m.definitions.map(d => `
                <li>
                  <span>${escapeHtml(d.definition)}</span>
                  ${d.example ? `<em>"${escapeHtml(d.example)}"</em>` : ''}
                </li>
              `).join('')}
            </ol>
          </section>
        `).join('')}
      </article>
    `).join('');
  } catch (e) {
    body.innerHTML = '<div class="search-error">Lookup failed.</div>';
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
