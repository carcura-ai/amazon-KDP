#!/usr/bin/env python3
"""Rechtlich saubere Bild-Assets holen; jede Quelle wird in projekte/<name>/assets/LIZENZEN.md protokolliert.

  asset.py emoji <Name> <projekt>                 Microsoft Fluent Emoji 3D (MIT), z. B. Sponge, "Racing car", Sparkles
  asset.py suche "<Begriff>"                      Openverse: nur CC0, gemeinfrei (PDM) oder CC BY
  asset.py hole <openverse-id> <projekt>          laden + Quellenangabe (CC BY: Nennung in die Beschreibung!)
  asset.py freistellen <bild|video> <projekt> [--t 3.2] [--name x] [--voll]   Hintergrund entfernen (--voll: Bildgroesse
                                                  behalten, z. B. fuer "textbehind" ueber einem ruhigen Shot)
  asset.py standbild <video> <projekt> --t 3.2 [--name x]   Einzelbild (z. B. Freeze-Frame als {"img": ...})
  asset.py musik "<stimmung>" [--bpm 100-130]     Musikvorschlaege (Kevin MacLeod, CC BY 4.0)
  asset.py musikhole "<Titel>" <projekt>          laden + Beats erkennen + Quellenangabe
  asset.py ccmixter "<tags>"                      Hip-Hop/Trap/Phonk von ccMixter (nur CC BY), z. B. "trap" oder "hip_hop,instrumental"
  asset.py ccmixterhole <id> <projekt>            laden + Beats + Bass-/Gesangsanalyse + Quellenangabe
  asset.py spotify <playlist-link>                Titel/Artists einer oeffentlichen Playlist (nur als Stil-Vorlage!)
Aufruf jeweils mit: python3 -I pipeline/asset.py ...
"""
import argparse, json, re, subprocess, sys, tempfile, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "carcura-reel-studio/1.0"}
FLUENT = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets"
OPENVERSE = "https://api.openverse.org/v1/images/"


def get(url, referer=None):
    headers = {**UA, "Referer": referer} if referer else UA  # ccMixter: Hotlink-Schutz verlangt Referer
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as r:
        return r.read()


def assets_dir(projekt):
    d = Path(projekt).resolve() / "assets"
    d.mkdir(parents=True, exist_ok=True)
    return d


def log(d, datei, quelle, lizenz, urheber, link, nennung):
    f = d / "LIZENZEN.md"
    if not f.exists():
        f.write_text("| Datei | Quelle | Lizenz | Urheber | Link | Nennung noetig |\n|---|---|---|---|---|---|\n", encoding="utf-8")
    with f.open("a", encoding="utf-8") as fh:
        fh.write(f"| {datei} | {quelle} | {lizenz} | {urheber} | {link} | {nennung} |\n")


def emoji(name, projekt):
    d = assets_dir(projekt)
    snake = name.lower().replace(" ", "_").replace("-", "_")
    folder = urllib.parse.quote(name)
    for path in (f"{folder}/3D/{snake}_3d.png", f"{folder}/Default/3D/{snake}_3d_default.png"):
        try:
            data = get(f"{FLUENT}/{path}")
            break
        except Exception:
            data = None
    if not data:
        sys.exit(f"Emoji '{name}' nicht gefunden – exakten englischen Namen verwenden (github.com/microsoft/fluentui-emoji/tree/main/assets)")
    out = d / f"emoji_{snake}.png"
    out.write_bytes(data)
    log(d, out.name, "Microsoft Fluent Emoji", "MIT", "Microsoft", "github.com/microsoft/fluentui-emoji", "nein")
    print(f"assets/{out.name}")


def suche(begriff):
    q = urllib.parse.urlencode({"q": begriff, "license": "cc0,pdm,by", "mature": "false", "page_size": 10})
    for r in json.loads(get(f"{OPENVERSE}?{q}"))["results"]:
        print(f"{r['id']}  {r['license'].upper()} {r.get('license_version') or ''}  {r.get('width')}x{r.get('height')}  "
              f"{(r.get('title') or '')[:50]}  – {r.get('creator') or '?'} ({r.get('source')})")


