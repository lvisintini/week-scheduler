# Requirements

The specification of the app, one file per area. Each file is the **flattened, current description of what the app must do and why** — not a changelog. Edit entries in place when something changes; never append "revision" notes.

**Tags used**
- **[U]** asked for by the user.
- **[C✓]** proposed by Claude and accepted by the user (explicitly, or by not objecting). These are decisions, not accidents — don't undo them silently.
- **[P]** parked / open (see §12).
- **R-AREA-nn** requirement ID. Every ID below must appear in the title of at least one automated test, and every ID a test mentions must exist here (`tests/requirements.test.js` enforces both). Add the ID to the bullet when you add a requirement; never reuse a retired number.

**How the user likes to work** (summarised in `CLAUDE.md`):

**How the user likes to work:** discuss design first for large or ambiguous features ("let's discuss this first"), get suggestions with trade-offs and a recommendation, then say "do it". Every user-facing string must exist in English and Spanish. Tooltips should explain workarounds (e.g. emulating a two-week rota). The user reviews this file and expects it to capture *every* requirement and accepted decision — when finishing a task, re-read the conversation's decisions and update the matching entry here.
