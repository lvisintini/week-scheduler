# Code map

## Files
The app is static files served as they are (no build): `index.html` (markup, the static dialogs, the CSP), `app.css` (all styles; `#pgStyle` in `index.html` is the print page size, set at runtime) and classic scripts in `js/`, loaded with `<script src defer>` in this order. They share **one global scope** (top-level `function`/`const`/`let` of every file are visible to the others), so a function may call one from any file, but a top-level statement that **runs at load** may only use what earlier files define. Not ES modules: module bindings are not globals, and the tests reach the state by name (`a.ev`); modules would first need the mutable state gathered into one object (parked).

| File | Holds |
|---|---|
| `js/i18n.js` | `D` (English/Spanish strings), `ES` (static dialog texts), `L`, `tr`, `applyStatic` |
| `js/basics.js` | `$`/`el`, icons (`I`, `ICON_*`, `TICONS`), colour utilities, the colour popover (`pickColor`) |
| `js/data.js` | state and history (`S`, `WS`, `hist`, `undo`/`redo`, `restoreState`), `FMT`/`MIG`/`migrate`/`parseData`, workspaces, browser memory (`readStore`, `withStore`, `writeStore`, `memKey`/`isSealed` for a protected store, R-DATA-11), the cycle of weeks (`setCycle`, `reorderWeeks`, `shrinkCycle`…), import and transfers |
| `js/share.js` | what to include (`incPicker`, `partOf`, `shareOf`), links (`inflate`), encryption (`seal`/`unseal` with an optional reused key, `newKey`/`keyFor`, `sealedOk`), `askPassword`, `openProtect`, `openShare`, `saveFile`, `loadMem`, `restart`, `clearMem`/`eraseMem`, the passphrase of browser memory (`askUnlock`, `openPassphrase`, `protectMem`/`changePass`/`unprotectMem`, `lockNow`) |
| `js/ics.js` | the calendar export (R-SHARE-09): `icsText` (a workspace record → the `.ics` text; pure), `icsFold`, `icsEsc`, `openIcs` (the dialog), `saveIcs` (the download) |
| `js/model.js` | `prefs`, theme, `toast`, helpers (`fmt`, `piecesOf`, weeks `wksOf`/`inWk`, flexible time, `overlapSet`), lanes, nesting, Live View, `xdlg`, the agendas' helpers |
| `js/stats.js` | statistics (`personStats`, `openStats`, turns), agendas and printing |
| `js/sidebar.js` | `renderSide` and the sidebar menus |
| `js/grid.js` | `render`, pointer and touch interactions, the peek card, zoom, dragging |
| `js/dialog.js` | the event/phase dialog (`openDlg`, the day table) and the copy dialog |
| `js/main.js` | wiring and startup (runs last): a protected browser memory asks `askUnlock` first, then `afterStore` (today's week, Live View, a shared link) |

The test harness (`tests/helpers/app.js`) gives jsdom one document with `app.css` and each script inlined in this order (one `<script>` per file, as a browser runs them); `tests/e2e/serve.js` serves exactly these files, like GitHub Pages.

## Map

- State `S` (data) + `prefs` (view). `render()` rebuilds the grid; `renderSide()` rebuilds the sidebar (skipped while dragging an opacity slider via `skipSide`).
- Time helpers: `fmt`, `fmtEnd`, `endLabel`, `piecesOf` (event → per-day pieces), `coreOf`/`coreIn`/`fitMg`/`setMg`/`coreEdge`/`edgeNote` (flexible start/end), `overlapSet` (week-wrapped overlap detection of cores; squeezed-out *Around these times*), `piecesAt/handlesAt` (hit-testing, polymorphic for events/phases via `act()`, `eVis`, `eLock`, `sVis`).
- People outside the household and background strips: `isExt`, `ourPeople`, `isBg` (marked `bg` only, R-EVT-19; dialog `#fBg`/`updBg`; old data upgraded by `MIG[3]`), `pplOf` (on-call rule); strips are drawn in `render()` after the boxes (`bgs`, `gutMap`, `SW` = strip width), each with its band (`.bgb`, `d._bb`) inserted before `.gl`; the People sidebar splits `ourPeople()` and the `.extg` sub-group.
- Side-by-side layout: `fixedLayout` (R-EVT-23, while `prefs.lanesFix`), `laneLayout` (clash/parallel matrices, groups, spanners, joining people's own lanes `join`/`fits`, lane-order search, fallback; R-EVT-10/13/18), `laneMap` (last drawn lane ranges, keyed `eventId|slotIndex|piece`) read by `inLane`; boxes and stripes carry `data-lane="l/n"` or `"l0-l1/n"` (tests read that, since jsdom rewrites the `calc()` positions).
- Nested activities (R-NST): `nestPick` (the rule), `dayPieces`/`nestOfDay`/`nkey` (pieces of a day, keyed like `laneMap`), `nestMap` (last drawn grid, for the peek card), `insetPos`/`NI` (drawing), `isNestK`/`nestFirst` (hit-testing), `nestCarry`/`carryMove` (drag).
- Squeezed-out *Around these times* (R-EVT-12): `covers` (does a union of intervals cover a range), `sqPick` (the rule over a day's pieces and Away pieces), `sqOf` (per occurrence, every piece, with a per-redraw cache), `sqMap` (last drawn grid, for `piecesAt`), `sqLine`; `render` turns squeezed pieces into cores before Away clashes and stripes; `personStats` has its own per-person check.
- Focus on one day: `focusD`, `setFocus`, `stepFocus`, `weekDays` (R-GRID-11); header buttons `.dhb` (`.foc`, `.prv`, `.nxt`, `.wk`).
- Cycles of weeks (R-CYC): `S.cycle` (`cyc()`), the kept weeks `S.pool` (`kept()`; staged weeks after the cycle, R-CYC-21), the shown week `curWk` (view state), `wksOf` (an event's pattern `weeks` or a repetition's `wk`, the cycle's weeks only), `inWk` (does a piece appear in week w; a Sunday's part after midnight belongs to the next week), `prevWk`, the weeks' names, descriptions and colours (R-CYC-17: `S.weekInfo`, `wiNorm` (validation), `wiResize` (cycle changes), `wkI`/`wkLabel`/`wkShortL`/`wkTip`/`wkDesc`/`wkCol`/`wkChip`/`wksHTML`/`wkNoteH`, the band `#grid.wkband` + `--wkc`, printed `wkH1`/`.wkh`, the cycle dialog's `.cywr` rows), `ivs(s,e,win)` (cores, or with `win` whole windows, on the cycle's timeline, for `overlapSet`), `normWk` (validation and normalisation, also after dialog saves and cycle changes); the corner switcher `.wkb` → `wkMenu`/`setWeek`; `openCycle`/`setCycle`/`extendWeeks`/`shrinkCycle`/`moveWeeks` (R-CYC-10); `askCycle`/`placeWeeks` (insert and transfer, R-CYC-13); today's week `todayWk`/`liveWk`/`setAnchor`/`askLiveWeek`/`ymd`/`dnum`/`thisMon` (anchor in `prefs.lvAnchor` per workspace, R-CYC-05); dialog `dWk`, `drawWk` (`#fWk`), `setPW`, `wkCtl`/`wkSet`/`wkPop` (the `.wkc` button in a time's day cell), `snapRow`/`loadRow`/`sortDay`; drags `absD`/`shiftDay`/`sameDay`; statistics `personStats(pid,inv,w)`, `stOf`/`stWeeks`/`stW`, the dialog's view `stU` (unit, `stVal`/`stTip`), `stHide`/`stView`/`stOrder`/`stNF` (type filter, key `stFK`; the list `tyPop`/`stTyKeys`, button `.sttyb`), `wkInfoTip`/`wkTh` (*W2 ⓘ*); print `printAll`/`schedPage`/`dayPage`/`wkSuf`; labels `wksText`/`wkNote`/`evWks`.
- Away (R-EVT-24): `isAway`, `awayPpl`, `awayHits` (the clash rule), `awayPieces`/`awayOf`/`awayLine` (peek card, agenda); in `render()` the hit map `awc`, stripes `.ov.awov`, strips `.bgs.aw` (no `.bgb` band), the fixed-lane hatch `.awl` (`fixIds`); dialog radios `#fBox`/`#fBg`/`#fAw` in `#fDraw`; statistics `away`/`awPl`, pattern `#sta`.
- Live View (R-GRID-12): `live`/`livePaused`/`liveTop`/`liveWant`/`lvRet`/`LV_BACK`, `today`, `setLive`, `liveScroll`, `liveTick` (on the 30 s interval with `drawNow`), `liveBack`, `liveBusy` (`ptrHeld` from document pointer listeners), `updLive` (sidebar `#lvB`/`#lvC`, pill `#lvPill`); tap bubbles: capture listeners on `#grid` (`lvDown`) → `liveTap` → `lvDraw` (`.lvb` with sections `.lvs` in a `.lvl` layer, `lvRects`, `LV_AR`, `LV_SLACK`), `lvOpen`/`lvClose`/`lvCloseAll`, `LV_PEEK`; `piecesAt` takes an optional list (events only here); `lvOn` in `render()` (class `lv`, bare header); restored from `prefs.live` at startup.
- Interaction: `grab` (disambiguation) → `startDrag` (move/resize, and `fs`/`fe` for a core edge, R-EVT-15; all vs Shift); `edgesAt` (the core edges under the pointer) / `startCreate`; `touchCopy` (a long press lifted without moving → the Copy list, R-TOUCH-02); `overlapMenu` (choosers, optional grouping); history: `hist()` *before* mutations or `pushUndo(before)` for drags; `restoreState` preserves view state.
- Dialogs: `openDlg` (kind inferred: event/phase), `openCopy`, `xdlg` (generic modal; `wide`, `full` = full screen on a phone, `stack` = one button per line), `pickColor`, `openSettings`, `openHelp`, `showAgenda`.
- Phone dialogs (R-UI-14): the CSS block after `#dlg.ph .ev-only` (full screen for `#dlg`, `#agDlg`, `#xDlg.full`; tabs); the event dialog's `.dtabs` (tab row) and `.dpane[data-p=ev|wh|mo]` (sections), `dlgTab` (show a tab; runs a pending `dJump`), `dTabs`, `dErr` (a failed save → its tab, marked `.bad`), the When tab's `.warn` set in `updWarn`; dragging (`dlgPlace`) and the grip's arrow keys return early on `phone()`.
- Event dialog day table (R-UI-07, R-REP-02): `rows` = the seven days, each with its further times in `o.more` (`addTime`, lines `.dr.dx`); every time uses `rowCtl`/`rowSub`/`rowTexts`/`rowLoad`/`rowSlot`; `tmSet` (timing), `wSet`/`wPop` (a time's With), `cpyPop` (⧉'s menu: all / below / above), `cpyTo` (the target days of a direction), `copyDay(o,dir)`/`copyVals` (⧉), `newDay`, `tmItems` (every time of every ticked day), `perfOpts`/`OWN`/`ownLbl`/`updOwn` (owner), `defInv`, `updOc`, `cSet`/`cPop`/`updCols`/`rowPerf`/`dlgTy` (a time's colour; `colRaw` resolves it and `colOf`, which applies the Tools colouring of R-UI-11, is what everything draws, R-EVT-22). Owner and involved per day: `invOf(e,s)`, `sameSet`, `parseData`'s `own` step, `MIG[4]` (R-EVT-20/21).
- **Dialog chaining gotcha:** a button handler of `xdlg` that opens another dialog used to get it closed again right away (the first dialog auto-closes after the handler). `xdlg` now tracks the current dialog (`xTok`) and skips the auto-close when a handler replaced it; chained flows additionally defer with `setTimeout(…,0)`. Always test dialog flows by *clicking the real buttons*, not by calling the functions directly (that is how this bug slipped through once).
- Data format: `FMT`, `MIG`, `verOf`, `migrate` (before every `parseData` of saved data), `memNewer`, `errKey` (R-DATA-08/09).
- Persistence & workspaces: `parseData` (validation of one workspace), `parseWorkspace`, `buildFile`, `keyOf`/`wsDirty`/`anyDirty`, `loadStore`, `saveMem(scope)`, `saveFile()`, `saveTo(target)`, `openShare()`/`handleShareLink`, `openImport`/`pickReplace`/`confirmReplace`/`applyImport`/`insertInto`/`adoptWs`, `switchWs`/`syncWs`/`addWorkspace`/`wsMenu`, `openTransfer`/`doTransfer`/`askPeople`/`mapTypes`, `restart`, `clearMem`, `initDefault`/`defaultData`/`defaultRhythm`.
- Activity types: `TICONS`/`tIcon`/`TYN`/`iconName` (icon set), `defaultTypes`, `tyOf`/`tyTag`, sidebar `iconMenu`/`tyMenu`/`delType`; list reordering `gripFor(row, list, item, group, tip)` (People, per sub-group; activity types, schedules and rhythms); the dialog list is `#fTy` (`updTyIc`). Event dialog: `updOc` (on-call row).
- Resize handles are *not* inside their boxes: each `.rz` is a child of the `.day` column positioned at the box's bottom (`translateY(-100%)`), sharing the box's pointer handler; tests reach it with `box._rz`.
- Static dialog translation gotcha: `applyStatic` re-translates every `[title]` in dialogs from the English it first saw (`__t`), by prefix; a title set from `L()` at runtime must also set `el.__t` to the translated text, or a shorter prefix key overwrites it (this once hit the flexible-time toggles).
- Geometry: each day = `.dw` wrapper = `.lane` (outside-left, lips and `.lbg` bands) + `.day`; header cells `.dh` pad by the lane and draw their left separator (and the weekend hue, header only) with background gradients offset by `var(--lane)`.

## Names by requirement

Implementation names that the requirement files describe in words (functions, variables, constants, CSS classes and custom properties), listed under the requirement they implement. Search `index.html` for them.

- R-CYC-03: `normWk`
- R-CYC-04: `curWk`, `.wkb`, `wkMenu`
- R-CYC-05: `todayWk`, `wkAt` (the week of any date, also used by the calendar export), `liveWk`, `setAnchor`, `askLiveWeek` (optional texts, for the calendar export), `prefs.lvAnchor`
- R-CYC-06: `inWk`, `prevWk`, `ivs`
- R-CYC-08: `#fWk`, `#fPw`, `.wkc`, `setPW`
- R-CYC-09: `shiftDay`, `sameDay`
- R-CYC-10: `extendWeeks`, `shrinkCycle`, `moveWeeks`
- R-CYC-13: `askCycle`, `placeWeeks`
- R-DATA-02: `buildFile`, `parseWorkspace`
- R-DATA-03: `openImport`, `pickReplace`, `confirmReplace`, `adoptWs`
- R-DATA-11: `memKey`, `isSealed`, `withStore`, `writeStore`, `newKey`/`keyFor`, `askUnlock`, `afterStore`, `openPassphrase`, `protectMem`, `changePass`, `unprotectMem`, `lockNow`, `eraseMem`, `.pwl`, `.ulerase`, `help21`
- R-DATA-10: `openWorkspaces`, `orderWs`, `prefs.wsOrder`, `rowGrip` (shared with the cycle dialog), `.wsr`, `.wsbtn.wscol`/`--wsc`
- R-DATA-04: `openTransfer`, `askPeople`, `carryEvents` (shared by a schedule's transfer and a single event's copy/move in `openCopy`), `openPeopleCopy`
- R-EVT-03: `fitMove`
- R-EVT-05: `fitMeasure`, `fitMove`, `fitApply`, `.clipped`
- R-EVT-10: `laneLayout`, `laneMap`, `inLane`, `fxAt`
- R-EVT-11: `.ev.soft`
- R-EVT-12: `coreOf` (no core), `.ev.mgo`, `sqPick`, `covers`, `sqOf`, `sqMap`, `sqLine`
- R-EVT-15: `coreOf`, `fitMg`, `setMg`, `coreEdge`, `edgesAt`, `errCore`, `.tsel`, `.dsub`, `.mg.t`, `.mg.b`, `.ev.mgo`, `.rz.cs`, `.rz.ce`, `edgeNote`, `piecesAt`, `coreIn`
- R-EVT-16: `pplOf`, `slotVisible`
- R-EVT-17: `isBg`, `.bgs`, `gutMap`, `.bgb`, `fxW`
- R-EVT-19: `updBg`
- R-EVT-21: `pplOf`, `slotVisible`
- R-EVT-22: `.cbtn`, `cSet`, `updCols`, `dlgTy`
- R-EVT-23: `laneLayout`, `fixedLayout`, `segs`, `fixIds`
- R-EVT-24: `isAway`, `awayHits`, `.bgs.aw`, `.awov`, `.awl`, `#fAw`
- R-GRID-03: `wj`, `--weh`
- R-GRID-06: `DAY2`, `nr`
- R-GRID-07: `.zsub`, `fitted`, `RH`/`FH` (the row-height prefs keys in use: `rowHP`/`fitHP` on a phone)
- R-GRID-11: `.foc`, `focusD`, `.dh.fo`, `.prv`, `.nxt`, `stepFocus`, `.wk`, `printDay`, `days = [focusD]`
- R-GRID-12: `.lvrow`, `lvin`, `LV_SLACK`, `LV_PEEK`, `lvTime`, `lvOpen`, `lvDraw`, `.lvstem`, `liveTick`, `liveBusy`, `liveTop`, `LV_BACK`, `lvRet`, `liveBack`
- R-NST-01: `nestPick`, `pplOf`
- R-NST-02: `insetPos`, `NI`, `nestFirst`
- R-NST-03: `nestCarry`, `carryMove`
- R-PHS-08: `defaultRhythm()`
- R-PRN-04: `agendaHTML` (`one`, `phs`, `blocks`, `outs`), `.aph`, `.apg`, `.ae`
- R-PHS-10: `fitLips`, `lipK`, `.lip.s0`/`.s1`/`.s2`, `.lbg[data-fs]`
- R-PPL-01: `slotVisible`
- R-PPL-03: `.extb`, `ourPeople()`
- R-PPL-04: `.subh`, `.extg`
- R-REP-02: `.dr.dx`, `cpyPop`, `cpyTo`
- R-REP-06: `isAdv`
- R-SEC-02: `normHex`
- R-SHARE-01: `openProtect`
- R-SHARE-03: `genPassword`
- R-SHARE-04: `seal`, `unseal`
- R-SHARE-07: `plainWarn`, `buildFile`
- R-SHARE-08: `partOf`, `shareOf`, `incPicker` (`.partbox`/`.partsel`/`.partl`/`.partsum`, shared by `openProtect` and `openIcs`)
- R-SHARE-09: `openIcs`, `icsText`, `icsFold`, `icsEsc`, `saveIcs`, `wkAt`, `prefs.icsLast`, `.icsteps`, `.icsrow`, `.icswk`, `.icslast`
- R-STAT-01: `openStats`, `stP`, `stInv`
- R-STAT-02: `personStats`
- R-STAT-04: `cellSafe`
- R-STAT-05: `stU`, `stVal`, `stTip`, `.stu`
- R-STAT-06: `stWeekBar` (HTML `.stwk`), `stDayBars` (`.stv`, `.stdt`)
- R-STAT-07: `stHide`, `stView`, `stOrder`, `stFK`, `tyPop`, `stTyKeys`, `.sttyb`, `.typop`, `.stf`
- R-TYP-01: `iconMenu`
- R-TYP-02: `TYN`
- R-TYP-03: `mapTypes`, `retype`
- R-TYP-04: `tvis`, `restoreState`
- R-UI-03: `setTab`
- R-UI-07: `.fg`, `.chips`, `rowCtl`, `rowSub`, `.wbtn`, `.tsel`, `.dsub`
- R-UI-10: `.dgrip`, `dlgPlace`, `moved`
- R-UI-11: `.noty`, `NOTY`
- R-UI-12: `dlgJump`, `.dr.pulse`
- R-CYC-18: `turnsOf` (mode: `event.turns`), `tuSum`, `stRotas`, `statsTurnsHTML` (✕ `.tux`, `.tuadd`), `setTurns`, `tuAddPop` (`.tupop`), `statsTurnsRows`, `updTurns`, `#fTuM`/`#fTu`/`#fTuL`, `.sttu`
- R-CYC-16: `wksOf` (phases too), `normAll`, `moveWeeks` (a rhythm per removed week), `placeWeeks` (events and phases), `wkRowTipPh`, `.pwk` (rhythm agenda)
- R-CYC-19: `allWk`/`setAllWk`, `cols` in `render()` (week-day columns, `curWk` set per column), `gk` (week-keyed `laneMap`/`gutMap`/`nestMap`/`sqMap`), `atCol` (from `colAt` and the column handlers), `aD` in `startDrag`, `withWk`/`oneWeek`, `agWk`, `.dh.wkbd`, `.wks`
- R-CYC-20: `reorderWeeks`, `wkFollow`, undo entries `{s, wp}` (`undo`/`redo`), the cycle dialog's `rows`/`mvRow`/`gripRow`, `.cywr .grip`
- R-CYC-21: `S.pool` (`poolOf(d)`, `kept()`), `inCyc`/`stgSl`/`cycSl`/`onCyc` (model.js; `wksOf` gives only the cycle's weeks), `chosen`/`lostIn`, `remapWk` (renumbers or drops kept weeks), `copyWeek` (a new staged week as a copy, `.cyfrom`), the cycle dialog's `applyWeeks` (order first, then length) and `askGone`, `.cystg`/`.cywr.stg`/`.cydel`/`.cyadd`/`.cyholds`
- R-CYC-22: drags skip `stgSl` times (`startDrag`, `nC`); the dialog's `dWk.stgW`/`stgL`/`base`/`nw`, `patW`, `stgLines`, `.wkstg`
- R-CYC-23: `stgWks`, the `#fDel` question
- R-CYC-17: `wiNorm`, `wiResize`, `wkLabel`, `wkChip`, `.wkchip`, `#grid.wkband`, `.wkh`, `.cywr`
- R-UI-13 (phone layout pass): the floating rail and the two-line drawer header (CSS block after `.sbtop .eye`), `WK`/`FWK`/`phoneFit` (a phone's width follows the view), the phone cards: `cardHead` (the `.sum` header button with `.dn` title and `.sm` summary), `cardOpen` (one open), `cardSums` (from `updWarn`), `addPop`/`#fAddT` (+ Add a time), `rmFirst`/`.rx` (✕ on a day's first time), the labels `.cl` (made in `rowCtl`, translated in `rowTexts`); `wcell`/`.wkw` (the week's own cell and the Week column `.dhd>.wkh`); `.dr.alt` (day bands; `.dr` is a subgrid); the floating Live View Now `#lvF` (`#sb.lv`, `#sb.paused` from `updLive`)
- R-UI-14: `.dtabs`, `.dpane`, `dlgTab`, `dTabs`, `dErr`, `dJump`, `#xDlg.full`
