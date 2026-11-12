// Rendert story.html Bild für Bild nach ausgabe/zeitplan.json (Playwright → JPEG) und setzt das Video zusammen.
// Aufruf:  node render.js standbilder <ordner> [t1 t2 …]   → Prüfbilder (ohne Zeitplan: Vorschau-Zeiten)
//          node render.js video <ordner> <ziel.mp4> [ton.wav]
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const [, , modus = 'standbilder', ordner = 'ausgabe/bilder', ...rest] = process.argv;
  const FPS = 30;
  const zp = path.join(__dirname, 'ausgabe', 'zeitplan.json');
  const zeitplan = fs.existsSync(zp) ? JSON.parse(fs.readFileSync(zp, 'utf8')) : null;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(__dirname, 'story.html'));
  await p.waitForFunction('window.bereit === true', null, { timeout: 60000 });
  if (!(await p.evaluate('window.schriftOk'))) { console.error('Poppins nicht geladen – Abbruch'); process.exit(1); }
  await p.evaluate(z => window.starte(z), zeitplan);
  const dauer = await p.evaluate('window.DAUER');
  fs.mkdirSync(ordner, { recursive: true });
  const zeiten = modus === 'video' ? Array.from({ length: Math.round(dauer * FPS) }, (_, i) => i / FPS) : rest.map(Number);
  for (let i = 0; i < zeiten.length; i++) {
    await p.evaluate(t => window.render(t), zeiten[i]);
    const name = modus === 'video' ? `f_${String(i).padStart(4, '0')}.jpg` : `t_${zeiten[i].toFixed(2).padStart(6, '0')}.jpg`;
    await p.screenshot({ path: path.join(ordner, name), type: 'jpeg', quality: 95 });
  }
  await b.close();
  if (modus === 'video') {
    const [ziel, ton] = rest;
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(ordner, 'f_%04d.jpg'),
      ...(ton ? ['-i', ton] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
      ...(ton ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), '-movflags', '+faststart', ziel], { stdio: 'inherit' });
    console.log('fertig:', ziel, dauer.toFixed(1), 's');
  } else console.log('Standbilder in', ordner);
})();
