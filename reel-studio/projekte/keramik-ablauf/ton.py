"""Tonspur: Stimme (stimme/s_<i>.wav auf voice.<i>-Zeiten) + Effekte (mix.py) → out/ton.wav (-14 LUFS, Spitze ≤ -1,5 dBTP).
Aufruf: python3 ton.py   (danach: ffmpeg -i stumm.mp4 -i out/ton.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k final.mp4)"""
import json, subprocess, numpy as np
SR = 48000
ev = {e['name']: e['t'] for e in json.load(open('out/events.json'))}; L = ev['end']
subprocess.run(['python3', 'scripts/mix.py', 'cues.json', 'out/sfx.wav', '--lib', 'sounds', '--events', 'out/events.json', '--len', str(L), '--gain', '0'], check=True)
def load(p): return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32).reshape(-1, 2)
mix = np.zeros((int(L * SR) + SR, 2), np.float32); sfx = load('out/sfx.wav'); mix[:len(sfx)] += sfx * 0.75
z = json.load(open('stimme/zeitplan.json'))
for s in z['saetze']:
    v = load(f"stimme/{s['datei']}"); v = v / (np.abs(v).max() + 1e-9) * 0.9; st = int(ev[f"voice.{s['i']}"] * SR); mix[st:st + len(v)] += v
mix = mix[:int(L * SR)]
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7', '-c:a', 'pcm_s24le', 'out/ton.wav'], input=mix.tobytes(), check=True)
print('ton.wav', round(L, 2), 's')
