#!/usr/bin/env python3
"""Carcura – erzeugt die statische Website unter dist/ aus CARCURA-DATA.json und den Inhalten unten.
Aufruf: python3 src/build.py   (aus dem Ordner Carcura_Claude_Gesamtprojekt)
Preise, Kontakt und Öffnungszeiten kommen ausschließlich aus CARCURA-DATA.json."""
import json, html, os, re, datetime
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
DIST = os.path.join(PROJ, "dist")
D = json.load(open(os.path.join(PROJ, "CARCURA-DATA.json"), encoding="utf8"))
B = D["business"]
S = {s["id"]: s for s in D["pricing"]["services"]}
SITE = "https://carcura.info"
TODAY = datetime.date(2026, 11, 23)  # Stand der Daten; bei neuem Build anpassen
PROMO = D["promotion"]
PROMO_END = datetime.date.fromisoformat(PROMO["validUntil"])
PROMO_ON = TODAY <= PROMO_END
REV = B["googleReviews"]
E = html.escape
PAGES = []  # (pfad, title, robots) für Sitemap und Prüfungen


def eur(n):
    s = f"{n:,.0f}".replace(",", ".")
    return f"{s} €"


def ab(i):
    s = S[i]
    if "from" in s:
        return "ab " + eur(s["from"])
    if "price" in s:
        return eur(s["price"])
    return "+" + eur(s["surcharge"])


def wa(text):
    return B["whatsappBase"] + "?text=" + quote(text, safe="")


def wa_service(name):
    return wa(f"Hi Carcura, ich möchte einen Preis für {name} anfragen. Mein Fahrzeug: ")


def anf(*ids, pickup=False):
    u = "/anfragen/?service=" + ",".join(ids)
    return u + ("&abholung=1" if pickup else "")


ICON = {
    "wa": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.3-4.2A8 8 0 1 1 8.2 18.7z"/></svg>',
    "tel": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    "arrow": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "menu": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
}


def btn(href, label, kind="acc", icon=None, service="", ext=False):
    a = f' data-service="{E(service)}"' if service else ""
    t = ' target="_blank" rel="noopener"' if ext else ""
    ic = ICON.get(icon, "")
    if icon == "arrow":
        return f'<a class="btn btn-{kind}" href="{E(href)}"{a}{t}>{E(label)}{ic}</a>'
    return f'<a class="btn btn-{kind}" href="{E(href)}"{a}{t}>{ic}{E(label)}</a>'


def wa_btn(name, label="Preis per WhatsApp anfragen", kind="ghost"):
    return btn(wa_service(name), label, kind, "wa", service=name, ext=True)


def promo_html(cls="promo"):
    if not PROMO_ON:
        return ""
    end = (PROMO_END + datetime.timedelta(days=1)).isoformat()
    return (f'<p class="{cls}" data-ende="{end}T00:00:00"><b>Aktion bis {PROMO_END.strftime("%d.%m.%Y")}:</b> '
            f'Bei Terminvereinbarung für eine Keramikversiegelung bis zum {PROMO_END.strftime("%d.%m.%Y")} gibt es ein Nanolex-Waschset dazu, '
            f'auch beim Gutschein für eine Keramikversiegelung. <a class="tlink" href="/keramikversiegelung/#aktion">Details</a></p>')


# ---------------------------------------------------------------- Rahmen
NAV = [("/leistungen/", "Leistungen"), ("/leistungen/#preise", "Preise"), ("/galerie/", "Galerie"), ("/ueber-uns/", "Über uns")]
MORE = [("/hol-und-bringservice/", "Hol- & Bringservice"), ("/firmenkunde/", "Händler & Firmen"), ("/gutschein/", "Gutschein"),
        ("/partner/", "Partner"), ("/fahrzeugaufbereitung-westerwald/", "Einzugsgebiet")]


def nav(path):
    cta = "#anfrage" if path == "/anfragen/" else "/anfragen/"
    def cur(h):
        return ' aria-current="page"' if h.split("#")[0] == path and "#" not in h else ""
    links = "".join(f'<li><a href="{h}"{cur(h)}>{E(t)}</a></li>' for h, t in NAV)
    more = "".join(f'<li><a href="{h}"{cur(h)}>{E(t)}</a></li>' for h, t in MORE)
    dl = "".join(f'<li><a href="{h}">{E(t)}</a></li>' for h, t in [("/", "Start")] + NAV + [("/anfragen/", "Anfragen")])
    ds = "".join(f'<li class="sub"><a href="{h}">{E(t)}</a></li>' for h, t in MORE + [("/auto-innenreinigung/", "Innenreinigung"), ("/autopolitur/", "Politur"), ("/keramikversiegelung/", "Keramikversiegelung")])
    return f'''<a class="skip" href="#main">Zum Inhalt springen</a>
<header class="nav" aria-label="Hauptnavigation">
 <a class="nav-logo" href="/" aria-label="Carcura Startseite"><img src="/assets/img/carcura-logo-weiss.webp" alt="Carcura Fahrzeugaufbereitung" width="92" height="46"></a>
 <nav aria-label="Seiten"><ul class="nav-links">{links}</ul></nav>
 <div class="nav-more"><button type="button" aria-expanded="false" aria-haspopup="true">Mehr</button><ul>{more}</ul></div>
 {btn(cta, "Termin anfragen")}
 <button class="menu-btn" type="button" aria-expanded="false" aria-controls="drawer" aria-label="Menü öffnen">{ICON["menu"]}</button>
</header>
<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Menü"><button class="drawer-close" type="button" aria-label="Menü schließen">×</button>
 <ul>{dl}</ul><ul>{ds}</ul>
 <div class="btns">{btn(B["phoneHref"], "0170 6669516 anrufen", "ghost", "tel")}{btn(wa("Hi Carcura, "), "WhatsApp", "ghost", "wa", ext=True)}</div></div>'''


def hours_html():
    names = {"Monday": "Mo", "Tuesday": "Di", "Wednesday": "Mi", "Thursday": "Do", "Friday": "Fr", "Saturday": "Sa", "Sunday": "So"}
    out = []
    for h in B["hours"]:
        ds = h["days"]
        lab = names[ds[0]] + ("–" + names[ds[-1]] if len(ds) > 1 else "")
        out.append(f"{lab} {h['opens']}–{h['closes']} Uhr")
    return "<br>".join(out)


def footer(path="/"):
    cta = "#anfrage" if path == "/anfragen/" else "/anfragen/"
    cols = [
        ("Leistungen", [("/leistungen/", "Alle Leistungen & Preise"), ("/auto-innenreinigung/", "Auto-Innenreinigung"), ("/autopolitur/", "Autopolitur"),
                         ("/keramikversiegelung/", "Keramikversiegelung"), ("/leasingrueckgabe-aufbereitung/", "Leasingrückgabe & Verkauf"),
                         ("/scheinwerfer-aufbereiten/", "Scheinwerfer aufbereiten"), ("/autositz-reinigen-flecken/", "Flecken im Sitz"),
                         ("/tierhaare-auto-entfernen/", "Tierhaare entfernen"), ("/geruch-im-auto-entfernen/", "Geruch entfernen"),
                         ("/spezialreinigung-auto/", "Dampf- & Spezialreinigung"), ("/wohnmobil-aufbereitung/", "Wohnmobil")]),
        ("Carcura", [("/ueber-uns/", "Über uns"), ("/galerie/", "Galerie"), ("/hol-und-bringservice/", "Hol- & Bringservice"), ("/firmenkunde/", "Händler & Firmen"),
                     ("/partner/", "Partner"), ("/gutschein/", "Gutschein"), ("/anfragen/", "Anfragen")]),
        ("Einzugsgebiet", [("/fahrzeugaufbereitung-altenkirchen/", "Altenkirchen"), ("/fahrzeugaufbereitung-westerwald/", "Westerwald"),
                           ("/fahrzeugaufbereitung-asbach/", "Asbach"), ("/fahrzeugaufbereitung-hachenburg/", "Hachenburg"),
                           ("/fahrzeugaufbereitung-wissen/", "Wissen & Betzdorf"), ("/fahrzeugaufbereitung-neuwied/", "Neuwied")]),
    ]
    c = "".join(f'<div><h2>{E(t)}</h2><ul>{"".join(f"<li><a href=\"{h}\">{E(x)}</a></li>" for h, x in l)}</ul></div>' for t, l in cols)
    return f'''<footer class="foot">
 <div class="wrap"><p class="big" aria-hidden="true">Glanz ist Handarbeit</p>
 <div class="foot-grid"><div><h2>Kontakt</h2><address>{E(B["name"])}<br>{E(B["street"])}<br>{B["postcode"]} {E(B["city"])}<br>
 <a href="{B["phoneHref"]}" data-service="footer">{E(B["phoneDisplay"])}</a><br><a href="mailto:{B["email"]}">{B["email"]}</a><br>
 <a href="{wa("Hi Carcura, ")}" target="_blank" rel="noopener" data-service="footer">WhatsApp schreiben</a><br>
 <a href="{B["instagram"]}" target="_blank" rel="noopener">Instagram @_carcura_</a></address>
 <p class="fine" style="margin-top:14px">{hours_html()}<br>{E(B["hoursNote"])}</p></div>{c}</div>
 <div class="legal"><span>© {TODAY.year} Carcura GbR · Fahrzeugaufbereitung in Walterschen bei Altenkirchen</span><a href="/impressum/">Impressum</a><a href="/datenschutz/">Datenschutz</a>
 <a href="/cookie-richtlinie-eu/">Cookie-Richtlinie</a><a href="/abo-bedingungen/">Abo-Bedingungen</a><a href="/kuendigen/">Verträge hier kündigen</a><a href="/widerruf/">Widerruf</a></div>
 <p class="fine" style="margin-top:14px">Alle Preise sind Endpreise. Als Kleinunternehmer nach § 19 UStG weisen wir keine Umsatzsteuer aus.</p></div>
</footer>
<div class="mbar" aria-label="Schnellkontakt"><a href="{B["phoneHref"]}" data-service="mbar">{ICON["tel"]}Anrufen</a><a href="{wa("Hi Carcura, ")}" target="_blank" rel="noopener" data-service="mbar">{ICON["wa"]}WhatsApp</a><a class="acc" href="{cta}">{"Zum Formular" if cta == "#anfrage" else "Anfragen"}</a></div>'''


def ld_business():
    days = []
    for h in B["hours"]:
        days.append({"@type": "OpeningHoursSpecification", "dayOfWeek": h["days"], "opens": h["opens"], "closes": h["closes"]})
    return {"@context": "https://schema.org", "@type": "AutomotiveBusiness", "@id": SITE + "/#business", "name": "Carcura", "legalName": B["name"],
            "url": SITE + "/", "telephone": "+491706669516", "email": B["email"], "image": SITE + "/assets/img/carcura-team-alexander-richy.webp",
            "logo": SITE + "/assets/img/carcura-logo-weiss.webp", "priceRange": "€€",
            "address": {"@type": "PostalAddress", "streetAddress": B["street"], "postalCode": B["postcode"], "addressLocality": B["city"], "addressRegion": "Rheinland-Pfalz", "addressCountry": "DE"},
            "openingHoursSpecification": days, "founder": [{"@type": "Person", "name": n} for n in B["owners"]],
            "areaServed": [{"@type": "City", "name": n} for n in ["Walterschen", "Altenkirchen", "Weyerbusch", "Flammersfeld", "Asbach", "Hachenburg", "Wissen", "Neuwied"]] + [{"@type": "AdministrativeArea", "name": "Westerwald"}],
            "sameAs": [B["instagram"], REV["profile"]]}


def page(path, title, desc, body, robots="index,follow", ld=None, js=(), crumbs=None, canonical=None):
    PAGES.append((path, title, robots))
    can = canonical or (SITE + path) if canonical is not False else ""
    lds = [ld_business()] + (ld or [])
    if crumbs:
        lds.append({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + h} for i, (h, n) in enumerate([("/", "Start")] + crumbs)]})
    ldtxt = "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in lds)
    scripts = "".join(f'<script src="/assets/js/{j}" defer></script>' for j in ("site.js",) + tuple(js))
    doc = f'''<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<meta name="robots" content="{robots}">
{"" if canonical is False else f'<link rel="canonical" href="{E(can)}">'}
<meta property="og:type" content="website"><meta property="og:locale" content="de_DE"><meta property="og:site_name" content="Carcura">
<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}"><meta property="og:url" content="{E(can)}">
<meta property="og:image" content="{SITE}/assets/img/carcura-team-alexander-richy.webp">
<meta name="theme-color" content="#07070a">
<link rel="icon" href="/assets/img/carcura-logo-weiss.webp">
<link rel="preload" href="/assets/fonts/bigshoulders.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css">
{ldtxt}
</head>
<body>
{nav(path)}
<main id="main">
{body}
</main>
{footer(path)}
{scripts}
</body>
</html>
'''
    out = os.path.join(DIST, path.strip("/"), "index.html") if path != "/" else os.path.join(DIST, "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf8").write(doc)


def redirect(path, target):
    """Platzhalter für die lokale Vorschau. In Produktion als echte 301-Weiterleitung einrichten (siehe audit/URL-MAPPING.csv)."""
    out = os.path.join(DIST, path.strip("/"), "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf8").write(f'''<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Weiterleitung</title>
<meta name="robots" content="noindex,follow"><link rel="canonical" href="{SITE}{target}"><meta http-equiv="refresh" content="0;url={target}"><script>location.replace("{target.split('#')[0]}"+location.search+"{('#' + target.split('#')[1]) if '#' in target else ''}")</script></head>
<body><p>Diese Seite ist umgezogen: <a href="{target}">{target}</a></p></body></html>''')


# ---------------------------------------------------------------- Bausteine
def crumb(items):
    parts = ['<a href="/">Start</a>'] + [f'<a href="{h}">{E(n)}</a>' if h else E(n) for h, n in items]
    return '<nav class="crumb" aria-label="Brotkrumen">' + " / ".join(parts) + "</nav>"


def faq_html(items, title="Häufige Fragen", label="Gut zu wissen", light=False):
    det = "".join(f"<details><summary>{E(q)}</summary><div><p>{a}</p></div></details>" for q, a in items)
    return f'''<section class="sec{' light' if light else ''}"><div class="wrap"><p class="label">{label}</p><h2>{title}</h2><div class="faq">{det}</div></div></section>'''


def faq_ld(items):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub("<[^>]+>", "", a)}} for q, a in items]}


def li(items, cls=""):
    return "".join(f'<li{f" class=\"{cls}\"" if cls else ""}>{x}</li>' for x in items)


def photo(src, alt, cap="", ratio="ratio-45", eager=False):
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    c = f"<figcaption>{cap}</figcaption>" if cap else ""
    return f'<figure class="photo"><div class="{ratio}"><img src="/assets/img/{src}" alt="{E(alt)}" {load} decoding="async"></div>{c}</figure>'


def ba(before, after, alt_b, alt_a, cap, ratio="9/12"):
    return f'''<figure style="margin:0"><div class="ba" style="aspect-ratio:{ratio}"><img src="/assets/img/{before}" alt="{E(alt_b)}" loading="lazy"><img class="ba-top" src="/assets/img/{after}" alt="{E(alt_a)}" loading="lazy">
<span class="ba-line"></span><span class="ba-l">Vorher</span><span class="ba-r">Nachher</span>
<input type="range" min="0" max="100" value="50" aria-label="Vorher-Nachher-Vergleich verschieben: {E(cap)}"></div><figcaption class="cap">{cap}</figcaption></figure>'''


QUOTES = {
    "tt": ("… super beeindruckend was die jungs aus meinem alten lack rausgeholt haben und die keramikversieglung ist wirklich ein MUSS.", "Google-Bewertung · Audi TT 8n · Politur & Keramik · Nov. 2026"),
    "m2": ("Ich war mit meinem M2 G87 bei Carcura für eine Keramikversiegelung und bin mit dem Ergebnis wirklich super zufrieden!", "Marlon L. · Google-Bewertung · BMW M2 · Keramik · Okt. 2026"),
    "daniel": ("Mein Auto wurde professionell versiegelt und das Ergebnis ist wirklich top. … Man merkt einfach, dass hier Wert auf saubere Arbeit und Details gelegt wird.", "Daniel R. · Google-Bewertung · Keramikversiegelung · Aug. 2026"),
    "tobias": ("Nach Terminabsprache wurde das Fahrzeug pünktlich geholt und sogar schneller gebracht als abgesprochen. Gerne wieder", "Tobias · Google-Bewertung · mit Hol- und Bringservice"),
}


def quote_html(k):
    t, f = QUOTES[k]
    return f'<blockquote class="quote rv"><p>„{E(t)}“</p><footer>{E(f)}</footer></blockquote>'


def rating_line():
    return (f'<a href="{REV["profile"]}" target="_blank" rel="noopener">{str(REV["displayedRating"]).replace(".", ",")} von 5 Sternen aus {REV["displayedCount"]} Google-Bewertungen</a>'
            f' <span class="muted">(Stand {TODAY.strftime("%d.%m.%Y")})</span>')


def price_card(i, title, result, bullets, href, extra="", tag=""):
    t = f'<span class="tag">{tag}</span>' if tag else ""
    return f'''<article class="card rv">{t}<h3>{title}</h3><p class="muted small" style="margin:0">{result}</p>
<p class="price">{ab(i)}</p><ul>{li(bullets)}</ul>{extra}
<div class="btns"><a class="btn btn-ghost" href="{href}">Details & Umfang</a><a class="btn btn-acc" href="{anf(i)}">Anfragen</a></div></article>'''


def cta_band(title, text, service_id, service_name):
    ids = service_id if isinstance(service_id, (list, tuple)) else ([service_id] if service_id else [])
    href = anf(*ids) if ids else "/anfragen/"
    label = "Anfrage mit Leistung starten" if ids else "Anfrage starten"
    return f'''<section class="sec studio"><div class="wrap two"><div><p class="label">Nächster Schritt</p><h2>{title}</h2></div>
<div><p class="lead">{text}</p><div class="btns">{btn(href, label, "acc", "arrow")}{wa_btn(service_name)}{btn(B["phoneHref"], "0170 6669516", "ghost", "tel", service=service_name)}</div>
<p class="fine" style="margin-top:14px">Bis 10 km um Walterschen holen wir kostenlos ab, darüber 2 € pro Kilometer (einfache Strecke, hin und zurück inklusive).</p></div></div></section>'''


