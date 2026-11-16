import re, json, html as H
SRC='/home/user/amazon-KDP/carcura-assistent/website-rebuild/vorschau-ohne-bilder/startseite-vorschau.html'
OUT='/tmp/claude-0/-home-user-amazon-KDP/05a5920d-0489-595a-9733-bd44e80f2893/scratchpad/gen/'
src=open(SRC,encoding='utf-8').read()
css=src[src.index('<style>')+7:src.index('</style>')]

# ---------- CSS: entfernen was die Startseite nicht braucht, dann scopen ----------
css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
SYS='ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'
css=re.sub(r'--f1:[^;]+;--f2:[^;]+;','--f1:%s;--f2:%s;'%(SYS,SYS),css)

def split_rules(s):
    out=[];i=0;n=len(s)
    while i<n:
        j=s.find('{',i)
        if j<0:break
        sel=s[i:j].strip();d=1;k=j+1
        while d and k<n:
            if s[k]=='{':d+=1
            elif s[k]=='}':d-=1
            k+=1
        out.append((sel,s[j+1:k-1]));i=k
    return out

DROP=('.chips','.chip','.grid','.t','.lb','.glogo','.spec','.sw','footer','.mbar','.pat.p-leist','.p-leist','.p-innen','.p-pol','.p-kera','.p-wom','.p-orte','.p-firm','.p-gal')
KEYF={'sweep','spin','rise','zoom','up','mq','draw','drift','tw','glint','beam','kb','ltp','ltg','pop'}
def pref(sel):
    parts=[]
    for p in sel.split(','):
        p=p.strip()
        if p in('html','html,body'):continue
        if p=='body':p='.cx'
        elif p=='body::after':p='.cx::after'
        elif p==':root':p='.cx'
        elif p=='html' :continue
        elif p.startswith('*'):p='.cx '+p if False else p
        elif p=='[hidden]':p='.cx [hidden]'
        else:p='.cx '+p
        parts.append(p)
    return ','.join(parts)
def conv(rules):
    o=[]
    for sel,body in rules:
        if sel.startswith('@media'):
            inner=conv(split_rules(body))
            if inner:o.append(sel+'{'+inner+'}')
        elif sel.startswith('@keyframes'):
            nm=sel.split()[1];o.append('@keyframes cx-'+nm+'{'+body+'}')
        else:
            if sel=='*,*::before,*::after':o.append('.cx,.cx *,.cx *::before,.cx *::after{'+body+'}');continue
            toks=[t.strip() for t in sel.split(',')]
            if all(any(t==d or t.startswith(d+' ') or t.startswith(d+'.') or t.startswith(d+':') or t.startswith(d+'>') or t.startswith(d+'[') or t.startswith(d+'-') for d in DROP) for t in toks):continue
            toks=[t for t in toks if not any(t==d or t.startswith(d+' ') or t.startswith(d+':') or t.startswith(d+'.') for d in DROP)]
            ps=pref(','.join(toks))
            if ps:o.append(ps+'{'+body+'}')
    return ''.join(o)
css=conv(split_rules(css))
for k in KEYF:
    css=re.sub(r'(animation(?:-name)?:[^;}]*?)(?<![\w-])'+k+r'(?![\w-])',lambda m:m.group(1)+'cx-'+k,css)
