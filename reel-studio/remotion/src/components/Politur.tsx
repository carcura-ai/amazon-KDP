import {useMemo} from 'react';
import {Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {BODY, HEAD} from '../fonts';
import type {OverlayProps} from './Overlays';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Zufall mit festem Startwert: jedes Bild sieht gleich aus (Remotion rendert Frames parallel)
const rnd = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

// Feine Kreis-Kratzer (Swirls/Hologramme) um einige Lichtpunkte – so sieht verkratzter Lack unter Licht aus
const Swirls: React.FC<{w: number; h: number}> = ({w, h}) => {
  const paths = useMemo(() => {
    const r = rnd(42);
    const centers = [[0.3, 0.62], [0.72, 0.38], [0.5, 0.85], [0.18, 0.25]];
    return Array.from({length: 170}, () => {
      const [cx, cy] = centers[Math.floor(r() * centers.length)];
      const rad = 60 + r() * 620;
      const a0 = r() * Math.PI * 2;
      const a1 = a0 + 0.25 + r() * 0.9;
      const p = (a: number) => `${(cx * w + Math.cos(a) * rad).toFixed(1)} ${(cy * h + Math.sin(a) * rad).toFixed(1)}`;
      return {d: `M ${p(a0)} A ${rad.toFixed(1)} ${rad.toFixed(1)} 0 0 1 ${p(a1)}`, sw: 1 + r() * 2.2, op: 0.08 + r() * 0.22};
    });
  }, [w, h]);
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
      {paths.map((p, i) => <path key={i} d={p.d} stroke={`rgba(255,255,255,${p.op})`} strokeWidth={p.sw} fill="none" />)}
    </svg>
  );
};

// Start-Animation: stumpfer, verkratzter Lack + Problem-Woerter; ein leuchtender Polierpad-Ring poliert das Bild frei
// und nimmt die Woerter mit. Props: x/y (Pad-Mitte), start (s bis der Ring loslaeuft), dur (s), lines, y0 (Textposition)
export const PolishReveal: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const t = f / fps;
  const cx = (o.x ?? 0.5) * W;
  const cy = (o.y ?? 0.5) * H;
  const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 80;
  const p = interpolate(t, [o.start ?? 0.9, (o.start ?? 0.9) + (o.dur ?? 1.1)], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const R = p * maxR;
  const mask = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${R}px, #000 ${R + 3}px)`;
  const lines: string[] = o.lines ?? [];
  const ringOp = p > 0 && p < 1 ? interpolate(p, [0, 0.08, 0.85, 1], [0, 1, 1, 0]) : 0;
  const flash = interpolate(p, [0.9, 1], [0, 0.35], clamp) * interpolate(t, [(o.start ?? 0.9) + (o.dur ?? 1.1), (o.start ?? 0.9) + (o.dur ?? 1.1) + 0.25], [1, 0], clamp);
  const dull = 'grayscale(.75) brightness(.6) contrast(.8)';
  return (
    <>
      <div style={{position: 'absolute', inset: 0, backdropFilter: dull, WebkitBackdropFilter: dull, WebkitMaskImage: mask, maskImage: mask}}>
        <Swirls w={W} h={H} />
        <div style={{position: 'absolute', left: 0, right: 0, top: (o.y0 ?? 0.14) * H, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
          {lines.map((l, i) => {
            const a = spring({frame: f - Math.round(i * 0.22 * fps), fps, config: {damping: 14, stiffness: 220}});
            const jitter = a < 0.98 ? Math.sin(f * 7 + i) * 10 * (1 - a) : 0;
            return (
              <div key={i} style={{fontFamily: HEAD, fontSize: o.size ?? 118, lineHeight: 1, color: '#fff', letterSpacing: 2, opacity: a,
                transform: `translateX(${jitter}px) scale(${1.25 - 0.25 * a})`, textShadow: '0 6px 30px rgba(0,0,0,.7)'}}>{l}</div>
            );
          })}
        </div>
      </div>
      {ringOp > 0 && (
        <div style={{position: 'absolute', left: cx - R, top: cy - R, width: 2 * R, height: 2 * R, opacity: ringOp}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid rgba(255,255,255,.95)',
            boxShadow: `0 0 34px ${brand.accent}, 0 0 90px ${brand.accent}99, inset 0 0 40px ${brand.accent}66`}} />
          <div style={{position: 'absolute', inset: -6, borderRadius: '50%', transform: `rotate(${f * 38}deg)`,
            background: `conic-gradient(from 0deg, transparent 0deg, ${brand.accent} 40deg, #fff 70deg, transparent 120deg, transparent 180deg, ${brand.accent} 220deg, #fff 250deg, transparent 300deg)`,
            WebkitMaskImage: 'radial-gradient(closest-side, transparent calc(100% - 16px), #000 calc(100% - 14px))', maskImage: 'radial-gradient(closest-side, transparent calc(100% - 16px), #000 calc(100% - 14px))'}} />
        </div>
      )}
      {flash > 0 && <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash}} />}
    </>
  );
};

