# GPU-Prüfung (2026-08-25)

```
nvidia-smi: nicht gefunden (keine NVIDIA-Treiber/-Tools installiert)
Win32_VideoController: Intel(R) UHD Graphics, 1 GB gemeldetes AdapterRAM, keine CUDA-Unterstützung
```

**Ergebnis: Keine nutzbare GPU vorhanden.** Fooocus läuft ausschließlich CPU-only (`--always-cpu`).
Eine einzelne Bildgenerierung (1152×896, Performance „Speed") dauerte **~94 Minuten** für das
Miro-Referenzblatt — bestätigt empirisch, dass GPU-Beschleunigung fehlt und Generierung nur mit
erheblichem Zeitaufwand „sinnvoll" im Sinne von Schritt 8 möglich ist. Für die zwei angeforderten
Referenzblätter (Miro, Lotte) wurde das dennoch durchgeführt; 24 Szenenbilder in dieser Geschwindigkeit
würden ca. 36+ Stunden reine Rechenzeit benötigen — nicht Teil dieses Laufs, siehe `referenzblaetter.md`.
