/**
 * URL router. Maps halo:// URLs to renderer modules.
 * For http(s) URLs, dispatches to iframe-fallback (which routes to halo://error for blocked sites).
 */
import * as newtab from './renderers/newtab.js';
import * as search from './renderers/search.js';
import * as history from './renderers/history.js';
import * as bookmarks from './renderers/bookmarks.js';
import * as downloads from './renderers/downloads.js';
import * as settings from './renderers/settings.js';
import * as readingList from './renderers/reading-list.js';
import * as extensions from './renderers/extensions.js';
import * as devtools from './renderers/devtools.js';
import * as news from './renderers/news.js';
import * as wiki from './renderers/wiki.js';
import * as weather from './renderers/weather.js';
import * as github from './renderers/github.js';
import * as dictionary from './renderers/dictionary.js';
import * as games from './renderers/games.js';
import * as about from './renderers/about.js';
import * as error from './renderers/error.js';
import * as iframeFallback from './renderers/iframe-fallback.js';

const REGISTRY = {
  'halo://newtab': newtab,
  'halo://search': search,
  'halo://history': history,
  'halo://bookmarks': bookmarks,
  'halo://downloads': downloads,
  'halo://settings': settings,
  'halo://reading-list': readingList,
  'halo://extensions': extensions,
  'halo://devtools': devtools,
  'halo://news': news,
  'halo://wiki': wiki,
  'halo://weather': weather,
  'halo://github': github,
  'halo://dictionary': dictionary,
  'halo://snake': games,
  'halo://2048': games,
  'halo://tetris': games,
  'halo://about': about,
  'halo://error': error,
};

export const HALO_DESTINATIONS = Object.keys(REGISTRY).filter(u => u !== 'halo://error');

export function parse(url) {
  // halo://name or halo://name?query — returns { base, query, params }
  if (url.startsWith('halo://')) {
    const u = new URL(url.replace('halo://', 'halo:///'));
    return {
      isInternal: true,
      base: `halo://${u.pathname.replace(/^\//, '')}`.replace(/\/$/, ''),
      params: u.searchParams,
    };
  }
  return { isInternal: false, base: url, params: new URLSearchParams() };
}

export async function render(url, viewport, browser, tab) {
  viewport.scrollTop = 0;
  viewport.innerHTML = `<div class="halo-loading"><span class="halo-spinner"></span><span>Loading…</span></div>`;
  const parsed = parse(url);

  if (parsed.isInternal) {
    const mod = REGISTRY[parsed.base];
    if (!mod) {
      return error.render(viewport, browser, tab, { code: 'PAGE_NOT_FOUND', url });
    }
    try {
      await mod.render(viewport, browser, tab, { params: parsed.params });
    } catch (e) {
      console.error('[router]', e);
      return error.render(viewport, browser, tab, { code: 'RENDER_ERROR', url, message: e.message });
    }
  } else {
    await iframeFallback.render(viewport, browser, tab, { url });
  }
}
