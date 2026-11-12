"""„Ho, ho, ho!“ für den Weihnachtsmann (Qwen3-TTS VoiceDesign, entworfene Stimme). Aufruf im Qwen-venv: python hohoho.py
Erzeugt 4 Fassungen nach ausgabe/hohoho_kandidaten/; die Auswahl macht `python3 hohoho.py waehlen` (System-Python)."""
import subprocess
import sys
from pathlib import Path

AUS = Path(__file__).resolve().parent / "ausgabe"
K = AUS / "hohoho_kandidaten"
STIMME = ("A very deep, booming, jolly old man's voice like Santa Claus. He laughs heartily and warmly, slow and loud, "
          "full of joy, with a big belly laugh. German speaker.")

if len(sys.argv) > 1 and sys.argv[1] == "waehlen":
    import numpy as np
    from faster_whisper import WhisperModel
    m = WhisperModel("small", device="cpu", compute_type="int8")
    beste = None
    for f in sorted(K.glob("*.wav")):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
        a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
        segs, _ = m.transcribe(a, language="de", beam_size=5)
        t = " ".join(s.text.strip() for s in segs).lower()
        punkte = t.count("ho") + 3 * ("weihnacht" in t) - abs(len(a) / 16000 - 2.6)
        print(f.name, round(len(a) / 16000, 2), "s", t, round(punkte, 2))
        if beste is None or punkte > beste[0]:
            beste = (punkte, f)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(beste[1]), "-af",
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                    "-ar", "48000", "-ac", "1", str(AUS / "hohoho.wav")], check=True)
    print("gewählt:", beste[1].name)
else:
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel
    torch.set_num_threads(4)
    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", device_map="cpu", dtype=torch.float32)
    K.mkdir(parents=True, exist_ok=True)
    for seed in (1, 2, 3, 4):
        torch.manual_seed(seed)
        wavs, sr = m.generate_voice_design(text="Ho, ho, ho! Frohe Weihnachten!", instruct=STIMME, language="German")
        sf.write(str(K / f"hohoho_{seed}.wav"), wavs[0], sr)
        print("hohoho", seed, round(len(wavs[0]) / sr, 2), "s", flush=True)
    print("FERTIG")
