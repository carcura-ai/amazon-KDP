# Baut die SEO-Landingpages im cc-lp-Design der Keramik-Seite.
import json, os, html
D = os.path.dirname(os.path.abspath(__file__))
CSS = open(os.path.join(D, 'lp.css.html')).read()
JS = open(os.path.join(D, 'lp.js.html')).read()
U = 'https://carcura.info/wp-content/uploads/'
WA = 'https://wa.me/491706669516'
AREA = ["Walterschen", "Altenkirchen", "Weyerbusch", "Flammersfeld", "Hamm (Sieg)", "Wissen", "Hachenburg",
        "Asbach", "Puderbach", "Dierdorf", "Neuwied", "Waldbröl", "Windeck", "Eitorf"]

def e(s):
    return html.escape(s, quote=True)

def q(name):
    from urllib.parse import quote
    return '/anfragen/?leistung=' + quote(name, safe='')

def row(name, small, price, extra='', link=None, label='Anfragen'):
    p = f'<i>ab</i>{price}&nbsp;€' if price[0].isdigit() else price
    if extra:
        p += f'<em>{extra}</em>'
    href = link or q(name)
    track = 'intern' if link and not link.startswith('/anfragen') else 'anfrage'
    return (f'<div class="cc-lp__row"><div><b>{e(name)}</b><small>{small}</small></div>'
            f'<div class="cc-lp__row-p">{p}</div>'
            f'<a href="{href}" data-cc-track="{track}" data-cc-location="preis">{label}</a></div>')

def faq_html(faqs):
    return '\n'.join(f'<details><summary>{e(qq)}</summary><p>{a}</p></details>' for qq, a in faqs)

def strip(s):
    import re
    return html.unescape(re.sub('<[^>]+>', '', s)).replace('­', '').replace('&shy;', '')

CSSREF = ''
JSREF = '<!-- wp:block {"ref":1112} /-->'

def page(p):
    hero_media = p['hero_media']
    steps = '\n'.join(f'<li class="cc-rv">{s}</li>' for s in p['steps'])
    rows = '\n'.join(p['rows'])
    more = '\n'.join(f'<a href="{h}" data-cc-track="intern" data-cc-location="weitere"><div><b>{t}</b><br><span>{s}</span></div><em>{m}</em></a>'
                     for h, t, s, m in p['more'])
    facts = ''.join(f'<li>{f}</li>' for f in p['facts'])
    proof = p.get('proof', '')
    extra_sec = p.get('extra', '')
    ld_service = {
        "@context": "https://schema.org", "@type": "Service", "name": p['service'], "serviceType": p['service'],
        "url": f"https://carcura.info/{p['slug']}/", "description": p['desc'],
        "provider": {"@id": "https://carcura.info/#business"},
        "areaServed": [{"@type": "City", "name": a} for a in p.get('area', AREA)] + [{"@type": "AdministrativeArea", "name": "Westerwald"}],
    }
    if p.get('price_num'):
        ld_service["offers"] = {"@type": "Offer", "price": p['price_num'], "priceCurrency": "EUR",
                                "priceSpecification": {"@type": "PriceSpecification", "minPrice": p['price_num'], "priceCurrency": "EUR", "valueAddedTaxIncluded": True},
                                "url": "https://carcura.info" + q(p['service'])}
    ld_faq = {"@context": "https://schema.org", "@type": "FAQPage",
              "mainEntity": [{"@type": "Question", "name": qq, "acceptedAnswer": {"@type": "Answer", "text": strip(a)}} for qq, a in p['faqs']]}
    ld_bc = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Start", "item": "https://carcura.info/"},
        {"@type": "ListItem", "position": 2, "name": "Leistungen", "item": "https://carcura.info/leistungen/"},
        {"@type": "ListItem", "position": 3, "name": p['crumb'], "item": f"https://carcura.info/{p['slug']}/"}]}
    j = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    return '<!-- wp:block {"ref":1111} /-->\n' + f'''<!-- wp:html -->
<!--
CARCURA · {p['crumb'].upper()} · v1.0 (28.10.2026) · SEO-Landingpage im Design der Keramik-Seite.
Preise und Leistungsumfang identisch mit /leistungen/ und /anfragen/.
-->
{CSSREF}<main class="cc-lp" data-page="{p['slug']}">
<section class="cc-lp__hero" aria-labelledby="cc-lp-title">
<div class="cc-lp__shell cc-lp__hero-grid">
<div>
<p class="cc-lp__kicker">{p['kicker']}</p>
<h1 id="cc-lp-title">{p['h1']}</h1>
<p class="cc-lp__lead">{p['lead']}</p>
<p class="cc-lp__price"><b><i>ab</i>{p['price']}&nbsp;€</b><span>{p['price_note']}</span></p>
<ul class="cc-lp__facts" aria-label="Auf einen Blick">{facts}</ul>
<div class="cc-lp__actions">
<a class="cc-lp__btn" href="{q(p['service'])}" data-cc-track="anfrage" data-cc-location="hero">{p['cta']} <span aria-hidden="true">→</span></a>
<a class="cc-lp__btn cc-lp__btn--ghost" href="{WA}" target="_blank" rel="noopener" data-cc-track="whatsapp" data-cc-location="hero">{p.get('wa_label', 'Fotos per WhatsApp schicken')}</a>
</div>
</div>
{hero_media}
</div>
</section>
<section class="cc-lp__sec cc-lp__sec--paper" aria-labelledby="cc-lp-steps">
<div class="cc-lp__shell">
<div class="cc-lp__head">
<div class="cc-rv">
<p class="cc-lp__kicker">{p['steps_kicker']}</p>
<h2 id="cc-lp-steps">{p['steps_h2']}</h2>
</div>
<p class="cc-rv">{p['steps_intro']}</p>
</div>
<ol class="cc-lp__steps">
{steps}
</ol>
<p class="cc-lp__note cc-rv">{p['note']}</p>
</div>
</section>
{extra_sec}
<section class="cc-lp__sec" aria-labelledby="cc-lp-prices">
<div class="cc-lp__shell">
<div class="cc-lp__head">
<div class="cc-rv">
<p class="cc-lp__kicker">Preise</p>
<h2 id="cc-lp-prices">{p['prices_h2']}</h2>
</div>
<p class="cc-rv">Ab-Preise für PKW und Kombi bei normaler Verschmutzung. Den verbindlichen Endpreis bestätigen wir dir vor dem Termin – ohne Überraschungen.</p>
</div>
<div class="cc-lp__prices cc-rv">
{rows}
</div>
<p class="cc-lp__fine">Alle Preise sind Endpreise; als Kleinunternehmer nach § 19 UStG weisen wir keine Umsatzsteuer aus. „Als Zusatz“ gilt zusammen mit der jeweils genannten Grundleistung.</p>
</div>
</section>
{proof}
<section class="cc-lp__sec" aria-labelledby="cc-lp-faq" style="border-top:1px solid rgba(255,255,255,.08)">
<div class="cc-lp__shell cc-lp__faq">
<div class="cc-rv">
<p class="cc-lp__kicker">Häufige Fragen</p>
<h2 id="cc-lp-faq">{p['faq_h2']}</h2>
</div>
<div class="cc-lp__faq-list cc-rv">
{faq_html(p['faqs'])}
</div>
</div>
</section>
<section class="cc-lp__sec cc-lp__sec--paper" aria-labelledby="cc-lp-more">
<div class="cc-lp__shell">
<div class="cc-lp__head">
<div class="cc-rv">
<p class="cc-lp__kicker">Mehr von Carcura</p>
<h2 id="cc-lp-more">Passt gut <span>dazu.</span></h2>
</div>
<p class="cc-rv">Alles aus einer Hand, in unserer Halle in Walterschen – auf Wunsch holen wir dein Fahrzeug ab und bringen es zurück.</p>
</div>
<nav class="cc-lp__more cc-rv" aria-label="Weitere Leistungen">
{more}
</nav>
<p class="cc-lp__towns cc-rv">{p['towns']}</p>
</div>
</section>
<section class="cc-lp__cta" aria-labelledby="cc-lp-cta">
<div class="cc-lp__shell cc-lp__cta-grid">
<div>
<h2 id="cc-lp-cta">{p['cta_h2']}</h2>
<p>{p['cta_p']}</p>
<p class="cc-lp__cta-contact">Carcura GbR · Hauptstr. 7 · 57632 Walterschen · <a href="tel:+491706669516" data-cc-track="anruf" data-cc-location="cta">+49 170 6669516</a></p>
</div>
<div class="cc-lp__actions">
<a class="cc-lp__btn" href="{q(p['service'])}" data-cc-track="anfrage" data-cc-location="cta">{p['cta']} <span aria-hidden="true">→</span></a>
<a class="cc-lp__btn cc-lp__btn--ghost" href="{WA}" target="_blank" rel="noopener" data-cc-track="whatsapp" data-cc-location="cta">Über WhatsApp schreiben</a>
</div>
</div>
</section>
</main>
<script type="application/ld+json">{j(ld_service)}</script>
<script type="application/ld+json">{j(ld_faq)}</script>
<script type="application/ld+json">{j(ld_bc)}</script>
<!-- /wp:html -->
{JSREF}
<!-- wp:block {{"ref":1062}} /-->
<!-- wp:block {{"ref":1099}} /-->'''

