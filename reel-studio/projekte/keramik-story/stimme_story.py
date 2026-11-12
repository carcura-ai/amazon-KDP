"""Sprecherstimme für die Keramik-Story (Qwen3-TTS VoiceDesign 1.7B, Apache-2.0, entworfene Stimme, kein Klon).

1) erzeugen (Qwen-venv):   <qwen-venv>/bin/python stimme_story.py erzeugen 1 2 3     → ausgabe/takes/take_<seed>.wav
2) bewerten (System-Python, faster-whisper):   python3 stimme_story.py bewerten       → Wortgenauigkeit + Lebendigkeit je Take
3) schneiden (System-Python):   python3 stimme_story.py schneiden <seed>              → Sätze, Zeitplan, Sprachspur
Der ganze Text wird in einem Durchgang gesprochen (gleiche Stimme, Spannungsbogen), danach per Spracherkennung in Sätze zerlegt.
Die natürlichen Pausen bleiben erhalten; nach einzelnen Sätzen kommt etwas Luft für die Bilder dazu (PAUSE_NACH).
"""
import difflib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
AUS = HIER / "ausgabe"
TAKES = AUS / "takes"

# (ID, Satz). Die IDs steuern die Szenen in story.html.
SAETZE = [
    ("haken", "Dein Handy steckt in einer Hülle."),
    ("auto", "Aber dein Auto? Das steht jeden Tag draußen. Ohne extra Schutz."),
    ("teaser", "Bleib kurz dran: Am Ende wartet ein Geschenk auf dich."),
    ("gefahr", "Die Probleme sind: Sonne, Regen, Streusalz und Vogelkot."),
    ("merkst", "Und irgendwann siehst du es …"),
    ("problem", "Der Lack wird stumpf. Wasser hinterlässt Flecken. Und der Dreck geht kaum noch runter."),
    ("ursache", "Das Problem sitzt ganz oben, im Klarlack. Er schützt deine Farbe. Aber wer schützt ihn?"),
    ("wende", "Genau da setzen wir an."),
    ("loesung", "Mit einer Keramikversiegelung."),
    ("schicht", "Eine hauchdünne, glasklare Schutzschicht, die sich fest mit deinem Lack verbindet."),
    ("uv", "Die Sonne bleicht den Lack langsamer aus."),
    ("wasser", "Wasser perlt einfach ab."),
    ("schmutz", "Und Dreck findet weniger Halt. Die Wäsche geht viel leichter."),
    ("ablauf", "Bei uns in Walterschen, direkt bei Altenkirchen, machen wir alles von Hand: waschen, kneten, polieren. Erst dann kommt die Keramik drauf."),
    ("set", "Und ein Pflegeset für zu Hause gibt's dazu."),
    ("preis", "Keramikversiegelung ab siebenhundert Euro."),
    ("geschenk", "Und wenn du bis Jahresende buchst, schenken wir dir ein Waschset dazu."),
    ("cta", "Schick uns einfach drei Fotos von deinem Lack per WhatsApp. Dann bekommst du unser Angebot und weißt vorher, was es kostet."),
    ("weihnacht", "Du hast noch kein Weihnachtsgeschenk für einen Autoliebhaber? Dann buch jetzt, auch als Gutschein."),
    ("schluss", "Gönn deinem Lack die Hülle, die er verdient."),
]
# Extra-Luft nach einem Satz (Sekunden), damit die Animation wirken kann
PAUSE_NACH = {"weihnacht": 2.8, "auto": 0.45, "teaser": 0.3, "ursache": 0.5, "geschenk": 0.3, "gefahr": 0.3, "loesung": 0.6, "uv": 0.8, "wasser": 1.2, "schmutz": 0.5, "ablauf": 0.9, "schluss": 1.7}
AUSLASSEN = {"set"}
AB_WORT = {"loesung": "keramik"}   # Satz erst ab diesem Wort verwenden („Mit einer“ ist im Take genuschelt)   # nur eingeblendet, nicht gesprochen (Story bleibt unter 60 s)
VORLAUF = 0.35
ABSTAND = 0.15        # Lücke zwischen zwei Sätzen (die Pausen innerhalb eines Satzes bleiben natürlich)

