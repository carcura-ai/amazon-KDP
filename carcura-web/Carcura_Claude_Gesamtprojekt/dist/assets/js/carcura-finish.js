(() => {
  const opening = document.querySelector('.studio-opening');
  if (!opening) return;

  const frames = JSON.parse(document.querySelector('#studio-frames').textContent);
  const pictures = [...opening.querySelectorAll('.studio-picture img')];
  const [base, overlay] = pictures;
  const buttons = [...opening.querySelectorAll('[data-shot]')];
  const label = opening.querySelector('.studio-label');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pending = new Map();
  let active = 0;
  let animation;

  function prepare(index) {
    if (!pending.has(index)) {
      const image = new Image();
      image.src = frames[index].src;
      pending.set(index, image.decode().then(() => image.src, error => {
        pending.delete(index);
        throw error;
      }));
    }
    return pending.get(index);
  }

  let sequence = 0;
  async function show(index) {
    const request = ++sequence;
    const frame = frames[index];
    let src;
    try {
      src = await prepare(index);
    } catch {
      if (request === sequence) label.textContent = 'Dieses Kapitel konnte nicht geladen werden.';
      return;
    }
    if (request !== sequence) return;

    animation?.cancel();
    base.src = frames[active].src;
    overlay.src = src;
    overlay.style.opacity = '1';
    /* Gleiche Kamera: Waschzustände 0–3, Innen 6/7, Politur 8/9. 12/13 (Wasser/Perlen) haben laut Bildvergleich eine andere Perspektive, daher Schnitt. */
    const sameView = (active < 4 && index < 4) || [6, 8].some(start =>
      Math.min(active, index) === start && Math.max(active, index) === start + 1
    );
    active = index;
    /* Kapitel bleibt markiert, solange ein Bild aus seinem Bereich läuft (0–3 Außen, 4–7 Innen, 8–9 Politur, ab 10 Keramik) */
    const chapter = index >= 10 ? 10 : index >= 8 ? 8 : index >= 4 ? 4 : 0;
    buttons.forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.shot) === chapter));
    label.textContent = frame.label + ' · ' + frame.title;
    if (reduced.matches || !sameView) {
      base.src = src;
      overlay.style.opacity = '0';
      return;
    }
    animation = overlay.animate(
      [{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)'}],
      {duration:1050,easing:'cubic-bezier(.45,0,.25,1)',fill:'forwards'}
    );
    const running = animation;
    running.onfinish = () => {
      if (running !== animation) return;
      base.src = src;
      overlay.style.opacity = '0';
      running.cancel();
    };
  }
  buttons.forEach(button => button.addEventListener('click', () => show(Number(button.dataset.shot))));
  const play = opening.querySelector('[data-play]');
  let timer;
  play.addEventListener('click', () => {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
      play.textContent = 'Film abspielen';
      return;
    }
    const shots = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
    let next = 0;
    show(shots[next++]);
    play.textContent = 'Film pausieren';
    timer = setInterval(() => {
      if (next < shots.length) {
        show(shots[next++]);
      } else {
        clearInterval(timer);
        timer = undefined;
        play.textContent = 'Film abspielen';
      }
    }, 1650);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && timer) play.click();
  });
})();
