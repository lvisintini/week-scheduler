# Project context (for Claude / future contributors)

This file is the **flattened, current description of what the app must do and why** — not a changelog. Edit entries in place when something changes; never append "revision" notes. Point Claude at this file when continuing work.

**Tags used below**
- **[U]** asked for by the user.
- **[C✓]** proposed by Claude and accepted by the user (explicitly, or by not objecting). These are decisions, not accidents — don't undo them silently.
- **[P]** parked / open (see §12).

**How the user likes to work:** discuss design first for large or ambiguous features ("let's discuss this first"), get suggestions with trade-offs and a recommendation, then say "do it". Every user-facing string must exist in English and Spanish. Tooltips should explain workarounds (e.g. emulating a two-week rota). The user reviews this file and expects it to capture *every* requirement and accepted decision — when finishing a task, re-read the conversation's decisions and update the matching entry here.

## 1. Product
A single static `index.html` (HTML + CSS + vanilla JS, no libraries, no network requests) that must work when opened from disk or GitHub Pages. A weekly planner with: overlayable **schedules**, **events** with repetitions, **people**, and background **rhythms** made of **phases** (named parts of the day). English/Spanish UI. Repo files: `index.html`, `README.md`, `CLAUDE.md`.

## 2. Calendar grid
- **[U]** Columns Monday→Sunday, left to right. Days are **not** attached to dates (it's a repeating week).
- **[U]** Hourly rows from 05:00 to midnight by default; 00:00–05:00 hidden but can be shown (Settings → "Show early hours"). Events/phases in hidden hours are kept; they count in the "N hidden" badge (events only).
- **[U]** **Saturday and Sunday: only the header cells have a different hue** (not the whole column). The hue covers just the header cell *between the day column's borders* — it must not extend into the phase-lip lane on the left, **except** the lane between Saturday and Sunday (both weekend headers), which takes the same hue so the two headers read as one band (class `wj`; the lane between Friday and Saturday stays neutral; the single-day print drops the join). Dark-mode variant exists (`--weh`).
- **[U]** Settings: show/hide Saturday & Sunday columns; AM/PM clock; show/hide a red **now line** on the current weekday's column (updates every 30 s, default on, never printed).
- **[U]** Midnight is always displayed as `00:00` (`12:00 AM` in AM/PM mode), never `24:00`.
- **[C✓]** 48 px per hour, 15-minute snapping, hour lines, sticky day headers. Each day header shows an **agenda icon**; clicking the header opens that day's agenda **[U]**.
- **[U]** An **"N hidden" pill** (bottom-right of the grid) counts only event occurrences that are not shown *purely because* they fall in the hidden early hours or on the hidden weekend. Occurrences that are even partially visible (e.g. 04:00–06:00, or Fri 22:00 → Sat 02:00 with the weekend hidden) are never counted, and neither are occurrences hidden by the people filter or a hidden schedule. Tooltip gives the weekend / early-hours breakdown; click opens Settings.
- **[C✓]** Layer order in a day column: phase backgrounds → hour lines (drawn *over* phases, **[U]**) → events → overlap stripes → now line.

## 3. Events
- **[U]** Rounded boxes with a background colour, like Google Calendar. Created by dragging on empty space of a day (a plain click/short drag creates a 1-hour event) **[C✓]** or with the **+** toolbar button **[U]**. Can be removed, moved up/down within a day, moved to other days, resized, and may overlap other events.
- **[U]** Fields: title (required), description (optional), person responsible (optional, a dropdown fed by the People list), persons involved (multi-select from the same list), colour, and **at least one schedule**. Toggling a schedule shows/hides its events.
- **[U]** **Event box layout (rows):** row 1 = responsible person's icon (only if there is one, just before the title, sized to the text) + title on the left, the **time range right-aligned**, then the status icons (repeat / ⚠ / lock, top-right, **[U]** unchanged); row 2 = `By: <responsible name>` (no icon, left) and, right-aligned on the same row, `With: <involved people with icons>`; row 3 = description. Person icons inside event boxes are small (10 px glyph on a white disc) **[U]**. Continuation pieces show `from Fri 22:00 · until 02:00` as their time.
- **[U]** Status icons top-right of the box: **repeat icon** (event has >1 repetition), **[C✓]** ⚠ (repetitions of this event overlap each other), lock icon (locked). **[U]** **Event tooltip** (hover): lines for title, time, `By: …`, `With: …`, description and the ⚠ note; then a **blank line** and the UI-behaviour instructions, one per line (currently: for repeating events, "Dragging changes all repetitions; hold Shift to change only this one."). The number of repetitions is deliberately not shown.
- **[U]** Dialog **Delete** is a single button: removes the whole event including all repetitions and closes the dialog (no confirmation, no "delete all repeats" wording).
- **[U]** **Copy** lives in its own dialog (opened by the "Copy…" button of the event dialog, or by **right-click** on the grid **[C✓]**): choose destination schedule and colour (same colour / same hue brighter-or-darker / random / chosen). Default: tweak when the destination already contains the event, otherwise same colour **[U]**. A copy is an independent event (to share one event, tick several schedules) — the dialog says so **[C✓]**.
- **[U]** Event opacity = highest opacity among its visible schedules.
- **[U]** Overlapping events (any events, any schedules): the overlapped range is drawn as **diagonal stripes mixing the overlapping colours** (45°, 7 px bands). **[C✓]** Same-colour overlaps get a lightened stripe so they stay visible.

## 4. Repetitions
- **[U]** An event can repeat on chosen days of the week. Each day defaults to the general times but can differ; each repetition can have its **own responsible person**; all share colour/title/etc. Repetitions can be removed or retimed individually (dialog), and deleting the event deletes all.
- **[U]** Event dialog has two modes (tabs): **Quick** (default; Mon–Sun rows, one block per day) and **Advanced** (list of blocks: day, start, end, person, ✕, "+ Add block"; several blocks per day allowed). Quick→Advanced converts; Advanced→Quick is allowed only while no day has two blocks, otherwise the Quick tab is disabled with an explanatory tooltip. An event whose slots contain a duplicate day always opens in Advanced.
- **[U]** Events may **run past midnight**: end up to `MAXEND = 2880` (midnight at the end of the *next* day). Overflow stops at the next day; **Sunday wraps into Monday**. Drawn as joined pieces with flat edges; labels `22:00–02:00 (Next day)` / `from Fri 22:00 · until 02:00`. Only the last piece has the resize handle.
- **[U]** End-time select labels: `…23:45`, `00:00 (Next day)`, `00:15 (Next day)` … `23:45 (Next day)`, `00:00 (Day after next)`; entries ≤ start are disabled. Compact displays (boxes, agenda, tooltips): plain midnight → `00:00`; any later end → `(Next day)` suffix, including the end of the next day (`00:00 (Next day)`). *Known inconsistency between select and compact notation — alignment proposed, not done* **[P]**.
- **[U]** **Overlapping repetitions are allowed but warned about**: ⚠ on the affected dialog rows + summary line; ⚠ icons on the grid pieces; a toast when a drag/resize *creates* new overlaps (with Undo).
- **[U]** **Drag/resize of a repeating event changes ALL repetitions by default** (live preview), **Shift** (also mid-drag) changes only the grabbed one. After an "all" drop a toast offers **Only this day** and **Undo**. Moves shift every repetition by the same minutes and days (mod 7); resizes change every end by the same amount; **minimum duration is 15 minutes — a repetition is never removed by resizing**. Dragging a resize handle into the next day's column extends past midnight. Quick events block moving a single repetition onto a day that already has one; Advanced events allow it.
- **[U]** No confirmation dialog for repeat drags (an earlier confirm dialog was rejected).

## 5. Choosing among overlapping things (click vs drag)
- **[U]** **Click** (open dialog): if everything under the pointer belongs to one event (even several overlapping repetitions) the dialog opens directly; if different events overlap, a small list shows each event once (repetitions grouped).
- **[U]** **Drag** (move or resize): if more than one event *or repetition* could be meant (bodies for moves; bottom ~9 min for resizes) a chooser lists each repetition separately (with its day/times). **[C✓]** The pick becomes the **selection** (`selK={id,i}`): outlined and raised above neighbours; the next drag that starts where it is a candidate acts on it directly. Esc, a click on empty space, or undo/redo clears it. (Two-step by design: you cannot choose while the button is held.)
- **[C✓]** Right-click on a day column lists events/phases under the pointer → Copy dialog.

## 6. Schedules
- **[U]** Multiple schedules overlay the same calendar; each can be shown/hidden with an **eye icon** (open eye / dashed eye) **[U]**, has a name, colour, a small **calendar icon** in its colour **[U]** and an **opacity slider** (with a checkered-box icon + tooltip) **[U]**.
- **[U]** **Locked schedules:** an event is locked only if *all* its schedules are locked **[C✓]**; locked events can't be selected/moved/dragged/edited, are click-through (so events beneath stay reachable) **[C✓]** and show a lock icon; they can still be copied via right-click **[C✓]**.
- **[C✓]** Row menu (⋯): colour, opacity, lock/unlock, **"Show only this one"** (solo), delete (events only in that schedule are deleted too, with confirmation). Solo + two schedules ("Week A", "Week B") is the **documented workaround for a two-week rota**; a real two-week feature was judged too complex and is deliberately not built **[U]**.
- **[U]** The first-run schedule is named **Routine**.

## 7. People
- **[U]** A People list "created in the same fashion as schedules": name, colour, icon, eye (show/hide). **Visibility rule (`slotVisible`) — viewing a person's calendar:** an occurrence with **no responsible person is always shown** (unless its schedule is hidden), whatever its involved people; otherwise it is shown when its responsible person is shown **or** any involved person is shown. So viewing a single person shows everything except occurrences led by someone else in which that person is not involved. (With nobody shown, only occurrences without a responsible person remain.) Rule is per repetition, since each repetition has its own responsible person. Deleting a person removes them from all events.

## 8. Phases and rhythms (background day-structure)
- **[U]** A **rhythm** = the regular cadence of a home/workplace over a week (e.g. "Normal rhythm", "Holiday rhythm"); a **phase** = a named part of the day (Sleep time, Lunch time…). (Originally "periods"/"period sets"; renamed by the user's choice, Spanish: *franjas* / *ritmos*.)
- **[U]** Rhythms behave a bit like schedules but are separate entities; a rhythm can be hidden but **only one rhythm can be shown at a time**. Phases are **always in the background**, drawn as a colour band behind events with the hour lines/borders over it. **One opacity control for all rhythms** (slider in the Rhythms section); the lips are always fully opaque. Rhythm visibility and the opacity are view state (§10).
- **[U]** Phase fields: name, description (optional), colour, ≥1 rhythm; **no people**. Repetitions stay within one day; same Quick/Advanced dialog as events; a phase can belong to several rhythms and be copied to another rhythm (same Copy dialog).
- **[U]** **Lips:** a vertical-text tab in a lane **outside, to the left of** each day column, its right edge flush with the column's left border. Hover tooltip: name, day range (e.g. `Mon–Fri`), times, description. **Grouping:** if the previous *displayed* column has the same phase with identical start/end, no lip is drawn there; **the lane still shows the phase colour as a translucent band (same opacity setting)** so the colour is continuous across the group. Different timings → each gets a lip. The lane exists (18 px) only while a rhythm is visible.
- **[U]** Phases are never counted as hidden by the hidden-weekend/early-hours settings, and are drawn through hidden-hour clipping like anything else.
- **[U]** **Edit mode** switch (sidebar: *Events | Phases*): in Phases mode events are inert and dimmed (35 % opacity, desaturated) and phase repetitions are interactive; in Events mode phases are pure background (lips still show tooltips). Editing one kind can never affect the other. **[C✓]** In Phases mode phase boxes get **dashed borders in their colour**, an inline label (`name · times`), a resize handle, the lip becomes a drag handle, and the grid gets an accent-coloured inset outline as a mode cue. Drag, resize, Shift-single, toast, choosers and right-click Copy work exactly as for events.
- **[U]** **Rhythm agenda** (agenda icon on the rhythm row): phases sorted by earliest start, then grouped into runs of consecutive days with identical times, scanning Monday→Sunday with **no Sunday→Monday wrap** (e.g. `Monday to Thursday 12:00–13:00`, `Friday 13:00–14:00`, `Saturday to Sunday 12:00–13:00`). Phases are not listed in the day agenda.
- **[U]** **Default first-run rhythm** (also after Clear memory): a **visible** "Normal rhythm" with 9 phases (`defaultRhythm()`): Sleep time 00:00–06:00 ("4 cycles") and 22:30–24:00 ("5 cycles"), Wake time 06:00–07:15, Breakfast time 07:15–08:15, Work/School time 08:15–12:00 + 13:00–16:45 (Mon–Fri), **Free time** same times on Sat–Sun, Lunch time 12:00–13:00, Dinner time 16:45–19:30, Bed time 19:30–22:30 (names localised).

## 9. Sidebar, settings, dialogs
- **[U]** All controls live in the sidebar (no header). Title with the favicon on its left at the top. Sidebar is collapsible (chevrons), its width adjustable (drag edge, 230–560 px), and the grid uses the free space. State saved in prefs.
- **[U]/[C✓]** Layout (user approved): top row = favicon, title (• when unsaved), help `?`, settings gear, collapse chevron; icon toolbar = **+** (new event, or new phase in Phases mode; accent coloured, tooltip also mentions dragging) **[U]**, undo, redo, save, load, print; Events|Phases switch; collapsible sections **Schedules**, **People**, **Rhythms** (count, ⓘ tip, + button); slim rows (eye, coloured icon — click = colour picker, editable name, lock badge, ⋯ menu).
- **[U]** **Settings dialog** (gear): sections *View* (**theme: System / Light / Dark** **[U]**, early hours, now line, AM/PM, hide weekend — each with an explanation), *Data* (Restart, Clear memory), *Language*; designed to gain more sections later. **Help dialog** (`?`) lists usage tips **[C✓]**.
- **[U]** Colour pickers: popover with swatches, HSL sliders, hex field and an **Apply** button (Enter also applies, Esc cancels) — used everywhere instead of `<input type=color>`.
- **[U]** Undo/redo (buttons + Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z, 100 steps). **[U]** Visibility (eyes), opacity and view settings are *view state*: not undoable, not "unsaved changes". Lock *is* data.
- **[C✓]** Toasts: 2.2 s plain, 7 s with action buttons. Day agenda dialog has **Print agenda** (list) and **Print day view**.
- **[C✓]** Event dialog layout: title + colour swatch, description, responsible, involved, Quick/Advanced tabs, schedules (or rhythms), Delete / Copy… / Cancel / Save. Person fields hidden for phases; phase end times stop at 00:00.

## 10. Persistence and data
- **[U]** Save…/Load… each open a choice: **browser memory** (`localStorage` key `weekly-schedules-data`) or **JSON file**. The app **auto-loads browser memory** at startup. **Clear memory** (confirmation) deletes it **and restarts the app** to the default state. **Restart** discards unsaved changes and reloads browser memory. `beforeunload` warns about unsaved changes; dirty = current data differs from both the last browser save and the last file save.
- **[U]** **View settings are per browser, not in the save file** (`prefs`, key `weekly-schedules-prefs`): `showEarly`, `clock12`, `hideWeekend`, `theme` (`auto`|`light`|`dark`), sidebar width/collapsed, section collapse flags. Data and view state are separated; *within* the file, `schedules[].visible/opacity`, `people[].visible`, `rhythms[].visible` and `phaseOpacity` are view state (saved, but ignored by `dataKey()` and preserved across undo).
- **Save file version 7:**
```
schedules [{id,name,color,opacity,locked,visible}]
people    [{id,name,color,visible}]
events    [{id,title,desc,color,schedules:[id],involved:[personId],slots:[{day,start,end,person}]}]
rhythms   [{id,name,visible}]
phases    [{id,title,desc,color,rhythms:[id],slots:[{day,start,end}]}]
phaseOpacity 0.05–1 (default 0.3)
```
`day` 0 = Monday; times in minutes on a 15-min grid; event `start` 0–1425, `end` ≤ 2880; phase `end` ≤ 1440. `parseData()` is the single place that validates and migrates (legacy single `day/start/end`, free-text person names, and the old v6 names `periodSets`/`periods`/`periodOpacity`/`sets`). Callers assign `S` themselves.

## 11. Printing, agendas, i18n, icons
- **[U]** **Light/dark theme** toggle in Settings (System default = follows `prefers-color-scheme`; Light/Dark force it via `data-theme` on `<html>`; colours are CSS variables, dark values duplicated in the media query and the `[data-theme=dark]` rule). Per browser (prefs), never in the save file; printing is always light.
- **[U]** **Day agenda** (click a day header): items shown that day in time order (time, title, person, with, schedules, ⚠, description; continuation pieces say "from Mon 22:00"), printer-friendly. **[U]** **Print schedule**: current grid on A4 portrait in light colours, with the visible schedules and people listed at the top. **[U]** **Print day view**: one-column clone of the grid for that day only (all boxes and phases as on screen; lips regenerated). Mechanism: hidden `#pr` is filled, `window.print()`, `@media print` hides everything else.
- **[U]** English/Spanish. Language from `navigator.languages[0]` (`es*` → Spanish), switchable in Settings, not persisted. **[U]** Icons: calendar icon for schedules, user icon in the person's colour for people, calendar favicon (inline SVG). Dynamic strings: add a key to both `D.en` and `D.es`, use `L('key',{var})`; static dialog HTML: English in the HTML plus an `['English prefix','Spanish']` entry in `ES` (keys <12 chars match exactly; longer by prefix; `applyStatic()` handles `<dialog>` only). Always `esc()` user text in `innerHTML`.

## 12. Parked / open items
- **[P] Richer JSON import** — user wants to revisit later; do NOT start. Agreed direction: preview dialog (checklist tree; ticking an item pulls in its dependencies; dangling refs dropped) then **Replace** (today's behaviour) / **Insert** (new ids, no overwrite, "(2)" on name clashes, optional single target schedule/rhythm) / **Merge** (match by name, skip identical events, conflict policy chosen once: keep mine / take file's / keep both) / **New session** (named workspaces in browser memory with a sidebar switcher; per-session save/restart/clear; new storage layout + migration of the single data key). Rules: Insert/Merge are one undo step, view settings never imported, warn near the ~5 MB localStorage limit. Suggested order: preview + Replace + Insert → Merge → Sessions.
- **[P]** Align the end-time select labels with the compact notation (drop "Day after next": `00:00` end of start day, `00:15 (Next day)` … `23:45 (Next day)`, `00:00 (Next day)`).
- **[P]** Long-press as a touch equivalent of right-click (locked events can't be copied on touch yet); phases in day agendas; lip text shrinking for very short phases.

## 13. Code map (everything is in `index.html`)
- State `S` (data) + `prefs` (view). `render()` rebuilds the grid; `renderSide()` rebuilds the sidebar (skipped while dragging an opacity slider via `skipSide`).
- Time helpers: `fmt`, `fmtEnd`, `endLabel`, `piecesOf` (event → per-day pieces), `overlapSet` (week-wrapped overlap detection), `piecesAt/handlesAt` (hit-testing, polymorphic for events/phases via `act()`, `eVis`, `eLock`, `sVis`).
- Interaction: `grab` (disambiguation) → `startDrag` (move/resize, all vs Shift) / `startCreate`; `overlapMenu` (choosers, optional grouping); history: `hist()` *before* mutations or `pushUndo(before)` for drags; `restoreState` preserves view state.
- Dialogs: `openDlg` (kind inferred: event/phase), `openCopy`, `xdlg` (generic modal), `pickColor`, `openSettings`, `openHelp`, `showAgenda`.
- Persistence: `parseData`, `payload`, `dataKey`, `saveMem/loadMem/saveFile`, `restart`, `clearMem`, `initDefault`/`defaultRhythm`.
- Geometry: each day = `.dw` wrapper = `.lane` (outside-left, lips and `.lbg` bands) + `.day`; header cells `.dh` pad by the lane and draw their left separator (and the weekend hue, header only) with background gradients offset by `var(--lane)`.

## 14. Testing notes (no test suite in the repo)
Logic was verified with `jsdom` scripts: stub `HTMLDialogElement.showModal/close`, `confirm`, `prompt`; `getBoundingClientRect` returns zeros, so `colAt()` always resolves to the *last* displayed column and `minAt(y)` = `vs()*60 + y/48*60` — put test events on Sunday or stub rects. Always check `new Function(scriptText)` for syntax after patching, and re-run earlier scenarios after structural changes.
