# v2-Änderungen an den alten Live-Seiten (Testvorschau + Vorlage für den Go-live)
# Jede Regel: (alt, neu, erwartete Anzahl). Gilt auf dem gerenderten HTML.
import re, sys

WA = ('https://wa.me/491706669516?text=Hallo%20Carcura%2C%20ich%20h%C3%A4tte%20gern%20einen%20Preis.'
      '%0AAuto%3A%20%0AWas%20soll%20gemacht%20werden%3A%20%0AOrt%3A%20')

def sv_item(title, sub, lis, note, href, loc, price, addon=None):
    lis_html = ''.join(f'<li>{l}</li>' for l in lis)
    note_html = f'<p class="cc-sv__det-note">{note}</p>' if note else ''
    add = f'<small class="cc-sv__total cc-sv__total--addon">{addon}</small>' if addon else ''
    return (f'<div class="cc-sv__item"><div><b>{title}</b><span>{sub}</span><details class="cc-sv__det"><summary>Was ist enthalten?</summary>'
            f'<ul>{lis_html}</ul>{note_html}</details></div><div class="cc-sv__pricecol"><a class="cc-sv__pill" href="{href}" '
            f'data-cc-track="anfrage" data-cc-location="{loc}">{price}</a>{add}</div></div>')

def rq_item(key, value, title, sub, price_html, lis, note, ab='<i>ab</i> '):
    lis_html = ''.join(f'\n                  <li>{l}</li>' for l in lis)
    return f'''<div class="cc-rq__item" data-item="{key}">
              <label class="cc-rq__opt"><input type="checkbox" name="leistung" value="{value}" data-price="{re.sub(r'[^0-9]','',price_html) or '0'}" data-key="{key}">
                <span class="cc-rq__row">
                  <span class="cc-rq__mark" aria-hidden="true"></span>
                  <span class="cc-rq__row-main"><b>{title}</b><small>{sub}</small></span>
                  <span class="cc-rq__row-price"><span class="cc-rq__price">{ab}{price_html}</span></span>
                </span>
              </label>
              <details class="cc-rq__det">
                <summary>Was ist enthalten?</summary>
                <ul>{lis_html}
                </ul>
                <p class="cc-rq__det-note">{note}</p>
              </details>
            </div>
            '''

def lp_row(title, sub, price, href, label='Anfragen'):
    return (f'<div class="cc-lp__row">\n<div><b>{title}</b><small>{sub}</small></div>\n'
            f'<div class="cc-lp__row-p"><i>ab</i>{price}&nbsp;€</div>\n<a href="{href}" data-cc-track="anfrage" data-cc-location="preis-v2">{label}</a>\n</div>\n')

FAMILIE_LIS = ['Alles aus Basic Innen &amp; Außen', 'Tierhaare aus Teppich, Sitzen und Kofferraum', 'Ideal für Familienautos mit Hund, Kindern und Krümeln']

# ---------------------------------------------------------------- Leistungen
BAND_NEW = '''<div class="cc-band__grid cc-band__grid--6">
        <a class="cc-band__item" href="#cc-sv-innen" data-cc-track="preisband" data-cc-location="innen"><b><em>ab 90 €</em></b><span>Auto-Innenreinigung</span><i aria-hidden="true">→</i></a>
        <a class="cc-band__item" href="#cc-sv-pakete" data-cc-track="preisband" data-cc-location="basic"><b><em>ab 145 €</em></b><span>Innen &amp; Außen</span><i aria-hidden="true">→</i></a>
        <a class="cc-band__item" href="#cc-sv-pakete" data-cc-track="preisband" data-cc-location="familie"><b><em>ab 169 €</em></b><span>Familienpaket mit Tierhaaren</span><i aria-hidden="true">→</i></a>
        <a class="cc-band__item" href="#cc-sv-pakete" data-cc-track="preisband" data-cc-location="leasing"><b><em>ab 229 €</em></b><span>Leasingrückgabe &amp; Verkauf</span><i aria-hidden="true">→</i></a>
        <a class="cc-band__item" href="#cc-sv-politur" data-cc-track="preisband" data-cc-location="politur"><b><em>ab 349 €</em></b><span>Autopolitur</span><i aria-hidden="true">→</i></a>
        <a class="cc-band__item" href="#cc-sv-schutz" data-cc-track="preisband" data-cc-location="keramik"><b><em>ab 700 €</em></b><span>Keramik inkl. Politur</span><i aria-hidden="true">→</i></a>
      </div>
      <style>.cc-band .cc-band__grid--6{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:680px){.cc-band .cc-band__grid--6{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>'''

