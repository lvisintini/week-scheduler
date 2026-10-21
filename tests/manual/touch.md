# Touch checklist for real phones

The automated touch tests (`tests/e2e/touch.spec.js`) run in Chromium's phone emulation only. This list is for a real
**Android phone (Chrome)** and a real **iPhone (Safari)**. Tick each step, or write what happened instead.

## Before you start
1. Open https://lvisintini.github.io/week-scheduler/ on the phone. GitHub Pages serves the `main` branch, so push first if you want to test the latest commits.
2. If the app shows data you care about, use **Save… → JSON file** first, or open it in a private tab.
3. Make some test data: tap **+** and save an event *Work* Mon 09:00–17:00. Then tap **+** again and save *Gym*, ticking Monday, Tuesday and Wednesday, 18:00–19:00 (a repeating event).

## Steps
| # | Do this | Expected | Android | iPhone |
|---|---|---|---|---|
| 1 | Swipe up and down on the grid; tap **Week**, then swipe sideways too | The grid scrolls. The day headers and the time column stay in place. Nothing is created or moved (in the day view a sideways swipe changes the day instead, step 21) | | |
| 2 | Tap *Work* | Its dialog opens (R-TOUCH-01) | | |
| 3 | Tap *Gym* on Tuesday | The dialog opens, and Tuesday's line in the day table pulses once (R-UI-12) | | |
| 4 | Press and hold an empty spot for about half a second, then drag down | A short vibration (Android only). A new event follows your finger, and the dialog opens when you let go | | |
| 5 | Press and hold *Work*, then drag it down an hour **in several small moves** | The box keeps following your finger the whole way, not just the first step (bug 3 in docs/known-issues.md). The page does not scroll | | |
| 6 | Press and hold *Gym*'s bottom edge, then drag down | All three repetitions get longer. A toast offers *Only this day* and *Undo* (R-REP-06) | | |
| 7 | Tap *Undo* in the toast | Gym is back to 18:00–19:00 | | |
| 8 | Make two events overlap (drag one onto the other), then tap the overlap | A small list asks which event you mean (R-SEL-01) | | |
| 9 | Press and hold on the overlap and drag | A list asks which one to move, and nothing moves yet. Pick one: it gets an outline, and the next long-press drag moves it (R-SEL-02) | | |
| 10 | Tap a day name in the header | The day's agenda opens | | |
| 11 | In the week, tap a short day name (*Mo*, *Tu*…) | Only that day is shown, filling the width. ◀ ▶ step through the days, and **Week** brings the week back (R-GRID-11) | | |
| 12 | Open an event, then drag the dialog by the dotted bar at its top | The dialog moves, and the grid behind it stays dimmed. Reopening puts it back in the middle (R-UI-10) | | |
| 13 | In the People section, drag a person by the six dots at the start of the row | The person moves in the list (R-PPL-02) | | |
| 14 | Open the sidebar's **Tools** section and tap **Live View** | Today's day is shown read-only, with the now line a third of the way down (R-GRID-12) | | |
| 15 | In Live View, tap a box | A bubble appears at your tap, and it fades out after a minute. Tapping empty space closes it | | |
| 16 | In Live View, swipe to scroll, then wait a minute | **Now** appears while you scroll. A minute after your last swipe, the view returns to the now line by itself | | |
| 17 | Tap the red **Live View Mode** pill | Back to the day view of the day Live View showed, not the week (R-GRID-12) | | |
| 18 | Rotate the phone | The grid refits, and nothing is lost | | |
| 19 | Long-press an event the way you would right-click it | No browser menu appears; the long press starts a move as in step 5. Copy is only in the event dialog's **Copy…** button (R-TOUCH-01, known) | | |
| 20 | Reload the page | It opens on **today's day view** with the sidebar closed, even if you left it open (R-UI-13) | | |
| 21 | In the day view, swipe left, then right | The next day, then back. A swipe from the very edge of the screen is left to the browser | | |
| 22 | Tap **Week**, then tap a short day name (*Mo*, *Tu*…) | That day's view opens (R-GRID-06) | | |
| 23 | Tap **›** on the rail, scroll the sidebar to the bottom, then tap beside it | The top row with › stays visible while scrolling; the tap beside the sidebar closes it (R-UI-01, R-UI-13) | | |
| 24 | Tap the camera on the rail | Live View starts. Tap one box several times: still one bubble, which follows your tap (R-GRID-12) | | |
| 25 | Open **Tools** and **Zoom** in the sidebar and flip their switches | Sliding toggles that react to a tap on the switch or its label | | |
| 26 | In a workspace with a cycle of 2 weeks (workspace menu → *Weeks in the cycle…*), tap the **W1** button in the grid's top-left corner and choose *Week 2*; then, in the day view on Sunday, swipe left | The menu opens beside the button and the grid shows week 2; the swipe shows *Monday · W1* (the cycle wraps) | | |
| 27 | Tap an event; tap **When**, scroll the days, then tap **More**; clear the title and tap **Save** | The dialog fills the screen with no grip bar; the tabs and the Delete/Copy/Cancel/Save row stay put while the days scroll; Save without a title goes back to **Event** with a red dot on it (R-UI-14) | | |
| 28 | Open Settings (gear), then a day's agenda (day name) | Both fill the screen with Close always visible (R-UI-14) | | |
| 29 | Open the app with a fresh browser profile (or tap *Reset zoom*) and look at the day view | About 7 hours fill the screen (100 px per hour, *Fit height* off); a one-hour event is easy to tap open (R-GRID-07) | | |
| 30 | Close the sidebar, then open it with **›** | Closed: only three round buttons float at the bottom-left (? · camera · ›) and the day fills the width. Open: the title on one line, then ? · ⚙ · camera · ‹ (R-UI-13) | | |
| 31 | Tap **Week**, then the focus button of a day | The week is wider than the screen and scrolls sideways; the day fills the width again (R-GRID-07) | | |
| 32 | Open an event, tap **When**, tap a day chip | That day appears as a card with labelled fields; unticked days take no room (R-UI-07) | | |

## Report back
Note the phone, the OS version and the browser version. Copy the rows that did not do what the *Expected* column says
into the conversation, or into an issue. docs/parked.md and docs/known-issues.md are updated with the result.
