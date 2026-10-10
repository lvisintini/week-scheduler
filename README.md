# Weekly Schedules

A single-file, dependency-free weekly planner. Open `index.html` in a browser — no build step, no server.

## Features
- Mon–Sun columns, hourly rows 05:00–24:00 (00:00–05:00 can be toggled on)
- Multiple **schedules** that toggle on/off to overlay different views of the same week
- Events with title, description, responsible person, involved people, colour
- Events repeat on chosen days, with per-day times and per-day responsible person
- Overlapping events render as diagonal stripes of the overlapping colours
- **People** list that works like schedules (toggle to show/hide their events)
- Drag to create, move (across days) and resize events
- Day agenda (click a day header) with print support; printable weekly schedule
- Optional "now" line on today's column
- Spanish / English interface (follows browser language, switchable in the sidebar)
- Undo/redo, locked schedules, 12h/24h clock, weekend toggle, collapsible and resizable sidebar
- Save/load to browser memory or JSON file, auto-load, unsaved-changes warning
- Rhythms and phases: coloured background bands (sleep, meals, work…) with name tabs, an Events/Phases edit switch and a per-rhythm agenda
- Eye-icon visibility toggles and a per-schedule opacity slider
- Icons for people (in their colour) and schedules; calendar favicon
- Save / load everything as a JSON file

## Use
Open `index.html` (data can be saved in the browser or as JSON), or host with GitHub Pages (Settings → Pages → deploy from `main`, root).

## Save file
Plain JSON (`version: 3`): `schedules`, `people`, `events` (each with `slots`, `involved`, `schedules`), `showEarly`. See `CLAUDE.md` for the schema.

Data lives only in memory — use **Save JSON** to keep your work.