def hole(oid, projekt):
    d = assets_dir(projekt)
    r = json.loads(get(f"{OPENVERSE}{oid}/"))
    if r["license"] not in ("cc0", "pdm", "by"):
        sys.exit(f"Lizenz {r['license']} nicht zulaessig (nur CC0, PDM, CC BY)")
    ext = Path(urllib.parse.urlparse(r["url"]).path).suffix.lower() or ".jpg"
    out = d / f"ov_{re.sub(r'[^a-z0-9]+', '_', (r.get('title') or oid).lower())[:40]}{ext}"
    out.write_bytes(get(r["url"]))
    nennung = "nein" if r["license"] in ("cc0", "pdm") else f"JA: {r.get('attribution') or r.get('creator')}"
    log(d, out.name, r.get("source"), f"{r['license'].upper()} {r.get('license_version') or ''}", r.get("creator"),
        r.get("foreign_landing_url"), nennung)
    print(f"assets/{out.name}  ({r['license'].upper()}; {nennung})")


STIMMUNG = {  # deutsche Stimmung -> Incompetech-"feel"
    "motivierend": ["Driving", "Uplifting", "Bright"], "energie": ["Driving", "Intense", "Action"],
    "episch": ["Epic", "Intense", "Action"], "spannung": ["Suspenseful", "Dark", "Intense"],
    "dramatisch": ["Dark", "Intense", "Epic"], "entspannt": ["Relaxed", "Calming", "Grooving"],
    "chill": ["Grooving", "Relaxed"], "froehlich": ["Bright", "Bouncy", "Uplifting"],
    "transformation": ["Uplifting", "Epic", "Driving"], "luxus": ["Grooving", "Mysterious", "Relaxed"],
}
MODERN = ("synth", "electronic", "drum machine", "bass", "beat", "electric guitar", "808")


def musik(stimmung, bpm):
    lo, hi = (int(x) for x in bpm.split("-"))
    feels = STIMMUNG.get(stimmung.lower(), [stimmung.title()])
    pieces = json.loads((ROOT / "pipeline" / "daten" / "incompetech.json").read_text(encoding="utf-8"))
    def score(p):
        f, inst = p.get("feel") or "", (p.get("instruments") or "").lower() + " " + (p.get("description") or "").lower()
        m, s_ = re.match(r"(\d+):(\d+):(\d+)", p.get("length") or "0:0:0"), 0
        sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3)) if m else 0
        s_ += 3 * sum(x in f for x in feels) + 2 * any(k in inst for k in MODERN) + (p.get("uploaded", "") > "2015")
        return s_ if lo <= int(p.get("bpm") or 0) <= hi and sec >= 45 else -1
    for p in sorted(pieces, key=score, reverse=True)[:10]:
        print(f"{p['title']} | {p['feel']} | {p['bpm']} bpm | {p['length']} | {(p.get('instruments') or '')[:40]} | {(p.get('description') or '')[:70]}")


def musikhole(titel, projekt):
    import librosa
    p = next(x for x in json.loads((ROOT / "pipeline" / "daten" / "incompetech.json").read_text(encoding="utf-8")) if x["title"].lower() == titel.lower())
    d = Path(projekt).resolve() / "musik"; d.mkdir(parents=True, exist_ok=True)
    out = d / re.sub(r"[^a-z0-9]+", "_", p["title"].lower()).strip("_")
    mp3 = out.with_suffix(".mp3")
    mp3.write_bytes(get("https://incompetech.com/music/royalty-free/mp3-royaltyfree/" + urllib.parse.quote(p["filename"])))
    y, sr = librosa.load(str(mp3), sr=22050, mono=True)
    tempo, frames = librosa.beat.beat_track(y=y, sr=sr)
    beats = [round(float(b), 3) for b in librosa.frames_to_time(frames, sr=sr)]
    rms = librosa.feature.rms(y=y, hop_length=sr)[0]  # Lautheit je Sekunde -> energiereichster 20-s-Abschnitt
    best = max(range(max(1, len(rms) - 20)), key=lambda k: float(rms[k:k + 20].mean()))
    best = min(beats, key=lambda x: abs(x - best)) if beats else float(best)
    out.with_suffix(".beats.json").write_text(json.dumps({"bpm": float(tempo[0] if hasattr(tempo, "__len__") else tempo),
                                                          "bester_start": round(best, 3), "beats": beats}), encoding="utf-8")
    nennung = f'"{p["title"]}" Kevin MacLeod (incompetech.com) – CC BY 4.0'
    log(assets_dir(projekt), f"musik/{mp3.name}", "incompetech.com", "CC BY 4.0", "Kevin MacLeod",
        "creativecommons.org/licenses/by/4.0/", f"JA: {nennung}")
    print(f"musik/{mp3.name}  ({len(beats)} Beats, {beats[1] - beats[0]:.2f}s Abstand, bester Start {best:.1f}s → \"from\") – Nennung: {nennung}")


