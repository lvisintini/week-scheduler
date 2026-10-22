# Parked and open items

## Next steps (update as you go)
1. Run `tests/manual/touch.md` on an iPhone (Safari) and record the result here (Android Chrome passed steps 1–25 before step 19 changed to touch Copy, R-TOUCH-02; steps 19, 26 and 34 are not tried on a real phone yet; opened from GitHub Pages, since opening from disk is no longer supported).
2. The parked items below.

## Parked
- **[P]** Real-device testing of the touch gestures on **iOS Safari** (`tests/manual/touch.md`; Android Chrome passed the steps before step 19 changed).
- **[P]** ES modules for the code in `js/` (real `import`/`export` boundaries), once the mutable state (`S`, `WS`, `prefs`, `curWk`, `focusD`, `live`…) is gathered into one object and the test bridge (`a.ev`) reaches it there; today the files are classic scripts sharing one global scope (`docs/architecture.md`).
- **[P]** **Calendar exports: iCal (`.ics`) and Google Calendar** **[U]**. To discuss first, because both meet existing decisions:
  - **Dates:** calendars need real dates, and the app holds none but today's week, remembered per browser (R-GRID-01, R-CYC-01/05). The export could start from the anchor this browser keeps for Live View (the Monday of a week 1, R-CYC-05), and ask for one when it is not known. Events would become weekly recurring events (`RRULE:FREQ=WEEKLY`, `INTERVAL=n` for the weeks of a cycle).
  - **Google Calendar:** the app makes no network calls and opens no windows (R-SEC-04), so a direct push or an "add to Google" link is ruled out. Google Calendar imports `.ics` files, so one `.ics` export can cover both.
  - **Privacy:** an `.ics` would be a third downloadable `Blob`, after the JSON export and the statistics CSV (R-SEC-04), and an unencrypted one (like R-SHARE-07). It needs the same warning and could offer *Leave out personal details* (R-SHARE-02).
  - **Mapping, to decide:** what each kind of event becomes (flexible times, margins, on call, In the background, Away, nested activities), and whose calendar it is (one person's activities, or everything shown).
