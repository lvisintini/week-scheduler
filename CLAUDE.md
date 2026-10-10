# Project context (for Claude / future contributors)

Point Claude at this file when continuing work. It describes the **current** behaviour and design; history is summarised at the end.

## 1. What this is
A single static `index.html` (HTML + CSS + vanilla JS, no libraries, no network) that must keep working when opened from disk or GitHub Pages. A weekly planner: Mon→Sun columns, hourly rows, **schedules** that can be overlaid, **events** with repetitions, **people**, and background **rhythms** (named parts of the day). English/Spanish UI. Built iteratively with Claude.

## 2. Data model (save file version 7, `payload()`)
```
schedules  [{id,name,color,opacity,locked,visible}]
people     [{id,name,color,visible}]
events     [{id,title,desc,color,schedules:[id],involved:[personId],
             slots:[{day,start,end,person}]}]          // "repetitions"
rhythms    [{id,name,visible}]          // a rhythm = a whole week's regular cadence (e.g. "Normal rhythm", "Holiday rhythm")
phases     [{id,title,desc,color,rhythms:[id],   // a phase = a named part of the day (Sleep time, Lunch time…)
             slots:[{day,start,end}]}]
phaseOpacity 0.05–1 (default 0.3)
```
- `day` 0 = Monday … 6 = Sunday. Times are minutes, 15-minute grid.
- **Events:** `start` 0–1425, `end` up to `MAXEND = 2880` (midnight at the end of the *next* day). Overflow continues on the next day; Sunday wraps to Monday. **Phases:** `end ≤ 1440` (stay inside one day).
- A slot is a repetition. Quick mode = at most one slot per day; Advanced mode allows several per day (see §6).
- **Naming history:** phases/rhythms were originally called "periods"/"period sets" (save format v6: keys `periods`, `periodSets`, `periodOpacity`, phase membership `sets`). `parseData()` still reads those legacy keys and converts them; new files only use the new names.
- `parseData()` is the only place that validates/migrates input (old files: single `day/start/end`, free-text person names → people, missing fields get defaults). Loaders assign `S` themselves.
- **View settings are NOT in the file.** They live in `prefs` (localStorage `weekly-schedules-prefs`): `showEarly`, `clock12`, `hideWeekend`, sidebar `w`/`collapsed`, section collapse flags (`secSch`, `secPpl`, `secPS`). Browser memory for data is `weekly-schedules-data`.
- **Data vs view state inside the file:** `schedules[].visible/opacity`, `people[].visible`, `rhythms[].visible`, `phaseOpacity` are *view state*: saved, but not undoable, not counted as unsaved changes (`dataKey()` ignores them) and preserved by `restoreState()`. Everything else (including `locked`) is data.

## 3. Visibility rules
- Event shown if ≥1 of its schedules is visible. Opacity of an event = highest opacity among its visible schedules.
- A slot is shown if it has no people at all, or any of {slot.person} ∪ {event.involved} is a visible person.
- An event is **locked** only if *all* its schedules are locked: it is click-through (`pointer-events:none`), can't be selected/moved/edited, but can be copied via right-click.
- **Only one rhythm can be visible at a time** (exclusive eye; all can be hidden). Phases of the visible set are drawn.
- Hidden weekend / hidden early hours / people filter: events hidden this way are counted in the "N hidden" badge (bottom-right of the grid; click opens Settings). Phases are never counted.

## 4. Rendering (`render()`)
- Grid: time column + one `.dw` wrapper per displayed day = `.lane` (18px, `--lane` on the grid, 0 when no rhythm visible; sits *outside/left of* the day column so lips are flush with its border) + `.day`. Header cells (`.dh`) pad by the lane and have an agenda icon; clicking opens the day agenda.
- Layer order inside `.day`: phase backgrounds (`.phx`) → hour lines (`.gl`) → events → overlap stripes (`.ov`) → now line.
- **Phases:** background band at `phaseOpacity`; a **lip** (vertical-text tab, full opacity) in the lane. Lip grouping: if the previous *displayed* column has the same phase with identical start/end, no lip is drawn there and the lane shows a translucent band (`.lbg`) so the colour stays continuous; different timing → each gets its own lip. Lip tooltip: name, day range (e.g. `Mon–Fri`), times, description.
- **Events:** split into per-day pieces (`piecesOf`); overflow pieces have flat joined edges and labels `from Fri 22:00 · until 02:00`; first piece `22:00–02:00 (Next day)`. Overlaps draw diagonal stripes of the overlapping colours (same-colour overlaps get a lightened stripe). Top-right flags: repeat icon, ⚠ (repetitions of the same event overlap, `overlapSet` on week-wrapped intervals), lock.
- **Time display:** `fmt()` wraps at 24h, so midnight is `00:00` (`12:00 AM` in AM/PM mode), never `24:00`. Compact ends: `00:00` for plain midnight, `(Next day)` suffix for anything later. The end-time *select* labels differ: `…23:45`, `00:00 (Next day)`, … `23:45 (Next day)`, `00:00 (Day after next)` (`endLabel`) — known inconsistency, alignment proposed but not done.

