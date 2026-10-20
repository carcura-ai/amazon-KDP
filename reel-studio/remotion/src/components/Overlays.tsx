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

// Text hinter dem Objekt: grosser Titel, darueber der vollformatige Freisteller (ruhiger Shot, Segment-Zoom [1, 1])
const TextBehind: React.FC<OverlayProps> = ({o, brand}) => {
  const {height} = useVideoConfig();
  const a = useIn(0, {damping: 12, stiffness: 120});
  const out = useOut(o);
  return (
    <AbsoluteFill style={{opacity: out}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: o.y * height, transform: `translateY(-50%) scale(${0.7 + 0.3 * a})`, textAlign: 'center',
        fontFamily: HEAD, fontSize: o.size ?? 300, lineHeight: 0.9, letterSpacing: 4, color: o.color ?? brand.accent, opacity: a, textShadow: '0 10px 40px rgba(0,0,0,.35)'}}>
        {o.text}
      </div>
      <Img src={staticFile(o.src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
    </AbsoluteFill>
  );
};

// Chat-Verlauf (Kunde links, Carcura rechts) mit Tipp-Animation vor jeder Nachricht
const Chat: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const a = useIn(0);
  const out = useOut(o);
  const msgs: {who: string; text: string; at: number}[] = o.messages;
  const typing = msgs.find((m) => f < (m.at - o.from) * fps && f > (m.at - o.from - 0.7) * fps);
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: o.y * height, opacity: a * out, transform: `translateY(${(1 - a) * 60}px)`}}>
      <div style={{...glass, padding: '22px 26px 26px', display: 'flex', flexDirection: 'column', gap: 14}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.12)'}}>
          <div style={{width: 64, height: 64, borderRadius: 32, background: brand.dark, border: `3px solid ${brand.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HEAD, fontSize: 34, color: brand.accent}}>C</div>
          <div>
            <div style={{fontFamily: BODY, fontWeight: 800, fontSize: 34, color: '#fff'}}>{o.title ?? 'Carcura'}</div>
            <div style={{fontFamily: BODY, fontWeight: 700, fontSize: 24, color: brand.accent}}>{typing ? 'schreibt …' : 'online'}</div>
          </div>
        </div>
        {msgs.map((m, i) => {
          const s = spring({frame: f - Math.round((m.at - o.from) * fps), fps, config: {damping: 13, stiffness: 200}});
          const mine = m.who !== 'kunde';
          return s > 0.01 ? (
            <div key={i} style={{alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', padding: '16px 22px', borderRadius: 26,
              borderBottomRightRadius: mine ? 6 : 26, borderBottomLeftRadius: mine ? 26 : 6, background: mine ? brand.accent : '#fff',
              color: brand.dark, fontFamily: BODY, fontWeight: 700, fontSize: 38, lineHeight: 1.25, transform: `scale(${s})`, transformOrigin: mine ? 'right bottom' : 'left bottom'}}>
              {m.text}
            </div>
          ) : null;
        })}
        {typing && (
          <div style={{alignSelf: typing.who !== 'kunde' ? 'flex-end' : 'flex-start', display: 'flex', gap: 8, padding: '18px 22px', borderRadius: 26, background: 'rgba(255,255,255,.18)'}}>
            {[0, 1, 2].map((k) => <div key={k} style={{width: 12, height: 12, borderRadius: 6, background: '#fff', opacity: 0.4 + 0.6 * Math.abs(Math.sin(f / 5 + k))}} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// Kino-Balken oben/unten
const Letterbox: React.FC<OverlayProps> = ({o}) => {
  const {height} = useVideoConfig();
  const a = useIn(0, {damping: 20, stiffness: 120});
  const out = useOut(o);
  const h = (o.h ?? 0.12) * height * a * out;
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: h, background: '#000'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: h, background: '#000'}} />
    </>
  );
};

// Collage: Clips/Bilder als gekippte Postkarten, nacheinander eingeworfen
const Collage: React.FC<OverlayProps> = ({o}) => {
  const {width, height} = useVideoConfig();
  const out = useOut(o);
  const items: (MediaRef & {at?: number})[] = o.items;
  const pos = [[0.3, 0.3, -7], [0.68, 0.42, 5], [0.36, 0.6, 3], [0.66, 0.74, -5]];
  return (
    <AbsoluteFill style={{opacity: out}}>
      {items.slice(0, 4).map((m, i) => {
        const s = useIn((m.at ?? o.from + i * 0.35) - o.from, {damping: 12, stiffness: 140});
        const [x, y, r] = pos[i];
        const w = width * (o.w ?? 0.52);
        return (
          <div key={i} style={{position: 'absolute', left: x * width - w / 2, top: y * height - (w * 1.25) / 2, width: w, height: w * 1.25,
            border: '12px solid #fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 24px 50px rgba(0,0,0,.5)', opacity: s,
            transform: `translateY(${(1 - s) * 500}px) rotate(${r * s + (1 - s) * 20}deg) scale(${0.85 + 0.15 * s})`}}>
            <Media m={m} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// 60-Sekunden-Timer: Zeit + Fortschrittsbalken oben (Halte-Effekt „gleich ist es fertig“)
const Timer: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const total = o.total ?? 60;
  const sec = Math.min(total, (o.offset ?? 0) + f / fps * ((o.total ?? 60) / (o.to - o.from)));
  const a = useIn(0);
  const out = useOut(o);
  const shown = o.countdown ? total - sec : sec;
  const label = `${Math.floor(shown / 60)}:${String(Math.floor(shown % 60)).padStart(2, '0')}`;
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: (o.y ?? 0.135) * height, opacity: a * out}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
        <div style={{fontFamily: BODY, fontWeight: 900, fontSize: 30, letterSpacing: 3, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,.7)'}}>{o.label ?? ''}</div>
        <div style={{fontFamily: BODY, fontWeight: 900, fontSize: 40, color: brand.dark, background: brand.accent, padding: '4px 16px', borderRadius: 12, fontVariantNumeric: 'tabular-nums'}}>{label}</div>
      </div>
      <div style={{height: 10, borderRadius: 5, background: 'rgba(255,255,255,.25)', overflow: 'hidden', width: width - 120}}>
        <div style={{height: '100%', width: `${(sec / total) * 100}%`, background: brand.accent, boxShadow: `0 0 18px ${brand.accent}`}} />
      </div>
    </div>
  );
};

// 3D-Schrittkarte: extrudierte Schrift dreht sich ins Bild, Lichtschimmer laeuft darueber.
// fx: 'glanz' (zweiter Hochglanz-Schimmer) | 'spray' (Schrift setzt sich wie Spruehnebel ab) | 'wisch' (wird am Ende weggewischt)
const Step: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const a = useIn(0, {damping: 12, stiffness: 130});
  const out = useOut(o);
  const end = (o.to - o.from) * fps;
  const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
  const depth = (c: string, n: number) => Array.from({length: n}, (_, i) => `${i + 1}px ${i + 1}px 0 ${c}`).join(', ');
  const glint = interpolate(f, o.fx === 'glanz' && f > 30 ? [34, 54] : [8, 26], [-40, 140], clamp);
  const mist = o.fx === 'spray' ? interpolate(f, [0, 18], [1, 0], clamp) : 0;
  const wipe = interpolate(f, [end - 20, end - 3], [-20, 120], clamp);
  const mask = o.fx === 'wisch' ? `linear-gradient(100deg, transparent ${wipe}%, #000 ${wipe + 20}%)` : undefined;
  const textStyle = {fontFamily: HEAD, lineHeight: 0.95, color: '#fff', whiteSpace: 'pre-line', textShadow: `${depth('#3a3d45', 10)}, 0 18px 40px rgba(0,0,0,.6)`} as const;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: (o.y ?? 0.2) * height, display: 'flex', justifyContent: 'center', perspective: 1000, opacity: o.fx === 'wisch' ? 1 : out, WebkitMaskImage: mask, maskImage: mask}}>
      <div style={{transform: `rotateX(${(1 - a) * 70}deg) rotateY(${(1 - a) * -25}deg) scale(${0.7 + 0.3 * a})`, transformStyle: 'preserve-3d', textAlign: 'center', position: 'relative'}}>
        <div style={{position: 'absolute', inset: '-40px -90px', background: 'radial-gradient(ellipse at center, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 68%)'}} />
        <div style={{display: 'inline-flex', alignItems: 'center', gap: 14, marginBottom: 10, position: 'relative'}}>
          {o.nr !== undefined && <div style={{fontFamily: HEAD, fontSize: 64, lineHeight: 1, color: brand.dark, background: brand.accent, padding: '6px 18px', borderRadius: 14, boxShadow: `${depth('#8a8f12', 8)}, 0 12px 30px rgba(0,0,0,.5)`}}>{o.nr}</div>}
          <div style={{fontFamily: BODY, fontWeight: 900, fontSize: 30, letterSpacing: 5, color: brand.accent, background: 'rgba(9,9,10,.62)', padding: '6px 14px', borderRadius: 10}}>{o.kicker ?? `SCHRITT ${o.nr}/${o.of}`}</div>
        </div>
        <div style={{...textStyle, position: 'relative', fontSize: o.size ?? 104, filter: mist ? `blur(${mist * 16}px)` : undefined, letterSpacing: mist * 40, opacity: 1 - mist * 0.6}}>{o.text}</div>
        <div style={{position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${glint - 20}%, rgba(255,255,255,.55) ${glint}%, transparent ${glint + 20}%)`, mixBlendMode: 'overlay', pointerEvents: 'none'}} />
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
  textbehind: TextBehind,
  chat: Chat,
  letterbox: Letterbox,
  collage: Collage,
  timer: Timer,
  step: Step,
};
