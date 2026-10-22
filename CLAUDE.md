# Weekly schedules: instructions for Claude

Static files served as they are by GitHub Pages (https://lvisintini.github.io/week-scheduler/, serves `main`): `index.html` (markup), `app.css` and classic scripts in `js/` that share one global scope, loaded in the order of `index.html` (vanilla JS; no libraries, no modules, no build, no network requests). Opening from disk is not supported **[U]**; locally run `npm run serve` (http://localhost:4173). A repeating Monday–Sunday planner (days are not dates; a workspace may repeat every 1–4 weeks): **workspaces** holding **schedules**, **events** with repetitions, **people**, **activity types** and background **rhythms** made of **phases**. English and Spanish. Phones are for *checking* a schedule (Live View, the day view), not for building one.

This file holds only what applies to every task. The full specification is in `docs/requirements/`: read the file for an area before changing it (table below).

## How the user likes to work
- Large or ambiguous features: discuss the design first ("let's discuss this first"). Give suggestions with trade-offs and a recommendation, then wait for "do it".
- Decisions tagged **[U]** (asked for by the user) and **[C✓]** (proposed by Claude and accepted, explicitly or by not objecting) are deliberate: never undo them silently.
- Every user-facing string exists in English and Spanish (see *Bilingual strings*).
- Tooltips carry the long explanations and explain workarounds (e.g. a rota = an owner who set it + the people in it as involved); labels stay short.
- **When finishing a task:** re-read the conversation's decisions and update the matching entry in the requirement file for that area (table below), editing it in place. Parked ideas go to `docs/parked.md`, known bugs and limits to `docs/known-issues.md`, code-map changes to `docs/architecture.md`. The user reviews these files and expects them to capture *every* requirement and accepted decision.

## The specification (`docs/requirements/`)
- The files describe what the app must do **now**: edit entries in place; never append revision notes or history.
- Tags: **[U]** asked for by the user, **[C✓]** proposed by Claude and accepted, **[P]** parked (see `docs/parked.md`).
- Requirement IDs (`R-AREA-nn`) are defined once, in bold at the start of a bullet, in exactly one requirement file. Every ID must appear in the title of at least one automated test, and every ID a test names must be defined (`tests/requirements.test.js` checks both). New requirement → the next free number of its area, a bullet in the right file, tests titled `R-AREA-nn …`. Never reuse a retired number (listed in `docs/requirements/README.md`).

| Before changing… | read |
|---|---|
| the grid: hours, weekend, now line, zoom, scrolling, focus on one day, layer order | `docs/requirements/grid.md` |
| Live View | `docs/requirements/live-view.md` |
| event boxes and fields, an event's activity type, flexible time, on call, background strips, owner, per-day With, colours | `docs/requirements/events.md` |
| overlaps, stripes, side-by-side lanes, fixed lanes | `docs/requirements/lanes.md` |
| repetitions, the dialog's day table, past midnight, dragging all / one | `docs/requirements/repetitions.md` |
| cycles of several weeks, week patterns, the week switcher, Live View's week, rotas | `docs/requirements/cycle.md` |
| nested activities | `docs/requirements/nesting.md` |
| clicking or dragging overlapping things, choosers, touch | `docs/requirements/interaction.md` |
| schedules | `docs/requirements/schedules.md` |
| people, external people | `docs/requirements/people.md` |
| activity types | `docs/requirements/types.md` |
| statistics | `docs/requirements/stats.md` |
| phases and rhythms | `docs/requirements/phases.md` |
| sidebar, Settings, dialogs, Tools, theme, icons, phone layout | `docs/requirements/ui.md` |
| workspaces, browser storage, the data format and its upgrades, prefs | `docs/requirements/data.md` |
| files, links, encryption | `docs/requirements/sharing.md` |
| CSP, escaping, import limits, hosting | `docs/requirements/security.md` |
| printing, agendas, translations | `docs/requirements/printing-i18n.md` |
| what the app is for | `docs/requirements/product.md` |
| where things are in `js/` and `app.css` | `docs/architecture.md` |
| the tests in detail | `docs/testing.md` |
| open ideas · known bugs and limits | `docs/parked.md` · `docs/known-issues.md` |

## Hard rules
### Bilingual strings
- Dynamic strings: add the key to both `D.en` and `D.es`, use `L('key', {var})`.
- Static dialog HTML: English in the HTML plus an `['English prefix', 'Spanish']` entry in `ES` (keys under 12 characters match exactly, longer ones by prefix; `applyStatic()` handles `<dialog>` only).
- A `title` set from `L()` at runtime must also set `el.__t` to the translated text, or `applyStatic` re-translates it from a shorter prefix key.
- Descriptions, tooltips and help are household/workplace agnostic: say *household/workplace* (*hogar o lugar de trabajo*) where the place must be named, and mix examples from both (R-I18N-02).
- Terms: phases = *franjas*, rhythms = *ritmos*, background strips = *tiras* (never *franjas*); schedule = *horario*; a time's Timing list = *Horas* (not *Horario*); cycle = *ciclo*, week 2 = *semana 2*, Away = *Ausente*.

### Security and escaping (details: `docs/requirements/security.md`)
- Every piece of user-controlled text put into `innerHTML`/`insertAdjacentHTML` goes through `esc()`; prefer `textContent`/DOM properties.
- Nothing leaves the device: no `eval`, `new Function`, `document.write`, `fetch`/XHR/WebSocket/`sendBeacon`/`window.open`, cookies or third-party code. Only the two documented `localStorage` keys are written; the only `Blob`s are the JSON export and the statistics CSV.
- No inline `<script>` and no inline event handlers (`on…=` attributes, `javascript:` links) anywhere: the policy allows only the app's own files (`script-src 'self'`), so they would not run. Handlers are set from the scripts (`el.onclick = …`).
- The Content-Security-Policy `<meta>` is deliberate: any new resource type (fonts, images from URLs, workers, network calls) needs a deliberate CSP change. After edits, check the browser console for "Refused to…" messages.
- Imported data (files, links, the browser store) goes through `migrate()` and then `parseData()`, the single place that validates it (hex colours only, length caps, the `LIM` import limits).
- Links are always encrypted with a password; files are encrypted unless the user deliberately picks *Unencrypted*; browser memory is encrypted when the user protects it with a passphrase (R-DATA-11).

### Data format and view state (details: `docs/requirements/data.md`)
- Any change to what is stored, even a new optional field, raises `FMT` and adds a `MIG` step, following the procedure in R-DATA-08. The sample files in `tests/fixtures/v<N>/` are never edited or regenerated.
- A `prefs` key never changes its meaning; retired keys are never read again or reused.
- View state (the eyes of schedules, people, activity types and rhythms, opacities, `prefs`, focus and Live View) is not undoable, not an unsaved change, ignored by `dataKey()` and kept by `restoreState`. Data changes call `hist()` before mutating (drags: `pushUndo(before)`).

## Architecture (short; the full map is `docs/architecture.md`)
- The code is in `js/` (which file holds what: `docs/architecture.md`), the styles in `app.css`, the markup and the static dialogs in `index.html`. A new script file goes into `index.html`'s list of `<script src defer>`; a top-level statement that runs at load may only use what earlier files define. `S` = the current workspace's data, `WS` = all workspaces, `prefs` = per-browser view settings.
- `render()` rebuilds the grid; `renderSide()` rebuilds the sidebar.
- Time and pieces: `fmt`/`fmtEnd`, `piecesOf` (event → per-day pieces), `coreOf` (flexible start/end), `overlapSet` (the ⚠ of repetitions).
- A day column's layout: `laneLayout` (or `fixedLayout`), the result in `laneMap`, read by `inLane`; strips via `gutMap`; nesting via `nestPick`.
- Hit-testing and dragging: `piecesAt`/`handlesAt` → `grab` → `startDrag`/`startCreate`; choosers: `overlapMenu`.
- Colours: `colOf(e, s)` is what everything draws (`colRaw` = the stored colour).
- Dialogs: `openDlg`, `openCopy`, `xdlg`, `pickColor`, `openSettings`, `openHelp`, `showAgenda`, `openStats`.
- Persistence: `parseData`, `migrate`, `buildFile`, `saveTo`, `openImport`, `seal`/`unseal`.

### Gotchas
- **Dialog chaining:** an `xdlg` button handler that opens another dialog must not have it auto-closed (`xTok`; chained flows also defer with `setTimeout(…, 0)`). Test dialog flows by clicking the real buttons, never by calling the functions.
- Resize handles are not inside their boxes: each `.rz` is a child of the `.day` column (tests reach it with `box._rz`).
- jsdom rewrites the `calc()` positions, so tests read lanes from `data-lane` (`l/n` or `l0-l1/n`) and strips from `data-strip`.

## Testing (details: `docs/testing.md`)
- `npm install`; `npm test` (Vitest + jsdom); `npx playwright install` once (on WSL or a fresh Linux machine also `sudo npx playwright install-deps` once, or every e2e test fails with `error while loading shared libraries`); `npm run test:e2e` (Playwright; `ALL_BROWSERS=1` adds Firefox and WebKit); `npm run lint`. CI: `.github/workflows/tests.yml`.
- Re-run both suites after every change that touches HTML building, import or links.
- Folders: `tests/unit` (pure logic), `tests/app` (the screens in jsdom), `tests/security`, `tests/e2e` (real browser: geometry, real input, touch, downloads, print, CSP, performance, accessibility), `tests/fixtures` (frozen data formats), `tests/manual/touch.md` (the real-phone checklist). The jsdom harness is `tests/helpers/app.js`.
- Every test group is named `R-AREA-nn <what is checked>`; test names say what is expected (at least 25 characters, no duplicates, no `skip`/`only`/`todo`). The console output is the documentation.
- jsdom has no layout, and `el.onpointerdown = f` is a plain property there, so tests call the handlers directly; anything about sticky, scrolling, real drags or print belongs in `tests/e2e`.
- Playwright: `page.evaluate` is exempt from the CSP (to test `eval` blocking, inject an inline script); mouse targets must be on screen; touch uses `Input.dispatchTouchEvent` with many small moves (the `touch`/`swipe` helpers).
- **Negative controls:** after adding tests for a behaviour, temporarily break the behaviour in the app's code and confirm the tests fail.
- The accessibility ratchet (`tests/e2e/a11y.spec.js`) is at `{}` on every screen; keep it there.
