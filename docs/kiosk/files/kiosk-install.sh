#!/bin/bash
# Installs the kiosk files from your private repository (docs/kiosk/README.md -> Optional extras ->
# Keep your own copies in the private repository). Run it on the Pi as the kiosk user:
#
#   ~/kiosk/data-repo/kiosk/files/kiosk-install.sh [--dry-run] [--yes] [--root DIR]
#
# It fetches the newest copy first, shows what changed, copies only the files that changed
# into place and restarts only what needs it. It never touches the kiosk password or the key.
#   --dry-run   show what would change, change nothing
#   --yes       don't ask before installing
#   --root DIR  install under DIR instead of / (for trying it out; no sudo, nothing restarted)
set -u

main() {
  local SRC DRY=0 YES=0 ROOT="" FETCHED=0 ARGS=("$@")
  SRC="$(cd "$(dirname "$0")" && pwd)"
  while [ $# -gt 0 ]; do
    case "$1" in
      --dry-run) DRY=1 ;;
      --yes|-y)  YES=1 ;;
      --root)    ROOT="${2:?--root needs a folder}"; shift ;;
      --fetched) FETCHED=1 ;;
      -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
      *) echo "kiosk-install: unknown option $1 (try --help)" >&2; exit 2 ;;
    esac
    shift
  done

  # With the read-only overlay on, everything installed now would be gone at the next reboot.
  if [ "$(findmnt -no FSTYPE / 2>/dev/null)" = "overlay" ]; then
    if [ "$DRY" = 1 ]; then
      echo "Note: the read-only overlay is on, so a real install would be refused."
    else
      echo "kiosk-install: the read-only overlay is on, so nothing would stick. Turn it off" >&2
      echo "(sudo raspi-config -> Performance Options -> Overlay File System), reboot, run this again." >&2
      exit 1
    fi
  fi

  # Fetch the newest copy of the repository with the kiosk's own script, then run the fresh
  # copy of this installer (it may have changed too). The first time, before kiosk-data.sh
  # is installed, the clone you just made is used as it is.
  if [ "$FETCHED" = 0 ] && [ -z "$ROOT" ] && [ -x "$HOME/kiosk/kiosk-data.sh" ] && [ -f "$HOME/kiosk/kiosk-data.conf" ]; then
    "$HOME/kiosk/kiosk-data.sh"
    case $? in
      0|3) ;;
      *) echo "Could not fetch the newest copy (see above); installing from the copy already on the Pi." ;;
    esac
    exec bash "$SRC/$(basename "$0")" "${ARGS[@]}" --fetched
  fi

  local H="$ROOT$HOME" E="$ROOT"
  local SUDO="sudo"; [ -n "$ROOT" ] && SUDO=""
  # file in the repository | where it goes | mode | owner (root or you)
  local TABLE="
