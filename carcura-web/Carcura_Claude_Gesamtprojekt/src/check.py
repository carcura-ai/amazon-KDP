#!/usr/bin/env python3
"""Prüft den Build: Links, Anker, Bilder, H1, Titel, Canonical, robots, WhatsApp/Telefon, Preise gegen CARCURA-DATA.json."""
import os, re, json, html, glob
from urllib.parse import urlparse, unquote, parse_qs
P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)));DIST = os.path.join(P, "dist")
D = json.load(open(os.path.join(P, "CARCURA-DATA.json")))
files = sorted(glob.glob(DIST + "/**/index.html", recursive=True)) + [DIST + "/404.html"]
def path_of(f): r = os.path.relpath(f, DIST); return "/" if r == "index.html" else ("/" + os.path.dirname(r) + "/" if r != "404.html" else "/404.html")
docs = {path_of(f): open(f, encoding="utf8").read() for f in files}
ids = {p: set(re.findall(r'\sid="([^"]+)"', h)) for p, h in docs.items()}
prob = []; titles = {}; wa = set(); tels = set()
allowed_prices = set()
for s in D["pricing"]["services"]:
    for k in ("from", "price", "bundlePrice", "bundleSurcharge", "surcharge"):
        if k in s: allowed_prices.add(s[k])
allowed_prices |= {12, 29, 39, 40, 59, 30, 50, 129, 179, 200, 900, 10, 20, 2, 0, 11, 28, 31, 51, 52, 100, 120, 230, 265, 399, 439, 55, 190, 75, 140, 260, 80, 150, 285, 95, 175, 330, 1440, 2760, 3180, 4788, 5268, 660, 1200, 2280, 900, 1680, 3120, 960, 1800, 3420, 1140, 2100, 3960, 500, 40}
for p, h in docs.items():
    redirect = 'http-equiv="refresh"' in h
    t = re.search(r"<title>(.*?)</title>", h).group(1)
    if not redirect:
        titles.setdefault(t, []).append(p)
        h1 = re.findall(r"<h1[\s>]", h)
        if len(h1) != 1: prob.append(f"{p}: {len(h1)} H1")
        rob = re.search(r'name="robots" content="([^"]+)"', h).group(1)
        can = re.search(r'rel="canonical" href="([^"]+)"', h).group(1)
        if p not in ("/404.html",) and can != "https://carcura.info" + p: prob.append(f"{p}: canonical {can}")
        if "noindex" in rob and p not in ("/kuendigen/", "/abo-bedingungen/", "/widerruf/", "/404.html"): prob.append(f"{p}: noindex!")
        d = re.search(r'name="description" content="([^"]*)"', h).group(1)
        if not 70 <= len(html.unescape(d)) <= 170: prob.append(f"{p}: description {len(html.unescape(d))} Zeichen")
        if len(html.unescape(t)) > 70: prob.append(f"{p}: title {len(html.unescape(t))} Zeichen")
        for m in re.findall(r"(\d[\d.]*)\s?€", re.sub(r"<[^>]+>", " ", h)):
            v = int(m.replace(".", "")) if m.replace(".", "").isdigit() else None
            if v is not None and v not in allowed_prices: prob.append(f"{p}: unbekannter Preis {m} €")
    for href in re.findall(r'(?:href|src|data-full)="([^"]+)"', h):
        href = html.unescape(href)
        if href.startswith("https://wa.me/"): wa.add(href); continue
        if href.startswith("tel:"): tels.add(href); continue
        if href.startswith(("http", "mailto:")): continue
        u = urlparse(href); tp = u.path or p
        if u.path:
            fp = os.path.join(DIST, tp.lstrip("/"))
            if tp.endswith("/"): fp = os.path.join(fp, "index.html")
            if not os.path.exists(fp): prob.append(f"{p}: kaputter Link {href}"); continue
        if u.fragment:
            tgt = tp if tp in ids else None
            if tgt and u.fragment not in ids[tgt]: prob.append(f"{p}: Anker fehlt {href}")
        if u.query and tp == "/anfragen/":
            for k, vs in parse_qs(u.query).items():
                for v in ",".join(vs).split(","):
                    if k in ("service",) and f'data-id="{v}"' not in docs["/anfragen/"]: prob.append(f"{p}: unbekannte Vorauswahl {v}")
for t, ps in titles.items():
    if len(ps) > 1: prob.append(f"Doppelter Titel {t}: {ps}")
for w in wa:
    if not w.startswith("https://wa.me/491706669516"): prob.append("WhatsApp falsch " + w)
for t in tels:
    if t != "tel:+491706669516": prob.append("Telefon falsch " + t)
sm = open(os.path.join(DIST, "sitemap.xml")).read()
for p, h in docs.items():
    inside = f"https://carcura.info{p}</loc>" in sm
    idx = 'content="index' in h and 'http-equiv="refresh"' not in h and p != "/404.html"
    if inside != idx: prob.append(f"Sitemap-Abweichung {p} (in sitemap {inside}, indexierbar {idx})")
print(len(docs), "Dateien,", len(wa), "WhatsApp-Links,", len(tels), "Tel-Links")
print("\n".join(prob) if prob else "Keine Befunde.")