## 5. Interaction model
- **Edit mode** (sidebar segmented control *Events | Phases*, `editMode`): in Phases mode events are inert/dimmed and phases are interactive; in Events mode phases are background only (lips still show tooltips). This enforces "editing one can't affect the other". `act()` returns the editable list; `eVis/eLock/sVis` make hit-testing, `grab`, `startDrag` and the choosers work for both kinds (`startDrag` sets `MAXEND` to 1440 for phases).
- **Create:** drag on empty column space (or the **+** toolbar button). **Click** an event → dialog. **Right-click** a day column → list of events/phases under the pointer → Copy dialog.
- **Click vs drag disambiguation (`grab`)**: *click* where only repetitions of one event overlap → dialog directly; several different events → chooser grouped by event. *Drag* (move or resize) where more than one piece (event or repetition) could be meant → chooser listing every repetition separately; the pick becomes the selection (`selK={id,i}`, outlined, raised) and takes the next drag directly. Esc / empty click / undo clears it. Resize ambiguity uses the bottom ~9 minutes of each piece.
- **Drag/resize of a repeating event changes ALL repetitions by default** (live preview); **Shift** (also mid-drag) changes only the grabbed one. After an "all" drop a toast offers *Only this day* and *Undo* (ignored if history changed). Rules: moves shift every repetition by the same minutes and days (mod 7); resizes change every end by the same amount, **minimum 15 minutes (nothing is ever removed)**; dragging a resize handle into the next day's column extends past midnight. Quick events block moving a single repetition onto a day that already has one; Advanced events allow it. New overlaps trigger a ⚠ toast.
- **Undo/redo:** snapshot based. Call `hist()` *before* every data mutation (or `pushUndo(beforeJSON)` for drags). View-state changes don't create history.

## 6. Dialogs
- **Event/phase dialog (`openDlg`, kind inferred from the object / `editMode`)**: title + colour swatch, description, responsible person, involved people (events only), **Quick / Advanced tabs**, schedules (or rhythms), Delete, Copy…, Cancel, Save.
  - *Quick:* general Start/End + Mon–Sun rows (tick, start, end, person); rows follow the general values until edited (`custom`/`pc` flags).
  - *Advanced:* list of blocks (day, start, end, person, ✕, + Add block). Several blocks per day allowed. Advanced→Quick only while no day has two blocks (`isAdv`); an event with a duplicate day always opens in Advanced.
  - ⚠ on overlapping rows + summary line; end options ≤ start are disabled; phases hide person fields and stop at 00:00.
- **Copy dialog (`openCopy`)**: destination schedule (or rhythm); colour: same / same hue brighter-or-darker (`shiftColor`) / random / chosen. Copies are independent events (sharing = ticking several schedules).
- **Colour picker (`pickColor`)**: popover with swatches, HSL sliders, hex, Apply/Cancel (Enter applies, Esc cancels). Used everywhere instead of `<input type=color>`.
- **Settings** (gear): View (early hours, now line, AM/PM, hide weekend), Data (Restart, Clear memory), Language. **Help** (`?`). `xdlg({title,body,buttons,onDismiss})` is the generic modal.

## 7. Sidebar
Top row: favicon, title (• when unsaved), help, gear, collapse chevron (collapsible, width draggable). Then the Events|Phases switch and one icon toolbar: **+** (new event, or new phase in Phases mode; accent coloured; tooltip also mentions dragging on the grid), undo, redo, save, load, print. Collapsible sections **Schedules**, **People**, **Rhythms** (count, ⓘ tip, + button). Rows: eye, coloured icon (click = colour picker), name, … Schedule menu: colour, opacity slider, lock, "show only this one", delete. People menu: colour, delete. Phase-set row: exclusive eye, name, agenda icon, delete; one opacity slider for all rhythms sits under the list.