kiosk.json|$E/etc/chromium/policies/managed/kiosk.json|644|root
start.sh|$H/kiosk/start.sh|755|you
kiosk.desktop|$H/.config/autostart/kiosk.desktop|644|you
99-kiosk-no-pointer.rules|$E/etc/udev/rules.d/99-kiosk-no-pointer.rules|644|root
screen-dimmer.py|$E/usr/local/bin/screen-dimmer.py|755|root
screen-dimmer.service|$E/etc/systemd/system/screen-dimmer.service|644|root
kiosk-data.sh|$H/kiosk/kiosk-data.sh|755|you
kiosk-data.conf|$H/kiosk/kiosk-data.conf|644|you
kiosk-data@.service|$E/etc/systemd/system/kiosk-data@.service|644|root
kiosk-data@.timer|$E/etc/systemd/system/kiosk-data@.timer|644|root"

  local TMP; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  local CHANGED=() name dest mode owner new
  while IFS='|' read -r name dest mode owner; do
    [ -n "$name" ] || continue
    [ -f "$SRC/$name" ] || continue            # not in your repository (e.g. no motion sensor): left alone
    new="$SRC/$name"
    if [ "$name" = "kiosk.desktop" ]; then     # your home folder in place of @HOME@, as step 7 does
      sed "s|@HOME@|$HOME|" "$new" > "$TMP/$name"; new="$TMP/$name"
    fi
    if grep -qE 'YOUR-NAME|YOUR-PRIVATE-REPO|example\.com/recipe-' "$new"; then
      echo "Skipped $name: it still holds the template's examples. Fill in your own settings first."
      continue
    fi
    if [ -f "$dest" ] && cmp -s "$new" "$dest"; then
      continue
    fi
    echo
    if [ -f "$dest" ]; then
      echo "=== $name -> $dest (changed)"
      diff -u "$dest" "$new" | tail -n +3
    else
      echo "=== $name -> $dest (new)"
    fi
    CHANGED+=("$name|$dest|$mode|$owner|$new")
  done <<< "$TABLE"

  echo
  if [ ${#CHANGED[@]} = 0 ]; then
    echo "Everything is up to date."
    exit 0
  fi
  echo "${#CHANGED[@]} file(s) to install."
  if [ "$DRY" = 1 ]; then
    echo "Dry run: nothing changed."
    exit 0
  fi
  if [ "$YES" = 0 ]; then
    if [ ! -t 0 ]; then
      echo "kiosk-install: not asking without a terminal; run it again with --yes" >&2
      exit 1
    fi
    read -rp "Install them? [y/N] " a
    case "$a" in y|Y|yes|Yes) ;; *) echo "Nothing changed."; exit 0 ;; esac
  fi

  local units=0 dimmer=0 timer=0 udev=0 chromium=0 data=0 reboot=0 entry
  for entry in "${CHANGED[@]}"; do
    IFS='|' read -r name dest mode owner new <<< "$entry"
    if [ "$owner" = "root" ]; then
      $SUDO install -D -m "$mode" "$new" "$dest" || { echo "kiosk-install: could not install $dest" >&2; exit 1; }
    else
      install -D -m "$mode" "$new" "$dest" || { echo "kiosk-install: could not install $dest" >&2; exit 1; }
    fi
    echo "Installed $dest"
    case "$name" in
      kiosk.json) chromium=1 ;;
      start.sh|kiosk.desktop) reboot=1 ;;
      99-kiosk-no-pointer.rules) udev=1 ;;
      screen-dimmer.py) dimmer=1 ;;
      screen-dimmer.service) units=1; dimmer=1 ;;
      kiosk-data.sh|kiosk-data.conf) data=1 ;;
      kiosk-data@.service|kiosk-data@.timer) units=1; timer=1 ;;
    esac
  done

  if [ -n "$ROOT" ]; then
    echo "Installed under $ROOT: nothing restarted."
    exit 0
  fi
  [ "$units" = 1 ] && sudo systemctl daemon-reload
  if [ "$dimmer" = 1 ] && [ -f /etc/systemd/system/screen-dimmer.service ]; then
    sudo systemctl enable screen-dimmer -q && sudo systemctl restart screen-dimmer && echo "Restarted the screen dimmer."
  fi
  if [ "$timer" = 1 ] && [ -f "/etc/systemd/system/kiosk-data@.timer" ]; then
    sudo systemctl enable --now "kiosk-data@$USER.timer" -q && echo "The workspace check timer is on."
  fi
  if [ "$udev" = 1 ]; then
    sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=input
  fi
  if [ "$data" = 1 ] && [ -x "$HOME/kiosk/kiosk-data.sh" ]; then
    "$HOME/kiosk/kiosk-data.sh" > /dev/null 2>&1   # a new address if the settings changed it
    rm -f "$HOME/kiosk/start-url.changed"
    chromium=1
  fi
  if [ "$reboot" = 1 ]; then
    echo "start.sh or kiosk.desktop changed: reboot to use them (sudo reboot)."
  elif [ "$chromium" = 1 ]; then
    pkill -u "$USER" -f /usr/lib/chromium/chromium && echo "Restarted Chromium."
  fi
  exit 0
}

main "$@"   # all in one function, so the script is read whole before the fetch can replace it