# ---------------------------------------------------------------- Startseite
FILM = [
    ("00-dreckig", "Außenwäsche · 1/4", "So kommt es oft an.", "Straßenschmutz, Bremsstaub, Insekten. Erst wird alles eingeweicht, damit nichts über den Lack gerieben wird.", 0, "wipe", "handwaesche"),
    ("01-schaum", "Außenwäsche · 1/4", "Vorwäsche mit Schaum.", "Der Schaum löst den groben Schmutz und läuft mit ihm nach unten ab, bevor ein Handschuh den Lack berührt.", 0, "wipe", "handwaesche"),
    ("02-gespuelt", "Außenwäsche · 1/4", "Abspülen. Von oben nach unten.", "Danach folgt die Handwäsche, Felgen und Reifen inklusive.", 0, "wipe", "handwaesche"),
    ("03-sauber", "Außenwäsche · 1/4", "Außen sauber. Bis ins Detail.", "Getrocknet mit Mikrofaser, Scheiben außen klar.", 0, "cut", "handwaesche"),
    ("04-seite", "Innenraum · 2/4", "Wieder gerne einsteigen.", "Jetzt geht es nach innen.", 1, "cut", "innen-normal"),
    ("05-tuer", "Innenraum · 2/4", "Fahrertür auf.", "Sitze, Fußraum, Cockpit, Türverkleidungen: Wir arbeiten uns Fläche für Fläche durch.", 1, "cut", "innen-normal"),
    ("06-innen-vorher", "Innenraum · 2/4", "Vorher: Sand und Krümel.", "Typisch nach Winter, Kindern oder Baustelle.", 1, "wipe", "innen-normal"),
    ("07-innen-nachher", "Innenraum · 2/4", "Nachher: gesaugt und gewischt.", "Flecken im Stoff, Tierhaare und Geruch sind Zusatzleistungen mit eigenem Preis.", 1, "cut", "innen-normal"),
    ("08-politur-vorher", "Politur · 3/4", "Swirls unter Prüflicht.", "Feine Kringel im Klarlack. Die Maschinenpolitur trägt eine hauchdünne Schicht ab.", 2, "wipe", "politur-1"),
    ("09-politur-nachher", "Politur · 3/4", "Nach der Politur.", "Waschkratzer verschwinden oder werden deutlich milder. Kratzer bis in die Farbe bleiben sichtbar, das sagen wir dir vorher.", 2, "cut", "politur-1"),
    ("10-keramik-auftrag", "Keramik · 4/4", "Keramik auftragen.", "Auf den polierten und entfetteten Lack, Bauteil für Bauteil.", 3, "cut", "keramik"),
    ("11-keramik-abnehmen", "Keramik · 4/4", "Überschuss abnehmen.", "Nach kurzem Ablüften wird nachpoliert. Dann härtet die Schicht in unserer Halle aus.", 3, "cut", "keramik"),
    ("12-wasser", "Keramik · 4/4", "Wasser auf dem Lack.", "Der Test nach der Aushärtung: Wasser läuft über die versiegelte Fläche.", 3, "cut", "keramik"),
    ("13-perlen", "Keramik · 4/4", "Wasser perlt ab.", "Schmutz haftet schlechter, die nächste Wäsche geht leichter. Die Haltbarkeit hängt von Pflege und Nutzung ab.", 3, "cut", "keramik"),
    ("14-ergebnis", "Ergebnis", "Dein Auto. Wieder sauber.", "Ende der Inszenierung. Echte Fotos aus unserer Halle siehst du weiter unten.", -1, "cut", None),
]
FILM_PRICE = {"handwaesche": ("Handwäsche inkl. Felgen " + ab("handwaesche"), "/leistungen/#preise", "Preise"),
              "innen-normal": ("Innenreinigung " + ab("innen-normal") + " · Polster-Tiefenreinigung als Zusatz +59 €", "/auto-innenreinigung/", "Umfang"),
              "politur-1": ("1-stufige Politur " + ab("politur-1") + " · 2-stufig " + ab("politur-2"), "/autopolitur/", "Wann welche Stufe?"),
              "keramik": ("Keramik inkl. 1-stufiger Politur " + ab("keramik"), "/keramikversiegelung/", "Was enthalten ist")}


def film_html():
    data = []
    for src, lab, tit, txt, ch, tr, sid in FILM:
        pr, href, link = FILM_PRICE.get(sid, ("Termin anfragen", "/anfragen/", "Zur Anfrage"))
        data.append({"src": f"/assets/film/{src}.webp", "label": lab, "title": tit, "text": txt, "chapter": ch, "trans": tr, "price": E(pr), "href": href, "link": link})
    nav = "".join(f'<button type="button" data-chapter="{c}" data-frame="{f}">{n}</button>' for c, f, n in [(0, 0, "Außen"), (1, 4, "Innen"), (2, 8, "Politur"), (3, 10, "Keramik")])
    static = "".join(f'''<figure class="rv"><div class="photo ratio-32"><img src="/assets/film/{FILM[i][0]}.webp" alt="{E(FILM[i][2])}" loading="lazy"></div>
<figcaption class="cap"><b>{E(FILM[i][2])}</b> {E(FILM[i][3])}</figcaption></figure>''' for i in [0, 1, 3, 6, 7, 8, 9, 10, 13])
    f0 = data[0]
    return f'''<section class="film" id="film" aria-labelledby="film-h" style="--frames:{len(FILM)}">
<h2 class="sr" id="film-h">Die Aufbereitung im Film: Außenwäsche, Innenraum, Politur, Keramik</h2>
<div class="film-stage">
 <img class="f-base" src="{f0["src"]}" alt="" width="762" height="506"><img class="f-top" src="{data[1]["src"]}" alt="" width="762" height="506" style="opacity:0" loading="lazy">
 <span class="film-spray" aria-hidden="true"></span><div class="shade" aria-hidden="true"></div>
 <p class="film-note">Inszenierung · KI-generierte Bilder · kein Kundenfahrzeug</p>
 <div class="film-copy" aria-live="polite"><p class="label f-label">{f0["label"]}</p><p class="h2 f-title" style="font:800 clamp(40px,6vw,88px)/.95 var(--head);text-transform:uppercase;margin:0 0 8px">{E(FILM[0][2])}</p>
 <p class="f-text">{E(FILM[0][3])}</p><p class="fprice f-price">{f0["price"]} · <a href="{f0["href"]}">{f0["link"]}</a></p></div>
 <div class="film-nav" role="group" aria-label="Kapitel des Films">{nav}<a class="skip-film" href="#nach-film">Film überspringen</a></div>
 <div class="film-bar" aria-hidden="true"></div>
</div>
<div class="film-static"><div class="wrap sec"><p class="label">Inszenierung mit KI-generierten Bildern · kein Kundenfahrzeug</p><h2>So läuft die Aufbereitung</h2><div class="grid g3">{static}</div></div></div>
<script type="application/json" id="film-data">{json.dumps(data, ensure_ascii=False)}</script>
</section>'''


def home():
    cards = "".join([
        price_card("innen-normal", "Innenreinigung", "Saugen, Cockpit, Scheiben innen, Fußmatten.",
                   ["Sitze, Fußraum und Kofferraum gesaugt", "Cockpit, Konsole, Türverkleidungen feucht gereinigt", "Scheiben und Spiegel innen",
                    "Flecken, Tierhaare, Geruch: Zusatz ab +29 €"], "/auto-innenreinigung/"),
        price_card("handwaesche", "Handwäsche", "Schonend von Hand statt Waschstraße.",
                   ["Schaumvorwäsche und Handwäsche", "Felgen und Reifen", "Scheiben außen, Trocknung", f"Innen + außen als Basic {ab('basic')}"], "/leistungen/#preise"),
        price_card("politur-1", "Politur", "Weniger Swirls, mehr Glanz.",
                   ["Handwäsche, Flugrost- und Teerentfernung, Kneten", "1-stufig: leichte Waschkratzer, matter Lack", f"2-stufig {ab('politur-2')}: viele Swirls und Hologramme",
                    "Kratzer bis in die Farbe bleiben sichtbar"], "/autopolitur/"),
        price_card("keramik", "Keramik&shy;versiegelung", "Langer Lackschutz mit Abperleffekt.",
                   ["Handwäsche, Dekontamination, Kneten", "1-stufige Politur inklusive", "Entfetten und XPERTCOAT HYBRID", "Nachkontrolle nach 6 Monaten"],
                   "/keramikversiegelung/", extra=promo_html()),
    ])
    team_alt = "Richy Schumacher (links) und Alexander Fuchs (rechts), Gründer von Carcura, in ihrer Halle in Walterschen"
    faq = [
        ("Was kostet eine Fahrzeugaufbereitung bei Carcura?", f"Die Innenreinigung beginnt {ab('innen-normal')}, die Handwäsche inklusive Felgen {ab('handwaesche')}, innen und außen zusammen {ab('basic')}. Politur gibt es {ab('politur-1')}, Keramik inklusive Politur {ab('keramik')}. Die Preise gelten bei normaler Verschmutzung, Innen- und Waschleistungen für PKW, Kombi und Van, Politur und Keramik für PKW und Kombi. Den Endpreis bestätigen wir dir vor dem Termin. Ab 500 € Auftragswert sind 50 % Anzahlung bei Terminbestätigung fällig."),
        ("Wo ist eure Halle?", f"In der {B['street']}, {B['postcode']} {B['city']}, zwischen Altenkirchen und Weyerbusch im Westerwald. Termine nach Vereinbarung."),
        ("Holt ihr mein Auto ab?", "Ja. Bis 10 km um Walterschen kostenlos, zum Beispiel in Altenkirchen, Weyerbusch oder Flammersfeld. Darüber kostet jeder weitere Kilometer der einfachen Strecke 2 €, Hin- und Rückfahrt sind damit abgegolten."),
        ("Wie schnell bekomme ich einen Preis?", "Am schnellsten mit Fotos per WhatsApp. Wir antworten persönlich mit einer Einschätzung und einem fairen Angebot."),
        ("Muss ich Umsatzsteuer dazurechnen?", "Nein. Alle Preise sind Endpreise. Als Kleinunternehmer nach § 19 UStG weisen wir keine Umsatzsteuer aus."),
    ]
    body = f'''
<section class="hero" aria-labelledby="h1">
 <div class="hero-media"><img src="/assets/film/14-ergebnis.webp" alt="Dunkler Sportwagen in einer Halle, KI-generierte Inszenierung" width="762" height="506" fetchpriority="high"></div>
 <div class="wrap">
  <p class="label">Carcura · Walterschen · Westerwald</p>
  <h1 id="h1">Fahrzeug&shy;aufbereitung in Walterschen bei Altenkirchen</h1>
  <p class="lead">Innenraumreinigung, Handwäsche, Lackpolitur und Keramikversiegelung. Wir bereiten dein Auto in unserer Halle von Hand auf und holen es auf Wunsch bei dir ab.</p>
  <div class="btns">{btn("#preise", "Leistungen & Preise", "acc", "arrow")}{btn(wa("Hi Carcura, ich möchte einen Preis anfragen. Mein Fahrzeug: "), "Preis per WhatsApp anfragen", "ghost", "wa", service="startseite", ext=True)}</div>
  <p class="trust"><span>{rating_line()}</span><span>Abholung bis 10 km kostenlos</span><a href="{B["phoneHref"]}" data-service="startseite">0170 6669516</a></p>
 </div>
 <p class="hero-tag">Bild: KI-generierte Inszenierung, kein Kundenfahrzeug</p>
</section>

<section class="sec soft" id="preise" aria-labelledby="preise-h"><div class="wrap">
 <p class="label">Leistungen & Preise</p><h2 id="preise-h">Was kostet das?</h2>
 <p class="lead">Ab-Preise bei normaler Verschmutzung: Innen- und Waschleistungen für PKW, Kombi und Van, Politur und Keramik für PKW und Kombi. Größe und Zustand können den Preis erhöhen. Den Endpreis bestätigen wir dir vor dem Termin. Bezahlt wird nach der Übergabe, ab 500 € Auftragswert sind 50 % bei Terminbestätigung fällig.</p>
 <div class="grid g4" style="margin-top:28px">{cards}</div>
 <div class="grid g3" style="margin-top:18px">
  <a class="card rv" href="/auto-innenreinigung/#pakete" style="text-decoration:none"><h3>Basic innen & außen</h3><p class="price">{ab('basic')}</p><p class="muted small">Innenreinigung plus Handwäsche mit Felgen in einem Termin.</p></a>
  <a class="card rv" href="/tierhaare-auto-entfernen/" style="text-decoration:none"><h3>Familienpaket</h3><p class="price">{ab('familie')}</p><p class="muted small">Innen und außen plus Tierhaare.</p></a>
  <a class="card rv" href="/leasingrueckgabe-aufbereitung/" style="text-decoration:none"><h3>Leasingrückgabe & Verkauf</h3><p class="price">{ab('leasing')}</p><p class="muted small">Detaillierte Innenreinigung, Flecken, Handwäsche, Schnellversiegelung.</p></a>
 </div>
 <p class="note" style="margin-top:22px"><b>Unsicher, was dein Auto braucht?</b> Schick 2–3 Fotos per WhatsApp und sag dazu, was dich stört. Wir sagen dir ehrlich, welche Leistung passt und was sie kostet. {btn(wa("Hi Carcura, ich weiß nicht, welche Leistung passt. Hier Fotos von meinem Auto. Mich stört: "), "Fotos schicken", "ghost", "wa", service="unsicher", ext=True)}</p>
 <p class="fine" style="margin-top:14px">Weitere Leistungen: <a class="tlink" href="/scheinwerfer-aufbereiten/">Scheinwerfer {ab('scheinwerfer')}</a> · <a class="tlink" href="/autositz-reinigen-flecken/">Fleck im Sitz {ab('sitz-fleck')}</a> · <a class="tlink" href="/geruch-im-auto-entfernen/">Ozon {ab('ozon')}</a> · <a class="tlink" href="/wohnmobil-aufbereitung/">Wohnmobil {ab('wohnmobil-basic')}</a> · <a class="tlink" href="/leistungen/#abos">Pflege-Abos</a> · <a class="tlink" href="/leistungen/">alle Preise</a></p>
</div></section>

{film_html()}

<section class="sec light" id="nach-film"><div class="wrap two">
 <div><p class="label">Carcura</p><h2>Glanz ist Handarbeit.</h2></div>
 <div><p class="lead">Wir sind Alexander und Richy. Wir bereiten jedes Auto selbst auf, in unserer eigenen Halle in Walterschen. Kein Callcenter, keine Waschstraße. Du sprichst mit denen, die auch an deinem Auto arbeiten.</p>
 <p><a class="tlink" href="/ueber-uns/">Mehr über uns</a></p></div>
</div></section>
<div class="marquee" aria-hidden="true"><div><span>Innenreinigung</span><span>Handwäsche</span><span>Politur</span><span>Keramik</span><span>Felgen</span><span>Innenreinigung</span><span>Handwäsche</span><span>Politur</span><span>Keramik</span><span>Felgen</span></div></div>

<section class="sec studio" aria-labelledby="fall-h"><div class="wrap">
 <p class="label">Echte Fälle aus unserer Halle</p><h2 id="fall-h">Keine Symbolbilder.</h2>
 <p class="lead">Diese Fotos sind bei uns in Walterschen an Fahrzeugen unserer Kunden entstanden.</p>
 <div class="grid g3" style="margin-top:28px">
  <div>{ba("carcura-bmw-m2-front-vorher-hd.webp", "carcura-bmw-m2-front-nachher-hd.webp", "BMW M2 Front vorher", "BMW M2 Front nachher", "BMW M2 · Front · Keramikversiegelung")}{quote_html("m2")}</div>
  <div>{photo("carcura-audi-tt-politur-keramik-walterschen.webp", "Roter Audi TT nach Politur und Keramikversiegelung in der Carcura-Halle", "Audi TT 8n · älterer Originallack · Politur und Keramik · Ergebnis: deutlich mehr Glanz", "ratio-916")}{quote_html("tt")}</div>
  <div>{ba("carcura-tankklappe-vorher.webp", "carcura-tankklappe-nachher.webp", "Verschmutzte Tankklappe eines Ford vorher", "Tankklappe nach der Reinigung", "Ford · Tankklappe · Detailreinigung")}{ba("img_1689.webp", "img_1690.webp", "Fußraum unter dem Sitz vorher", "Fußraum unter dem Sitz nachher", "Sitzrahmen und Fußraum · Innenreinigung")}</div>
 </div>
 <p style="margin-top:22px">{rating_line()} · <a class="tlink" href="/galerie/">Zur Galerie</a></p>
</div></section>

<section class="sec soft"><div class="wrap two">
 <div>{photo("carcura-team-alexander-richy.webp", team_alt, "Richy (links) und Alexander (rechts)", "ratio-45")}</div>
 <div><p class="label">Persönlich statt anonym</p><h2>Alex & Richy.</h2>
 <p class="lead">Wir haben Carcura als GbR gegründet und arbeiten selbst an den Fahrzeugen. Alexander kümmert sich um Anfragen, Termine und die passende Leistung, Richy um die Detailarbeit an Innenraum, Lack und Felgen.</p>
 <p>Für Reinigung, Pflege und Schutz setzen wir bei ausgewählten Schritten auf Produkte von <a class="tlink" href="/partner/">Nanolex</a>.</p>
 <div class="btns">{btn("/anfragen/", "Termin anfragen", "acc", "arrow")}{btn(B["phoneHref"], "0170 6669516", "ghost", "tel", service="team")}</div></div>
</div></section>

<section class="sec studio" id="abholung"><div class="wrap two">
 <div><p class="label">Hol- & Bringservice</p><h2>Wir holen dein Auto ab.</h2>
 <p class="lead">Zu Hause oder am Arbeitsplatz. Bis 10 km um Walterschen kostenlos, darüber 2 € pro Kilometer der einfachen Strecke. Hin- und Rückfahrt sind damit abgegolten.</p>
 <div class="btns">{btn("/anfragen/?abholung=1", "Mit Abholung anfragen", "acc", "arrow")}<a class="tlink" href="/hol-und-bringservice/">So läuft die Abholung</a></div></div>
 {calc_html()}
</div></section>

<section class="sec soft"><div class="wrap"><p class="label">Einzugsgebiet</p><h2>Rund um Walterschen.</h2>
 <p class="lead">Unsere Halle liegt zwischen Altenkirchen und Weyerbusch. Kunden kommen aus dem ganzen Westerwald und dem Siegtal zu uns.</p>
 <ul class="chips">{"".join(f'<li><a href="{h}" style="text-decoration:none">{n}</a></li>' for h, n in [("/fahrzeugaufbereitung-altenkirchen/", "Altenkirchen · Abholung gratis"), ("/fahrzeugaufbereitung-asbach/", "Asbach"), ("/fahrzeugaufbereitung-hachenburg/", "Hachenburg"), ("/fahrzeugaufbereitung-wissen/", "Wissen & Betzdorf"), ("/fahrzeugaufbereitung-neuwied/", "Neuwied"), ("/fahrzeugaufbereitung-westerwald/", "Alle Orte im Westerwald")])}</ul>
</div></section>
{faq_html(faq)}
{cta_band("Dein Auto. Wieder sauber.", "Wähle eine Leistung, schick uns Fotos oder ruf an. Du bekommst ein faires Angebot, bevor wir loslegen.", None, "Fahrzeugaufbereitung")}
'''
    page("/", "Fahrzeugaufbereitung Westerwald mit Abholung | Carcura",
         f"Innenreinigung {ab('innen-normal')}, Handwäsche {ab('handwaesche')}, Politur {ab('politur-1')}, Keramik {ab('keramik')}. Von Hand in unserer Halle in Walterschen. Abholung bis 10 km gratis.",
         body, ld=[faq_ld(faq)], js=("film.js",))


