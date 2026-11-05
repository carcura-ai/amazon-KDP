import re, sys, os, html, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from edits import *
D = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(D, '..', 'rebuild')
rd = lambda p: open(p, encoding='utf-8').read()
L = {n: rd(f'{D}/live_{n}.html') for n in ['leistungen', 'anfragen', 'auto-innenreinigung', 'geruch-im-auto-entfernen', 'wohnmobil-aufbereitung', 'autopolitur', 'leasingrueckgabe-aufbereitung', 'hol-und-bringservice']}
out = {}
h = apply_rules(L['leistungen'], LEISTUNGEN, 'leistungen'); h = leistungen_extra(h); h = apply_rules(h, SCHNELL, 'schnell@leistungen'); out['leistungen'] = h
h = apply_rules(L['auto-innenreinigung'], INNEN, 'innen'); h = apply_rules(h, SCHNELL, 'schnell@innen'); out['auto-innenreinigung'] = h
h = apply_rules(L['geruch-im-auto-entfernen'], GERUCH, 'geruch'); h, n = geruch_extra(h); print('geruch_extra', n); h = apply_rules(h, SCHNELL, 'schnell@geruch'); out['geruch-im-auto-entfernen'] = h
h = apply_rules(L['anfragen'], ANFRAGEN, 'anfragen'); h, n = anfragen_extra(h); print('anfragen_extra', n)
# Schnellanfrage-Block (aus Leistungen v2) vor dem Footer in Anfragen einsetzen
out['anfragen'] = h
h = apply_rules(L['wohnmobil-aufbereitung'], WOHNMOBIL, 'wohnmobil'); h = apply_rules(h, SCHNELL, 'schnell@womo'); out['wohnmobil-aufbereitung'] = h
h = apply_rules(L['autopolitur'], POLITUR, 'politur'); h = apply_rules(h, SCHNELL, 'schnell@politur'); out['autopolitur'] = h
h = apply_rules(L['leasingrueckgabe-aufbereitung'], LEASING, 'leasing'); h = apply_rules(h, SCHNELL, 'schnell@leasing'); out['leasingrueckgabe-aufbereitung'] = h
h = apply_rules(L['hol-und-bringservice'], HOLBRING, 'holbring'); h = apply_rules(h, SCHNELL, 'schnell@holbring'); out['hol-und-bringservice'] = h
for n, h in out.items():
    h = h.replace('<head>', '<head><base href="https://carcura.info/">', 1)
    open(f'{D}/v2_{n}.html', 'w', encoding='utf-8').write(h)
# neue Seiten-Vorschauen
css = re.search(r'<style>\.cc-lp,\.cc-lp \*.*?</style>', L['auto-innenreinigung'], re.S).group(0)
extra = rd(f'{R}/extra.css')
for n in ['startseite', 'keramik', 'flecken', 'tierhaare']:
    body = rd(f'{R}/{n}.html')
    open(f'{R}/prev_{n}.html', 'w', encoding='utf-8').write('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="https://carcura.info/"><style>body{margin:0;background:#09090a}</style>' + css + '<style>' + extra + '</style></head><body>' + body + '</body></html>')
# Vorauswahl-Test: alle ?leistung=-Links gegen die Formular-Werte
vals = [html.unescape(v) for v in re.findall(r'name="leistung" value="([^"]*)"', out['anfragen'])]
norm = lambda t: re.sub(r'[^a-z0-9]+', '', t.lower().replace('ä', 'a').replace('ö', 'o').replace('ü', 'u').replace('ß', 'ss'))
def match(w):
    for v in vals:
        if v == w: return v
    nw = norm(w)
    if 'holbring' in nw: return '(Hol & Bring)'
    for v in vals:
        nb = norm(v)
        if nw and (nb == nw or nw in nb or nb in nw): return v
    return None
srcs = {**{n: out[n] for n in out}, **{n: rd(f'{R}/{n}.html') for n in ['startseite', 'keramik', 'flecken', 'tierhaare']}}
bad = 0
for n, h in srcs.items():
    for href in sorted(set(re.findall(r'/anfragen/\?([^"#]*)', h))):
        for w in urllib.parse.parse_qs(html.unescape(href)).get('leistung', []):
            m = match(w)
            if not m or norm(m) != norm(w) and m in ('Innenraumreinigung Normal',) and 'tier' in norm(w): bad += 1
            print(('OK ' if m else '!! ') + f'{n}: {w!r} -> {m!r}')
print('Fehlende Vorauswahl:', bad)
