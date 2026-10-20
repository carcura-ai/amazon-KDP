#!/usr/bin/env python3
"""Baut aus edit.json + analysis/ die Remotion-Props und eine SRT-Datei (Import in DaVinci Resolve/CapCut).

Aufruf: python3 -I pipeline/props.py projekte/<name>

Zeitleiste in edit.json ("timeline", optional – ohne sie gilt analysis/auto_edit.json):
  {"a": "A1"}                                         Sprecher-Baustein (Bild + Ton)
  {"v": "V1", "b": ["B2", {"id": "B4", "from": 1.5, "rate": 0.5}]}   Voiceover ueber B-Roll
  {"b": [{"id": "B3", "dur": 2.0}], "vol": 0.7}       reine B-Roll mit Originalton (z. B. Schaum-ASMR)
  {"b": [{"img": "assets/foto.jpg", "dur": 2}]}        Standbild (Ken-Burns-Zoom automatisch)
  Optionen je Segment: "tin" (zoom|whip|flash|none), "zoom" [von, bis], "bvol" (B-Roll-Ton unter VO), "pad",
  "schnitt": "hart" (Montage ohne Zwischen-Uebergaenge) | "beat" (Schnitte auf Musik-Beats), bei "a": "von"/"bis"
  B-Roll-Element: {"id", "from", "dur", "rate", "vol", "ramp": true (Speed-Ramp normal -> Zeitlupe -> normal)}
Zeitanker statt Sekunden, ueberall ausser in der Zeitleiste:
  "t:Salz" Wortbeginn · "t:Salz.e" Wortende · "t:Salz#2" 2. Vorkommen · "t:für den Winter" Phrase
  "t:seg3" / "t:seg3.e" Segment 3 · "t:end" Videoende · Versatz: "t:Salz-0.2", "t:end-1.5"
"auto": {"zoom": true, "transitions": true, "sfx": true} erzeugt Zooms, Uebergaenge und Sounds automatisch.
"""
import json, re, subprocess, sys
from pathlib import Path

proj = Path(sys.argv[1]).resolve()
name = proj.name
edit = json.loads((proj / "edit.json").read_text(encoding="utf-8"))
brand_file = Path(__file__).resolve().parent.parent / "brand" / "brand.json"
if brand_file.exists():  # Markenfarben/Handle zentral; edit.json darf einzelne Werte ueberschreiben
    edit["brand"] = {**json.loads(brand_file.read_text(encoding="utf-8")), **edit.get("brand", {})}
ana = proj / "analysis"
fps = edit.get("fps", 30)
PUNCT = ".,!?;:„“\"'"
norm = lambda w: w.strip(PUNCT).lower()
q = lambda x: round(x * fps) / fps  # auf ganze Frames runden -> kein Versatz zwischen Bild und Ton

clips, audio, words, segs = [], [], [], []
t = 0.0
beats = []  # Musik-Beats auf der Ausgabe-Zeitachse (fuer "schnitt": "beat")
if "music" in edit:
    bf = proj / Path(edit["music"]["src"]).with_suffix(".beats.json")
    if bf.exists():
        off = edit["music"].get("from", 0)
        beats = [b - off for b in json.loads(bf.read_text(encoding="utf-8"))["beats"] if b >= off]


def snap(x, lo, hi):
    """Naechster Beat zu x innerhalb [lo, hi], sonst x."""
    cand = [b for b in beats if lo <= b <= hi]
    return min(cand, key=lambda b: abs(b - x)) if cand else x


def add_clip(c, kind, at):
    c.update(kind=kind, at=round(at, 4))
    clips.append(c)


def add_words(ws, src_from, at):
    words.extend({"w": w["w"], "s": round(at + w["s"] - src_from, 3), "e": round(at + w["e"] - src_from, 3)} for w in ws)


