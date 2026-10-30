const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+process.cwd()+'/story.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);
const only=process.argv[2];
if(only){for(const t of only.split(',')){await p.evaluate(x=>render(x),+t);await p.screenshot({path:`prev_${t}.jpg`,type:'jpeg',quality:85});}await b.close();return;}
fs.mkdirSync('frames',{recursive:true});const fps=30,dur=10.5;
for(let i=0;i<Math.round(fps*dur);i++){await p.evaluate(x=>render(x),i/fps);await p.screenshot({path:`frames/f${String(i).padStart(4,'0')}.png`});}
await b.close();})();
