#!/usr/bin/env python3
"""Rohmaterial-Analyse und Medienaufbereitung fuer ein Reel-Projekt.

Aufruf:  python3 -I pipeline/analyze.py projekte/<name> [--no-cut] [--model large-v3-turbo]

Eingang (projekte/<name>/):
  raw/     Videoclips: Sprecher im Bild (A-Roll) und Arbeits-/Fremdaufnahmen (B-Roll)
  voice/   Sprachaufnahmen fuer Voiceover (Audio- oder Videodateien, genutzt wird nur der Ton)
Ausgang:
  remotion/public/projekte/<name>/  aufbereitete Medien: HDR -> SDR, max. 2560 px, Stimme veredelt
  analysis/blocks.json      Bausteine: A1.. (Sprecher), V1.. (Voiceover), B1.. (B-Roll)
  analysis/auto_edit.json   Standardschnitt ohne Zeitleiste: alle A-Bausteine hintereinander
  analysis/transcript.txt   Uebersicht zum Gegenlesen und Planen
  analysis/uebersicht-*.jpg Kontaktbogen: 5 Bilder je Clip, beschriftet mit ID
"""
import argparse, json, re, subprocess, wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GLOSSAR = json.loads((HERE / "glossar.json").read_text(encoding="utf-8"))
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm"}
AUDIO_EXT = {".wav", ".m4a", ".mp3", ".aac", ".flac", ".ogg"}
PUNCT = ".,!?;:"
HDR = {"smpte2084", "arib-std-b67"}
TONEMAP = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,"
           "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
# Stimmveredelung: Trittschall raus, leichte Entrauschung, Kompressor, Praesenz, Lautheit
VOICE = ("highpass=f=80,afftdn=nr=10:nf=-40,acompressor=threshold=-20dB:ratio=3:attack=5:release=100:makeup=2,"
         "equalizer=f=3500:t=q:w=1.2:g=2,loudnorm=I=-16:TP=-2:LRA=9")


def ff(*args):
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-y", *args], capture_output=True, text=True).stderr


def probe(f):
    data = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(f)],
                                     capture_output=True, text=True).stdout)
    v = next((s for s in data["streams"] if s["codec_type"] == "video" and s.get("disposition", {}).get("attached_pic") != 1), None)
    w, h, fps = (v["width"], v["height"], v.get("avg_frame_rate", "0/1")) if v else (0, 0, "0/1")
    rot = next((abs(int(sd.get("rotation", 0))) for sd in (v or {}).get("side_data_list", []) if "rotation" in sd), 0)
    if rot in (90, 270):
        w, h = h, w
    n, d = (int(x) for x in fps.split("/"))
    return {"duration": float(data["format"]["duration"]), "width": w, "height": h, "fps": round(n / d, 2) if d else 0,
            "video": v is not None, "audio": any(s["codec_type"] == "audio" for s in data["streams"]),
            "hdr": bool(v and v.get("color_transfer") in HDR)}


def transcribe(model, f):
    wav = f.with_suffix(".asr.wav")
    ff("-i", str(f), "-vn", "-ac", "1", "-ar", "16000", str(wav))
    w = wave.open(str(wav))
    audio = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    wav.unlink()
    segs, _ = model.transcribe(audio, language="de", word_timestamps=True, vad_filter=True, initial_prompt=GLOSSAR["prompt"])
    return correct([{"w": x.word.strip(), "s": round(x.start, 2), "e": round(x.end, 2)} for s in segs for x in s.words])


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


