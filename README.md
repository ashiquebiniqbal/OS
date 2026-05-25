# Halo OS

> Sovereign agent-first sandbox desktop. Runs as a static web app **or** as a
> packaged Electron desktop app with full website embedding and an LLM-driven
> auto-pilot that can drive any site like a human — gmail, CRMs, social, dashboards.

![icon](assets/icon.png)

Vanilla JavaScript, no build step, ES modules. The browser version runs from
`index.html` on any static server. The desktop version wraps it in Electron,
strips `X-Frame-Options` / `frame-ancestors` from response headers so the
embedded browser can render any site, and exposes a narrow IPC bridge that
lets the in-OS agent click, fill, scroll, and scrape on real pages.

---

## Highlights

- **16 apps**: File Explorer, Notepad, Calculator, Terminal, Sovereign Web
  (tabbed browser), Paint, Task Manager, Music synth, Privacy Shield, VPN,
  Workflow Automator, API Registry, Web3 Node, Multi-Agent Hub, Halo
  Productivity (Docs/Sheets), Secure PC-Bridge.
- **Sovereign Web** — Chrome-class browser inside the OS: tab strip with
  drag-reorder + pin + colour groups, omnibox with multi-engine suggestions
  (Wikipedia, Hacker News, GitHub, history, bookmarks), per-tab back/forward
  stacks, find-in-page, command palette, session restore, persistent VFS at
  `/System/Browser/`.
- **Site adapters** — known sites are rewritten to their official embed
  endpoints: `youtube.com/watch?v=X` → `youtube-nocookie.com/embed/X`,
  Vimeo → player URL, Wikipedia → native `halo://wiki` reader, GitHub →
  native repo card.
- **Auto-pilot agent** (desktop only) — type a goal, the LLM picks one
  action per step (`click`, `fill`, `press`, `scroll`, `navigate`, `done`),
  the bridge executes it on the active `<webview>`, snapshot feeds back,
  loop until the goal is met. Reuses whatever OpenAI / Anthropic / Ollama
  endpoint you've configured in the **API Registry** app.
- **Vision** — when the configured model is vision-capable
  (GPT-4o / Claude 3+ / Gemini / LLaVA), the observation includes a base64
  PNG screenshot of the page, in addition to a compact DOM-element list.
- **Permission gating** — strict / standard (default) / off. Before any
  click on a *Delete / Send / Pay / Transfer / Checkout / Log out* button
  (and friends), the agent pauses for explicit user approval, inline in
  the panel. Blocked actions are fed back so the LLM re-plans.
- **Persistent run history** — every auto-pilot run is saved as
  `/System/AutoPilot/<id>.json` in the Halo VFS. The panel's **History**
  tab lists past runs and replays the full step sequence.
- **Zero telemetry** — all VFS storage is `localStorage` in your browser
  or Electron session. No Halo server. The only outbound traffic is the
  fetches your apps make themselves (Wikipedia search, Hacker News,
  GitHub API, weather, dictionary, your configured LLM endpoint, sites
  you navigate the embedded browser to).

---

## Quick start

### 1. Run as a desktop app (recommended — gives you website embedding + agent)

```bash
npm install
npm start
```

`npm start` launches Halo OS in Electron. Configure an LLM in the
**API Registry** app, open **Sovereign Web**, type any URL, and try the
auto-pilot (menu ⋮ → "Auto-pilot ⚡" or `Ctrl+/`).

### 2. Run as a plain web app (browser only — no agent automation)

```bash
npm run dev:web              # serves on http://127.0.0.1:8000/
# then open http://127.0.0.1:8000/ in any browser
```

Without Electron, sites that send `X-Frame-Options: DENY/SAMEORIGIN`
will be politely refused with three escape hatches (open externally,
reader mode via r.jina.ai, search instead). The auto-pilot agent is
unavailable in this mode.

### 3. Package a desktop binary for distribution

```bash
npm run pack                 # produces release/win-unpacked/Halo OS.exe
                             # Works for personal use; portable.
npm run dist                 # produces a real NSIS installer.
                             # Requires Windows Developer Mode toggled on
                             # (Settings → Privacy & security → For developers).
```

See `release/README.md` after building.

---

## Architecture