def img(src, alt, cap, w=1080, h=1920, pos='50% 50%', eager=True):
    load = 'fetchpriority="high" loading="eager"' if eager else 'loading="lazy"'
    return (f'<figure class="cc-lp__media cc-rv">\n<img {load} src="{U}{src}" width="{w}" height="{h}" alt="{e(alt)}" decoding="async" style="object-position:{pos}">\n'
            f'<figcaption>{cap}</figcaption>\n</figure>')

def stage(big, text, items):
    li = ''.join(f'<li>{i}</li>' for i in items)
    return (f'<div class="cc-lp__stage cc-rv" aria-hidden="true"><span class="cc-lp__stage-ring"></span>'
            f'<b>{big}</b><p>{text}</p><ol>{li}</ol></div>')

def ba(after, before, alt_a, alt_b, w=576, h=1024):
    return (f'<div class="cc-lp__ba" style="--pos:50%">\n<img src="{U}{after}" width="{w}" height="{h}" loading="lazy" decoding="async" alt="{e(alt_a)}">\n'
            f'<img class="cc-lp__ba-before" src="{U}{before}" width="{w}" height="{h}" loading="lazy" decoding="async" alt="{e(alt_b)}">\n'
            '<span class="cc-lp__ba-tag cc-lp__ba-tag--l" aria-hidden="true">Vorher</span>\n<span class="cc-lp__ba-tag cc-lp__ba-tag--r" aria-hidden="true">Nachher</span>\n'
            '<span class="cc-lp__ba-line" aria-hidden="true"></span>\n<input type="range" min="0" max="100" value="50" aria-label="Vorher-Nachher-Vergleich: Regler verschieben">\n</div>')

def proof(left, quote, who, kicker='Echte Google-Bewertung'):
    return f'''<section class="cc-lp__sec" aria-labelledby="cc-lp-proof" style="border-top:1px solid rgba(255,255,255,.08)">
<div class="cc-lp__shell cc-lp__proof">
<div class="cc-rv">{left}</div>
<blockquote class="cc-lp__quote cc-rv">
<p class="cc-lp__kicker" style="margin-bottom:14px!important">{kicker}</p>
<p class="cc-lp__stars" role="img" aria-label="5 von 5 Sternen">★★★★★</p>
<p class="cc-lp__q">{quote}</p>
<footer><span id="cc-lp-proof">{who}</span></footer>
</blockquote>
</div>
</section>'''

Q_M2 = '„Ich war mit meinem M2 G87 bei Carcura für eine Keramikversiegelung und bin mit dem Ergebnis wirklich super zufrieden! … der Lack sieht einfach klasse aus.“'
Q_HOL = '„Nach Terminabsprache wurde das Fahrzeug pünktlich geholt und sogar schneller gebracht als abgesprochen. Gerne wieder“'

