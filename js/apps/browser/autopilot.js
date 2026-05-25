/**
 * Auto-pilot runtime — drives a webview via the haloAgent IPC bridge.
 *
 * Three concerns:
 *  (1) low-level webview actions (click, fill, scrape DOM),
 *  (2) an LLM-driven loop that picks the next action given a user goal
 *      and the page's current state,
 *  (3) durable run history stored in the Halo VFS under /System/AutoPilot/.
 *
 * Lives in the renderer; only available when running inside Electron
 * (window.HALO_ELECTRON is set by the preload bridge).
 */

import { VFS } from '../../fs.js';

const isElectron = () => typeof window !== 'undefined' && !!window.HALO_ELECTRON;

/* -------------------------------------------------------------
   Run history — durable storage in VFS.
   Each run is a JSON file at /System/AutoPilot/<id>.json. The
   directory listing is the index; no separate manifest needed.
   ------------------------------------------------------------- */
const HISTORY_DIR = '/System/AutoPilot';
const HISTORY_CAP = 50; // keep the 50 most recent runs

function ensureHistoryDir() {
  if (!VFS.exists('/System')) VFS.mkdir('/System');
  if (!VFS.exists(HISTORY_DIR)) VFS.mkdir(HISTORY_DIR);
}

export function saveRun(run) {
  try {
    ensureHistoryDir();
    const path = `${HISTORY_DIR}/${run.id}.json`;
    VFS.write(path, JSON.stringify(run, null, 2));
    pruneHistory();
    return path;
  } catch (e) {
    console.warn('[autopilot] saveRun failed:', e);
    return null;
  }
}

function pruneHistory() {
  try {
    const items = VFS.ls(HISTORY_DIR).filter(i => i.type === 'file' && i.name.endsWith('.json'));
    if (items.length <= HISTORY_CAP) return;
    // Sort oldest-first by the timestamp-prefix in the id (id = "ts-rand")
    items.sort((a, b) => a.name.localeCompare(b.name));
    const drop = items.slice(0, items.length - HISTORY_CAP);
    drop.forEach(it => VFS.rm(it.path));
  } catch (e) { /* ignore */ }
}

export function listRuns() {
  try {
    if (!VFS.exists(HISTORY_DIR)) return [];
    const items = VFS.ls(HISTORY_DIR).filter(i => i.type === 'file' && i.name.endsWith('.json'));
    const summaries = [];
    items.forEach(it => {
      try {
        const data = JSON.parse(VFS.read(it.path));
        summaries.push({
          id: data.id,
          goal: data.goal,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          status: data.status,
          answer: data.answer || '',
          steps: data.steps?.length || 0,
          path: it.path,
        });
      } catch (e) { /* skip malformed */ }
    });
    summaries.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    return summaries;
  } catch (e) { return []; }
}

export function loadRun(id) {
  try {
    const path = `${HISTORY_DIR}/${id}.json`;
    if (!VFS.exists(path)) return null;
    return JSON.parse(VFS.read(path));
  } catch (e) { return null; }
}

/* -------------------------------------------------------------
   Low-level: serialize page state for the LLM, execute actions.
   ------------------------------------------------------------- */

/**
 * Compact, click-targetable snapshot of the webview's page.
 *
 * We assign sequential `data-halo-ref="r1" / "r2"` ... attributes to every
 * interactive element (a, button, input, textarea, select, [role=button]).
 * The LLM gets a JSON list of {ref, kind, text/label/href/placeholder}
 * — way smaller than raw HTML, and refs are stable for the duration of
 * this snapshot. Subsequent actions reference elements by `ref` only.
 */