def prep_video(src, dst, meta, speech):
    """Einheitliches H.264-Material: SDR, max. 2560 px (Zoom-Reserve fuer 1080x1920), Ton je nach Rolle."""
    if dst.exists() and dst.stat().st_mtime > src.stat().st_mtime:
        return
    vf = [TONEMAP] if meta["hdr"] else []
    if max(meta["width"], meta["height"]) > 2560:
        vf.append("scale='if(gt(iw,ih),2560,-2)':'if(gt(iw,ih),-2,2560)'")
    audio = (["-af", VOICE, "-c:a", "aac", "-b:a", "192k", "-ar", "48000"] if speech
             else ["-c:a", "aac", "-b:a", "160k", "-ar", "48000"] if meta["audio"] else ["-an"])
    ff("-i", str(src), *(["-vf", ",".join(vf)] if vf else []), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
       "-pix_fmt", "yuv420p", *audio, "-movflags", "+faststart", str(dst))


def prep_voice(src, dst):
    if not (dst.exists() and dst.stat().st_mtime > src.stat().st_mtime):
        ff("-i", str(src), "-vn", "-ac", "1", "-ar", "48000", "-af", VOICE, str(dst))


def silences_scenes(f, meta):
    scenes = [round(float(x), 2) for x in re.findall(r"pts_time:([\d.]+)", ff("-i", str(f), "-vf", "select='gt(scene,0.2)',showinfo", "-f", "null", "-"))] if meta["video"] else []
    vals = re.findall(r"I:\s+(-?[\d.]+) LUFS", ff("-i", str(f), "-af", "ebur128", "-f", "null", "-")) if meta["audio"] else []
    return scenes, (float(vals[-1]) if vals else None)


def speech_blocks(words, dur, cut, max_gap=0.45, pre=0.10, post=0.15):
    """Sprechpassagen; Pausen > max_gap und Fuellwoerter werden herausgeschnitten."""
    if not cut:
        return [{"s": 0.0, "e": dur, "words": words}]
    fill = set(GLOSSAR["fueller"])
    blocks = []
    for w in (w for w in words if w["w"].strip(PUNCT).lower() not in fill):
        if blocks and w["s"] - blocks[-1]["e"] <= max_gap:
            blocks[-1]["e"] = w["e"]; blocks[-1]["words"].append(w)
        else:
            blocks.append({"s": w["s"], "e": w["e"], "words": [w]})
    for b in blocks:
        b["s"], b["e"] = round(max(0.0, b["s"] - pre), 3), round(min(dur, b["e"] + post), 3)
    return blocks