TOWNS = ('Unsere Halle liegt in Walterschen im Westerwald, zwischen Altenkirchen und Weyerbusch – mehr zur '
         '<a href="/fahrzeugaufbereitung-westerwald/">Fahrzeugaufbereitung im Westerwald</a> und für '
         '<a href="/fahrzeugaufbereitung-altenkirchen/">Altenkirchen</a>. Zu uns kommen Kundinnen und Kunden unter anderem aus Weyerbusch, '
         'Flammersfeld, Hamm (Sieg), Wissen, Hachenburg, Asbach, Puderbach, Dierdorf, Neuwied sowie aus Waldbröl, Windeck und Eitorf – auf Wunsch mit '
         '<a href="/hol-und-bringservice/">Hol- und Bringservice</a>. <a href="/leistungen/">Alle Leistungen und Preise</a>.')

MORE_STD = [
    ('/auto-innenreinigung/', 'Auto-Innenreinigung', 'Normal oder detailliert', 'ab 90&nbsp;€'),
    ('/keramikversiegelung/', 'Keramikversiegelung', 'Inklusive Politur', 'ab 650&nbsp;€'),
    ('/scheinwerfer-aufbereiten/', 'Scheinwerfer aufbereiten', 'Beide wieder klar', 'ab 69&nbsp;€'),
    ('/hol-und-bringservice/', 'Hol- und Bringservice', 'Bis 10&nbsp;km kostenlos', '→'),
]

PAGES = []

# 1 ── Autopolitur
PAGES.append(dict(
    slug='autopolitur', title='Auto polieren lassen im Westerwald', crumb='Autopolitur', service='1-stufige Politur',
    seo_title='Auto polieren lassen im Westerwald ab 349 € | Lackaufbereitung | Carcura',
    seo_desc='Autopolitur in Walterschen bei Altenkirchen: 1-stufig ab 349 €, 2-stufige Lackkorrektur gegen Swirls ab 549 €, einzelne Kratzer nach Foto. Wäsche und Kneten inklusive.',
    focus='auto polieren lassen', price='349', price_num='349',
    desc='Autopolitur und Lackaufbereitung im Westerwald: 1-stufige Politur ab 349 €, 2-stufige Lackkorrektur ab 549 €, inklusive Handwäsche und Kneten.',
    kicker='Autopolitur · Walterschen',
    h1='Auto polieren lassen im Westerwald. <span>Glanz statt Swirls.</span>',
    lead='Waschanlagen-Kratzer, feine Kringel im Sonnenlicht, matter Lack: Eine Maschinenpolitur holt die Farbtiefe zurück. Bei Carcura ist die Vorarbeit immer dabei – Handwäsche, Flugrost- und Teerentfernung und Kneten –, damit wir sauberen Lack polieren und keinen Schmutz einarbeiten.',
    price_note='1-stufige Politur inkl. Wäsche und Kneten · 2-stufig ab 549&nbsp;€',
    facts=['Wäsche und Kneten inklusive', 'Maschinell, Bauteil für Bauteil', 'Ehrliche Einschätzung vorab'],
    cta='Politur anfragen',
    hero_media=img('2026/10/carcura-politur-schwarzer-lack-hd.jpg', 'Maschinelle Politur am schwarzen Lack eines BMW M2 in der Carcura-Halle', 'Maschinelle Politur in unserer Halle', pos='50% 50%'),
    steps_kicker='So arbeiten wir', steps_h2='Sechs Schritte <span>zu klarem Lack.</span>',
    steps_intro='Wie viel Politur dein Lack braucht, entscheiden wir erst, wenn wir ihn bei gutem Licht gesehen haben. Leichte Waschkratzer reichen oft für eine 1-stufige Politur, Swirls und Hologramme brauchen die 2-stufige Lackkorrektur.',
    steps=['Gründliche Handwäsche inklusive Felgen und Reifen.',
           'Flugrost- und Teerentfernung, danach Kneten des Lacks gegen fest sitzende Verschmutzungen.',
           'Abkleben von Gummis und Kunststoffteilen, damit nichts ausbleicht.',
           '1-stufig: maschinelle Politur des gesamten Lacks für mehr Glanz und weniger Swirls.',
           '2-stufig: erst Schleifpolitur gegen Kratzer und Swirls, dann Hochglanzpolitur ohne Hologramme.',
           'Endkontrolle bei gutem Licht – erst dann geht das Auto zurück.'],
    note='Kratzer bis in die Farbschicht lassen sich nicht vollständig auspolieren – das sagen wir dir vorher ehrlich. Eine gute Faustregel: Bleibt der Fingernagel im Kratzer hängen, ist er für eine Politur meist zu tief. Schick uns im Zweifel ein Foto per WhatsApp.',
    prices_h2='Politur und <span>passende Extras.</span>',
    rows=[row('1-stufige Politur', 'Mehr Glanz, weniger Swirls – inklusive Handwäsche, Flugrostentfernung und Kneten.', '349'),
          row('2-stufige Politur', 'Lackkorrektur bei Waschkratzern, Swirls und Hologrammen: Schleif- und Hochglanzpolitur.', '549'),
          row('Kratzer punktuell auspolieren', 'Einzelne Kratzer an einem Bauteil – Preis je nach Stelle und Tiefe.', 'nach Foto'),
          row('Handwäsche mit Wachs', 'Wachs von Hand aufgetragen – mehr Glanz und Abperleffekt für einige Wochen.', '99', 'nach Politur +30&nbsp;€'),
          row('Keramikversiegelung', 'Konserviert das Ergebnis der Politur – inklusive 1-stufiger Politur.', '650', link='/keramikversiegelung/', label='Mehr dazu')],
    proof=proof(ba('2026/10/9f8682c3-03c3-46ce-a152-94b734841ac2-576x1024.jpeg', '2026/10/635f7551-da78-4944-8c59-54b266326336-576x1024.jpeg',
                   'BMW M2 Frontniere nachher: sauber, glänzend, ohne Wasserflecken', 'BMW M2 Frontniere vorher: Wasserflecken und Schmutz'),
                Q_M2, 'Kunde mit BMW M2 G87 · Politur und Keramik'),
    faq_h2='Gut zu wissen <span>vor der Politur.</span>',
    faqs=[('Was kostet es, das Auto polieren zu lassen?', 'Die 1-stufige Politur kostet bei uns ab 349&nbsp;€, die 2-stufige Lackkorrektur ab 549&nbsp;€ – jeweils für PKW und Kombi und inklusive Handwäsche, Flugrost- und Teerentfernung und Kneten. Den verbindlichen Preis bestätigen wir dir vor dem Termin.'),
          ('1-stufig oder 2-stufig – was brauche ich?', 'Ist der Lack nur matt oder hat leichte Waschkratzer, reicht meist die 1-stufige Politur. Siehst du in der Sonne viele feine Kringel (Swirls) oder Schlieren (Hologramme), ist die 2-stufige Politur sinnvoll. Am einfachsten: Schick uns Fotos per WhatsApp, wir sagen dir ehrlich, was nötig ist.'),
          ('Gehen alle Kratzer durch eine Politur weg?', 'Nein. Oberflächliche Kratzer im Klarlack lassen sich gut auspolieren oder deutlich mildern. Kratzer bis in die Farbschicht bleiben sichtbar – das sagen wir dir vor dem Termin.'),
          ('Soll ich nach der Politur versiegeln?', 'Eine Politur entfernt eine dünne Schicht Klarlack und macht ihn klar – schützen tut sie nicht. Für ein paar Wochen Glanz reicht Wachs (nach der Politur nur +30&nbsp;€), für langen Schutz die <a href="/keramikversiegelung/">Keramikversiegelung</a>.'),
          ('Holt ihr das Auto zur Politur ab?', 'Ja. Im Umkreis von 10&nbsp;km um Walterschen – zum Beispiel in Altenkirchen, Weyerbusch oder Flammersfeld – ist die Abholung kostenlos, weiter entfernt kostet jeder zusätzliche Kilometer 2&nbsp;€. Mehr zum <a href="/hol-und-bringservice/">Hol- und Bringservice</a>.')],
    more=MORE_STD, towns=TOWNS,
    cta_h2='Bereit für Glanz statt Kratzer?',
    cta_p='Schick uns ein paar Fotos vom Lack bei Tageslicht. Wir sagen dir ehrlich, welche Politur sinnvoll ist, was sie kostet und wann ein Termin frei ist.',
))

