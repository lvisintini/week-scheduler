# Project context (for Claude / future contributors)

Paste or point Claude at this file when continuing work on the project.

## What this is
A single static `index.html` (HTML + CSS + vanilla JS, no libraries, no network). It must keep working when opened from disk. Built iteratively with Claude from the requirements below.

## Requirements (cumulative)
1. Single-page app loadable from a static HTML file.
2. Weekly calendar: columns Monday→Sunday, rows hourly 05:00→24:00; 00:00–05:00 hidden but toggleable. Days are NOT tied to dates.
3. Events are rounded boxes (Google-Calendar-like) with background colours; can be removed, moved up/down a day and between days; may overlap.
4. Overlap ranges show a diagonal-stripe pattern mixing the overlapping events' colours.
5. Event fields: title (required), description, person responsible, ≥1 schedule (required). Toggling a schedule shows/hides its events; several schedules overlay the same calendar.
6. Save all data to a JSON file and load it back (it is effectively a save file).
7. Events can repeat on chosen days; each day defaults to the general times but can differ; all repeats share colour/title/etc. Delete removes the whole event (no separate "delete all repeats"); a single repeat is removed by unticking its day in the dialog.
8. Weekend columns (Sat/Sun) have a different hue.
9. People list managed like schedules; "responsible" is a dropdown; repeats can have a different responsible person per day; "persons involved" is a multi-select; people can be toggled to show/hide their events.
10. Click a day header → agenda for that day with a print button (printer-friendly).
11. Print the schedule (printer-friendly, header lists the shown schedules and people).
12. Toggleable "now" line on the current weekday's column.
13. Copy a whole event into another schedule (independent copy).

## Data model (save file, version 3)
```json
{
  "version": 3,
  "showEarly": false,
  "schedules": [{ "id": "", "name": "", "color": "#3b6df0", "visible": true }],
  "people":    [{ "id": "", "name": "", "visible": true }],
  "events": [{
    "id": "", "title": "", "desc": "", "color": "#e5484d",
    "schedules": ["scheduleId"],
    "involved": ["personId"],
    "slots": [{ "day": 0, "start": 540, "end": 600, "person": "personId or ''" }]
  }]
}
```
- `day`: 0 = Monday … 6 = Sunday. `start`/`end`: minutes from midnight (0–1440), 15-min snap.
- One slot per day per event. Slots are the "repeats"; `person` is the responsible person for that slot.
- Loader migrates older files (single `day/start/end`, free-text `person` name → people entry).

## Visibility rules
- Event shown if ≥1 of its schedules is visible.
- Occurrence (slot) shown if it has no people at all, OR any of {slot.person} ∪ {event.involved} is a visible person.

## Code map (all in `index.html`)
- `S` – global state `{schedules, events, people, showEarly}`. `render()` rebuilds sidebar + grid from `S` (simple, fast enough).
- Events are positioned absolutely: `top = (minutes − visibleStart)/60 × HH` (`HH = 48`px/hour).
- Overlap stripes: per day, breakpoints are collected, and each segment covered by ≥2 occurrences gets a `.ov` div with a `repeating-linear-gradient(45deg, …)`; title text sits above (`z-index:3`), overlay at `2`, now-line at `6`.
- Drag logic uses document-level pointer listeners (not pointer capture) because `render()` recreates elements. `startDrag` (move/resize one slot), `startCreate` (drag on empty column).
- Dialog (`#dlg`): general start/end/person + per-day rows. Rows follow general values until edited (`custom` / `pc` flags).
- Printing: a hidden `#pr` div is filled (agenda HTML, or a clone of `#grid`), then `window.print()`; `@media print` hides everything except `#pr`. `#pgStyle` sets `@page`.
- Palette/theme via CSS variables; dark mode via `prefers-color-scheme`.

## Constraints / gotchas
- Keep it one file, no external requests. Don't rely on `localStorage` if the file may be embedded in Claude artifacts (state is memory-only; persistence = Save JSON).
- Always `esc()` user text that goes into `innerHTML`.
- "Now line" setting is not saved.

## Ideas not yet built
Undo/redo, keyboard shortcuts, week-view PDF/landscape option, side-by-side layout for overlaps as an alternative view, localStorage autosave, per-person colours, import/merge (not replace) of save files.

## Later additions
14. Per-schedule **solo** button: shows only that schedule; clicking again (when it is the only one visible) shows all.
15. Helpful tooltips (`title` attributes / ⓘ icons) with workarounds.

### Two-week rota (design decision)
Deliberately NOT a built-in feature (judged too complex). Workaround: create two ordinary schedules ("Week A", "Week B"), tick both for weekly events, use "Copy this event" to build Week B from Week A, and use solo to flip. A real two-week feature was designed on paper (A/B ticks per day, week selector, "this week is" setting, version-4 save format) if ever needed.

## Language and icons (added later)
16. **Spanish/English.** Selector at the bottom of the sidebar; initial language from `navigator.languages[0]` (`es*` → Spanish, otherwise English). Not saved in the JSON; resets per page load.
17. **Icons.** People have a `color` and a user-profile icon in that colour; schedules have a calendar icon in the schedule colour. Click the sidebar icon to change the colour. Icons appear left of every person/schedule name (sidebar, event boxes, agenda, print header, dialog checkboxes, responsible-person preview). Native `<select>` options cannot show icons, so the per-day person selects are text only. Favicon is an inline SVG calendar.

### i18n mechanics (how to add a new UI string)
- **Dynamic strings** (built in JS): add a key to both `D.en` and `D.es`, then use `L('key',{var:value})`.
- **Static HTML text and `title` tooltips**: leave English in the HTML and add `['English prefix','Spanish text']` to the `ES` list (keys shorter than 12 chars must match exactly, longer ones match by prefix). `applyStatic()` swaps them and remembers the English original.
- Day names come from `DAYN`; `DAYS` is mutated in place by `setLang()`.
- People now have `color` in the save file; older files get colours assigned on load.