def calc_html(start=15):
    return f'''<div class="calc" data-calc><label for="km">Entfernung zu unserer Halle (Straße, einfache Strecke): <span data-km>{start} km</span></label>
<input id="km" type="range" min="1" max="50" value="{start}" step="1"><p class="muted small" style="margin:0">Deine Abholkosten</p><output for="km">{"0 € – kostenlos" if start <= 10 else eur((start - 10) * 2)}</output>
<p class="fine">Formel: (Kilometer − 10) × 2 €, mindestens 0 €. Beispiele: 10 km = 0 €, 15 km = 10 €, 20 km = 20 €, 30 km = 40 €. Den genauen Betrag bestätigen wir vor dem Termin.</p></div>'''


# ---------------------------------------------------------------- Leistungsseiten
SERVICES = {}


def service_page(slug, d):
    SERVICES[slug] = d
    inc = d.get("inc", [])
    exc = d.get("exc", [])
    steps = "".join(f"<li><b>{E(a)}</b>{b}</li>" for a, b in d.get("steps", []))
    cases = d.get("cases", "")
    related = "".join(f'<a class="card rv" href="{h}" style="text-decoration:none"><h3>{E(n)}</h3><p class="price">{p}</p><p class="muted small">{t}</p></a>' for h, n, p, t in d.get("related", []))
    table = d.get("table", "")
    body = f'''
<section class="phead studio"><div class="wrap hero-grid">
 <div>{crumb([("/leistungen/", "Leistungen"), (None, d["crumb"])])}
 <p class="label">{d["label"]}</p><h1>{d["h1"]}</h1>
 <p class="lead">{d["lead"]}</p>
 <div class="pricebig"><b>{d["price"]}</b><span>{d["price_note"]}</span></div>
 {d.get("promo", "")}
 <div class="btns">{btn(anf(*d["anf"]), d.get("cta", "Preis anfragen"), "acc", "arrow")}{wa_btn(d["wa"])}</div>
 <ul class="chips">{li(d["chips"])}</ul></div>
 <div>{photo(d["img"][0], d["img"][1], d["img"][2], d["img"][3] if len(d["img"]) > 3 else "ratio-45", eager=True)}</div>
</div></section>
<section class="sec light"><div class="wrap">
 <p class="label">Leistungsumfang</p><h2>{d.get("inc_title", "Was enthalten ist.")}</h2>
 <div class="inc" style="margin-top:22px"><div class="card"><h3>Enthalten</h3><ul>{li(inc)}</ul></div>
 <div class="card"><h3>Nicht enthalten oder Zusatz</h3><ul>{li(exc, "no")}</ul></div></div>
 {f'<p class="note" style="margin-top:22px">{d["limits"]}</p>' if d.get("limits") else ""}
</div></section>
{table}
<section class="sec"><div class="wrap two"><div><p class="label">Ablauf</p><h2>{d.get("steps_title", "So arbeiten wir.")}</h2><p class="lead">{d.get("steps_lead", "")}</p></div><ol class="steps">{steps}</ol></div></section>
{cases}
{faq_html(d["faq"], light=True)}
{f'<section class="sec soft"><div class="wrap"><p class="label">Passt oft dazu</p><h2>Weitere Leistungen.</h2><div class="grid g3" style="margin-top:22px">{related}</div></div></section>' if related else ""}
{cta_band(d["cta_title"], d["cta_text"], d["anf"], d["wa"])}
'''
    page(f"/{slug}/", d["title"], d["desc"], body, ld=[faq_ld(d["faq"]), {"@context": "https://schema.org", "@type": "Service", "name": d["crumb"], "provider": {"@id": SITE + "/#business"}, "areaServed": "Westerwald",
         "offers": {"@type": "Offer", "priceCurrency": "EUR", "priceSpecification": {"@type": "PriceSpecification", "minPrice": d.get("offer", 0), "priceCurrency": "EUR"}}}],
         crumbs=[("/leistungen/", "Leistungen"), (f"/{slug}/", d["crumb"])])


def rel(slug, name, sid, text):
    return (f"/{slug}/", name, ab(sid), text)


def case_section(title, items):
    return f'<section class="sec studio"><div class="wrap"><p class="label">Echter Fall</p><h2>{title}</h2><div class="grid g3" style="margin-top:22px">{items}</div></div></section>'


