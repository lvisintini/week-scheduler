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

18. **Copy to a schedule the event is already in:** the copy gets a new colour with the same hue but different lightness (`shiftColor`), skipping colours already used by events in that schedule. Copies into a schedule the event isn't in keep the original colour.

19. **Eye icon visibility.** Schedules and people use an eye button (open eye = shown, dashed eye = hidden) instead of a checkbox.
20. **Schedule opacity.** Each schedule has an opacity slider (`schedules[].opacity`, 0.1–1, default 1, saved in the JSON). An event is drawn at the highest opacity among its visible schedules; overlap stripes scale with the most opaque covered event. The slider calls `render()` with `skipSide=true` so the sidebar (and the slider being dragged) is not rebuilt.
21. Sidebar widened to 290px; each schedule row wraps so the slider sits on its own line under the name.
22. Opacity row: a checkered-box icon (tooltip explains it) plus the slider inside a `.opr` flex wrapper sized `calc(100% - 28px)` so it never overflows the sidebar; the slider flexes to fill the row width.

---
## Major revision (save format v4) — supersedes older notes where they conflict
23. **Undo/redo** (sidebar buttons, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z). Snapshot-based: call `hist()` *before* every data mutation (or `pushUndo(beforeJSON)` for drags). View settings (`showEarly`, `clock12`, `hideWeekend`) are not undone. Opacity slider coalesces one drag into one undo step.
24. **Copy** lives in its own dialog (`openCopy`), opened by the "Copy…" button in the event dialog. Pick destination schedule and colour mode: same / same hue brighter-or-darker (`shiftColor`) / random / chosen. Default mode: tweak if the destination already contains the event, else same.
25. **Locked schedules** (`schedules[].locked`): events attached to any locked schedule are `pointer-events:none` (can't be selected, dragged, edited); a lock icon shows top-right on the event.
26. **12h/24h clock** toggle (`S.clock12`, `fmt()`/`hourLabel()`).
27. **Colour picker popover** (`pickColor`) with swatches, HSL sliders, hex field and Apply/Cancel (Enter applies, Esc cancels). Used everywhere instead of `<input type=color>`.
28. **Overlap chooser:** clicking where several (unlocked, visible) events overlap opens a small menu to choose one (`itemsAt`, `overlapMenu`).
29. **Dragging/resizing a repeating event** asks: only this day / all repetitions / cancel (`askRepeat`). "All" applies the same offset to every slot: moves shift every slot by the same days (mod 7) and minutes; resizes change every slot's end by the same amount and **remove** slots that would end at/before their start.
30. **Day headers** show an agenda icon. Repeat icon (and lock icon) sit top-right of the event box.
31. **Sidebar:** collapsible (chevrons), resizable (drag right edge), holds *all* controls plus the title with the favicon; there is no header any more. Sidebar width/collapsed state are stored in `localStorage` key `weekly-schedules-prefs` (not in the save file). The sidebar is rebuilt by `renderSide()` on every `render()` (skipped while dragging the opacity slider via `skipSide`).
32. **Persistence:** Save…/Load… open a small dialog (browser memory = `localStorage['weekly-schedules-data']`, or JSON file). The app auto-loads browser memory at startup. "Clear memory" (confirm) deletes it. "Restart" discards unsaved changes and reloads browser memory. `beforeunload` warns when `isDirty()` (current data differs from both last browser save and last file save); the title shows a • when dirty.
33. **Hide/show weekend** toggle (`S.hideWeekend`).

### Save file v4 additions
`schedules[].locked`, `S.clock12`, `S.hideWeekend` (plus earlier `schedules[].opacity`, `people[].color`). Older versions load fine (defaults applied in `parseData`).

### Code map changes
- `parseData(json)` is pure validation/migration; callers assign `S`.
- `xdlg({title,body,buttons,onDismiss})` is the generic modal used by save/load, copy and repeat-confirm dialogs (all text via `L()`).
- i18n: dynamic strings in `D.en/D.es` via `L()`; only the static dialog HTML uses the `ES` prefix list (`applyStatic()` now touches `<dialog>` only).
- Minute snapping function is `snapM` (the name `snap` was retired).

---
## Revision: repeat-drag behaviour and settings dialog (supersedes items 29 and parts of 26/33)
34. **Dragging/resizing a repeating event changes ALL repetitions by default**, with a live preview while dragging (`startDrag`). Hold **Shift** (can be pressed mid-drag) to change only the grabbed day. No confirmation dialog any more. After an "all" drop, a toast offers **Only this day** (reverts the others, keeps the dragged change) and **Undo**; both are ignored if the history changed since (`undoSt.length` mark). Rules unchanged: same offset for every slot; a slot that would end at/before its start is removed (slots are flagged `_gone` during the preview and stripped on drop); day moves rotate mod 7.
35. **Settings dialog** (gear icon at the top of the sidebar → `openSettings()`, built on `xdlg`). Sections are built with `sec(titleKey)` + `opt(...)` rows; currently one section, **View**: show early hours, show "now" line, AM/PM clock, hide Saturday/Sunday. Add future sections by calling `sec()` again. These toggles were removed from the sidebar. Language selector is still at the bottom of the sidebar.
36. Event tooltip lists the repeat info (`repTip`). Sidebar buttons now: undo, redo, + Event, Save…, Load…, Restart, Clear memory, Print schedule.

---
## Revision: sidebar redesign (supersedes items 31, 35 (language location) and 36)
37. **Sidebar layout:** top row = favicon, title (• when unsaved), help `?`, settings gear, collapse chevron. Then the primary **+ Event** button and one icon toolbar (undo, redo, save, load, print; tooltips only). Then two collapsible sections, **Schedules (n)** and **People (n)**, each with a header chevron, count, ⓘ tip and a "+" add button (collapsed state saved in prefs keys `secSch`/`secPpl`).
38. **Rows are slim:** eye (visibility), coloured icon (click = colour picker; schedule icon dims with its opacity), editable name, lock badge (schedules, when locked) and a **⋯ menu** (`rowMenu`, `schMenu`, `perMenu`). Schedule menu: Colour…, opacity slider, Lock/Unlock, Show only this one (solo), Delete. People menu: Colour…, Delete. Hidden rows are dimmed.
39. **Settings dialog sections:** View (early hours, now line, AM/PM, hide weekend), **Data** (Restart, Clear memory) and **Language** (en/es). Restart/Clear/Language moved out of the sidebar. Changing language re-opens the dialog in the new language.
40. The grey hint paragraph is replaced by the **Help dialog** (`openHelp`, strings `help1`–`help8`).

---
## Revision: conflict clean-up (save format v5) — supersedes the older notes where they conflict
41. **View settings are per browser, not in the save file.** `showEarly`, `clock12`, `hideWeekend` now live in `prefs` (localStorage `weekly-schedules-prefs`, saved via `savePrefs()`), next to sidebar width/collapsed. `S` and the save file only hold `schedules`, `people`, `events` (version 5; older files load fine and extra keys are ignored).
42. **Visibility (`visible`) and opacity are view state:** toggling them creates no undo step and doesn't mark the data as unsaved (`dataKey()` ignores them), but they are still written to the save file. `restoreState()` (undo/redo) keeps the *current* visibility/opacity of schedules and people. Lock stays real data (undoable, counts as a change).
43. **Lock rule:** an event is locked only if *all* of its schedules are locked (`isLocked`). Locked events stay click-through (`pointer-events:none`). **Right-click anywhere on a day column** lists the events under the pointer (locked or not) and opens the Copy dialog for the chosen one (`col.oncontextmenu` → `overlapMenu(…, openCopy, …)`). No touch equivalent yet (idea: long-press).
44. **"N hidden" badge** (`#hid`, bottom-right of the grid, `hiddenInfo()`): counts occurrences hidden by the hidden weekend, hidden early hours, or the people filter (priority in that order); tooltip gives the breakdown; click opens Settings.
45. Copy dialog shows a note that a copy is independent (vs. ticking several schedules to share one event). Help dialog has a 9th tip about right-click copy.

### Open design question (not implemented): events that cross midnight / several blocks per day
Currently one slot per event per day and `end <= 1440`. Discussed options: allow `end` beyond 1440 (minutes from the slot's start-day midnight, ≤ 7 days) rendered as joined pieces per day; Sunday wraps to Monday; allow several blocks per day and overlapping repetitions with a warning rather than a ban.

---
## Revision: events that run past midnight (supersedes the "open design question" above, item 34's removal rule, and "end ≤ 1440")
46. **Slot model:** `slot.end` may now be up to `MAXEND = 2865` (23:45 on the *next* day), measured in minutes from midnight of the slot's start day; `start` is 0–1425. Overflow stops at the next day. Sunday overflow continues on **Monday** (week wraps). Old data (end ≤ 1440) is valid unchanged; `parseData` clamps values.
47. **Rendering:** `piecesOf(slot)` splits a slot into 1–2 day pieces; each piece is drawn in its own column with flat joined edges (top flat on the continuation piece). Labels: first piece `22:00–02:00 (+1)`, second piece `from Fri 22:00 · until 02:00`. Only the last piece has the resize handle. Agenda lists both pieces; `piecesAt(day, minute, includeLocked)` powers the click chooser and right-click copy menu.
48. **Time display:** `fmt()` wraps at 24h, so midnight always shows `00:00` (`12:00 AM` in AM/PM mode); never `24:00`. End-time selects list `00:15 … 23:45`, then `00:00 (Next day)`, `00:15 (Next day)` … `23:45 (Next day)` (`endLabel`); entries ≤ the chosen start are disabled.
49. **Overlapping repetitions are allowed but warned about** (`overlapSet`, which compares week-wrapped intervals): ⚠ icon on the affected rows in the event dialog plus a summary line (`#fWarn`); ⚠ in the flags at the top-right of the affected event pieces on the grid (and a line in the tooltip/agenda); when a drag/resize *creates* new overlaps, a toast warns (with Undo). Overlapped same-colour pieces get a lightened stripe colour so the overlap is visible. Still one slot per day per event: dragging a single repetition onto a day that already has one is blocked.
50. **Resizing never removes a repetition any more:** the minimum is 15 minutes (replaces the "remove if it would end before it starts" rule for both single and all-repetition resizes). Dragging a resize handle into the next day's column extends the event past midnight.

---
## Revision: Quick/Advanced repetitions and overlap disambiguation (supersedes "one slot per day" and `MAXEND = 2865`)
51. **`MAXEND = 2880`:** an event can end as late as midnight at the end of the next day. End-select labels: `…23:45`, `00:00 (Next day)` … `23:45 (Next day)`, `00:00 (Day after next)`. Compact display (`fmtEnd`): `(+1)` / `(+2)` suffixes.
52. **Event dialog has two modes (tabs):** **Quick** (default; Mon–Sun rows, one block per day) and **Advanced** (list of blocks: day, start, end, person, ✕, "+ Add block"; several blocks per day and overlaps allowed, with ⚠ warnings). Switching Quick→Advanced converts the rows to blocks. Advanced→Quick is only allowed while no day has more than one block (`isAdv(slots)`); otherwise the Quick tab is disabled with an explanatory tooltip. An event whose saved slots have a duplicate day always opens in Advanced. Data model unchanged: `slots[]` simply may contain several entries per day. Colour moved next to the title.
53. **Calendar drags on "advanced" events** may move a single repetition onto a day that already has one (quick events still block that).
54. **Overlap disambiguation:** `grab()` runs on pointer-down on an event piece. If several *different events* could be meant (pieces covering the pointer for moves, resize handles within ~9 min for resizes) and none is selected, the gesture becomes: click → chooser to open the dialog; drag → chooser "pick the one to move/resize". Picking sets `selId` (selected event, outlined, raised above its neighbours); while selected, a drag that starts where it is among the candidates acts on it directly. Clear selection by clicking empty space or Esc.
55. **Choosers group by event:** `overlapMenu` lists each event once; if all pieces under a click belong to the same event the dialog opens directly (no menu).

---
## Revision: click vs drag disambiguation (refines items 54–55)
56. **Clicking** to open the dialog: if everything under the pointer belongs to one event (even several overlapping repetitions) the dialog opens directly; if several different events overlap, the list shows each event once (repetitions grouped).
57. **Dragging** (move or resize) where more than one *piece* (event or repetition) could be meant always shows the chooser, listing every repetition separately with its day and times (`overlapMenu(..., group=false)`). Selection is per repetition: `selK = {id, i}` (event id + slot index), cleared by Esc, empty-space click, undo/redo. Candidates carry the slot index `i` (`piecesAt`, `handlesAt`).
58. Compact time displays (`fmtEnd`): an end at plain midnight (1440) shows `00:00`; any end after that shows `(Next day)`, including the end of the next day (2880 → `00:00 (Next day)`). Note the end-time *select* still labels 1440 as `00:00 (Next day)` and 2880 as `00:00 (Day after next)` (`endLabel`), so the two notations differ until the select is aligned.