if "timeline" in edit:
    data = json.loads((ana / "blocks.json").read_text(encoding="utf-8"))
    B, R = data["blocks"], data["broll"]

    def fill(items, need):
        """Verteilt B-Roll-Clips auf die Laenge need; reicht das Material nicht, wird zyklisch wiederholt."""
        items = [i if isinstance(i, dict) else {"id": i} for i in items]
        avail = lambda i: 1e9 if "img" in i else (R[i["id"]]["duration"] - i.get("from", 0)) / (0.6 if i.get("ramp") else i.get("rate", 1))
        free = need - sum(i.get("dur", 0) for i in items)
        n_free = sum("dur" not in i for i in items)
        plan = [i["dur"] if "dur" in i else max(free, 0) / n_free for i in items] if n_free else [i["dur"] for i in items]
        for _ in range(4):  # Ueberhang zu kurzer Clips auf die anderen verteilen
            over = sum(max(0, p - avail(i)) for i, p in zip(items, plan))
            plan = [min(p, avail(i)) for i, p in zip(items, plan)]
            room = [k for k, i in enumerate(items) if plan[k] < avail(i) - 0.05]
            if over < 0.01 or not room:
                break
            for k in room:
                plan[k] += over / len(room)
        total = sum(plan)
        if total > need + 0.01:
            plan = [p * need / total for p in plan]
        elif total < need - 0.04:
            print(f"Hinweis: B-Roll reicht nicht ({total:.1f}s von {need:.1f}s) – Clips werden wiederholt")
            return list(zip(items, plan)) + fill(items, need - total)
        return list(zip(items, plan))

    def broll_clip(i, d, vol):
        """Ein B-Roll-Stueck; mit "ramp": true als Speed-Ramp normal -> Zeitlupe -> normal (3 Clips)."""
        d = q(d)
        if "img" in i:
            return [{"src": f"projekte/{name}/{i['img']}", "from": 0, "to": d, "img": True, "vol": 0}]
        start, rate, src, v = i.get("from", 0), i.get("rate", 1), R[i["id"]]["src"], i.get("vol", vol)
        if not i.get("ramp"):
            return [{"src": src, "from": start, "to": round(start + d * rate, 4), "rate": rate, "vol": v}]
        out, pos = [], start
        for part, r in ((0.3, 1.0), (0.5, 0.35), (0.2, 1.0)):
            pd = q(d * part)
            out.append({"src": src, "from": round(pos, 4), "to": round(pos + pd * r, 4), "rate": r, "vol": v, "tin": "none"})
            pos += pd * r
        return out

    def place(items_d, vol, fixed_end):
        """Clips setzen; bei Beat-Schnitt Grenzen auf Beats ziehen (Ende nur, wenn nicht durch VO festgelegt)."""
        global t
        bounds, acc = [], t
        for _, d in items_d:
            acc += d; bounds.append(acc)
        if seg.get("schnitt") == "beat" and beats:
            prev = t
            for k, b in enumerate(bounds):
                last = k == len(bounds) - 1
                if last and fixed_end:
                    break
                nb = snap(b, prev + 0.35, b + 0.5 if last else bounds[k + 1] - 0.35)
                bounds[k] = prev = nb
        prev = t
        for (i, _), b in zip(items_d, bounds):
            for c in broll_clip(i, b - prev, vol):
                add_clip(c, "img" if c.get("img") else "b", t)
                t += (c["to"] - c["from"]) / c.get("rate", 1)
            prev = b

    for k, seg in enumerate(edit["timeline"], 1):
        start, first = t, len(clips)
        if "a" in seg:
            b = dict(B[seg["a"]])
            if "von" in seg or "bis" in seg:  # Baustein wortgenau kuerzen
                ws = b["words"]
                i0 = next((k for k, w in enumerate(ws) if norm(w["w"]) == norm(seg["von"])), 0) if "von" in seg else 0
                i1 = next((k for k, w in enumerate(ws) if k >= i0 and norm(w["w"]) == norm(seg["bis"])), len(ws) - 1) if "bis" in seg else len(ws) - 1
                b.update(words=ws[i0:i1 + 1], **{"from": max(b["from"], ws[i0]["s"] - 0.1), "to": min(b["to"], ws[i1]["e"] + 0.2)})
            d = q(b["to"] - b["from"])
            add_clip({"src": b["src"], "from": b["from"], "to": b["from"] + d, "vol": seg.get("vol", 1)}, "a", t)
            add_words(b["words"], b["from"], t)
            t += d
        elif "v" in seg:
            b = B[seg["v"]]
            need = q(b["to"] - b["from"] + seg.get("pad", 0.2))
            audio.append({"src": b["src"], "from": b["from"], "to": b["to"], "at": round(t, 4), "vol": seg.get("vvol", 1)})
            add_words(b["words"], b["from"], t)
            place(fill(seg["b"], need), seg.get("bvol", 0), fixed_end=True)
        else:
            items = [i if isinstance(i, dict) else {"id": i} for i in seg["b"]]
            need = seg.get("dur") or sum(i.get("dur", 2.0) for i in items)
            place(fill(items, need), seg.get("vol", 0), fixed_end="dur" in seg)
        if clips[first:]:
            if seg.get("schnitt") in ("hart", "beat"):  # Montage: harte Schnitte, Uebergang nur am Segmentanfang
                for c in clips[first + 1:]:
                    c["tin"] = "none"
            if "tin" in seg:
                clips[first]["tin"] = seg["tin"]
            if "zoom" in seg:
                for c in clips[first:]:
                    c["zoom"] = seg["zoom"]
        segs.append({"from": round(start, 4), "to": round(t, 4), "kind": "a" if "a" in seg else "v" if "v" in seg else "b"})
