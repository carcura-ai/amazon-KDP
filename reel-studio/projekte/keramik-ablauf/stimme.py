"""Sprecher für „Keramikversiegelung – Ablauf“: Qwen3-TTS (Apache-2.0), Stimme „Kumpel“ (entworfene KI-Stimme, kein Klon einer echten Person).
Referenz: stimme/ref_kumpel.wav (aus der Hörprobe vom 12.11.), Text stimme/ref_kumpel.txt.
1) erzeugen (Qwen-venv):  <venv>/bin/python stimme.py erzeugen [fassungen=3]   → stimme/kand/<nr>_<n>.wav
2) waehlen  (Qwen-venv mit faster-whisper):  <venv>/bin/python stimme.py waehlen   → stimme/s_<nr>.wav, stimme/zeitplan.json (Sätze + Wortzeiten)
Die deutlichste Fassung je Satz gewinnt (Spracherkennung vergleicht mit dem Sollsatz). Es wird nirgends im Sprechfluss geschnitten.
"""
import difflib, json, re, subprocess, sys
from pathlib import Path
HIER = Path(__file__).resolve().parent; AUS = HIER / "stimme"; KAND = AUS / "kand"
SAETZE = [
    "Was passiert bei einer Keramikversiegelung?",
    "Zuerst waschen wir von Hand, entfernen Flugrost und Teer und kneten den Lack glatt.",
    "Dann polieren wir, auf Wunsch zweistufig gegen feine Kratzer.",
    "Dann kommt die Keramik: eine hauchdünne, glasklare Schicht.",
    "Sie härtet bei uns in der Halle aus, die ersten zwölf Stunden unter Prüflicht.",
    "Du bekommst eine Pflegeanleitung, und nach sechs Monaten schauen wir kostenlos nach.",
    "Ab siebenhundert Euro. Schick uns Fotos, wir machen dir ein faires Angebot.",
]
def norm(w): return re.sub(r"[^a-zäöüß0-9]", "", w.lower())
def erzeugen(fassungen):
    import soundfile as sf, torch
    from qwen_tts import Qwen3TTSModel
    torch.set_num_threads(4); KAND.mkdir(parents=True, exist_ok=True)
    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-Base", device_map="cpu", dtype=torch.float32)
    p = m.create_voice_clone_prompt(ref_audio=str(AUS / "ref_kumpel.wav"), ref_text=(AUS / "ref_kumpel.txt").read_text(encoding="utf-8").strip())
    for n in range(fassungen):
        for i, satz in enumerate(SAETZE):
            ziel = KAND / f"{i}_{n}.wav"
            if ziel.exists(): continue
            torch.manual_seed(1000 * n + 17 * i + 5)
            w, sr = m.generate_voice_clone(text=satz, language="German", voice_clone_prompt=p)
            sf.write(str(ziel), w[0], sr); print("Fassung", n, "Satz", i, round(len(w[0]) / sr, 2), "s", flush=True)
    print("FERTIG", flush=True)
def hoeren(pfad, modell):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(pfad), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    segs, _ = modell.transcribe(a, language="de", word_timestamps=True, beam_size=5)
    return [(w.word.strip(), w.start, w.end) for s in segs for w in s.words if norm(w.word)], len(a) / 16000, a
def waehlen():
    import numpy as np
    from faster_whisper import WhisperModel
    modell = WhisperModel("small", device="cpu", compute_type="int8"); plan = []; t = 0.0; GAP = 0.35
    for i, satz in enumerate(SAETZE):
        soll = [norm(w) for w in satz.replace("siebenhundert", "700").replace("zwölf", "12").replace("sechs", "6").split() if norm(w)]
        best = None
        for f in sorted(KAND.glob(f"{i}_*.wav")):
            erk, dauer, a = hoeren(f, modell); ist = [norm(w).replace("siebenhundert", "700").replace("zwölf", "12").replace("sechs", "6") for w, *_ in erk]
            gut = difflib.SequenceMatcher(a=soll, b=ist, autojunk=False).ratio()
            print(i, f.name, round(gut, 3), round(dauer, 2), flush=True)
            if best is None or gut > best[0] + 1e-6 or (abs(gut - best[0]) < 1e-6 and dauer < best[1]): best = (gut, dauer, f, erk)
        gut, dauer, f, erk = best
        out = AUS / f"s_{i}.wav"   # führende/folgende Stille kappen, 80 ms Luft lassen
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-af", "silenceremove=start_periods=1:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_threshold=-48dB,areverse,apad=pad_dur=0.08", str(out)], check=True)
        d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout)
        # Wortzeiten relativ zum gekappten Satz (Whisper-Start des ersten Wortes als Versatz)
        off = erk[0][1] if erk else 0
        plan.append({"i": i, "text": satz, "start": round(t, 3), "dauer": round(d, 3), "genau": round(gut, 3), "datei": out.name, "woerter": [[w, round(max(0, s - off), 3), round(max(0, e - off), 3)] for w, s, e in erk]})
        t += d + GAP
    (AUS / "zeitplan.json").write_text(json.dumps({"gap": GAP, "saetze": plan, "gesamt": round(t, 3)}, ensure_ascii=False, indent=1), encoding="utf-8"); print("Plan geschrieben, Sprechzeit gesamt", round(t, 1), "s")
if __name__ == "__main__":
    if sys.argv[1] == "erzeugen": erzeugen(int(sys.argv[2]) if len(sys.argv) > 2 else 3)
    else: waehlen()
