"""Checks a workspace file before it goes into the private repository as the kiosk's payload.

    python3 -I payload.py <file> <planner address>

Exit 0 and one line of sizes when it is fine; exit 1 and the reason otherwise. It prints only
sizes and dates, never the file's contents, and it cannot check the password (it doesn't know it).
"""
import datetime
import json
import os
import sys

MAX = 120000  # as kiosk-data.sh: Linux allows one command-line argument of at most 128 KiB

path, app = sys.argv[1], sys.argv[2]
try:
    with open(path, encoding="utf-8") as f:
        j = json.load(f)
except (OSError, ValueError) as e:
    sys.exit(f"refused: not a JSON file ({e.__class__.__name__})")
if not isinstance(j, dict) or j.get("format") != "weekly-schedules-encrypted" or not isinstance(j.get("data"), str):
    plain = isinstance(j, dict) and "events" in j
    sys.exit("refused: " + ("an UNENCRYPTED workspace; save it again with Encrypted on and the kiosk password"
                            if plain else "not an encrypted file saved from the planner (Save... -> JSON file, Encrypted)"))
# the address kiosk-data.sh builds: <app>#data=e1.<data>&pw=<password>&layout=phone (password and layout: about 100)
size = len(app.split("#")[0]) + len("#data=e1.") + len(j["data"]) + 100
if size > MAX:
    sys.exit(f"refused: too big for the kiosk address (about {size} characters, at most {MAX}); "
             "save only the schedules the kiosk needs (What to include -> Choose...)")
when = datetime.datetime.fromtimestamp(os.path.getmtime(path)).strftime("%Y-%m-%d %H:%M")
print(f"ok: encrypted, saved {when}, address about {size} of {MAX} characters")
