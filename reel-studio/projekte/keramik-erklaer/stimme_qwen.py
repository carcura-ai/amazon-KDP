"""Sprecherstimme mit Qwen3-TTS (Apache-2.0, kommerziell nutzbar): Stimme per Beschreibung entworfen, kein Klon einer echten Person.

Der ganze Text wird in EINEM Durchgang gesprochen (gleiche Stimme, natürlicher Fluss) und danach per Spracherkennung
in Sätze geschnitten. Die Sätze landen als ausgabe/stimme/s_00.wav … und werden von stimme.py (QUELLE=fertig) angelegt.

1) erzeugen (im Qwen-venv):   <qwen-venv>/bin/python stimme_qwen.py erzeugen
2) schneiden (System-Python mit faster-whisper):   python3 stimme_qwen.py schneiden
3) zusammenbauen:   QUELLE=fertig python3 stimme.py   und danach   node render.js video …
"""
import difflib
import json
import re
import subprocess
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
TMP = HIER / "ausgabe" / "stimme"
ROH = TMP / "qwen_ganz.wav"
sys.path.insert(0, str(HIER))
from stimme import SAETZE  # noqa: E402  (gleiche Satzliste wie die Animation)

# Aussprache-Hilfen aus stimme.py zurück in normale Schreibweise (Qwen spricht englische Wörter richtig)
def sprechtext(s):
    return s.replace("Wotsäpp", "WhatsApp").replace("Hauchdünn, und glatt", "Hauchdünn und glatt").replace("Karkura", "Carcura")

STIMME = ("A warm, friendly male voice in his early thirties speaking standard German (Hochdeutsch) from Germany, "
          "no dialect and no Austrian or Swiss accent. Confident, clear and relaxed like a professional TV commercial "
          "voice-over artist. Natural emphasis on key words, lively but calm pace, a slight smile in the voice.")


def erzeugen():
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel
    torch.set_num_threads(4)
    torch.manual_seed(7)
    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", device_map="cpu", dtype=torch.float32)
    text = " ".join(sprechtext(s) for _, s in SAETZE)
    wavs, sr = m.generate_voice_design(text=text, instruct=STIMME, language="German")
    TMP.mkdir(parents=True, exist_ok=True)
    sf.write(str(ROH), wavs[0], sr)
    print("gesprochen:", round(len(wavs[0]) / sr, 1), "s")


def norm(w):
    return re.sub(r"[^a-zäöüß0-9]", "", w.lower())


def schneiden():
    import numpy as np
    from faster_whisper import WhisperModel
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ROH), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    segs, _ = WhisperModel("small", device="cpu", compute_type="int8").transcribe(audio, language="de", word_timestamps=True, beam_size=5)
    erkannt = [(norm(w.word), w.start, w.end) for s in segs for w in s.words if norm(w.word)]
    skript = [(norm(w), k) for k, (_, s) in enumerate(SAETZE) for w in sprechtext(s).replace("siebenhundert", "700").split() if norm(w)]
    zuord = {}
    sm = difflib.SequenceMatcher(a=[w for w, _ in skript], b=[w for w, _, _ in erkannt], autojunk=False)
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op in ("equal", "replace"):
            for i in range(a1 - a0):
                zuord[a0 + i] = min(b0 + i * max(1, (b1 - b0)) // max(1, (a1 - a0)), b1 - 1) if b1 > b0 else None
    grenzen = []
    for k in range(len(SAETZE)):
        idx = [zuord.get(i) for i, (_, kk) in enumerate(skript) if kk == k]
        idx = [i for i in idx if i is not None]
        if not idx:
            sys.exit(f"Satz {k} nicht gefunden – Text prüfen: {SAETZE[k][1]}")
        grenzen.append([erkannt[min(idx)][1], erkannt[max(idx)][2]])
    # Schnitt in der Mitte der Pause zwischen zwei Sätzen
    schnitte = [max(0.0, grenzen[0][0] - .08)]
    for k in range(len(grenzen) - 1):
        schnitte.append((grenzen[k][1] + grenzen[k + 1][0]) / 2)
    schnitte.append(grenzen[-1][1] + .25)
    for k in range(len(SAETZE)):
        a, b = schnitte[k], schnitte[k + 1]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ROH), "-ss", f"{a:.3f}", "-to", f"{b:.3f}",
                        "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
                        "silenceremove=start_periods=1:start_threshold=-50dB,areverse,afade=t=in:d=0.01",
                        "-ar", "48000", "-ac", "1", str(TMP / f"s_{k:02d}.wav")], check=True)
        print(f"{k:2d} {a:6.2f}–{b:6.2f}  {SAETZE[k][1]}")
    json.dump({"woerter": [[w, round(s, 2), round(e, 2)] for w, s, e in erkannt]},
              open(TMP / "woerter.json", "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    {"erzeugen": erzeugen, "schneiden": schneiden}[sys.argv[1]]()
