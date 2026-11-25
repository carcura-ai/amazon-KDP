"""Sprecher für Fakten-Videos: Stimme „Kumpel“ (Qwen3-TTS Base, Klon der eigenen entworfenen Stimme), ganzer Text in einem Durchgang.
Aufruf (Qwen-venv): python stimme.py videos/001-venus [fassungen=3]  → videos/…/take_<n>.wav
Auswahl und Wortzeiten: python3 stimme.py waehlen videos/001-venus   → stimme.wav + woerter.json"""
import json, re, subprocess, sys, difflib
from pathlib import Path

HIER = Path(__file__).resolve().parent
REF = HIER.parent.parent / "reel-studio/projekte/keramik-story/ausgabe/stimmproben/ref_kumpel.wav"


def norm(w):
    return re.sub(r"[^a-zäöüß0-9]", "", w.lower())


if sys.argv[1] != "waehlen":
    import soundfile as sf, torch
    from qwen_tts import Qwen3TTSModel
    ordner = HIER / sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    text = (ordner / "skript.txt").read_text(encoding="utf-8").replace("\n", " ").strip()
    torch.set_num_threads(4)
    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-Base", device_map="cpu", dtype=torch.float32)
    p = m.create_voice_clone_prompt(ref_audio=str(REF), ref_text=REF.with_suffix(".txt").read_text(encoding="utf-8").strip())
    for i in range(n):
        torch.manual_seed(50 + i)
        w, sr = m.generate_voice_clone(text=text, language="German", voice_clone_prompt=p)
        sf.write(str(ordner / f"take_{i}.wav"), w[0], sr); print("take", i, round(len(w[0]) / sr, 1), "s", flush=True)
    print("FERTIG")
else:
    import numpy as np
    from faster_whisper import WhisperModel
    ordner = HIER / sys.argv[2]
    soll = [norm(w) for w in (ordner / "skript.txt").read_text(encoding="utf-8").split() if norm(w)]
    m = WhisperModel("small", device="cpu", compute_type="int8")
    beste = None
    for f in sorted(ordner.glob("take_*.wav")):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
        a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
        segs, _ = m.transcribe(a, language="de", word_timestamps=True, beam_size=5)
        ww = [(norm(x.word), x.start, x.end, x.probability) for s in segs for x in s.words if norm(x.word)]
        ist = [w for w, *_ in ww]
        genau = sum(b.size for b in difflib.SequenceMatcher(a=soll, b=ist, autojunk=False).get_matching_blocks()) / max(len(soll), len(ist))
        dauer = len(a) / 16000
        print(f.name, round(genau, 3), round(dauer, 1), "s", " ".join(ist))
        if beste is None or (genau, -dauer) > (beste[0], -beste[1]):
            beste = (genau, dauer, f, ww)
    genau, dauer, f, ww = beste
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-af", "highpass=f=70,equalizer=f=3200:t=q:w=1.2:g=1.5,"
                    "acompressor=threshold=-21dB:ratio=2.5:attack=8:release=150:makeup=2,adelay=400|400",
                    "-ar", "48000", "-ac", "1", str(ordner / "stimme.wav")], check=True)
    json.dump({"take": f.name, "genau": genau, "dauer": round(dauer + .4, 2),
               "woerter": [[w, round(s + .4, 3), round(e + .4, 3)] for w, s, e, _ in ww]},
              open(ordner / "woerter.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("gewählt:", f.name, genau)
