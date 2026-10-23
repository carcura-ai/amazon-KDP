import {useMemo} from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BODY, SERIF} from '../fonts';
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
  if (spec.captions.style === 'kinetik') return <Kinetik spec={spec} chunks={chunks} t={t} />;
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

// Kinetik-Stil (Regie-Skill-Referenz): der Satz baut sich Wort fuer Wort auf, betonte Woerter kursiv in Serifenschrift + Akzentfarbe
const Kinetik: React.FC<{spec: EditSpec; chunks: Word[][]; t: number}> = ({spec, t}) => {
  const {fps, height} = useVideoConfig();
  const frame = useCurrentFrame();
  const sentences = useMemo(() => {
    const out: Word[][] = [];
    let cur: Word[] = [];
    for (const w of spec.words) {
      const prev = cur[cur.length - 1];
      if (prev && (PUNCT.test(prev.w) || cur.length >= 7 || w.s - prev.e > 0.6)) {
        out.push(cur);
        cur = [];
      }
      cur.push(w);
    }
    if (cur.length) out.push(cur);
    return out;
  }, [spec.words]);
  const k = sentences.findIndex((c, i) => t >= c[0].s && t < (sentences[i + 1]?.[0].s ?? Infinity));
  const line = sentences[k];
  if (!line || t > line[line.length - 1].e + 0.8) return null;
  const marks = (spec.captions.betonen ?? []).map((x) => x.toLowerCase());
  const isMark = (w: string) => {
    const c = w.replace(PUNCT, '').toLowerCase();
    return marks.length ? marks.includes(c) : /\d/.test(c) || c.length >= 9;
  };
  return (
    <div style={{position: 'absolute', left: 70, right: 70, top: spec.captions.y * height, transform: 'translateY(-50%)',
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', gap: '4px 20px'}}>
      {line.map((w, i) => {
        const p = spring({frame: frame - Math.round(w.s * fps), fps, config: {damping: 15, stiffness: 240}});
        if (p <= 0.001) return null;
        const mark = isMark(w.w);
        return (
          <span key={i} style={{display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 26}px)`,
            fontFamily: mark ? SERIF : BODY, fontStyle: mark ? 'italic' : 'normal', fontWeight: mark ? 400 : 900,
            fontSize: mark ? 92 : 66, lineHeight: 1.05, letterSpacing: mark ? 0 : -1, color: mark ? spec.brand.accent : '#fff',
            textTransform: mark ? 'none' : 'uppercase', textShadow: '0 4px 24px rgba(0,0,0,.65)'}}>
            {w.w.replace(PUNCT, '')}
          </span>
        );
      })}
    </div>
  );
};
