// Rendert animation.html Bild für Bild (Playwright) und setzt das Video mit ffmpeg zusammen.
// Aufruf:  node render.js standbilder <ordner>   → einige Prüfbilder
//          node render.js video <ordner> <ziel.mp4>
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const [, , modus = 'standbilder', ordner = 'ausgabe/bilder', ziel = 'ausgabe/keramik-erklaer.mp4'] = process.argv;
  const FPS = 30;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(__dirname, 'animation.html'));
  await p.waitForFunction('window.bereit === true', null, { timeout: 60000 });
  if (!(await p.evaluate('window.schriftOk'))) { console.error('Poppins nicht geladen – Abbruch'); process.exit(1); }
  let dauer = await p.evaluate('window.DAUER');
  // Mit Stimme: ausgabe/karte.json (von stimme.py) bildet Videozeit auf Animationszeit ab.
  const kartePfad = path.join(__dirname, 'ausgabe', 'karte.json');
  const karte = modus === 'video' && fs.existsSync(kartePfad) ? JSON.parse(fs.readFileSync(kartePfad, 'utf8')) : null;
  if (karte) dauer = karte.dauer;
  const animZeit = tv => {
    if (!karte) return tv;
    const k = karte.punkte;
    for (let i = 1; i < k.length; i++) if (tv <= k[i][0]) return k[i - 1][1] + (tv - k[i - 1][0]) / (k[i][0] - k[i - 1][0]) * (k[i][1] - k[i - 1][1]);
    return k[k.length - 1][1];
  };
  fs.mkdirSync(ordner, { recursive: true });
  const zeiten = modus === 'video'
    ? Array.from({ length: Math.round(dauer * FPS) }, (_, i) => animZeit(i / FPS))
    : [2.6, 5.0, 9.6, 13.7, 14.6, 18.3, 19.6, 21.2, 25.0];
  for (let i = 0; i < zeiten.length; i++) {
    await p.evaluate(t => window.render(t), zeiten[i]);
    const name = modus === 'video' ? `f_${String(i).padStart(4, '0')}.jpg` : `t_${zeiten[i].toFixed(1)}.jpg`;
    await p.screenshot({ path: path.join(ordner, name), type: 'jpeg', quality: 95 });
  }
  await b.close();
  if (modus === 'video') {
    const ton = path.join(__dirname, 'ausgabe', 'stimme.wav');
    const mitTon = karte && fs.existsSync(ton);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS),
      '-i', path.join(ordner, 'f_%04d.jpg'), ...(mitTon ? ['-i', ton] : []),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
      ...(mitTon ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), '-movflags', '+faststart', ziel], { stdio: 'inherit' });
    console.log('fertig:', ziel);
  } else console.log('Standbilder in', ordner);
})();
