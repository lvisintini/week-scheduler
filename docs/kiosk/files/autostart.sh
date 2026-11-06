# Read by ~/.profile at every login (step 7 of docs/kiosk/README.md).
# Starts the kiosk on the Pi's own screen only, so SSH logins are unaffected.
if [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec cage -d -s -- "$HOME/kiosk/start.sh" > "$HOME/kiosk/kiosk.log" 2>&1
fi