# animation-Kurzschreibung mit mehreren Animationen (z. B. zoom ...,kb ...)
css=re.sub(r'(?<=,)(kb)(?=\s)','cx-kb',css)
css=css.replace('.cx::after{content','.cx::before{content',1) if False else css
css=re.sub(r'\s+',' ',css)
css=re.sub(r'\s*([{};,>])\s*',r'\1',css)
css=css.replace(';}','}')
css=css.replace('.cx.cx','.cx')
EXTRA='''
.cx{position:relative;isolation:isolate;overflow-x:clip;clip-path:inset(0);text-align:left;background:var(--ink);color:var(--txt)}
.cx .bg{position:fixed}
.cx a{color:inherit}.cx .btn-p{color:var(--ink)}.cx .lt .btn-p{color:#f2efe7}
.cx h1,.cx h2,.cx h3{color:inherit;text-align:left}.cx p,.cx li,.cx summary{text-align:left}
.cx .gal,.cx .gal *{text-align:center}
.cx .hero h1 .h1s{display:block;margin-top:6px;font-size:.42em;font-weight:500;letter-spacing:0;color:var(--gold)}
.cx .ort{display:flex;flex-wrap:wrap;gap:8px 10px;margin-top:6px}.cx .ort a{padding:8px 14px;border:1px solid var(--line);border-radius:999px;text-decoration:none;font-size:.84rem;color:var(--muted);transition:border-color .25s,color .25s}.cx .ort a:hover{border-color:var(--gold);color:var(--txt)}
.cx .more2{display:inline-block;margin-top:10px;color:var(--gold);font-size:.82rem;text-decoration:none;border-bottom:1px solid currentColor}
.cx .nav .menu{display:none;position:relative}.cx .nav .menu summary{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid var(--line);border-radius:12px;padding:0;font-size:1.2rem}.cx .nav .menu summary::after{content:none}
.cx .nav .menu nav{position:absolute;right:0;top:52px;min-width:230px;padding:10px;display:grid;background:rgba(7,7,10,.97);border:1px solid var(--line);border-radius:14px}.cx .nav .menu nav a{padding:12px;text-decoration:none;color:var(--txt);border-radius:8px}.cx .nav .menu nav a:hover{background:rgba(203,191,148,.1)}
.cx .nav .r{display:flex;align-items:center;gap:10px}
@media(max-width:62rem){.cx .nav .menu{display:block}}
body.home #navigation{display:none!important}
.cx .hero .lead2{max-width:52ch;font-size:.9rem;color:#c9cad0}
'''
css=css+re.sub(r'\n','',EXTRA)

# ---------- Inhalt ----------
WA='https://wa.me/491706669516?text=Hallo%20Carcura%2C%20ich%20h%C3%A4tte%20gern%20einen%20Preis.%0AAuto%3A%20%0AWas%20soll%20gemacht%20werden%3A%20%0AOrt%3A%20'
WAB='https://wa.me/491706669516?text=Hallo%20Carcura%2C%20mein%20Budget%3A%20%E2%80%A6%20%E2%82%AC.%0AAuto%3A%20%0AWichtig%20ist%20mir%3A%20'
PREISE=[
('Innenreinigung','Aussaugen, Armaturen, Fußmatten, Tornador',90,'/auto-innenreinigung/','Innenreinigung im Detail',
 ['Gründliches Aussaugen des Innenraums','Armaturen und Verkleidungen sauber','Fußmatten sauber: Mit dem Tornador holen wir auch tiefsitzenden Schmutz wie Sand aus dem Stoff','Sitze abgewischt','Scheiben innen'],
 ['Polster- und Sitzreinigung (Nassreinigung)','Fleckentfernung','Tierhaare','Geruchsbehandlung'],'Als Zusatz einzeln buchbar.'),
('Innen + außen','Innenreinigung plus Handwäsche mit Felgen',145,'/auto-innenreinigung/#pakete','Pakete ansehen',
 ['Alles aus der Innenreinigung','Vorwäsche mit Schaum und schonende Handwäsche','Felgen und Reifen','Scheiben außen','Trocknung'],
 ['Polster- und Sitzreinigung','Politur'],'Als Zusatz einzeln buchbar.'),
('Innen + Tierhaare','Innenreinigung plus Tierhaarentfernung',119,'/tierhaare-auto-entfernen/','Tierhaare aus dem Auto entfernen',
 ['Alles aus der Innenreinigung','Tierhaare aus Sitzen, Teppich und Kofferraum'],
 ['Polster- und Sitzreinigung','Außenwäsche'],'Als Zusatz einzeln buchbar.'),
('Fleck im Sitz','Ein Sitz, Fleck nass gereinigt',49,'/autositz-reinigen-flecken/','Autositz reinigen und Flecken entfernen',
 ['Ein Sitz oder eine Fleckenstelle','Tiefenreinigung mit Sprühextraktion','Fester Preis nach Foto'],
 ['Weitere Sitze (Polster- und Sitzreinigung ab 79 €)'],''),
('Politur','Glanz zurück, leichte Kratzer raus',349,'/autopolitur/','Autopolitur im Detail',
 ['Handwäsche und Kneten des Lacks','Einstufige Maschinenpolitur am ganzen Fahrzeug'],
 ['Starke Kratzer: dafür die 2-stufige Lackkorrektur (ab 549 €)','Keramikversiegelung'],''),
('Keramikversiegelung','Inkl. Politur und Pflegeset',700,'/keramikversiegelung/','Keramikversiegelung im Detail',
 ['Handwäsche und Kneten','Einstufige Politur','Keramikversiegelung XPERTCOAT HYBRID','Nanolex-Pflegeset','Kostenlose Nachkontrolle nach 6 Monaten'],
 ['2-stufige Politur (Keramik dann ab 900 €)'],'')]
