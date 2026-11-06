# Raspberry Pi 3B Portrait Touchscreen Kiosk

A clean, from-scratch guide to turning a **Raspberry Pi 3B** and the official **Raspberry Pi Touch Display 2 (7″)** into a portrait wall or kitchen display.

**Main setup (steps 1–8)** gives you:

- your **week planner** filling a portrait touchscreen
- Chromium's **tabs, Back and Home buttons**, sized for fingers
- a **Recipes** button on the bookmarks bar, holding your saved recipes
- automatic start on power-up, and automatic restart if the browser ever crashes

**Step 9** adds a **motion sensor**. The screen dims when nobody is around, then switches off, and wakes as soon as someone walks up or touches it.

**Optional add-on:** a [rotating kiosk mode](#optional-rotating-kiosk-mode) with no browser bars. It cycles between the planner, a weather page and a clock, and has a launcher screen for pausing and opening recipes.

It runs on **Raspberry Pi OS Lite (Trixie)** with **cage** (a minimal kiosk compositor) and **Chromium**. There's no desktop, X server or Openbox, so all of the Pi's 1GB is left for the browser.

> **Reusing an SD card from the Zero 2 W?** Flash a fresh one. It's quicker than undoing the Waveshare, rotation and X/Openbox settings from earlier attempts.

---

## Contents

1. [What you need](#what-you-need)
2. [How it fits together](#how-it-fits-together)
3. [Step 1 – Flash Raspberry Pi OS Lite](#step-1--flash-raspberry-pi-os-lite)
4. [Step 2 – First boot and updates](#step-2--first-boot-and-updates)
5. [Step 3 – Install the software](#step-3--install-the-software)
6. [Step 4 – Log in automatically](#step-4--log-in-automatically)
7. [Step 5 – Chromium settings and recipe bookmarks](#step-5--chromium-settings-and-recipe-bookmarks)
8. [Step 6 – Create the start script](#step-6--create-the-start-script)
9. [Step 7 – Start on boot](#step-7--start-on-boot)
10. [Step 8 – Check the screen and touch](#step-8--check-the-screen-and-touch)
11. [Step 9 – Dim the screen when nobody is around](#step-9--dim-the-screen-when-nobody-is-around)
12. [Using it](#using-it)
13. [Adding and changing recipes](#adding-and-changing-recipes)
14. [Optional: rotating kiosk mode](#optional-rotating-kiosk-mode)
15. [Optional: a 3D-printed case](#optional-a-3d-printed-case)
16. [Optional extras](#optional-extras)
17. [Troubleshooting](#troubleshooting)

---

## What you need

| Item | Notes |
|---|---|
| Raspberry Pi 3B (or 3B+) | 1GB of RAM, which Chromium needs on a touchscreen. |
| [Raspberry Pi Touch Display 2, 7″](https://www.raspberrypi.com/products/touch-display-2/) | 720×1280, portrait as standard. Comes with the ribbon cable for the Pi 3B, the power lead and mounting screws. |
| 5V **2.5A** micro-USB power supply | Plugs into the Pi. The display draws its power from the Pi, so one supply runs both. The official Raspberry Pi supply is a safe choice. |
| microSD card, 16GB or larger | A good-quality "A1" or "A2" card makes a real difference. |
| [Adafruit Mini PIR Motion Sensor](https://thepihut.com/products/breadboard-friendly-mini-pir-motion-sensor-with-3-pin-header) (The Pi Hut, about £3.50) | For step 9. |
| 3 female-to-female jumper wires | To connect the sensor to the Pi. |
| A computer with [Raspberry Pi Imager](https://www.raspberrypi.com/software/) | For flashing the card and setting up Wi-Fi and SSH. |
| *Optional:* a small USB keyboard | Only for typing a web address now and then. |

Everything below is done **over SSH** from your computer.

---

## How it fits together

```
Power on
 └─ Pi logs in automatically on its own screen (tty1)
     └─ ~/.profile starts cage         (one full-screen app, no desktop)
         └─ cage runs ~/kiosk/start.sh
             └─ starts Chromium
                 ├─ settings and Recipes bookmarks from  /etc/chromium/policies/managed/kiosk.json
                 └─ opens the week planner
```

A separate background service, screen-dimmer, watches the motion sensor and touchscreen and sets the display's brightness.

If Chromium quits or crashes, cage exits, the Pi logs in again, and everything restarts on its own.

---

## Step 1 – Flash Raspberry Pi OS Lite

1. Open **Raspberry Pi Imager**.
2. **Device:** Raspberry Pi 3.
3. **OS:** *Raspberry Pi OS (other)* → **Raspberry Pi OS Lite (64-bit)**.
4. **Storage:** your microSD card.
5. When asked about **OS customisation**, choose **Edit settings**:
   - **Hostname:** `kiosk` (this guide uses `kiosk.local`)
   - **Username and password:** anything you like (the commands below work with any name)
   - **Wireless LAN:** your Wi-Fi name and password; country `GB`
   - **Locale:** time zone `Europe/London`, keyboard `gb`
   - **Services** tab: tick **Enable SSH**
6. Write the card and put it in the Pi. Connect the display before powering on (below).

### Connect the display

With the Pi **unplugged**:

1. **Ribbon cable:** connect the display to the Pi's **DISPLAY** connector, the slot on the short edge next to the microSD card, not the CAMERA slot between the HDMI and audio sockets. Use the cable marked for Pi 4 and earlier (15-way at both ends). Lift the connector's latch, slide the cable fully in, and press the latch down. Follow the orientation shown in the display's leaflet or [Raspberry Pi's Touch Display 2 guide](https://www.raspberrypi.com/documentation/accessories/touch-display-2.html).
2. **Power lead:** connect the display's power lead to the Pi's GPIO pins: **red to pin 2 (5V)** and **black to pin 6 (GND)**. These are the top-right pins when the USB and Ethernet ports face down.
3. **Mount the Pi** on the four stand-offs on the back of the display with the included M2.5 screws (optional, but neat).
4. Plug the power supply into the Pi's micro-USB port.

The display lights up and shows the boot text in **portrait**. The first boot takes a few minutes while the system expands and reboots.

---

## Step 2 – First boot and updates

From your computer:

```bash
ssh yourname@kiosk.local
```

Update everything:

```bash
sudo apt update && sudo apt full-upgrade -y
sudo reboot
```

Reconnect after a minute. Check that swap is set up, since Chromium leans on it with 1GB of RAM. Trixie configures it automatically:

```bash
free -h
```

The `Swap:` line should show a non-zero total.

---

## Step 3 – Install the software

```bash
sudo apt install -y cage chromium curl
```

| Package | What it does |
|---|---|
| **cage** | A tiny compositor that shows one app full-screen. It handles touch with no setup and hides the mouse pointer unless a mouse is plugged in. |
| **chromium** | The browser. Later steps launch `/usr/lib/chromium/chromium` directly. The `/usr/bin/chromium` wrapper opens a hidden "less than 1GB RAM" warning that leaves you with a black screen. |
| **curl** | Downloads the kiosk files below (usually installed already). |

### Download the kiosk files

Every file this guide installs is kept in the planner's repository, in [`docs/kiosk/files/`](files/). One command fetches them all into `~/kiosk-files`:

```bash
rm -rf ~/kiosk-files && mkdir ~/kiosk-files && curl -fsSL https://github.com/lvisintini/week-scheduler/archive/refs/heads/main.tar.gz | tar -xz -C ~/kiosk-files --strip-components=4 week-scheduler-main/docs/kiosk/files
ls ~/kiosk-files
```

You should see `autostart.sh`, `extension`, `kiosk.json`, `screen-dimmer.py`, `screen-dimmer.service` and `start.sh`. The next steps copy each one into place. `~/kiosk-files` is only a download folder: run the same command again whenever you want the latest versions (see [Getting newer versions of the files](#getting-newer-versions-of-the-files)).

| File | Goes to | Step |
|---|---|---|
| [`kiosk.json`](files/kiosk.json) | `/etc/chromium/policies/managed/kiosk.json` | 5 |
| [`start.sh`](files/start.sh) | `~/kiosk/start.sh` | 6 |
| [`autostart.sh`](files/autostart.sh) | `~/kiosk/autostart.sh` | 7 |
| [`screen-dimmer.py`](files/screen-dimmer.py) | `/usr/local/bin/screen-dimmer.py` | 9 |
| [`screen-dimmer.service`](files/screen-dimmer.service) | `/etc/systemd/system/screen-dimmer.service` | 9 |
| [`extension/`](files/extension/) | `~/kiosk/extension/` | [optional rotating kiosk mode](#optional-rotating-kiosk-mode) |

---

## Step 4 – Log in automatically

```bash
sudo raspi-config nonint do_boot_behaviour B2
```

> Same as `sudo raspi-config` → **System Options** → **Boot / Auto Login** → **Console Autologin**.

---

## Step 5 – Chromium settings and recipe bookmarks

Chromium reads settings from a file in `/etc/chromium/policies/managed/`. Using that file means no clicking through menus on the touchscreen. It:

- opens the **week planner** at start-up and makes it the **Home** button
- shows the **bookmarks bar**, with a **Recipes** folder you control from this file
- turns off sign-in prompts, translation pop-ups, password saving and other nags

Copy it into place ([see the file](files/kiosk.json)):

```bash
sudo install -D -m 644 ~/kiosk-files/kiosk.json /etc/chromium/policies/managed/kiosk.json
```

Check it's valid. It should print the file back with no error:

```bash
python3 -m json.tool /etc/chromium/policies/managed/kiosk.json
```

Replace the two example recipes with your own now, or later (see [Adding and changing recipes](#adding-and-changing-recipes)).

---

## Step 6 – Create the start script

The start script launches Chromium with the right settings ([see the file](files/start.sh)):

```bash
install -D -m 755 ~/kiosk-files/start.sh ~/kiosk/start.sh
```

The settings at the top are all you'll normally change:

| Setting | Meaning |
|---|---|
| `MODE="browser"` | Chromium with tabs and the Recipes bookmarks. Change to `"kiosk"` only if you set up the [optional rotating kiosk mode](#optional-rotating-kiosk-mode). |
| `ROTATE="normal"` | Leave as `normal`. The Touch Display 2 is already portrait. |

What the Chromium flags do:

| Flag | Why |
|---|---|
| `--ozone-platform=wayland` | Draws through cage, with no X server needed |
| `--top-chrome-touch-ui=enabled` | Bigger tabs and buttons, easier to hit with a finger |
| `--touch-events=enabled` | Pages receive proper touch events |
| `--disable-pinch` | No accidental pinch-zoom |
| `--overscroll-history-navigation=0` | No accidental swipe-back. Use the Back button instead. |
| `--user-data-dir=…` | Keeps the kiosk's browser profile in `~/kiosk/profile` |

---

## Step 7 – Start on boot

The launch command lives in `~/kiosk/autostart.sh` ([see the file](files/autostart.sh)), and `~/.profile` reads it at every login. It starts the kiosk only on the Pi's own screen, so SSH logins are unaffected:

```bash
install -m 644 ~/kiosk-files/autostart.sh ~/kiosk/autostart.sh
grep -q kiosk/autostart.sh ~/.profile || echo '. "$HOME/kiosk/autostart.sh"' >> ~/.profile
sudo reboot
```

After the boot text, Chromium takes about **20–40 seconds** to appear the first time. You should see the week planner with Chromium's toolbar and a **Recipes** folder on the bookmarks bar.

> **Restart the kiosk without rebooting** (after changing settings):
> ```bash
> sudo systemctl restart getty@tty1
> ```

---

## Step 8 – Check the screen and touch

After the reboot in step 7 you should see:

- **portrait picture** filling the screen, with the planner below Chromium's toolbar
- **touch working:** tap **Recipes** on the bookmarks bar, then the **Home** button

There are no screen or touch settings to change; the Pi detects the Touch Display 2 automatically. If the screen stays black, see [Troubleshooting](#troubleshooting).

---

## Step 9 – Dim the screen when nobody is around

A small background service controls the display's brightness:

| Situation | Screen |
|---|---|
| Someone moves in front of it, or touches it | **Full brightness**, straight away |
| 5 minutes with no movement or touch | **Dims** to 10% |
| 15 minutes with no movement or touch | **Backlight off** |

A PIR sensor only notices *movement*. If you stand still reading a recipe, touches keep it awake, and if it does dim, the screen goes to low brightness rather than black. Any small movement brings it straight back.

### 9.1 Wire the sensor

With the Pi **unplugged**, connect the Adafruit Mini PIR with three female-to-female jumper wires. Check the labels printed on the sensor's board for which pin is which:

| Sensor pin | Pi pin |
|---|---|
| Power (+, VCC) | **Pin 1** (3.3V) |
| Output (OUT) | **Pin 11** (GPIO17) |
| Ground (−, GND) | **Pin 9** (GND) |

Pins 1, 9 and 11 are on the left-hand column of the header, while the display's power lead uses pins 2 and 6 on the right, so they don't clash. The sensor's output is 3.3V, which is safe for the Pi.

**Where to put it:** below the screen, facing into the room and angled slightly down towards where people stand. Keep it out of view of the hob, oven or a radiator, since a PIR reacts to heat moving. It can't see through glass or plastic, so the white dome must stay uncovered.

### 9.2 Test the sensor and backlight

Power on and SSH in. Install the two Python libraries the service uses:

```bash
sudo apt install -y python3-gpiozero python3-evdev
```

**Check the sensor.** This prints a line every time it sees movement. Wave a hand in front of it, then press **Ctrl+C** to stop:

```bash
python3 -c "from gpiozero import MotionSensor; from signal import pause; s = MotionSensor(17); s.when_motion = lambda: print('motion'); pause()"
```

**Check the brightness control.** Run these one at a time; the screen should go dim, then back to full:

```bash
echo 30  | sudo tee /sys/class/backlight/*/brightness
echo 255 | sudo tee /sys/class/backlight/*/brightness
```

### 9.3 Install the dimmer

Copy the script ([see the file](files/screen-dimmer.py)) and the service that starts it on boot and restarts it if it ever stops ([see the file](files/screen-dimmer.service)), then switch it on:

```bash
sudo install -m 755 ~/kiosk-files/screen-dimmer.py /usr/local/bin/screen-dimmer.py
sudo install -m 644 ~/kiosk-files/screen-dimmer.service /etc/systemd/system/screen-dimmer.service
sudo systemctl daemon-reload
sudo systemctl enable --now screen-dimmer
```

Check it's running. You should see the backlight and touch device it found:

```bash
systemctl status screen-dimmer --no-pager
```

### 9.4 Change the timings

The settings are at the top of the script:

```bash
sudo nano /usr/local/bin/screen-dimmer.py
sudo systemctl restart screen-dimmer
```

| Setting | Default | Meaning |
|---|---|---|
| `DIM_AFTER` | `5 * 60` | Seconds without activity before dimming |
| `OFF_AFTER` | `15 * 60` | Seconds before switching off; `0` keeps it dimmed instead |
| `DIM_PERCENT` | `10` | Brightness when dimmed |
| `BRIGHT_PERCENT` | `100` | Normal brightness. Lower it if the screen is too bright in the evening. |
| `PIR_GPIO` | `17` | Change this only if you wired the sensor to a different pin |

> **Tapping a dark screen:** if the screen is fully off and you tap it, that first tap also reaches whatever is on screen. Usually the sensor wakes the screen before your finger gets there, but tap an empty area to be safe.

---

## Using it

| You want to… | Do this |
|---|---|
| Go back to the planner | Tap the **Home** button (house icon) in the toolbar. |
| Open a recipe | Tap **Recipes** on the bookmarks bar, then pick one. It opens in the current tab. To keep the planner open as well, tap **+** for a new tab first. |
| Switch between planner and recipe | Tap the tabs at the top. |
| Finish with a recipe | Tap the **×** on its tab. Closing tabs frees memory. |
| Go back a page | Tap the **Back** arrow. |
| Type a web address | Plug a USB keyboard into the Pi. There's no on-screen keyboard in this setup. |

Tips:

- Keep to **a few open tabs**. Each one uses memory.
- Recipe sites are often heavy with adverts and video. Their **"Print"** or **"Jump to recipe"** pages are much lighter, so bookmark those URLs where you can.

---

## Adding and changing recipes

Edit the settings file:

```bash
sudo nano /etc/chromium/policies/managed/kiosk.json
```

Recipes go in `ManagedBookmarks`. The first entry names the folder; each recipe is a `name` and a `url`. You can group recipes into sub-folders with `children`:

```json
  "ManagedBookmarks": [
    { "toplevel_name": "Recipes" },
    { "name": "Lentil soup", "url": "https://www.example.com/lentil-soup" },
    { "name": "Baking", "children": [
        { "name": "Banana bread", "url": "https://www.example.com/banana-bread" },
        { "name": "Scones",       "url": "https://www.example.com/scones" }
    ]}
  ],
```

Watch the commas: every entry except the last in a list needs one. Then check and apply:

```bash
python3 -m json.tool /etc/chromium/policies/managed/kiosk.json > /dev/null && echo OK
sudo systemctl restart getty@tty1
```

The planner address appears twice in the file, under `HomepageLocation` and `RestoreOnStartupURLs`. Change both if it ever moves.

---

## Optional: rotating kiosk mode

This replaces the browser bars with a full-screen display that **rotates** through the planner, a weather page and a clock. A small round **Home** button in the corner of every page opens a launcher, where you can:

- **pause** the rotation and pick one screen to stay on
- **open a recipe**, which stays up until you close it
- **resume** rotation (it also restarts by itself 15 minutes after the last touch, unless a recipe is open)

The weather comes from [Open-Meteo](https://open-meteo.com/), which is free and needs no account. All the built-in pages are laid out for the portrait 720×1280 screen. The screen-dimmer from step 9 works in this mode too.

It's a small Chromium extension: 11 files you copy once. You can switch back to the main setup at any time by setting `MODE="browser"` in `start.sh`.

### Copy the extension files

```bash
mkdir -p ~/kiosk/extension
cp ~/kiosk-files/extension/* ~/kiosk/extension/
ls ~/kiosk/extension
```

You should see 11 files ([see them](files/extension/)):

| File | What it does |
|---|---|
| [`config.js`](files/extension/config.js) | **Your settings for this mode:** pages, timings, recipes, weather location. See [Changing its settings](#changing-its-settings). |
| [`manifest.json`](files/extension/manifest.json) | Tells Chromium what the extension is and what it may do. |
| [`background.js`](files/extension/background.js) | Rotation, pausing and recipes. |
| [`overlay.js`](files/extension/overlay.js) | The round Home button on every page. |
| [`style.css`](files/extension/style.css) | Colours and fonts shared by the built-in pages. |
| [`launcher.html`](files/extension/launcher.html), [`launcher.js`](files/extension/launcher.js) | The launcher screen. |
| [`clock.html`](files/extension/clock.html), [`clock.js`](files/extension/clock.js) | The clock page. |
| [`weather.html`](files/extension/weather.html), [`weather.js`](files/extension/weather.js) | The weather page. |

### Switch it on

Edit `~/kiosk/start.sh`, change `MODE="browser"` to `MODE="kiosk"`, then restart:

```bash
sudo systemctl restart getty@tty1
```

### Using rotating kiosk mode

| You want to… | Do this |
|---|---|
| Stop the rotation | Tap the round **Home** button. Rotation pauses and the launcher opens. |
| Show one screen and stay on it | On the launcher, tap **Week planner**, **Weather** or **Clock**. |
| Open a recipe | On the launcher, tap it. Rotation stays paused while the recipe is open. |
| Go back to the recipe after checking something | Home → **Back to recipe**. |
| Finish cooking | Home → **Close recipe & rotate**. |

### Changing its settings

```bash
nano ~/kiosk/extension/config.js
sudo systemctl restart getty@tty1
```

- **`rotateSeconds`** sets the time per screen (minimum 30).
- **`rotation`** is the list of pages. Each `id` must be unique.
- **`recipes`** is the recipe buttons on the launcher. This mode has its own list; it doesn't use the bookmarks file.
- **`weather`** is the place name and coordinates. Right-click a spot in Google Maps to see its coordinates.
- **`homeButtonCorner`** moves the round Home button if it covers something.

---

## Optional: a 3D-printed case

These printable cases fit the 7″ Touch Display 2 with a Pi mounted on the back:

| Case | Notes |
|---|---|
| [Boîtier pour Raspberry Pi Touch Display 2](https://makerworld.com/en/models/1349222) (MakerWorld) | Lists the Pi 3B; includes a wall bracket fixed with M3 screws. |
| [Touch Display 2 wall mount case](https://www.printables.com/model/1202915-raspberry-pi-touch-display-2-wall-mount-case) (Printables) | The 60mm-deep version has spare room inside. Screws or Command strips. |
| [Touch Display 2 Case](https://www.printables.com/model/1071718-raspberry-pi-touch-display-2-case) (Printables) | VESA or 50mm hole patterns, with a cable channel. |

None of them has a hole for the motion sensor. The easiest fix is a **~10mm hole in the bottom edge** of the bezel: push the sensor's dome through from inside and hold the small board in place with a dab of hot glue. Check the cable holes still suit the power lead coming out at the bottom when the case hangs in portrait.

---

## Optional extras

### Read-only SD card (protects against power cuts)

Raspberry Pi OS can run from a read-only SD card with a temporary layer on top, so a sudden power cut can't corrupt it:

```bash
sudo raspi-config
```

→ **Performance Options** → **Overlay File System** → **Yes**, and make the boot partition read-only too. Then reboot.

Be aware:

- **Changes don't stick.** Anything written while it's on, including recipe edits, updates and newly downloaded kiosk files, disappears at the next reboot. Turn the overlay off, make your changes, reboot, then turn it back on.
- **Saved browser data is wiped at every reboot.** If your planner keeps anything in browser storage (local settings or edits), that's lost too. Only enable this if your pages get all their data from the web.

### Getting newer versions of the files

The files in [`docs/kiosk/files/`](files/) are improved from time to time. Download them again with the command from [step 3](#download-the-kiosk-files), then copy across the ones that changed, using the same command as the step that installed them.

Four files hold **your own settings**, so copying a new version over them throws your changes away:

| File | Your settings in it |
|---|---|
| `/etc/chromium/policies/managed/kiosk.json` | Recipes |
| `~/kiosk/start.sh` | `MODE` |
| `/usr/local/bin/screen-dimmer.py` | Timings and brightness |
| `~/kiosk/extension/config.js` | Everything in it |

See what changed before copying one of these, then either copy the new file and make your changes again, or make the new changes by hand in your copy:

```bash
diff ~/kiosk/start.sh ~/kiosk-files/start.sh
diff /usr/local/bin/screen-dimmer.py ~/kiosk-files/screen-dimmer.py
diff /etc/chromium/policies/managed/kiosk.json ~/kiosk-files/kiosk.json
diff -r ~/kiosk/extension ~/kiosk-files/extension
```

No output means nothing changed. Restart the kiosk afterwards (`sudo systemctl restart getty@tty1`), and the dimmer if you updated it (`sudo systemctl daemon-reload && sudo systemctl restart screen-dimmer`).

### SSH keys instead of a password

On your computer:

```bash
ssh-copy-id yourname@kiosk.local
```

Then set `PasswordAuthentication no` in `/etc/ssh/sshd_config` on the Pi, and run `sudo systemctl restart ssh`.

### Keeping it up to date

Every month or so:

```bash
sudo apt update && sudo apt full-upgrade -y && sudo reboot
```

---

## Troubleshooting

Start here:

```bash
cat ~/kiosk/kiosk.log
pgrep -a chromium | head -3
free -h
```

| Problem | Likely cause and fix |
|---|---|
| No picture at all, not even boot text | Power off and re-seat the ribbon cable at both ends; it must be in the **DISPLAY** connector, fully inserted, latch closed. Check the power lead is on pins 2 and 6. `grep display_auto_detect /boot/firmware/config.txt` should show `display_auto_detect=1`. |
| Black screen after the boot text | Wait a full minute first. Then check `kiosk.log`. If Chromium isn't running, make sure `start.sh` uses `/usr/lib/chromium/chromium`; `/usr/bin/chromium` waits on a hidden low-memory warning. |
| Black or flickering browser window, but Chromium is running | Add `--disable-gpu` as a new line inside the `FLAGS=( … )` list in `start.sh`, then restart the kiosk. |
| Screen dims or switches off while someone is there | Lengthen `DIM_AFTER` in step 9.4, or check the sensor's aim. If it's out of the way of the room, it can't see people. |
| Screen never dims | Something keeps triggering the sensor, often heat from a hob, radiator or sunny window. Watch it with the test command in step 9.2, then re-aim it. Check the service is running with `systemctl status screen-dimmer`. |
| Screen-dimmer says "No backlight found" | The display isn't detected; check the ribbon cable and power lead. |
| No Recipes folder or Home button | The settings file has a mistake. Run `python3 -m json.tool /etc/chromium/policies/managed/kiosk.json` and fix the line it reports. |
| Rotating kiosk mode shows pages but no round Home button and no rotation | The extension didn't load. Check all 11 files exist in `~/kiosk/extension` and `manifest.json` is valid (`python3 -m json.tool ~/kiosk/extension/manifest.json`). |
| A mouse pointer is visible | A mouse is plugged in. cage only shows the pointer when a mouse is connected. |
| "Restore pages?" bar after a power cut | `start.sh` handles this. If it still appears, delete `~/kiosk/profile` and restart the kiosk. |
| Slow, or tabs reload when you switch | Memory is tight. Close tabs you're done with, and use recipe "print" pages. |
| Need a text console on the Pi | Plug in a USB keyboard and press **Ctrl+Alt+F2**. **Ctrl+Alt+F1** returns to the kiosk. |

### Seeing inside Chromium (advanced)

1. Add `--remote-debugging-port=9222` as a new line inside `FLAGS=( … )` in `start.sh`, then restart the kiosk.
2. On your computer, run `ssh -L 9222:localhost:9222 yourname@kiosk.local` and leave it open.
3. In Chrome on your computer, open `chrome://inspect`, click **Configure…** and add `localhost:9222`. The kiosk's tabs appear under *Remote Target*. Click **inspect** to see errors.
4. Remove the flag when you're done.
