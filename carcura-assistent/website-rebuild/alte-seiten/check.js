const {chromium}=require('playwright');const fs=require('fs');
const S=process.argv[2];
(async()=>{const b=await chromium.launch();
const pages=[['startseite',S+'/rebuild/prev_startseite.html'],['keramik',S+'/rebuild/prev_keramik.html'],['flecken',S+'/rebuild/prev_flecken.html'],['tierhaare',S+'/rebuild/prev_tierhaare.html'],
 ['leistungen',S+'/oldv2/v2_leistungen.html'],['auto-innenreinigung',S+'/oldv2/v2_auto-innenreinigung.html'],['geruch-im-auto-entfernen',S+'/oldv2/v2_geruch-im-auto-entfernen.html'],['anfragen',S+'/oldv2/v2_anfragen.html'],['wohnmobil-aufbereitung',S+'/oldv2/v2_wohnmobil-aufbereitung.html'],['autopolitur',S+'/oldv2/v2_autopolitur.html'],['leasingrueckgabe-aufbereitung',S+'/oldv2/v2_leasingrueckgabe-aufbereitung.html'],['hol-und-bringservice',S+'/oldv2/v2_hol-und-bringservice.html']];
for(const [n,f] of pages){
 const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(e.message));
 await p.route(/googletagmanager|google-analytics|complianz|cmplz/,r=>r.abort());
 await p.goto('file://'+f,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(2500);
 await p.addStyleTag({content:'.cmplz-cookiebanner,#cmplz-cookiebanner-container{display:none!important}.cc-rv{opacity:1!important;transform:none!important}'});
 const ov=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 await p.screenshot({path:S+'/r2shots/'+n+'_390.png'});
 const t=await p.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);const m=document.querySelector('main')||document.body;return m.innerText});
 fs.writeFileSync(S+'/r2txt/'+n+'.txt',t.replace(/\n{3,}/g,'\n\n'));
 console.log(n,'overflow',ov,'words',t.split(/\s+/).length,'jsErr',errs.length?errs.slice(0,2).join(' | '):0);
 await ctx.close();}
// Formular-Test
const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+S+'/oldv2/v2_anfragen.html?leistung=Familienpaket&leistung=Ozonbehandlung',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{const c=[...document.querySelectorAll('input[name=leistung]:checked')].map(i=>i.value);
 const tot=(document.querySelector('[class*=total]')||{}).innerText;const sum=[...document.querySelectorAll('[class*=sum],[class*=bar]')].map(e=>e.innerText.trim()).filter(Boolean).slice(0,3);
 return {checked:c,tot,sum,qf:!!document.getElementById('ccQfSvc'),opts:document.getElementById('ccQfSvc')?document.getElementById('ccQfSvc').options.length:0,sel:document.getElementById('ccQfSvc')?document.getElementById('ccQfSvc').value:''}});
console.log('FORM',JSON.stringify(r),'jsErr',errs.length?errs.join(' | '):0);
await b.close()})();
