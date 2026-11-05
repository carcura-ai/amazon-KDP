# Übersetzt edits.py in WordPress-Befehle (wp_replace_in_post) und prüft sie lokal gegen build.py
import re, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import edits as E

D = os.path.dirname(os.path.abspath(__file__))

def pcre(pat):  # Python-Muster -> PCRE-Körper mit / als Trenner
    body = pat.pattern.replace('/', r'\/')
    if pat.flags & re.S: body = '(?s)' + body
    return body

def php_repl(s):  # Literal für PHP-Ersetzung
    return s.replace('\\', '\\\\').replace('$', '\\$')

def rule_ops(rules):
    out = []
    for old, new, cnt in rules:
        if isinstance(old, re.Pattern):
            out.append(dict(search=pcre(old), replace=php_repl(new), regex=True, max=cnt))
        else:
            out.append(dict(search=old, replace=new, regex=False, max=cnt))
    return out

def S(search, replace, cnt=1): return dict(search=search, replace=replace, regex=False, max=cnt)
def R(search, replace, cnt=1): return dict(search=search, replace=replace, regex=True, max=cnt)

# --- Leistungen: Zusätze nach der Scheiben-Keramik-Zeile
lx = E.leistungen_extra('<b>Scheiben-Keramikversiegelung</b>X\n')  # Einschub ermitteln
ins = lx[len('<b>Scheiben-Keramikversiegelung</b>X'):-1]
LEIST = rule_ops(E.LEISTUNGEN) + [R(r'(<b>Scheiben-Keramikversiegelung<\/b>[^\n]*)', '$1' + php_repl(ins))]

# --- Geruch: Zusätze aus geruch_extra
GER = rule_ops(E.GERUCH) + [
 R(r'(<p class="cc-lp__kicker">)Geruch (?:&amp;|&#038;|&) Tierhaare( · Walterschen<\/p>)', '${1}Geruch entfernen${2}'),
 R(r'(<p class="cc-lp__price"><b><i>ab<\/i>59&nbsp;€<\/b><span>)[^<]*(<\/span>)', '${1}Ozon einzeln · mit Innenreinigung ab 129&nbsp;€ gesamt${2}'),
 R(r'(<div class="cc-lp__prices[^"]*">\n)', '$1' + php_repl(
   E.lp_row('Innenreinigung + Ozon', 'Die Ursache raus, dann Ozon – der Weg gegen Rauch im Gebrauchtwagen.', '129', '/anfragen/?leistung=Innenraumreinigung%20Normal&amp;leistung=Ozonbehandlung')
   + E.lp_row('Fleck + Geruch', 'Alle Polster tiefengereinigt plus Ozon, z.&nbsp;B. nach Milch oder Kakao.', '119', '/autositz-reinigen-flecken/', 'Details'))),
 R(r'(?s)<a([^>]*)href="\/leasingrueckgabe-aufbereitung\/"([^>]*)>(.*?)<\/a>', '<a$1href="/autositz-reinigen-flecken/"$2><b>Flecken im Sitz</b><span>Einzelner Sitz</span><em>ab 49&nbsp;€</em></a>'),
 R(r'(?s)<a([^>]*)href="\/scheinwerfer-aufbereiten\/"([^>]*)>(.*?)<\/a>', '<a$1href="/tierhaare-auto-entfernen/"$2><b>Tierhaare entfernen</b><span>Hund, Katze, Kofferraum</span><em>ab 69&nbsp;€</em></a>'),
]

# --- Anfragen: Zusätze aus anfragen_extra
fam = E.rq_item('famil', 'Familienpaket', 'Familienpaket', 'Innen &amp; Außen plus Tierhaare – günstiger als einzeln (174 €).', '169 €', E.FAMILIE_LIS, 'Ideal für Familienautos mit Hund oder Kindern.')
womob = E.rq_item('womob', 'Wohnmobil Basic', 'Wohnmobil Basic Innen &amp; Außen', 'Innen gesaugt und gewischt, außen von Hand gewaschen.', '245 €', ['Polster und Böden gesaugt, Oberflächen gewischt', 'Fahrerhaus wie bei einer Pkw-Innenreinigung', 'Außen Handwäsche, Fenster, Felgen'], 'Ohne Schränke, Küche und Bad im Detail.')
innen3 = (E.rq_item('sitz', 'Einzelner Sitz', 'Einzelner Sitz / Fleck', 'Ein Sitz oder eine Fleckenstelle, Sprühextraktion.', '49 €', ['Fleck vorbehandelt', 'Sitz tief gereinigt, trocknet vollständig'], 'Foto vom Fleck hilft für den festen Preis.')
          + E.rq_item('fleckgeruch', 'Fleck + Geruch', 'Fleck + Geruch', 'Alle Polster tiefengereinigt plus Ozon.', '119 €', ['Polster- und Sitzreinigung komplett', 'Ozonbehandlung gegen den Geruch'], 'Günstiger als einzeln (79 € + 59 €).')
          + E.rq_item('notfall', 'Notfall: Erbrochenes', 'Notfall: Erbrochenes', 'Betroffene Sitze und Teppiche, Desinfektion, Ozon.', '179 €', ['Betroffene Sitze und Teppiche', 'Desinfektion und Ozon'], 'Ruf am besten direkt an: 0170 6669516.'))