def build_services():
    service_page("auto-innenreinigung", dict(
        title=f"Auto-Innenreinigung im Westerwald {ab('innen-normal')} | Carcura Walterschen",
        desc=f"Auto-Innenreinigung von Hand in Walterschen: Normal {ab('innen-normal')}, detailliert {ab('innen-detail')}. Was enthalten ist, was extra kostet. Abholung bis 10 km gratis.",
        crumb="Auto-Innenreinigung", label="Auto-Innenreinigung · Walterschen", h1=f"Auto-Innen&shy;reinigung {ab('innen-normal')}: was drin ist.",
        lead="Saugen, Cockpit, Scheiben, Fußmatten, Kofferraum: von Hand in unserer Halle, meist in 1–2 Stunden. Flecken, Tierhaare und Geruch buchst du gezielt dazu.",
        price=ab("innen-normal"), price_note=f"Normal · detailliert {ab('innen-detail')}", anf=["innen-normal"], wa="Auto-Innenreinigung", offer=90,
        chips=["Tierhaare +29 €", "Polster-Tiefenreinigung +59 €", "Ozon +39 €", f"Innen + außen {ab('basic')}"],
        img=("carcura-innenreinigung-cockpit-hd.webp", "Cockpit eines Mercedes nach der Innenreinigung bei Carcura", "Echtes Kundenfahrzeug: Cockpit nach der Innenreinigung", "ratio-916"),
        inc_title=f"Was du {ab('innen-normal')} bekommst.",
        inc=["Gründliches Aussaugen von Sitzen, Fußraum und Kofferraum", "Fußmatten ausgeklopft, gesaugt oder gewaschen", "Cockpit, Mittelkonsole und Türverkleidungen feucht gereinigt",
             "Scheiben und Spiegel innen streifenfrei", "Einstiege und Türgriffe abgewischt",
             f"<b>Detailliert {ab('innen-detail')}:</b> zusätzlich Sitze und Polster intensiv (Stoff oder Leder), Ritzen und Lüftungsdüsen mit Pinsel, Ablagen im Detail, Kunststoffpflege, Türfalze"],
        exc=["Polster-Nassreinigung (Sprühextraktion): als Zusatz +59 €", "Gezielte Fleckentfernung im Sitz: einzeln ab 49 €", "Tierhaarentfernung: als Zusatz +29 €",
             "Geruchsbehandlung mit Ozon: als Zusatz +39 €", "Lederreinigung bei Normal: als Zusatz +39 €, Lederversiegelung +40 €"],
        limits="<b>Wann wird es teurer?</b> Bei starker Verschmutzung, sehr vielen Tierhaaren oder großen Fahrzeugen. Schick uns vorher Fotos, dann steht der Preis fest, bevor wir anfangen.",
        steps=[("Fotos oder Anfrage.", "Du sagst uns, was dich stört. Wir empfehlen Normal oder detailliert und nennen den Preis."), ("Termin oder Abholung.", "Du bringst das Auto nach Walterschen oder wir holen es bis 10 km kostenlos ab."),
               ("Reinigung von Hand.", "Von oben nach unten, Fläche für Fläche. Extras wie Polster oder Ozon im selben Termin."), ("Übergabe.", "Du schaust es dir an, dann zahlst du.")],
        cases=case_section("Sauber bis in die Fugen.", ba("img_1689.webp", "img_1690.webp", "Sitzrahmen und Fußraum vorher", "Sitzrahmen und Fußraum nachher", "Sitzrahmen und Fußraum unter dem Fahrersitz · Innenreinigung") +
                           photo("carcura-innenreinigung-cockpit-hd.webp", "Cockpit nach der Innenreinigung", "Mercedes · Cockpit nach der Innenreinigung", "ratio-916") + quote_html("tobias")),
        table=f'''<section class="sec" id="pakete"><div class="wrap"><p class="label">Preise</p><h2>Innenreinigung und Zusätze.</h2><div class="tablewrap"><table class="prices"><thead><tr><th>Leistung</th><th>Umfang</th><th>Preis</th></tr></thead><tbody>
<tr><td>Innenraumreinigung Normal</td><td>Für gepflegte Fahrzeuge</td><td class="p">{ab('innen-normal')}</td></tr>
<tr><td>Innenraumreinigung Detailliert</td><td>Inkl. Sitze, Polster, Ritzen, Lüftung, Lederreinigung</td><td class="p">{ab('innen-detail')}</td></tr>
<tr><td>Basic Innen & Außen</td><td>Innenreinigung plus Handwäsche mit Felgen</td><td class="p">{ab('basic')}</td></tr>
<tr><td>Familienpaket</td><td>Innen & außen plus Tierhaare</td><td class="p">{ab('familie')}</td></tr>
<tr><td>Polster- & Sitzreinigung</td><td>Sprühextraktion, alle Sitze</td><td class="p">{ab('polster')} · als Zusatz +59 €</td></tr>
<tr><td>Tierhaarentfernung</td><td>Teppich, Sitze, Kofferraum</td><td class="p">{ab('tierhaare')} · als Zusatz +29 €</td></tr>
<tr><td>Ozonbehandlung</td><td>Gegen Rauch-, Hunde- und Essensgeruch</td><td class="p">{ab('ozon')} · als Zusatz +39 €</td></tr>
<tr><td>Lederreinigung & -pflege</td><td>Sitze, Lenkrad, Schaltknauf</td><td class="p">{ab('leder')} · als Zusatz +39 €</td></tr>
</tbody></table></div><p class="fine" style="margin-top:12px">Ab-Preise für PKW, Kombi und Van (z. B. Touran) bei normaler Verschmutzung. „Als Zusatz“ gilt zusammen mit einer Innenreinigung. Endpreise nach § 19 UStG.</p></div></section>''',
        faq=[("Was kostet eine Auto-Innenreinigung?", f"Normal {ab('innen-normal')}, detailliert {ab('innen-detail')}, jeweils für PKW, Kombi und Van bei normaler Verschmutzung. Bei starker Verschmutzung schick uns Fotos, dann machen wir dir ein faires Angebot."),
             ("Ist eine Nassreinigung der Sitze dabei?", "In der Normal-Reinigung nicht. Die Polster-Tiefenreinigung im Sprühextraktionsverfahren kostet zusammen mit einer Innenreinigung +59 €. In der detaillierten Reinigung werden Sitze und Polster intensiv gereinigt."),
             ("Bekommt ihr Hundehaare raus?", "Ja, mit Spezialbürsten und dem Tornador. Zusammen mit einer Innenreinigung +29 €, einzeln ab 69 €."),
             ("Wie lange dauert es?", "Die Normal-Reinigung meist 1–2 Stunden. Detailliert oder mit Extras planen wir mehr Zeit ein und sagen sie dir vorher."),
             ("Holt ihr das Auto ab?", "Ja. Bis 10 km um Walterschen kostenlos, darüber 2 € pro Kilometer der einfachen Strecke."),
             ("Gibt es die Innenreinigung regelmäßig?", 'Ja, als <a href="/leistungen/#abos">Pflege-Abo</a>: Innenraum Basic ab 80 € im Monat, 12 Monate Mindestlaufzeit, danach monatlich kündbar.')],
        related=[rel("autositz-reinigen-flecken", "Fleck im Sitz", "sitz-fleck", "Sprühextraktion für einen Sitz oder eine Stelle."), rel("tierhaare-auto-entfernen", "Tierhaare", "tierhaare", "Aus Teppich, Sitzen und Kofferraum."), rel("geruch-im-auto-entfernen", "Geruch entfernen", "ozon", "Ozon gegen Rauch und Hund.")],
        cta_title="Innenraum sauber bekommen.", cta_text="Sag uns kurz, was dich stört, gern mit Fotos. Du bekommst einen Preis, bevor wir anfangen."))

    service_page("autopolitur", dict(
        title=f"Auto polieren lassen im Westerwald {ab('politur-1')} | Carcura",
        desc=f"Autopolitur in Walterschen bei Altenkirchen: 1-stufig {ab('politur-1')}, 2-stufige Lackkorrektur {ab('politur-2')}. Wäsche und Kneten inklusive. Wann welche Stufe passt.",
        crumb="Autopolitur", label="Autopolitur · Walterschen", h1=f"Auto polieren lassen: 1- oder 2-stufig {ab('politur-1')}.",
        lead="Waschkratzer, Kringel im Sonnenlicht, matter Lack: Eine Maschinenpolitur holt die Farbtiefe zurück. Handwäsche, Flugrost- und Teerentfernung und Kneten sind immer dabei.",
        price=ab("politur-1"), price_note=f"1-stufig · 2-stufig {ab('politur-2')}", anf=["politur-1"], wa="Autopolitur", offer=349,
        chips=["Wäsche und Kneten inklusive", "Maschinell, Bauteil für Bauteil", "Wachs nach Politur +30 €"],
        img=("carcura-schwarzer-lack-spiegelung-hd.webp", "Spiegelung im schwarzen Lack nach der Politur bei Carcura", "Echtes Kundenfahrzeug: Spiegelung im schwarzen Lack", "ratio-916"),
        inc_title="1-stufig oder 2-stufig?",
        inc=["Gründliche Handwäsche inklusive Felgen und Reifen", "Flugrost- und Teerentfernung, Kneten des Lacks", "Abkleben von Gummis und Kunststoffteilen",
             f"<b>1-stufig {ab('politur-1')}:</b> für matten Lack und leichte Waschkratzer", f"<b>2-stufig {ab('politur-2')}:</b> Schleif- und Hochglanzpolitur bei vielen Swirls und Hologrammen", "Endkontrolle bei gutem Licht"],
        exc=["Keramikversiegelung (eigene Leistung, Politur dort inklusive)", "Keine Garantie auf Entfernung tiefer Kratzer", "Kratzer bis in die Farbschicht bleiben sichtbar", "Einzelne Kratzer punktuell: Preis nach Foto", "Wachs nach der Politur: +30 €"],
        limits="<b>Der Fingernagel-Test:</b> Bleibt der Nagel im Kratzer hängen, ist er für eine Politur meist zu tief. Im Zweifel: Foto per WhatsApp, wir sagen es dir vorher.",
        steps=[("Handwäsche.", "Inklusive Felgen und Reifen."), ("Dekontamination.", "Flugrost und Teer entfernen, Lack kneten."), ("Abkleben.", "Gummis und Kunststoff schützen."), ("Polieren.", "1-stufig für Glanz, 2-stufig mit Schleifpolitur gegen Swirls."), ("Endkontrolle.", "Bei gutem Licht, erst dann geht das Auto zurück.")],
        steps_lead="Entschieden wird bei gutem Licht. Leichte Waschkratzer: meist 1-stufig. Viele Swirls: 2-stufig.",
        cases=case_section("Alter Lack, neuer Glanz.", photo("carcura-audi-tt-politur-keramik-walterschen.webp", "Roter Audi TT nach Politur und Keramik", "Audi TT 8n · älterer Originallack · Politur und Keramikversiegelung", "ratio-916") + quote_html("tt") +
                           photo("carcura-weisser-lack-halle-glanz.webp", "Glänzender weißer Lack in der Halle", "Weißer Lack nach der Aufbereitung in unserer Halle", "ratio-916")),
        faq=[("Was kostet es, das Auto polieren zu lassen?", f"1-stufig {ab('politur-1')}, 2-stufig {ab('politur-2')}, jeweils für PKW und Kombi und inklusive Handwäsche, Flugrost- und Teerentfernung und Kneten."),
             ("Wann reicht eine Stufe, wann braucht es zwei?", "Ist der Lack nur matt oder hat leichte Waschkratzer, reicht meist 1-stufig. Siehst du in der Sonne viele feine Kringel (Swirls) oder Schlieren (Hologramme), ist 2-stufig sinnvoll. Am einfachsten: Fotos per WhatsApp."),
             ("Gehen alle Kratzer weg?", "Nein. Oberflächliche Kratzer im Klarlack lassen sich auspolieren oder deutlich mildern. Kratzer bis in die Farbschicht bleiben sichtbar. Das sagen wir dir vor dem Termin."),
             ("Soll ich nach der Politur versiegeln?", f'Die Politur macht den Lack klar, schützt ihn aber nicht. Wachs hält einige Wochen (nach der Politur +30 €), die <a href="/keramikversiegelung/">Keramikversiegelung</a> {ab("keramik")} enthält die 1-stufige Politur schon.'),
             ("Ab wann ist eine Anzahlung fällig?", "Ab 500 € Auftragswert 50 % bei Terminbestätigung. Absage bis 48 Stunden vorher ist kostenlos.")],
        related=[rel("keramikversiegelung", "Keramikversiegelung", "keramik", "Inklusive 1-stufiger Politur."), rel("scheinwerfer-aufbereiten", "Scheinwerfer", "scheinwerfer", "Beide Seiten, mit UV-Schutz."), ("/leistungen/#preise", "Handwäsche mit Wachs", ab("handwaesche-wachs"), "Glanz für einige Wochen.")],
        cta_title="Bereit für klaren Lack?", cta_text="Fotos vom Lack bei Tageslicht reichen. Wir sagen dir, welche Stufe passt, mit Preis und Termin."))

    k = S["keramik"]
    service_page("keramikversiegelung", dict(
        title=f"Keramikversiegelung Westerwald {ab('keramik')} inkl. Politur | Carcura",
        desc=f"Keramikversiegelung mit XPERTCOAT HYBRID in Walterschen: {ab('keramik')} inkl. Handwäsche, Kneten und 1-stufiger Politur. Nachkontrolle nach 6 Monaten.",
        crumb="Keramikversiegelung", label="Keramikversiegelung · Westerwald", h1=f"Keramik&shy;versiegelung {ab('keramik')} inklusive Politur.",
        lead="Erst polieren, dann versiegeln, dann in der Halle aushärten. Wir verwenden XPERTCOAT HYBRID. Laut Hersteller bis zu 5 Jahre oder 70.000 km Standzeit, je nach Pflege und Nutzung.",
        price=ab("keramik"), price_note="inkl. Handwäsche, Kneten und 1-stufiger Politur", anf=["keramik"], wa="Keramikversiegelung", offer=700, cta="Keramik anfragen",
        promo=promo_html().replace('href="/keramikversiegelung/#aktion"', 'href="#aktion"'),
        chips=["Nachkontrolle nach 6 Monaten", f"mit 2-stufiger Politur ab {eur(k['from'] + k['twoStagePolishSurcharge'])}", "Auto meist 3 Tage in der Halle"],
        img=("carcura-audi-tt-politur-keramik-walterschen.webp", "Roter Audi TT nach Politur und Keramikversiegelung bei Carcura", "Echtes Kundenfahrzeug: Audi TT nach Politur und Keramik", "ratio-916"),
        inc_title=f"Was im Preis {ab('keramik')} steckt.",
        inc=["Handwäsche, Flugrost- und Teerentfernung, Kneten", "Abkleben von Gummis und Kunststoff", "1-stufige Politur", "Entfetten und Auftrag XPERTCOAT HYBRID (eine Schicht)",
             "Erste Aushärtung 12 Stunden in der Halle", "Pflegehinweise und Nachkontrolle nach 6 Monaten"],
        exc=[f"2-stufige Politur bei vielen Swirls: Aufpreis {eur(k['twoStagePolishSurcharge'])} (dann {ab('keramik').replace('700', str(k['from'] + k['twoStagePolishSurcharge']))})",
             f"Felgen-Keramik: zusammen {eur(S['felgen-keramik']['bundlePrice'])}, einzeln {ab('felgen-keramik')}", f"Scheiben-Keramik: zusammen {eur(S['scheiben-keramik']['bundlePrice'])}, einzeln {ab('scheiben-keramik')}",
             "Keramik entfernt keine Kratzer. Kratzer bis in die Farbe bleiben sichtbar", "SUV, Van, Transporter, Wohnmobil: Angebot nach Fotos"],
        limits="<b>Ehrlich vorab:</b> Keramik macht den Lack nicht unverwundbar. Steinschläge, Waschstraßen mit Bürsten und falsche Pflege verkürzen die Haltbarkeit. Die Angaben zur Standzeit sind Herstellerangaben.",
        steps=[("Waschen & dekontaminieren.", "Handwäsche, Flugrost und Teer entfernen, kneten, abkleben."), ("Polieren & entfetten.", "1-stufig für Glanz, 2-stufig bei Swirls und Waschkratzern."),
               ("Versiegeln.", "In der Halle unter Prüflicht, Bauteil für Bauteil, Überschuss abnehmen."), ("Aushärten & übergeben.", "12 Stunden erste Aushärtung, Übergabe mit Pflegeanleitung.")],
        steps_lead="Keramik hält nur so gut wie die Vorbereitung. Darum ist die Politur im Preis enthalten.",
        table=(f'''<section class="sec" id="aktion"><div class="wrap two"><div><p class="label">Aktion</p><h2>Waschset zur Keramik.</h2></div><div data-ende="{(PROMO_END + datetime.timedelta(days=1)).isoformat()}T00:00:00">
<p>Bei Terminvereinbarung für eine Keramikversiegelung bis zum {PROMO_END.strftime("%d.%m.%Y")} gibt es ein Nanolex-Waschset dazu. Das gilt auch für einen Gutschein für eine Keramikversiegelung. Nach dem {PROMO_END.strftime("%d.%m.%Y")} endet die Aktion.</p>
<div class="btns">{btn(wa("Hi Carcura, ich möchte einen Termin für eine Keramikversiegelung (Aktion Waschset). Mein Fahrzeug: "), "Termin per WhatsApp", "acc", "wa", service="keramik-aktion", ext=True)}<a class="tlink" href="/gutschein/">Als Gutschein verschenken</a></div></div></div></section>''' if PROMO_ON else "") +
              f'''<section class="sec"><div class="wrap"><p class="label">Preise</p><h2>Keramik und Zusätze.</h2><div class="tablewrap"><table class="prices"><thead><tr><th>Leistung</th><th>Umfang</th><th>Preis</th></tr></thead><tbody>
<tr><td>Keramikversiegelung</td><td>Inkl. Wäsche, Dekontamination, 1-stufiger Politur</td><td class="p">{ab('keramik')}</td></tr>
<tr><td>Keramik mit 2-stufiger Politur</td><td>Für Lack mit Swirls und Hologrammen</td><td class="p">ab {eur(k['from'] + k['twoStagePolishSurcharge'])}</td></tr>
<tr><td>Felgen-Keramik (XPERTCOAT WHEEL)</td><td>Alle Felgen, zusammen mit Wäsche, Politur oder Keramik</td><td class="p">{eur(S['felgen-keramik']['bundlePrice'])} · einzeln {ab('felgen-keramik')}</td></tr>
<tr><td>Scheiben-Keramik</td><td>Alle Scheiben, zusammen mit Wäsche, Politur oder Keramik</td><td class="p">{eur(S['scheiben-keramik']['bundlePrice'])} · einzeln {ab('scheiben-keramik')}</td></tr>
<tr><td>Leder versiegeln</td><td>Nach der Lederreinigung</td><td class="p">+40 €</td></tr>
<tr><td>Handwäsche + Sprühversiegelung</td><td>Einstieg ohne Politur</td><td class="p">{ab('spruehversiegelung')}</td></tr>
<tr><td>Keramik-Pflege</td><td>Alle 2 Monate, für Fahrzeuge mit Carcura-Keramik</td><td class="p">{ab('keramik-pflege')} pro Termin</td></tr>
</tbody></table></div><p class="fine" style="margin-top:12px">Ab-Preise für PKW und Kombi. Ab 500 €: 50 % Anzahlung bei Terminbestätigung, Absage bis 48 Stunden vorher kostenlos. Endpreise nach § 19 UStG.</p></div></section>''',
        cases=case_section("Zwei echte Keramik-Kunden.", ba("carcura-bmw-m2-front-vorher-hd.webp", "carcura-bmw-m2-front-nachher-hd.webp", "BMW M2 Front vorher", "BMW M2 Front nachher", "BMW M2 G87 · Front · Keramikversiegelung · Okt. 2026") + quote_html("m2") + quote_html("daniel")),
        faq=[("Was kostet eine Keramikversiegelung?", f"{ab('keramik')} für PKW und Kombi, inklusive Handwäsche, Dekontamination, Kneten und 1-stufiger Politur. Mit 2-stufiger Politur ab {eur(k['from'] + k['twoStagePolishSurcharge'])}."),
             ("Welches Produkt verwendet ihr?", "XPERTCOAT HYBRID, eine Keramik auf SiO₂-Basis. Für Felgen XPERTCOAT WHEEL, für Leder XPERTCOAT LEATHER."),
             ("Wie lange hält die Keramik?", "Laut Hersteller bis zu 5 Jahre oder 70.000 km. Wie lange es bei dir hält, hängt von Pflege, Waschgewohnheiten und Nutzung ab."),
             ("Wie lange ist das Auto bei euch?", "Meist 3 Tage. Nach dem Auftrag härtet die Schicht 12 Stunden in der Halle aus."),
             ("Wie wasche ich das Auto danach?", "Von Hand mit einem Shampoo für versiegelte Lacke, möglichst mit zwei Eimern und ohne Waschstraße mit Bürsten. Die Pflegeanleitung bekommst du bei der Übergabe."),
             ("Entfernt Keramik Kratzer?", "Nein. Die Politur davor mildert oder entfernt Waschkratzer im Klarlack. Die Keramik schützt danach. Tiefe Kratzer bleiben sichtbar.")],
        related=[rel("autopolitur", "Nur Politur", "politur-1", "Mehr Glanz, weniger Swirls."), ("/leistungen/#preise", "Sprühversiegelung", ab("spruehversiegelung"), "Handwäsche plus schneller Schutz."), ("/wohnmobil-aufbereitung/", "Keramik fürs Wohnmobil", "nach Fotos", "Halle bis 4 m Höhe, 7 m Länge.")],
        cta_title="Lack schützen. Richtig vorbereitet.", cta_text="Schick uns 3 Fotos vom Lack bei Tageslicht. Wir sagen dir, ob 1-stufig reicht, und nennen den Preis."))

    service_page("leasingrueckgabe-aufbereitung", dict(
        title=f"Auto vor Leasingrückgabe & Verkauf aufbereiten {ab('leasing')} | Carcura",
        desc=f"Verkaufs- und Leasingrückgabe-Paket {ab('leasing')}: detaillierte Innenreinigung, Flecken, Handwäsche, Schnellversiegelung. In Walterschen, mit Abholung.",
        crumb="Leasingrückgabe & Verkauf", label="Leasingrückgabe & Verkauf", h1="Auto vor Leasing&shy;rückgabe oder Verkauf aufbereiten.",
        lead="Ein gepflegtes Auto macht beim Gutachter und beim Käufer mehr her. Unser Paket bringt Innenraum und Lack in einen gepflegten Zustand. Eilig? Fotos per WhatsApp, Antwort meist am selben Tag.",
        price=ab("leasing"), price_note="Paket innen und außen", anf=["leasing"], wa="Leasingrückgabe-Paket", offer=229, cta="Paket anfragen",
        chips=["Tierhaare +29 €", "Ozon +39 €", f"Politur {ab('politur-1')}", f"Scheinwerfer {ab('scheinwerfer')}"],
        img=("carcura-audi-a6-westerwald-hd.webp", "Audi A6 nach der Aufbereitung im Westerwald", "Echtes Kundenfahrzeug: Audi A6 nach der Aufbereitung", "ratio-916"),
        inc=["Detaillierte Innenreinigung: Sitze, Polster, Ritzen, Lüftungsdüsen", "Fleckenbehandlung an Sitzen und Teppich", "Kofferraum komplett inklusive Reserveradmulde",
             "Kunststoffpflege innen", "Handwäsche inklusive Felgen, Türfalzen und Tankdeckel", "Schnellversiegelung, Scheiben innen und außen"],
        exc=["Dellen, tiefe Kratzer und Steinschläge (bewertet der Gutachter extra)", f"Politur gegen Waschkratzer: {ab('politur-1')}", "Tierhaare: +29 €", "Ozon gegen Geruch: +39 €", "Fotos oder Video für die Anzeige: auf Anfrage"],
        limits="<b>Wichtig:</b> Wir verbessern den Pflegezustand. Echte Schäden beseitigen wir nicht und können keine Zusage zum Ergebnis der Rückgabe-Begutachtung machen.",
        steps=[("Fotos schicken.", "Wir sagen dir, was sinnvoll ist und was es kostet."), ("Termin vor der Rückgabe.", "Am besten einige Tage vorher, auch abends und samstags."), ("Aufbereitung.", "Innen und außen in einem Termin."), ("Rückgabe oder Anzeige.", "Auf Wunsch mit Fotos fürs Inserat.")],
        faq=[("Lohnt sich eine Aufbereitung vor der Leasingrückgabe?", "Starke Verschmutzung, Flecken und Gerüche fallen bei der Rückgabe negativ auf und lassen sich mit einer Aufbereitung vermeiden. Dellen oder Steinschläge bewertet der Gutachter unabhängig davon."),
             ("Was kostet das Paket?", f"{ab('leasing')} für PKW, Kombi und Van bei normaler Verschmutzung. Den Endpreis bekommst du vor dem Termin."),
             ("Macht ihr Fotos für die Verkaufsanzeige?", "Auf Anfrage. Umfang und Preis stimmen wir mit dir ab."),
             ("Wie kurzfristig geht es?", "Schick Fotos per WhatsApp. Wir sagen dir meist am selben Tag, ob es zeitlich klappt.")],
        related=[rel("autopolitur", "Politur", "politur-1", "Gegen Waschkratzer und matten Lack."), rel("scheinwerfer-aufbereiten", "Scheinwerfer", "scheinwerfer", "Wirkt sofort gepflegter."), rel("geruch-im-auto-entfernen", "Geruch entfernen", "ozon", "Rauch oder Hund raus.")],
        cta_title="Gepflegt abgeben.", cta_text="Sag uns den Rückgabe- oder Verkaufstermin. Wir planen rückwärts und nennen dir den Preis vorab."))

    service_page("scheinwerfer-aufbereiten", dict(
        title=f"Scheinwerfer aufbereiten: Kosten {ab('scheinwerfer')} für beide | Carcura",
        desc=f"Was kostet eine Scheinwerferaufbereitung? Bei Carcura {ab('scheinwerfer')} für beide Scheinwerfer: abkleben, schleifen, polieren, UV-Schutz. Walterschen bei Altenkirchen.",
        crumb="Scheinwerfer aufbereiten", label="Scheinwerferaufbereitung · Walterschen", h1="Scheinwerfer aufbereiten. Was kostet das?",
        lead=f"Matte, vergilbte Gläser streuen das Licht. Wir schleifen, polieren klar und versiegeln mit UV-Schutz.",
        price=ab("scheinwerfer"), price_note="für beide Scheinwerfer zusammen", anf=["scheinwerfer"], wa="Scheinwerferaufbereitung", offer=69,
        chips=["Beide Seiten", "Mit UV-Schutzversiegelung", "Mit Wäsche kombinierbar"],
        img=("carcura-weisser-lack-halle-glanz.webp", "Fahrzeug in der Carcura-Halle", "Unsere Halle in Walterschen", "ratio-916"),
        inc=["Abkleben der umliegenden Lackflächen", "Mehrstufiges Anschleifen der vergilbten Schicht", "Politur bis zur klaren Oberfläche", "UV-Schutzversiegelung gegen erneutes Vergilben"],
        exc=["Risse im Glas", "Feuchtigkeit im Scheinwerfer", "Tiefe Steinschläge", "Defekte Leuchtmittel oder Technik"],
        limits="Schick uns ein Foto per WhatsApp. Wir sagen dir ehrlich, ob sich die Aufbereitung lohnt.",
        steps=[("Abkleben.", ""), ("Anschleifen.", "Die verwitterte Schicht muss runter."), ("Klar polieren.", ""), ("UV-Schutz versiegeln.", "Damit sie lange klar bleiben.")],
        faq=[("Was kostet es, Scheinwerfer aufbereiten zu lassen?", f"Bei Carcura {ab('scheinwerfer')} für beide Scheinwerfer zusammen, inklusive UV-Schutzversiegelung."),
             ("Warum werden Scheinwerfer gelb und matt?", "Die Gläser sind aus Kunststoff mit einer UV-Schutzschicht ab Werk. Sonne, Witterung und Waschanlagen lassen sie mit den Jahren verwittern."),
             ("Reicht polieren oder muss geschliffen werden?", "Bei vergilbten Scheinwerfern sitzt die Verfärbung in der verwitterten Schicht. Deshalb schleifen wir an und polieren danach klar. Nur polieren hält meist nicht lange."),
             ("Werden sie danach wieder gelb?", "Die UV-Schutzversiegelung schützt gegen erneutes Vergilben. Wie lange es hält, hängt von Sonne und Pflege ab.")],
        related=[("/leistungen/#preise", "Handwäsche", ab("handwaesche"), "Im selben Termin."), rel("autopolitur", "Politur", "politur-1", "Für den ganzen Lack."), rel("leasingrueckgabe-aufbereitung", "Vor Verkauf", "leasing", "Paket innen und außen.")],
        cta_title="Wieder klar sehen.", cta_text="Ein Foto der Scheinwerfer reicht für eine ehrliche Einschätzung."))

    for slug, d in SIMPLE_SERVICES().items():
        service_page(slug, d)


