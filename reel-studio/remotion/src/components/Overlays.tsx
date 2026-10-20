import type {CSSProperties} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {BODY, HEAD} from '../fonts';
import type {Brand, Overlay} from '../types';
import {Badge3D, Snow} from './Three';

export type OverlayProps = {o: Overlay; brand: Brand};
type SpringCfg = Partial<{damping: number; stiffness: number; mass: number}>;

export const SHADOW = '0 6px 24px rgba(0,0,0,.6)';
export const glass: CSSProperties = {
  background: 'rgba(10,12,16,.72)',
  border: '2px solid rgba(255,255,255,.14)',
  borderRadius: 26,
  boxShadow: '0 20px 60px rgba(0,0,0,.45)',
};

// Einblenden (Feder) ab delay Sekunden nach Start des Overlays
export const useIn = (delay = 0, cfg: SpringCfg = {}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: f - Math.round(delay * fps), fps, config: {damping: 13, stiffness: 160, ...cfg}});
};

// Ausblenden in den letzten 7 Frames des Overlays
export const useOut = (o: Overlay) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const end = (o.to - o.from) * fps;
  return interpolate(f, [end - 7, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
};

const Hook: React.FC<OverlayProps> = ({o, brand}) => {
  const {height} = useVideoConfig();
  const a = useIn(0);
  const b = useIn(0.22, {damping: 10});
  const out = useOut(o);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: o.y * height, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, opacity: out}}>
      <div style={{fontFamily: HEAD, fontSize: 96, lineHeight: 1, color: '#fff', textShadow: SHADOW, opacity: a, transform: `translateX(${(1 - a) * -120}px)`}}>
        {o.line1}
      </div>
      <div style={{fontFamily: HEAD, fontSize: 84, lineHeight: 1, color: brand.dark, background: brand.accent, padding: '8px 28px 12px', borderRadius: 14, transform: `scale(${b}) rotate(-2.5deg)`, boxShadow: `0 12px 40px ${brand.accent}66`}}>
        {o.line2}
      </div>
    </div>
  );
};

const Price: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const a = useIn(0);
  const strikeF = (o.strikeAt - o.from) * fps;
  const strike = interpolate(f, [strikeF, strikeF + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const n = useIn(o.newAt - o.from, {damping: 9, stiffness: 200});
  const w = useIn(o.whyAt - o.from);
  const out = useOut(o);
  return (
    <div style={{position: 'absolute', left: 70, top: o.y * height, opacity: out}}>
      <div style={{position: 'relative', display: 'inline-block', fontFamily: HEAD, fontSize: 72, lineHeight: 1.1, color: '#fff', textShadow: SHADOW, opacity: a * (1 - 0.35 * strike), transform: `translateY(${(1 - a) * 30}px)`}}>
        {o.old}
        <div style={{position: 'absolute', left: -8, top: '50%', height: 10, width: `calc(${strike * 100}% + 16px)`, background: '#FF3B30', borderRadius: 5, transform: 'rotate(-7deg)', transformOrigin: 'left center'}} />
      </div>
      <div style={{fontFamily: HEAD, fontSize: 120, lineHeight: 1, color: brand.accent, transform: `scale(${n})`, transformOrigin: 'left center', textShadow: `0 0 40px ${brand.accent}88, ${SHADOW}`}}>
        {o.new}
      </div>
      {o.why && (
        <div style={{...glass, marginTop: 18, maxWidth: 600, padding: '14px 24px', fontFamily: BODY, fontWeight: 700, fontSize: 36, lineHeight: 1.25, color: '#fff', opacity: w, transform: `translateY(${(1 - w) * 20}px)`}}>
          <span style={{color: brand.accent, fontWeight: 900}}>{o.whyKicker} </span>
          {o.why}
        </div>
      )}
    </div>
  );
};

const Title: React.FC<OverlayProps> = ({o, brand}) => {
  const {height} = useVideoConfig();
  const a = useIn(0);
  const out = useOut(o);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: o.y * height, display: 'flex', justifyContent: 'center', opacity: out}}>
      <div style={{...glass, padding: '22px 44px 26px', textAlign: 'center', opacity: a, transform: `scale(${0.8 + 0.2 * a})`}}>
        <div style={{fontFamily: BODY, fontWeight: 800, fontSize: 30, letterSpacing: 6, color: brand.accent}}>{o.kicker}</div>
        <div style={{fontFamily: HEAD, fontSize: 92, lineHeight: 1.05, color: '#fff'}}>{o.text}</div>
      </div>
    </div>
  );
};

