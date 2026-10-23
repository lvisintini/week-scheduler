# Parked and open items

## Next steps (update as you go)
1. Run `tests/manual/touch.md` on an iPhone (Safari) and record the result here (Android Chrome passed steps 1–25 before step 19 changed to touch Copy, R-TOUCH-02; steps 19, 26 and 34 are not tried on a real phone yet; opened from GitHub Pages, since opening from disk is no longer supported).
2. Try the calendar export (R-SHARE-09) in a real calendar and record the result in R-SHARE-09 and help 22: export a workspace with a 2-week cycle, an Until date and a reminder, import it into a **new Google calendar** (and into Apple Calendar or Outlook if available), and check:
   - the dates, a time past midnight and free/busy (Away and *Around these times* free, the rest busy);
   - **whether Google keeps the reminder** (not documented; Apple and Outlook are said to);
   - **what Google does when the same file is imported again** (skips the events or updates them; sources disagree).
3. The parked items below.

## Parked
- **[P]** Real-device testing of the touch gestures on **iOS Safari** (`tests/manual/touch.md`; Android Chrome passed the steps before step 19 changed).
- **[P]** ES modules for the code in `js/` (real `import`/`export` boundaries), once the mutable state (`S`, `WS`, `prefs`, `curWk`, `focusD`, `live`…) is gathered into one object and the test bridge (`a.ev`) reaches it there; today the files are classic scripts sharing one global scope (`docs/architecture.md`).