def SIMPLE_SERVICES():
    return {
        "autositz-reinigen-flecken": dict(
            title=f"Autositz reinigen & Flecken entfernen {ab('sitz-fleck')} | Westerwald", desc=f"Fleck im Autositz? Sprühextraktion {ab('sitz-fleck')} pro Sitz, alle Polster {ab('polster')}, Fleck + Geruch {ab('fleck-geruch')}. Foto schicken, Preis bekommen.",
            crumb="Flecken im Sitz", label="Polster- & Sitzreinigung", h1=f"Autositz reinigen und Flecken entfernen {ab('sitz-fleck')}.",
            lead="Kaffee, Kakao, Saft oder Essen: Wir reinigen mit Sprühextraktion tief aus dem Stoff und saugen das Schmutzwasser direkt wieder ab.",
            price=ab("sitz-fleck"), price_note="einzelner Sitz oder Stelle", anf=["sitz-fleck"], wa="Fleckentfernung im Autositz", offer=49,
            chips=[f"Alle Sitze {ab('polster')}", f"Fleck + Geruch {ab('fleck-geruch')}", "Notfall Erbrochenes ab 179 €"],
            img=("carcura-innenreinigung-cockpit-hd.webp", "Innenraum nach der Reinigung", "Echtes Kundenfahrzeug nach der Innenreinigung", "ratio-916"),
            inc=["Vorbehandlung des Flecks", "Sprühextraktion tief aus dem Stoff", "Schmutzwasser direkt abgesaugt", f"Alle Sitze und Polster: {ab('polster')}, zusammen mit Innenreinigung +59 €"],
            exc=["Ob ein Fleck ganz verschwindet, hängt von Material und Alter ab", "Geruch: Ozon als Zusatz", "Lederflecken: Lederreinigung", "Notfall Erbrochenes mit Desinfektion und Ozon: ab 179 €"],
            steps=[("Foto vom Fleck und vom Sitz.", "Wir schätzen die Chancen ehrlich ein."), ("Angebot.", "Preis vorab."), ("Reinigung.", "Termin meist in 1–2 Wochen, Notfälle schneller nach Absprache.")],
            faq=[("Was kostet die Fleckentfernung im Autositz?", f"Ein Sitz oder eine Stelle {ab('sitz-fleck')}, alle Sitze {ab('polster')}, Fleck plus Geruch {ab('fleck-geruch')}."), ("Geht jeder Fleck raus?", "Nicht immer. Alte oder eingetrocknete Flecken werden oft deutlich heller, verschwinden aber nicht garantiert. Das sagen wir dir nach dem Foto.")],
            cta_title="Fleck weg.", cta_text="Schick ein Foto vom Fleck und vom ganzen Sitz."),
        "tierhaare-auto-entfernen": dict(
            title=f"Tierhaare im Auto entfernen {ab('tierhaare')} | Westerwald | Carcura", desc=f"Hundehaare im Auto? Mit Innenreinigung nur +29 € (Golf/Touran ab 119 €). Familienpaket innen + außen + Tierhaare {ab('familie')}. Walterschen.",
            crumb="Tierhaare entfernen", label="Tierhaare · Westerwald", h1="Tierhaare im Auto entfernen lassen.",
            lead="Aus Teppich, Sitzen, Ritzen und Kofferraum, auch die feinen, festsitzenden Haare. Mit Spezialbürsten und dem Tornador.",
            price="+29 €", price_note=f"zur Innenreinigung · einzeln {ab('tierhaare')}", anf=["innen-normal", "tierhaare"], wa="Tierhaarentfernung", offer=29,
            chips=["Innen + Tierhaare ab 119 €", f"Familienpaket {ab('familie')}", "Ozon gegen Hundegeruch +39 €"],
            img=("img_1690.webp", "Fußraum nach der Reinigung", "Echtes Kundenfahrzeug: Fußraum nach der Reinigung", "ratio-916"),
            inc=["Haare aus Teppich, Sitzen und Kofferraum", "Spezialbürsten und Tornador für Ritzen und Nähte", "Zusammen mit Innenreinigung: 90 € + 29 € = ab 119 €"],
            exc=["Sehr viele Haare: Angebot nach Fotos", "Hundegeruch: Ozon +39 €", "Flecken: Polster-Tiefenreinigung +59 €"],
            steps=[("Foto schicken.", "Preis meist am selben Tag."), ("Termin oder Abholung.", "Bis 10 km kostenlos."), ("Haare raus.", "Zusammen mit der Innenreinigung.")],
            faq=[("Was kostet die Tierhaarentfernung?", f"Zusammen mit einer Innenreinigung +29 €, einzeln {ab('tierhaare')}. Das Familienpaket mit innen, außen und Tierhaaren gibt es {ab('familie')}."), ("Und der Geruch?", "Gegen Hundegeruch hilft die Ozonbehandlung, zusammen mit der Innenreinigung +39 €.")],
            cta_title="Haarfrei einsteigen.", cta_text="Ein Foto vom Kofferraum und der Rückbank reicht."),
        "geruch-im-auto-entfernen": dict(
            title=f"Geruch im Auto entfernen: Ozon {ab('ozon')} | Westerwald", desc=f"Rauch, Hund, Essen: Innenreinigung plus Ozon ab 129 €, Ozon einzeln {ab('ozon')}. Ursache raus, dann Ozon. Carcura in Walterschen.",
            crumb="Geruch entfernen", label="Geruch entfernen · Walterschen", h1="Geruch im Auto entfernen: Rauch, Hund, Essen.",
            lead="Duftbäume überdecken nur. Wir reinigen zuerst Polster, Teppich und Ritzen, dann zersetzt Ozon die Geruchsmoleküle, auch in Dachhimmel und Lüftung.",
            price=ab("ozon"), price_note="Ozon einzeln · mit Innenreinigung ab 129 €", anf=["innen-normal", "ozon"], wa="Geruchsentfernung mit Ozon", offer=59,
            chips=["Ursache statt Duftbaum", "Auch Lüftung und Polster", f"Fleck + Geruch {ab('fleck-geruch')}"],
            img=("carcura-innenreinigung-cockpit-hd.webp", "Innenraum nach der Reinigung", "Echtes Kundenfahrzeug nach der Innenreinigung", "ratio-916"),
            inc_title="Ozon einzeln oder mit Innenreinigung.", inc=[f"<b>Ozon einzeln {ab('ozon')}:</b> Ozongerät im geschlossenen, leeren Fahrzeug, danach gründliches Auslüften", "<b>Innenreinigung + Ozon ab 129 €:</b> zusätzlich Innenraum aussaugen, Fußmatten reinigen, Flecken vorbehandeln, damit die Ursache rausgeht"],
            exc=["Polster-Tiefenreinigung: +59 €", "Ursachen wie Feuchtigkeit muss die Werkstatt beheben"],
            limits="<b>Ehrlich:</b> Sehr alter Rauchgeruch wird stark reduziert, aber nicht immer ganz entfernt. Das sagen wir dir vorher.",
            steps=[("Ursache raus.", "Saugen, Flecken vorbehandeln, bei Bedarf Polster tief reinigen."), ("Ozon.", "Im geschlossenen Fahrzeug, auch durch die Lüftung."), ("Auslüften.", "Danach bekommst du dein Auto zurück.")],
            faq=[("Was kostet die Geruchsentfernung?", f"Innenreinigung plus Ozon ab 129 €. Ozon einzeln {ab('ozon')}. Fleck plus Geruch {ab('fleck-geruch')}."), ("Ist Ozon gefährlich?", "Das Gerät arbeitet nur im leeren, geschlossenen Fahrzeug. Danach wird gründlich gelüftet, bevor du einsteigst.")],
            cta_title="Frische Luft im Auto.", cta_text="Beschreib kurz, woher der Geruch kommt."),
        "spezialreinigung-auto": dict(
            title="Auto Dampfreinigung, Schimmel & Leder | Carcura", desc="Dampfreinigung, Schimmel- und Ölentfernung, Motorraum, Leder, Himmel und Cabrio-Verdeck. Faires Angebot nach Foto. Carcura in Walterschen bei Altenkirchen.",
            crumb="Dampf- & Spezialreinigung", label="Spezialreinigung · Walterschen", h1="Dampf- und Spezial&shy;reinigung fürs Auto.",
            lead="Wenn eine normale Innenreinigung nicht reicht: Dampfreinigung, Schimmel, Öl, Leder, Himmel, Motorraum und Cabrio-Verdeck. Vorher bekommst du ein faires Angebot.",
            price="nach Foto", price_note="Preis nach 2–3 Fotos, vor dem Termin", anf=["spezial"], wa="Spezialreinigung", offer=0,
            chips=["Thermostar-Dampfreiniger", "Abholung bis 10 km kostenlos"],
            img=("carcura-felge-felgenreiniger-schaum.webp", "Felge mit Reiniger-Schaum bei Carcura", "Echtes Kundenfahrzeug: Felgenreinigung", "ratio-916"),
            inc=["Dampfreinigung von Polstern, Kunststoff und Ritzen", "Schimmelentfernung im Innenraum", "Ölflecken, z. B. im Kofferraum", "Motorraumreinigung", "Leder reinigen und pflegen", "Himmelreinigung", "Cabrio-Verdeck, auf Wunsch mit Imprägnierung"],
            exc=["Ursache von Schimmel (meist Undichtigkeit) behebt die Werkstatt", "Ob ein Ölfleck ganz verschwindet, hängt von Material und Alter ab"],
            steps=[("2–3 Fotos.", "Wir sagen dir ehrlich, was realistisch ist."), ("Angebot.", "Bevor du den Termin bestätigst."), ("Reinigung.", "In unserer Halle.")],
            faq=[("Was kostet eine Spezialreinigung?", "Das hängt stark vom Fall ab. Nach 2–3 Fotos machen wir dir vor dem Termin ein Angebot."), ("Entfernt ihr Schimmel dauerhaft?", "Wir reinigen den Schimmel. Wenn die Ursache, meist Feuchtigkeit, bleibt, kann er wiederkommen.")],
            cta_title="Schwieriger Fall?", cta_text="Schick uns Fotos. Wir sagen dir, ob und wie wir helfen können."),
        "wohnmobil-aufbereitung": dict(
            title=f"Wohnmobil-Aufbereitung Westerwald {ab('wohnmobil-basic')} | Carcura", desc=f"Wohnmobil innen und außen: Basic {ab('wohnmobil-basic')}, Komplettreinigung {ab('wohnmobil-komplett')}. Halle bis 4 m Höhe und 7 m Länge. Walterschen.",
            crumb="Wohnmobil", label="Wohnmobil · Walterschen", h1="Wohnmobil-Aufbereitung innen und außen.",
            lead="Vor der Saison oder vor dem Verkauf: innen und außen, vom Dach bis zum Kühlschrank. Unsere Halle passt bis 4 m Höhe und 7 m Länge.",
            price=ab("wohnmobil-basic"), price_note=f"Basic innen & außen · komplett {ab('wohnmobil-komplett')}", anf=["wohnmobil-komplett"], wa="Wohnmobil-Aufbereitung", offer=245,
            chips=["Halle bis 4 m × 7 m", "Keramik fürs Wohnmobil nach Fotos"],
            img=("carcura-ford-schaum-vorwaesche.webp", "Fahrzeug bei der Schaumvorwäsche in der Carcura-Halle", "Schaumvorwäsche in unserer Halle", "ratio-916"),
            inc=[f"<b>Komplett {ab('wohnmobil-komplett')}:</b> Handwäsche inkl. Dach, Wände, Klappen, Fenster, Felgen", "Innen alle Schränke, Fächer, Schubladen; Küche, Bad, Polster, Böden, Rollos", "Fahrerhaus wie bei einer PKW-Innenreinigung",
                 f"<b>Basic {ab('wohnmobil-basic')}:</b> innen gesaugt und gewischt, Fahrerhaus, außen Handwäsche"],
            exc=["Endpreis je nach Länge und Zustand", "Keramik: Angebot nach Fotos", "Ozon gegen Gerüche als Zusatz"],
            steps=[("Fotos und Länge.", "Am einfachsten per WhatsApp."), ("Angebot.", "Nach Länge und Zustand."), ("Aufbereitung.", "Drinnen in der Halle.")],
            faq=[("Was kostet die Wohnmobil-Aufbereitung?", f"Basic innen und außen {ab('wohnmobil-basic')}, Komplettreinigung {ab('wohnmobil-komplett')}. Den Endpreis bestätigen wir nach Länge und Zustand."), ("Passt mein Wohnmobil in die Halle?", "Bis 4 m Höhe und 7 m Länge. Größere Fahrzeuge besprechen wir vorher.")],
            cta_title="Bereit für die Saison.", cta_text="Schick uns Fotos und die Länge deines Wohnmobils."),
    }


# ---------------------------------------------------------------- Leistungen (Übersicht + Preisliste)
ABOS = [("Kombi-Abos", [("Kombi Basic", "Innenraum aussaugen, Oberflächen, Scheiben innen und außen, Fußmatten, Handwäsche, Felgen und Reifen.", "1× pro Monat", 120),
                         ("Kombi Care", "Gründlichere Innen- und Außenpflege: Cockpit, Verkleidungen, Scheiben, Fußmatten, Handwäsche, Felgen, Einstiege.", "2× pro Monat", 230),
                         ("Kombi Protect", "Wie Kombi Care, mit Fokus auf Lackschutz, Glanz und Werterhalt.", "2× pro Monat", 265),
                         ("Weekly Basic", "Wöchentlich innen und außen: Aussaugen, Oberflächen, Scheiben, Handwäsche, Felgen.", "1× pro Woche", 399),
                         ("Weekly Care", "Wöchentlich mit mehr Detailarbeit innen und außen.", "1× pro Woche", 439)]),
        ("Außenwäsche-Abos", [("Außenwäsche Basic", "Handwäsche, Felgen oberflächlich, Einstiege grob, Reifen, Scheiben außen.", "1× pro Monat", 55), ("Außenwäsche Basic", "Gleicher Umfang.", "2× pro Monat", 100),
                              ("Außenwäsche Basic", "Gleicher Umfang.", "1× pro Woche", 190), ("Außenwäsche Protect", "Handwäsche mit Fokus auf Glanz und Schutz, Felgen, Reifenpflege, Scheiben, Einstiege.", "1× pro Monat", 75),
                              ("Außenwäsche Protect", "Gleicher Umfang.", "2× pro Monat", 140), ("Außenwäsche Protect", "Gleicher Umfang.", "1× pro Woche", 260)]),
        ("Innenraum-Abos", [("Innenraum Basic", "Aussaugen, Cockpit und Oberflächen, Scheiben innen, Fußmatten, Kofferraum.", "1× pro Monat", 80), ("Innenraum Basic", "Gleicher Umfang.", "2× pro Monat", 150),
                            ("Innenraum Basic", "Gleicher Umfang.", "1× pro Woche", 285), ("Innenraum Pflege Plus", "Intensiv inkl. Sitze und Ritzen, Cockpit mit Pinsel, Kunststoff, Scheiben, Kofferraum.", "1× pro Monat", 95),
                            ("Innenraum Pflege Plus", "Gleicher Umfang.", "2× pro Monat", 175), ("Innenraum Pflege Plus", "Gleicher Umfang.", "1× pro Woche", 330)])]

PRICE_GROUPS = [
    ("Innenraum", ["innen-normal", "innen-detail", "sitz-fleck", "polster", "tierhaare", "ozon", "fleck-geruch", "leder", "leder-versiegeln"]),
    ("Außen & Pakete", ["handwaesche", "handwaesche-wachs", "spruehversiegelung", "basic", "familie", "leasing", "scheinwerfer"]),
    ("Lack & Schutz", ["politur-1", "politur-2", "keramik", "felgen-keramik", "scheiben-keramik", "keramik-pflege"]),
    ("Wohnmobil", ["wohnmobil-basic", "wohnmobil-komplett"]),
]


SCOPE = {"innen-detail": "Alles aus Normal plus Sitze und Polster intensiv, Ritzen und Lüftung, Lederreinigung, Kunststoffpflege",
         "handwaesche-wachs": "Handwäsche mit von Hand aufgetragenem Wachs", "basic": "Innenreinigung plus Handwäsche mit Felgen",
         "familie": "Innen und außen plus Tierhaare", "leasing": "Detaillierte Innenreinigung, Flecken, Handwäsche, Schnellversiegelung",
         "politur-2": "Schleif- und Hochglanzpolitur bei Swirls und Hologrammen, Wäsche und Kneten inklusive",
         "keramik": "Handwäsche, Dekontamination, Kneten, 1-stufige Politur, Keramikauftrag, Pflegehinweise, Nachkontrolle nach 6 Monaten",
         "felgen-keramik": "Alle Felgen versiegelt (XPERTCOAT WHEEL)", "scheiben-keramik": "Alle Scheiben versiegelt",
         "spruehversiegelung": "Handwäsche plus Sprühversiegelung, ohne Politur", "keramik-pflege": "Alle 2 Monate Handwäsche plus Auffrischung, für Fahrzeuge mit Carcura-Keramik",
         "sitz-fleck": "Ein Sitz oder eine Stelle, Sprühextraktion", "polster": "Alle Sitze tiefengereinigt (Sprühextraktion)",
         "tierhaare": "Haare aus Teppich, Sitzen und Kofferraum", "ozon": "Gegen Rauch-, Hunde- und Essensgeruch", "fleck-geruch": "Polster tiefengereinigt plus Ozon",
         "leder": "Ledersitze, Lenkrad, Schaltknauf; in der detaillierten Innenreinigung enthalten", "leder-versiegeln": "Nur als Zusatz zur Leder- oder Innenreinigung",
         "scheinwerfer": "Beide Scheinwerfer: abkleben, schleifen, polieren, UV-Schutz", "wohnmobil-basic": "Innen gesaugt und gewischt, Fahrerhaus, außen Handwäsche",
         "wohnmobil-komplett": "Innen und außen komplett, inklusive Küche, Bad, Schränke und Dach"}
ZUSATZ = {"polster": "mit Innenreinigung", "tierhaare": "mit Innenreinigung", "ozon": "mit Innenreinigung", "leder": "zur Innenreinigung Normal"}


def price_cell(s):
    p = ab(s["id"])
    if "bundleSurcharge" in s:
        p = f"einzeln {p} · {ZUSATZ.get(s['id'], 'als Zusatz')} +{eur(s['bundleSurcharge'])}"
    if "bundlePrice" in s:
        p = f"einzeln {p} · mit Wäsche, Politur oder Keramik {eur(s['bundlePrice'])}"
    return p


def scope(s):
    if s["id"] in SCOPE:
        return SCOPE[s["id"]]
    return ", ".join(s.get("includes", []))


