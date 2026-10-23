#!/usr/bin/env python3
"""Videoarchiv sichten: Herkunft, Datum, Technik, Sprache, Schnitttempo, Kontaktboegen.

Aufruf: python3 -I pipeline/sichten.py <ordner> [--model large-v3-turbo]
Ergebnis in <ordner>/../sichtung/: sichtung.json, sichtung.md, seite-*.jpg (6 Videos pro Seite, 8 Bilder je Video)
"""
import argparse, json, re, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import ff, transcribe  # noqa: E402

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".3gp"}


def probe(f):
    d = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(f)],
                                  capture_output=True, text=True).stdout or "{}")
    v = next((s for s in d.get("streams", []) if s["codec_type"] == "video"), {})
    a = next((s for s in d.get("streams", []) if s["codec_type"] == "audio"), None)
    tags = {k.lower(): str(val) for k, val in {**d.get("format", {}).get("tags", {}), **v.get("tags", {})}.items()}
    rot = next((abs(int(sd.get("rotation", 0))) for sd in v.get("side_data_list", []) if "rotation" in sd), 0)
    w, h = v.get("width", 0), v.get("height", 0)
    if rot in (90, 270):
        w, h = h, w
    n, dd = (int(x) for x in (v.get("avg_frame_rate") or "0/1").split("/"))
    make = tags.get("com.apple.quicktime.make") or tags.get("make") or ""
    model = tags.get("com.apple.quicktime.model") or tags.get("model") or ""
    enc = " ".join(filter(None, [tags.get("encoder"), tags.get("handler_name"), tags.get("com.apple.quicktime.software")]))
    # Nur Hersteller/Modell belegt ein Kamera-Original; alles andere wird visuell geprueft
    if make:
        origin = f"Kamera-Original {make} {model}".strip()
    elif re.search(r"capcut|lavf|videoleap|inshot|premiere|davinci|resolve", enc, re.I):
        origin = "Export Schnittprogramm"
    elif (w, h) == (720, 1280):
        origin = "720p-Export/Social-Download"
    else:
        origin = "iOS-Datei ohne Kameradaten" if "core media" in enc.lower() else "unklar"
    date = tags.get("com.apple.quicktime.creationdate") or tags.get("creation_time") or ""
    return {"duration": float(d.get("format", {}).get("duration", 0)), "width": w, "height": h,
            "fps": round(n / dd, 2) if dd else 0, "codec": v.get("codec_name"), "hdr": v.get("color_transfer") in ("smpte2084", "arib-std-b67"),
            "mb": round(int(d.get("format", {}).get("size", 0)) / 1e6, 1), "audio": a is not None, "origin": origin, "date": date[:19]}


def measure(f, dur):
    log = ff("-i", str(f), "-vf", "fps=1,scale=360:-2,signalstats,blurdetect=block_width=32:block_height=32,metadata=print", "-an", "-f", "null", "-")
    y = [float(x) for x in re.findall(r"signalstats\.YAVG=([\d.]+)", log)]
    b = [float(x) for x in re.findall(r"lavfi\.blur=([\d.]+)", log)]
    cuts = [round(float(x), 1) for x in re.findall(r"pts_time:([\d.]+)", ff("-i", str(f), "-vf", "select='gt(scene,0.25)',showinfo", "-an", "-f", "null", "-"))]
    au = ff("-i", str(f), "-af", "ebur128=peak=true", "-vn", "-f", "null", "-")
    lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", au)
    peak = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", au)
    return {"helligkeit": round(sum(y) / len(y)) if y else None, "unschaerfe": round(sum(b) / len(b), 1) if b else None,
            "schnitte": len(cuts), "schnitte_pro_s": round(len(cuts) / max(dur, 0.1), 2), "schnittzeiten": cuts[:40],
            "lufs": float(lufs[-1]) if lufs else None, "peak": float(peak[-1]) if peak else None}


def sheet_rows(items, out):
    rows = []
    for i, it in enumerate(items):
        row = out / f"_r{i}.jpg"
        label = f"#{it['nr']}  {it['datei'][:38]}  {it['duration']:.0f}s  {it['date'][:10]}".replace(":", " ").replace("'", "")
        ff("-i", str(it["pfad"]), "-vf", f"fps=8/{max(it['duration'], 1):.2f},scale=170:302:force_original_aspect_ratio=decrease,"
           "setsar=1,pad=174:306:(ow-iw)/2:(oh-ih)/2,tile=8x1:padding=4,pad=iw:ih+40:0:40,"
           f"drawtext=text='{label}':fontcolor=white:fontsize=24:x=8:y=8", "-frames:v", "1", "-an", str(row))
        rows.append(row)
    for p in range(0, len(rows), 6):
        page = [r for r in rows[p:p + 6] if r.exists()]
        if page:
            ff(*sum((["-i", str(r)] for r in page), []), "-filter_complex",
               f"vstack=inputs={len(page)}" if len(page) > 1 else "null", "-q:v", "4", str(out / f"seite-{p // 6 + 1:02}.jpg"))
    for r in rows:
        r.unlink(missing_ok=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ordner")
    ap.add_argument("--model", default="large-v3-turbo")
    args = ap.parse_args()
    src = Path(args.ordner).resolve()
    out = src.parent / "sichtung"; out.mkdir(exist_ok=True)
    files = [p for p in src.rglob("*") if p.suffix.lower() in VIDEO_EXT]

    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    items = []
    for f in files:
        meta = probe(f)
        words = transcribe(model, f) if meta["audio"] else []
        speech = sum(w["e"] - w["s"] for w in words)
        items.append({"datei": str(f.relative_to(src)), "pfad": str(f), **meta, **measure(f, meta["duration"]),
                      "sprache_anteil": round(speech / max(meta["duration"], 0.1), 2), "text": " ".join(w["w"] for w in words)})
        print(f"ok {f.name}", flush=True)
    items.sort(key=lambda x: (x["date"] or "9999", x["datei"]))
    for i, it in enumerate(items, 1):
        it["nr"] = i
    sheet_rows(items, out)
    (out / "sichtung.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    md = ["| # | Datei | Datum | Dauer | Format | fps | Herkunft | Hell. | Unsch. | Schnitte/s | LUFS | Peak | Sprache |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    md += [f"| {it['nr']} | {it['datei'][:40]} | {it['date'][:10]} | {it['duration']:.0f}s | {it['width']}x{it['height']}{' HDR' if it['hdr'] else ''} | "
           f"{it['fps']:g} | {it['origin'][:30]} | {it['helligkeit']} | {it['unschaerfe']} | {it['schnitte_pro_s']} | {it['lufs']} | {it['peak']} | {int(it['sprache_anteil'] * 100)}% |"
           for it in items]
    md += ["", "## Gesprochener Text", ""] + [f"**#{it['nr']} {it['datei']}:** {it['text'] or '(keine Sprache)'}" for it in items]
    (out / "sichtung.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"{len(items)} Videos, {sum(i['duration'] for i in items) / 60:.1f} min -> {out}")


if __name__ == "__main__":
    main()