// End-Animation: ein LED-Lichtbalken (wie in der Halle) faehrt durchs Bild und legt die Endkarte frei
// Props: kicker, pre, price, sub, cta, site, logo, sweep (s)
export const LichtBalken: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, height: H} = useVideoConfig();
  const t = f / fps;
  const s0 = 0.12;
  const sw = o.sweep ?? 0.95;
  const pos = interpolate(t, [s0, s0 + sw], [-12, 112], {...clamp, easing: Easing.inOut(Easing.quad)});
  const mask = `linear-gradient(90deg, #000 ${pos - 4}%, transparent ${pos + 4}%)`;
  const dim = 'blur(10px) brightness(.42) saturate(.8)';
  const price = spring({frame: f - Math.round((s0 + sw * 0.55) * fps), fps, config: {damping: 10, stiffness: 140}});
  const cta = spring({frame: f - Math.round((s0 + sw + 0.35) * fps), fps, config: {damping: 11}});
  const pulse = 1 + 0.035 * Math.sin(Math.max(0, t - s0 - sw - 0.8) * 7);
  const glint = interpolate(t, [s0 + sw + 0.5, s0 + sw + 1.1], [-30, 130], clamp);
  const depth = (c: string, n: number) => Array.from({length: n}, (_, i) => `${i + 1}px ${i + 1}px 0 ${c}`).join(', ');
  const chrome = {
    background: 'linear-gradient(180deg, #ffffff 0%, #e3e7ee 36%, #8a93a3 50%, #f5f7fa 63%, #b9c0cc 100%)',
    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 12px 26px rgba(0,0,0,.65))',
  } as const;
  return (
    <>
      <div style={{position: 'absolute', inset: 0, backdropFilter: dim, WebkitBackdropFilter: dim, background: 'rgba(9,9,10,.25)', WebkitMaskImage: mask, maskImage: mask}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: (o.y ?? 0.2) * H, display: 'flex', flexDirection: 'column', alignItems: 'center', WebkitMaskImage: mask, maskImage: mask}}>
        <div style={{fontFamily: BODY, fontWeight: 900, fontSize: 32, letterSpacing: 10, color: 'rgba(255,255,255,.85)'}}>{o.over ?? 'LACK WIE NEU'}</div>
        <div style={{...chrome, fontFamily: HEAD, fontSize: 178, lineHeight: 1.05, letterSpacing: 4}}>{o.kicker ?? 'POLITUR'}</div>
        <div style={{position: 'relative', display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 4, transform: `scale(${0.6 + 0.4 * price})`, opacity: Math.min(1, price * 1.5)}}>
          <span style={{fontFamily: BODY, fontWeight: 900, fontSize: 60, color: brand.accent}}>{o.pre ?? 'AB'}</span>
          <span style={{fontFamily: HEAD, fontSize: 250, lineHeight: 0.95, color: brand.accent, textShadow: `${depth('#8a8f12', 10)}, 0 22px 50px rgba(0,0,0,.6)`}}>{o.price}</span>
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${glint - 18}%, rgba(255,255,255,.7) ${glint}%, transparent ${glint + 18}%)`, mixBlendMode: 'overlay'}} />
        </div>
        <div style={{fontFamily: BODY, fontWeight: 800, fontSize: 40, color: '#fff', marginTop: 18}}>{o.sub}</div>
        <div style={{marginTop: 46, fontFamily: BODY, fontWeight: 900, fontSize: 40, letterSpacing: 1, color: brand.dark, background: brand.accent,
          padding: '20px 40px', borderRadius: 999, boxShadow: `0 14px 44px ${brand.accent}66`, transform: `scale(${cta * pulse})`}}>{o.cta}</div>
        <Img src={staticFile(o.logo ?? 'brand/logo_weiss.png')} style={{width: 250, marginTop: 70, opacity: cta}} />
        <div style={{fontFamily: BODY, fontWeight: 700, fontSize: 30, color: 'rgba(255,255,255,.75)', marginTop: 14, opacity: cta}}>{o.site}</div>
      </div>
      <div style={{position: 'absolute', top: '-10%', height: '120%', left: `${pos}%`, width: 26, marginLeft: -13, transform: 'rotate(7deg)',
        opacity: interpolate(pos, [-12, -2, 100, 112], [0, 1, 1, 0], clamp),
        background: 'linear-gradient(90deg, transparent, #e8f6ff 30%, #ffffff 50%, #e8f6ff 70%, transparent)',
        boxShadow: '0 0 34px 10px rgba(200,238,255,.9), 0 0 140px 50px rgba(120,200,255,.45)'}} />
    </>
  );
};

// Hinweis mit Linie: pulsierender Punkt am Objekt, Linie zeichnet sich zur Beschriftung (wie ein technisches Datenblatt)
// Props: x/y (Punkt), lx/ly (Beschriftung, linke obere Ecke), text, sub
export const Callout: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const end = (o.to - o.from) * fps;
  const dot = spring({frame: f, fps, config: {damping: 9, stiffness: 200}});
  const line = interpolate(f, [5, 15], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const lab = spring({frame: f - 12, fps, config: {damping: 13}});
  const out = interpolate(f, [end - 7, end], [1, 0], clamp);
  const x = o.x * W, y = o.y * H, lx = o.lx * W, ly = o.ly * H;
  const ex = lx + (lx > x ? 0 : 0), ey = ly + 70;
  const len = Math.hypot(ex - x, ey - y);
  const ring = (f % 30) / 30;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: out}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <line x1={x} y1={y} x2={ex} y2={ey} stroke={brand.accent} strokeWidth={4} strokeDasharray={len} strokeDashoffset={len * (1 - line)} />
        <circle cx={x} cy={y} r={14 * dot} fill={brand.accent} />
        <circle cx={x} cy={y} r={14 + ring * 40} fill="none" stroke={brand.accent} strokeWidth={3} opacity={(1 - ring) * dot} />
      </svg>
      <div style={{position: 'absolute', left: lx, top: ly, opacity: lab, transform: `translateY(${(1 - lab) * 30}px)`,
        background: 'rgba(9,9,10,.72)', borderLeft: `8px solid ${brand.accent}`, borderRadius: 14, padding: '18px 28px 20px'}}>
        <div style={{fontFamily: HEAD, fontSize: 70, lineHeight: 1, color: '#fff'}}>{o.text}</div>
        {o.sub && <div style={{fontFamily: BODY, fontWeight: 800, fontSize: 32, color: brand.accent, marginTop: 8}}>{o.sub}</div>}
      </div>
    </div>
  );
};

// Glanz-Streifen: diagonaler Lichtstreifen faehrt ueber das ganze Bild (auf glaenzenden Momenten)
export const Glint: React.FC<OverlayProps> = ({o}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = interpolate(f, [0, (o.to - o.from) * fps], [-40, 140], {...clamp, easing: Easing.inOut(Easing.quad)});
  return <div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', background: `linear-gradient(115deg, transparent ${p - 14}%, rgba(255,255,255,.28) ${p - 3}%, rgba(255,255,255,.55) ${p}%, rgba(255,255,255,.28) ${p + 3}%, transparent ${p + 14}%)`}} />;
};