# 2 ── Geruch entfernen / Ozon / Tierhaare
PAGES.append(dict(
    slug='geruch-im-auto-entfernen', title='Geruch im Auto entfernen – Ozonbehandlung', crumb='Geruch entfernen', service='Ozonbehandlung',
    seo_title='Geruch im Auto entfernen: Ozonbehandlung ab 59 € | Westerwald | Carcura',
    seo_desc='Rauch-, Hunde- oder Essensgeruch im Auto? Ozonbehandlung ab 59 €, mit Innenreinigung nur +39 €. Tierhaarentfernung und Polsterreinigung in Walterschen bei Altenkirchen.',
    focus='geruch im auto entfernen', price='59', price_num='59',
    desc='Geruch im Auto entfernen im Westerwald: Ozonbehandlung ab 59 €, Tierhaarentfernung ab 69 €, Polster-Tiefenreinigung ab 79 €.',
    kicker='Geruch & Tierhaare · Walterschen',
    h1='Geruch im Auto entfernen. <span>Rauch, Hund, Essen – raus.</span>',
    lead='Duftbäume überdecken Gerüche nur. Wir gehen an die Ursache: Erst reinigen wir Polster, Teppich und Ritzen, dann zersetzt eine Ozonbehandlung die Geruchsmoleküle – auch im Dachhimmel und in der Lüftung. Hundehaare holen wir mit Spezialbürsten und Druckluft aus jeder Naht.',
    price_note='Ozonbehandlung · mit Innenreinigung nur +39&nbsp;€',
    facts=['Ursache statt Duftbaum', 'Auch in Lüftung und Polstern', 'Tierhaare mit Spezialbürsten'],
    cta='Ozonbehandlung anfragen', wa_label='Kurz per WhatsApp beschreiben',
    hero_media=img('2026/10/carcura-innenreinigung-cockpit-hd.jpg', 'Gereinigtes Cockpit und Fahrersitz eines Mercedes bei Carcura', 'Innenraum nach der Reinigung', pos='50% 55%'),
    steps_kicker='So arbeiten wir', steps_h2='Erst sauber, <span>dann geruchsfrei.</span>',
    steps_intro='Geruch sitzt dort, wo Schmutz sitzt: in Polstern, Teppich, Fußmatten und Lüftung. Deshalb empfehlen wir die Ozonbehandlung fast immer zusammen mit einer Innenreinigung – dann kostet das Ozon nur 39&nbsp;€ extra.',
    steps=['Innenraum aussaugen, Fußmatten reinigen, Flecken vorbehandeln – die Ursache muss raus.',
           'Bei Bedarf Polster und Stoffsitze im Sprühextraktionsverfahren tief reinigen.',
           'Tierhaare mit Spezialbürsten aus Teppich und Polstern lösen, Ritzen mit dem Tornador ausblasen.',
           'Ozongerät arbeitet im geschlossenen, leeren Fahrzeug.',
           'Ozon zersetzt Geruchsmoleküle in Polstern, Dachhimmel, Teppich – und strömt durch Lüftung und Klimakanäle.',
           'Gründliches Auslüften, danach bekommst du dein Auto zurück.'],
    note='Ehrlich gesagt: Sehr alter, tief eingezogener Rauchgeruch lässt sich stark reduzieren, aber nicht immer zu hundert Prozent entfernen. Beschreib uns kurz, was los ist – dann sagen wir dir vorher, was realistisch ist.',
    prices_h2='Gegen Geruch <span>und Tierhaare.</span>',
    rows=[row('Ozonbehandlung', 'Gegen Rauch-, Hunde- und Essensgeruch – bis in Polster und Lüftung.', '59', 'mit Innenreinigung +39&nbsp;€'),
          row('Tierhaarentfernung', 'Hunde- und Katzenhaare aus Teppich, Sitzen und Kofferraum.', '69', 'mit Innenreinigung +29&nbsp;€'),
          row('Polster- & Sitzreinigung (Tiefenreinigung)', 'Flecken und Schmutz tief aus Stoffsitzen und Polstern geholt.', '79', 'mit Innenreinigung +59&nbsp;€'),
          row('Innenraumreinigung Detailliert', 'Intensiv – inklusive Sitze, Polster, Ritzen und Lüftungsdüsen.', '150'),
          row('Innenraumreinigung Normal', 'Gründliche Innenreinigung für gepflegte Fahrzeuge.', '90', link='/auto-innenreinigung/', label='Mehr dazu')],
    proof=proof(ba('2026/07/img_1694.jpeg', '2026/07/img_1693.jpeg', 'Fahrzeuginnenraum nach der Aufbereitung bei Carcura in Walterschen', 'Derselbe Fahrzeuginnenraum vor der Aufbereitung', 1024, 1024),
                Q_HOL, 'Kunde · Innenreinigung mit Hol- und Bringservice'),
    faq_h2='Gut zu wissen <span>gegen Gerüche.</span>',
    faqs=[('Was hilft gegen Rauchgeruch im Auto?', 'Am besten eine Kombination aus gründlicher Innenreinigung – Polster, Dachhimmel, Teppich, Lüftungsdüsen – und einer Ozonbehandlung. Die Reinigung entfernt die Ablagerungen, das Ozon zersetzt die Geruchsmoleküle, die übrig bleiben.'),
          ('Was kostet eine Ozonbehandlung?', 'Ab 59&nbsp;€ einzeln, zusammen mit einer Innenreinigung nur +39&nbsp;€. Die Innenreinigung beginnt bei 90&nbsp;€.'),
          ('Ist die Ozonbehandlung gefährlich?', 'Ozon reizt in hoher Konzentration die Atemwege. Deshalb arbeitet das Gerät nur im geschlossenen, leeren Fahrzeug, und wir lüften danach gründlich aus, bevor du einsteigst.'),
          ('Bekommt ihr Hundehaare wirklich raus?', 'Ja – mit Spezialbürsten aus Teppich und Polstern, Ritzen und Nähte blasen wir mit dem Tornador aus, Kofferraum und Hundebox-Bereich besonders gründlich. Gegen Hundegeruch hilft zusätzlich die Ozonbehandlung.'),
          ('Holt ihr das Auto ab?', 'Ja. Im Umkreis von 10&nbsp;km um Walterschen ist die Abholung kostenlos, weiter entfernt kostet jeder zusätzliche Kilometer 2&nbsp;€. Mehr zum <a href="/hol-und-bringservice/">Hol- und Bringservice</a>.')],
    more=[MORE_STD[0], ('/leasingrueckgabe-aufbereitung/', 'Leasingrückgabe & Verkauf', 'Bestzustand vor der Rückgabe', 'ab 229&nbsp;€'), MORE_STD[2], MORE_STD[3]],
    towns=TOWNS,
    cta_h2='Riecht dein Auto nicht mehr gut?',
    cta_p='Schreib uns kurz, was für ein Geruch es ist und wie lange schon. Wir melden uns mit einer ehrlichen Einschätzung, einem festen Preis und einem Termin.',
))