const CheckRow: React.FC<{text: string; delay: number; brand: Brand}> = ({text, delay, brand}) => {
  const s = useIn(delay, {damping: 11});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 18, height: 80, opacity: s, transform: `translateX(${(1 - s) * -40}px)`}}>
      <div style={{width: 54, height: 54, borderRadius: 27, background: brand.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${s})`}}>
        <svg width="32" height="32" viewBox="0 0 24 24">
          <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke={brand.dark} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="22" strokeDashoffset={22 * (1 - s)} />
        </svg>
      </div>
      <div style={{fontFamily: HEAD, fontSize: 66, lineHeight: 1, color: '#fff'}}>{text}</div>
    </div>
  );
};

const Checklist: React.FC<OverlayProps> = ({o, brand}) => {
  const {height} = useVideoConfig();
  const a = useIn(0);
  const out = useOut(o);
  return (
    <div style={{...glass, position: 'absolute', left: 64, top: o.y * height, padding: '24px 36px 20px', opacity: a * out, transform: `translateX(${(1 - a) * -60}px)`}}>
      <div style={{fontFamily: BODY, fontWeight: 800, fontSize: 28, letterSpacing: 4, color: brand.accent, marginBottom: 8}}>{o.title}</div>
      {o.items.map((it: {t: string; at: number}, i: number) => (
        <CheckRow key={i} text={it.t} delay={it.at - o.from} brand={brand} />
      ))}
    </div>
  );
};

const Cta: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {height} = useVideoConfig();
  const a = useIn(0);
  const m = useIn(o.mainAt - o.from);
  const h = useIn(o.altAt - o.from);
  const u = useIn(o.urgencyAt - o.from, {damping: 9});
  const pulse = 1 + 0.04 * Math.sin(f / 4);
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: o.y * height, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
      <div style={{...glass, width: '100%', padding: '28px 36px 32px', textAlign: 'center', border: `3px solid ${brand.accent}`, opacity: a, transform: `translateY(${(1 - a) * 80}px)`}}>
        <div style={{fontFamily: BODY, fontWeight: 800, fontSize: 34, letterSpacing: 6, color: brand.accent}}>{o.kicker}</div>
        <div style={{fontFamily: HEAD, fontSize: 80, lineHeight: 1.08, color: '#fff', marginTop: 6, opacity: m, transform: `scale(${0.85 + 0.15 * m})`}}>{o.main}</div>
        <div style={{fontFamily: BODY, fontWeight: 800, fontSize: 40, color: '#fff', marginTop: 10, opacity: m}}>{o.sub}</div>
        <div style={{fontFamily: BODY, fontWeight: 700, fontSize: 32, color: 'rgba(255,255,255,.8)', marginTop: 14, opacity: h}}>{o.alt}</div>
      </div>
      <div style={{fontFamily: BODY, fontWeight: 900, fontSize: 28, letterSpacing: 1, color: brand.dark, background: brand.accent, padding: '14px 28px', borderRadius: 999, transform: `scale(${u * pulse})`, boxShadow: `0 10px 36px ${brand.accent}55`}}>
        {o.urgency}
      </div>
    </div>
  );
};

// Freigestelltes Bild/3D-Emoji mit Feder-Einstieg, Schweben und leichter 3D-Neigung
const Sticker: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = f / fps;
  const a = useIn(0, {damping: 10, stiffness: 170});
  const out = useOut(o);
  const w: number = o.w ?? o.size ?? 300; // Hochformat-Freisteller: w/h getrennt angeben
  const h: number = o.h ?? o.size ?? 300;
  const enter = o.enter === 'drop' ? `translateY(${(1 - a) * -500}px)` : o.enter === 'slide' ? `translateX(${(1 - a) * (o.x > 0.5 ? 600 : -600)}px)` : `scale(${a})`;
  const tilt = o.tilt === false ? '' : `perspective(900px) rotateY(${Math.sin(t * 1.6) * 14}deg) rotateX(${Math.cos(t * 1.2) * 6}deg)`;
  return (
    <div style={{position: 'absolute', left: o.x * width - w / 2, top: o.y * height - h / 2, width: w, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: out, transform: `${enter} translateY(${Math.sin(t * 2.2) * 8}px) rotate(${o.rot ?? -6}deg)`}}>
      <Img src={staticFile(o.src)} style={{width: w, height: h, objectFit: 'contain', transform: tilt, filter: 'drop-shadow(0 22px 28px rgba(0,0,0,.5))'}} />
      {o.label && <div style={{fontFamily: BODY, fontWeight: 900, fontSize: 34, color: brand.dark, background: brand.accent, padding: '8px 18px', borderRadius: 999, whiteSpace: 'nowrap'}}>{o.label}</div>}
    </div>
  );
};

type MediaRef = {src: string; from?: number; rate?: number};
const Media: React.FC<{m: MediaRef}> = ({m}) => {
  const {fps} = useVideoConfig();
  const st = {width: '100%', height: '100%', objectFit: 'cover'} as const;
  return /\.(png|jpe?g|webp)$/i.test(m.src) ? <Img src={staticFile(m.src)} style={st} /> : <OffthreadVideo src={staticFile(m.src)} trimBefore={Math.round((m.from ?? 0) * fps)} playbackRate={m.rate ?? 1} muted style={st} />;
};

const Tag: React.FC<{text: string; right?: boolean; vis: number; bg: string; fg: string}> = ({text, right, vis, bg, fg}) => (
  <div style={{position: 'absolute', top: '16%', [right ? 'right' : 'left']: 48, fontFamily: HEAD, fontSize: 60, color: fg, background: bg, padding: '6px 24px 10px', borderRadius: 14, opacity: vis, transform: `scale(${0.8 + 0.2 * vis})`}}>{text}</div>
);

// Vorher/Nachher: Nachher-Bild wird mit leuchtender Kante ueber das Vorher-Bild gewischt
const Compare: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const w0 = (o.wipeAt - o.from) * fps;
  const p = interpolate(f, [w0, w0 + (o.wipeDur ?? 1.2) * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  const a = useIn(0);
  const out = useOut(o);
  return (
    <AbsoluteFill style={{opacity: out}}>
      <AbsoluteFill><Media m={o.after} /></AbsoluteFill>
      <AbsoluteFill style={{clipPath: `inset(0 ${p * 100}% 0 0)`}}><Media m={o.before} /></AbsoluteFill>
      {p > 0 && p < 1 && <div style={{position: 'absolute', top: 0, bottom: 0, left: (1 - p) * width - 3, width: 6, background: '#fff', boxShadow: `0 0 34px 10px ${brand.accent}`}} />}
      <Tag text={o.beforeLabel ?? 'VORHER'} vis={a * (1 - p)} bg="rgba(10,12,16,.75)" fg="#fff" />
      <Tag text={o.afterLabel ?? 'NACHHER'} right vis={p} bg={brand.accent} fg={brand.dark} />
    </AbsoluteFill>
  );
};

// Unschaerfe-Feld, z. B. fuer Kennzeichen oder Gesichter (Koordinaten 0..1)
const Blur: React.FC<OverlayProps> = ({o}) => {
  const {width, height} = useVideoConfig();
  const r = `blur(${o.r ?? 22}px)`;
  return <div style={{position: 'absolute', left: o.x * width, top: o.y * height, width: o.w * width, height: o.h * height, backdropFilter: r, WebkitBackdropFilter: r, borderRadius: 12}} />;
};

// Bauchbinde: Icon + Titel + Unterzeile, z. B. Fahrzeugmodell oder Leistung
const LowerThird: React.FC<OverlayProps> = ({o, brand}) => {
  const {height} = useVideoConfig();
  const a = useIn(0);
  const b = useIn(0.15);
  const out = useOut(o);
  return (
    <div style={{...glass, position: 'absolute', left: 60, top: o.y * height, display: 'flex', alignItems: 'center', gap: 20, padding: '18px 34px 18px 18px', opacity: out, transform: `translateX(${(1 - a) * -800}px)`}}>
      {o.icon && <Img src={staticFile(o.icon)} style={{width: 120, height: 120, objectFit: 'contain', transform: `scale(${b}) rotate(${(1 - b) * -30}deg)`, filter: 'drop-shadow(0 10px 14px rgba(0,0,0,.5))'}} />}
      <div style={{borderLeft: `6px solid ${brand.accent}`, paddingLeft: 20}}>
        <div style={{fontFamily: HEAD, fontSize: 64, lineHeight: 1.05, color: '#fff'}}>{o.title}</div>
        {o.sub && <div style={{fontFamily: BODY, fontWeight: 700, fontSize: 32, color: 'rgba(255,255,255,.8)', opacity: b}}>{o.sub}</div>}
      </div>
    </div>
  );
};

export const OVERLAYS: Record<string, React.FC<OverlayProps>> = {
  hook: Hook,
  price: Price,
  title: Title,
  checklist: Checklist,
  cta: Cta,
  badge3d: Badge3D,
  snow: Snow,
  sticker: Sticker,
  compare: Compare,
  blur: Blur,
  lowerthird: LowerThird,
};