const SNAPSHOT_SCRIPT = `
(function () {
  const out = [];
  // Clear any prior refs
  document.querySelectorAll('[data-halo-ref]').forEach(el => el.removeAttribute('data-halo-ref'));
  const selectors = ['a[href]', 'button', 'input', 'textarea', 'select', '[role="button"]', '[role="link"]', '[contenteditable="true"]'];
  const nodes = Array.from(document.querySelectorAll(selectors.join(',')));
  let n = 0;
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    // skip hidden / zero-size / offscreen-far
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.bottom < -200 || rect.top > window.innerHeight + 600) continue;
    if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue;
    n++;
    const ref = 'r' + n;
    el.setAttribute('data-halo-ref', ref);
    const tag = el.tagName.toLowerCase();
    const kind =
      tag === 'a' ? 'link' :
      tag === 'button' || el.getAttribute('role') === 'button' ? 'button' :
      tag === 'input' ? (el.type || 'input') :
      tag === 'textarea' ? 'textarea' :
      tag === 'select' ? 'select' :
      el.isContentEditable ? 'editable' :
      'other';
    const text = (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 120);
    const entry = { ref, kind, text };
    if (tag === 'a') entry.href = el.href || '';
    if (tag === 'input' || tag === 'textarea') {
      entry.name = el.name || '';
      entry.placeholder = el.placeholder || '';
      entry.value = (el.value || '').slice(0, 80);
    }
    out.push(entry);
    if (out.length >= 80) break;
  }
  return {
    url: location.href,
    title: document.title,
    elements: out,
    text: (document.body?.innerText || '').slice(0, 4000),
  };
})()
`;

const ACTION_SCRIPTS = {
  click: (ref) => `
    (function() {
      const el = document.querySelector('[data-halo-ref="${ref}"]');
      if (!el) return { ok: false, error: 'no such ref' };
      el.scrollIntoView({ block: 'center' });
      el.click();
      return { ok: true };
    })()
  `,
  fill: (ref, text) => `
    (function() {
      const el = document.querySelector('[data-halo-ref="${ref}"]');
      if (!el) return { ok: false, error: 'no such ref' };
      el.focus();
      const tag = el.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        const setter = Object.getOwnPropertyDescriptor(el.__proto__, 'value')?.set;
        setter ? setter.call(el, ${JSON.stringify(text)}) : (el.value = ${JSON.stringify(text)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.isContentEditable) {
        el.textContent = ${JSON.stringify(text)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return { ok: true };
    })()
  `,
  press: (ref, key) => `
    (function() {
      const el = document.querySelector('[data-halo-ref="${ref}"]') || document.activeElement;
      if (!el) return { ok: false, error: 'no target' };
      const opts = { key: ${JSON.stringify(key)}, bubbles: true };
      el.dispatchEvent(new KeyboardEvent('keydown', opts));
      el.dispatchEvent(new KeyboardEvent('keypress', opts));
      el.dispatchEvent(new KeyboardEvent('keyup', opts));
      // Forms: enter submits
      if (${JSON.stringify(key)} === 'Enter' && el.form) el.form.requestSubmit?.();
      return { ok: true };
    })()
  `,
  scrollBy: (dy) => `(function(){ window.scrollBy(0, ${Number(dy) || 0}); return { ok: true }; })()`,
  waitMs: (ms) => `new Promise(r => setTimeout(() => r({ ok: true }), ${Number(ms) || 0}))`,
};

/**
 * Action set the LLM is allowed to pick from. Each action validates its
 * arguments and dispatches into the appropriate ACTION_SCRIPTS template.
 */
async function executeAction(wvId, action) {
  if (!isElectron()) throw new Error('Auto-pilot requires the Electron desktop app.');
  const bridge = window.haloAgent;
  switch (action.type) {
    case 'navigate':
      // Use the browser's navigate so history/omnibox stay in sync
      window.__haloBrowserNavigate?.(action.url);
      // Give the webview a beat to settle, then return current page
      await new Promise(r => setTimeout(r, 1200));
      return { ok: true };
    case 'click':
      return (await bridge.executeJS(wvId, ACTION_SCRIPTS.click(action.ref))).result;
    case 'fill':
      return (await bridge.executeJS(wvId, ACTION_SCRIPTS.fill(action.ref, action.text || ''))).result;
    case 'press':
      return (await bridge.executeJS(wvId, ACTION_SCRIPTS.press(action.ref, action.key || 'Enter'))).result;
    case 'scroll':
      return (await bridge.executeJS(wvId, ACTION_SCRIPTS.scrollBy(action.dy || 600))).result;
    case 'wait':
      return (await bridge.executeJS(wvId, ACTION_SCRIPTS.waitMs(action.ms || 1500))).result;
    case 'done':
      return { ok: true, done: true, answer: action.answer || '' };
    default:
      return { ok: false, error: `unknown action: ${action.type}` };
  }
}

