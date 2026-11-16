#!/bin/bash
# Started by the desktop at login (~/.config/autostart/kiosk.desktop, step 7 of
# docs/kiosk/README.md). Runs Chromium maximised, so the desktop's panel and its
# on-screen keyboard button stay in reach, and starts it again whenever it closes:
# after a crash, after someone closes it, and when step 10 has a new workspace.

PROFILE="$HOME/kiosk/profile"
PREFS="$PROFILE/Default/Preferences"
URLFILE="$HOME/kiosk/start-url"
LOG="$HOME/kiosk/kiosk.log"

# Only one copy (the desktop may run the autostart entry again after a crash).
exec 8> "$HOME/kiosk/.start.lock"
flock -n 8 || exit 0

# Your workspace from a private GitHub repository (step 10): fetch the newest copy,
# or keep the last one when offline. The address is kept in ~/kiosk/start-url.
if [ -x "$HOME/kiosk/kiosk-data.sh" ]; then
  timeout 60 "$HOME/kiosk/kiosk-data.sh" > /dev/null 2>&1
  rm -f "$URLFILE.changed"   # starting now anyway: no restart needed
fi

FLAGS=(
  --user-data-dir="$PROFILE"
  --ozone-platform=wayland
  --start-maximized
  --noerrdialogs
  --disable-infobars
  --no-first-run
  --disable-session-crashed-bubble
  --password-store=basic
  --top-chrome-touch-ui=enabled
  --touch-events=enabled
  --disable-pinch
  --overscroll-history-navigation=0
  --disable-features=Translate
)

while true; do
  # After a power cut or a restart, stop Chromium thinking it crashed (no "Restore pages?" bar).
  if [ -f "$PREFS" ]; then
    sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS"
  fi
  START=()   # start page comes from the Chromium settings file (step 5)
  if [ -s "$URLFILE" ]; then
    START=("$(cat "$URLFILE")")   # your workspace from the private repository (step 10)
  fi
  echo "$(date '+%F %T') starting Chromium" >> "$LOG"
  /usr/lib/chromium/chromium "${FLAGS[@]}" "${START[@]}" >> "$LOG" 2>&1
  sleep 2   # a pause, so a Chromium that fails at once doesn't spin
done