CCM = "http://ccmixter.org/api/query"


def ccmixter(tags):
    q = urllib.parse.urlencode({"tags": tags, "lic": "by", "f": "json", "limit": 15, "sort": "rank"})
    for r in json.loads(get(f"{CCM}?{q}")):
        t = r.get("upload_tags", "")
        if "acappella" in t:  # reine Gesangsspuren ueberspringen
            continue
        print(f"{r['upload_id']} | {r['upload_name'][:40]} | {r['user_name']} | {(r.get('upload_extra') or {}).get('bpm')} bpm | {r['license_name']}")


def analyse_musik(mp3):
    """BPM, Beats, energiereichster Abschnitt, Bass-Anteil (808) und Gesang (Whisper) – ich kann Musik nicht hoeren, nur messen."""
    import librosa
    import numpy as np
    y, sr = librosa.load(str(mp3), sr=22050, mono=True)
    tempo, frames = librosa.beat.beat_track(y=y, sr=sr)
    beats = [round(float(b), 3) for b in librosa.frames_to_time(frames, sr=sr)]
    rms = librosa.feature.rms(y=y, hop_length=sr)[0]
    best = max(range(max(1, len(rms) - 20)), key=lambda k: float(rms[k:k + 20].mean()))
    best = min(beats, key=lambda x: abs(x - best)) if beats else float(best)
    spec = np.abs(librosa.stft(y[: sr * 60], n_fft=4096))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
    bass = float(spec[freqs < 150].sum() / spec.sum())
    from faster_whisper import WhisperModel
    segs, _ = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8").transcribe(
        y[: sr * 60].astype(np.float32) if sr == 16000 else librosa.resample(y[: sr * 60], orig_sr=sr, target_sr=16000), vad_filter=True)
    gesang = sum(s.end - s.start for s in segs) / 60
    info = {"bpm": float(np.atleast_1d(tempo)[0]), "bester_start": round(best, 3), "bass_anteil": round(bass, 3),
            "gesang_anteil": round(gesang, 2), "beats": beats}
    Path(mp3).with_suffix(".beats.json").write_text(json.dumps(info), encoding="utf-8")
    return info


def ccmixterhole(uid, projekt):
    r = json.loads(get(f"{CCM}?{urllib.parse.urlencode({'ids': uid, 'f': 'json'})}"))[0]
    if "Attribution" not in r["license_name"] or "Noncommercial" in r["license_name"]:
        sys.exit(f"Lizenz {r['license_name']} nicht zulaessig")
    d = Path(projekt).resolve() / "musik"; d.mkdir(parents=True, exist_ok=True)
    mp3 = d / (re.sub(r"[^a-z0-9]+", "_", r["upload_name"].lower()).strip("_")[:40] + ".mp3")
    url = next(f["download_url"] for f in r["files"] if f["download_url"].endswith(".mp3"))
    mp3.write_bytes(get(url, referer=r["file_page_url"]))
    a = analyse_musik(mp3)
    feat = (r.get("upload_extra") or {}).get("featuring")
    nennung = f'"{r["upload_name"]}" by {r["user_name"]}{" ft. " + feat if feat else ""} (ccmixter.org) – {r["license_name"]}'
    log(assets_dir(projekt), f"musik/{mp3.name}", "ccmixter.org", r["license_name"], r["user_name"], r["file_page_url"], f"JA: {nennung}")
    print(f"musik/{mp3.name} | {a['bpm']:.0f} bpm | Bass {a['bass_anteil']:.0%} | Gesang {a['gesang_anteil']:.0%} | bester Start {a['bester_start']:.1f}s | {nennung}")


