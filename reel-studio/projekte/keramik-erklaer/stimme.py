"""Sprecherstimme für das Reel: jeden Satz mit Piper erzeugen und genau dann sprechen lassen, wenn sein Text erscheint.

Stimme: Piper „de_DE-thorsten-medium“. Datensatz Thorsten-Voice CC0, Basismodell rdh CC0, kommerziell nutzbar.
(Die Variante „thorsten-high“ ist von einem Forschungs-Datensatz abgeleitet und wird für Werbung NICHT verwendet.)

Aufruf:  PIPER_PY=<venv>/bin/python PIPER_MODELL=<pfad>/de_DE-thorsten-medium.onnx python3 stimme.py
Ergebnis: ausgabe/karte.json  (Zeitkarte Video → Animation; render.js streckt die Animation, wo die Stimme Zeit braucht)
          ausgabe/stimme.wav  (fertige Tonspur, 48 kHz, -14 LUFS)
"""
import json
import os
import subprocess
import wave
from pathlib import Path

HIER = Path(__file__).resolve().parent
AUS = HIER / "ausgabe"
TMP = AUS / "stimme"
DAUER = 26.5          # Länge der Animation in animation.html
ABSTAND = 0.22        # Pause zwischen zwei Sätzen
SCHLUSS = 1.8         # Schlusskarte steht nach dem letzten Wort noch so lange
TEMPO = 1.35          # > 1 = langsamer, ruhiger
SZENEN = [0, 3.5, 6.3, 11.5, 16.8, 21.6, 26.5]   # Szenengrenzen in animation.html

# (Zeitpunkt in der Animation, an dem der passende Text erscheint, gesprochener Satz).
# Schreibweise für die Aussprache: „Karkura“, „Wotsäpp“, Zahlen ausgeschrieben.
SAETZE = [
    (0.25, "Dein Handy hat eine Hülle."),
    (0.80, "Und dein Lack?"),
    (3.75, "Keramik ist eine Schicht mehr."),
    (4.30, "Hauchdünn, und glatt."),
    (6.65, "Sonne macht Klarlack mit der Zeit stumpf."),
    (7.55, "Die Keramik bremst das."),
    (9.30, "Ganz aufhalten kann sie es nicht."),
    (11.80, "Ohne Keramik bleibt Wasser flach liegen."),
    (13.10, "Mit Keramik perlt es ab."),
    (17.00, "Der Dreck haftet schlechter."),
    (18.60, "Beim Waschen geht er leichter runter."),
    (20.40, "Waschen musst du trotzdem."),
    (22.30, "Keramikversiegelung ab siebenhundert Euro."),
    (23.30, "Schick uns drei Fotos per Wotsäpp."),
]
KETTE = ("highpass=f=70,equalizer=f=180:t=q:w=1:g=2,equalizer=f=3500:t=q:w=1.2:g=2.5,"
         "acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,loudnorm=I=-14:TP=-1.5:LRA=7")


def ff(*a):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *a], check=True)


def main():
    py, modell = os.environ["PIPER_PY"], os.environ["PIPER_MODELL"]
    TMP.mkdir(parents=True, exist_ok=True)
    dauern = []
    for i, (_, satz) in enumerate(SAETZE):
        roh, fertig = TMP / f"roh_{i:02d}.wav", TMP / f"s_{i:02d}.wav"
        subprocess.run([py, "-m", "piper", "-m", modell, "-f", str(roh), "--length-scale", str(TEMPO),
                        "--sentence-silence", "0"], input=satz, text=True, check=True, capture_output=True)
        ff("-i", str(roh), "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
           "silenceremove=start_periods=1:start_threshold=-45dB,areverse", "-ar", "48000", "-ac", "1", str(fertig))
        with wave.open(str(fertig)) as w:
            dauern.append(w.getnframes() / w.getframerate())

    # Zeitkarte: Jede Szene wird gleichmäßig so weit gedehnt, dass ihre Sätze hineinpassen (nie gestaucht).
    # Ein Satz startet, wenn sein Text erscheint, aber nie bevor der vorige zu Ende ist.
    punkte, faktoren = [(0.0, 0.0)], []
    for j in range(len(SZENEN) - 1):
        a0, a1 = SZENEN[j], SZENEN[j + 1]
        idx = [k for k, (a, _) in enumerate(SAETZE) if a0 <= a < a1]
        noetig = (SAETZE[idx[0]][0] - a0) + sum(dauern[k] for k in idx) + ABSTAND * (len(idx) - 1) \
            + (SCHLUSS if j == len(SZENEN) - 2 else .5)
        f = max(1.0, noetig / (a1 - a0)); faktoren.append(f)
        punkte.append((a1, punkte[-1][1] + (a1 - a0) * f))
    def neu(a):
        for (a1, n1), (a2, n2) in zip(punkte, punkte[1:]):
            if a <= a2: return n1 + (a - a1) / (a2 - a1) * (n2 - n1)
    starts = []
    for k, (a, _) in enumerate(SAETZE):
        starts.append(max(neu(a), starts[-1] + dauern[k - 1] + ABSTAND) if k else neu(a))
    ende = max(punkte[-1][1], starts[-1] + dauern[-1] + SCHLUSS)
    punkte[-1] = (DAUER, ende)
    dehnung = max(faktoren)

    eing, filt = [], []
    for i, s in enumerate(starts):
        eing += ["-i", str(TMP / f"s_{i:02d}.wav")]
        ms = int(round(s * 1000))
        filt.append(f"[{i}]adelay={ms}|{ms}[d{i}]")
    filt.append("".join(f"[d{i}]" for i in range(len(starts))) + f"amix=inputs={len(starts)}:normalize=0,{KETTE},"
                f"apad=whole_dur={ende:.3f},atrim=0:{ende:.3f}[a]")
    ff(*eing, "-filter_complex", ";".join(filt), "-map", "[a]", "-ar", "48000", "-ac", "2", str(AUS / "stimme.wav"))

    json.dump({"dauer": round(ende, 3), "punkte": [[round(n, 3), a] for a, n in punkte],
               "saetze": [{"text": t, "start": round(s, 2), "dauer": round(d, 2)} for (_, t), s, d in zip(SAETZE, starts, dauern)]},
              open(AUS / "karte.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"Videolänge {ende:.1f} s, stärkste Dehnung {dehnung:.2f}×")
    for (_, t), s, d in zip(SAETZE, starts, dauern):
        print(f"{s:6.2f}s  {d:4.2f}s  {t}")


if __name__ == "__main__":
    main()