else:
    auto_edit = json.loads((ana / "auto_edit.json").read_text(encoding="utf-8"))
    for c in auto_edit["clips"]:
        add_clip(dict(c), "a", t)
        segs.append({"from": round(t, 4), "to": round(t + c["to"] - c["from"], 4), "kind": "a"})
        t += c["to"] - c["from"]
    words = auto_edit["words"]

T = t
ANCHOR = re.compile(r"^t:(.+?)(?:#(\d+))?(\.e)?([+-]\d+(?:\.\d+)?)?$")


def resolve(s):
    key, nth, end, off = ANCHOR.match(s).groups()
    nth, off = int(nth or 1), float(off or 0)
    if key == "end":
        return T + off
    if re.fullmatch(r"seg\d+", key):
        sg = segs[int(key[3:]) - 1]
        return (sg["to"] if end else sg["from"]) + off
    toks = [norm(x) for x in key.split()]
    hits = [i for i in range(len(words) - len(toks) + 1) if [norm(w["w"]) for w in words[i:i + len(toks)]] == toks]
    if len(hits) < nth:
        sys.exit(f"Zeitanker nicht gefunden: {s}")
    i = hits[nth - 1]
    return (words[i + len(toks) - 1]["e"] if end else words[i]["s"]) + off


def walk(x):
    if isinstance(x, dict):
        return {k: walk(v) for k, v in x.items()}
    if isinstance(x, list):
        return [walk(v) for v in x]
    if isinstance(x, str) and x.startswith("t:"):
        return round(resolve(x), 3)
    return x


edit = walk({k: v for k, v in edit.items() if k != "timeline"})
auto = edit.get("auto", {})
overlays = edit.get("overlays", [])
R = json.loads((ana / "blocks.json").read_text(encoding="utf-8"))["broll"] if (ana / "blocks.json").exists() else {}


def media_path(m):
    """Overlay-Medien: B-Roll-ID oder Projektpfad (assets/...) -> Pfad im public-Ordner."""
    if isinstance(m, dict) and "id" in m:
        return {**m, "src": R[m["id"]]["src"]}
    if isinstance(m, dict) and "src" in m and not m["src"].startswith(("projekte/", "brand/")):
        return {**m, "src": f"projekte/{name}/{m['src']}"}
    return m


for o in overlays:
    for key in ("before", "after"):
        if key in o:
            o[key] = media_path(o[key])
    for it in o.get("items", []):
        if isinstance(it, dict) and ("id" in it or "src" in it):
            it.update(media_path(it))
    for key in ("src", "icon"):
        if isinstance(o.get(key), str) and not o[key].startswith(("projekte/", "brand/")):
            o[key] = f"projekte/{name}/{o[key]}"

# Uebergaenge: Sprecher-Jump-Cuts hart (Zoomwechsel reicht), sonst abwechselnd Zoom/Whip
if auto.get("transitions", True):
    styles = ["zoom", "whip"]
    for k, c in enumerate(clips):
        if k and "tin" not in c and not (c["kind"] == "a" and clips[k - 1]["kind"] == "a"):
            c["tin"] = styles[k % 2]

