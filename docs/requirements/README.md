# Requirements

The specification of the app, one file per area. Each file is the **flattened, current description of what the app must do and why**, not a changelog: edit entries in place when something changes, never append "revision" notes or history. The rules for working with these files are summarised in `CLAUDE.md`.

## Tags
- **[U]** asked for by the user.
- **[C✓]** proposed by Claude and accepted by the user (explicitly, or by not objecting). These are decisions, not accidents: don't undo them silently.
- **[P]** parked / open (see `../parked.md`).
- **R-AREA-nn** requirement ID, written in bold at the start of its bullet. Every ID must appear in the title of at least one automated test, every ID a test mentions must be defined here, and each ID is defined exactly once (`tests/requirements.test.js` enforces all three). Add the ID to the bullet when you add a requirement (the next free number of its area); never reuse a retired number.
- A **Rejected:** clause names alternatives that were tried or proposed and turned down, so they are not proposed again.

## How the user likes to work
Discuss design first for large or ambiguous features ("let's discuss this first"), get suggestions with trade-offs and a recommendation, then say "do it". Every user-facing string must exist in English and Spanish. Tooltips should explain workarounds (e.g. keeping a rota as an owner plus involved people, R-CYC-15). The user reviews these files and expects them to capture *every* requirement and accepted decision: when finishing a task, re-read the conversation's decisions and update the matching entry in the file for that area.

## Files
| File | IDs |
|---|---|
| `product.md` | what the app is (no IDs) |
| `grid.md` | R-GRID-01…11 |
| `live-view.md` | R-GRID-12 |
| `events.md` | R-EVT-01…08, 11, 12, 15, 16, 17, 19, 20, 21, 22, 24 |
| `lanes.md` | R-EVT-09, 10, 13, 18, 23 |
| `repetitions.md` | R-REP-01…07 |
| `nesting.md` | R-NST-01…05 |
| `interaction.md` | R-SEL-01…03, R-TOUCH-01…02 |
| `cycle.md` | R-CYC-01…20 |
| `schedules.md` | R-SCH-01…05 |
| `people.md` | R-PPL-01…04 |
| `types.md` | R-TYP-01…05 |
| `stats.md` | R-STAT-01…07 |
| `phases.md` | R-PHS-01…10 |
| `ui.md` | R-UI-01…13 |
| `data.md` | R-DATA-01…09, the workspace data shape |
| `sharing.md` | R-SHARE-01…08 |
| `security.md` | R-SEC-01…05 |
| `printing-i18n.md` | R-PRN-01…04, R-I18N-01…02 |

The prefix of an ID is where the requirement was first filed, not necessarily the file it lives in now (e.g. R-EVT-13 is in `lanes.md`); IDs are never renumbered.

## Retired IDs (never reuse)
- R-EVT-14: option A for the legibility of overlapping labels (every box its own layer, stripes inside the topmost box, labels on solid chips), rejected by the user, as was option B (later clashing boxes indented); the legibility of overlapping labels was then dropped from the backlog **[U]**.
