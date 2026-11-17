#!/bin/bash
# Merges the changes to the kiosk templates (docs/kiosk/files/ in week-scheduler) since the
# private repository was last synced into your copies there (kiosk/files/), with a 3-way merge:
# base = the templates at kiosk/sync.json's templateCommit, theirs = the templates at HEAD.
#
#   merge.sh <week-scheduler folder> <private repository folder>
#
# One line per file: unchanged | merged | conflict <n> | added-upstream | removed-upstream |
# you-removed | skipped. Conflicts are left in the file with <<<<<<< markers. Last line:
# "HEAD <sha>", the commit to write into sync.json once everything is resolved. It never commits.
set -u
WS="${1:?week-scheduler folder}"; PRIV="${2:?private repository folder}"
T=docs/kiosk/files
SYNC="$PRIV/kiosk/sync.json"
[ -f "$SYNC" ] || { echo "merge.sh: no $SYNC (run the setup first)" >&2; exit 1; }
BASE=$(python3 -I -c 'import json,sys;print(json.load(open(sys.argv[1]))["templateCommit"])' "$SYNC") || exit 1
SKIP=$(python3 -I -c 'import json,sys;print("\n".join(json.load(open(sys.argv[1])).get("skip",[])))' "$SYNC") || exit 1
HEAD=$(git -C "$WS" rev-parse HEAD) || exit 1
git -C "$WS" cat-file -e "$BASE^{commit}" 2>/dev/null || { echo "merge.sh: $BASE is not a commit of $WS (pull it first)" >&2; exit 1; }
[ -z "$(git -C "$WS" status --porcelain -- "$T")" ] || echo "warning: $T has uncommitted changes; merging the committed templates at HEAD"

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
names=$( { git -C "$WS" ls-tree -r --name-only "$BASE" "$T/"; git -C "$WS" ls-tree -r --name-only HEAD "$T/"; } | sed "s|^$T/||" | sort -u)
for f in $names; do
  if printf '%s\n' "$SKIP" | grep -qxF "$f"; then echo "skipped $f"; continue; fi
  ours="$PRIV/kiosk/files/$f"
  hasb=0; git -C "$WS" show "$BASE:$T/$f" > "$TMP/base" 2>/dev/null && hasb=1
  hasn=0; git -C "$WS" show "HEAD:$T/$f"  > "$TMP/new"  2>/dev/null && hasn=1
  if [ $hasb = 0 ]; then
    if [ -f "$ours" ]; then echo "unchanged $f"; else echo "added-upstream $f"; fi; continue
  fi
  if [ $hasn = 0 ]; then echo "removed-upstream $f"; continue; fi
  if cmp -s "$TMP/base" "$TMP/new"; then echo "unchanged $f"; continue; fi
  if [ ! -f "$ours" ]; then echo "you-removed $f"; continue; fi
  git merge-file -L yours -L "template ${BASE:0:7}" -L "template ${HEAD:0:7}" "$ours" "$TMP/base" "$TMP/new"
  n=$?
  if [ $n = 0 ]; then echo "merged $f"; elif [ $n -gt 0 ] && [ $n -lt 128 ]; then echo "conflict $n $f"; else echo "error $f"; fi
done
echo "HEAD $HEAD"