REV=[('War heute mit meinem Audi A7 dort. Ich bin sehr begeistert von der innenraum aufbereitung. Sieht aus wie ein neuwagen. Ausserdem mega sympathischer Chef. Ich komme auf jeden fall wieder und kann es nur weiterempfehlen.','Audi A7, Innenraumaufbereitung, Nov. 2026'),('… super beeindruckend was die jungs aus meinem alten lack rausgeholt haben und die keramikversieglung ist wirklich ein MUSS.','Audi TT 8n, Politur und Keramik, Nov. 2026'),('… sie haben mein Auto wieder zum glänzen gebracht, von innen – sowie außen. Professionell, detailverliebt, präzise, kompetent, zuverlässig …','Nina, BMW 1er innen und außen, Okt. 2026'),('Nach Terminabsprache wurde das Fahrzeug pünktlich geholt und sogar schneller gebracht als abgesprochen. Gerne wieder','Tobias, Hol- und Bringservice, Aug. 2026'),('Unser Kuga war bei Alex in den besten Händen. Weiter so.','Elke R., Ford Kuga, Okt. 2026'),('Hab ein Fahrzeug mit einigen KM auf dem Buckel aufbereiten lassen und das Ergebnis ist einfach klasse geworden.','Jan M., Aufbereitung, Okt. 2026'),('Schnelle und saubere Arbeit zum Fairen Preis. Sehr zufrieden gerne wieder!','Merlin, Okt. 2026')]
e=H.escape
def eur(n):return '%d&nbsp;€'%n
tick=''.join('<a href="%s"><span>%s</span><b>ab %d&nbsp;€</b><i>✦</i></a>'%(p[3],e(p[0]),p[2]) for p in PREISE)
pl=''
for n,d,pr,url,lt,ok,no,zus in PREISE:
    pl+='<li><details><summary><span class="n">%s</span><span class="d">%s</span><span class="more">Leistungsumfang</span><span class="p"><small>ab</small><span data-to="%d">%d</span>&nbsp;€</span></summary><div class="sc"><div><b>Enthalten</b><ul class="ok">%s</ul></div><div><b>Nicht enthalten</b><ul class="no">%s</ul>%s</div></div><div class="sc" style="padding-top:0"><a class="more2" href="%s">%s</a> <a class="more2" style="margin-left:14px" href="/anfragen/">Anfrage senden</a></div></details></li>'%(
        e(n),e(d),pr,pr,''.join('<li>%s</li>'%e(x) for x in ok),''.join('<li>%s</li>'%e(x) for x in no),('<p>%s</p>'%e(zus) if zus else ''),url,e(lt))
def rc(rs,hid=False):
    return ''.join('<figure class="rv-c glass"%s><div><span class="s" aria-label="5 Sterne">★★★★★</span><blockquote>„%s“</blockquote></div><figcaption>%s</figcaption></figure>'%(' aria-hidden="true"' if hid else '',e(a),e(b)) for a,b in rs)