LEISTUNGEN = [
 (re.compile(r'<div class="cc-band__grid">.*?</div>(?=\s*</nav>)', re.S), BAND_NEW, 1),
 ('''        Zusatzleistungen sind in Kombination günstiger. In unserer Halle in''',
  '''        Zusatzleistungen sind in Kombination günstiger. Termin meist in 1–2 Wochen, auch abends und samstags. In unserer Halle in''', 1),
 ('<span>Bestzustand für Leasingrückgabe, Inzahlungnahme oder Verkauf.</span>', '<span>Bestzustand für Leasingrückgabe, Inzahlungnahme oder Verkauf. Eilig? Schick Fotos per WhatsApp – wir sagen dir meist am selben Tag, ob es klappt.</span>', 1),
 ('<h2>Die beliebtesten Leistungen <span>unserer Kunden.</span></h2>', '<h2>Unsere Empfehlung <span>für den Einstieg.</span></h2>', 1),
 ('Darunter findest du alle Abo-Modelle und Einzelpreise im Detail.', 'Darunter findest du alle Einzelpreise und Abo-Modelle im Detail.', 1),
 (re.compile(r'<article class="cc-sv__card cc-sv__card--top">.*?</article>', re.S),
  '''<article class="cc-sv__card cc-sv__card--top">
          <span class="cc-sv__badge">Für Familien</span>
          <p class="cc-sv__type">Einmalig</p>
          <h3>Familienpaket</h3>
          <p>Innen &amp; Außen plus Tierhaare – für Familienautos mit Hund, Kindern und Krümeln. Günstiger als einzeln (174 €).</p>
          <div class="cc-sv__val">
            <b>ab 169 €</b>
            <a class="cc-sv__btn" href="/anfragen/?leistung=Familienpaket" data-cc-track="anfrage" data-cc-location="familienpaket">Familienpaket anfragen</a>
          </div>
        </article>''', 1),
 # Pakete: Familienpaket nach Basic, Wohnmobil 800 + Basic 245
 ('im Paket sparst du 14 €.</p></details></div><div class="cc-sv__pricecol"><a class="cc-sv__pill" href="/anfragen/?leistung=Basic%20Innen%20%26%20Au%C3%9Fen" data-cc-track="anfrage" data-cc-location="pill-basic">ab 145 €</a></div></div>',
  'im Paket sparst du 14 €.</p></details></div><div class="cc-sv__pricecol"><a class="cc-sv__pill" href="/anfragen/?leistung=Basic%20Innen%20%26%20Au%C3%9Fen" data-cc-track="anfrage" data-cc-location="pill-basic">ab 145 €</a></div></div>\n        '
  + sv_item('Familienpaket', 'Innen &amp; Außen plus Tierhaare in einem Termin.', FAMILIE_LIS, 'Einzeln gebucht kosten Basic und Tierhaare 174 € – im Paket sparst du 5 €.', '/anfragen/?leistung=Familienpaket', 'pill-familie', 'ab 169 €'), 1),
 ('Der Endpreis hängt von Länge und Zustand ab – wir bestätigen ihn vor dem Termin. <a href="/wohnmobil-aufbereitung/">Mehr zur Wohnmobil-Aufbereitung</a></p></details></div><div class="cc-sv__pricecol"><a class="cc-sv__pill" href="/anfragen/?leistung=Wohnmobil-Komplettreinigung" data-cc-track="anfrage" data-cc-location="pill-womo">ab 700 €</a></div></div>',
  'Passt bis 4 m Höhe und 7 m Länge in unsere Halle. Der Endpreis hängt von Länge und Zustand ab – wir bestätigen ihn vor dem Termin. <a href="/wohnmobil-aufbereitung/">Mehr zur Wohnmobil-Aufbereitung</a></p></details></div><div class="cc-sv__pricecol"><a class="cc-sv__pill" href="/anfragen/?leistung=Wohnmobil-Komplettreinigung" data-cc-track="anfrage" data-cc-location="pill-womo">ab 800 €</a></div></div>\n        '
  + sv_item('Wohnmobil Basic Innen &amp; Außen', 'Innen gesaugt und gewischt, außen von Hand gewaschen.', ['Innen: Polster und Böden gesaugt, Oberflächen feucht gewischt', 'Fahrerhaus wie bei einer Pkw-Innenreinigung', 'Außen: Handwäsche, Fenster, Felgen und Reifen'], 'Ohne Schränke, Küche und Bad im Detail – dafür gibt es die Komplettreinigung.', '/anfragen/?leistung=Wohnmobil%20Basic', 'pill-womo-basic', 'ab 245 €'), 1),
 # Innen: Einzelner Sitz + Fleck & Geruch vor Polster
 ('        <div class="cc-sv__item"><div><b>Polster- &amp; Sitzreinigung (Tiefenreinigung)</b>',
  '        ' + sv_item('Einzelner Sitz / Fleck', 'Ein Sitz oder eine Fleckenstelle, mit Sprühextraktion.', ['Fleck vorbehandelt', 'Sitz im Sprühextraktionsverfahren gereinigt', 'Trocknet vollständig, bevor du das Auto zurückbekommst'], 'Notfall wie Erbrochenes: ab 179 € mit Desinfektion und Ozon. <a href="/autositz-reinigen-flecken/">Flecken im Autositz</a>', '/anfragen/?leistung=Einzelner%20Sitz', 'pill-sitz', 'ab 49 €')
  + '\n        ' + sv_item('Fleck + Geruch', 'Alle Polster tiefengereinigt plus Ozon gegen Gerüche.', ['Polster- und Sitzreinigung komplett', 'Ozonbehandlung im geschlossenen Fahrzeug', 'Gegen Geruch aus den Sitzen, z. B. nach Milch, Kakao oder Hund'], 'Einzeln gebucht 79 € + 59 € – im Paket ab 119 €.', '/anfragen/?leistung=Fleck%20%2B%20Geruch', 'pill-fleckgeruch', 'ab 119 €')
  + '\n        <div class="cc-sv__item"><div><b>Polster- &amp; Sitzreinigung (Tiefenreinigung)</b>', 1),
 ('<span>Zum Beispiel ein einzelner Sitz, der Kofferraum oder Motorrad.</span>', '<span>Zum Beispiel nur der Kofferraum, ein Motorrad oder ein Wohnwagen.</span>', 1),
 ('<li>Einzelne Sitze, Kofferraum oder Fleckenstellen</li>', '<li>Nur der Kofferraum oder einzelne Bereiche</li>', 1),
 # Van-Regel
 ('Alle Preise sind Ab-Preise für PKW und Kombi bei normaler Verschmutzung.', 'Alle Preise sind Ab-Preise für PKW, Kombi und Van bei normaler Verschmutzung; Politur und Keramik für SUV und Van nach Fotos.', 1),
 (re.compile(r'Preise gelten für PKW und Kombi bei normaler Verschmutzung – Fahrzeuggröße,'), 'Preise gelten für PKW, Kombi und Van bei normaler Verschmutzung – Fahrzeuggröße,', 1),
 ('Sie gelten für PKW und Kombi bei normaler Verschmutzung; Fahrzeuggröße', 'Sie gelten für PKW und Kombi, bei der Reinigung auch für Vans, bei normaler Verschmutzung; Fahrzeuggröße', 2),
 # Keramik-FAQ (HTML + JSON-LD)
 ('Wir arbeiten mit Nanolex und nennen dir vor der Beauftragung die Standzeit, die der Hersteller für das gewählte Produkt angibt.',
  'Wir versiegeln mit XPERTCOAT HYBRID – laut Hersteller bis zu 5 Jahre oder 70.000 km, je nach Pflege. Nach 6 Monaten prüfen wir die Versiegelung kostenlos nach.', 2),
 # Wohnmobil-FAQ (HTML mit &nbsp;, JSON mit Leerzeichen)
 ('Die Wohnmobil-Komplettreinigung ab 700&nbsp;€ umfasst', 'Die Wohnmobil-Komplettreinigung ab 800&nbsp;€ umfasst', 1),
 ('Die Wohnmobil-Komplettreinigung ab 700 € umfasst', 'Die Wohnmobil-Komplettreinigung ab 800 € umfasst', 1),
 ('Der Endpreis hängt von Länge und Zustand ab.</p>', 'Wohnmobile bis 4 m Höhe und 7 m Länge passen in unsere Halle. Nur innen und außen Basic: ab 245 €. Der Endpreis hängt von Länge und Zustand ab.</p>', 1),
 ('<footer>Kunde mit BMW M2 G87 · Keramikversiegelung</footer>', '<footer>Marlon L. · BMW M2 G87 · Keramikversiegelung</footer>', 1),
 ('Kombi Care<span class="cc-sv__tag">Bestseller</span>', 'Kombi Care<span class="cc-sv__tag">Empfehlung</span>', 1),
]

