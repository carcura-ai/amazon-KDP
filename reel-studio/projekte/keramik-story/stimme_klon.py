"""Stimme neu auflegen, Satz für Satz, mit derselben Stimme wie Take 33 (Qwen3-TTS Base, Apache-2.0).

Grund: Im Ein-Durchgang-Take wurden Wörter verschluckt, und beim Zerschneiden gingen Wortanfänge verloren.
Jetzt wird jeder Satz einzeln gesprochen (mehrere Fassungen), die deutlichste Fassung wird per Spracherkennung gewählt,
und es wird nirgends mehr im Sprechfluss geschnitten. Die Stimme kommt aus drei Stellen von Take 33 (unsere eigene,
per Beschreibung entworfene KI-Stimme, kein Klon einer echten Person): Einstieg, Problem-Ton, Lösungs-Ton.

1) <qwen-venv>/bin/python stimme_klon.py erzeugen [fassungen=4]   → ausgabe/kandidaten/<id>_<n>.wav
2) python3 stimme_klon.py waehlen                                  → ausgabe/saetze/, zeitplan.json, stimme_roh.wav
"""
import difflib
import json
import subprocess
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER))
from stimme_story import ABSTAND, AUS, AUSLASSEN, PAUSE_NACH, SAETZE, TAKES, VORLAUF, norm  # noqa: E402

KAND = AUS / "kandidaten"
TAKE = TAKES / "take_33.wav"
MAX_DAUER = 59.6          # ein Story-Segment
# Referenzstellen in Take 33 (Sekunden) mit ihrem Text; je Satz die passende Stimmung
REFS = {
    "einstieg": (0.0, 7.25, "Dein Handy steckt in einer Hülle. Aber dein Auto? Das steht jeden Tag draußen. Ohne extra Schutz."),
    "problem": (16.6, 22.4, "Der Lack wird stumpf. Wasser hinterlässt Flecken. Und der Dreck geht kaum noch runter."),
    "loesung": (46.95, 53.65, "Bei uns in Walterschen machen wir alles von Hand: waschen, kneten, polieren. Erst dann kommt die Keramik drauf."),
}
REF_FUER = {"haken": "einstieg", "auto": "einstieg", "gefahr": "problem", "merkst": "problem", "problem": "problem",
            "ursache": "problem"}          # alle anderen: "loesung"


def erzeugen(fassungen):
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel
    torch.set_num_threads(4)
    KAND.mkdir(parents=True, exist_ok=True)
    audio, sr = sf.read(str(TAKE))
    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-1.7B-Base", device_map="cpu", dtype=torch.float32)
    prompts = {k: m.create_voice_clone_prompt(ref_audio=(audio[int(a * sr):int(b * sr)], sr), ref_text=t)
               for k, (a, b, t) in REFS.items()}
    for n in range(fassungen):                       # Fassung für Fassung, damit früh etwas Brauchbares da ist
        for sid, satz in SAETZE:
            ziel = KAND / f"{sid}_{n}.wav"
            if sid in AUSLASSEN or ziel.exists():
                continue
            torch.manual_seed(1000 * n + abs(hash(sid)) % 997)
            wavs, sr2 = m.generate_voice_clone(text=satz, language="German",
                                               voice_clone_prompt=prompts[REF_FUER.get(sid, "loesung")])
            sf.write(str(ziel), wavs[0], sr2)
            print("Fassung", n, sid, round(len(wavs[0]) / sr2, 2), "s", flush=True)
    print("FERTIG", flush=True)


def hoeren(pfad, modell):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(pfad), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    segs, _ = modell.transcribe(audio, language="de", word_timestamps=True, beam_size=5)
    return [(norm(w.word), w.start, w.end, w.probability) for s in segs for w in s.words if norm(w.word)], len(audio) / 16000


