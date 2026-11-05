const {chromium}=require('playwright');const S=process.argv[2];
const P=[['/','Wir holen es auch ab',['Budget knapp','Innen + Tierhaare','muffiger Geruch','Alex & Richy']],
 ['/keramikversiegelung/','mit offenen Karten',['Unsere Zusage','Ergebnisse','Lohnt sich Keramik beim Neuwagen','Ergebnisse, keine Symbolbilder']],
 ['/autositz-reinigen-flecken/','Fleck im Autositz',['ab 49','Notfall: Erbrochenes','Macht ihr auch den Kindersitz']],
 ['/tierhaare-auto-entfernen/','Hundehaare im Auto',['ab 69','Familienpaket','119']],
 ['/leistungen/','Leistungen',['Familienpaket','Einzelner Sitz / Fleck','Keramik-Pflege','ab 800','Transporter oder Firmenwagen','XPERTCOAT HYBRID']],
 ['/auto-innenreinigung/','Innen',['Budget knapp','Leder & Lenkrad','Familienpaket · empfohlen','Van zum PKW-Preis']],
 ['/geruch-im-auto-entfernen/','Geruch',['Was Geruchsentfernung','ab 129','riecht muffig','Tierhaare entfernen']],
 ['/anfragen/','Anfrage senden',['Familienpaket','Notfall: Erbrochenes','Keramik-Pflege','Wohnmobil Basic','ab 800']],
 ['/wohnmobil-aufbereitung/','Wohnmobil',['800','245','Keramik fürs Wohnmobil']],
 ['/autopolitur/','polier',['Youngtimer','TT 8n']],
 ['/leasingrueckgabe-aufbereitung/','Leasing',['Eilig?','Ozon +39']],
 ['/hol-und-bringservice/','Hol',['Tobias']]];
(async()=>{const b=await chromium.launch();const v='?v='+Date.now();
for(const [u,h,keys] of P){const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let st=0;for(let i=0;i<3&&!st;i++){try{const r=await p.goto('https://carcura.info'+u+v,{waitUntil:'domcontentloaded',timeout:45000});st=r.status()}catch(e){await p.waitForTimeout(2000)}}
 await p.waitForTimeout(2500);
 const r=await p.evaluate((keys)=>{document.querySelectorAll('details').forEach(d=>d.open=true);const t=document.body.innerText;
  return {ov:document.documentElement.scrollWidth-innerWidth,miss:keys.filter(k=>!t.includes(k)),old:['Kindersitz und Gurt','immer erreichbar','Wir arbeiten mit Nanolex','ab 700 € umfasst'].filter(k=>t.includes(k)),
  qf:(document.getElementById('ccQfSvc')||{}).length||0,mini:document.querySelectorAll('.cc-wa-mini').length}},keys);
 console.log(st,u,'| fehlt:',JSON.stringify(r.miss),'| alt:',JSON.stringify(r.old),'| Überlauf:',r.ov,'| JS-Fehler:',errs.length,'| Formularoptionen:',r.qf,'| WA-Knöpfe:',r.mini);
 if(u==='/'){await p.evaluate(()=>scrollTo(0,0));await c.close();const c2=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const p2=await c2.newPage();await p2.goto('https://carcura.info/'+v,{waitUntil:'domcontentloaded'});await p2.waitForTimeout(2500);await p2.screenshot({path:S+'/live_check/home_live_390.png'});await c2.close();continue}
 await c.close();}
const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();
await p.goto('https://carcura.info/anfragen/?leistung=Familienpaket&leistung=Ozonbehandlung',{waitUntil:'domcontentloaded'});await p.waitForTimeout(3000);
const f=await p.evaluate(()=>({checked:[...document.querySelectorAll('input[name=leistung]:checked')].map(i=>i.value),sum:(document.body.innerText.match(/ab \d+ €\nWeiter/)||[''])[0]}));
console.log('FORMULAR',JSON.stringify(f));
await b.close()})();