# Zooms: Sprecher je Satz im Wechsel nah/weit, B-Roll langsamer Push/Pull, Standbilder Ken Burns
zooms = list(edit.get("zooms", []))
if auto.get("zoom", True):
    flip = False
    for c in clips:
        a, e = c["at"], c["at"] + (c["to"] - c["from"]) / c.get("rate", 1)
        if "zoom" in c:
            zooms.append({"from": a, "to": e, "scale": c["zoom"]}); continue
        if c["kind"] == "a":
            cuts = [a] + [w["e"] for w in words if a < w["e"] < e - 0.3 and w["w"][-1] in ".!?"] + [e]
            for s0, s1 in zip(cuts, cuts[1:]):
                zooms.append({"from": round(s0, 3), "to": round(s1, 3), "scale": [1.1, 1.13] if flip else [1.0, 1.04]}); flip = not flip
        else:
            sc = [1.0, 1.12] if c["kind"] == "img" else [1.08, 1.02] if flip else [1.0, 1.07]
            zooms.append({"from": round(a, 3), "to": round(e, 3), "scale": sc}); flip = not flip

# Sounddesign-Grundgeruest; manuelle Eintraege in "sfx" haben Vorrang
sfx = list(edit.get("sfx", []))
if auto.get("sfx", True):
    DEFAULT = {"hook": "subdrop", "title": "whoosh", "sticker": "pop", "lowerthird": "whip", "checklist": "pop",
               "price": "pop", "cta": "whoosh", "badge3d": "whoosh", "snow": "shimmer", "compare": "whip",
               "textbehind": "impact", "collage": "whoosh", "chat": None, "letterbox": None}
    extra = [{"at": c["at"], "name": "whip" if c["tin"] == "whip" else "whoosh", "vol": 0.22}
             for c in clips if c.get("tin") in ("zoom", "whip")]
    for o in overlays:
        if o.get("sfx") is False:
            continue
        nm = o["sfx"] if isinstance(o.get("sfx"), str) else DEFAULT.get(o["type"])
        if nm:
            extra.append({"at": o["from"], "name": nm, "vol": 0.45 if nm == "subdrop" else 0.3})
        extra += [{"at": it["at"], "name": "ding", "vol": 0.28} for it in o.get("items", []) if "at" in it]
        extra += [{"at": m["at"], "name": "pop", "vol": 0.3} for m in o.get("messages", [])]
        if o["type"] == "price":
            extra += [{"at": o["strikeAt"], "name": "whoosh", "vol": 0.25}, {"at": o["newAt"], "name": "cash", "vol": 0.35}]
        if o["type"] == "compare":
            extra.append({"at": o["wipeAt"] + o.get("wipeDur", 1.2), "name": "shimmer", "vol": 0.4})
        if o["type"] == "cta":
            extra += [{"at": o["mainAt"], "name": "pop", "vol": 0.3}, {"at": o["urgencyAt"], "name": "ding", "vol": 0.3}]
    sfx += [x for x in extra if all(abs(x["at"] - m["at"]) > 0.12 for m in sfx)]

if "music" in edit and not edit["music"]["src"].startswith("projekte/"):
    m = edit["music"]
    rel = m["src"]
    if m.get("from"):  # Abschnitt vorab ausschneiden: Remotion spielt loop + trimBefore stumm ab
        cut = f"musik/{Path(rel).stem}_ab{m['from']:g}.wav"
        dst = Path(__file__).resolve().parent.parent / "remotion" / "public" / "projekte" / name / cut
        dst.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(m["from"]), "-i", str(proj / rel), "-t", str(T + 3),
                        "-ar", "48000", "-ac", "2", str(dst)], check=True)
        rel, m["from"] = cut, 0
    m["src"] = f"projekte/{name}/{rel}"

props = {**edit, "fps": fps, "clips": clips, "audio": audio, "words": words, "segments": segs,
         "zooms": zooms, "sfx": sorted(sfx, key=lambda x: x["at"]), "overlays": overlays}
(proj / "export").mkdir(exist_ok=True)
(proj / "export" / "props.json").write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")


def ts(x):
    ms = int(round(x * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


cues, cur = [], []
for w in words:  # SRT: max. 32 Zeichen pro Zeile, Umbruch an Satzzeichen
    cur.append(w)
    if len(" ".join(x["w"] for x in cur)) > 32 or w["w"][-1] in ".!?,":
        cues.append(cur); cur = []
if cur:
    cues.append(cur)
(proj / "export" / f"{name}.srt").write_text(
    "\n".join(f"{i}\n{ts(c[0]['s'])} --> {ts(c[-1]['e'])}\n{' '.join(x['w'] for x in c)}\n" for i, c in enumerate(cues, 1)),
    encoding="utf-8")
print(f"Props: {len(clips)} Clips, {len(audio)} VO, {len(words)} Woerter, {len(sfx)} Sounds, Laenge {T:.2f}s")
