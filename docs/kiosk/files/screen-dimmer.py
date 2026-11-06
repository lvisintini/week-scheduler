#!/usr/bin/env python3
"""Dims the display when nobody is around.

Movement (PIR sensor) or a touch on the screen brings it to full brightness.
After a while with no activity it dims, then switches the backlight off.
"""
import glob
import select
import threading
import time

import evdev
from gpiozero import MotionSensor

# ---- Settings -------------------------------------------------------------
PIR_GPIO = 17            # GPIO number of the sensor's OUT wire (physical pin 11)
BRIGHT_PERCENT = 100     # brightness when someone is around
DIM_PERCENT = 10         # brightness after DIM_AFTER seconds of no activity
DIM_AFTER = 5 * 60       # seconds
OFF_AFTER = 15 * 60      # seconds; 0 = never switch fully off
# ---------------------------------------------------------------------------

last_activity = time.monotonic()


def activity():
    global last_activity
    last_activity = time.monotonic()


class Backlight:
    def __init__(self):
        paths = sorted(glob.glob("/sys/class/backlight/*"))
        if not paths:
            raise SystemExit("No backlight found in /sys/class/backlight - is the display connected?")
        self.path = paths[0]
        self.max = int(self._read("max_brightness"))
        self.level = int(self._read("brightness"))
        print(f"Backlight: {self.path} (max {self.max})", flush=True)

    def _read(self, name):
        with open(f"{self.path}/{name}") as f:
            return f.read().strip()

    def _write(self, name, value):
        try:
            with open(f"{self.path}/{name}", "w") as f:
                f.write(str(value))
        except OSError:
            pass  # e.g. bl_power not supported

    def fade_to(self, percent, seconds):
        target = round(self.max * percent / 100)
        if target == self.level:
            return
        if target > 0:
            self._write("bl_power", 0)       # make sure the backlight is on
        steps = max(1, int(seconds * 25))
        start = self.level
        for i in range(1, steps + 1):
            self._write("brightness", round(start + (target - start) * i / steps))
            time.sleep(seconds / steps)
        self.level = target
        if target == 0:
            self._write("bl_power", 4)       # fully off, where supported


def is_touchscreen(dev):
    abs_codes = [c[0] if isinstance(c, tuple) else c
                 for c in dev.capabilities().get(evdev.ecodes.EV_ABS, [])]
    return evdev.ecodes.ABS_MT_POSITION_X in abs_codes or evdev.ecodes.ABS_X in abs_codes


def watch_touch():
    """Treat any touch on the screen as activity (reads events without blocking the kiosk)."""
    while True:
        devices = []
        try:
            devices = [d for d in map(evdev.InputDevice, evdev.list_devices()) if is_touchscreen(d)]
        except OSError:
            pass
        if not devices:
            time.sleep(5)            # touchscreen not ready yet; try again
            continue
        print("Touch devices: " + ", ".join(d.name for d in devices), flush=True)
        fds = {d.fd: d for d in devices}
        try:
            while True:
                ready, _, _ = select.select(fds, [], [])
                for fd in ready:
                    for _ in fds[fd].read():
                        activity()
        except OSError:
            time.sleep(1)            # device went away; look for it again


def main():
    backlight = Backlight()
    pir = MotionSensor(PIR_GPIO)
    pir.when_motion = activity
    threading.Thread(target=watch_touch, daemon=True).start()

    while True:
        if pir.motion_detected:
            activity()
        idle = time.monotonic() - last_activity
        if idle < DIM_AFTER:
            backlight.fade_to(BRIGHT_PERCENT, 0.3)    # wake quickly
        elif OFF_AFTER and idle >= OFF_AFTER:
            backlight.fade_to(0, 2)
        else:
            backlight.fade_to(DIM_PERCENT, 2)         # dim gently
        time.sleep(0.5)


if __name__ == "__main__":
    main()
