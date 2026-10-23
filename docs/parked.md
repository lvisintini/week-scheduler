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
- **[P]** **Towards TypeScript or React**: **left to a future maintainer [U]**. The app is not expected to be maintained by engineers soon, so no further tooling or framework choices are made now; whoever takes it on should follow the best practice of their time. The app itself uses only standard, long-lived web features (HTML, CSS, ES modules, Web Crypto, CompressionStream) and no runtime libraries; only the dev tools (`package.json`) will age. The path discussed when the code became ES modules (R-CODE-01), in this order: (1) **types without a build**: JSDoc types on `state` and on what `parseData` returns (the data format), `// @ts-check` per file and `tsc --noEmit` (TypeScript as a dev dependency only) in `npm run lint`, so the app stays static files; (2) **pure logic apart from the DOM**: `piecesOf`, `laneLayout`, `overlapSet`, `parseData`, `icsText`, `personStats`… in files that never touch `document`, which carry over unchanged, while the DOM code is what React would replace; (3) React/JSX needs a build step, which the rule *static files, no build* excludes today: a separate decision. For people reading the code, the terse one-line style and short names (`S`, `selK`, `cw()`) cost more than modules did; a readability pass could come after (1).