# Keramik-Zusätze in Leistungen: nach der Scheiben-Keramik-Zeile
def leistungen_extra(h):
    key = '<b>Scheiben-Keramikversiegelung</b>'
    i = h.index(key); j = h.index('\n', i)
    add = ('\n        ' + sv_item('Handwäsche + Sprühversiegelung', 'XPERTCOAT GRAPHENE SPRAY – schneller Schutz mit starkem Abperleffekt, ohne Politur.', ['Schonende Handwäsche mit Felgen', 'Sprühversiegelung auf Lack, Kunststoff und Scheiben', 'Der günstige Einstieg in den Lackschutz'], '', '/anfragen/?leistung=Handw%C3%A4sche%20%2B%20Spr%C3%BChversiegelung', 'pill-spray', 'ab 119 €')
           + '\n        ' + sv_item('Keramik-Pflege', 'Alle 2 Monate: Handwäsche mit Reactivating Shampoo plus Auffrischung.', ['Handwäsche mit Nanolex Reactivating Shampoo', 'Auffrischung mit XPERTCOAT GRAPHENE SPRAY', 'Für Autos mit unserer Keramikversiegelung'], '', '/anfragen/?leistung=Keramik-Pflege', 'pill-kpflege', '79 €'))
    return h[:j] + add + h[j:]

# ---------------------------------------------------------- Schnellanfrage (wiederverwendbarer Block)
SCHNELL = [
 ('<option>Innenreinigung</option>\n        <option>Basic Innen und Außen</option>',
  '<option>Innenreinigung</option>\n        <option>Familienpaket (innen + außen + Tierhaare)</option>\n        <option>Basic Innen und Außen</option>\n        <option>Fleck / Polster</option>\n        <option>Tierhaare</option>\n        <option>Geruch / Ozon</option>\n        <option>Notfall (z. B. Erbrochenes)</option>', 1),
 ('<option>Leasingrückgabe</option>', '<option>Leasingrückgabe</option>\n        <option>Wohnmobil</option>', 1),
 ('["politur", "Politur"]];', '["politur", "Politur"], ["flecken", "Fleck / Polster"], ["tierhaare", "Tierhaare"], ["geruch", "Geruch / Ozon"], ["wohnmobil", "Wohnmobil"]];', 1),
]

