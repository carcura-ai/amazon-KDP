#!/usr/bin/env python3
"""Baut die Abo-Kalender für Apple Kalender (Abo per Link). Hochladen und Weiterleitung: LIESMICH.md
  python3 build_ics.py          -> carcura-erinnerungen.ics  aus termine.json        („Carcura Erinnerungen“, gelb)
  python3 build_ics.py privat   -> privat-erinnerungen.ics   aus termine-privat.json („Privat“, blau)"""
import json, os, sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
KAL = {"carcura": ("termine.json", "Carcura Erinnerungen", "#E8F320", "carcura-erinnerungen.ics"),
       "privat": ("termine-privat.json", "Privat", "#0A84FF", "privat-erinnerungen.ics")}
SRC, NAME, COLOR, OUT = KAL[sys.argv[1] if len(sys.argv) > 1 else "carcura"]
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
     f"X-WR-CALNAME:{NAME}", f"X-APPLE-CALENDAR-COLOR:{COLOR}", "X-WR-TIMEZONE:Europe/Berlin", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
     "BEGIN:VTIMEZONE", "TZID:Europe/Berlin",
     "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
     "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
     "END:VTIMEZONE"]
for t in json.load(open(os.path.join(HERE, SRC), encoding="utf8")):
    L += ["BEGIN:VEVENT", f"UID:{t['uid']}@carcura.info", f"DTSTAMP:{stamp}"]
    if t.get("ganztag"):  # start/ende als JJJJ-MM-TT, ende einschließlich
        s0 = datetime.fromisoformat(t["start"]); e0 = datetime.fromisoformat(t.get("ende", t["start"])) + timedelta(days=1)
        L += [f"DTSTART;VALUE=DATE:{s0:%Y%m%d}", f"DTEND;VALUE=DATE:{e0:%Y%m%d}", "TRANSP:TRANSPARENT"]
    else:
        s0 = datetime.fromisoformat(t["start"]); e0 = s0 + timedelta(minutes=t.get("minuten", 15))
        L += [f"DTSTART;TZID=Europe/Berlin:{s0:%Y%m%dT%H%M%S}", f"DTEND;TZID=Europe/Berlin:{e0:%Y%m%dT%H%M%S}"]
    if t.get("rrule"):  # z. B. FREQ=WEEKLY;BYDAY=MO,TU,WE,TH;UNTIL=20271122T225959Z
        L.append(f"RRULE:{t['rrule']}")
    for x in t.get("exdate", []):  # ausgelassene Termine, gleiche Uhrzeit wie start
        L.append(f"EXDATE;TZID=Europe/Berlin:{datetime.fromisoformat(x):%Y%m%dT%H%M%S}")
    L += [f"SUMMARY:{esc(t['titel'])}"] + ([f"DESCRIPTION:{esc(t['text'])}"] if t.get("text") else [])
    if t.get("alarm", True):
        L += ["BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{esc(t['titel'])}", f"TRIGGER:-PT{int(t.get('erinnern_min', 0))}M", "END:VALARM"]
    L.append("END:VEVENT")
L.append("END:VCALENDAR")
open(os.path.join(HERE, OUT), "w", encoding="utf8", newline="").write("\r\n".join(fold(x) for x in L) + "\r\n")
print(OUT, sum(1 for x in L if x == "BEGIN:VEVENT"), "Termine")
