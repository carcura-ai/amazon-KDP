"""Erzeugt wp-block.html (Einbau in die Startseite) aus index.html:
- three.js von der eigenen Domain (Mediathek), nicht von einem Fremdserver
- alle Selektoren mit #aktion davor (schlägt die .cx-Regeln der Startseite)
- Klassen, die auf der Startseite schon vorkommen (btn, sub, card, on, act, w), werden umbenannt
Aufruf: python3 build.py"""
import re
t=open('index.html',encoding='utf8').read()
css=re.search(r'<style>(.*?)</style>',t,re.S).group(1)
sec=re.search(r'<section class="cxa".*?</section>',t,re.S).group(0)
js=re.search(r'<script>(.*)</script>',t,re.S).group(1)
THREE='/wp-content/uploads/2026/11/three-r128.min_.js'
js=re.sub(r"var CXA_THREE_SRC='[^']*';","var CXA_THREE_SRC='"+THREE+"';",js)
js=js.replace("/* Sektion lädt three.js erst, wenn sie sichtbar wird. THREE_SRC: für die Website eigene Kopie der Datei hosten (Datenschutz), hier zum Ansehen der Vorschau ein öffentliches Netz. */","/* three.js (r128, MIT-Lizenz) liegt in der eigenen Mediathek und wird erst geladen, wenn die Sektion sichtbar wird. */")
js=js.replace("'on'","'cxon'").replace("'act'","'cxact'")
css=css.replace('.btn.p','.cxb.cxp').replace('.btn.g','.cxb.cxg')
for n,m in [('btn','cxb'),('sub','cxsub'),('card','cxcard'),('on','cxon'),('act','cxact'),('w','cxw')]:
    css=re.sub(r'(?<![\d-])\.'+n+r'(?![\w-])','.'+m,css)
css=re.sub(r'(?<![#\w-])\.cxa(?![\w-])','#aktion .cxa',css)
sec=sec.replace('class="btn p"','class="cxb cxp"').replace('class="btn g"','class="cxb cxg"').replace('class="sub"','class="cxsub"').replace('class="act"','class="cxact"').replace('class="card"','class="cxcard"').replace('class="w"','class="cxw"')
head="""<!-- Carcura: Aktion „Keramik buchen. Waschset geschenkt.“ (bis 31.12.2026). Erzeugt mit build.py, nicht von Hand ändern.
     Sektion blendet sich nach dem Enddatum (data-ende) selbst aus. Ohne WebGL oder bei reduzierter Bewegung gibt es eine ruhige Ersatzdarstellung. -->
"""
out=head+'<div id="aktion"><style>'+css+'</style>\n'+sec+'\n<script>'+js+'</script></div>\n'
open('wp-block.html','w',encoding='utf8').write(out)
print(len(out),'Zeichen; Reste von Klassennamen:',[n for n in ['class="btn','class="sub"','class="w"','class="card"'] if n in out])