def overview(rows, out):
    """Kontaktbogen: je Clip eine Zeile mit 5 Bildern und ID; 8 Zeilen pro Seite."""
    tmp = []
    for i, (cid, f, meta) in enumerate(rows):
        row = out / f"_row{i}.jpg"
        label = f"{cid}  {f.name}  {meta['duration']:.1f}s  {meta['fps']:g}fps".replace(":", " ")
        ff("-i", str(f), "-vf", f"fps=5/{max(meta['duration'], 0.5):.2f},scale=200:356:force_original_aspect_ratio=decrease,"
           f"pad=200:356:(ow-iw)/2:(oh-ih)/2,tile=5x1:padding=4,pad=iw:ih+44:0:44,"
           f"drawtext=text='{label}':fontcolor=white:fontsize=26:x=8:y=9", "-frames:v", "1", str(row))
        tmp.append(row)
    for p in range(0, len(tmp), 8):
        page = [r for r in tmp[p:p + 8] if r.exists()]
        if page:
            args = sum((["-i", str(r)] for r in page), [])
            ff(*args, "-filter_complex", f"vstack=inputs={len(page)}" if len(page) > 1 else "null", str(out / f"uebersicht-{p // 8 + 1}.jpg"))
    for r in tmp:
        r.unlink(missing_ok=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("projekt")
    ap.add_argument("--no-cut", action="store_true", help="Sprecherclips nicht kuerzen (Material ist bereits geschnitten)")
    ap.add_argument("--model", default="large-v3-turbo")
    args = ap.parse_args()

    proj = Path(args.projekt).resolve()
    out = proj / "analysis"; out.mkdir(exist_ok=True)
    pub = ROOT / "remotion" / "public" / "projekte" / proj.name; pub.mkdir(parents=True, exist_ok=True)
    rel = f"projekte/{proj.name}"
    files = lambda d, ext: sorted(p for p in (proj / d).glob("*") if p.suffix.lower() in ext) if (proj / d).exists() else []

    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    blocks, broll, info, rows, lines = {}, {}, {}, [], {"A": [], "V": [], "B": []}
    for f in files("raw", VIDEO_EXT):
        meta = probe(f)
        words = transcribe(model, f) if meta["audio"] else []
        coverage = sum(w["e"] - w["s"] for w in words) / max(meta["duration"], 0.1)
        kind = "aroll" if coverage >= 0.25 else "broll"  # wenig Sprache = Atmo/Halluzination -> B-Roll
        dst = pub / (f.stem + ".mp4")
        prep_video(f, dst, meta, speech=kind == "aroll")
        scenes, lufs = silences_scenes(dst, meta)
        info[f.name] = {**meta, "kind": kind, "scenes": scenes, "lufs": lufs}
        if kind == "broll":
            cid = f"B{len(broll) + 1}"
            broll[cid] = {"src": f"{rel}/{dst.name}", "duration": meta["duration"], "fps": meta["fps"], "scenes": scenes}
            lines["B"].append(f"{cid:4} {f.name}  {meta['duration']:.1f}s  {meta['fps']:g}fps  {meta['width']}x{meta['height']}  Schnitte {scenes}")
            rows.append((cid, dst, meta))
            continue
        first = None
        for b in speech_blocks(words, meta["duration"], not args.no_cut):
            cid = f"A{sum(k[0] == 'A' for k in blocks) + 1}"; first = first or cid
            blocks[cid] = {"src": f"{rel}/{dst.name}", "from": b["s"], "to": b["e"], "kind": "aroll", "words": b["words"]}
            lines["A"].append(f"{cid:4} {f.name}  {b['s']:.2f}-{b['e']:.2f} ({b['e'] - b['s']:.1f}s)  " + " ".join(w["w"] for w in b["words"]))
        rows.append((first or "A?", dst, meta))

    for f in files("voice", VIDEO_EXT | AUDIO_EXT):
        dst = pub / (f.stem + ".wav")
        prep_voice(f, dst)
        meta = probe(dst)
        for b in speech_blocks(transcribe(model, dst), meta["duration"], True):
            cid = f"V{sum(k[0] == 'V' for k in blocks) + 1}"
            blocks[cid] = {"src": f"{rel}/{dst.name}", "from": b["s"], "to": b["e"], "kind": "voice", "words": b["words"]}
            lines["V"].append(f"{cid:4} {f.name}  {b['s']:.2f}-{b['e']:.2f} ({b['e'] - b['s']:.1f}s)  " + " ".join(w["w"] for w in b["words"]))

    overview(rows, out)
    (out / "blocks.json").write_text(json.dumps({"blocks": blocks, "broll": broll, "files": info}, ensure_ascii=False, indent=1), encoding="utf-8")
    clips, words, t = [], [], 0.0
    for b in (b for b in blocks.values() if b["kind"] == "aroll"):
        clips.append({"src": b["src"], "from": b["from"], "to": b["to"]})
        words += [{"w": w["w"], "s": round(t + w["s"] - b["from"], 2), "e": round(t + w["e"] - b["from"], 2)} for w in b["words"]]
        t += b["to"] - b["from"]
    (out / "auto_edit.json").write_text(json.dumps({"clips": clips, "words": words}, ensure_ascii=False, indent=1), encoding="utf-8")
    txt = "\n".join(["A-ROLL (Sprecher im Bild)", *lines["A"], "", "VOICEOVER", *lines["V"], "", "B-ROLL", *lines["B"],
                     "", f"A-Roll gesamt: {t:.1f}s · Kontaktbogen: analysis/uebersicht-*.jpg"])
    (out / "transcript.txt").write_text(txt + "\n", encoding="utf-8")
    print(txt)


if __name__ == "__main__":
    main()
