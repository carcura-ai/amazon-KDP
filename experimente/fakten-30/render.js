// Rendert ein Fakten-Video: node render.js videos/001-venus [standbilder t1 t2 …]
// Liest video.html, skript.txt, woerter.json; schreibt video.mp4 (mit ton.wav, falls vorhanden).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
(async () => {
  const [, , ordnerArg, modus = 'video', ...zeitenArg] = process.argv;
  const ordner = path.resolve(__dirname, ordnerArg), FPS = 30;
  const skript = fs.readFileSync(path.join(ordner, 'skript.txt'), 'utf8');
  const norm = w => w.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');
  const satzWoerter = skript.trim().split('\n').map(z => z.split(/\s+/).filter(w => norm(w)).length);
  const daten = JSON.parse(fs.readFileSync(path.join(ordner, 'woerter.json'), 'utf8')); daten.satzWoerter = satzWoerter;
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const fehler = []; p.on('pageerror', e => fehler.push(e.message));
  await p.goto('file://' + path.join(ordner, 'video.html'));
  await p.waitForFunction('window.bereit === true', null, { timeout: 60000 });
  if (!(await p.evaluate('window.schriftOk'))) { console.error('Schrift fehlt'); process.exit(1); }
  await p.evaluate(([d, s]) => { document.querySelector('#skript').textContent = s; window.starte(d); }, [daten, skript]);
  const dauer = await p.evaluate('window.DAUER');
  const bilder = path.join(ordner, modus === 'video' ? '_bilder' : '_standbilder'); fs.mkdirSync(bilder, { recursive: true });
  const zeiten = modus === 'video' ? Array.from({ length: Math.round(dauer * FPS) }, (_, i) => i / FPS) : zeitenArg.map(Number);
  for (let i = 0; i < zeiten.length; i++) {
    await p.evaluate(t => window.render(t), zeiten[i]);
    await p.screenshot({ path: path.join(bilder, modus === 'video' ? `f_${String(i).padStart(4, '0')}.jpg` : `t_${zeiten[i].toFixed(1).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
  }
  await b.close();
  if (fehler.length) console.log('Seitenfehler:', fehler);
  if (modus === 'video') {
    const ton = path.join(ordner, 'ton.wav'), mit = fs.existsSync(ton);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(bilder, 'f_%04d.jpg'), ...(mit ? ['-i', ton] : []),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', ...(mit ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
      '-movflags', '+faststart', path.join(ordner, 'video.mp4')]);
    fs.rmSync(bilder, { recursive: true });
    console.log('fertig:', path.join(ordnerArg, 'video.mp4'), dauer.toFixed(1), 's');
  } else console.log('Standbilder:', bilder);
})();