def leistungen():
    tables = ""
    for g, ids in PRICE_GROUPS:
        rows = "".join(f'<tr><td><a href="{S[i]["url"]}">{E(S[i]["title"])}</a></td><td>{E(scope(S[i]))}</td><td class="p">{E(price_cell(S[i]))}</td><td><a class="tlink" href="{anf(i)}" aria-label="{E(S[i]["title"])} anfragen">Anfragen</a></td></tr>' for i in ids)
        tables += f'<h3 style="margin-top:34px">{g}</h3><div class="tablewrap"><table class="prices"><thead><tr><th>Leistung</th><th>Umfang</th><th>Preis</th><th><span class="sr">Anfrage</span></th></tr></thead><tbody>{rows}</tbody></table></div>'
    abo = ""
    for g, rows in ABOS:
        r = "".join(f"<tr><td>{E(n)}</td><td>{E(t)}</td><td>{f}</td><td class=\"p\">{eur(p)} / Monat<br><span class=\"muted small\">12 Monate: {eur(p * 12)}</span></td></tr>" for n, t, f, p in rows)
        abo += f'<h3 style="margin-top:28px">{g}</h3><div class="tablewrap"><table class="prices"><thead><tr><th>Abo</th><th>Inhalt</th><th>Häufigkeit</th><th>Preis</th></tr></thead><tbody>{r}</tbody></table></div>'
    worlds = "".join(f'''<a class="card rv" href="{h}" style="text-decoration:none"><div class="card-img"><img src="/assets/img/{img}" alt="{E(alt)}" loading="lazy"></div><h3>{n}</h3><p class="price">{ab(sid)}</p><p class="muted small">{t}</p></a>''' for h, n, sid, img, alt, t in [
        ("/auto-innenreinigung/", "Innenreinigung", "innen-normal", "carcura-innenreinigung-cockpit-hd.webp", "Cockpit nach der Innenreinigung", "Saugen, Cockpit, Scheiben. Extras einzeln buchbar."),
        ("/autopolitur/", "Politur", "politur-1", "carcura-schwarzer-lack-spiegelung-hd.webp", "Spiegelung im schwarzen Lack", "1- oder 2-stufig, Wäsche und Kneten inklusive."),
        ("/keramikversiegelung/", "Keramik", "keramik", "carcura-audi-tt-politur-keramik-walterschen.webp", "Audi TT nach Politur und Keramik", "Inklusive 1-stufiger Politur."),
        ("/leasingrueckgabe-aufbereitung/", "Leasing & Verkauf", "leasing", "carcura-audi-a6-westerwald-hd.webp", "Audi A6 nach der Aufbereitung", "Innen und außen in einem Termin."),
        ("/scheinwerfer-aufbereiten/", "Scheinwerfer", "scheinwerfer", "carcura-weisser-lack-halle-glanz.webp", "Fahrzeug in der Halle", "Beide Seiten, mit UV-Schutz."),
        ("/wohnmobil-aufbereitung/", "Wohnmobil", "wohnmobil-basic", "carcura-ford-schaum-vorwaesche.webp", "Schaumvorwäsche in der Halle", "Halle bis 4 m Höhe, 7 m Länge.")])
    faq = [("Sind das Endpreise?", "Ja. Als Kleinunternehmer nach § 19 UStG weisen wir keine Umsatzsteuer aus. Es kommt nichts obendrauf."),
           ("Warum ab-Preise?", "Fahrzeuggröße, Zustand, Tierhaare und der tatsächliche Umfang beeinflussen den Aufwand. Den Endpreis bestätigen wir dir vor dem Termin. Leistungen sind nur enthalten, wenn sie ausdrücklich vereinbart wurden."),
           ("Muss ich anzahlen?", "Ab 500 € Auftragswert 50 % bei Terminbestätigung. Absage bis 48 Stunden vorher ist kostenlos."),
           ("Wie funktionieren die Abos?", 'Alle Abos haben 12 Monate Mindestlaufzeit und sind danach monatlich kündbar. Details in den <a href="/abo-bedingungen/">Abo-Bedingungen</a>.')]
    body = f'''
<section class="phead studio"><div class="wrap">{crumb([(None, "Leistungen")])}<p class="label">Leistungen & Preise</p>
<h1>Autoaufbereitung: Leistungen &amp; Preise.</h1>
<p class="lead">Alle Leistungen von Carcura mit Umfang und Ab-Preis. Von Hand in unserer Halle in Walterschen bei Altenkirchen. Du weißt vorher, was es kostet.</p>
<div class="btns">{btn("#preise", "Zur Preisliste", "acc", "arrow")}{btn(wa("Hi Carcura, ich möchte einen Preis anfragen. Mein Fahrzeug: "), "Preis per WhatsApp", "ghost", "wa", service="leistungen", ext=True)}</div></div></section>
<section class="sec soft"><div class="wrap"><p class="label">Leistungswelten</p><h2>Was wir machen.</h2><div class="grid g3" style="margin-top:22px">{worlds}</div>
<p class="fine" style="margin-top:16px">Außerdem: <a class="tlink" href="/autositz-reinigen-flecken/">Flecken im Sitz</a> · <a class="tlink" href="/tierhaare-auto-entfernen/">Tierhaare</a> · <a class="tlink" href="/geruch-im-auto-entfernen/">Geruch</a> · <a class="tlink" href="/spezialreinigung-auto/">Dampf- & Spezialreinigung</a> · <a class="tlink" href="/firmenkunde/">Händler & Firmen</a></p></div></section>
<section class="sec light" id="preise"><div class="wrap"><p class="label">Preisliste</p><h2>Alle Preise.</h2>
<p class="lead">Ab-Preise bei normaler Verschmutzung. Innen- und Waschleistungen gelten für PKW, Kombi und Van, Politur und Keramik für PKW und Kombi. SUV, Transporter und Wohnmobil: Angebot nach Fotos.</p>{promo_html()}{tables}
<p class="fine" style="margin-top:16px">Alle Preise sind Endpreise nach § 19 UStG. Ab 500 €: 50 % Anzahlung bei Terminbestätigung, Absage bis 48 Stunden vorher kostenlos.</p></div></section>
<section class="sec" id="abos"><div class="wrap"><p class="label">Regelmäßige Pflege</p><h2>Pflege-Abos.</h2>
<p class="lead">Alle Abos haben 12 Monate Mindestlaufzeit und sind danach monatlich kündbar. Angegeben sind Monatspreis und Gesamtbetrag über die Mindestlaufzeit.</p>{abo}
<p class="fine" style="margin-top:14px">Ab-Preise für PKW und Kombi bei normaler Verschmutzung. Größere Fahrzeuge, starke Verschmutzung oder Tierhaare: Angebot vor Vertragsbeginn. <a class="tlink" href="/abo-bedingungen/">Abo-Bedingungen</a> · <a class="tlink" href="/kuendigen/">Vertrag kündigen</a></p>
<div class="btns" style="margin-top:16px">{btn(anf("abo"), "Abo anfragen", "acc", "arrow")}</div></div></section>
{faq_html(faq, light=True)}
{cta_band("Preis für dein Auto.", "Wähle die Leistung im Formular oder schick Fotos per WhatsApp.", None, "Fahrzeugaufbereitung")}'''
    page("/leistungen/", "Autoaufbereitung Westerwald: Leistungen & Preise | Carcura",
         f"Alle Leistungen und Preise: Innenreinigung {ab('innen-normal')}, Handwäsche {ab('handwaesche')}, Politur {ab('politur-1')}, Keramik {ab('keramik')}, Pflege-Abos. Walterschen bei Altenkirchen.",
         body, ld=[faq_ld(faq)], crumbs=[("/leistungen/", "Leistungen")])


# ---------------------------------------------------------------- Orte
def km_cost(km):
    return max(0, km - 10) * 2


ORTE = {
    "fahrzeugaufbereitung-altenkirchen": dict(ort="Altenkirchen", km=None, title="Fahrzeugaufbereitung Altenkirchen – Abholung gratis | Carcura",
        h1="Fahrzeug&shy;aufbereitung für Altenkirchen. Abholung gratis.", lead="Unsere Halle steht in Walterschen, direkt vor den Toren von Altenkirchen. Altenkirchen liegt in unserem kostenlosen Abholgebiet: Wir holen dein Auto zu Hause oder am Arbeitsplatz ab und bringen es gepflegt zurück.",
        fact="Altenkirchen liegt im Umkreis von 10 km um Walterschen. Abholung und Rückgabe sind kostenlos.", near="Auch für Weyerbusch, Flammersfeld und die Orte drumherum gilt: bis 10 km kostenlos.",
        extra=("Kurz vor die Tür", "Aus Altenkirchen ist der Weg so kurz, dass sich auch kleine Aufträge mit Abholung lohnen, etwa eine Innenreinigung vor dem Wochenende oder die Scheinwerfer vor dem TÜV-Termin. Lieber selbst vorbeikommen? Die Halle ist nach Absprache auch abends und samstags offen."),
        quote="tobias"),
    "fahrzeugaufbereitung-asbach": dict(ort="Asbach", km=16, title="Fahrzeugaufbereitung Asbach – 16 km entfernt | Carcura",
        h1="Fahrzeug&shy;aufbereitung für Asbach. Gleich nebenan.", lead="Von Asbach bis zu unserer Halle in Walterschen sind es rund 16 km, knapp 20 Minuten über die L 272. Du bringst dein Auto vorbei oder wir holen es ab, zum Beispiel in Asbach, Buchholz oder Windhagen.",
        fact="", near="Abgeben am Morgen, abholen am Abend: Die Strecke ist kurz genug.",
        extra=("Asbach, Buchholz, Windhagen", "Über die L 272 bist du in knapp 20 Minuten in Walterschen. Viele bringen ihr Auto morgens auf dem Weg zur Arbeit vorbei. Abholung geht auch, ab Ortsmitte rund 6 Kilometer über dem kostenlosen Umkreis.")),
    "fahrzeugaufbereitung-hachenburg": dict(ort="Hachenburg", km=24, title="Fahrzeugaufbereitung Hachenburg – mit Abholung | Carcura",
        h1="Fahrzeug&shy;aufbereitung für Hachenburg. Wir holen ab.", lead="Von der Hachenburger Innenstadt bis zu unserer Halle in Walterschen sind es knapp 24 km, rund 25 Minuten über die B 414 und Altenkirchen. Die Strecke musst du nicht fahren.",
        fact="", near="Auch aus Bad Marienberg und Westerburg kommen Kunden zu uns.",
        extra=("Über die B 414", "Von Hachenburg führt die B 414 über Altenkirchen zu uns. Für eine Politur oder Keramik, bei der das Auto ohnehin mehrere Tage in der Halle bleibt, spart dir die Abholung zwei Fahrten.")),
    "fahrzeugaufbereitung-wissen": dict(ort="Wissen", km=25, title="Fahrzeugaufbereitung Wissen & Betzdorf – mit Abholung | Carcura",
        h1="Fahrzeug&shy;aufbereitung für Wissen und Betzdorf.", lead="Von Wissen bis zu unserer Halle in Walterschen sind es gut 25 km, knapp 30 Minuten über die B 62 und B 256 via Altenkirchen. Wir holen in Wissen, Hamm (Sieg), Betzdorf oder Kirchen ab.",
        fact="", near="Aus Betzdorf sind es rund 40 km, die Abholung kostet dann ca. 60 €. Für Kirchen nennen wir dir den Betrag nach Adresse.",
        extra=("Aus dem Siegtal", "Wissen, Hamm (Sieg), Betzdorf, Kirchen: Die Strecke führt über die B 62 und B 256 durch Altenkirchen. Bei größeren Aufträgen wie dem Leasingrückgabe-Paket oder einer Politur rechnet sich die Abholung eher als bei einer einzelnen Innenreinigung.")),
    "fahrzeugaufbereitung-neuwied": dict(ort="Neuwied", km=36, title="Fahrzeugaufbereitung Neuwied – mit Abholung | Carcura",
        h1="Fahrzeug&shy;aufbereitung für Neuwied. Mit Abholung.", lead="Von Neuwied bis zu unserer Halle in Walterschen sind es rund 36 km, etwa 40 Minuten über die B 256. Ehrlich gerechnet lohnt sich die Abholung vor allem bei größeren Aufträgen wie Politur, Keramik oder dem Leasingrückgabe-Paket.",
        fact="", near="Für kleine Aufträge ist Selbstbringen oft günstiger.",
        extra=("Ehrlich gerechnet", "36 Kilometer sind eine Strecke. Für eine Innenreinigung ab 90 € wären ca. 52 € Abholung viel. Bei Keramik ab 700 € oder einer 2-stufigen Politur fällt die Abholung kaum ins Gewicht, und dein Auto bleibt ohnehin mehrere Tage bei uns.")),
}


def ort_page(slug, o):
    ort = o["ort"]
    if o["km"]:
        c = km_cost(o["km"])
        fact = f"{o['km']} km Straße ab Walterschen (einfache Strecke, Ortsmitte): rund {o['km'] - 10} Zusatz-km × 2 € = ca. {eur(c)} für Abholung und Rückgabe. Den genauen Betrag nach deiner Adresse bestätigen wir vorab."
        price_line = f"Abholung aus {ort} ca. {eur(c)}"
    else:
        fact = o["fact"]
        price_line = f"Abholung in {ort} kostenlos"
    cards = "".join(f'<a class="card rv" href="{h}" style="text-decoration:none"><h3>{n}</h3><p class="price">{ab(s)}</p><p class="muted small">{t}</p></a>' for h, n, s, t in [
        ("/auto-innenreinigung/", "Innenreinigung", "innen-normal", "Saugen, Cockpit, Scheiben, Fußmatten."), ("/auto-innenreinigung/#pakete", "Innen & außen", "basic", "Mit Handwäsche und Felgen."),
        ("/leasingrueckgabe-aufbereitung/", "Leasingrückgabe", "leasing", "Vor Rückgabe oder Verkauf."), ("/autopolitur/", "Politur", "politur-1", "Wäsche und Kneten inklusive."),
        ("/keramikversiegelung/", "Keramik", "keramik", "Inklusive 1-stufiger Politur."), ("/scheinwerfer-aufbereiten/", "Scheinwerfer", "scheinwerfer", "Beide Seiten, mit UV-Schutz.")])
    faq = [(f"Holt ihr mein Auto in {ort} ab?", f"Ja. {fact}"),
           ("Wo genau ist eure Halle?", f"In der {B['street']}, {B['postcode']} {B['city']}, zwischen Altenkirchen und Weyerbusch. Termine nach Vereinbarung, auch abends und samstags."),
           ("Wann bezahle ich?", "Nach der Übergabe. Ab 500 € Auftragswert ist eine Anzahlung von 50 % bei Terminbestätigung fällig.")]
    body = f'''
<section class="phead studio"><div class="wrap hero-grid"><div>{crumb([("/fahrzeugaufbereitung-westerwald/", "Einzugsgebiet"), (None, ort)])}
<p class="label">Autoaufbereitung · {ort}</p><h1>{o["h1"]}</h1><p class="lead">{o["lead"]}</p>
<div class="pricebig"><b>{"0 €" if not o["km"] else "ca. " + eur(km_cost(o["km"]))}</b><span>für Abholung und Rückgabe</span></div>
<div class="btns">{btn(anf("innen-normal", pickup=True), "Mit Abholung anfragen", "acc", "arrow")}{btn(wa(f"Hi Carcura, ich komme aus {ort} und möchte einen Preis anfragen. Mein Fahrzeug: "), "Preis per WhatsApp", "ghost", "wa", service=ort, ext=True)}</div>
<ul class="chips"><li>{price_line}</li><li>Inhabergeführt: Alex & Richy</li><li>Bezahlt wird nach Übergabe</li></ul></div>
<div>{photo("carcura-team-alexander-richy.webp", "Richy Schumacher und Alexander Fuchs von Carcura", "Alex & Richy, eure Ansprechpartner", "ratio-45", eager=True)}</div></div></section>
<section class="sec light"><div class="wrap two"><div><p class="label">So läuft es</p><h2>Aus {ort} in drei Schritten.</h2><p class="lead">{fact} {o["near"]}</p></div>
<ol class="steps"><li><b>Anfragen.</b>Leistung wählen oder Fotos per WhatsApp schicken.</li><li><b>Bringen oder abholen lassen.</b>Zu Hause oder am Arbeitsplatz.</li><li><b>Gepflegt zurück.</b>Aufbereitung von Hand in unserer Halle. Bezahlt wird bei Übergabe.</li></ol></div></section>
<section class="sec"><div class="wrap two"><div><p class="label">{ort}</p><h2>{o["extra"][0]}.</h2></div><p class="lead">{o["extra"][1]}</p></div></section>
<section class="sec soft"><div class="wrap"><p class="label">Leistungen & Preise</p><h2>Für {ort}.</h2><p class="lead">Ab-Preise für PKW und Kombi bei normaler Verschmutzung. Endpreise nach § 19 UStG.</p><div class="grid g3" style="margin-top:22px">{cards}</div>
{'<div style="margin-top:22px">' + quote_html(o["quote"]) + "</div>" if o.get("quote") else ""}</div></section>
<section class="sec studio"><div class="wrap two"><div><p class="label">Abholkosten</p><h2>Rechne selbst.</h2><p class="lead">Bis 10 km kostenlos, darüber 2 € pro Kilometer der einfachen Strecke. Hin- und Rückfahrt sind damit abgegolten.</p></div>{calc_html(o["km"] or 8)}</div></section>
{faq_html(faq, light=True)}
{cta_band(f"Auto aus {ort} aufbereiten lassen.", "Sag uns, wo das Auto steht. Angebot und Abholzeit stimmen wir vorher ab.", "innen-normal", f"Fahrzeugaufbereitung in {ort}")}'''
    desc = f"Autoaufbereitung für {ort}: Innenreinigung {ab('innen-normal')}, Politur {ab('politur-1')}, Keramik {ab('keramik')}. {price_line}. Halle in Walterschen."
    page(f"/{slug}/", o["title"], desc, body, ld=[faq_ld(faq)], crumbs=[("/fahrzeugaufbereitung-westerwald/", "Einzugsgebiet"), (f"/{slug}/", ort)])


