#!/usr/bin/env python3
"""Rohvideo-Analyse fuer ein Reel-Projekt.

Aufruf:  python3 -I pipeline/analyze.py projekte/<name> [--no-cut] [--model large-v3-turbo]
Erwartet Videos in projekte/<name>/raw/. Schreibt projekte/<name>/analysis/:
  analysis.json   Metadaten, Woerter, Pausen, Szenenschnitte, Lautheit je Datei
  auto_edit.json  Clips (Sprechpassagen ohne Pausen/Fueller) + Woerter auf der Ausgabe-Zeitachse
  transcript.txt  Transkript mit Zeitmarken zum Gegenlesen
  <datei>.jpg     Kontaktbogen (1 Bild pro Sekunde)
"""
import argparse, json, re, subprocess, wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
GLOSSAR = json.loads((HERE / "glossar.json").read_text(encoding="utf-8"))
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm"}
PUNCT = ".,!?;:"


def ffmpeg_log(*args):
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args], capture_output=True, text=True).stderr


def probe(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "format=duration:stream=codec_type,width,height,r_frame_rate",
                          "-of", "json", str(f)], capture_output=True, text=True).stdout
    data = json.loads(out)
    v = next((s for s in data["streams"] if s["codec_type"] == "video"), {})
    return {"duration": float(data["format"]["duration"]), "width": v.get("width"), "height": v.get("height"),
            "fps": v.get("r_frame_rate"), "audio": any(s["codec_type"] == "audio" for s in data["streams"])}


def transcribe(model, wav):
    w = wave.open(str(wav))
    audio = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    segs, _ = model.transcribe(audio, language="de", word_timestamps=True, vad_filter=True,
                               initial_prompt=GLOSSAR["prompt"])
    return [{"w": x.word.strip(), "s": round(x.start, 2), "e": round(x.end, 2)} for s in segs for x in s.words]


def correct(words):
    for x in words:
        core = x["w"].strip(PUNCT)
        if core in GLOSSAR["ersetzen"]:
            x["w"] = x["w"].replace(core, GLOSSAR["ersetzen"][core])
    for alt, neu in GLOSSAR["phrasen"]:  # gleiche Wortanzahl, Satzzeichen des Originals bleiben erhalten
        a, n = alt.lower().split(), neu.split()
        for i in range(len(words) - len(a) + 1):
            if [w["w"].strip(PUNCT).lower() for w in words[i:i + len(a)]] == a:
                for k, tok in enumerate(n):
                    p = re.search(rf"[{PUNCT}]*$", words[i + k]["w"]).group()
                    words[i + k]["w"] = tok if tok[-1] in PUNCT else tok + p
    return words


def silences(wav):
    log = ffmpeg_log("-i", str(wav), "-af", "silencedetect=noise=-35dB:d=0.35", "-f", "null", "-")
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    return [[round(a, 2), round(b, 2)] for a, b in zip(st, en)]


def scenes(f):
    log = ffmpeg_log("-i", str(f), "-vf", "select='gt(scene,0.2)',showinfo", "-f", "null", "-")
    return [round(float(x), 2) for x in re.findall(r"pts_time:([\d.]+)", log)]


def loudness(f):
    vals = re.findall(r"I:\s+(-?[\d.]+) LUFS", ffmpeg_log("-i", str(f), "-af", "ebur128", "-f", "null", "-"))
    return float(vals[-1]) if vals else None  # letzter Wert = Gesamt-Zusammenfassung


def contact_sheet(f, out, dur):
    fps = min(1.0, 30 / max(dur, 1))
    rows = int(np.ceil(dur * fps / 6))
    ffmpeg_log("-y", "-i", str(f), "-vf", f"fps={fps},scale=180:-1,tile=6x{rows}:padding=4", "-frames:v", "1", str(out))


def speech_blocks(words, dur, max_gap=0.45, pre=0.10, post=0.15):
    """Sprechpassagen: Pausen > max_gap und Fuellwoerter werden herausgeschnitten."""
    fill = set(GLOSSAR["fueller"])
    spoken = [w for w in words if w["w"].strip(PUNCT).lower() not in fill]
    blocks = []
    for w in spoken:
        if blocks and w["s"] - blocks[-1]["e"] <= max_gap:
            blocks[-1]["e"] = w["e"]; blocks[-1]["words"].append(w)
        else:
            blocks.append({"s": w["s"], "e": w["e"], "words": [w]})
    for b in blocks:
        b["s"], b["e"] = max(0.0, b["s"] - pre), min(dur, b["e"] + post)
    return blocks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("projekt")
    ap.add_argument("--no-cut", action="store_true", help="Clips nicht kuerzen (Material ist bereits geschnitten)")
    ap.add_argument("--model", default="large-v3-turbo")
    args = ap.parse_args()

    proj = Path(args.projekt).resolve()
    out = proj / "analysis"; out.mkdir(exist_ok=True)
    files = sorted(p for p in (proj / "raw").iterdir() if p.suffix.lower() in VIDEO_EXT)

    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    report, clips, out_words, lines, t_out = [], [], [], [], 0.0
    for f in files:
        meta = probe(f)
        info = {"file": f.name, **meta, "words": [], "silences": [], "loudness": None}
        if meta["audio"]:
            wav = out / (f.stem + ".wav")
            ffmpeg_log("-y", "-i", str(f), "-ac", "1", "-ar", "16000", str(wav))
            info["words"] = correct(transcribe(model, wav))
            info["silences"] = silences(wav)
            info["loudness"] = loudness(f)
            wav.unlink()
        info["scenes"] = scenes(f)
        contact_sheet(f, out / (f.stem + ".jpg"), meta["duration"])
        report.append(info)

        src = f"projekte/{proj.name}/{f.name}"
        if not info["words"]:
            lines.append(f"## {f.name}  ({meta['duration']:.1f}s)  B-ROLL, kein Ton/keine Sprache")
            continue
        blocks = ([{"s": 0.0, "e": meta["duration"], "words": info["words"]}] if args.no_cut
                  else speech_blocks(info["words"], meta["duration"]))
        lines.append(f"## {f.name}  ({meta['duration']:.1f}s, {info['loudness']} LUFS, Schnitte: {info['scenes']})")
        for b in blocks:
            clips.append({"src": src, "from": round(b["s"], 3), "to": round(b["e"], 3)})
            for w in b["words"]:
                out_words.append({"w": w["w"], "s": round(t_out + w["s"] - b["s"], 2), "e": round(t_out + w["e"] - b["s"], 2)})
            lines.append(f"[{t_out:6.2f}] " + " ".join(w["w"] for w in b["words"]))
            t_out += b["e"] - b["s"]

    (out / "analysis.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "auto_edit.json").write_text(json.dumps({"clips": clips, "words": out_words}, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "transcript.txt").write_text("\n".join(lines) + f"\n\nGesamtlaenge nach Schnitt: {t_out:.2f}s\n", encoding="utf-8")
    print((out / "transcript.txt").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