STIMME = ("Native German male voice-over artist in his early thirties, warm and slightly husky timbre, standard High German "
          "from Germany with no regional, Austrian or Swiss accent. He delivers a premium car-care commercial with real "
          "emotion: he starts close and empathetic, almost confidential, with a hint of concern while describing the problem, "
          "builds tension, then turns confident, warm and genuinely enthusiastic when revealing the solution, and ends "
          "friendly and inviting. Dynamic intonation, clear emphasis on key words, natural pauses for effect, never "
          "monotone, never over-acted.")


def text_ganz():
    return " ".join(s for _, s in SAETZE)


def erzeugen(seeds):
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel
    torch.set_num_threads(4)
    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", device_map="cpu", dtype=torch.float32)
    TAKES.mkdir(parents=True, exist_ok=True)
    for seed in seeds:
        torch.manual_seed(int(seed))
        wavs, sr = m.generate_voice_design(text=text_ganz(), instruct=STIMME, language="German")
        sf.write(str(TAKES / f"take_{seed}.wav"), wavs[0], sr)
        print("Take", seed, round(len(wavs[0]) / sr, 1), "s", flush=True)


def norm(w):
    return re.sub(r"[^a-zäöüß0-9]", "", w.lower())


def woerter(pfad):
    import numpy as np
    from faster_whisper import WhisperModel
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(pfad), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    global _WM
    if "_WM" not in globals():
        _WM = WhisperModel("small", device="cpu", compute_type="int8")
    segs, info = _WM.transcribe(audio, language="de", word_timestamps=True, beam_size=5)
    return [(norm(w.word), w.start, w.end) for s in segs for w in s.words if norm(w.word)], audio


def skriptwoerter():
    return [(norm(w), k) for k, (_, s) in enumerate(SAETZE) for w in s.replace("siebenhundert", "700").split() if norm(w)]


def lebendigkeit(audio):
    """Streuung der Tonhöhe in Halbtönen: höher = mehr Betonung, weniger monoton."""
    import numpy as np
    import librosa
    f0, stimmhaft, _ = librosa.pyin(audio, fmin=60, fmax=300, sr=16000, frame_length=1024)
    f0 = f0[stimmhaft & ~np.isnan(f0)]
    return float(np.std(12 * np.log2(f0 / np.median(f0)))) if len(f0) else 0.0


def bewerten():
    ergebnis = {}
    for take in sorted(TAKES.glob("take_*.wav")):
        erk, audio = woerter(take)
        sk = skriptwoerter()
        sm = difflib.SequenceMatcher(a=[w for w, _ in sk], b=[w for w, _, _ in erk], autojunk=False)
        genau = sum(b.size for b in sm.get_matching_blocks()) / len(sk)
        try:
            leb = lebendigkeit(audio)
        except Exception as e:  # librosa fehlt
            leb = -1.0
        dauer = len(audio) / 16000
        ergebnis[take.stem] = {"wortgenauigkeit": round(genau, 3), "lebendigkeit_halbtoene": round(leb, 2), "dauer": round(dauer, 1)}
        print(take.stem, ergebnis[take.stem], flush=True)
    json.dump(ergebnis, open(TAKES / "bewertung.json", "w"), indent=1)


