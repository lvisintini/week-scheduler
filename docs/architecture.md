# Code map (everything is in `index.html`)

- State `S` (data) + `prefs` (view). `render()` rebuilds the grid; `renderSide()` rebuilds the sidebar (skipped while dragging an opacity slider via `skipSide`).
- Time helpers: `fmt`, `fmtEnd`, `endLabel`, `piecesOf` (event → per-day pieces), `coreOf`/`coreIn`/`fitMg`/`edgeNote` (flexible start/end), `overlapSet` (week-wrapped overlap detection of cores), `piecesAt/handlesAt` (hit-testing, polymorphic for events/phases via `act()`, `eVis`, `eLock`, `sVis`).
- People outside the household and background strips: `isExt`, `ourPeople`, `isBg` (marked `bg` only, R-EVT-19; dialog `#fBg`/`updBg`; old data upgraded by `MIG[3]`), `pplOf` (on-call rule); strips are drawn in `render()` after the boxes (`bgs`, `gutMap`, `SW` = strip width), each with its band (`.bgb`, `d._bb`) inserted before `.gl`; the People sidebar splits `ourPeople()` and the `.extg` sub-group.
- Side-by-side layout: `fixedLayout` (R-EVT-23, while `prefs.lanesFix`), `laneLayout` (clash/parallel matrices, groups, spanners, joining people's own lanes `join`/`fits`, lane-order search, fallback; R-EVT-10/13/18), `laneMap` (last drawn lane ranges, keyed `eventId|slotIndex|piece`) read by `inLane`; boxes and stripes carry `data-lane="l/n"` or `"l0-l1/n"` (tests read that, since jsdom rewrites the `calc()` positions).
- Nested activities (R-NST): `nestPick` (the rule), `dayPieces`/`nestOfDay`/`nkey` (pieces of a day, keyed like `laneMap`), `nestMap` (last drawn grid, for the peek card), `insetPos`/`NI` (drawing), `isNestK`/`nestFirst` (hit-testing), `nestCarry`/`carryMove` (drag).
- Focus on one day: `focusD`, `setFocus`, `stepFocus`, `weekDays` (R-GRID-11); header buttons `.dhb` (`.foc`, `.prv`, `.nxt`, `.wk`).
- Live View (R-GRID-12): `live`/`livePaused`/`liveTop`/`liveWant`/`lvRet`/`LV_BACK`, `today`, `setLive`, `liveScroll`, `liveTick` (on the 30 s interval with `drawNow`), `liveBack`, `liveBusy` (`ptrHeld` from document pointer listeners), `updLive` (sidebar `#lvB`/`#lvC`, pill `#lvPill`); tap bubbles: capture listeners on `#grid` (`lvDown`) → `liveTap` → `lvDraw` (`.lvb` with sections `.lvs` in a `.lvl` layer, `lvRects`, `LV_AR`, `LV_SLACK`), `lvOpen`/`lvClose`/`lvCloseAll`, `LV_PEEK`; `piecesAt` takes an optional list (events only here); `lvOn` in `render()` (class `lv`, bare header); restored from `prefs.live` at startup.
- Interaction: `grab` (disambiguation) → `startDrag` (move/resize, all vs Shift) / `startCreate`; `overlapMenu` (choosers, optional grouping); history: `hist()` *before* mutations or `pushUndo(before)` for drags; `restoreState` preserves view state.
- Dialogs: `openDlg` (kind inferred: event/phase), `openCopy`, `xdlg` (generic modal), `pickColor`, `openSettings`, `openHelp`, `showAgenda`.
- Event dialog day table (R-UI-07, R-REP-02): `rows` = the seven days, each with its further times in `o.more` (`addTime`, lines `.dr.dx`); every time uses `rowCtl`/`rowSub`/`rowTexts`/`rowLoad`/`rowSlot`; `tmSet` (timing), `wSet`/`wPop` (a time's With), `copyDay`/`copyVals` (⧉), `newDay`, `tmItems` (every time of every ticked day), `perfOpts`/`OWN`/`ownLbl`/`updOwn` (owner), `defInv`, `updOc`, `cSet`/`cPop`/`updCols`/`rowPerf`/`dlgTy` (a time's colour; `colRaw` resolves it and `colOf`, which applies the Tools colouring of R-UI-11, is what everything draws, R-EVT-22). Owner and involved per day: `invOf(e,s)`, `sameSet`, `parseData`'s `own` step, `MIG[4]` (R-EVT-20/21).
- **Dialog chaining gotcha:** a button handler of `xdlg` that opens another dialog used to get it closed again right away (the first dialog auto-closes after the handler). `xdlg` now tracks the current dialog (`xTok`) and skips the auto-close when a handler replaced it; chained flows additionally defer with `setTimeout(…,0)`. Always test dialog flows by *clicking the real buttons*, not by calling the functions directly (that is how this bug slipped through once).
- Data format: `FMT`, `MIG`, `verOf`, `migrate` (before every `parseData` of saved data), `memNewer`, `errKey` (R-DATA-08/09).
- Persistence & workspaces: `parseData` (validation of one workspace), `parseWorkspace`, `buildFile`, `keyOf`/`wsDirty`/`anyDirty`, `loadStore`, `saveMem(scope)`, `saveFile()`, `saveTo(target)`, `openShare()`/`handleShareLink`, `openImport`/`pickReplace`/`confirmReplace`/`applyImport`/`insertInto`/`adoptWs`, `switchWs`/`syncWs`/`addWorkspace`/`wsMenu`, `openTransfer`/`doTransfer`/`askPeople`/`mapTypes`, `restart`, `clearMem`, `initDefault`/`defaultData`/`defaultRhythm`.
- Activity types: `TICONS`/`tIcon`/`TYN`/`iconName` (icon set), `defaultTypes`, `tyOf`/`tyTag`, sidebar `iconMenu`/`tyMenu`/`delType`; list reordering `gripFor(row, list, item, group)` (People, per sub-group); the dialog list is `#fTy` (`updTyIc`). Event dialog: `updOc` (on-call row).
- Resize handles are *not* inside their boxes: each `.rz` is a child of the `.day` column positioned at the box's bottom (`translateY(-100%)`), sharing the box's pointer handler; tests reach it with `box._rz`.
- Static dialog translation gotcha: `applyStatic` re-translates every `[title]` in dialogs from the English it first saw (`__t`), by prefix; a title set from `L()` at runtime must also set `el.__t` to the translated text, or a shorter prefix key overwrites it (this once hit the flexible-time toggles).
- Geometry: each day = `.dw` wrapper = `.lane` (outside-left, lips and `.lbg` bands) + `.day`; header cells `.dh` pad by the lane and draw their left separator (and the weekend hue, header only) with background gradients offset by `var(--lane)`.

## Names by requirement

Implementation names that the requirement files describe in words (functions, variables, constants, CSS classes and custom properties), listed under the requirement they implement. Search `index.html` for them.

- R-DATA-02: `buildFile`, `parseWorkspace`
- R-DATA-03: `openImport`, `pickReplace`, `confirmReplace`, `adoptWs`
- R-DATA-04: `openTransfer`, `askPeople`
- R-EVT-03: `fitMove`
- R-EVT-05: `fitMeasure`, `fitMove`, `fitApply`, `.clipped`
- R-EVT-10: `laneLayout`, `laneMap`, `inLane`, `fxAt`
- R-EVT-11: `.ev.soft`
- R-EVT-12: `--dash`
- R-EVT-15: `coreOf`, `fitMg`, `errCore`, `.tsel`, `.dsub`, `.mg.t`, `.mg.b`, `.ev.mgo`, `edgeNote`, `piecesAt`, `coreIn`
- R-EVT-16: `pplOf`, `slotVisible`
- R-EVT-17: `isBg`, `.bgs`, `gutMap`, `.bgb`, `fxW`
- R-EVT-19: `updBg`
- R-EVT-21: `pplOf`, `slotVisible`
- R-EVT-22: `.cbtn`, `cSet`, `updCols`, `dlgTy`
- R-EVT-23: `laneLayout`, `fixedLayout`, `segs`
- R-GRID-03: `wj`, `--weh`
- R-GRID-06: `DAY2`, `nr`
- R-GRID-07: `.zsub`, `fitted`
- R-GRID-11: `.foc`, `focusD`, `.dh.fo`, `.prv`, `.nxt`, `stepFocus`, `.wk`, `printDay`, `days = [focusD]`
- R-GRID-12: `.lvrow`, `lvin`, `LV_SLACK`, `LV_PEEK`, `lvTime`, `lvOpen`, `lvDraw`, `.lvstem`, `liveTick`, `liveBusy`, `liveTop`, `LV_BACK`, `lvRet`, `liveBack`
- R-NST-01: `nestPick`, `pplOf`
- R-NST-02: `insetPos`, `NI`, `nestFirst`
- R-NST-03: `nestCarry`, `carryMove`
- R-PHS-08: `defaultRhythm()`
- R-PPL-01: `slotVisible`
- R-PPL-03: `.extb`, `ourPeople()`
- R-PPL-04: `.subh`, `.extg`
- R-REP-02: `.dr.dx`
- R-REP-06: `isAdv`
- R-SEC-02: `normHex`
- R-SHARE-01: `openProtect`
- R-SHARE-03: `genPassword`
- R-SHARE-04: `seal`, `unseal`
- R-SHARE-07: `plainWarn`, `buildFile`
- R-STAT-01: `openStats`, `stP`, `stInv`
- R-STAT-02: `personStats`
- R-STAT-04: `cellSafe`
- R-TYP-01: `iconMenu`
- R-TYP-02: `TYN`
- R-TYP-03: `mapTypes`, `retype`
- R-TYP-04: `tvis`, `restoreState`
- R-UI-03: `setTab`
- R-UI-07: `.fg`, `.chips`, `rowCtl`, `rowSub`, `.wbtn`, `.tsel`, `.dsub`
- R-UI-10: `.dgrip`, `dlgPlace`, `moved`
- R-UI-11: `.noty`, `NOTY`
- R-UI-12: `dlgJump`, `.dr.pulse`