def spotify(link):
    """Oeffentliche Playlist ueber die Einbettungsseite lesen. Die Songs selbst sind nicht lizenziert – nur Stil-Vorlage."""
    pid = re.search(r"playlist/([A-Za-z0-9]+)", link).group(1)
    page = get(f"https://open.spotify.com/embed/playlist/{pid}").decode("utf-8", "ignore")
    e = json.loads(re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', page, re.S).group(1))
    e = e["props"]["pageProps"]["state"]["data"]["entity"]
    from collections import Counter
    artists = Counter(a.strip() for t in e.get("trackList", []) for a in (t.get("subtitle") or "").split(","))
    print(f"{e.get('name')} – {len(e.get('trackList', []))} Titel\nTop-Artists: " + ", ".join(f"{a} ({n})" for a, n in artists.most_common(15)))
    for t in e.get("trackList", []):
        print(f"  {t.get('title')} – {t.get('subtitle')} ({round(t.get('duration', 0) / 1000)} s)")


def standbild(src, projekt, t, name):
    d = assets_dir(projekt)
    out = d / f"{name or Path(src).stem}_{t:g}s.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", str(out)], check=True)
    log(d, out.name, f"eigenes Material ({Path(src).name} @ {t}s)", "eigene Rechte", "Carcura", "-", "nein")
    print(f"assets/{out.name}")


def freistellen(src, projekt, t, name, voll=False):
    from PIL import Image
    from rembg import new_session, remove
    d = assets_dir(projekt)
    src = Path(src)
    with tempfile.TemporaryDirectory() as tmp:
        img_path = src
        if src.suffix.lower() in (".mp4", ".mov", ".m4v", ".mkv", ".webm"):
            img_path = Path(tmp) / "frame.png"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", str(img_path)], check=True)
        cut = remove(Image.open(img_path).convert("RGBA"), session=new_session("isnet-general-use"))
    alpha = cut.getchannel("A").point(lambda v: 0 if v < 24 else v)  # Rest-Schleier im Hintergrund entfernen
    cut.putalpha(alpha)
    if not voll:  # zugeschnitten fuer Sticker; --voll behaelt Groesse/Position fuer "textbehind"
        cut = cut.crop(cut.getbbox())
        cut.thumbnail((1400, 1400))
    out = d / f"{name or src.stem}_frei.png"
    cut.save(out)
    log(d, out.name, f"eigenes Material ({src.name} @ {t}s)", "eigene Rechte", "Carcura", "-", "nein")
    print(f"assets/{out.name}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("befehl", choices=["emoji", "suche", "hole", "freistellen", "standbild", "musik", "musikhole", "ccmixter", "ccmixterhole", "spotify"])
    ap.add_argument("arg")
    ap.add_argument("projekt", nargs="?")
    ap.add_argument("--t", type=float, default=0.0)
    ap.add_argument("--name")
    ap.add_argument("--voll", action="store_true")
    ap.add_argument("--bpm", default="90-135")
    a = ap.parse_args()
    {"emoji": lambda: emoji(a.arg, a.projekt), "suche": lambda: suche(a.arg), "hole": lambda: hole(a.arg, a.projekt),
     "freistellen": lambda: freistellen(a.arg, a.projekt, a.t, a.name, a.voll), "standbild": lambda: standbild(a.arg, a.projekt, a.t, a.name),
     "musik": lambda: musik(a.arg, a.bpm), "musikhole": lambda: musikhole(a.arg, a.projekt),
     "ccmixter": lambda: ccmixter(a.arg), "ccmixterhole": lambda: ccmixterhole(a.arg, a.projekt), "spotify": lambda: spotify(a.arg)}[a.befehl]()