kers = (E.rq_item('spray', 'Handwäsche + Sprühversiegelung', 'Handwäsche + Sprühversiegelung', 'XPERTCOAT GRAPHENE SPRAY – schneller Schutz ohne Politur.', '119 €', ['Schonende Handwäsche mit Felgen', 'Sprühversiegelung auf Lack, Kunststoff und Scheiben'], 'Der günstige Einstieg in den Lackschutz.')
        + E.rq_item('kpflege', 'Keramik-Pflege', 'Keramik-Pflege (alle 2 Monate)', 'Handwäsche mit Reactivating Shampoo plus Auffrischung.', '79 €', ['Handwäsche mit Nanolex Reactivating Shampoo', 'Auffrischung mit XPERTCOAT GRAPHENE SPRAY'], 'Preis pro Termin, für Autos mit unserer Keramik.', ab=''))
ANF = rule_ops(E.ANFRAGEN) + [
 S('<div class="cc-rq__item" data-item="leasing">', fam + '<div class="cc-rq__item" data-item="leasing">'),
 R(r'(?s)(<div class="cc-rq__item" data-item="womo">.*?\n)(            <\/div>\n          <\/section>)', '$1            ' + php_repl(womob) + '$2'),
 S('<div class="cc-rq__item" data-item="polster">', innen3 + '<div class="cc-rq__item" data-item="polster">'),
 R(r'(?s)(<div class="cc-rq__item" data-item="scheiben">.*?)(<div class="cc-rq__item"|\n            <\/div>\n          <\/section>)', '$1' + php_repl(kers) + '$2'),
 S('data-base="inn innd basic ', 'data-base="inn innd basic famil ', 5),
 S('Antwort noch heute.', 'Antwort meist am selben Tag.', 1),
]

PAGES = {
 311: ('leistungen', LEIST), 780: ('auto-innenreinigung', rule_ops(E.INNEN)), 1116: ('geruch-im-auto-entfernen', GER),
 382: ('anfragen', ANF), 1115: ('wohnmobil-aufbereitung', rule_ops(E.WOHNMOBIL)), 1113: ('autopolitur', rule_ops(E.POLITUR)),
 1114: ('leasingrueckgabe-aufbereitung', rule_ops(E.LEASING)), 843: ('hol-und-bringservice', rule_ops(E.HOLBRING)),
}
BLOCK = {1062: rule_ops(E.SCHNELL)}

def emulate(h, ops):
    cnts = []
    for o in ops:
        if o['regex']:
            pat = re.compile(o['search'].replace(r'\/', '/'))
            rep = o['replace']
            def fn(m, rep=rep):
                out = re.sub(r'\$\{?(\d)\}?', lambda g: m.group(int(g.group(1))) or '', re.sub(r'\\\$', '\x00', rep))
                return out.replace('\x00', '$').replace('\\\\', '\\')
            h, n = pat.subn(fn, h, count=o['max'] if o['max'] > 0 else 0)
        else:
            n = h.count(o['search']); n = min(n, o['max']) if o['max'] > 0 else n
            h = h.replace(o['search'], o['replace'], o['max'] if o['max'] > 0 else -1)
        cnts.append(n)
    return h, cnts

if __name__ == '__main__':
    ok = True
    for pid, (name, ops) in PAGES.items():
        live = open(f'{D}/live_{name}.html', encoding='utf-8').read()
        h, c = emulate(live, ops)
        if name != 'anfragen' and 'ccQfSvc' in h: h, _ = emulate(h, BLOCK[1062])
        v2 = open(f'{D}/v2_{name}.html', encoding='utf-8').read().replace('<head><base href="https://carcura.info/">', '<head>', 1)
        same = (h == v2); ok &= same
        bad = [i for i, (n, o) in enumerate(zip(c, ops)) if n != o['max'] and o['max'] > 0]
        print(f'{pid} {name}: {len(ops)} Befehle, identisch mit Vorschau: {same}, Abweichende Trefferzahl: {bad}')
    json.dump({'pages': {str(k): v[1] for k, v in PAGES.items()}, 'blocks': {str(k): v for k, v in BLOCK.items()}}, open(f'{D}/ops.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('ALLES OK' if ok else 'ABWEICHUNG')