async function snapshot(wvId) {
  const bridge = window.haloAgent;
  const r = await bridge.executeJS(wvId, SNAPSHOT_SCRIPT);
  return r.ok ? r.result : { error: r.error };
}

/* -------------------------------------------------------------
   LLM loop — reuses the user's API Registry credentials.
   ------------------------------------------------------------- */

const SYSTEM_PROMPT = `You are Halo Auto-pilot, an agent that drives a real web browser to accomplish the user's goal.

You receive at each step:
- The user's overall goal.
- The current page URL and title.
- A list of clickable/fillable elements with refs (r1, r2, ...) and their visible text.
- Recent action history.

You respond with ONE JSON object describing the next single action:
  { "thought": "...", "action": { "type": "navigate", "url": "https://..." } }
  { "thought": "...", "action": { "type": "click", "ref": "r3" } }
  { "thought": "...", "action": { "type": "fill", "ref": "r5", "text": "alice@example.com" } }
  { "thought": "...", "action": { "type": "press", "ref": "r5", "key": "Enter" } }
  { "thought": "...", "action": { "type": "scroll", "dy": 600 } }
  { "thought": "...", "action": { "type": "wait", "ms": 1500 } }
  { "thought": "...", "action": { "type": "done", "answer": "summary for user" } }

Pick exactly one action per step. Be concise. Use 'done' as soon as the goal is met.
Output ONLY the JSON — no commentary, no markdown fences.`;

function loadApiConfig() {
  try {
    const raw = localStorage.getItem('halo_api_config');
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (cfg.key) cfg.key = atob(cfg.key);
    return cfg;
  } catch (e) { return null; }
}

/* -------------------------------------------------------------
   Vision capability — attach a webview screenshot to the LLM
   observation when the configured model can see images.

   Heuristic: model id matches a known vision-capable family.
   User can override via localStorage.halo_autopilot_vision:
     'auto' (default) — use if model supports it
     'on'             — always send screenshots (will fail for text-only)
     'off'            — never send screenshots
   ------------------------------------------------------------- */
const VISION_MODEL_PATTERNS = [
  /gpt-4o/i, /gpt-4-turbo/i, /gpt-4-vision/i, /gpt-4\.1/i, /gpt-5/i,
  /claude-3/i, /claude-sonnet/i, /claude-opus/i, /claude-haiku/i, /claude-4/i,
  /gemini/i, /llava/i, /pixtral/i, /qwen-vl/i, /llama-3\.[2-9].*vision/i,
];

export function isVisionCapable(modelId) {
  if (!modelId) return false;
  return VISION_MODEL_PATTERNS.some(re => re.test(modelId));
}

export function getVisionMode() {
  return localStorage.getItem('halo_autopilot_vision') || 'auto';
}

function shouldSendImages(cfg) {
  const mode = getVisionMode();
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  // auto
  return isVisionCapable(cfg?.model);
}

/* -------------------------------------------------------------
   Permission gating — confirm-before-destructive actions.
   Mode is stored in localStorage.halo_autopilot_gating:
     'strict'   — confirm every action except wait/scroll/done
     'standard' — confirm only risky-keyword actions (default)
     'off'      — never confirm (fully autonomous, risky)
   ------------------------------------------------------------- */
