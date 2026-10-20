import {useMemo} from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from './components/Captions';
import {OVERLAYS} from './components/Overlays';
import {at, clipDur, type Clip, type EditSpec} from './types';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)} as const;
const media = {width: '100%', height: '100%', objectFit: 'cover'} as const;

// Ein Clip inkl. Einstiegs-Uebergang (zoom = Zoom-Blur, whip = Wisch-Schwenk, flash = Weissblitz)
const ClipView: React.FC<{c: Clip; muted?: boolean}> = ({c, muted}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const vol = muted ? 0 : (c.vol ?? 1);
  const style =
    c.tin === 'zoom' ? {transform: `scale(${interpolate(f, [0, 8], [1.25, 1], clamp)})`, filter: `blur(${interpolate(f, [0, 6], [8, 0], clamp)}px)`}
    : c.tin === 'whip' ? {transform: `translateX(${interpolate(f, [0, 7], [-220, 0], clamp)}px)`, filter: `blur(${interpolate(f, [0, 6], [18, 0], clamp)}px)`}
    : {};
  return (
    <AbsoluteFill style={style}>
      {c.img ? (
        <Img src={staticFile(c.src)} style={media} />
      ) : (
        <OffthreadVideo src={staticFile(c.src)} trimBefore={Math.round(c.from * fps)} playbackRate={c.rate ?? 1} muted={!vol} volume={vol} style={media} />
      )}
      {c.tin === 'flash' && <AbsoluteFill style={{background: '#fff', opacity: interpolate(f, [0, 5], [0.9, 0], clamp)}} />}
    </AbsoluteFill>
  );
};

const Footage: React.FC<{spec: EditSpec; muted?: boolean}> = ({spec, muted}) => {
  const {fps} = useVideoConfig();
  return (
    <Series>
      {spec.clips.map((c, i) => (
        <Series.Sequence key={i} durationInFrames={Math.round(clipDur(c) * fps)}>
          <ClipView c={c} muted={muted} />
        </Series.Sequence>
      ))}
    </Series>
  );
};

// Musikbett mit automatischem Ducking: leiser, sobald gesprochen wird
const Music: React.FC<{spec: EditSpec}> = ({spec}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const m = spec.music!;
  const speech = useMemo(() => spec.words.map((w) => [w.s, w.e]), [spec.words]);
  return (
    <Audio
      src={staticFile(m.src)}
      trimBefore={Math.round((m.from ?? 0) * fps)}
      loop
      volume={(f) => {
        const t = f / fps;
        let d = Infinity;
        for (const [s, e] of speech) d = Math.min(d, t < s ? s - t : t > e ? t - e : 0);
        const level = interpolate(d, [0.05, 0.45], [m.duck ?? 0.05, m.vol ?? 0.16], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return level * interpolate(f, [0, 12, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
      }}
    />
  );
};

const band = (top: number, bottom: number) =>
  `linear-gradient(to bottom, transparent ${top * 100}%, #000 ${(top + 0.03) * 100}%, #000 ${(bottom - 0.03) * 100}%, transparent ${bottom * 100}%)`;

export const Reel: React.FC<EditSpec> = (spec) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  const z = at(spec.zooms, t);
  const scale = z ? interpolate(t, [z.from, z.to], z.scale, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  const filter = at(spec.grade, t)?.filter ?? spec.look?.grade ?? '';
  const look = {transform: `scale(${scale})`, transformOrigin: '50% 40%', filter: filter || undefined};
  const cover = at(spec.cover, t);

  return (
    <AbsoluteFill style={{backgroundColor: '#000', ['--font-head' as string]: `'${spec.brand.fontHead ?? 'Anton'}'`, ['--font-body' as string]: `'${spec.brand.fontBody ?? 'Montserrat'}'`}}>
      <AbsoluteFill style={look}>
        <Footage spec={spec} />
      </AbsoluteFill>

      {cover && (
        <AbsoluteFill style={{maskImage: band(cover.top, cover.bottom), WebkitMaskImage: band(cover.top, cover.bottom)}}>
          <AbsoluteFill style={{...look, filter: `${filter} blur(28px) brightness(0.5)`}}>
            <Footage spec={spec} muted />
          </AbsoluteFill>
          <AbsoluteFill style={{background: 'rgba(8,10,14,0.35)'}} />
        </AbsoluteFill>
      )}

      {!!spec.look?.vignette && (
        <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,${spec.look.vignette}) 100%)`}} />
      )}

      {!!spec.look?.grain && (
        <AbsoluteFill style={{mixBlendMode: 'overlay', opacity: spec.look.grain}}>
          <svg width="100%" height="100%">
            <filter id="korn">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 997} stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#korn)" />
          </svg>
        </AbsoluteFill>
      )}

      <Captions spec={spec} />

      {spec.overlays.map((o, i) => {
        const C = OVERLAYS[o.type];
        return C ? (
          <Sequence key={i} from={Math.round(o.from * fps)} durationInFrames={Math.max(1, Math.round((o.to - o.from) * fps))} layout="none">
            <C o={o} brand={spec.brand} />
          </Sequence>
        ) : null;
      })}

      {spec.audio?.map((a, i) => (
        <Sequence key={`vo${i}`} from={Math.round(a.at * fps)} durationInFrames={Math.round((a.to - a.from) * fps)} layout="none">
          <Audio src={staticFile(a.src)} trimBefore={Math.round(a.from * fps)} volume={a.vol ?? 1} />
        </Sequence>
      ))}

      {spec.music && <Music spec={spec} />}

      {spec.sfx?.map((s, i) => (
        <Sequence key={`sfx${i}`} from={Math.round(s.at * fps)} durationInFrames={s.dur ? Math.round(s.dur * fps) : undefined} layout="none">
          <Audio src={staticFile(`sfx/${s.name}${/\.\w+$/.test(s.name) ? '' : '.wav'}`)} volume={s.vol ?? 0.3} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