# 3 ── Altenkirchen
PAGES.append(dict(
    slug='fahrzeugaufbereitung-altenkirchen', title='Fahrzeugaufbereitung Altenkirchen', crumb='Altenkirchen', service='Basic Innen & Außen',
    seo_title='Fahrzeugaufbereitung Altenkirchen – Abholung gratis | Carcura',
    seo_desc='Fahrzeugaufbereitung für Altenkirchen: Wir holen dein Auto kostenlos ab, bereiten es in unserer Halle in Walterschen auf und bringen es zurück. Innenreinigung ab 90 €, Politur ab 349 €.',
    focus='fahrzeugaufbereitung altenkirchen', price='90', price_num='90',
    desc='Fahrzeugaufbereitung für Altenkirchen (Westerwald) mit kostenloser Abholung: Innenreinigung, Politur, Keramikversiegelung und Scheinwerfer in der Halle in Walterschen.',
    area=['Altenkirchen', 'Walterschen', 'Weyerbusch', 'Flammersfeld'],
    kicker='Autoaufbereitung · Altenkirchen',
    h1='Fahrzeug&shy;aufbereitung Altenkirchen. <span>Abholung gratis.</span>',
    lead='Unsere Halle steht in Walterschen, direkt vor den Toren von Altenkirchen. Altenkirchen liegt in unserem kostenlosen Abholgebiet: Wir holen dein Auto zu Hause oder am Arbeitsplatz ab, bereiten es von Hand auf und bringen es zurück. Bezahlt wird erst nach der Übergabe.',
    price_note='Auto-Innenreinigung · Abholung in Altenkirchen kostenlos',
    facts=['Abholung in Altenkirchen gratis', 'Inhabergeführt: Alex &amp; Richy', '4,7 ★ aus 15 Google-Bewertungen'],
    cta='Mit Abholung anfragen', wa_label='Per WhatsApp schreiben',
    hero_media=img('2026/10/carcura-audi-a6-westerwald-hd.jpg', 'Grauer Audi A6 Avant nach der Aufbereitung auf einer Wiese im Westerwald', 'Frisch aufbereitet im Westerwald', pos='50% 50%'),
    steps_kicker='So läuft es', steps_h2='Aus Altenkirchen <span>in drei Schritten.</span>',
    steps_intro='Du musst nicht nach Walterschen fahren. Sag uns, wann und wo wir dein Auto in Altenkirchen abholen sollen – wir stimmen Preis und Uhrzeit vorher mit dir ab.',
    steps=['<b>Anfragen.</b> Leistung wählen oder Fotos per WhatsApp schicken – du bekommst einen festen Preis.',
           '<b>Abholen lassen.</b> Wir holen dein Auto in Altenkirchen ab – zu Hause oder am Arbeitsplatz.',
           '<b>Gepflegt zurück.</b> Wir bereiten es in unserer Halle von Hand auf und bringen es zurück. Bezahlt wird nach der Übergabe.'],
    note='Lieber selbst vorbeikommen? Gerne – unsere Halle findest du in der Hauptstr. 7 in 57632 Walterschen. Termine gibt es nach Vereinbarung, auch abends und samstags.',
    prices_h2='Leistungen <span>für Altenkirchen.</span>',
    rows=[row('Auto-Innenreinigung', 'Sitze, Teppiche, Cockpit, Scheiben und Kofferraum – normal oder detailliert.', '90', link='/auto-innenreinigung/', label='Mehr dazu'),
          row('Basic Innen & Außen', 'Innenraum und schonende Handwäsche in einem Termin – günstiger als einzeln.', '145'),
          row('Verkaufs- & Leasingrückgabe-Paket', 'Bestzustand für Leasingrückgabe, Inzahlungnahme oder Verkauf.', '229', link='/leasingrueckgabe-aufbereitung/', label='Mehr dazu'),
          row('Autopolitur', 'Weniger Swirls und Kratzer, mehr Glanz – Wäsche und Kneten inklusive.', '349', link='/autopolitur/', label='Mehr dazu'),
          row('Keramikversiegelung', 'Langanhaltender Lackschutz mit Abperleffekt, inklusive 1-stufiger Politur.', '650', link='/keramikversiegelung/', label='Mehr dazu'),
          row('Scheinwerferaufbereitung', 'Beide Scheinwerfer wieder klar, mit UV-Schutzversiegelung.', '69', link='/scheinwerfer-aufbereiten/', label='Mehr dazu')],
    proof=proof(img('2026/10/carcura-team-alexander-richy.jpg', 'Richy Schumacher und Alexander Fuchs, die Inhaber von Carcura, in ihrer Halle in Walterschen', 'Alex &amp; Richy, eure Ansprechpartner', 1200, 1500, eager=False).replace('cc-lp__media cc-rv', 'cc-lp__media'),
                Q_HOL, 'Tobias · Google-Bewertung · mit Hol- und Bringservice'),
    faq_h2='Fahrzeugaufbereitung Altenkirchen – <span>kurz erklärt.</span>',
    faqs=[('Wo genau ist eure Halle?', 'In der Hauptstr. 7, 57632 Walterschen – im Landkreis Altenkirchen, zwischen Altenkirchen und Weyerbusch.'),
          ('Kostet die Abholung in Altenkirchen etwas?', 'Nein. Altenkirchen liegt in unserem Umkreis von 10&nbsp;km um Walterschen, in dem Abholung und Rückgabe kostenlos sind. Weiter entfernt berechnen wir 2&nbsp;€ pro zusätzlichem Kilometer, Hin- und Rückfahrt inklusive.'),
          ('Welche Leistungen bietet ihr an?', 'Auto-Innenreinigung, Handwäsche, Politur, Keramikversiegelung, Scheinwerferaufbereitung, Ozonbehandlung gegen Gerüche, Tierhaarentfernung, das Verkaufs- und Leasingrückgabe-Paket und Wohnmobil-Reinigung. Alle Preise stehen auf der Seite <a href="/leistungen/">Leistungen &amp; Preise</a>.'),
          ('Wann habt ihr Termine?', 'Termine gibt es nach Vereinbarung, auch abends und samstags. Am schnellsten geht es über das <a href="/anfragen/">Anfrageformular</a> oder per WhatsApp unter +49 170 6669516.'),
          ('Arbeitet ihr auch für Autohäuser und Firmen in Altenkirchen?', 'Ja – für Händler, Werkstätten und Fuhrparks gibt es eigene Konditionen. Mehr unter <a href="/firmenkunde/">Händler &amp; Firmen</a>.')],
    more=[('/autopolitur/', 'Autopolitur', 'Glanz statt Swirls', 'ab 349&nbsp;€'), MORE_STD[0], MORE_STD[1], ('/geruch-im-auto-entfernen/', 'Geruch entfernen', 'Ozon und Tierhaare', 'ab 59&nbsp;€')],
    towns='Neben Altenkirchen holen wir Autos auch in Weyerbusch und Flammersfeld kostenlos ab. Aus Hachenburg, Wissen, Hamm (Sieg), Asbach, Puderbach und Dierdorf geht es mit <a href="/hol-und-bringservice/">Hol- und Bringservice</a> für 2&nbsp;€ pro zusätzlichem Kilometer. Mehr zur <a href="/fahrzeugaufbereitung-westerwald/">Fahrzeugaufbereitung im Westerwald</a> · <a href="/ueber-uns/">Über uns</a>.',
    cta_h2='Dein Auto aus Altenkirchen – abgeholt und gepflegt zurück.',
    cta_p='Sag uns, was dein Auto braucht und wann wir es abholen sollen. Wir melden uns persönlich mit Preis und Termin, meist noch am selben Tag.',
))

