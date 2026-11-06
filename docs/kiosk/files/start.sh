#!/bin/bash
# Launched by cage. Starts Chromium full-screen.

# ---- Settings -------------------------------------------------------------
# "browser" = Chromium with tabs, Home button and Recipes bookmarks (default)
# "kiosk"   = no browser bars; rotating pages + launcher (optional extension)
MODE="browser"

# Screen rotation. The Touch Display 2 is portrait already, so leave "normal".
# ("90" / "270" turn it to landscape; needs: sudo apt install wlr-randr)
ROTATE="normal"
OUTPUT="DSI-1"
# ---------------------------------------------------------------------------

PROFILE="$HOME/kiosk/profile"
PREFS="$PROFILE/Default/Preferences"

# Rotate the screen (retry briefly while the display comes up).
if [ "$ROTATE" != "normal" ]; then
  for i in $(seq 1 20); do
    wlr-randr --output "$OUTPUT" --transform "$ROTATE" && break
    sleep 0.5
  done
fi

# Your workspace from a private GitHub repository (step 10): fetch the newest copy,
# or keep the last one when offline. The address is kept in ~/kiosk/start-url.
URLFILE="$HOME/kiosk/start-url"
if [ -x "$HOME/kiosk/kiosk-data.sh" ]; then
  timeout 60 "$HOME/kiosk/kiosk-data.sh" > /dev/null 2>&1
  rm -f "$URLFILE.changed"   # starting now anyway: no restart needed
fi

# After a power cut, stop Chromium thinking it crashed (no "Restore pages?" bar).
if [ -f "$PREFS" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS"
fi

FLAGS=(
  --user-data-dir="$PROFILE"
  --ozone-platform=wayland
  --noerrdialogs
  --disable-infobars
  --no-first-run
  --disable-session-crashed-bubble
  --password-store=basic
  --touch-events=enabled
  --disable-pinch
  --overscroll-history-navigation=0
)

if [ "$MODE" = "kiosk" ]; then
  FLAGS+=(
    --kiosk
    --disable-features=Translate,DisableLoadExtensionCommandLineSwitch
    --load-extension="$HOME/kiosk/extension"
  )
  START=(about:blank)
  # The rotating extension opens the planner page at this address (step 10).
  if [ -s "$URLFILE" ]; then
    printf 'self.KIOSK_START_URL = "%s";\n' "$(cat "$URLFILE")" > "$HOME/kiosk/extension/start-url.js"
  else
    rm -f "$HOME/kiosk/extension/start-url.js"
  fi
else
  FLAGS+=(
    --top-chrome-touch-ui=enabled
    --disable-features=Translate
  )
  START=()   # start page comes from the Chromium settings file (step 5)
  if [ -s "$URLFILE" ]; then
    START=("$(cat "$URLFILE")")   # your workspace from the private repository (step 10)
  fi
fi

exec /usr/lib/chromium/chromium "${FLAGS[@]}" "${START[@]}"