FAQ=[('Was kostet eine Aufbereitung bei euch?','Die Innenreinigung beginnt bei 90 €, innen und außen bei 145 €, das Familienpaket mit Tierhaaren bei 169 €. Den festen Preis für dein Auto bekommst du vorher – am schnellsten mit 2–3 Fotos per WhatsApp.'),
('Wie schnell bekomme ich einen Termin?','Meist innerhalb von 1–2 Wochen, auch abends und samstags. Bei Notfällen wie Erbrochenem melde dich direkt – wir schauen, wie schnell es geht.'),
('Muss ich mein Auto nach Walterschen bringen?','Nein. Im Umkreis von 10 km holen wir kostenlos ab, weiter entfernt für 2 € pro zusätzlichem Kilometer.'),
('Wann bezahle ich?','Bis 500 € erst bei der Übergabe – mit Karte oder auf Rechnung. Ab 500 € zahlst du 50 % bei der Terminbestätigung an, den Rest bei der Übergabe.'),
('Kann ich einen Termin absagen?','Ja, bis 48 Stunden vorher kostenlos. Sagst du später ab, berechnen wir 50 % des vereinbarten Preises – außer bei Unvorhersehbarem wie Krankheit oder Unfall. Du kannst nachweisen, dass uns kein oder ein geringerer Schaden entstanden ist. Dein gesetzliches Widerrufsrecht bleibt unberührt.'),
('Geht jeder Fleck raus?','Die meisten ja. Ob ein Fleck ganz verschwindet, hängt von Material, Alter und Ursache ab. Nach einem Foto sagen wir dir ehrlich, was realistisch ist.')]
faq=''.join('<details><summary>%s</summary><p>%s</p></details>'%(e(q),e(a).replace(' €','&nbsp;€').replace(' km','&nbsp;km').replace(' %','&nbsp;%').replace(' Stunden','&nbsp;Stunden')) for q,a in FAQ)

