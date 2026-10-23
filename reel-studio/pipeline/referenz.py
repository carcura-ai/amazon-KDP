#!/usr/bin/env python3
"""Referenz-Reel analysieren: Schnitttempo, Hook, gesprochener Text, Bildschirm-Texte (per Kontaktbogen), Lautheit.

Aufruf: python3 -I pipeline/referenz.py <url>    (Instagram, TikTok, YouTube Shorts)
Ergebnis: referenzen/<id>/bericht.txt + kontakt.jpg (nur lokal, fremde Inhalte nicht committen)
"""
import html, json, re, subprocess, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import ff, probe  # noqa: E402

url = sys.argv[1]
rid = re.sub(r"\W+", "_", url.rstrip("/").split("/")[-1].split("?")[0])[:40]
out = ROOT / "referenzen" / rid
out.mkdir(parents=True, exist_ok=True)
video, caption = out / "video.mp4", ""

if "instagram.com" in url:  # oeffentlicher Embed-Endpunkt, funktioniert ohne Login
    code = re.search(r"/(?:reel|p)/([^/?]+)", url).group(1)
    req = urllib.request.Request(f"https://www.instagram.com/p/{code}/embed/captioned/",
                                 headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"})
    page = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")
    src = re.search(r'video_url\\":\\"([^"]+?)\\"', page).group(1)
    src = src.replace("\\\\/", "/").replace("\\/", "/").replace("\\\\u0025", "%").replace("\\u0025", "%")
    video.write_bytes(urllib.request.urlopen(urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0"}), timeout=120).read())
    m = re.search(r'class="Caption"(.*?)</div>', page, re.S)
    caption = html.unescape(re.sub(r"<[^>]+>", "", re.sub(r"<br ?/?>", "\n", m.group(1)))) if m else ""
else:
    subprocess.run([sys.executable, "-m", "yt_dlp", "-q", "-f", "mp4/best", "-o", str(video), url], check=True)

meta = probe(video)
dur = meta["duration"]
cuts = [float(x) for x in re.findall(r"pts_time:([\d.]+)", ff("-i", str(video), "-vf", "select='gt(scene,0.25)',showinfo", "-f", "null", "-"))]
lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", ff("-i", str(video), "-af", "ebur128", "-f", "null", "-"))
fps = min(2.0, 40 / dur)
ff("-i", str(video), "-vf", f"fps={fps:.3f},scale=160:-1,tile=8x{int(dur * fps / 8) + 1}:padding=3", "-frames:v", "1", str(out / "kontakt.jpg"))

words = []
if meta["audio"]:
    from faster_whisper import WhisperModel
    from analyze import transcribe
    words = transcribe(WhisperModel("large-v3-turbo", device="cpu", compute_type="int8"), video)

shots = [b - a for a, b in zip([0.0] + cuts, cuts + [dur])]
hook = " ".join(w["w"] for w in words if w["s"] < 3.0)
report = f"""Referenz: {url}
Laenge {dur:.1f}s · {meta['width']}x{meta['height']} · {meta['fps']} fps · Lautheit {lufs[-1] if lufs else '?'} LUFS
Schnitte: {len(cuts)} ({len(cuts) / dur:.2f} pro Sekunde) · Einstellungslaenge Ø {sum(shots) / len(shots):.1f}s, kuerzeste {min(shots):.1f}s
Erster Schnitt bei {cuts[0] if cuts else '-'}s · Schnittzeiten: {[round(c, 1) for c in cuts]}
Sprechtempo: {len(words) / dur * 60:.0f} Woerter/Minute
Hook (0–3 s): {hook or '(keine Sprache)'}
Text gesamt: {' '.join(w['w'] for w in words)}
Beschreibung: {caption.strip()[:800]}
Kontaktbogen: kontakt.jpg ({fps:.2f} Bilder/s) – Effekte, Texte, Uebergaenge visuell pruefen
"""
(out / "bericht.txt").write_text(report, encoding="utf-8")
print(report)