# ------------------------------------------------------- Auto-Innenreinigung
INNEN = [
 ('<p class="cc-lp__lead">Vom gründlichen Aussaugen bis zur Tiefenreinigung der Polster: Wir reinigen deinen Innenraum von Hand – inklusive Cockpit, Scheiben und Einstiegen. Tierhaare, Gerüche oder Flecken? Die Zusatzleistungen werden günstiger, sobald du eine Innenreinigung wählst.</p>',
  '<p class="cc-lp__lead">Von Hand in unserer Halle: Saugen, Cockpit, Scheiben, Fußmatten und Kofferraum – meist in 1–2 Stunden. Tierhaare, Gerüche oder Flecken? Die Zusätze werden günstiger, sobald du eine Innenreinigung wählst. Kleines Budget? Schreib uns, was dir wichtig ist – wir sagen ehrlich, was reicht.</p>', 1),
 ('<span>Normal ab 90&nbsp;€ · Detailliert ab 150&nbsp;€</span>', '<span>Innen + außen ab 145&nbsp;€ · Familienpaket mit Tierhaaren ab 169&nbsp;€</span>', 1),
 ('<li>Zusätze günstiger</li></ul>', '<li>Van zum PKW-Preis</li></ul>', 1),
 ('<a class="cc-lp__btn cc-lp__btn--ghost" href="https://wa.me/491706669516" target="_blank" rel="noopener" data-cc-track="whatsapp" data-cc-location="hero">Fotos per WhatsApp schicken</a>',
  f'<a class="cc-lp__btn cc-lp__btn--ghost" href="{WA}" target="_blank" rel="noopener" data-cc-track="whatsapp" data-cc-location="hero" data-wa-service="Auto-Innenreinigung">Per WhatsApp fragen</a>', 1),
 ('<p class="cc-lp__kicker">Preise</p>\n<h2 id="cc-lp-prices">', '<p class="cc-lp__kicker" id="pakete"><span id="familienpaket"></span>Preise</p>\n<h2 id="cc-lp-prices">', 1),
 ('<p class="cc-rv">Ab-Preise für PKW und Kombi bei normaler Verschmutzung.', '<p class="cc-rv">Ab-Preise für PKW, Kombi und Van wie Touran oder Sharan bei normaler Verschmutzung.', 1),
 ('<a href="/anfragen/?leistung=Innenraumreinigung%20Normal" data-cc-track="anfrage" data-cc-location="preis-auto-innenreinigung">Anfragen</a>\n</div>\n',
  '<a href="/anfragen/?leistung=Innenraumreinigung%20Normal" data-cc-track="anfrage" data-cc-location="preis-auto-innenreinigung">Anfragen</a>\n</div>\n'
  + lp_row('Innen &amp; Außen', 'Innenreinigung plus schonende Handwäsche mit Felgen.', '145', '/anfragen/?leistung=Basic%20Innen%20%26%20Au%C3%9Fen')
  + lp_row('Familienpaket · empfohlen', 'Innen &amp; Außen plus Tierhaare – für Hund, Kinder, Krümel. Günstiger als einzeln (174&nbsp;€).', '169', '/anfragen/?leistung=Familienpaket')
  + lp_row('Einzelner Sitz / Fleck', 'Nur ein Sitz oder eine Stelle? Sprühextraktion.', '49', '/autositz-reinigen-flecken/', 'Details'), 1),
 ('jeweils für PKW und Kombi bei normaler Verschmutzung', 'jeweils für PKW, Kombi und Van bei normaler Verschmutzung', 2),
]

# ----------------------------------------------------------- Geruch entfernen
GERUCH = [
 ('Hundehaare holen wir mit Spezialbürsten und Druckluft aus jeder Naht.', 'Beispiel Golf mit Rauchgeruch: Innenreinigung 90&nbsp;€ + Ozon 39&nbsp;€ = ab 129&nbsp;€.', 1),
 ('<li>Tierhaare mit Spezialbürsten</li>', '<li>Fester Preis vor dem Termin</li>', 1),
 ('Ab-Preise für PKW und Kombi bei normaler Verschmutzung.', 'Ab-Preise für PKW, Kombi und Van bei normaler Verschmutzung.', 1),
 ('Kunde · Innenreinigung mit Hol- und Bringservice', 'Tobias · Hol- &amp; Bringservice', 1),
]

def geruch_extra(h):
    # Kicker und Preisblock
    h, n1 = re.subn(r'(<p class="cc-lp__kicker">)Geruch (?:&amp;|&#038;|&) Tierhaare( · Walterschen</p>)', r'\1Geruch entfernen\2', h, count=1)
    h, n2 = re.subn(r'(<p class="cc-lp__price"><b><i>ab</i>59&nbsp;€</b><span>)[^<]*(</span>)', r'\1Ozon einzeln · mit Innenreinigung ab 129&nbsp;€ gesamt\2', h, count=1)
    # neue Zeilen oben in die Preisliste
    m = re.search(r'<div class="cc-lp__prices[^"]*">\n', h)
    rows = (lp_row('Innenreinigung + Ozon', 'Die Ursache raus, dann Ozon – der Weg gegen Rauch im Gebrauchtwagen.', '129', '/anfragen/?leistung=Innenraumreinigung%20Normal&amp;leistung=Ozonbehandlung')
            + lp_row('Fleck + Geruch', 'Alle Polster tiefengereinigt plus Ozon, z.&nbsp;B. nach Milch oder Kakao.', '119', '/autositz-reinigen-flecken/', 'Details'))
    n3 = 1 if m else 0
    if m: h = h[:m.end()] + rows + h[m.end():]
    # Passt dazu: Leasing -> Flecken, Scheinwerfer -> Tierhaare
    h, n4 = re.subn(r'<a([^>]*)href="/leasingrueckgabe-aufbereitung/"([^>]*)>(.*?)</a>',
                    r'<a\1href="/autositz-reinigen-flecken/"\2><b>Flecken im Sitz</b><span>Einzelner Sitz</span><em>ab 49&nbsp;€</em></a>', h, count=1, flags=re.S)
    h, n5 = re.subn(r'<a([^>]*)href="/scheinwerfer-aufbereiten/"([^>]*)>(.*?)</a>',
                    r'<a\1href="/tierhaare-auto-entfernen/"\2><b>Tierhaare entfernen</b><span>Hund, Katze, Kofferraum</span><em>ab 69&nbsp;€</em></a>', h, count=1, flags=re.S)
    return h, (n1, n2, n3, n4, n5)