```
halo os/
├── index.html              entry point — loads js/app.js as module
├── style.css               one big stylesheet
├── electron/
│   ├── main.js             Electron main process: BrowserWindow,
│   │                       XFO/CSP header stripping, agent IPC channels
│   └── preload.js          context-bridge exposing window.HALO_ELECTRON
│                           + window.haloAgent to the renderer
├── js/
│   ├── app.js              HaloKernel: registers all 16 apps
│   ├── wm.js               window manager (drag/resize/min/max + onClose hook)
│   ├── fs.js               localStorage-backed VFS
│   ├── shell.js            desktop, dock, start menu, particle wallpaper
│   ├── ui.js               ContextMenu, Toast, Shortcuts, CommandPalette
│   ├── agent.js            Halo Copilot sidebar (NL → app commands)
│   └── apps/
│       ├── calculator.js  notepad.js  terminal.js  explorer.js
│       ├── paint.js       monitor.js  music.js   automator.js
│       ├── shield.js      vpn.js      bridge.js  blockchain.js
│       ├── agents.js      saas.js     api.js
│       └── browser/        full tabbed browser
│           ├── index.js              orchestrator
│           ├── tabstrip.js           tab UI
│           ├── chrome.js             nav bar + findbar + menu
│           ├── omnibox.js            address bar + suggestions
│           ├── router.js             halo:// dispatcher
│           ├── persistence.js        debounced VFS writes for tabs/history/bookmarks
│           ├── site-adapters.js      YouTube/Vimeo/Wiki/GitHub URL rewrites
│           ├── autopilot.js          agent runtime + LLM loop + run history
│           └── renderers/            one file per halo:// page (~18 files)
└── assets/icon.png          app icon (cyan halo, generated by make-icon.ps1)
```

### Key design decisions

- **No build step.** The renderer is ES modules loaded straight from disk.
  Tooling is optional and only used by Electron / electron-builder, never
  to compile source.
- **VFS is the spine.** Every app stores in `localStorage` via `js/fs.js`.
  Cross-app coordination uses paths, not callbacks. Run history,
  bookmarks, terminal history, notepad files — all are real VFS files.
- **Agent isolation.** The renderer never has Node access. Auto-pilot
  drives webviews through `window.haloAgent.executeJS(id, code)`, which
  IPCs to the main process which dispatches to the webview's webContents.
  Permission gating runs in the renderer so the user is always in the
  loop for risky actions.
- **Iframe honesty.** In plain-browser mode, X-Frame-Options is the host
  browser's call — we don't pretend to bypass it. In Electron mode, the
  main process strips it before the headers reach the renderer (this is
  why the desktop version embeds any site).

---

## Auto-pilot — what it can do

Given a goal in natural language, the agent:

1. Snapshots the current webview: URL, title, list of interactive elements
   tagged with stable `data-halo-ref` ids (`r1`, `r2`, …), and a chunk of
   visible text. With vision-capable models, also a PNG screenshot.
2. Calls your configured LLM endpoint with `response_format: json_object`,
   asking for **one** action: `navigate | click | fill | press | scroll
   | wait | done`.
3. Checks the action against the permission gate. Risky targets
   ("Delete", "Send", "Pay", …) require explicit Allow.
4. Executes the action via the IPC bridge inside the webview.
5. Records the step (URL, title, thought, action, result) to the run
   object, which is persisted to `/System/AutoPilot/<id>.json` on
   completion.
6. Loops until the LLM emits `done` or `maxSteps` is reached.

Try goals like:
- *"Open my Gmail inbox and tell me the subjects of the 5 newest unread emails."*
- *"Search Wikipedia for 'sovereign web' and summarize the first three results."*
- *"On github.com/trending, list the top 5 repos by stars today."*
- *"In our Salesforce tenant, find the most recent opportunity under 'Acme Corp'."*

---

## Configuration

- **LLM credentials** — open the **API Registry** app (in the dock or via
  `start menu → API Registry`). Supports OpenAI-compatible endpoints,
  local Ollama, Anthropic-compatible proxies. Keys are base64-stashed in
  `localStorage`; nothing ever leaves your machine except direct calls
  to the endpoint you configured.
- **Browser settings** — `halo://settings` in Sovereign Web:
  homepage, search engine, restore-tabs, reader-proxy fallback, default
  zoom, vision mode (auto/on/off), permission gating (strict/standard/off).

---

## License

MIT — see [LICENSE](LICENSE).
#   O S  
 