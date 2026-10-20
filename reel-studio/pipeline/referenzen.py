#!/usr/bin/env python3
"""Mehrere Instagram-Referenz-Reels laden: Video + Kennzahlen (Aufrufe, Likes, Kommentare, Dauer, Musik, Beschreibung).

Aufruf: python3 -I pipeline/referenzen.py <ordner> <url1> <url2> ...
Ergebnis: <ordner>/raw/NN_account_code.mp4, <ordner>/kennzahlen.json, <ordner>/kennzahlen.md
Danach: python3 -I pipeline/sichten.py <ordner>/raw  (Schnitttempo, Texte, Kontaktboegen)
Fremde Inhalte nur zur Analyse – nicht weiterverwenden oder committen.
"""
import html, json, re, sys, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"}


def fetch(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read()
        except Exception as e:  # 429/Netz: warten und erneut versuchen
            if k == tries - 1:
                raise
            print(f"  Wiederholung nach Fehler: {e}", flush=True)
            time.sleep(10 * (k + 1))


def num(page, pattern):
    m = re.search(pattern, page)
    return int(m.group(1)) if m else None


def txt(page, key):
    m = re.search(rf'\\"{key}\\":\\"(.*?)\\"', page)
    return json.loads(f'"{m.group(1)}"') if m else ""


def main():
    out = Path(sys.argv[1]).resolve()
    (out / "raw").mkdir(parents=True, exist_ok=True)
    rows = []
    for nr, url in enumerate(sys.argv[2:], 1):
        code = re.search(r"/(?:reel|p)/([^/?]+)", url).group(1)
        try:
            page = fetch(f"https://www.instagram.com/p/{code}/embed/captioned/").decode("utf-8", "ignore")
            user = re.search(r'class="UsernameText">([^<]+)<', page)
            cap = re.search(r'class="Caption"(.*?)</div>', page, re.S)
            ts = num(page, r'\\"taken_at_timestamp\\":(\d+)')
            row = {
                "nr": nr, "code": code, "url": f"https://www.instagram.com/reel/{code}/",
                "account": user.group(1) if user else "?",
                "follower": num(page, r'\\"edge_followed_by\\":\{\\"count\\":(\d+)'),
                "aufrufe": num(page, r'\\"video_view_count\\":(\d+)'),
                "likes": num(page, r'\\"edge_liked_by\\":\{\\"count\\":(\d+)'),
                "kommentare": num(page, r'\\"edge_media_to_comment\\":\{\\"count\\":(\d+)'),
                "dauer": float(m.group(1)) if (m := re.search(r'\\"video_duration\\":([\d.]+)', page)) else None,
                "datum": datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d") if ts else "",
                "musik": f"{txt(page, 'artist_name')} – {txt(page, 'song_name')}".strip(" –"),
                "beschreibung": html.unescape(re.sub(r"<[^>]+>", "", re.sub(r"<br ?/?>", "\n", cap.group(1)))).strip()[:600] if cap else "",
            }
            src = re.search(r'video_url\\":\\"([^"]+?)\\"', page)
            if src:
                v = src.group(1).replace("\\\\/", "/").replace("\\/", "/").replace("\\\\u0025", "%").replace("\\u0025", "%")
                name = f"{nr:02}_{re.sub(r'[^a-z0-9]+', '', row['account'].lower())[:18]}_{code}.mp4"
                (out / "raw" / name).write_bytes(fetch(v))
                row["datei"] = name
            else:
                row["datei"] = None  # z. B. Bildbeitrag oder privat
            print(f"{nr:02} {row['account']}: {row['aufrufe']} Aufrufe, {row['likes']} Likes, {row['dauer']} s", flush=True)
        except Exception as e:
            row = {"nr": nr, "code": code, "url": url, "fehler": str(e)}
            print(f"{nr:02} FEHLER {code}: {e}", flush=True)
        rows.append(row)
        time.sleep(3)

    (out / "kennzahlen.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    md = ["| # | Account | Datum | Dauer | Aufrufe | Likes | Kommentare | Like-Quote | Musik |", "|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        if "fehler" in r:
            md.append(f"| {r['nr']} | FEHLER {r['code']} | | | | | | | |"); continue
        q = f"{r['likes'] / r['aufrufe'] * 100:.1f} %" if r.get("aufrufe") and r.get("likes") else "–"
        md.append(f"| {r['nr']} | {r['account']} | {r['datum']} | {r['dauer'] or '–'} s | {r['aufrufe'] or '–'} | {r['likes'] or '–'} | {r['kommentare'] or '–'} | {q} | {r['musik'][:40]} |")
    md += ["", "## Beschreibungen", ""] + [f"**#{r['nr']} {r.get('account', '')}:** {r.get('beschreibung', '').replace(chr(10), ' ')[:400]}" for r in rows]
    (out / "kennzahlen.md").write_text("\n".join(md) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