# ------------------------------------------------------------------ Anfragen
ANFRAGEN = [
 ('value="Wohnmobil-Komplettreinigung" data-price="700"', 'value="Wohnmobil-Komplettreinigung" data-price="800"', 1),
 ('<span class="cc-rq__row-main"><b>Wohnmobil-Komplettreinigung</b><small>Innen und außen komplett – bis zur letzten Schublade.</small></span>\n                  <span class="cc-rq__row-price"><span class="cc-rq__price"><i>ab</i> 700 €</span></span>',
  '<span class="cc-rq__row-main"><b>Wohnmobil-Komplettreinigung</b><small>Innen und außen komplett – bis zur letzten Schublade. Bis 4 m hoch, 7 m lang.</small></span>\n                  <span class="cc-rq__row-price"><span class="cc-rq__price"><i>ab</i> 800 €</span></span>', 1),
 ('<li>Antwort meist am selben Tag</li>', '<li>Fester Preis vorab</li>', 1),
 ('<small>Zum Beispiel ein einzelner Sitz, der Kofferraum oder Motorrad.</small>', '<small>Zum Beispiel nur der Kofferraum, ein Motorrad oder ein Wohnwagen.</small>', 1),
 ('<li>Einzelne Sitze, Kofferraum oder Fleckenstellen</li>', '<li>Nur der Kofferraum oder einzelne Bereiche</li>', 1),
 ('Kunde mit BMW M2 G87 · Keramikversiegelung · Google', 'Marlon L. · BMW M2 G87 · Keramikversiegelung · Google', 1),
 ('        ehrlicher Einschätzung, Preis und Termin.\n      </p>', '        ehrlicher Einschätzung, Preis und Termin. Keine Lust auf Auswahl?\n        Schreib uns per WhatsApp oder ruf an: 0170 6669516.\n      </p>', 1),
 ('<div class="cc-rq__step">\n        <div class="cc-rq__step-head">\n          <span class="cc-rq__step-num">3</span>', '<div class="cc-rq__step" id="cc-rq-kontakt">\n        <div class="cc-rq__step-head">\n          <span class="cc-rq__step-num">3</span>', 1),
]

def anfragen_extra(h):
    res = {}
    # Familienpaket nach Basic, Wohnmobil Basic nach Komplett
    i = h.index('<div class="cc-rq__item" data-item="leasing">')
    h = h[:i] + rq_item('famil', 'Familienpaket', 'Familienpaket', 'Innen &amp; Außen plus Tierhaare – günstiger als einzeln (174 €).', '169 €', FAMILIE_LIS, 'Ideal für Familienautos mit Hund oder Kindern.') + h[i:]
    k = h.index('<div class="cc-rq__item" data-item="womo">')
    e = h.index('\n            </div>\n          </section>', k) + 1
    h = h[:e] + '            ' + rq_item('womob', 'Wohnmobil Basic', 'Wohnmobil Basic Innen &amp; Außen', 'Innen gesaugt und gewischt, außen von Hand gewaschen.', '245 €', ['Polster und Böden gesaugt, Oberflächen gewischt', 'Fahrerhaus wie bei einer Pkw-Innenreinigung', 'Außen Handwäsche, Fenster, Felgen'], 'Ohne Schränke, Küche und Bad im Detail.') + h[e:]
    # Innen: Einzelner Sitz, Fleck + Geruch, Notfall vor Polster
    i = h.index('<div class="cc-rq__item" data-item="polster">')
    h = h[:i] + rq_item('sitz', 'Einzelner Sitz', 'Einzelner Sitz / Fleck', 'Ein Sitz oder eine Fleckenstelle, Sprühextraktion.', '49 €', ['Fleck vorbehandelt', 'Sitz tief gereinigt, trocknet vollständig'], 'Foto vom Fleck hilft für den festen Preis.') \
          + rq_item('fleckgeruch', 'Fleck + Geruch', 'Fleck + Geruch', 'Alle Polster tiefengereinigt plus Ozon.', '119 €', ['Polster- und Sitzreinigung komplett', 'Ozonbehandlung gegen den Geruch'], 'Günstiger als einzeln (79 € + 59 €).') \
          + rq_item('notfall', 'Notfall: Erbrochenes', 'Notfall: Erbrochenes', 'Betroffene Sitze, Kindersitz und Gurt, Desinfektion, Ozon.', '179 €', ['Betroffene Sitze und Teppiche', 'Kindersitz und Gurt', 'Desinfektion und Ozon'], 'Ruf am besten direkt an: 0170 6669516.') + h[i:]
    # Keramik: Spray + Pflege nach Scheiben
    i = h.index('<div class="cc-rq__item" data-item="scheiben">')
    nxt = h.find('<div class="cc-rq__item"', i + 10)
    end = h.index('\n            </div>\n          </section>', i) + 1
    j = nxt if (nxt != -1 and nxt < end) else end
    h = h[:j] + rq_item('spray', 'Handwäsche + Sprühversiegelung', 'Handwäsche + Sprühversiegelung', 'XPERTCOAT GRAPHENE SPRAY – schneller Schutz ohne Politur.', '119 €', ['Schonende Handwäsche mit Felgen', 'Sprühversiegelung auf Lack, Kunststoff und Scheiben'], 'Der günstige Einstieg in den Lackschutz.') \
          + rq_item('kpflege', 'Keramik-Pflege', 'Keramik-Pflege (alle 2 Monate)', 'Handwäsche mit Reactivating Shampoo plus Auffrischung.', '79 €', ['Handwäsche mit Nanolex Reactivating Shampoo', 'Auffrischung mit XPERTCOAT GRAPHENE SPRAY'], 'Preis pro Termin, für Autos mit unserer Keramik.', ab='') + h[j:]
    # Zusatz-Basen um Familienpaket erweitern (Ozon, Polster, Leder, Lederversiegelung)
    h, res['base'] = re.subn(r'data-base="inn innd basic ', 'data-base="inn innd basic famil ', h)
    # Antwortzeit vereinheitlichen
    h, res['h1'] = re.subn(r'Antwort noch heute\.', 'Antwort meist am selben Tag.', h)
    return h, res