# 4 ── Leasingrückgabe & Verkauf
PAGES.append(dict(
    slug='leasingrueckgabe-aufbereitung', title='Aufbereitung vor Leasingrückgabe und Verkauf', crumb='Leasingrückgabe & Verkauf', service='Verkaufs- & Leasingrückgabe-Paket',
    seo_title='Auto vor Leasingrückgabe & Verkauf aufbereiten ab 229 € | Carcura',
    seo_desc='Aufbereitung vor Leasingrückgabe, Inzahlungnahme oder Verkauf: Innenreinigung, Fleckenbehandlung, Handwäsche und Glanz ab 229 €. In Walterschen bei Altenkirchen, mit Abholung.',
    focus='leasingrückgabe aufbereitung', price='229', price_num='229',
    desc='Verkaufs- und Leasingrückgabe-Paket im Westerwald: detaillierte Innenreinigung, Fleckenbehandlung, Handwäsche und Schnellversiegelung ab 229 €.',
    kicker='Leasingrückgabe & Verkauf',
    h1='Auto aufbereiten vor Rückgabe oder Verkauf. <span>Der erste Eindruck zählt.</span>',
    lead='Ob Leasingrückgabe, Inzahlungnahme oder Privatverkauf: Ein sauberes, gepflegtes Auto hinterlässt beim Gutachter und beim Käufer einen anderen Eindruck als eins mit Krümeln, Flecken und Hundehaaren. Unser Paket bringt Innenraum und Lack in Bestzustand – auf Wunsch mit Fotos für deine Verkaufsanzeige.',
    price_note='Verkaufs- &amp; Leasingrückgabe-Paket, innen und außen',
    facts=['Innen und außen in einem Termin', 'Flecken und Gerüche raus', 'Fotos für die Anzeige möglich'],
    cta='Paket anfragen',
    hero_media=img('2026/07/img_2885-577x1024.jpeg', 'Geöffnete Fahrertür eines schwarzen Mercedes nach der Komplettaufbereitung bei Carcura', 'Nach der Komplettaufbereitung', 577, 1024, pos='50% 60%'),
    steps_kicker='Im Paket', steps_h2='Was wir machen, <span>bevor du abgibst.</span>',
    steps_intro='Das Paket kombiniert unsere detaillierte Innenreinigung mit einer schonenden Handwäsche und frischem Glanz. Kratzer und Dellen beseitigt es nicht – dafür gibt es auf Wunsch die Politur.',
    steps=['Detaillierte Innenreinigung: Sitze, Polster, Ritzen und Lüftungsdüsen.',
           'Fleckenbehandlung an Sitzen und Teppich.',
           'Kofferraum komplett inklusive Reserveradmulde.',
           'Kunststoffpflege innen für einen frischen, matten Look.',
           'Schonende Handwäsche inklusive Felgen, Türfalzen und Tankdeckel.',
           'Schnellversiegelung für frischen Glanz, Scheiben innen und außen.'],
    note='Wichtig für die Leasingrückgabe: Beschädigungen wie Dellen, tiefe Kratzer oder Steinschläge bewertet der Gutachter unabhängig von der Sauberkeit. Was wir verbessern können, ist der Pflegezustand – und leichte Kratzer im Klarlack mit einer Politur.',
    prices_h2='Paket und <span>sinnvolle Extras.</span>',
    rows=[row('Verkaufs- & Leasingrückgabe-Paket', 'Detaillierte Innenreinigung, Fleckenbehandlung, Handwäsche und Schnellversiegelung.', '229'),
          row('Scheinwerferaufbereitung', 'Matte, vergilbte Scheinwerfer wieder klar – wirkt sofort gepflegter.', '69', link='/scheinwerfer-aufbereiten/', label='Mehr dazu'),
          row('Ozonbehandlung', 'Gegen Rauch- und Hundegeruch – mit Innenreinigung nur +39&nbsp;€.', '59', link='/geruch-im-auto-entfernen/', label='Mehr dazu'),
          row('1-stufige Politur', 'Mehr Glanz, weniger Waschkratzer – Wäsche und Kneten inklusive.', '349', link='/autopolitur/', label='Mehr dazu'),
          row('Fotos oder Fahrzeugvideo', 'Nach der Aufbereitung – zum Beispiel für deine Verkaufsanzeige.', 'auf Anfrage')],
    proof=proof(img('2026/10/carcura-innenreinigung-cockpit-hd.jpg', 'Gereinigtes Cockpit und Fahrersitz eines Mercedes bei Carcura', 'Innenraum nach der Aufbereitung', eager=False).replace('cc-lp__media cc-rv', 'cc-lp__media'),
                Q_HOL, 'Tobias · Google-Bewertung'),
    faq_h2='Gut zu wissen <span>vor der Abgabe.</span>',
    faqs=[('Lohnt sich eine Aufbereitung vor der Leasingrückgabe?', 'Starke Verschmutzung, Flecken und Gerüche fallen bei der Rückgabe negativ auf und lassen sich mit einer Aufbereitung vermeiden. Echte Schäden wie Dellen oder Steinschläge bewertet der Gutachter unabhängig davon – die beseitigen wir nicht.'),
          ('Was kostet das Paket?', 'Ab 229&nbsp;€ für PKW und Kombi bei normaler Verschmutzung. Den verbindlichen Preis bestätigen wir dir vor dem Termin.'),
          ('Macht ihr auch Fotos für die Verkaufsanzeige?', 'Ja, auf Wunsch fotografieren wir dein Auto nach der Aufbereitung oder drehen ein kurzes Video. Umfang und Preis stimmen wir mit dir ab.'),
          ('Arbeitet ihr für Autohändler?', 'Ja – für Händler und Fuhrparks gibt es eigene Konditionen und Abholung. Mehr unter <a href="/firmenkunde/">Händler &amp; Firmen</a>.'),
          ('Holt ihr das Auto ab?', 'Ja. Im Umkreis von 10&nbsp;km um Walterschen ist die Abholung kostenlos, weiter entfernt kostet jeder zusätzliche Kilometer 2&nbsp;€. Mehr zum <a href="/hol-und-bringservice/">Hol- und Bringservice</a>.')],
    more=[('/autopolitur/', 'Autopolitur', 'Glanz statt Swirls', 'ab 349&nbsp;€'), MORE_STD[2], ('/geruch-im-auto-entfernen/', 'Geruch entfernen', 'Ozon und Tierhaare', 'ab 59&nbsp;€'), ('/firmenkunde/', 'Händler &amp; Firmen', 'Konditionen für Betriebe', '→')],
    towns=TOWNS,
    cta_h2='Auto bald abgeben oder verkaufen?',
    cta_p='Sag uns, wann die Rückgabe oder der Verkauf ansteht. Wir planen den Termin so, dass dein Auto rechtzeitig in Bestzustand ist.',
))

