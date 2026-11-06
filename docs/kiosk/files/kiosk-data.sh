#!/bin/bash
# Fetches your encrypted workspace file from a private GitHub repository and turns
# it into the address the kiosk opens (step 10 of docs/kiosk/README.md).
#
# The address is <planner>#data=e1.<the file's data>&pw=<the kiosk password>.
# Everything after # stays in the browser: it is never sent to any server.
#
# Exit status: 0 = a new address, 3 = nothing changed, 1 = failed (the last
# address is kept, so the kiosk still shows the last copy when offline).
set -u
DIR="$HOME/kiosk"
CONF="$DIR/kiosk-data.conf"
PWFILE="$DIR/data-password"
CLONE="$DIR/data-repo"
OUT="$DIR/start-url"
KEY="$HOME/.ssh/kiosk_data"
LOG="$DIR/kiosk-data.log"
MAX=120000   # Linux allows one command-line argument of at most 128 KiB

log()  { echo "$(date '+%F %T') $*" >> "$LOG"; }
fail() { log "FAILED: $*"; echo "kiosk-data: $*" >&2; exit 1; }

exec 9> "$DIR/.kiosk-data.lock"
flock -w 90 9 || fail "another fetch is still running"   # start.sh and the timer may overlap
[ -f "$CONF" ]   || fail "no settings file $CONF"
. "$CONF"
[ -s "$PWFILE" ] || fail "no kiosk password in $PWFILE"
[ -f "$KEY" ]    || fail "no deploy key $KEY"

export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
if [ -d "$CLONE/.git" ] && [ "$(git -C "$CLONE" remote get-url origin 2>/dev/null)" = "$REPO" ]; then
  { git -C "$CLONE" fetch -q --depth 1 origin "$BRANCH" && git -C "$CLONE" reset -q --hard FETCH_HEAD; } \
    || fail "could not fetch $REPO (offline?); keeping the last copy"
else
  rm -rf "$CLONE"
  git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$CLONE" || fail "could not clone $REPO"
fi
[ -f "$CLONE/$FILE" ] || fail "$FILE is not in the repository"

NEW=$(python3 - "$CLONE/$FILE" "$PWFILE" "$APP" "${LAYOUT:-}" <<'PY'
import json, sys, urllib.parse
path, pwfile, app, layout = sys.argv[1:5]
with open(path, encoding="utf-8") as f:
    j = json.load(f)
if j.get("format") != "weekly-schedules-encrypted" or not isinstance(j.get("data"), str):
    sys.exit("not an encrypted file saved from the planner (Save... -> JSON file, Encrypted)")
with open(pwfile, encoding="utf-8") as f:
    pw = f.read().strip()
url = app.split("#")[0] + "#data=e1." + j["data"] + "&pw=" + urllib.parse.quote(pw, safe="")
if layout in ("phone", "desk"):
    url += "&layout=" + layout
print(url)
PY
) || fail "$FILE could not be read"
[ "${#NEW}" -le "$MAX" ] || fail "$FILE is too big for the kiosk address (${#NEW} characters, at most $MAX)"

if [ -f "$OUT" ] && [ "$(cat "$OUT")" = "$NEW" ]; then
  exit 3
fi
umask 077
printf '%s' "$NEW" > "$OUT.tmp" && mv "$OUT.tmp" "$OUT" || fail "could not write $OUT"
touch "$OUT.changed"   # tells the timer's service to restart the kiosk
log "new version from commit $(git -C "$CLONE" rev-parse --short HEAD)"
exit 0