NAV=[('/','Start'),('/leistungen/','Leistungen'),('/galerie/','Galerie'),('/hol-und-bringservice/','Hol- &amp; Bringservice'),('/firmenkunde/','Händler &amp; Firmen'),('/partner/','Partner'),('/ueber-uns/','Über uns')]
nav_links=''.join('<a href="%s">%s</a>'%(u,t) for u,t in NAV)
body='''<div class="cx">
<div class="bg" aria-hidden="true"><div class="pat p-home"></div><div class="orbs"><div class="orb o1"><i></i></div><div class="orb o2"><i></i></div><div class="orb o3"><i></i></div><div class="orb o4"><i></i></div></div><div class="beams"><i></i><i></i><i></i></div><div class="sp" id="cxsp"></div></div>
<div class="prog" aria-hidden="true"></div>
<header class="nav"><div class="w">
<a class="brand" href="/" aria-label="Carcura Startseite"><img src="https://carcura.info/wp-content/uploads/2026/11/carcura-logo-weiss.webp" alt="Carcura Fahrzeugaufbereitung Westerwald" width="60" height="30"></a>
<nav class="links" aria-label="Hauptmenü">%(nav)s</nav>
<div class="r"><a class="btn btn-p" href="/anfragen/">Anfragen</a><details class="menu"><summary aria-label="Menü öffnen">☰</summary><nav aria-label="Mobiles Menü">%(nav)s</nav></details></div>
</div></header>
<main>
<section class="hero" aria-labelledby="cxh1">
<img src="https://carcura.info/wp-content/uploads/2026/10/carcura-team-alexander-richy.webp" alt="Alex und Richy von Carcura, Fahrzeugaufbereitung in Walterschen im Westerwald" width="1136" height="1280" fetchpriority="high"><i class="gl" aria-hidden="true"></i>
<div class="w">
<span class="orn rv">Walterschen bei Altenkirchen · Westerwald</span>
<h1 id="cxh1">Fahrzeugaufbereitung<span class="h1s">im Westerwald</span></h1>
<p class="sub">Von Hand in unserer Halle: <span class="rot">innen</span>. Wir holen dein Auto auch ab.</p>
<div class="act"><a class="btn btn-p" href="%(wa)s" data-wa-service="allgemein">Preis per WhatsApp</a><a class="btn btn-g" href="tel:+491706669516">0170 6669516</a></div>
<p class="who"><span class="stars" aria-hidden="true">★★★★★</span> 4,8 aus 18 Google-Bewertungen · <a href="%(wab)s" data-wa-service="Budget-Anfrage">Budget knapp? Schreib uns deinen Betrag</a></p>
</div></section>
<div class="tick" aria-label="Preise im Überblick"><div id="cxtk">%(tick)s</div></div>

<section class="lt"><div class="w">
<div class="head rv"><span class="orn">Preise</span><h2>Preise für Autoaufbereitung im Westerwald</h2><p class="lead">Fester Preis vor dem Termin, meist noch am selben Tag.</p></div>
<div class="glass rv"><ul class="pl">%(pl)s</ul></div>
<div class="foot rv"><p>Endpreise, ohne Umsatzsteuer (Kleinunternehmer, § 19&nbsp;UStG). Gleicher Ab-Preis für PKW, Kombi und Van. Ab 500&nbsp;€ mit 50&nbsp;% Anzahlung.</p><a class="btn btn-g" href="/leistungen/">Alle Leistungen &amp; Preise</a></div>
</div></section>

<section><div class="w">
<div class="head rv"><span class="orn">Leistungen</span><h2>Innenreinigung, Politur, Keramikversiegelung</h2><p class="lead" style="max-width:62ch">Carcura ist deine Autoaufbereitung im Westerwald: von Hand in der Halle in Walterschen bei Altenkirchen. Unsicher? Schick 2–3 Fotos, wir sagen dir, was nötig ist.</p></div>
<div class="cards">
<a class="card glass rv" href="/auto-innenreinigung/"><svg viewBox="0 0 72 72" aria-hidden="true"><path pathLength="1" d="M18 54V34C18 22 26 14 36 14s18 8 18 20v20M12 54h48M26 30h20M26 40h20"/></svg><div><h3>Einfach wieder sauber</h3><p>Innenreinigung, außen oder beides.</p><b>Familienpaket ab 169&nbsp;€</b></div></a>
<a class="card glass rv" style="--d:.1s" href="/autositz-reinigen-flecken/"><svg viewBox="0 0 72 72" aria-hidden="true"><path pathLength="1" d="M36 10S18 30 18 42c0 10 8 18 18 18s18-8 18-18C54 30 36 10 36 10ZM28 44c0 4 3 8 8 8"/></svg><div><h3>Fleck, Haare, Geruch</h3><p>Auch Notfälle wie Erbrochenes.</p><b>Fleck + Geruch ab 119&nbsp;€</b></div></a>
<a class="card glass rv" style="--d:.2s" href="/keramikversiegelung/"><svg viewBox="0 0 72 72" aria-hidden="true"><path pathLength="1" d="M36 8l6 22 22 6-22 6-6 22-6-22L8 36l22-6ZM56 10l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/></svg><div><h3>Politur &amp; Keramik</h3><p>Bis zu 5 Jahre Schutz laut Hersteller.</p><b>Keramik ab 700&nbsp;€</b></div></a>
</div></div></section>

<section id="ablauf" style="padding-top:0"><div class="w">
<div class="head rv"><span class="orn">Ablauf</span><h2>In drei Schritten zum sauberen Auto</h2></div>
<div class="bar"><i id="cxbar"></i></div>
<ol class="steps">
<li class="rv"><b>1</b><h3>Anfragen</h3><p>Foto per WhatsApp, du bekommst einen festen Preis.</p></li>
<li class="rv" style="--d:.12s"><b>2</b><h3>Termin</h3><p>Meist in 1–2 Wochen, auch abends und samstags.</p></li>
<li class="rv" style="--d:.24s"><b>3</b><h3>Gepflegt zurück</h3><p>Bezahlt wird bei der Übergabe, ab 500&nbsp;€ mit Anzahlung.</p></li>
</ol></div></section>

<section style="padding-top:0"><div class="w row"><div class="head rv" style="margin:0"><span class="orn">Bewertungen</span><h2><span data-to="4.8" data-dec="1">4,8</span> von 5 bei Google</h2><p class="lead">18 Bewertungen, genau so, wie sie bei Google stehen.</p></div><a class="btn btn-g rv" href="https://maps.google.com/maps?cid=13912678674450594421" target="_blank" rel="noopener">Alle Bewertungen</a></div>
<div class="rev"><div id="cxr1">%(r1)s</div></div><div class="rev r2"><div id="cxr2">%(r2)s</div></div>
</section>

<section id="hol" class="lt"><div class="w">
<div class="head rv"><span class="orn">Hol- &amp; Bringservice</span><h2>Abholen bis 10 km kostenlos</h2><p class="lead">Wir holen dein Auto in Altenkirchen und Umgebung ab und bringen es zurück. <a href="/hol-und-bringservice/" style="color:var(--gold)">So funktioniert der Hol- &amp; Bringservice</a></p></div>
<div class="road rv" id="cxroad"><div class="l"></div><div class="f" id="cxrf"></div>
<span class="o" style="left:96%%"></span>
<span class="c" id="cxrc" aria-hidden="true">🚗</span><span class="tl" style="left:7%%">Walterschen</span><span class="tl" style="left:90%%;color:var(--gold)">10 km · kostenlos</span></div>
<div class="ort" aria-label="Einsatzgebiet"><a href="/fahrzeugaufbereitung-altenkirchen/">Altenkirchen</a><a href="/fahrzeugaufbereitung-hachenburg/">Hachenburg</a><a href="/fahrzeugaufbereitung-asbach/">Asbach</a><a href="/fahrzeugaufbereitung-wissen/">Wissen</a><a href="/fahrzeugaufbereitung-neuwied/">Neuwied</a><a href="/fahrzeugaufbereitung-westerwald/">Westerwald</a></div>
</div></section>

<section class="gsec"><div class="w"><a class="gal glass rv" href="/galerie/"><h2>Carcura Galerie</h2><p>Fotos und Videos aus unserer Halle.</p><span class="btn btn-p">Galerie ansehen</span></a></div></section>

<section class="lt"><div class="w faq">
<div class="rv"><span class="orn">Fragen</span><h2 style="margin-top:10px">Häufige Fragen zur Fahrzeugaufbereitung</h2></div>
<div class="rv">%(faq)s</div>
</div></section>

<section style="padding-bottom:0"><div class="w"><div class="head rv" style="margin:0"><span class="orn">Außerdem</span><h2>Mehr von Carcura</h2></div>
<div class="ort" style="margin-top:16px"><a href="/leasingrueckgabe-aufbereitung/">Leasingrückgabe</a><a href="/wohnmobil-aufbereitung/">Wohnmobil</a><a href="/scheinwerfer-aufbereiten/">Scheinwerfer</a><a href="/geruch-im-auto-entfernen/">Geruch entfernen</a><a href="/autopolitur/">Autopolitur</a><a href="/keramikversiegelung/">Keramikversiegelung</a><a href="/gutschein/">Gutschein</a><a href="/firmenkunde/">Händler &amp; Firmen</a><a href="/ueber-uns/">Über uns</a></div></div></section>

<section class="cta"><div class="w">
<div class="rv"><span class="orn">Kontakt</span><h2 style="margin-top:10px">Schreib uns kurz. Du bekommst einen festen Preis.</h2><p class="lead" style="margin-top:10px">Per WhatsApp, Telefon oder Formular. Fotos helfen, sind aber kein Muss.</p><p class="lead" style="margin-top:8px;font-size:.84rem">Carcura GbR · Hauptstr. 7 · 57632 Walterschen · <a href="tel:+491706669516">+49 170 6669516</a></p></div>
<div class="a rv"><a class="btn btn-p" href="%(wa)s" data-wa-service="allgemein">Foto per WhatsApp</a><a class="btn btn-g" href="/anfragen/">Anfrage senden</a></div>
</div></section>
</main>
<script>%(js)s</script>
</div>'''
JS='''(function(){var d=document,$=function(s){return d.querySelector(s)},$$=function(s){return[].slice.call(d.querySelectorAll(s))};
var rd=matchMedia('(prefers-reduced-motion: reduce)').matches;
[['cxtk'],['cxr1'],['cxr2']].forEach(function(a){var el=d.getElementById(a[0]);if(!el)return;var c=el.cloneNode(true);c.removeAttribute('id');c.setAttribute('aria-hidden','true');[].forEach.call(c.querySelectorAll('a'),function(x){x.tabIndex=-1});el.insertAdjacentHTML('beforeend',c.innerHTML);});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8%% 0px',threshold:.06});
$$('.cx .rv,.cx .road').forEach(function(el){io.observe(el)});
var co=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;co.unobserve(e.target);var el=e.target,to=+el.dataset.to,dec=+(el.dataset.dec||0),t0=performance.now();(function f(t){var p=Math.min(1,(t-t0)/1100),v=to*(1-Math.pow(1-p,3));el.textContent=dec?v.toFixed(dec).replace('.',','):Math.round(v);if(p<1)requestAnimationFrame(f)})(t0)})},{threshold:.7});
if(!rd)$$('.cx [data-to]').forEach(function(el){el.textContent=el.dataset.dec?'0,0':'0';co.observe(el)});
var W=['innen','außen','poliert','versiegelt'],wi=0,rot=$('.cx .rot');if(rot)if(!rd)setInterval(function(){rot.classList.add('out');setTimeout(function(){wi=(wi+1)%%W.length;rot.textContent=W[wi];rot.classList.remove('out')},350)},2500);
var prog=$('.cx .prog'),bar=$('#cxbar'),rf=$('#cxrf'),car=$('#cxrc'),road=$('#cxroad'),ab=$('#ablauf'),bg=$('.cx .bg');
function pr(el,a,b){var r=el.getBoundingClientRect(),h=innerHeight;return Math.max(0,Math.min(1,(h*a-r.top)/(h*b)))}
function onS(){var de=d.documentElement,mx=de.scrollHeight-innerHeight;prog.style.transform='scaleX('+(mx>0?scrollY/mx:0)+')';bar.style.transform='scaleX('+pr(ab,.85,.4)+')';var p=pr(road,.9,.45);rf.style.width=(p*96)+'%%';car.style.left=(4+p*92)+'%%';bg.style.setProperty('--sy',scrollY)}
addEventListener('scroll',function(){requestAnimationFrame(onS)},{passive:true});onS();
var s=$('#cxsp'),n=innerWidth<700?14:30,h='',i;for(i=0;i<n;i++){h+='<i style="left:'+(Math.random()*100).toFixed(1)+'%%;top:'+(Math.random()*100).toFixed(1)+'%%;--s:'+(2+Math.random()*3).toFixed(1)+'px;--d:'+(6+Math.random()*7).toFixed(1)+'s;--l:-'+(Math.random()*10).toFixed(1)+'s"></i>'}s.innerHTML=h;
d.addEventListener('pointermove',function(e){if(e.pointerType!=='mouse')return;var g=e.target.closest?e.target.closest('.cx .glass'):null;if(!g)return;var r=g.getBoundingClientRect();g.style.setProperty('--mx',(e.clientX-r.left)+'px');g.style.setProperty('--my',(e.clientY-r.top)+'px')},{passive:true});
})();'''
JS=JS.replace('%%','%')
bodyhtml=body
for k,v in dict(nav=nav_links,wa=WA,wab=WAB,tick=tick,pl=pl,r1=rc(REV[:3]),r2=rc(REV[3:]),faq=faq,js='@@JS@@').items(): bodyhtml=bodyhtml.replace('%('+k+')s',v)
bodyhtml=bodyhtml.replace('%%','%')
# JS enthält kein & (WordPress wandelt & in wp:html um) – prüfen
assert '&' not in JS, 'JS enthält &'
bodyhtml=bodyhtml.replace('@@JS@@',JS)
open(OUT+'css.txt','w').write(css)
open(OUT+'body.html','w').write(bodyhtml)
print(len(css),len(bodyhtml))

