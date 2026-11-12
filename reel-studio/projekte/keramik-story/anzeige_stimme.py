"""Sprecher für die Anzeige mit der Stimme „Kumpel“ (Qwen3-TTS Base, Referenz ausgabe/stimmproben/ref_kumpel.wav).
1) <qwen-venv>/bin/python anzeige_stimme.py erzeugen   2) python3 anzeige_stimme.py bauen  → ausgabe/anzeige_stimme.wav"""
import difflib
import json
import subprocess
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
AUS = HIER / "ausgabe"
K = AUS / "kandidaten_anzeige"
DAUER = 26.8
# (Name, frühester Start, spätestes Ende, Satz) – nur Aussagen aus dem Anzeigen-Briefing
SAETZE = [
    ("haken", 0.1, 3.75, "Streusalz, Regen, Baumharz. Jeden Tag auf deinem Lack."),
    ("folge", 3.85, 7.6, "Die Folge: stumpfer Lack und Wasserflecken."),
    ("loesung", 8.0, 12.25, "Die Lösung: Keramikversiegelung. Hauchdünn und glasklar."),
    ("hand", 12.3, 15.2, "Komplett von Hand, in unserer Halle in Walterschen."),
    ("angebot", 15.3, 23.1, "Ab siebenhundert Euro, mit Handwäsche, Kneten, Politur und Pflegeset. Bei Buchung bis Jahresende: Waschset geschenkt."),
    ("schluss", 23.2, 26.6, "Auch als Gutschein. Jetzt Angebot anfordern."),
]

if sys.argv[1] == "erzeugen":
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel
    torch.set_num_threads(4)
    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-Base", device_map="cpu", dtype=torch.float32)
    ref = AUS / "stimmproben" / "ref_kumpel.wav"
    prompt = m.create_voice_clone_prompt(ref_audio=str(ref), ref_text=ref.with_suffix(".txt").read_text(encoding="utf-8").strip())
    K.mkdir(parents=True, exist_ok=True)
    for n in range(int(sys.argv[2]) if len(sys.argv) > 2 else 3):
        for i, (name, _, _, satz) in enumerate(SAETZE):
            ziel = K / f"{name}_{n}.wav"
            if ziel.exists():
                continue
            torch.manual_seed(100 * n + i)
            wavs, sr = m.generate_voice_clone(text=satz, language="German", voice_clone_prompt=prompt)
            sf.write(str(ziel), wavs[0], sr)
            print("Fassung", n, name, round(len(wavs[0]) / sr, 2), "s", flush=True)
    print("FERTIG", flush=True)
else:
    from faster_whisper import WhisperModel
    sys.path.insert(0, str(HIER))
    from stimme_klon import hoeren, norm
    modell = WhisperModel("small", device="cpu", compute_type="int8")
    eing, filt, plan = [], [], []
    for i, (name, start, ende, satz) in enumerate(SAETZE):
        soll = [norm(w) for w in satz.replace("siebenhundert", "700").split() if norm(w)]
        alle = []
        for f in sorted(K.glob(f"{name}_*.wav")):
            erk, _, sprechende = hoeren(f, modell)
            ist = [w for w, *_ in erk]
            genau = sum(b.size for b in difflib.SequenceMatcher(a=soll, b=ist, autojunk=False).get_matching_blocks()) / max(len(soll), len(ist), 1)
            a = max(0.0, erk[0][1] - .3); lang = sprechende + .1 - a
            alle.append((round(genau, 2), -lang, f, a, lang))
            print(f"{f.name:14s} genau {genau:.2f} {lang:.2f} s  {' '.join(ist)}")
        genau, _, f, a, lang = max(alle)                       # deutlichste, bei Gleichstand die kürzeste
        fenster = ende - start
        tempo = 1.08                                            # einheitlich, kaum hörbar
        stueck = K / f"gewaehlt_{name}.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-af",
                        f"atrim=start={a:.3f}:end={a + lang:.3f},asetpts=PTS-STARTPTS,atempo={tempo:.3f},afade=t=in:d=0.02",
                        "-ar", "48000", "-ac", "1", str(stueck)], check=True)
        plan.append({"id": name, "datei": f.name, "genau": float(genau), "start": start, "dauer": round(lang / tempo, 2), "tempo": round(tempo, 2),
                     "passt": bool(lang / tempo <= fenster + .05)})
        eing += ["-i", str(stueck)]
        filt.append(f"[{i}]adelay={int(start * 1000)}|{int(start * 1000)}[d{i}]")
    filt.append("".join(f"[d{i}]" for i in range(len(SAETZE))) + f"amix=inputs={len(SAETZE)}:normalize=0,highpass=f=70,"
                "equalizer=f=3200:t=q:w=1.2:g=1.5,acompressor=threshold=-21dB:ratio=2.5:attack=8:release=150:makeup=2,"
                f"apad=whole_dur={DAUER},atrim=0:{DAUER}[a]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *eing, "-filter_complex", ";".join(filt), "-map", "[a]", "-ar", "48000", "-ac", "1",
                    str(AUS / "anzeige_stimme.wav")], check=True)
    json.dump(plan, open(AUS / "anzeige_stimme.json", "w"), indent=1)
    for z in plan:
        print(z)
