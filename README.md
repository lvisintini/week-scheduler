# Weekly Schedules

A single-file, dependency-free weekly planner. Open `index.html` in a browser — no build step, no server.

## Features
- Mon–Sun columns, hourly rows 05:00–24:00 (00:00–05:00 can be toggled on)
- Multiple **schedules** that toggle on/off to overlay different views of the same week
- Events with title, description, responsible person, involved people, colour
- Events repeat on chosen days, with per-day times and per-day responsible person
- Give each event an **activity type** (Sleep, Meal, Work/School, Focus time, Chore, Free time…; your own list with built-in icons) shown as an icon on the event; *Free time* has a soft look. Mark any event or single repetition as **flexible time** (dashed border: it happens around those times but may take less)
- Overlapping events that share a person (or have no people) render as diagonal stripes of the overlapping colours; events at the same time that share nobody sit side by side
- **People** list that works like schedules (toggle to show/hide their events)
- Drag to create, move (across days) and resize events
- Day agenda (click a day header) with print support; printable weekly schedule
- Optional "now" line on today's column
- Spanish / English interface (follows browser language, switchable in the sidebar)
- Undo/redo, locked schedules, 12h/24h clock, weekend toggle, collapsible and resizable sidebar
- Save/load to browser memory or JSON file, auto-load, unsaved-changes warning
- Rhythms and phases: coloured background bands for the parts of the day (morning, noon, afternoon…) with name tabs, an Events/Phases edit switch and a per-rhythm agenda
- Eye-icon visibility toggles and a per-schedule opacity slider
- Icons for people (in their colour) and schedules; calendar favicon
- Workspaces: several independent schedules sets, import (new / insert / replace an existing one), and copy or move schedules, rhythms and phases between them
- Save / load in browser memory, as a JSON file (password-encrypted by default, or unencrypted if you choose so) or as a password-protected link (AES-256; the data travels inside the URL fragment)

## Use
Open `index.html` (data can be saved in the browser or as JSON), or host with GitHub Pages (Settings → Pages → deploy from `main`, root).

## Save file
A saved file or link holds one workspace (`version: 1`, `id`, `name`). Links are always encrypted with a password you choose; JSON files are too, unless you deliberately pick *Unencrypted* (the app warns that anyone with the file can then read it). Inside it is plain JSON with: `schedules`, `people`, `types`, `events` (each with `slots`, `involved`, `schedules`, optional `type`), `rhythms`, `phases`, `phaseOpacity`. See `CLAUDE.md` for the schema.

Your data is kept in memory while the page is open — use **Save…** (browser memory, JSON file or shareable link) to keep your work.

## Tests
The app is one static file and needs no build; the tests are dev-only.

```
npm install
npm test                    # 888 fast tests (jsdom), about 40 seconds
npx playwright install      # once: downloads the test browsers
sudo npx playwright install-deps  # once, on WSL or a fresh Linux machine: system libraries the browsers need
npm run test:e2e            # 131 real-browser tests (Chromium + a phone profile), about 4 minutes
npm run lint                # ESLint on the tests
ALL_BROWSERS=1 npm run test:e2e   # also Firefox and WebKit (the nightly CI job does this)
```

Every requirement in `CLAUDE.md` has an ID such as `R-REP-06`; each test group starts with the ID of the requirement it checks, so the console reads like a specification. `tests/requirements.test.js` fails if a requirement has no test. See `CLAUDE.md` §14 for how the tests are organised and how to add one. GitHub Actions (`.github/workflows/tests.yml`) runs lint and the fast tests on every push, the Chromium browser tests on every push, and all browsers nightly.