def schneiden(seed):
    take = TAKES / f"take_{seed}.wav"
    erk, audio = woerter(take)
    import numpy as np
    fen = 320                                             # 20 ms bei 16 kHz
    pegel = 20 * np.log10(np.sqrt(np.convolve(audio ** 2, np.ones(fen) / fen, "same")) + 1e-9)
    still = pegel < np.max(pegel) - 42                    # Stille relativ zum lautesten Wort

    def rand(t0, richtung, grenze):
        """Vom Wort aus bis zur ersten Stille laufen (Whisper setzt Wortanfänge oft zu spät)."""
        i = int(t0 * 16000)
        stop = int(grenze * 16000)
        while 0 < i < len(audio) - 1 and ((richtung < 0 and i > stop) or (richtung > 0 and i < stop)) and not still[i]:
            i += richtung * 80
        return i / 16000
    sk = skriptwoerter()
    zuord = {}
    sm = difflib.SequenceMatcher(a=[w for w, _ in sk], b=[w for w, _, _ in erk], autojunk=False)
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op in ("equal", "replace") and b1 > b0:
            for i in range(a1 - a0):
                zuord[a0 + i] = min(b0 + i * (b1 - b0) // (a1 - a0), b1 - 1)
    grenzen = []
    for k in range(len(SAETZE)):
        idx = [zuord[i] for i, (_, kk) in enumerate(sk) if kk == k and i in zuord]
        if not idx:
            sys.exit(f"Satz {k} nicht gefunden: {SAETZE[k][1]}")
        start = erk[min(idx)][1]
        if SAETZE[k][0] in AB_WORT:
            treffer = [erk[i][1] for i in idx if erk[i][0].startswith(AB_WORT[SAETZE[k][0]])]
            start = treffer[0] if treffer else start
        grenzen.append([start, erk[max(idx)][2]])
    # Satzstücke eng um die Wörter schneiden (lange Sprechpausen zwischen Sätzen fallen weg),
    # dann mit fester Lücke ABSTAND + PAUSE_NACH neu anlegen
    mitten = [(grenzen[k][1] + grenzen[k + 1][0]) / 2 for k in range(len(grenzen) - 1)]
    stuecke = []
    for k in range(len(grenzen)):
        g_a = mitten[k - 1] if k else 0.0
        g_b = mitten[k] if k < len(mitten) else grenzen[k][1] + .4
        a = max((grenzen[k][0] - .03) if SAETZE[k][0] in AB_WORT else rand(grenzen[k][0], -1, g_a) - .06, g_a)
        b = min(rand(grenzen[k][1], +1, g_b) + .08, g_b)
        stuecke.append((a, b))

    # Sprachspur: Satzstücke mit fester Lücke, plus Luft nach einzelnen Sätzen
    tempo = float(os.environ.get("TEMPO", "1.15"))      # > 1 = etwas schneller (Tonhöhe bleibt)
    teile, plan, t = [], [], VORLAUF
    for k, (sid, satz) in enumerate(SAETZE):
        if sid in AUSLASSEN:                               # Szene bekommt einen Zeitpunkt, aber keinen Ton
            plan.append({"id": sid, "start": round(t - ABSTAND + .05, 3), "ende": round(t - ABSTAND + .05, 3), "text": satz, "woerter": []})
            continue
        a, b = stuecke[k]
        stueck = AUS / "saetze" / f"{k:02d}_{sid}.wav"
        stueck.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(take),        # erst ausschneiden, dann Tempo und Blenden
                        "-af", "atrim=start=%.3f:end=%.3f,asetpts=PTS-STARTPTS,atempo=%.3f,afade=t=in:d=0.015,"
                        "afade=t=out:st=%.3f:d=0.03" % (a, b, tempo, max(0, (b - a) / tempo - .03)),
                        "-ar", "48000", "-ac", "1", str(stueck)], check=True)
        sprech_a = t + (grenzen[k][0] - a) / tempo          # wann das erste Wort wirklich kommt
        sprech_e = t + (grenzen[k][1] - a) / tempo
        ww = [[w, round(t + (s0 - a) / tempo, 3), round(t + (e0 - a) / tempo, 3)] for w, s0, e0 in erk if a <= s0 < b]
        plan.append({"id": sid, "start": round(sprech_a, 3), "ende": round(sprech_e, 3), "text": satz, "woerter": ww})
        teile.append((stueck, t))
        t += (b - a) / tempo + ABSTAND + PAUSE_NACH.get(sid, 0.0)
    dauer = t
    eing, filt = [], []
    for i, (p, s) in enumerate(teile):
        eing += ["-i", str(p)]
        ms = int(round(s * 1000))
        filt.append(f"[{i}]adelay={ms}|{ms}[d{i}]")
    filt.append("".join(f"[d{i}]" for i in range(len(teile))) + f"amix=inputs={len(teile)}:normalize=0,"
                "highpass=f=70,equalizer=f=160:t=q:w=1:g=1.5,equalizer=f=3200:t=q:w=1.2:g=1.5,"
                "acompressor=threshold=-21dB:ratio=2.5:attack=8:release=150:makeup=2,"
                f"apad=whole_dur={dauer:.3f},atrim=0:{dauer:.3f}[a]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *eing, "-filter_complex", ";".join(filt), "-map", "[a]",
                    "-ar", "48000", "-ac", "1", str(AUS / "stimme_roh.wav")], check=True)
    json.dump({"dauer": round(dauer, 3), "take": seed, "saetze": plan}, open(AUS / "zeitplan.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"Dauer {dauer:.1f} s")
    for p in plan:
        print(f"{p['start']:6.2f}–{p['ende']:6.2f}  {p['id']:8s} {p['text']}")


if __name__ == "__main__":
    {"erzeugen": lambda: erzeugen(sys.argv[2:] or ["1"]), "bewerten": bewerten,
     "schneiden": lambda: schneiden(sys.argv[2])}[sys.argv[1]]()
