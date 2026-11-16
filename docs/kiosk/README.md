# Raspberry Pi 3B Portrait Touchscreen Kiosk

A clean, from-scratch guide to turning a **Raspberry Pi 3B** and the official **Raspberry Pi Touch Display 2 (7″)** into a portrait wall or kitchen display.

**Main setup (steps 1–8)** gives you:

- your **week planner** filling a portrait touchscreen
- Chromium's **tabs, Back and Home buttons**, sized for fingers
- a **Recipes** button on the bookmarks bar, holding your saved recipes
- an **on-screen keyboard** from the taskbar, for web addresses and searches
- automatic start on power-up, and automatic restart if the browser ever closes or crashes

**Step 9** adds a **motion sensor**. The screen dims when nobody is around, then switches off, and wakes as soon as someone walks up or touches it.

**Step 10** shows **your own workspace**, kept as an encrypted file in a **private GitHub repository**. The Pi fetches it, and fetches it again when you push a new copy, with no typing on the touchscreen.

It runs on **Raspberry Pi OS with desktop (Trixie)**: its Wayland desktop (labwc) with the taskbar, Raspberry Pi's on-screen keyboard (squeekboard) and **Chromium**, maximised so the taskbar stays in reach. The desktop takes a share of the Pi's 1GB, so keep to a few tabs (see [Using it](#using-it)).

> **Reusing an SD card from the Zero 2 W?** Flash a fresh one. It's quicker than undoing the Waveshare, rotation and X/Openbox settings from earlier attempts.

---

## Contents

1. [What you need](#what-you-need)
2. [How it fits together](#how-it-fits-together)
3. [Step 1 – Flash Raspberry Pi OS](#step-1--flash-raspberry-pi-os)
4. [Step 2 – First boot and updates](#step-2--first-boot-and-updates)
5. [Step 3 – Install the software](#step-3--install-the-software)
6. [Step 4 – Log in automatically](#step-4--log-in-automatically)
7. [Step 5 – Chromium settings and recipe bookmarks](#step-5--chromium-settings-and-recipe-bookmarks)
8. [Step 6 – Create the start script](#step-6--create-the-start-script)
9. [Step 7 – Start on boot](#step-7--start-on-boot)
10. [Step 8 – Check the screen, touch and keyboard](#step-8--check-the-screen-touch-and-keyboard)
11. [Step 9 – Dim the screen when nobody is around](#step-9--dim-the-screen-when-nobody-is-around)
12. [Step 10 – Show your workspace from a private GitHub repository](#step-10--show-your-workspace-from-a-private-github-repository)
13. [Using it](#using-it)
14. [Adding and changing recipes](#adding-and-changing-recipes)
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

Everything below is done **over SSH** from your computer, apart from two settings in step 8 that you tap on the touchscreen.

---

## How it fits together

```
Power on
 └─ Pi logs in to the desktop automatically (taskbar, on-screen keyboard button)
     └─ the desktop's autostart runs ~/kiosk/start.sh
         └─ starts Chromium, maximised, and starts it again whenever it closes
             ├─ settings and Recipes bookmarks from  /etc/chromium/policies/managed/kiosk.json
             └─ opens the week planner
```

A separate background service, screen-dimmer, watches the motion sensor and touchscreen and sets the display's brightness.

With step 10, `start.sh` first fetches your workspace from your private repository, and Chromium opens the planner with it. A timer checks for a new copy every 15 minutes.

If Chromium quits or crashes, `start.sh` opens it again a couple of seconds later.

---

## Step 1 – Flash Raspberry Pi OS

1. Open **Raspberry Pi Imager**.
2. **Device:** Raspberry Pi 3.
3. **OS:** **Raspberry Pi OS (64-bit)**, the version with the desktop (not *Lite*).
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

The display lights up in **portrait**. The first boot takes a few minutes while the system expands and reboots, then the desktop appears.

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
sudo apt install -y chromium curl
```

Both usually come with the desktop already; this makes sure.

| Package | What it does |
|---|---|
| **chromium** | The browser. Later steps launch `/usr/lib/chromium/chromium` directly. The `/usr/bin/chromium` wrapper opens a hidden "less than 1GB RAM" warning that leaves you with a black screen. |
| **curl** | Downloads the kiosk files below (usually installed already). |

### Download the kiosk files

Every file this guide installs is kept in the planner's repository, in [`docs/kiosk/files/`](files/). One command fetches them all into `~/kiosk-files`:

```bash
rm -rf ~/kiosk-files && mkdir ~/kiosk-files && curl -fsSL https://github.com/lvisintini/week-scheduler/archive/refs/heads/main.tar.gz | tar -xz -C ~/kiosk-files --strip-components=4 week-scheduler-main/docs/kiosk/files
ls ~/kiosk-files
```

You should see `99-kiosk-no-pointer.rules`, the four `kiosk-data` files, `kiosk.desktop`, `kiosk.json`, `screen-dimmer.py`, `screen-dimmer.service` and `start.sh`. The next steps copy each one into place. `~/kiosk-files` is only a download folder: run the same command again whenever you want the latest versions (see [Getting newer versions of the files](#getting-newer-versions-of-the-files)).

| File | Goes to | Step |
|---|---|---|
| [`kiosk.json`](files/kiosk.json) | `/etc/chromium/policies/managed/kiosk.json` | 5 |
| [`start.sh`](files/start.sh) | `~/kiosk/start.sh` | 6 |
| [`kiosk.desktop`](files/kiosk.desktop) | `~/.config/autostart/kiosk.desktop` | 7 |
| [`99-kiosk-no-pointer.rules`](files/99-kiosk-no-pointer.rules) | `/etc/udev/rules.d/99-kiosk-no-pointer.rules` | 8 |
| [`screen-dimmer.py`](files/screen-dimmer.py) | `/usr/local/bin/screen-dimmer.py` | 9 |
| [`screen-dimmer.service`](files/screen-dimmer.service) | `/etc/systemd/system/screen-dimmer.service` | 9 |
| [`kiosk-data.sh`](files/kiosk-data.sh) | `~/kiosk/kiosk-data.sh` | 10 |
| [`kiosk-data.conf`](files/kiosk-data.conf) | `~/kiosk/kiosk-data.conf` | 10 |
| [`kiosk-data@.service`](files/kiosk-data@.service), [`kiosk-data@.timer`](files/kiosk-data@.timer) | `/etc/systemd/system/` | 10 |

---

## Step 4 – Log in automatically

```bash
sudo raspi-config nonint do_boot_behaviour B4
```

> Same as `sudo raspi-config` → **System Options** → **Boot / Auto Login** → **Desktop Autologin**.

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

It has no settings to change. It starts Chromium and, whenever Chromium closes (a crash, someone closing it, or a new workspace from step 10), starts it again two seconds later. What the Chromium flags do:

| Flag | Why |
|---|---|
| `--ozone-platform=wayland` | Draws through the desktop's Wayland compositor |
| `--start-maximized` | Fills the screen but leaves the taskbar visible, with its on-screen keyboard button (full screen would hide it) |
| `--top-chrome-touch-ui=enabled` | Bigger tabs and buttons, easier to hit with a finger |
| `--touch-events=enabled` | Pages receive proper touch events |
| `--disable-pinch` | No accidental pinch-zoom |
| `--overscroll-history-navigation=0` | No accidental swipe-back. Use the Back button instead. |
| `--user-data-dir=…` | Keeps the kiosk's browser profile in `~/kiosk/profile` |

---

## Step 7 – Start on boot

The desktop starts every program that has an entry in `~/.config/autostart` when it logs in. This entry ([see the file](files/kiosk.desktop)) runs the start script; the `sed` puts your home folder into it:

```bash
mkdir -p ~/.config/autostart
sed "s|@HOME@|$HOME|" ~/kiosk-files/kiosk.desktop > ~/.config/autostart/kiosk.desktop
sudo reboot
```

After the desktop appears, Chromium takes about **20–40 seconds** to open the first time. You should see the week planner with Chromium's toolbar, a **Recipes** folder on the bookmarks bar, and the desktop's taskbar.

> **Restart the kiosk without rebooting** (after changing settings): close Chromium, and `start.sh` opens it again:
> ```bash
> pkill -f /usr/lib/chromium/chromium
> ```

---

## Step 8 – Check the screen, touch and keyboard

After the reboot in step 7 you should see:

- **portrait picture** filling the screen, with the planner below Chromium's toolbar and the taskbar along the top
- **touch working:** tap **Recipes** on the bookmarks bar, then the **Home** button

There are no screen or touch settings to change; the Pi detects the Touch Display 2 automatically. If the screen stays black, see [Troubleshooting](#troubleshooting).

### Keep the screen on

The desktop can blank the screen after a few minutes on its own. Switch that off, since the motion sensor in step 9 does the dimming. On the touchscreen, open the **Raspberry Pi menu** (top-left of the taskbar) **→ Preferences → Control Centre** (called *Raspberry Pi Configuration* in older releases) **→ Display**, and turn **Screen Blanking** off.

### The on-screen keyboard

The taskbar has a **keyboard button** when a touchscreen is connected. Tap it to bring up the keyboard at the bottom of the screen (Chromium shrinks to make room), type, and tap it again to put the keyboard away. It types anywhere: the address bar, a recipe site's search box, the planner's fields.

Chromium doesn't open the keyboard by itself when you tap a text field. It doesn't tell the desktop about text fields yet, so use the button.

If there's no keyboard button, open the same **Display** settings and set **On-screen Keyboard** to **Enabled always**.

### No mouse pointer

A **mouse pointer in the middle of the screen**, with no mouse plugged in, comes from the Pi itself. Its HDMI-CEC input (the HDMI port's remote-control link) tells the system it's a mouse, even with the screen on the ribbon cable, and the desktop draws a pointer whenever a mouse exists. This lists the input devices the system counts as a mouse; with no mouse plugged in you'll see one named `vc4…`:

```bash
udevadm info --export-db | awk -v RS= '/ID_INPUT_MOUSE=1/' | grep '^E: NAME='
```

This rule takes the mouse tag off that device only. Touch keeps working, and a real mouse still shows its pointer if you plug one in:

```bash
sudo install -m 644 ~/kiosk-files/99-kiosk-no-pointer.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=input
sudo reboot
```

The kiosk comes back without the pointer. Run the first command again: the `vc4…` device is no longer listed.

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

## Step 10 – Show your workspace from a private GitHub repository

Without this step the kiosk shows whatever is saved in its own browser memory, which you'd have to set up by touch. And if you turn on the [read-only SD card](#read-only-sd-card-protects-against-power-cuts), that memory is wiped at every reboot. With this step:

- you keep your workspace as an **encrypted file** in a **private** GitHub repository;
- the Pi fetches it with a **read-only key** that works for that one repository only;
- the planner opens it straight away, with no password to type and no questions;
- when you push a new copy, the kiosk picks it up within 15 minutes and restarts Chromium (about 30 seconds).

The planner itself still makes no network requests. The Pi downloads the file and gives it to the planner in the address, after the `#`, which is never sent to any server.

### 10.1 Choose the kiosk password

Pick one password for the kiosk's file, at least 20 characters, and keep it in your password manager. **Use the same password every time** you save the file for the kiosk. The planner's Save dialog suggests a new random password each time, so replace that suggestion with the kiosk password.

If you save it once with a different password, the kiosk can't open the new copy. It says so and keeps showing the last copy it had.

### 10.2 Put the file in a private repository

1. On GitHub, create a **private** repository, for example `kitchen-schedule`.
2. In the planner on your computer: **Save… → JSON file**, leave **Encrypted** on, replace the suggested password with the kiosk password, then **Save file**.
3. Rename the downloaded file to `weekly-schedules.json`, then add it to the repository, commit and push. You can do this on github.com with **Add file → Upload files**.

### 10.3 Give the Pi a read-only key

On the Pi:

```bash
sudo apt install -y git
ssh-keygen -t ed25519 -N "" -C kiosk -f ~/.ssh/kiosk_data
cat ~/.ssh/kiosk_data.pub
```

Copy the line it prints. On GitHub, open the private repository → **Settings → Deploy keys → Add deploy key**, give it a title (`kiosk`), paste the line, leave **Allow write access** unticked, then **Add key**.

### 10.4 Store the password on the Pi

This asks for the kiosk password without showing it, and stores it in a file only your user can read:

```bash
( umask 077; read -rsp "Kiosk password: " p; echo; printf '%s\n' "$p" > ~/kiosk/data-password )
```

### 10.5 Install the files

```bash
install -m 755 ~/kiosk-files/kiosk-data.sh ~/kiosk/kiosk-data.sh
install -m 644 ~/kiosk-files/kiosk-data.conf ~/kiosk/kiosk-data.conf
nano ~/kiosk/kiosk-data.conf
```

In `kiosk-data.conf` ([see the file](files/kiosk-data.conf)), set:

| Setting | Meaning |
|---|---|
| `REPO` | Your private repository's SSH address, from **Code → SSH** on GitHub, e.g. `git@github.com:yourname/kitchen-schedule.git` |
| `BRANCH` | Usually `main` |
| `FILE` | The file's path in the repository, e.g. `weekly-schedules.json` |
| `LAYOUT` | `phone` opens the planner's touch view (recommended on this screen); `desk` the computer layout; `""` leaves it as set in the planner's Settings |

Try it. The first time, ssh may note that it added GitHub to its known hosts; the last line should be `0`:

```bash
~/kiosk/kiosk-data.sh; echo $?
```

`0` means it fetched a new copy; running it again gives `3` (nothing changed). Anything else prints what went wrong (see [Troubleshooting](#troubleshooting)).

Then install the timer that checks for new copies ([service](files/kiosk-data@.service), [timer](files/kiosk-data@.timer)), and restart the kiosk:

```bash
sudo install -m 644 ~/kiosk-files/kiosk-data@.service ~/kiosk-files/kiosk-data@.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now "kiosk-data@$USER.timer"
pkill -f /usr/lib/chromium/chromium
```

The planner opens with your workspace. The address bar shows only the planner's plain address, because the planner removes the data and password from it once it has opened the file.

### 10.6 Updating your workspace

Change it in the planner on your computer, save it again as in 10.2 (same name, **same kiosk password**), and push. The kiosk shows the new copy within 15 minutes, or straight away after `~/kiosk/kiosk-data.sh; pkill -f /usr/lib/chromium/chromium`.

- **Changes made on the kiosk itself** are replaced by the next new copy from the repository. Make your changes on your computer.
- **Check less or more often:** change `OnUnitActiveSec=15min` in `/etc/systemd/system/kiosk-data@.timer`, then `sudo systemctl daemon-reload`.
- **Don't protect the kiosk's browser memory with a passphrase** (Settings → Data). The kiosk would ask for it every time Chromium starts.
- **Big workspaces:** the address can be at most about 120,000 characters. If `kiosk-data.sh` says the file is too big, save only the schedules the kiosk needs (**What to include → Choose…**).

---

## Using it

| You want to… | Do this |
|---|---|
| Go back to the planner | Tap the **Home** button (house icon) in the toolbar. |
| Show only some people's activities | In Live View, tap the names at the bottom: a tap hides or shows that person, and **All** brings them all back. It's the same as the person's eye in the sidebar. With Step 10, the kiosk goes back to the eyes saved in the file whenever it restarts. |
| Use the whole screen for Live View | In Live View, tap the **full-screen** button just above the red stop button. Chromium's toolbar, the bookmarks bar and the taskbar go away; tap it again, or stop Live View, to get them back for the recipes and the keyboard. |
| Open a recipe | Tap **Recipes** on the bookmarks bar, then pick one. It opens in the current tab. To keep the planner open as well, tap **+** for a new tab first. |
| Switch between planner and recipe | Tap the tabs at the top. |
| Finish with a recipe | Tap the **×** on its tab. Closing tabs frees memory. |
| Go back a page | Tap the **Back** arrow. |
| Type something (a web address, a search) | Tap the **keyboard button** on the taskbar, tap where you want to type, and type. Tap the button again to hide the keyboard. |

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
pkill -f /usr/lib/chromium/chromium
```

The planner address appears twice in the file, under `HomepageLocation` and `RestoreOnStartupURLs`. Change both if it ever moves.

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
- **Saved browser data is wiped at every reboot.** If your planner keeps anything in browser storage (local settings or edits), that's lost too. With [step 10](#step-10--show-your-workspace-from-a-private-github-repository) the planner gets your workspace (and the touch layout) back at every start. Without it, only enable this if your pages get all their data from the web.
- **Set up step 10 before turning the overlay on**, so the key, the password and the settings are saved on the card.

### Getting newer versions of the files

The files in [`docs/kiosk/files/`](files/) are improved from time to time. Download them again with the command from [step 3](#download-the-kiosk-files), then copy across the ones that changed, using the same command as the step that installed them.

Three files hold **your own settings**, so copying a new version over them throws your changes away:

| File | Your settings in it |
|---|---|
| `/etc/chromium/policies/managed/kiosk.json` | Recipes |
| `/usr/local/bin/screen-dimmer.py` | Timings and brightness |
| `~/kiosk/kiosk-data.conf` | Your repository and file (step 10) |

See what changed before copying one of these, then either copy the new file and make your changes again, or make the new changes by hand in your copy:

```bash
diff /usr/local/bin/screen-dimmer.py ~/kiosk-files/screen-dimmer.py
diff /etc/chromium/policies/managed/kiosk.json ~/kiosk-files/kiosk.json
diff ~/kiosk/kiosk-data.conf ~/kiosk-files/kiosk-data.conf
```

No output means nothing changed. If you added a flag to `start.sh` yourself (for example `--disable-gpu` from Troubleshooting), add it again to the new copy. Restart Chromium afterwards (`pkill -f /usr/lib/chromium/chromium`); after a new `start.sh` or `kiosk.desktop`, reboot instead. Restart the dimmer if you updated it (`sudo systemctl daemon-reload && sudo systemctl restart screen-dimmer`).

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
| The desktop appears but Chromium doesn't | Wait a full minute first. Then check `kiosk.log`, and that `~/.config/autostart/kiosk.desktop` exists and names your home folder (`cat` it; `@HOME@` means the `sed` in step 7 didn't run). If Chromium isn't running, make sure `start.sh` uses `/usr/lib/chromium/chromium`; `/usr/bin/chromium` waits on a hidden low-memory warning. |
| Black or flickering browser window, but Chromium is running | Add `--disable-gpu` as a new line inside the `FLAGS=( … )` list in `start.sh`, then reboot. |
| Chromium is in a small window | Someone un-maximised it. Close it with its **×**; `start.sh` opens it again maximised. |
| No keyboard button on the taskbar | **Raspberry Pi menu → Preferences → Control Centre** (or *Raspberry Pi Configuration*) **→ Display → On-screen Keyboard → Enabled always**. In Live View's full screen the taskbar is hidden: leave full screen first. |
| The screen goes black after a few minutes, with the dimmer off | The desktop's screen blanking is on. Switch it off as in [step 8](#keep-the-screen-on). |
| Screen dims or switches off while someone is there | Lengthen `DIM_AFTER` in step 9.4, or check the sensor's aim. If it's out of the way of the room, it can't see people. |
| Screen never dims | Something keeps triggering the sensor, often heat from a hob, radiator or sunny window. Watch it with the test command in step 9.2, then re-aim it. Check the service is running with `systemctl status screen-dimmer`. |
| Screen-dimmer says "No backlight found" | The display isn't detected; check the ribbon cable and power lead. |
| No Recipes folder or Home button | The settings file has a mistake. Run `python3 -m json.tool /etc/chromium/policies/managed/kiosk.json` and fix the line it reports. |
| A mouse pointer is visible | With no mouse plugged in, install the rule in [step 8](#no-mouse-pointer). If the pointer is still there, run that step's first command to see which device still counts as a mouse, and put its name (without the quotes) in place of `vc4*` in `/etc/udev/rules.d/99-kiosk-no-pointer.rules`, then reboot. A plugged-in mouse always shows a pointer. |
| "Restore pages?" bar after a power cut | `start.sh` handles this. If it still appears, delete `~/kiosk/profile` and reboot. |
| Slow, or tabs reload when you switch | Memory is tight, and the desktop uses some of it. Close tabs you're done with, and use recipe "print" pages. |
| Step 10: the planner shows an old copy or the starting workspace | Run `~/kiosk/kiosk-data.sh; echo $?` and read the message, and see `~/kiosk/kiosk-data.log`. `Permission denied (publickey)`: the deploy key isn't on that repository, or `REPO` is wrong. `is not in the repository`: check `FILE` and `BRANCH`. `not an encrypted file`: save it with **Encrypted** on. |
| Step 10: the planner says the kiosk's password does not open the new file | The file was saved with a different password. Save it again with the kiosk password and push, or store the new password as in 10.4. |
| Step 10: the planner asks *Import* questions | The kiosk's copy has unsaved changes made on the touchscreen, so it won't be overwritten silently. Tap **Import** and replace it, or clear browser memory in Settings → Data. |
| Step 10: the timer isn't running | `systemctl list-timers 'kiosk-data*'` should list it; `systemctl status "kiosk-data@$USER"` shows the last check. |
| Need a terminal on the Pi | Use SSH from your computer (step 2). |

### Seeing inside Chromium (advanced)

1. Add `--remote-debugging-port=9222` as a new line inside `FLAGS=( … )` in `start.sh`, then reboot.
2. On your computer, run `ssh -L 9222:localhost:9222 yourname@kiosk.local` and leave it open.
3. In Chrome on your computer, open `chrome://inspect`, click **Configure…** and add `localhost:9222`. The kiosk's tabs appear under *Remote Target*. Click **inspect** to see errors.
4. Remove the flag when you're done.
