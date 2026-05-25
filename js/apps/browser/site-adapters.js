/**
 * Site Adapters — per-domain URL rewriting for embeddability.
 *
 * Most popular sites send X-Frame-Options: DENY/SAMEORIGIN or a
 * `frame-ancestors` CSP and refuse to render inside an iframe. We can't
 * bypass that client-side (the host browser enforces it), but many of
 * those same sites publish *official* embed endpoints — YouTube has
 * /embed/<id>, Vimeo has player.vimeo.com/video/<id>, etc.
 *
 * Each adapter:
 *   - `match(url, parsed)` → boolean
 *   - `transform(url, parsed)` → { url, mode } where mode is one of:
 *       'iframe'   — render the returned URL in a sandboxed iframe
 *       'reader'   — render via Reader Proxy (text-only)
 *       'external' — show an "open in real browser" card immediately
 *       'route'    — redirect to a halo:// internal page
 *
 * Order matters: first match wins.
 */

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const KNOWN_BLOCKED = new Set([
  // Sites that send XFO/CSP-frame-ancestors and have no public embed endpoint.
  'google.com', 'www.google.com',
  'facebook.com', 'www.facebook.com',
  'instagram.com', 'www.instagram.com',
  'twitter.com', 'x.com', 'www.twitter.com', 'www.x.com',
  'linkedin.com', 'www.linkedin.com',
  'tiktok.com', 'www.tiktok.com',
  'amazon.com', 'www.amazon.com',
  'netflix.com', 'www.netflix.com',
  'reddit.com', 'www.reddit.com', 'old.reddit.com',
  'stackoverflow.com', 'www.stackoverflow.com',
  'medium.com', 'www.medium.com',
  'chatgpt.com', 'openai.com', 'www.openai.com',
  'anthropic.com', 'www.anthropic.com',
  'mail.google.com', 'docs.google.com', 'drive.google.com',
]);

const ADAPTERS = [
  // ---- YouTube — rewrite to /embed/ which IS embeddable ----
  {
    name: 'youtube',
    match(url, u) { return YOUTUBE_HOSTS.has(u.hostname); },
    transform(url, u) {
      let videoId = null;
      if (u.hostname === 'youtu.be') {
        videoId = u.pathname.replace(/^\//, '').split('/')[0];
      } else if (u.pathname === '/watch') {
        videoId = u.searchParams.get('v');
      } else if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.split('/')[2];
      } else if (u.pathname.startsWith('/shorts/')) {
        videoId = u.pathname.split('/')[2];
      }
      if (!videoId) {
        // Channel pages, homepage etc. aren't embeddable — punt to external.
        return { url, mode: 'external', reason: 'YouTube only allows embedding individual videos.' };
      }
      const t = u.searchParams.get('t') || u.searchParams.get('start') || '';
      const startParam = t ? `?start=${parseInt(t, 10) || 0}` : '';
      return {
        url: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}${startParam}`,
        mode: 'iframe',
        reason: 'Rewritten to YouTube official embed URL.',
      };
    },
  },

  // ---- Vimeo ----
  {
    name: 'vimeo',
    match(url, u) { return u.hostname === 'vimeo.com' || u.hostname === 'www.vimeo.com'; },
    transform(url, u) {
      const m = u.pathname.match(/^\/(\d+)/);
      if (!m) return { url, mode: 'external', reason: 'Vimeo only allows embedding individual videos.' };
      return { url: `https://player.vimeo.com/video/${m[1]}`, mode: 'iframe', reason: 'Rewritten to Vimeo player embed.' };
    },
  },

  // ---- CodePen — pen URLs have an embed equivalent ----
  {
    name: 'codepen',
    match(url, u) { return u.hostname === 'codepen.io' || u.hostname === 'www.codepen.io'; },
    transform(url, u) {
      // /<user>/pen/<id>  →  /<user>/embed/<id>
      const embed = u.pathname.replace(/\/pen\//, '/embed/');
      if (embed === u.pathname) return { url, mode: 'iframe', reason: '' };
      return { url: `${u.origin}${embed}${u.search}`, mode: 'iframe', reason: 'Rewritten to CodePen embed view.' };
    },
  },

  // ---- Wikipedia — already iframe-friendly, route to our renderer instead ----
  {
    name: 'wikipedia',
    match(url, u) { return /\.wikipedia\.org$/.test(u.hostname); },
    transform(url, u) {
      const article = decodeURIComponent(u.pathname.replace(/^\/wiki\//, ''));
      if (!article || article === '/') return { url, mode: 'iframe', reason: '' };
      return { url: `halo://wiki?q=${encodeURIComponent(article)}`, mode: 'route', reason: 'Routed to native Halo Wiki view.' };
    },
  },

  // ---- GitHub repo URLs — route to halo://github ----
  {
    name: 'github',
    match(url, u) { return u.hostname === 'github.com' && u.pathname.split('/').filter(Boolean).length >= 2; },
    transform(url, u) {
      // github.com/owner/repo → halo://github (search for the repo)
      const [owner, repo] = u.pathname.split('/').filter(Boolean);
      return { url: `halo://github?q=${encodeURIComponent(owner + '/' + repo)}`, mode: 'route', reason: 'Routed to native Halo GitHub view.' };
    },
  },

  // ---- Known-blocked sites: skip the iframe timeout, go straight to external ----
  {
    name: 'known-blocked',
    match(url, u) { return KNOWN_BLOCKED.has(u.hostname); },
    transform(url, u) {
      return { url, mode: 'external', reason: `${u.hostname} blocks iframe embedding (X-Frame-Options).` };
    },
  },
];

export function adaptUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch (e) {
    return { url: rawUrl, mode: 'iframe', reason: '' };
  }
  for (const a of ADAPTERS) {
    if (a.match(rawUrl, u)) {
      const result = a.transform(rawUrl, u);
      return { adapter: a.name, ...result };
    }
  }
  // No adapter — try iframe by default, fall back to error on timeout.
  return { url: rawUrl, mode: 'iframe', reason: '' };
}
