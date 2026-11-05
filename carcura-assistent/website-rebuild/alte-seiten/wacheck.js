const {chromium}=require('playwright');const S=process.argv[2];
(async()=>{const b=await chromium.launch();
const cases=[['prevwa_keramik.html','/keramikversiegelung/'],['prevwa_startseite.html','/'],['prevwa_flecken.html','/autositz-reinigen-flecken/']];
for(const [f,path] of cases){const p=await b.newPage({viewport:{width:390,height:844}});
 await p.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://carcura.info'+path)&&r.request().resourceType()==='document') return r.fulfill({body:require('fs').readFileSync(S+'/rebuild/'+f,'utf8'),contentType:'text/html'}); return r.continue();});
 await p.goto('https://carcura.info'+path,{waitUntil:'domcontentloaded'});await p.waitForTimeout(1500);
 const r=await p.evaluate(()=>({mini:document.querySelectorAll('.cc-wa-mini').length,ov:document.documentElement.scrollWidth-innerWidth,wa:[...document.querySelectorAll('a[href*="wa.me"]')].filter(a=>!a.classList.contains('cc-wa-mini')).map(a=>decodeURIComponent(a.href.split('text=')[1]||'').slice(0,45))}));
 console.log(path,JSON.stringify(r));await p.close();}
await b.close()})();
