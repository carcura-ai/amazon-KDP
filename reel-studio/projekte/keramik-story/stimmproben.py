"""Stimmproben: drei neu entworfene Stimmen (Qwen3-TTS VoiceDesign) sprechen denselben Ausschnitt.
Aufruf im Qwen-venv: python stimmproben.py   → ausgabe/stimmproben/<name>.wav"""
from pathlib import Path

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

ZIEL = Path(__file__).resolve().parent / "ausgabe" / "stimmproben"
TEXT = ("Dein Handy steckt in einer Hülle. Aber dein Auto? Das steht jeden Tag draußen. Ohne extra Schutz. "
        "Bei uns in Walterschen, direkt bei Altenkirchen, machen wir alles von Hand. "
        "Keramikversiegelung ab siebenhundert Euro.")
GEMEINSAM = (" Native German speaker from Germany, standard High German, no Austrian or Swiss accent. It must sound like a real "
             "person recorded with a good microphone, not like an announcer or a synthetic voice: natural breathing, small "
             "natural variations in pace, relaxed and unforced, conversational rhythm.")
STIMMEN = {
    "a-kumpel": "A man around thirty talking casually to a friend, slightly raspy, down-to-earth and likeable, a bit of a grin "
                "in his voice, like a car detailer explaining something in his workshop." + GEMEINSAM,
    "b-meister": "A man in his late forties with a deep, calm, grounded voice, an experienced craftsman who speaks slowly and "
                 "with quiet confidence, trustworthy and honest, no hype." + GEMEINSAM,
    "c-frau": "A woman around thirty with a warm, clear, natural voice, friendly and direct, speaking like she is recording "
              "a personal Instagram story for her own business, lively but not exaggerated." + GEMEINSAM,
}
torch.set_num_threads(4)
m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", device_map="cpu", dtype=torch.float32)
ZIEL.mkdir(parents=True, exist_ok=True)
for name, beschreibung in STIMMEN.items():
    for seed in (5, 6):
        torch.manual_seed(seed)
        wavs, sr = m.generate_voice_design(text=TEXT, instruct=beschreibung, language="German")
        sf.write(str(ZIEL / f"{name}_{seed}.wav"), wavs[0], sr)
        print(name, seed, round(len(wavs[0]) / sr, 1), "s", flush=True)
print("FERTIG")
