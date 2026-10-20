import {AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from './components/Captions';
import {OVERLAYS} from './components/Overlays';
import {at, type EditSpec} from './types';

const Footage: React.FC<{spec: EditSpec; muted?: boolean}> = ({spec, muted}) => {
  const {fps} = useVideoConfig();
  return (
    <Series>
      {spec.clips.map((c, i) => (
        <Series.Sequence key={i} durationInFrames={Math.round((c.to - c.from) * fps)}>
          <OffthreadVideo
            src={staticFile(c.src)}
            trimBefore={Math.round(c.from * fps)}
            muted={muted}
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
        </Series.Sequence>
      ))}
    </Series>
  );
};

const band = (top: number, bottom: number) =>
  `linear-gradient(to bottom, transparent ${top * 100}%, #000 ${(top + 0.03) * 100}%, #000 ${(bottom - 0.03) * 100}%, transparent ${bottom * 100}%)`;

export const Reel: React.FC<EditSpec> = (spec) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  const z = at(spec.zooms, t);
  const scale = z ? interpolate(t, [z.from, z.to], z.scale, {extrapolateRight: 'clamp'}) : 1;
  const filter = at(spec.grade, t)?.filter ?? '';
  const look = {transform: `scale(${scale})`, transformOrigin: '50% 40%', filter: filter || undefined};
  const cover = at(spec.cover, t);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
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

      <Captions spec={spec} />

      {spec.overlays.map((o, i) => {
        const C = OVERLAYS[o.type];
        return C ? (
          <Sequence key={i} from={Math.round(o.from * fps)} durationInFrames={Math.max(1, Math.round((o.to - o.from) * fps))} layout="none">
            <C o={o} brand={spec.brand} />
          </Sequence>
        ) : null;
      })}

      {spec.sfx?.map((s, i) => (
        <Sequence key={`sfx${i}`} from={Math.round(s.at * fps)} layout="none">
          <Audio src={staticFile(`sfx/${s.name}.wav`)} volume={s.vol ?? 0.3} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
