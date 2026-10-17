# Weekly Schedules

A single-file, dependency-free weekly planner. Open `index.html` in a browser — no build step, no server.

## Features
- Mon–Sun columns, hourly rows 05:00–24:00 (00:00–05:00 can be toggled on)
- Multiple **schedules** that toggle on/off to overlay different views of the same week
- Events with title, description, an **owner** (as in *Fair Play*: the person who holds the whole task), involved people, colour
- Events repeat on chosen days, one or more times a day; each time has its own start and end, the person who performs it (the owner by default, or someone stepping in), its own involved people if they differ, and its timing — a copy button sets the other days alike
- Give each event an **activity type** (Sleep, Meal, Work/School, Focus time, Chore, Free time…; your own list with built-in icons) shown as an icon on the event; *Free time* has a soft look. Mark any event or single repetition as **flexible time** (dashed border: it happens around those times but may take less), or give it a **flexible start/end** (e.g. work 9:00–17:00 that may start up to 30 minutes late and finish 15 minutes early: the fixed part is a normal box, the flexible parts dashed extensions that never count as a clash). Mark someone from outside the household (a cleaner, a gardener) as an **external person**: what they do alone is drawn as a slim strip at the edge of the day that never clashes with anything and stays out of the statistics; involved people can be marked as **only on call**
- Overlapping events that share a person (or where either has no responsible person) render as diagonal stripes of the overlapping colours; events at the same time that share nobody sit side by side, and an event that concerns several of them spans their lanes
- **In the background**: mark things that don't keep the household busy (screen-free time for a child, the cleaner at work); they are drawn as a thin strip at the right edge of the day, never conflict with anything and are left out of the statistics
- **Nested activities**: mark a small task (e.g. collecting the milk) as *can be done during the person's other activities*; when it falls inside them it is drawn as a small box within that activity instead of as a conflict, moves along with it, and gets its own time in the statistics
- **Statistics** per person or for everyone: how the week is spent by activity type (168-hour bar, day bars, table), double-booked and unplanned time; copy as a table, download CSV or print
- **People** list that works like schedules (toggle to show/hide their events; drag to reorder, which sets the lane order)
- Drag to create, move (across days) and resize events
- Day agenda (click a day header) with print support; printable weekly schedule
- Optional "now" line on today's column, and a **Live View** (sidebar) for a screen everyone can see, such as a tablet on the wall: today on its own, read-only and in larger text, following the current time; tap a box to see its details in a speech bubble
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
A saved file or link holds one workspace (`version: 8`, `id`, `name`). Links are always encrypted with a password you choose; JSON files are too, unless you deliberately pick *Unencrypted* (the app warns that anyone with the file can then read it). Inside it is plain JSON with: `schedules`, `people`, `types`, `events` (each with `slots`, `involved`, `schedules`, optional `type`, `owner`, `nest`, `bg`; each slot optionally `fo` and `inv`), `rhythms`, `phases`, `phaseOpacity`. See `docs/requirements/data.md` for the schema. Files, links and browser memory saved by any earlier version keep opening (they are upgraded on load); data saved by a *newer* version is refused with a message to reload the page, and is never overwritten.

Your data is kept in memory while the page is open — use **Save…** (browser memory, JSON file or shareable link) to keep your work.

## Tests
The app is one static file and needs no build; the tests are dev-only.

```
npm install
npm test                    # 1,220 fast tests (jsdom), about a minute
npx playwright install      # once: downloads the test browsers
sudo npx playwright install-deps  # once, on WSL or a fresh Linux machine: system libraries the browsers need
npm run test:e2e            # 170 real-browser tests (Chromium + a phone profile), under a minute
npm run lint                # ESLint on the tests
ALL_BROWSERS=1 npm run test:e2e   # also Firefox and WebKit (the nightly CI job does this)
```

Every requirement in `docs/requirements/` has an ID such as `R-REP-06`; each test group starts with the ID of the requirement it checks, so the console reads like a specification. `tests/requirements.test.js` fails if a requirement has no test. See the Testing section of `CLAUDE.md` and `docs/testing.md` for how the tests are organised and how to add one. GitHub Actions (`.github/workflows/tests.yml`) runs lint and the fast tests on every push, the Chromium browser tests on every push, and all browsers nightly.
