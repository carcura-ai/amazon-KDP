#!/usr/bin/env python3
"""Baut den Abo-Kalender „Carcura Erinnerungen“ aus termine.json (Apple Kalender, Abo per Link).
Aufruf: python3 build_ics.py  -> carcura-erinnerungen.ics. Hochladen und Weiterleitung: LIESMICH.md"""
import json, os
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
esc = lambda s: s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def fold(line):
    b, out = line.encode(), []
    while len(b) > 74:
        cut = 74
        while (b[cut] & 0xC0) == 0x80:
            cut -= 1
        out.append(b[:cut].decode()); b = b" " + b[cut:]
    out.append(b.decode())
    return "\r\n".join(out)


stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Carcura//Erinnerungen//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
     "X-WR-CALNAME:Carcura Erinnerungen", "X-WR-TIMEZONE:Europe/Berlin", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
     "BEGIN:VTIMEZONE", "TZID:Europe/Berlin",
     "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
     "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
     "END:VTIMEZONE"]
for t in json.load(open(os.path.join(HERE, "termine.json"), encoding="utf8")):
    s = datetime.fromisoformat(t["start"]); e = s + timedelta(minutes=t.get("minuten", 15))
    L += ["BEGIN:VEVENT", f"UID:{t['uid']}@carcura.info", f"DTSTAMP:{stamp}",
          f"DTSTART;TZID=Europe/Berlin:{s:%Y%m%dT%H%M%S}", f"DTEND;TZID=Europe/Berlin:{e:%Y%m%dT%H%M%S}",
          f"SUMMARY:{esc(t['titel'])}", f"DESCRIPTION:{esc(t['text'])}",
          "BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{esc(t['titel'])}", "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"]
L.append("END:VCALENDAR")
open(os.path.join(HERE, "carcura-erinnerungen.ics"), "w", encoding="utf8", newline="").write("\r\n".join(fold(x) for x in L) + "\r\n")
print("ok", sum(1 for x in L if x == "BEGIN:VEVENT"), "Termine")