def westerwald():
    rows = "".join(f"<tr><td>{n}</td><td>{k}</td><td class=\"p\">{('kostenlos' if km_cost(km) == 0 else 'ca. ' + eur(km_cost(km)))}</td><td>{('<a class=\"tlink\" href=\"' + h + '\">Seite</a>') if h else ''}</td></tr>"
                   for n, k, km, h in [("Altenkirchen, Weyerbusch, Flammersfeld", "bis 10 km", 8, "/fahrzeugaufbereitung-altenkirchen/"), ("Asbach", "ca. 16 km", 16, "/fahrzeugaufbereitung-asbach/"),
                                       ("Hachenburg", "ca. 24 km", 24, "/fahrzeugaufbereitung-hachenburg/"), ("Wissen", "ca. 25 km", 25, "/fahrzeugaufbereitung-wissen/"), ("Neuwied", "ca. 36 km", 36, "/fahrzeugaufbereitung-neuwied/")])
    faq = [("Welche Orte bedient ihr?", "Rund um Walterschen, Altenkirchen, Weyerbusch und Flammersfeld; im Westerwald unter anderem Hachenburg, Bad Marienberg, Westerburg, Wissen, Hamm (Sieg), Puderbach und Dierdorf; angrenzend Asbach, Neuwied, Waldbröl und Windeck."),
           ("Was kostet die Abholung?", "Bis 10 km um Walterschen kostenlos, darüber 2 € pro Kilometer der einfachen Strecke. Hin- und Rückfahrt sind damit abgegolten.")]
    body = f'''
<section class="phead studio"><div class="wrap">{crumb([(None, "Einzugsgebiet Westerwald")])}<p class="label">Einzugsgebiet · Westerwald</p>
<h1>Autoaufbereitung im Westerwald: Orte &amp; Abholung.</h1>
<p class="lead">Carcura ist die inhabergeführte Fahrzeugaufbereitung in Walterschen, mitten im Westerwald zwischen Altenkirchen und Weyerbusch. Hier siehst du, aus welchen Orten Kunden zu uns kommen und was die Abholung kostet.</p>
<div class="btns">{btn(anf("innen-normal", pickup=True), "Mit Abholung anfragen", "acc", "arrow")}<a class="tlink" href="/">Alle Leistungen auf der Startseite</a></div></div></section>
<section class="sec light"><div class="wrap"><p class="label">Entfernungen</p><h2>Was kostet die Abholung?</h2>
<div class="tablewrap" style="margin-top:18px"><table class="prices"><thead><tr><th>Ort</th><th>Straße ab Walterschen</th><th>Abholung & Rückgabe</th><th><span class="sr">Ortsseite</span></th></tr></thead><tbody>{rows}</tbody></table></div>
<p class="fine" style="margin-top:12px">Richtwerte ab Ortsmitte. Den genauen Betrag nach deiner Adresse bestätigen wir vor dem Termin.</p></div></section>
<section class="sec studio"><div class="wrap"><p class="label">Leistungen & Preise</p><h2>Was wir machen.</h2><div class="grid g3" style="margin-top:22px">{"".join(f'<a class="card rv" href="{h}" style="text-decoration:none"><h3>{n}</h3><p class="price">{ab(i)}</p><p class="muted small">{t}</p></a>' for h, n, i, t in [("/auto-innenreinigung/", "Innenreinigung", "innen-normal", "Saugen, Cockpit, Scheiben, Fußmatten."), ("/autopolitur/", "Politur", "politur-1", "Wäsche und Kneten inklusive."), ("/keramikversiegelung/", "Keramik", "keramik", "Inklusive 1-stufiger Politur.")])}</div>
<p style="margin-top:18px"><a class="tlink" href="/leistungen/">Alle Leistungen und Preise</a> · <a class="tlink" href="/hol-und-bringservice/">Abholung mit Rechner</a></p></div></section>
<section class="sec soft"><div class="wrap two"><div><p class="label">Selbst vorbeikommen</p><h2>Unsere Halle.</h2><p class="lead">{E(B["street"])}, {B["postcode"]} {E(B["city"])}. {hours_html().replace("<br>", ", ")}. {E(B["hoursNote"])}.</p></div>
<div>{photo("carcura-ford-schaum-vorwaesche.webp", "Fahrzeug bei der Vorwäsche in der Carcura-Halle in Walterschen", "Unsere Halle in Walterschen", "ratio-916")}</div></div></section>
{faq_html(faq, light=True)}'''
    page("/fahrzeugaufbereitung-westerwald/", "Autoaufbereitung im Westerwald: Orte & Abholung | Carcura",
         "Aus welchen Orten im Westerwald Kunden zu Carcura nach Walterschen kommen und was die Abholung kostet: bis 10 km gratis, darüber 2 € pro km.", body, ld=[faq_ld(faq)], crumbs=[("/fahrzeugaufbereitung-westerwald/", "Einzugsgebiet")])


# ---------------------------------------------------------------- weitere Seiten
CRUMB = {"/hol-und-bringservice/": "Hol- & Bringservice", "/firmenkunde/": "Händler & Firmen", "/partner/": "Partner", "/ueber-uns/": "Über uns", "/galerie/": "Galerie",
         "/gutschein/": "Gutschein", "/anfragen/": "Anfragen", "/kuendigen/": "Vertrag kündigen", "/impressum/": "Impressum", "/datenschutz/": "Datenschutz",
         "/cookie-richtlinie-eu/": "Cookie-Richtlinie", "/abo-bedingungen/": "Abo-Bedingungen", "/widerruf/": "Widerrufsbelehrung"}


def simple(path, title, desc, h1, lead, inner, label="", crumbs=None, robots="index,follow", ld=None, js=()):
    cn = CRUMB.get(path, re.sub("<[^>]+>|&shy;", "", h1).rstrip("."))
    body = f'''<section class="phead studio"><div class="wrap">{crumb(crumbs or [(None, cn)])}<p class="label">{label}</p><h1>{h1}</h1>{f'<p class="lead">{lead}</p>' if lead else ""}</div></section>{inner}'''
    page(path, title, desc, body, robots=robots, ld=ld, js=js, crumbs=[(path, cn)])


def holservice():
    inner = f'''<section class="sec light"><div class="wrap two"><div><p class="label">Abholkosten</p><h2>So einfach rechnen wir.</h2>
<p class="lead">Im Umkreis von 10 km um unsere Halle holen wir kostenlos ab. Für jeden Kilometer darüber berechnen wir 2 €, gemessen als Straßenentfernung, einfache Strecke. Hin- und Rückfahrt sind damit abgegolten.</p>
<div class="tablewrap"><table class="prices"><tbody><tr><td>bis 10 km</td><td class="p">0 € – kostenlos</td></tr><tr><td>15 km</td><td class="p">10 €</td></tr><tr><td>20 km</td><td class="p">20 €</td></tr><tr><td>30 km</td><td class="p">40 €</td></tr></tbody></table></div></div>{calc_html(8)}</div></section>
<section class="sec"><div class="wrap two"><div><p class="label">Ablauf</p><h2>Schlüssel abgeben. Fertig.</h2></div><ol class="steps"><li><b>Anfragen.</b>Leistung, Adresse und Wunschtag nennen.</li><li><b>Preis vorab.</b>Aufbereitung und Abholung, verbindlich vor dem Termin.</li><li><b>Abholung.</b>Zu Hause oder am Arbeitsplatz.</li><li><b>Persönliche Übergabe.</b>Bezahlt wird nach der Rückgabe. Ab 500 € Auftragswert 50 % Anzahlung bei Terminbestätigung.</li></ol></div></section>
<section class="sec soft"><div class="wrap">{quote_html("tobias")}</div></section>
{cta_band("Wir holen dein Auto ab.", "Sag uns, wo das Auto steht und welche Leistung du möchtest.", "innen-normal", "Aufbereitung mit Hol- und Bringservice")}'''
    inner = inner.replace(anf("innen-normal"), anf("innen-normal", pickup=True))
    faq = [("Was kostet der Hol- und Bringservice?", "Bis 10 km um Walterschen kostenlos, darüber 2 € pro Kilometer der einfachen Strecke, Hin- und Rückfahrt inklusive.")]
    simple("/hol-und-bringservice/", "Autoaufbereitung mit Hol- & Bringservice Westerwald | Carcura",
           "Wir holen dein Auto zu Hause oder am Arbeitsplatz ab: bis 10 km um Walterschen kostenlos, darüber 2 € pro km. Mit Rechner. Carcura Fahrzeugaufbereitung.",
           "Hol- und Bring&shy;service. Wir holen dein Auto ab.", "Keine Zeit, nach Walterschen zu fahren? Musst du nicht. Wir holen dein Fahrzeug ab, bereiten es in unserer Halle von Hand auf und bringen es gepflegt zurück.",
           inner, "Hol- & Bringservice · Westerwald", ld=[faq_ld(faq)])


def firmenkunde():
    fl = wa("Guten Tag, wir sind ein Autohaus/Firma und interessieren uns für Händlerkonditionen. Fahrzeuge pro Monat: ")
    inner = f'''<section class="sec light"><div class="wrap two"><div><p class="label">Leistungen für Händler & Firmen</p><h2>Verkaufsfertig vom Hof.</h2>
<p class="lead">Wir bereiten Gebrauchtwagen, Inzahlungnahmen und Leasingrückläufer auf, mit festem Ansprechpartner, abgestimmten Terminfenstern und Konditionen nach Volumen. Pauschale Händlerpreise veröffentlichen wir nicht, Sie erhalten ein Angebot passend zu Ihrem Bedarf.</p></div>
<div class="grid" style="gap:12px">{"".join(f'<div class="card"><h3>{a}</h3><p class="muted small" style="margin:0">{b}</p></div>' for a, b in [("Verkaufsaufbereitung innen & außen", "Handwäsche mit Felgen, gründliche Innenreinigung inklusive Sitze, Kunststoffe und Scheiben."), ("Lack & Optik", "Politur gegen Waschkratzer, Scheinwerferaufbereitung gegen vergilbte Gläser."), ("Gerüche, Tierhaare & Flecken", "Ozon, Tierhaarentfernung, Polster-Tiefenreinigung bei Inzahlungnahmen."), ("Auslieferung & Keramik", "Aufbereitung vor der Übergabe, auf Wunsch Keramik für Ihre Käufer."), ("Fuhrparkpflege", "Regelmäßige Innen- und Außenpflege für Firmenfahrzeuge.")])}</div></div></section>
<section class="sec"><div class="wrap two"><div><p class="label">Gesprächstermin</p><h2>Was wir von Ihnen brauchen.</h2><p class="lead">Fahrzeuge pro Monat, gewünschte Aufbereitungsstufe, Durchlaufzeit und ob wir vom Hof abholen sollen. Daraus erstellen wir ein Angebot.</p>
<div class="btns">{btn(anf("haendler"), "Anfrage als Firma", "acc", "arrow")}{btn(B["phoneHref"], "0170 6669516 anrufen", "ghost", "tel", service="firmenkunde")}{btn(fl, "WhatsApp", "ghost", "wa", service="firmenkunde", ext=True)}</div></div>
<div>{photo("carcura-weisser-lack-halle-glanz.webp", "Fahrzeug mit glänzendem Lack in der Carcura-Halle", "Unsere Halle in Walterschen", "ratio-916")}</div></div></section>'''
    simple("/firmenkunde/", "Aufbereitung für Autohändler & Fuhrparks im Westerwald | Carcura",
           "Verkaufsaufbereitung für Autohändler, Inzahlungnahmen und Fuhrparkpflege im Westerwald: fester Ansprechpartner, Abholung vom Hof, Konditionen nach Volumen.",
           "Fahrzeug&shy;aufbereitung für Händler und Firmen.", "Gebrauchtwagen, Leasingrückläufer und Firmenfahrzeuge: Wir holen vom Hof ab und bringen verkaufsfertig zurück. Direkt mit den Gründern, ohne Callcenter.",
           inner, "Händler & Firmen")


def partner():
    inner = f'''<section class="sec light"><div class="wrap grid g2">
<div class="card"><p class="label">Fahrzeugpflege · Saarbrücken</p><h3>Nanolex Car Care</h3><p>Bei ausgewählten Arbeitsschritten setzt Carcura auf Produkte von Nanolex für Reinigung, Pflege und Schutz. Nach Angaben von Nanolex entwickelt und produziert in Deutschland.</p><p><a class="tlink" href="https://www.nanolexcarcare.com/" target="_blank" rel="noopener">Nanolex besuchen</a></p></div>
<div class="card"><p class="label">Regional · Nümbrecht</p><h3>HF Reifenservice</h3><p>Ein regionaler Partner für Reifen- und Radservice. Kurze Wege und direkte Kommunikation ergänzen unsere Fahrzeugpflege.</p></div>
</div><div class="wrap"><p class="fine" style="margin-top:18px">Wir verkaufen keine Produkte über die Website. Kooperationsanfragen gerne per <a class="tlink" href="mailto:{B["email"]}">E-Mail</a>.</p></div></section>'''
    simple("/partner/", "Partner von Carcura | Nanolex & HF Reifenservice", "Mit wem Carcura zusammenarbeitet: Nanolex Car Care für Reinigung, Pflege und Schutz, HF Reifenservice für Reifen- und Radservice.",
           "Unsere Partner: Nanolex und HF Reifenservice.", "Gute Fahrzeugpflege entsteht im Detail. Wir verbinden gründliche Arbeit in Walterschen mit ausgewählten Produkten und regionaler Zusammenarbeit.", inner, "Partner")


def ueber_uns():
    inner = f'''<section class="sec light" id="team"><div class="wrap two"><div>{photo("carcura-team-alexander-richy.webp", "Richy Schumacher (links) und Alexander Fuchs (rechts) in der Carcura-Halle", "Richy Schumacher (links) und Alexander Fuchs (rechts)", "ratio-45", eager=True)}</div>
<div><p class="label">Die Gesichter hinter Carcura</p><h2>Persönlich statt anonym.</h2><p class="lead">Du sprichst direkt mit den beiden Gründern der Carcura GbR, und genau die bereiten dein Auto auch auf.</p>
<div class="grid" style="gap:12px"><div class="card"><h3>Alexander Fuchs</h3><p class="muted small" style="margin:0">Mitgründer. Dein Ansprechpartner für Anfragen, Termine und die passende Leistung.</p></div>
<div class="card"><h3>Richy Schumacher</h3><p class="muted small" style="margin:0">Mitgründer. Detailarbeit an Innenraum, Lack und Felgen.</p></div></div></div></div></section>
<section class="sec"><div class="wrap"><p class="label">Wofür wir stehen</p><h2>Drei Dinge.</h2><div class="grid g3" style="margin-top:22px">
<div class="card"><h3>Handarbeit</h3><p class="muted small" style="margin:0">Keine Waschstraße. Wir arbeiten in unserer Halle mit Zeit fürs Detail.</p></div>
<div class="card"><h3>Offene Preise</h3><p class="muted small" style="margin:0">Ab-Preise online, Endpreis vor dem Termin. Bezahlt wird nach der Übergabe, ab 500 € mit 50 % Anzahlung.</p></div>
<div class="card"><h3>Ehrliche Einschätzung</h3><p class="muted small" style="margin:0">Was eine Politur oder Keramik nicht kann, sagen wir dir vorher.</p></div></div>
<p style="margin-top:22px">Der Name: Car und cura, lateinisch für Sorgfalt. {rating_line()}</p></div></section>
{cta_band("Lern uns kennen.", "Ruf an, schreib per WhatsApp oder komm nach Absprache in Walterschen vorbei.", None, "Fahrzeugaufbereitung")}'''
    simple("/ueber-uns/", "Über uns | Carcura Fahrzeugaufbereitung Walterschen", "Carcura ist die inhabergeführte Fahrzeugaufbereitung von Alexander Fuchs und Richy Schumacher in Walterschen bei Altenkirchen. Handarbeit, offene Preise.",
           "Über Carcura: Alexander Fuchs und Richy Schumacher.", "Inhabergeführte Fahrzeugaufbereitung in Walterschen im Westerwald, zwischen Altenkirchen und Weyerbusch. Die Aufbereitung machen wir selbst.", inner, "Über Carcura · Walterschen")


GAL = [("carcura-bmw-m2-front-nachher-hd.webp", "BMW M2 Front nach der Keramikversiegelung", "BMW M2 · Keramik · nachher", "keramik"),
       ("carcura-bmw-m2-front-vorher-hd.webp", "BMW M2 Front vor der Aufbereitung", "BMW M2 · vorher", "keramik"),
       ("carcura-audi-tt-politur-keramik-walterschen.webp", "Audi TT nach Politur und Keramik", "Audi TT 8n · Politur & Keramik", "politur keramik"),
       ("carcura-schwarzer-lack-spiegelung-hd.webp", "Spiegelung im schwarzen Lack", "Schwarzer Lack · Politur", "politur"),
       ("carcura-weisser-lack-halle-glanz.webp", "Glänzender weißer Lack in der Halle", "Weißer Lack · Glanz", "politur"),
       ("carcura-innenreinigung-cockpit-hd.webp", "Cockpit nach der Innenreinigung", "Cockpit · Innenreinigung", "innen"),
       ("img_1689.webp", "Fußraum unter dem Sitz vorher", "Fußraum · vorher", "innen"), ("img_1690.webp", "Fußraum unter dem Sitz nachher", "Fußraum · nachher", "innen"),
       ("carcura-tankklappe-vorher.webp", "Tankklappe vorher", "Ford Tankklappe · vorher", "aussen"), ("carcura-tankklappe-nachher.webp", "Tankklappe nachher", "Ford Tankklappe · nachher", "aussen"),
       ("carcura-ford-schaum-vorwaesche.webp", "Ford bei der Schaumvorwäsche", "Ford · Schaumvorwäsche", "aussen"), ("carcura-felge-felgenreiniger-schaum.webp", "Felge mit Felgenreiniger-Schaum", "Felge · Felgenreiniger", "aussen"),
       ("img_1962-1-scaled.webp", "Heck eines Porsche mit rosa Schaum bei der Vorwäsche", "Porsche · Vorwäsche mit Felgenreiniger-Schaum", "aussen"),
       ("carcura-audi-a6-westerwald-hd.webp", "Audi A6 nach der Aufbereitung im Westerwald", "Audi A6 · nach der Aufbereitung", "aussen")]


def galerie():
    figs = "".join(f'<figure data-cat="{c}"><button type="button" data-full="/assets/img/{s}" data-cap="{E(cap)}"><img src="/assets/img/{s}" alt="{E(a)}" loading="lazy"></button><figcaption>{E(cap)}</figcaption></figure>' for s, a, cap, c in GAL)
    filt = "".join(f'<button class="btn btn-ghost" type="button" data-filter="{v}" aria-pressed="{"true" if v == "alle" else "false"}" style="min-height:44px">{n}</button>' for v, n in [("alle", "Alle"), ("aussen", "Außen"), ("innen", "Innen"), ("politur", "Politur"), ("keramik", "Keramik")])
    inner = f'''<section class="sec"><div class="wrap"><div class="grid g2" style="margin-bottom:34px">{ba("carcura-bmw-m2-front-vorher-hd.webp", "carcura-bmw-m2-front-nachher-hd.webp", "BMW M2 Front vorher", "BMW M2 Front nachher", "BMW M2 · Front · Keramikversiegelung")}{ba("carcura-tankklappe-vorher.webp", "carcura-tankklappe-nachher.webp", "Tankklappe vorher", "Tankklappe nachher", "Ford · Tankklappe · Detailreinigung")}</div>
<div class="btns" role="group" aria-label="Filter">{filt}</div><div class="gal" style="margin-top:22px">{figs}</div>
<p style="margin-top:22px">Mehr Fahrzeuge zeigen wir laufend auf <a class="tlink" href="{B["instagram"]}" target="_blank" rel="noopener">Instagram @_carcura_</a>.</p></div></section>
<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Bildansicht"><img alt=""><button class="lb-x" type="button" aria-label="Schließen">×</button><button class="lb-p" type="button" aria-label="Vorheriges Bild">‹</button><button class="lb-n" type="button" aria-label="Nächstes Bild">›</button><p></p></div>
{cta_band("Dein Auto als Nächstes?", "Schick uns Fotos, wir sagen dir, was möglich ist.", None, "Fahrzeugaufbereitung")}'''
    simple("/galerie/", "Galerie: Ergebnisse unserer Fahrzeugaufbereitung | Carcura", "Echte Ergebnisse aus unserer Halle in Walterschen: Innenreinigung, Politur, Keramik, Vorher-Nachher. Keine Symbolbilder.",
           "Ergebnisse sehen.", "Alle Fotos sind bei uns in Walterschen an Fahrzeugen unserer Kunden entstanden. Keine Symbolbilder, keine Renderings.", inner, "Galerie")


