/**
 * halo://extensions — toggleable built-in "extensions". State stored in settings.
 */
import { Store } from '../persistence.js';

const EXTENSIONS = [
  { id: 'dark-reader', name: 'Reading Mode', desc: 'Strip styles from articles for distraction-free reading. Toggle per page from the menu.', icon: '🌙' },
  { id: 'tracker-counter', name: 'Tracker Counter', desc: 'Show a counter of blocked third-party hosts per page in the toolbar.', icon: '🛡️' },
  { id: 'screenshot', name: 'Page Screenshot', desc: 'Capture the current page as PNG to your Downloads folder.', icon: '📷' },
  { id: 'find-highlight', name: 'Persistent Find', desc: 'Remember the last find query so Ctrl+F resumes from where you left off.', icon: '🔍' },
];

export async function render(viewport, browser, tab) {
  browser.setTabTitle(tab, 'Extensions');
  const s = Store.loadSettings();
  if (!s.extensions) s.extensions = {};
  viewport.innerHTML = `
    <div class="ext-root">
      <header class="ext-header"><h1>Halo Extensions</h1><span class="ext-meta">Built-in, sandboxed. No store, no third parties.</span></header>
      <div class="ext-grid">
        ${EXTENSIONS.map(e => `
          <div class="ext-card">
            <div class="ext-ico">${e.icon}</div>
            <div class="ext-meta-col">
              <strong>${e.name}</strong>
              <p>${e.desc}</p>
            </div>
            <label class="ext-toggle">
              <input type="checkbox" data-id="${e.id}" ${s.extensions[e.id] ? 'checked' : ''}>
              <span class="ext-slider"></span>
            </label>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  viewport.querySelectorAll('input[data-id]').forEach(el => {
    el.addEventListener('change', () => {
      const ext = { ...Store.loadSettings().extensions, [el.dataset.id]: el.checked };
      Store.saveSettings({ extensions: ext });
    });
  });
}