const RISKY_PATTERNS = [
  // Destructive
  /\b(delete|remove|discard|trash|archive|erase|clear|wipe)\b/i,
  /\b(unsubscribe|cancel|deactivate|close account|leave (group|team))\b/i,
  // Outbound / committing
  /\b(send|submit|post|publish|confirm|approve|reply|tweet|comment)\b/i,
  /\b(reply all|forward)\b/i,
  // Money
  /\b(pay|buy|purchase|checkout|order|place order|complete order|subscribe|donate|tip)\b/i,
  /\b(transfer|withdraw|wire|deposit|invest|trade|sell)\b/i,
  // Auth / identity
  /\b(sign out|log ?out|delete account)\b/i,
];

export function getGatingMode() {
  return localStorage.getItem('halo_autopilot_gating') || 'standard';
}

function isRiskyAction(action, snapshot) {
  if (!action) return false;
  // Wait/scroll/done are never risky
  if (['wait', 'scroll', 'done'].includes(action.type)) return false;
  // Navigation: only flag if URL itself looks payment/checkout-ish
  if (action.type === 'navigate') {
    return /checkout|payment|pay\.|wire|withdraw|transfer/i.test(action.url || '');
  }
  // Click / fill / press: scan target element text
  if (!action.ref) return false;
  const el = (snapshot?.elements || []).find(e => e.ref === action.ref);
  if (!el) return false;
  const text = `${el.text || ''} ${el.placeholder || ''} ${el.href || ''}`;
  return RISKY_PATTERNS.some(re => re.test(text));
}

function gatingNeeded(action, snapshot) {
  const mode = getGatingMode();
  if (mode === 'off') return false;
  if (mode === 'strict') return !['wait', 'scroll', 'done'].includes(action.type);
  return isRiskyAction(action, snapshot); // standard
}

async function captureScreenshotDataUrl(wvId) {
  if (!isElectron()) return null;
  try {
    const r = await window.haloAgent.screenshot(wvId);
    return r.ok ? r.dataUrl : null;
  } catch (e) { return null; }
}

async function askLLM(messages) {
  const cfg = loadApiConfig();
  if (!cfg || (!cfg.key && cfg.provider !== 'ollama')) {
    throw new Error('No LLM credentials configured. Open the API Registry app and set up an OpenAI key or local Ollama endpoint.');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.key) headers['Authorization'] = `Bearer ${cfg.key}`;
  const body = {
    model: cfg.model || 'gpt-4o-mini',
    messages,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  };
  const r = await fetch(cfg.url + '/chat/completions', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`LLM HTTP ${r.status}`);
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content || '';
  return JSON.parse(text);
}

/**
 * Build the observation message. When vision is active and a screenshot
 * is available, returns the OpenAI-style multimodal content array.
 * Otherwise returns a plain string.
 */
function buildObservation(snap, screenshotDataUrl) {
  const compactElements = (snap.elements || []).map(e =>
    `${e.ref}[${e.kind}] ${e.text}${e.href ? ' → ' + e.href : ''}${e.value ? ' value="' + e.value + '"' : ''}`
  ).join('\n');
  const textPart = `URL: ${snap.url}\nTitle: ${snap.title}\nElements (interactive):\n${compactElements}\n\nVisible text excerpt:\n${(snap.text || '').slice(0, 1500)}`;

  if (!screenshotDataUrl) return textPart;

  // OpenAI / OpenAI-compatible multimodal format
  return [
    { type: 'text', text: textPart },
    { type: 'image_url', image_url: { url: screenshotDataUrl, detail: 'low' } },
  ];
}

/**
 * Run the agent loop. `onStep` is called after each action with {step, snapshot, decision, result}
 * so the UI can render a live log. Stops on 'done', error, or maxSteps.
 * Returns the final result AND persists the run to /System/AutoPilot/<id>.json.
 */
