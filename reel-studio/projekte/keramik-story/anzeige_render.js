// Rendert anzeige.html.
//   node anzeige_render.js standbilder <ordner> [zonen] t1 t2 …   → Prüfbilder (mit „zonen“: Schutzzonen rot markiert)
//   node anzeige_render.js video <ordner> <ziel.mp4> [ton.wav]
//   node anzeige_render.js quadrat <ziel.jpg>                      → 1:1-Angebotsbild (1080 × 1080), dazu .png
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const [, , modus, ...rest] = process.argv;
  const FPS = 30;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(__dirname, 'anzeige.html'));
  await p.waitForFunction('window.bereit === true', null, { timeout: 60000 });
  if (!(await p.evaluate('window.schriftOk'))) { console.error('Poppins nicht geladen – Abbruch'); process.exit(1); }
  const fehler = []; p.on('pageerror', e => fehler.push(e.message));
  if (modus === 'quadrat') {
    await p.setViewportSize({ width: 1080, height: 1080 });
    await p.evaluate(() => window.quadrat());
    const ziel = rest[0];
    await p.locator('canvas').screenshot({ path: ziel, type: 'jpeg', quality: 93 });
    await p.locator('canvas').screenshot({ path: ziel.replace(/\.jpg$/, '.png') });
    console.log('fertig:', ziel);
  } else {
    const ordner = rest.shift();
    fs.mkdirSync(ordner, { recursive: true });
    const dauer = await p.evaluate('window.DAUER');
    if (rest[0] === 'zonen') { rest.shift(); await p.evaluate(() => { window.ZONEN = true; }); }
    const zeiten = modus === 'video' ? Array.from({ length: Math.round(dauer * FPS) }, (_, i) => i / FPS) : rest.map(Number);
    for (let i = 0; i < zeiten.length; i++) {
      await p.evaluate(t => window.render(t), zeiten[i]);
      const name = modus === 'video' ? `f_${String(i).padStart(4, '0')}.jpg` : `t_${zeiten[i].toFixed(2).padStart(6, '0')}.jpg`;
      await p.screenshot({ path: path.join(ordner, name), type: 'jpeg', quality: 95 });
    }
    if (modus === 'video') {
      const [ziel, ton] = rest;
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(ordner, 'f_%04d.jpg'),
        ...(ton ? ['-i', ton] : []), '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
        ...(ton ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), '-movflags', '+faststart', ziel], { stdio: 'inherit' });
      console.log('fertig:', ziel, dauer, 's');
    }
  }
  if (fehler.length) console.log('Seitenfehler:', fehler);
  await b.close();
})();
