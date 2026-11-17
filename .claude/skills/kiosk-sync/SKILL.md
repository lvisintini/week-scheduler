---
name: kiosk-sync
description: Sets up and updates the private GitHub repository a Raspberry Pi kiosk (docs/kiosk/README.md) installs from — your own copies of the kiosk files, merged with the templates in docs/kiosk/files/, plus the encrypted workspace file the kiosk shows. Run /kiosk-sync after the templates change or after saving a new workspace for the kiosk; /kiosk-sync setup changes the settings.
argument-hint: "[setup] [workspace-file]"
disable-model-invocation: true
---

# /kiosk-sync

Keeps the user's **private kiosk repository** up to date. The templates in `docs/kiosk/files/` (this repository, week-scheduler) are public and hold placeholders; the private repository holds the user's finished copies and the encrypted workspace, and the Pi installs from its clone of it (`~/kiosk/data-repo`, kept fresh by `kiosk-data.sh`). The guide's section is *Optional extras → Keep your own copies in the private repository*.

`WS` below = the week-scheduler folder (`git rev-parse --show-toplevel` from this skill's folder); `SKILL` = this skill's folder (`$WS/.claude/skills/kiosk-sync`); `PRIV` = the private repository's folder.

## Never
- **Never ask for, read, store or print the kiosk password.** It exists only on the Pi (`~/kiosk/data-password`, step 10.4 of the guide). If the user offers it, say it isn't needed and don't repeat it.
- Never commit passwords, SSH keys or an **unencrypted** workspace (`payload.py` refuses those). Never print the workspace file's contents (no `cat`, no reading it with Read): only `payload.py`'s line.
- Never push without the user's yes. Never commit in week-scheduler. Never connect to the Pi.

## Private repository layout
```
<FILE>                 the encrypted workspace (FILE in kiosk-data.conf, default weekly-schedules.json)
kiosk/files/           the user's copies, same names as docs/kiosk/files/; their settings live in them
kiosk/sync.json        {"templateCommit": "<week-scheduler sha>", "skip": [files left out on purpose]}
kiosk/README.md        how to install on the Pi (written by the setup)
```

## Which flow
- `~/.config/kiosk-sync/config.json` missing, or the argument `setup` → **Setup**, then continue with **Update**.
- Otherwise → **Update**. An argument that is a file path is the workspace file for step U4.

## Setup
Ask with AskUserQuestion, one topic per question; for each setting show the current value (read from `PRIV/kiosk/files/` when it exists, else the template's) and offer "keep". Free-text answers come through "Other".

1. **Private repository.** A local folder, or a GitHub address to clone (into a folder the user names). It must be a git repository with an `origin` on GitHub. Check it is **private**: `gh repo view <owner/repo> --json visibility -q .visibility` when `gh` works; otherwise ask the user to confirm. A public repository → stop: the bookmarks and settings would be public, and the encrypted workspace open to offline guessing.
2. **Downloads folder** where the planner saves files (on WSL usually `/mnt/c/Users/<windows user>/Downloads`; check it exists).
   Save both to `~/.config/kiosk-sync/config.json` (`{"repo": "...", "downloads": "..."}`, `umask 077`).
3. **First time only** (no `PRIV/kiosk/sync.json`): copy every template at HEAD into `PRIV/kiosk/files/` (`git -C WS show HEAD:docs/kiosk/files/<f>`), `chmod 755` the `.sh` and `.py` files, and write `sync.json` with `templateCommit` = `git -C WS rev-parse HEAD` and `"skip": []`. If `docs/kiosk/files/` has uncommitted changes, say that the committed templates are used.
4. **Workspace** (`kiosk-data.conf`): `REPO` (suggest the SSH form `git@github.com:<owner>/<repo>.git` of `origin`; it must match exactly what the Pi clones), `BRANCH` (default the repository's branch), `FILE` (default `weekly-schedules.json`), `LAYOUT` (`phone` recommended on the 720×1280 screen / `desk` / `""`), `APP` (default the public planner).
5. **Bookmarks** (`kiosk.json` → `ManagedBookmarks`): the folder's name on the bookmarks bar (default *Recipes*), then the bookmarks (name + address) and any sub-folders (`{"name": "...", "children": [...]}`). Chromium shows every managed bookmark inside that one folder, so "more bookmarks" means more entries or sub-folders (e.g. call the folder *Bookmarks* with *Recipes* inside). Also set `HomepageLocation` and `RestoreOnStartupURLs` to `APP`.
6. **Motion sensor** (step 9): is there one? If not, add `screen-dimmer.py` and `screen-dimmer.service` to `skip` and delete them from `kiosk/files/` (the installer leaves out what isn't there). If yes: `DIM_AFTER`, `OFF_AFTER` (0 = never off), `DIM_PERCENT`, `BRIGHT_PERCENT`, `PIR_GPIO`.
7. **Check interval** (`kiosk-data@.timer`, `OnUnitActiveSec`, default `15min`).

**How to write settings:** change only the lines that hold them and keep everything else byte for byte (indentation, comments, line order), so later template merges stay clean: the `KEY="value"` lines of `kiosk-data.conf`; the `NAME = value` lines between the `# ---- Settings` markers of `screen-dimmer.py`; the `OnUnitActiveSec=` line of the timer; in `kiosk.json` only the lines from `"ManagedBookmarks": [` to its closing `],` (one entry per line, as in the template) and the two planner addresses.

8. Write `PRIV/kiosk/README.md` (English, short): what the folder is, that it is managed by `/kiosk-sync` in week-scheduler, and the Pi commands from *Pi commands* below.

## Update
**U1. Start.** Read `~/.config/kiosk-sync/config.json`. In `PRIV`: the working tree must be clean (otherwise show `git status --short` and stop), then `git pull --ff-only`.

**U2. Templates.** `bash SKILL/merge.sh WS PRIV`. One line per file:
- `unchanged` / `skipped`: nothing to do.
- `merged`: the template's changes are in the user's copy; show the user `git -C PRIV diff -- kiosk/files/<f>` briefly.
- `conflict <n>`: `<<<<<<< yours … ======= … >>>>>>> template` markers are in the file. Read the template change (`git -C WS log --oneline <templateCommit>..HEAD -- docs/kiosk/files/<f>` and its diff) and resolve: keep the user's settings and own additions (e.g. an extra Chromium flag), take the template's structure. If the intent is unclear, ask. No markers may remain.
- `added-upstream`: a new template file. Ask; copy it in (`chmod 755` if a script) or add it to `skip`. A new file with placeholders gets the setup questions it needs.
- `removed-upstream`: ask; usually delete the copy (the installer then leaves the Pi's installed copy alone: say so, and how to remove it there).
- `you-removed`: the user deleted a file that is not in `skip`; ask whether to add it to `skip` or restore it.
- `error`: stop and show it.
Then set `templateCommit` in `sync.json` to the `HEAD <sha>` the script printed.

**U3. Placeholders.** If a file in `kiosk/files/` still holds `YOUR-NAME`, `YOUR-PRIVATE-REPO` or `example.com/recipe-`, run the matching setup question (the installer skips such files).

**U4. Workspace file** (when the user gave one, or wants the latest): else take the newest `weekly-schedules-*-encrypted.json` in the Downloads folder and confirm it with the user (name and date). Run `python3 -I SKILL/payload.py <file> <APP>`. Exit 1 → show its line and don't use the file. Exit 0 → `cp` it to `PRIV/<FILE>`. Remind the user: the skill can't check the password; a file saved with another password shows *This kiosk's password does not open…* on the kiosk, which keeps its last copy.

**U5. Validate** in `PRIV/kiosk/files/` (only for the files present):
`python3 -m json.tool kiosk.json >/dev/null`, `bash -n` on each `.sh`, `python3 -I -m py_compile screen-dimmer.py` (then delete `__pycache__`), and `grep -rn '<<<<<<<\|>>>>>>>'` finds nothing.

**U6. Commit** in `PRIV` (`git add -A`). Message: what changed, e.g. `Kiosk files from week-scheduler 7ba97c8 (merged start.sh, kiosk-data.sh); workspace saved 2026-11-17`. Nothing changed → say so and stop.

**U7. Push.** Show a summary (files changed, template commit, workspace size line) and ask with AskUserQuestion: *Push* / *Not now*. On yes, `git push`.

**U8. Tell the user** what the Pi will do:
- Only the workspace changed: nothing to run; the Pi picks it up at its next check (the timer's interval) or at once with `~/kiosk/kiosk-data.sh; pkill -f /usr/lib/chromium/chromium`.
- Any file in `kiosk/files/` changed: run the installer on the Pi (below). It needs the read-only overlay off.

## Pi commands
First time (after steps 1–4 of the guide, `sudo apt install -y git`, and the deploy key of 10.3; then the password of 10.4):
```bash
mkdir -p ~/kiosk
GIT_SSH_COMMAND="ssh -i ~/.ssh/kiosk_data -o IdentitiesOnly=yes" git clone --depth 1 --branch <BRANCH> <REPO> ~/kiosk/data-repo
bash ~/kiosk/data-repo/kiosk/files/kiosk-install.sh
sudo reboot
```
The rest of the guide still applies, minus its copy commands: the taps of step 8 and, with a motion sensor, `sudo apt install -y python3-gpiozero python3-evdev` (step 9.2).

After an update: `bash ~/kiosk/data-repo/kiosk/files/kiosk-install.sh` (it fetches first, shows each change and asks; `--dry-run` only shows).