def gutschein():
    cards = "".join(f'<div class="card rv"><h3>{n}</h3><p class="price">{p}</p><p class="muted small">{t}</p><div class="btns">{btn(wa(f"Hi Carcura, ich möchte einen Gutschein verschenken: {n}. "), "Gutschein anfragen", "ghost", "wa", service="gutschein", ext=True)}</div></div>' for n, p, t in [
        ("Wertgutschein", "frei", "Betrag frei wählbar, einlösbar für jede Leistung."), ("Innenraumreinigung Normal", ab("innen-normal"), "Gründliche Innenreinigung."),
        ("Basic Innen & Außen", ab("basic"), "Innen plus Handwäsche mit Felgen."), ("Scheinwerfer", ab("scheinwerfer"), "Beide Scheinwerfer wieder klar."), ("Keramikversiegelung", ab("keramik"), "Inklusive 1-stufiger Politur.")])
    inner = f'''<section class="sec light"><div class="wrap">{promo_html()}<div class="grid g3" style="margin-top:18px">{cards}</div>
<ol class="steps" style="margin-top:34px"><li><b>Auswählen.</b>Leistung oder Wunschbetrag per WhatsApp oder Formular nennen.</li><li><b>Bezahlen und übergeben.</b>Stimmen wir persönlich mit dir ab.</li><li><b>Einlösen.</b>Die beschenkte Person vereinbart einen Termin in Walterschen.</li></ol>
<div class="btns" style="margin-top:22px">{btn(anf("gutschein"), "Gutschein über das Formular", "acc", "arrow")}</div></div></section>'''
    simple("/gutschein/", "Gutschein für Autoaufbereitung verschenken | Carcura", "Gutschein für Fahrzeugaufbereitung in Walterschen: Wunschbetrag oder Leistung, zu Weihnachten, Geburtstag oder einfach so.",
           "Autopflege verschenken.", "Gutschein für eine Leistung oder einen Wunschbetrag, eingelöst in unserer Halle in Walterschen.", inner, "Geschenkidee")


FORM_SERVICES = [("innen-normal", "innenraumreinigung normal|innenreinigung|innen"), ("innen-detail", ""), ("handwaesche", "handwäsche|waesche"), ("handwaesche-wachs", ""), ("basic", "innen und außen|basic"),
                 ("familie", ""), ("leasing", "leasingrückgabe|leasing"), ("politur-1", "1-stufige politur|politur"), ("politur-2", ""), ("keramik", "keramikversiegelung|keramik"),
                 ("felgen-keramik", ""), ("scheiben-keramik", ""), ("spruehversiegelung", ""), ("keramik-pflege", ""), ("sitz-fleck", "fleck"), ("polster", ""), ("tierhaare", ""), ("ozon", "geruch"),
                 ("fleck-geruch", ""), ("leder", ""), ("leder-versiegeln", ""), ("scheinwerfer", ""), ("wohnmobil-basic", ""), ("wohnmobil-komplett", "wohnmobil")]
EXTRA_FORM = [("spezial", "Dampf- & Spezialreinigung", "Preis nach Foto"), ("abo", "Pflege-Abo", "ab 55 € / Monat"), ("gutschein", "Gutschein", ""), ("haendler", "Händler / Fuhrpark", "Angebot nach Volumen"), ("andere", "Andere Wünsche", "im Nachrichtenfeld beschreiben")]


def anfragen():
    MAIN = {"innen-normal", "innen-detail", "handwaesche", "basic", "familie", "leasing", "politur-1", "politur-2", "keramik", "scheinwerfer"}
    def o(i, n, p, a=""):
        return f'<label class="opt"><input type="checkbox" name="leistung" value="{E(n)}" data-id="{i}" data-alias="{a}" data-price="{E(p)}"><span>{E(n)}<small>{E(p)}</small></span></label>'
    allopts = [(i, S[i]["title"], ab(i), a) for i, a in FORM_SERVICES] + [(i, n, p, "") for i, n, p in EXTRA_FORM]
    main = "".join(o(*x) for x in allopts if x[0] in MAIN or x[0] == "andere")
    rest = "".join(o(*x) for x in allopts if not (x[0] in MAIN or x[0] == "andere"))
    opts = main + "</div>" + f'<details id="more-opts" style="margin-top:10px"><summary class="tlink" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Weitere Leistungen: Flecken, Tierhaare, Ozon, Felgen- und Scheiben-Keramik, Wohnmobil, Abo, Gutschein …</summary><div class="opts">{rest}</div></details><div>'

    inner = f'''<section class="sec soft"><div class="wrap" style="max-width:980px">
<form id="anfrage" class="form" data-endpoint="/wp-json/ccrr/v1/lead" novalidate>
<fieldset class="fs"><legend><span>1</span>Leistung und Fahrzeug</legend><p class="muted small">Mehrfachauswahl möglich. Extras werden nicht doppelt berechnet, den Endpreis bestätigen wir dir.</p>
<p id="err-leistung" class="ferr" hidden></p><div class="opts" role="group" aria-label="Leistungen" aria-describedby="err-leistung">{opts}</div><p id="selsum" class="selsum" aria-live="polite" style="margin-top:12px"></p>
<div class="fgrid"><div class="field"><label for="vehicle">Fahrzeug (Marke, Modell)</label><input id="vehicle" name="vehicle" autocomplete="off" placeholder="z. B. VW Touran"></div>
<div class="field"><label for="condition">Zustand</label><select id="condition" name="condition"><option value="">Bitte wählen</option><option>normal verschmutzt</option><option>stark verschmutzt</option><option>Tierhaare</option><option>Flecken</option><option>Geruch</option><option>weiß ich nicht</option></select></div></div></fieldset>
<fieldset class="fs"><legend><span>2</span>Wann und wo</legend><div class="fgrid">
<div class="field"><label for="wunschtag">Wunschtag</label><input id="wunschtag" name="wunschtag" type="date" min="{TODAY.isoformat()}"></div>
<div class="field"><label for="zeitfenster">Ungefähres Zeitfenster</label><select id="zeitfenster" name="zeitfenster"><option value="">egal</option><option>vormittags</option><option>nachmittags</option><option>abends</option><option>samstags</option></select></div></div>
<label class="opt" style="margin-top:12px"><input type="checkbox" name="pickup" value="1"><span>Hol- und Bringservice gewünscht<small>bis 10 km kostenlos, darüber 2 € pro km</small></span></label>
<div class="field" id="pickup-wrap" hidden style="margin-top:10px"><label for="pickup_ort">Abholort (Ort oder Adresse)</label><input id="pickup_ort" name="pickup_ort" autocomplete="street-address"></div></fieldset>
<fieldset class="fs"><legend><span>3</span>Kontakt</legend><div class="fgrid">
<div class="field"><label for="name">Name *</label><input id="name" name="name" required autocomplete="name"></div>
<div class="field"><label for="customer_type">Ich bin</label><select id="customer_type" name="customer_type"><option value="privat">Privatkunde</option><option value="firma">Firma / Händler</option></select></div>
<div class="field"><label for="phone">Telefon (für Rückruf oder WhatsApp)</label><input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" aria-describedby="err-kontakt"></div>
<div class="field"><label for="email">E-Mail</label><input id="email" name="email" type="email" autocomplete="email" aria-describedby="err-kontakt"></div>
<div class="field"><label for="kontaktweg">Am liebsten erreichbar per</label><select id="kontaktweg" name="kontaktweg"><option value="">egal</option><option>WhatsApp</option><option>Anruf</option><option>E-Mail</option></select></div></div>
<div class="field" style="margin-top:12px"><label for="message">Nachricht (optional)</label><textarea id="message" name="message" placeholder="Was stört dich? Fotos kannst du danach per WhatsApp schicken."></textarea></div>
<p class="fine">Telefon oder E-Mail genügt. * Pflichtfeld.</p><p id="err-kontakt" class="ferr" hidden></p>
<div class="hp" aria-hidden="true"><label for="website">Website</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
<label class="opt" style="margin-top:8px"><input type="checkbox" name="privacy" required><span>Ich bin einverstanden, dass Carcura meine Angaben zur Bearbeitung der Anfrage verwendet. Mehr in der <a class="tlink" href="/datenschutz/">Datenschutzerklärung</a>. *</span></label></fieldset>
<div class="btns"><button class="btn btn-acc" type="submit">Anfrage senden</button><span class="fine">Das ist eine unverbindliche Terminanfrage, keine Buchung.</span></div>
<div id="status" class="status" role="status" tabindex="-1"></div>
</form>
<p class="fine" style="margin-top:18px">Lieber direkt? <a class="tlink" href="{B["phoneHref"]}" data-service="anfragen">0170 6669516</a> · <a class="tlink" href="{wa("Hi Carcura, ich möchte einen Preis anfragen. Mein Fahrzeug: ")}" target="_blank" rel="noopener" data-service="anfragen">WhatsApp</a> · <a class="tlink" href="mailto:{B["email"]}">{B["email"]}</a></p>
</div></section>'''
    simple("/anfragen/", "Fahrzeugpflege anfragen | Carcura Walterschen", "Unverbindlich anfragen: Leistung wählen, Fahrzeug angeben, Wunschtermin und Abholung. Antwort persönlich von Alex & Richy.",
           "Anfrage in drei Schritten.", "Wähle eine oder mehrere Leistungen, sag uns Fahrzeug und Wunschtag. Wir antworten persönlich mit Einschätzung, Preis und Terminvorschlag.", inner, "Anfragen", js=("anfrage.js",))


def kuendigen():
    vertr = ["Abo: Kombi Basic (1x/Monat)", "Abo: Kombi Care (2x/Monat)", "Abo: Kombi Protect (2x/Monat)", "Abo: Weekly Basic (1x/Woche)", "Abo: Weekly Care (1x/Woche)", "Abo: Außenwäsche Basic",
             "Abo: Außenwäsche Protect", "Abo: Innenraum Basic", "Abo: Innenraum Pflege Plus", "Firmenkunden-Vertrag / Fuhrpark", "Anderer Vertrag"]
    o = "".join(f'<option value="{E(v)}">{E(v)}</option>' for v in vertr)
    inner = f'''<section class="sec soft"><div class="wrap" style="max-width:860px">
<form class="form" method="post" action="/kuendigen/" id="kform"><input type="hidden" name="cck_action" value="kuendigen">
<fieldset class="fs"><legend>Art der Kündigung *</legend><label class="opt"><input type="radio" name="cck_art" value="ordentlich" checked><span>Ordentliche Kündigung</span></label>
<label class="opt"><input type="radio" name="cck_art" value="ausserordentlich"><span>Außerordentliche Kündigung (aus wichtigem Grund)</span></label>
<div class="field" style="margin-top:10px"><label for="cck_grund">Kündigungsgrund (Pflicht bei außerordentlicher Kündigung)</label><textarea id="cck_grund" name="cck_grund" rows="3"></textarea></div></fieldset>
<fieldset class="fs"><legend>Ihre Angaben</legend><div class="fgrid">
<div class="field"><label for="cck_name">Vor- und Nachname bzw. Firma *</label><input id="cck_name" name="cck_name" required autocomplete="name"></div>
<div class="field"><label for="cck_email">E-Mail für die Bestätigung *</label><input id="cck_email" name="cck_email" type="email" required autocomplete="email"></div>
<div class="field"><label for="cck_anschrift">Anschrift (optional)</label><input id="cck_anschrift" name="cck_anschrift" autocomplete="street-address"></div>
<div class="field"><label for="cck_vertrag">Welcher Vertrag? *</label><select id="cck_vertrag" name="cck_vertrag" required><option value="">Bitte wählen</option>{o}</select></div>
<div class="field"><label for="cck_vertragsnr">Vertrags- oder Kundennummer (falls zur Hand)</label><input id="cck_vertragsnr" name="cck_vertragsnr"></div></div></fieldset>
<fieldset class="fs"><legend>Zu wann soll der Vertrag enden? *</legend><label class="opt"><input type="radio" name="cck_zeitpunkt" value="naechstmoeglich" checked><span>Zum nächstmöglichen Zeitpunkt</span></label>
<label class="opt"><input type="radio" name="cck_zeitpunkt" value="datum"><span>Zu einem bestimmten Datum</span></label>
<div class="field" style="margin-top:10px"><label for="cck_datum">Gewünschtes Vertragsende</label><input id="cck_datum" name="cck_datum" type="date"></div></fieldset>
<div class="hp" aria-hidden="true"><label for="cck_web">Website</label><input id="cck_web" name="cck_web" tabindex="-1" autocomplete="off"></div>
<button class="btn btn-acc" type="submit">Jetzt kündigen</button><div id="kstatus" class="status" role="status" tabindex="-1"></div></form>
<p class="fine" style="margin-top:18px">Alternativ per E-Mail an <a class="tlink" href="mailto:{B["email"]}?subject=K%C3%BCndigung">{B["email"]}</a>.</p></div></section>
<script>
/* Vorschau-Schutz: außerhalb von carcura.info wird nichts gesendet. Auf carcura.info verarbeitet das bestehende Kündigungs-Plugin das Formular. */
var kf=document.getElementById("kform");function kreq(){{var a=kf.querySelector("input[name=cck_art]:checked").value,z=kf.querySelector("input[name=cck_zeitpunkt]:checked").value;kf.cck_grund.required=a==="ausserordentlich";kf.cck_datum.required=z==="datum";}}kf.addEventListener("change",kreq);kreq();var td=new Date();kf.cck_datum.min=new Date(td.getTime()-td.getTimezoneOffset()*6e4).toISOString().slice(0,10);
kf.addEventListener("submit",function(e){{if(location.hostname!=="carcura.info"){{e.preventDefault();var s=document.getElementById("kstatus");s.className="status err";s.textContent="Lokale Vorschau: Die Kündigung wird hier nicht gesendet. Auf carcura.info übernimmt das bestehende Kündigungs-Formular den Versand.";s.focus();}}}});
</script>'''
    simple("/kuendigen/", "Vertrag kündigen | Carcura", "Hier können Sie Ihren Vertrag oder Ihr Pflege-Abo mit der Carcura GbR online kündigen und erhalten eine Bestätigung per E-Mail.", "Vertrag kündigen.",
           "Hier können Sie Ihren Vertrag mit der Carcura GbR kündigen. Sie erhalten eine Eingangsbestätigung per E-Mail. Felder mit * sind Pflichtfelder.", inner, "Kündigung", robots="noindex,follow")


def legal(slug, title, h1, desc, robots="index,follow"):
    txt = open(os.path.join(HERE, "legal", slug + ".html"), encoding="utf8").read()
    txt = txt.replace("<p>Rechtliches</p>", "")
    simple(f"/{slug}/", title, desc, h1, "", f'<section class="sec"><div class="wrap prose">{txt}</div></section>', "Rechtliches", robots=robots)


def notfound():
    body = f'''<section class="phead studio"><div class="wrap"><p class="label">Fehler 404</p><h1>Seite nicht gefunden.</h1><p class="lead">Die Adresse gibt es nicht (mehr). Hier geht es weiter:</p>
<div class="btns">{btn("/", "Zur Startseite", "acc", "arrow")}{btn("/leistungen/", "Leistungen & Preise", "ghost")}{btn("/anfragen/", "Anfragen", "ghost")}</div></div></section>'''
    page("/404/", "Seite nicht gefunden | Carcura", "Diese Seite gibt es nicht. Zur Startseite, zu Leistungen und Preisen oder direkt zur Anfrage bei Carcura.", body, robots="noindex,follow", canonical=False)
    os.replace(os.path.join(DIST, "404", "index.html"), os.path.join(DIST, "404.html"))
    os.rmdir(os.path.join(DIST, "404"))
    PAGES.pop()


REDIRECTS = [("/preise/", "/leistungen/#preise"), ("/team/", "/ueber-uns/#team"), ("/firmenkunde-werden/", "/firmenkunde/"), ("/https-carcura-info-leistungen/", "/leistungen/")]


def sitemap():
    urls = [p for p, t, r in PAGES if r.startswith("index")]
    x = "".join(f"<url><loc>{SITE}{u}</loc><lastmod>{TODAY.isoformat()}</lastmod></url>" for u in urls)
    open(os.path.join(DIST, "sitemap.xml"), "w").write(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{x}</urlset>\n')
    open(os.path.join(DIST, "robots.txt"), "w").write(f"User-agent: *\nDisallow:\n\nSitemap: {SITE}/sitemap.xml\n")
    json.dump([{"path": p, "title": t, "robots": r} for p, t, r in PAGES], open(os.path.join(DIST, "pages.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    home()
    leistungen()
    build_services()
    for slug, o in ORTE.items():
        ort_page(slug, o)
    westerwald()
    holservice(); firmenkunde(); partner(); ueber_uns(); galerie(); gutschein(); anfragen(); kuendigen()
    legal("impressum", "Impressum | Carcura GbR Walterschen", "Impressum.", "Impressum der Carcura GbR, Hauptstr. 7, 57632 Walterschen: Gesellschafter, Kontakt per Telefon und E-Mail, Verantwortliche.")
    legal("datenschutz", "Datenschutzerklärung | Carcura", "Datenschutz&shy;erklärung.", "Datenschutzerklärung der Carcura GbR: welche Daten wir bei Anfragen, WhatsApp und auf der Website verarbeiten und welche Rechte du hast.")
    legal("cookie-richtlinie-eu", "Cookie-Richtlinie (EU) | Carcura", "Cookie-Richtlinie (EU).", "Cookie-Richtlinie der Carcura GbR: welche Cookies carcura.info verwendet, wofür und wie du deine Einwilligung verwaltest.")
    legal("abo-bedingungen", "Abo-Bedingungen | Carcura Fahrzeugaufbereitung Walterschen", "Abo-Bedingungen.", "Bedingungen für Pflege-Abos der Carcura GbR: Vertragsschluss, Mindestlaufzeit, Kündigung, Termine und Zahlung.", robots="noindex,follow")
    legal("widerruf", "Widerrufsbelehrung | Carcura GbR", "Widerrufs&shy;belehrung.", "Widerrufsbelehrung der Carcura GbR für Verträge, die ausschließlich über Fernkommunikationsmittel geschlossen werden.", robots="noindex,follow")
    for a, b in REDIRECTS:
        redirect(a, b)
    notfound()
    sitemap()
    print(len(PAGES), "Seiten erzeugt; Aktion aktiv:", PROMO_ON)