## 8. Persistence
- Save…/Load… open a choice: browser memory (`localStorage`) or JSON file. Auto-load from browser memory at startup. **Clear memory** (confirm) deletes it **and restarts the app** (default state, history cleared). **Restart** discards unsaved changes and reloads browser memory. Default first-run state (also after Clear memory): one schedule named **Routine** and one **visible** rhythm **"Normal rhythm"** with 9 phases (`defaultRhythm()`): Sleep time 00:00–06:00 ("4 cycles") and 22:30–24:00 ("5 cycles"), Wake time 06:00–07:15, Breakfast time 07:15–08:15, Work/School time 08:15–12:00 + 13:00–16:45 (Mon–Fri, two blocks per day), **Free time** with the same times on Sat–Sun, Lunch time 12:00–13:00, Dinner time 16:45–19:30, Bed time 19:30–22:30. Names are localised at creation time (`dRh`, `dSleep`, … in `D`).
- Dirty = current data key differs from both the last browser save and the last file save; `beforeunload` warns; title shows •.
- Loading from file currently *replaces* the data (undoable). See §11 for the planned richer import.

## 9. Printing
Print schedule (current grid + header listing visible schedules/people, light colours), day agenda (list) and **Print day view** (one-column clone of the grid for that day, lips regenerated), phase-set agenda. Mechanism: hidden `#pr` filled then `window.print()`; `@media print` hides everything else; `#pgStyle` sets `@page`. Phase-set agenda groups repetitions into runs of consecutive days with identical times, Monday→Sunday, **no Sunday→Monday wrap**.

## 10. i18n (English/Spanish) and conventions
- Language from `navigator.languages[0]` (`es*` → Spanish); switchable in Settings; not persisted.
- Dynamic strings: add a key to **both** `D.en` and `D.es`, use `L('key',{var})`. Static dialog HTML: keep English in the HTML and add `['English prefix','Spanish']` to `ES` (keys <12 chars match exactly, longer ones by prefix); `applyStatic()` handles `<dialog>` only.
- Always `esc()` user text going into `innerHTML`. Keep one file, no external requests. Tooltips (`title`) explain workarounds (e.g. emulating a two-week rota with two schedules "Week A"/"Week B" + solo).

## 11. Decisions, rationale and open items
- **Two-week rota is deliberately not a built-in feature** (judged too complex): use two schedules + eye/"show only this one"; a full design (A/B ticks, week selector, version bump) exists on paper only.
- Overflow limited to the next day; Sunday wraps to Monday; overlapping repetitions allowed with warnings; resizing never deletes a repetition.
- Locked events are click-through so events underneath stay reachable; copying them is via right-click.
- **Open / proposed (not implemented):** align the end-time select with the compact notation; richer JSON import (§13, deliberately parked); long-press as touch equivalent of right-click; phase lists in day agendas.

## 12. Testing notes (no test suite in the repo)
Logic was checked with `jsdom` scripts: stub `HTMLDialogElement.showModal/close`, `confirm`, `prompt`; `getBoundingClientRect` is all zeros so `colAt()` always resolves to the *last* displayed column and `minAt(y)` = `vs()*60 + y/48*60` — place test events on the last column (Sunday) or stub rects. Check `new Function(scriptText)` for syntax after every patch.

## 13. Parked plan: richer JSON import (NOT started — user wants to revisit later)
Today "Load → JSON file" simply **replaces** the data (undoable). Agreed direction, to be built in stages:
1. **Preview dialog** after parsing/validating the file (`parseData`): counts + a checklist tree (schedules → their events, people, rhythms → their phases), each with a checkbox. Ticking an item auto-includes its dependencies (an event's schedules and people; a phase's sets); dangling references are dropped.
2. **Actions:** *Replace* (current behaviour); *Insert* (add ticked items as new items with fresh ids, nothing overwritten, name clashes get "(2)", optional single target schedule/set for the incoming events/phases); *Merge* (match by name: unify people/schedules/sets, skip identical events (same title + schedule + slots), conflict policy chosen once — keep mine / take file's / keep both — with optional per-item review); *New session*.
3. **Sessions** (last stage, biggest change): named workspaces in browser memory with a switcher at the top of the sidebar; save/restart/clear/unsaved-warning become per-session; Clear memory would offer "this session" or "all". Needs a new storage layout (index key + one data key per session) and a migration of the single existing `weekly-schedules-data`.
4. **Rules for all actions:** Insert/Merge are one undo step; view settings in the file are never applied (they aren't stored in files anyway); old file versions go through the same `parseData` migration; warn before localStorage (~5 MB) overflows.
Suggested order: preview + Replace + Insert → Merge → Sessions.