export async function runAutoPilot({ wvId, goal, onStep, onConfirm, maxSteps = 12 }) {
  if (!isElectron()) throw new Error('Auto-pilot requires the Electron desktop app (window.HALO_ELECTRON is not set).');

  const cfg = loadApiConfig();
  const visionActive = shouldSendImages(cfg);
  const gatingMode = getGatingMode();

  const run = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    goal,
    startedAt: Date.now(),
    endedAt: null,
    status: 'running',
    answer: '',
    error: '',
    model: cfg?.model || '',
    visionUsed: visionActive,
    gatingMode,
    steps: [],
  };

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + (visionActive ? '\n\nYou will also be given a screenshot of the current page on each step. Use it to disambiguate when element text is ambiguous.' : '') },
    { role: 'user', content: `Goal: ${goal}` },
  ];

  const finalize = (patch) => {
    Object.assign(run, patch, { endedAt: Date.now() });
    saveRun(run);
    return run;
  };

  for (let step = 1; step <= maxSteps; step++) {
    const snap = await snapshot(wvId);
    if (snap.error) {
      onStep?.({ step, error: 'snapshot failed: ' + snap.error });
      finalize({ status: 'error', error: snap.error });
      return { ok: false, error: snap.error, runId: run.id };
    }

    const shot = visionActive ? await captureScreenshotDataUrl(wvId) : null;
    const observation = buildObservation(snap, shot);
    messages.push({ role: 'user', content: observation });

    let decision;
    try {
      decision = await askLLM(messages);
    } catch (e) {
      onStep?.({ step, error: 'LLM call failed: ' + e.message });
      finalize({ status: 'error', error: 'LLM: ' + e.message });
      return { ok: false, error: e.message, runId: run.id };
    }
    messages.push({ role: 'assistant', content: JSON.stringify(decision) });

    const action = decision.action || {};

    // Permission gating — confirm risky actions before executing.
    if (gatingNeeded(action, snap) && typeof onConfirm === 'function') {
      const target = snap.elements?.find(e => e.ref === action.ref);
      const summary = describeAction(action, target);
      const allowed = await onConfirm({ action, target, summary, snap });
      if (!allowed) {
        run.steps.push({
          step, url: snap.url, title: snap.title,
          thought: decision.thought || '',
          action,
          result: { ok: false, error: 'blocked by user (permission gate)' },
          gated: true,
        });
        onStep?.({ step, snapshot: snap, decision, result: { ok: false, error: 'blocked by user', gated: true } });
        messages.push({ role: 'user', content: `The user BLOCKED that action via the permission gate ("${summary}"). Propose a different approach that does not require user-blocked steps.` });
        await new Promise(r => setTimeout(r, 200));
        continue;
      }
    }

    const result = await executeAction(wvId, action);
    run.steps.push({
      step,
      url: snap.url,
      title: snap.title,
      thought: decision.thought || '',
      action,
      result: { ok: !!result.ok, error: result.error || '' },
    });
    onStep?.({ step, snapshot: snap, decision, result });

    if (action.type === 'done' || result.done) {
      finalize({ status: 'done', answer: action.answer || decision.thought || '' });
      return { ok: true, answer: action.answer || decision.thought || '', history: run.steps, runId: run.id };
    }
    if (!result.ok) {
      messages.push({ role: 'user', content: `Previous action failed: ${result.error || 'unknown error'}. Try a different approach.` });
    }
    await new Promise(r => setTimeout(r, 700));
  }

  finalize({ status: 'max-steps', error: 'max steps reached without completing goal' });
  return { ok: false, error: 'max steps reached without completing goal', history: run.steps, runId: run.id };
}

function describeAction(action, target) {
  const tgtText = target ? `"${(target.text || target.placeholder || '').slice(0, 60)}"` : '';
  switch (action.type) {
    case 'click':    return `Click ${tgtText}`;
    case 'fill':     return `Fill ${tgtText} with "${(action.text || '').slice(0, 50)}"`;
    case 'press':    return `Press ${action.key} on ${tgtText}`;
    case 'navigate': return `Navigate to ${action.url}`;
    default:         return action.type;
  }
}

export const AutoPilot = { runAutoPilot, snapshot, executeAction, isElectron, listRuns, loadRun, saveRun, getGatingMode, isVisionCapable };
export default AutoPilot;