def apply_rules(h, rules, name):
    for old, new, cnt in rules:
        if isinstance(old, re.Pattern):
            h, n = old.subn(new.replace('\\', '\\\\') if False else (lambda m, new=new: new), h)
        else:
            n = h.count(old); h = h.replace(old, new)
        flag = 'OK ' if n == cnt else '!! '
        print(f'{flag}{name}: {n}/{cnt}  {(old.pattern if isinstance(old, re.Pattern) else old)[:70]!r}')
    return h

# ---------------------------------------------------------------- Wohnmobil
WOHNMOBIL = [
 ('Das Fahrerhaus behandeln wir wie bei einer PKW-Innenreinigung.</p>', 'Das Fahrerhaus behandeln wir wie bei einer PKW-Innenreinigung. Passt bis 4&nbsp;m Höhe und 7&nbsp;m Länge in unsere Halle.</p>', 1),
 ('<p class="cc-lp__price"><b><i>ab</i>700&nbsp;€</b><span>Komplettreinigung innen und außen · Endpreis je nach Länge</span></p>',
  '<p class="cc-lp__price"><b><i>ab</i>800&nbsp;€</b><span>Komplettreinigung innen und außen · nur innen + außen Basic ab 245&nbsp;€</span></p>', 1),
 ('<span class="cc-lp__stage-ring"></span><b>700&nbsp;€</b>', '<span class="cc-lp__stage-ring"></span><b>800&nbsp;€</b>', 1),
 ('<div class="cc-lp__row-p"><i>ab</i>700&nbsp;€</div><a href="/anfragen/?leistung=Wohnmobil-Komplettreinigung" data-cc-track="anfrage" data-cc-location="preis">Anfragen</a></div>\n',
  '<div class="cc-lp__row-p"><i>ab</i>800&nbsp;€</div><a href="/anfragen/?leistung=Wohnmobil-Komplettreinigung" data-cc-track="anfrage" data-cc-location="preis">Anfragen</a></div>\n'
  '<div class="cc-lp__row"><div><b>Wohnmobil Basic Innen &amp; Außen</b><small>Innen gesaugt und gewischt, Fahrerhaus wie beim PKW, außen Handwäsche – ohne Schränke, Küche und Bad im Detail.</small></div><div class="cc-lp__row-p"><i>ab</i>245&nbsp;€</div><a href="/anfragen/?leistung=Wohnmobil%20Basic" data-cc-track="anfrage" data-cc-location="preis">Anfragen</a></div>\n'
  '<div class="cc-lp__row"><div><b>Keramik fürs Wohnmobil</b><small>Versiegelt wird drinnen in der Halle. Fester Preis nach 3 Fotos.</small></div><div class="cc-lp__row-p">nach Fotos</div><a href="/keramikversiegelung/" data-cc-track="intern" data-cc-location="preis">Mehr dazu</a></div>\n', 1),
 ('Die Komplettreinigung innen und außen beginnt bei 700&nbsp;€.', 'Die Komplettreinigung innen und außen beginnt bei 800&nbsp;€, innen und außen Basic bei 245&nbsp;€.', 1),
 ('Die Komplettreinigung innen und außen beginnt bei 700 €.', 'Die Komplettreinigung innen und außen beginnt bei 800 €, innen und außen Basic bei 245 €.', 1),
 ('Wohnmobil-Komplettreinigung im Westerwald ab 700 €:', 'Wohnmobil-Komplettreinigung im Westerwald ab 800 €:', 1),
 ('"price":"700"', '"price":"800"', 1),
 ('"minPrice":"700', '"minPrice":"800', 1),
]

