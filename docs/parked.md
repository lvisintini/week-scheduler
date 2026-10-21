# Parked and open items

## Next steps (update as you go)
1. Run `tests/manual/touch.md` on an iPhone (Safari) and record the result here (Android Chrome passed steps 1–25; step 26, the week switcher of a cycle, is new and not tried on a real phone yet).
2. The parked items below.

## Parked
- **[P]** (Done: workspaces, import dialog, transfers.) Possible follow-ups: copy/move individual *events* and *people* between workspaces; a workspace-name line in printouts; exporting only selected items.
- **[P]** Align the end-time select labels with the compact notation (drop "Day after next": `00:00` end of start day, `00:15 (Next day)` … `23:45 (Next day)`, `00:00 (Next day)`) (R-REP-04).
- **[P]** A touch equivalent of right-click Copy (long-press is now move/create; R-TOUCH-01); phases in day agendas; lip text shrinking for very short phases; real-device testing of the touch gestures on **iOS Safari** (`tests/manual/touch.md`; Android Chrome passed every step).
- **[P]** Cycles of weeks (R-CYC): per-week rhythms for shift work (R-CYC-16); a side-by-side view of the whole cycle (every week's days in one row).
- **[P]** Locking browser memory with a passphrase (R-DATA-02; deliberately postponed **[U]**).
- **[P]** Dragging a flexible event's core edges (R-EVT-15; today only the outer window moves and resizes).
- **[P]** A stricter CSP with hashed scripts, which needs a build step (R-SEC-01).
- **[P]** **Calendar exports: iCal (`.ics`) and Google Calendar** **[U]**. To discuss first, because both meet existing decisions:
  - **Dates:** calendars need real dates, and the app holds none but today's week, remembered per browser (R-GRID-01, R-CYC-01/05). The export could start from the anchor this browser keeps for Live View (the Monday of a week 1, R-CYC-05), and ask for one when it is not known. Events would become weekly recurring events (`RRULE:FREQ=WEEKLY`, `INTERVAL=n` for the weeks of a cycle).
  - **Google Calendar:** the app makes no network calls and opens no windows (R-SEC-04), so a direct push or an "add to Google" link is ruled out. Google Calendar imports `.ics` files, so one `.ics` export can cover both.
  - **Privacy:** an `.ics` would be a third downloadable `Blob`, after the JSON export and the statistics CSV (R-SEC-04), and an unencrypted one (like R-SHARE-07). It needs the same warning and could offer *Leave out personal details* (R-SHARE-02).
  - **Mapping, to decide:** what each kind of event becomes (flexible times, margins, on call, In the background, Away, nested activities), and whose calendar it is (one person's activities, or everything shown).