# ---------- JSON-LD + Gesamtinhalt ----------
SV=['Innenraumreinigung','Innenraumreinigung detailliert','Ozonbehandlung','Schonende Handwäsche','Basic Innen und Außen','Verkaufs- und Leasingrückgabe-Paket','1-stufige Politur','2-stufige Politur','Scheinwerferaufbereitung','Keramikversiegelung','Wohnmobil-Komplettreinigung','Familienpaket – Innen, Außen und Tierhaare','Polster- und Sitzreinigung','Tierhaarentfernung','Notfall-Reinigung im Innenraum','Keramik-Pflege']
UP='https://carcura.info/wp-content/uploads/'
ld={"@context":"https://schema.org","@type":["AutomotiveBusiness","LocalBusiness"],"@id":"https://carcura.info/#business","name":"Carcura","alternateName":["Carcura Fahrzeugaufbereitung","Carcura Autoaufbereitung"],"legalName":"Carcura GbR","founder":[{"@type":"Person","name":"Alexander Fuchs"},{"@type":"Person","name":"Richy Schumacher"}],
"description":"Carcura ist deine Autoaufbereitung im Westerwald: Innenreinigung, Familienpaket, Flecken- und Polsterreinigung, Tierhaare, Geruchsentfernung, Handwäsche, Politur und Keramikversiegelung – von Hand in der Halle in Walterschen bei Altenkirchen, auf Wunsch mit Hol- und Bringservice.",
"url":"https://carcura.info/","telephone":"+49 170 6669516","email":"carcura@web.de","priceRange":"€€","paymentAccepted":"Kreditkarte, Debitkarte, Rechnung, Vorkasse",
"image":[UP+'2026/10/carcura-team-alexander-richy.webp',UP+'2026/11/carcura-audi-tt-politur-keramik-walterschen.webp',UP+'2026/11/carcura-weisser-lack-halle-glanz.webp'],
"address":{"@type":"PostalAddress","streetAddress":"Hauptstr. 7","postalCode":"57632","addressLocality":"Walterschen","addressRegion":"Rheinland-Pfalz","addressCountry":"DE"},
"areaServed":[{"@type":"City","name":n} for n in ['Walterschen','Altenkirchen','Weyerbusch','Flammersfeld','Asbach','Hachenburg','Wissen','Neuwied']]+[{"@type":"AdministrativeArea","name":"Westerwald"}],
"sameAs":["https://www.instagram.com/_carcura_/","https://www.tiktok.com/@_carcura_","https://maps.google.com/maps?cid=13912678674450594421"],"hasMap":"https://maps.google.com/maps?cid=13912678674450594421",
"openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday"],"opens":"17:00","closes":"22:00"},{"@type":"OpeningHoursSpecification","dayOfWeek":"Friday","opens":"14:00","closes":"21:00"},{"@type":"OpeningHoursSpecification","dayOfWeek":"Saturday","opens":"08:00","closes":"20:00"}],
"hasOfferCatalog":{"@type":"OfferCatalog","name":"Leistungen der Autoaufbereitung","itemListElement":[{"@type":"Offer","itemOffered":{"@type":"Service","name":s,"serviceType":"Fahrzeugaufbereitung"}} for s in SV]},
"potentialAction":{"@type":"ReserveAction","target":{"@type":"EntryPoint","urlTemplate":"https://carcura.info/anfragen/","actionPlatform":["http://schema.org/DesktopWebPlatform","http://schema.org/MobileWebPlatform"]},"result":{"@type":"Reservation","name":"Terminanfrage Autoaufbereitung"}}}
ldj=json.dumps(ld,ensure_ascii=False,separators=(',',':'))
assert '&' not in ldj
html_block='<style>'+css+'</style>\n<script type="application/ld+json">'+ldj+'</script>\n'+bodyhtml
open(OUT+'htmlblock.html','w').write(html_block)
print('htmlblock',len(html_block))