# ---------------------------------------------------------------- Autopolitur
POLITUR = [
 ('<p class="cc-lp__q">„Ich war mit meinem M2 G87 bei Carcura für eine Keramikversiegelung und bin mit dem Ergebnis wirklich super zufrieden! … der Lack sieht einfach klasse aus.“</p>\n<footer><span id="cc-lp-proof">Kunde mit BMW M2 G87 · Politur und Keramik</span></footer>',
  '<p class="cc-lp__q">„… super beeindruckend was die jungs aus meinem alten lack rausgeholt haben und die keramikversieglung ist wirklich ein MUSS.“</p>\n<footer><span id="cc-lp-proof">Audi TT 8n · Politur &amp; Keramik · Nov. 2026</span></footer>', 1),
 ('<details><summary>Soll ich nach der Politur versiegeln?</summary>',
  '<details><summary>Polieren bei altem Originallack oder Youngtimer?</summary><p>Gerne – der Audi TT 8n oben ist so ein Fall. Bei altem Lack schauen wir uns vorher an, wie viel Korrektur sinnvoll ist: Schick Fotos oder komm vorbei, dann sagen wir dir ehrlich, ob 1-stufig reicht oder 2-stufig nötig ist.</p></details>\n<details><summary>Soll ich nach der Politur versiegeln?</summary>', 1),
]

# ---------------------------------------------------------------- v3 (nach Testrunde 2)
WA_BUDGET = ('https://wa.me/491706669516?text=Hallo%20Carcura%2C%20mein%20Budget%3A%20%E2%80%A6%20%E2%82%AC.'
             '%0AAuto%3A%20%0AWichtig%20ist%20mir%3A%20')
INNEN += [
 ('<p class="cc-lp__lead">Von Hand in unserer Halle: Saugen, Cockpit, Scheiben, Fußmatten und Kofferraum – meist in 1–2 Stunden. Tierhaare, Gerüche oder Flecken? Die Zusätze werden günstiger, sobald du eine Innenreinigung wählst. Kleines Budget? Schreib uns, was dir wichtig ist – wir sagen ehrlich, was reicht.</p>',
  '<p class="cc-lp__lead">Von Hand in unserer Halle: Saugen, Cockpit, Scheiben, Fußmatten und Kofferraum – meist in 1–2 Stunden. Zusätze wie Tierhaare oder Geruch werden günstiger, sobald du eine Innenreinigung wählst.</p>', 1),
 ('<span>Innen + außen ab 145&nbsp;€ · Familienpaket mit Tierhaaren ab 169&nbsp;€</span></p>',
  f'<span>Tierhaare +29&nbsp;€ · Innen + außen ab 145&nbsp;€ · Familienpaket ab 169&nbsp;€</span></p>\n<p class="cc-lp__fine" style="margin-top:12px!important">Budget knapp? <a href="{WA_BUDGET}" data-wa-service="Budget-Anfrage" data-wa-where="hero-budget">Schreib uns deinen Betrag</a> – wir sagen ehrlich, was dafür geht. Hundehaare? <a href="/tierhaare-auto-entfernen/">Alles zu Tierhaaren</a></p>', 1),
]
GERUCH += [
 ('<h2 id="cc-lp-prices">Gegen Geruch <span>und Tierhaare.</span></h2>', '<h2 id="cc-lp-prices">Was Geruchsentfernung <span>kostet.</span></h2>', 1),
 ('<p class="cc-rv">Ab-Preise für PKW, Kombi und Van bei normaler Verschmutzung. Den verbindlichen Endpreis',
  '<p class="cc-rv">Rauch im ganzen Auto: Innenreinigung + Ozon ab 129&nbsp;€. Geruch nur aus den Sitzen, z.&nbsp;B. nach Milch oder Kakao: Fleck + Geruch ab 119&nbsp;€. Ab-Preise für PKW, Kombi und Van bei normaler Verschmutzung. Den verbindlichen Endpreis', 1),
 ('Tierhaare mit Spezialbürsten aus Teppich und Polstern lösen, Ritzen mit dem Tornador ausblasen.', 'Bei Hundegeruch die Haare gleich mit raus – mehr unter <a href="/tierhaare-auto-entfernen/">Tierhaare entfernen</a>.', 1),
]
LEISTUNGEN += [
 ('Das hängt vom eingesetzten Produkt, deinem Waschverhalten und der Pflege ab.', 'Das hängt von deinem Waschverhalten und der Pflege ab.', 2),
 ('Handwäsche sowie Felgen und Einstiege grob gereinigt.', 'Handwäsche sowie Felgen und Einstiege gereinigt.', 1),
]
ANFRAGEN += [
 ('Die Wohnmobil-Komplettreinigung ab 700 € umfasst', 'Die Wohnmobil-Komplettreinigung ab 800 € umfasst', 1),
 ('inkl. Wäsche, Kneten und 1‑stufiger Politur', 'inkl. Wäsche, Kneten, 1‑stufiger Politur und Pflegeset (Wert 62 €)', 1),
]

