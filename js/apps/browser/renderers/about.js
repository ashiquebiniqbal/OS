export async function render(viewport, browser, tab) {
  browser.setTabTitle(tab, 'About Halo');
  viewport.innerHTML = `
    <div class="about-root">
      <div class="about-card">
        <h1>Halo Browser</h1>
        <p class="about-tag">Sovereign-class web browser, sandboxed inside Halo OS.</p>
        <dl class="about-grid">
          <dt>Version</dt><dd>2.0.0 "Aurora"</dd>
          <dt>Engine</dt><dd>Host browser (WebKit/Blink/Gecko)</dd>
          <dt>Storage</dt><dd>localStorage VFS at /System/Browser/*</dd>
          <dt>Network</dt><dd>Direct user→origin fetches; no Halo proxy</dd>
          <dt>Telemetry</dt><dd>None</dd>
        </dl>
        <p class="about-architect">Architected like a small browser: per-tab back/forward stacks, omnibox with multi-engine suggestions, halo:// internal pages registry, persistent session restore, debounced LRU history.</p>
        <p class="about-credits">Live data: Wikipedia, Hacker News, GitHub, Open-Meteo, DictionaryAPI. All public, no auth required.</p>
      </div>
    </div>
  `;
}