# 5 ── Wohnmobil
PAGES.append(dict(
    slug='wohnmobil-aufbereitung', title='Wohnmobil-Aufbereitung im Westerwald', crumb='Wohnmobil-Aufbereitung', service='Wohnmobil-Komplettreinigung',
    seo_title='Wohnmobil-Aufbereitung Westerwald ab 700 € | Innen & außen | Carcura',
    seo_desc='Wohnmobil-Komplettreinigung im Westerwald: außen mit Dach und Klappen, innen bis zur letzten Schublade – Küche, Bad, Polster. Ab 700 €, in Walterschen bei Altenkirchen.',
    focus='wohnmobil aufbereitung', price='700', price_num='700',
    desc='Wohnmobil-Komplettreinigung im Westerwald ab 700 €: Handwäsche inklusive Dach, Innenreinigung mit Küche, Bad und Polstern.',
    kicker='Wohnmobil · Walterschen',
    h1='Wohnmobil-Aufbereitung im Westerwald. <span>Bis zur letzten Schublade.</span>',
    lead='Vor der Saison, nach dem Urlaub oder vor dem Verkauf: Wir reinigen dein Wohnmobil innen und außen komplett – vom Dach bis zum Kühlschrank. Das Fahrerhaus behandeln wir wie bei einer PKW-Innenreinigung.',
    price_note='Komplettreinigung innen und außen · Endpreis je nach Länge',
    facts=['Außen inklusive Dach und Klappen', 'Küche, Bad und Polster', 'Fester Preis vor dem Termin'],
    cta='Wohnmobil anfragen',
    hero_media=stage('700&nbsp;€', 'ab – für die Komplettreinigung innen und außen. Den Endpreis bestätigen wir dir nach Länge und Zustand.', ['Außen von Hand', 'Innen komplett', 'Fahrerhaus wie beim PKW']),
    steps_kicker='Im Paket', steps_h2='Was wir an deinem <span>Wohnmobil machen.</span>',
    steps_intro='Wohnmobile sind so unterschiedlich wie ihre Besitzer. Deshalb schauen wir uns Länge und Zustand vorher an – am einfachsten über ein paar Fotos per WhatsApp.',
    steps=['Außen: Vorwäsche und Handwäsche inklusive Dach, Wänden und Klappen.',
           'Außen: Fenster schonend gereinigt, Felgen und Reifen.',
           'Innen: alle Schränke, Fächer und Schubladen ausgewischt.',
           'Innen: Küche mit Kochfeld, Spüle und Kühlschrank.',
           'Innen: Bad und Nasszelle, Polster gesaugt, Böden, Fenster und Rollos gereinigt.',
           'Fahrerhaus komplett wie bei einer PKW-Innenreinigung.'],
    note='Wohnwagen, Transporter oder nur einzelne Bereiche? Auch das machen wir – beschreib uns einfach, was du brauchst, und wir melden uns mit einer ehrlichen Einschätzung und einem Preis.',
    prices_h2='Wohnmobil <span>und Extras.</span>',
    rows=[row('Wohnmobil-Komplettreinigung', 'Innen und außen komplett – Endpreis je nach Länge und Zustand.', '700'),
          row('Ozonbehandlung', 'Gegen Gerüche in Polstern und Lüftung – ideal nach der Saison.', '59', link='/geruch-im-auto-entfernen/', label='Mehr dazu'),
          row('Tierhaarentfernung', 'Hunde- und Katzenhaare aus Teppich und Polstern.', '69'),
          row('Andere Wünsche', 'Wohnwagen, Transporter oder einzelne Bereiche – nach Absprache.', 'individuell')],
    proof='',
    faq_h2='Gut zu wissen <span>fürs Wohnmobil.</span>',
    faqs=[('Was kostet eine Wohnmobil-Aufbereitung?', 'Die Komplettreinigung innen und außen beginnt bei 700&nbsp;€. Der Endpreis hängt von Länge und Zustand ab – wir bestätigen ihn vor dem Termin.'),
          ('Reinigt ihr auch Wohnwagen?', 'Ja, Wohnwagen und Transporter machen wir nach Absprache. Beschreib uns, was du brauchst, und schick am besten ein paar Fotos.'),
          ('Wann ist der beste Zeitpunkt?', 'Viele lassen ihr Wohnmobil vor dem Saisonstart oder nach dem letzten Urlaub im Herbst reinigen, bevor es ins Winterlager geht. Frag rechtzeitig an, damit wir einen passenden Termin finden.'),
          ('Was ist im Innenraum enthalten?', 'Alle Schränke, Fächer und Schubladen, die Küche mit Kochfeld, Spüle und Kühlschrank, Bad und Nasszelle, gesaugte Polster, Böden, Fenster und Rollos – und das Fahrerhaus wie bei einer PKW-Innenreinigung.'),
          ('Wo seid ihr?', 'In der Hauptstr. 7, 57632 Walterschen im Westerwald, zwischen Altenkirchen und Weyerbusch. Termine gibt es nach Vereinbarung.')],
    more=[('/geruch-im-auto-entfernen/', 'Geruch entfernen', 'Ozon und Tierhaare', 'ab 59&nbsp;€'), MORE_STD[0], MORE_STD[1], ('/leistungen/', 'Alle Leistungen &amp; Preise', 'Auf einen Blick', '→')],
    towns=TOWNS,
    cta_h2='Dein Wohnmobil bereit für die nächste Tour?',
    cta_p='Schick uns ein paar Fotos und die Länge deines Wohnmobils. Wir melden uns mit einem festen Preis und einem Termin.',
))

if __name__ == '__main__':
    out = {}
    for p in PAGES:
        h = page(p)
        open(os.path.join(D, f"page-{p['slug']}.html"), 'w').write(h)
        out[p['slug']] = {k: p[k] for k in ('title', 'seo_title', 'seo_desc', 'focus')}
        print(p['slug'], len(h), len(p['seo_title']), len(p['seo_desc']))
    json.dump(out, open(os.path.join(D, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