# ---------------------------------------------------------------- v3b (neue Personas)
LEISTUNGEN += [
 ('        Zusatzleistungen sind in Kombination günstiger. Termin meist in 1–2 Wochen, auch abends und samstags. In unserer Halle in',
  '        Zusatzleistungen sind in Kombination günstiger. Termin meist in 1–2 Wochen, auch abends und samstags.\n        Transporter oder Firmenwagen? Fester Preis nach Fotos, mehr unter <a href="/firmenkunde/">Firmenkunden</a>. In unserer Halle in', 1),
]
SCHNELL[0] = (SCHNELL[0][0], SCHNELL[0][1] + '\n        <option>Transporter / Firmenwagen</option>', 1)
INNEN += [
 ('Innen &amp; Außen plus Tierhaare – für Hund, Kinder, Krümel. Günstiger als einzeln (174&nbsp;€).', 'Innen &amp; Außen plus Tierhaare – für Hund, Kinder, Krümel. Günstiger als einzeln (174&nbsp;€). Kein Hund? Dann reicht meist Innen &amp; Außen.', 1),
]
LEASING = [
 ('<li>Flecken und Gerüche raus</li>', '<li>Flecken raus, Geruch mit Ozon +39&nbsp;€</li>', 1),
 ('auf Wunsch mit Fotos für deine Verkaufsanzeige.</p>', 'auf Wunsch mit Fotos für deine Verkaufsanzeige. Eilig? Schick Fotos per WhatsApp – wir sagen dir meist am selben Tag, ob es klappt. Tierhaare als Zusatz +29&nbsp;€.</p>', 1),
 ('<p class="cc-rv">Ab-Preise für PKW und Kombi bei normaler Verschmutzung.', '<p class="cc-rv">Ab-Preise für PKW, Kombi und Van bei normaler Verschmutzung.', 1),
 ('Ab 229&nbsp;€ für PKW und Kombi bei normaler Verschmutzung.', 'Ab 229&nbsp;€ für PKW, Kombi und Van bei normaler Verschmutzung.', 1),
 ('Ab 229 € für PKW und Kombi bei normaler Verschmutzung.', 'Ab 229 € für PKW, Kombi und Van bei normaler Verschmutzung.', 1),
]
HOLBRING = [
 ('Alle Preise sind Ab-Preise für PKW und Kombi bei normaler Verschmutzung;', 'Alle Preise sind Ab-Preise für PKW, Kombi und Van bei normaler Verschmutzung;', 1),
 ('<p>„Ich war mit meinem M2 G87 bei Carcura für eine Keramikversiegelung und bin mit dem Ergebnis wirklich super zufrieden!“</p>\n          <footer>Echte Google-Bewertung · Keramikversiegelung</footer>',
  '<p>„Nach Terminabsprache wurde das Fahrzeug pünktlich geholt und sogar schneller gebracht als abgesprochen. Gerne wieder“</p>\n          <footer>Tobias · Echte Google-Bewertung · Hol- &amp; Bringservice</footer>', 1),
]

# ---------------------------------------------------------------- v4 (Kontrollpersonas Runde 3)
INNEN += [
 ('<span>Tierhaare +29&nbsp;€ · Innen + außen ab 145&nbsp;€ · Familienpaket ab 169&nbsp;€</span></p>',
  '<span>Tierhaare +29&nbsp;€ · Leder &amp; Lenkrad +39&nbsp;€ · Innen + außen ab 145&nbsp;€</span></p>', 1),
 ('<li>Tierhaare und Gerüche</li><li>Van zum PKW-Preis</li></ul>', '<li>Tierhaare und Gerüche</li><li>Leder &amp; Lenkrad</li><li>Van zum PKW-Preis</li></ul>', 1),
]
GERUCH += [
 ('<details><summary>Holt ihr das Auto ab?</summary>',
  '<details><summary>Mein Auto riecht muffig. Hilft Ozon?</summary><p>Oft steckt Feuchtigkeit dahinter. Schreib uns, seit wann es so riecht und ob der Teppich nass ist – wir sagen dir ehrlich, ob Reinigung und Ozon helfen oder ob zuerst eine Werkstatt die Ursache finden muss.</p></details>\n<details><summary>Holt ihr das Auto ab?</summary>', 1),
]
SCHNELL[0] = (SCHNELL[0][0], SCHNELL[0][1] + '\n        <option>Leder reinigen / versiegeln</option>', 1)

# ---------------------------------------------------------------- v5 (Original-Personas Runde 3)
LEISTUNGEN += [
 (re.compile(r'<p class="cc-sv__lead">.*?</p>', re.S),
  '''<p class="cc-sv__lead">
        Jede Leistung mit Inhalt und Ab-Preis, Zusätze in Kombination günstiger. Termin meist in 1–2 Wochen, auch abends
        und samstags. Eilig, z.&nbsp;B. Leasingrückgabe? Schick Fotos per WhatsApp – wir sagen dir meist am selben Tag, ob es klappt.
        Transporter oder Firmenwagen: fester Preis nach Fotos (<a href="/firmenkunde/">Firmenkunden</a>). In unserer Halle in
        Walterschen bei <a href="/fahrzeugaufbereitung-altenkirchen/">Altenkirchen</a> – für Kunden aus dem ganzen <a href="/fahrzeugaufbereitung-westerwald/">Westerwald</a>, auf Wunsch mit <a href="/hol-und-bringservice/">Hol- und Bringservice</a>.
      </p>''', 1),
 ('<p>Langanhaltender Lackschutz mit starkem Abperleffekt – Handwäsche, Kneten und 1-stufige Politur sind im Preis enthalten. Felgen und Scheiben günstig dazubuchbar.</p>',
  '<p>XPERTCOAT HYBRID, laut Hersteller bis 5 Jahre. Handwäsche, Kneten, 1-stufige Politur und Pflegeset inklusive, Nachkontrolle nach 6 Monaten gratis. SUV oder Neuwagen: fester Preis nach Fotos.</p>', 1),
]