def waehlen():
    from faster_whisper import WhisperModel
    modell = WhisperModel("small", device="cpu", compute_type="int8")
    (AUS / "saetze").mkdir(exist_ok=True)
    wahl, bericht = {}, []
    for sid, satz in SAETZE:
        if sid in AUSLASSEN:
            continue
        soll = [norm(w) for w in satz.replace("siebenhundert", "700").replace("gibt's", "gibt es").split() if norm(w)]
        alle = []
        for f in sorted(KAND.glob(f"{sid}_*.wav")):
            erk, dauer = hoeren(f, modell)
            ist = [w for w, *_ in erk]
            treffer = sum(b.size for b in difflib.SequenceMatcher(a=soll, b=ist, autojunk=False).get_matching_blocks())
            genau = treffer / max(len(soll), len(ist), 1)          # fehlende UND erfundene Wörter zählen
            sicher = min((p for *_, p in erk), default=0.0)        # unsicherstes Wort = undeutlichste Stelle
            tempo = sum(len(w) for w in soll) / max(dauer, .1)     # Buchstaben pro Sekunde
            punkte = (round(genau, 3), tempo < 19, round(sicher, 2))
            bericht.append(f"{f.name:16s} genau {genau:.2f}  unsicherstes Wort {sicher:.2f}  {dauer:.2f} s  {' '.join(ist)}")
            alle.append((punkte, f, erk, erk[-1][2] - erk[0][1] if erk else 99))
        if not alle:
            sys.exit(f"keine Fassung für {sid}")
        top = max(a[0] for a in alle)
        # unter den gleich deutlichen Fassungen (Abstand höchstens 0,06) die kompakteste nehmen: mehr Zeit für die Bilder
        gut = [a for a in alle if a[0][:2] == top[:2] and a[0][2] >= top[2] - .06]
        wahl[sid] = min(gut, key=lambda a: a[3])[:3]
    print("\n".join(bericht))

    # Stücke: nur Stille an den Rändern entfernen (mit Rand), nichts im Sprechfluss schneiden
    stuecke = {}
    for sid, (punkte, f, erk) in wahl.items():
        a, b = max(0.0, erk[0][1] - .12), erk[-1][2] + .18
        ziel = AUS / "saetze" / f"{sid}.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-af",
                        f"atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,areverse,afade=t=in:d=0.05,areverse",
                        "-ar", "48000", "-ac", "1", str(ziel)], check=True)
        dauer = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ziel)],
                                     capture_output=True, text=True).stdout)
        stuecke[sid] = (ziel, dauer, [(w, s - a, e - a) for w, s, e, _ in erk])

    def plane(tempo, pausen):
        t, plan, teile = VORLAUF, [], []
        for sid, satz in SAETZE:
            if sid in AUSLASSEN:
                z = round(plan[-1]["ende"] + .1, 3) if plan else t      # nur eingeblendet: direkt nach dem vorigen Satz
                plan.append({"id": sid, "start": z, "ende": z, "text": satz, "woerter": []})
                continue
            ziel, dauer, ww = stuecke[sid]
            plan.append({"id": sid, "start": round(t + ww[0][1] / tempo, 3), "ende": round(t + ww[-1][2] / tempo, 3), "text": satz,
                         "woerter": [[w, round(t + s / tempo, 3), round(t + e / tempo, 3)] for w, s, e in ww]})
            teile.append((ziel, t))
            t += dauer / tempo + ABSTAND + PAUSE_NACH.get(sid, 0.0) * pausen
        return t, plan, teile

    # Erst in Originaltempo; wenn es nicht in ein Story-Segment passt: Bildpausen kürzen, dann minimal schneller
    tempo, pausen = 1.0, 1.0
    dauer, plan, teile = plane(tempo, pausen)
    for p_min, t_max in ((.7, 1.0), (.7, 1.04), (.4, 1.04), (.4, 1.1)):   # erst Pausen, dann unhörbar wenig Tempo
        while dauer > MAX_DAUER and pausen > p_min + .01:
            pausen -= .1; dauer, plan, teile = plane(tempo, pausen)
        while dauer > MAX_DAUER and tempo < t_max - .001:
            tempo += .01; dauer, plan, teile = plane(tempo, pausen)
    eing, filt = [], []
    for i, (p, s) in enumerate(teile):
        eing += ["-i", str(p)]
        ms = int(round(s * 1000))
        filt.append(f"[{i}]atempo={tempo:.3f},adelay={ms}|{ms}[d{i}]")
    filt.append("".join(f"[d{i}]" for i in range(len(teile))) + f"amix=inputs={len(teile)}:normalize=0,"
                "highpass=f=70,equalizer=f=160:t=q:w=1:g=1.5,equalizer=f=3200:t=q:w=1.2:g=1.5,"
                "acompressor=threshold=-21dB:ratio=2.5:attack=8:release=150:makeup=2,"
                f"apad=whole_dur={dauer:.3f},atrim=0:{dauer:.3f}[a]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *eing, "-filter_complex", ";".join(filt), "-map", "[a]",
                    "-ar", "48000", "-ac", "1", str(AUS / "stimme_roh.wav")], check=True)
    json.dump({"dauer": round(dauer, 3), "tempo": round(tempo, 2), "saetze": plan,
               "gewaehlt": {sid: v[1].name for sid, v in wahl.items()}},
              open(AUS / "zeitplan.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nDauer {dauer:.1f} s, Tempo {tempo:.2f}, Bildpausen {pausen:.1f}")
    for sid, (punkte, f, _) in wahl.items():
        print(f"{sid:8s} {f.name:14s} {punkte}")


if __name__ == "__main__":
    if sys.argv[1] == "erzeugen":
        erzeugen(int(sys.argv[2]) if len(sys.argv) > 2 else 4)
    else:
        waehlen()
