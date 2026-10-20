import {useMemo} from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BODY} from '../fonts';
import type {EditSpec, Word} from '../types';

const PUNCT = /[.,!?;:]+$/;

// Wort-fuer-Wort-Untertitel: kurze Gruppen (max. 3 Woerter), aktives Wort in Akzentfarbe
export const Captions: React.FC<{spec: EditSpec}> = ({spec}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const t = frame / fps;
  const {maxWords, maxChars, y, hide = []} = spec.captions;

  const chunks = useMemo(() => {
    const out: Word[][] = [];
    let cur: Word[] = [];
    for (const w of spec.words) {
      const prev = cur[cur.length - 1];
      const len = cur.map((x) => x.w).join(' ').length + w.w.length + 1;
      const keepNumber = /^\d/.test(w.w) && !PUNCT.test(prev?.w ?? '') && len <= maxChars + 4; // "Tag 1" nicht trennen
      if (prev && !keepNumber && (cur.length >= maxWords || len > maxChars || PUNCT.test(prev.w) || w.s - prev.e > 0.6)) {
        out.push(cur);
        cur = [];
      }
      cur.push(w);
    }
    if (cur.length) out.push(cur);
    return out;
  }, [spec.words, maxWords, maxChars]);

  if (hide.some(([a, b]) => t >= a && t < b)) return null;
  const i = chunks.findIndex((c, k) => t >= c[0].s && t < (chunks[k + 1]?.[0].s ?? Infinity));
  const chunk = chunks[i];
  if (!chunk || t > chunk[chunk.length - 1].e + 0.6) return null;

  const pop = spring({frame: frame - Math.round(chunk[0].s * fps), fps, config: {damping: 14, stiffness: 220}});
  const longest = Math.max(...chunk.map((w) => w.w.length));
  const size = Math.min(68, 940 / (longest * 0.74));

  return (
    <div
      style={{
        position: 'absolute', left: 60, right: 60, top: y * height,
        transform: `translateY(-50%) scale(${0.82 + 0.18 * pop})`,
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 18px',
      }}
    >
      {chunk.map((w, k) => {
        const active = t >= w.s && t < (chunk[k + 1]?.s ?? w.e + 0.6);
        return (
          <span
            key={k}
            style={{
              display: 'inline-block', fontFamily: BODY, fontWeight: 900, fontSize: size, lineHeight: 1.12,
              textTransform: 'uppercase', color: active ? spec.brand.accent : '#fff',
              WebkitTextStroke: '12px #000', paintOrder: 'stroke fill',
              textShadow: '0 6px 18px rgba(0,0,0,.55)', transform: `scale(${active ? 1.08 : 1})`,
            }}
          >
            {w.w.replace(PUNCT, '')}
          </span>
        );
      })}
    </div>
  );
};
