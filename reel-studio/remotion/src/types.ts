// Zeiten in Sekunden auf der Ausgabe-Zeitachse (nach dem Schnitt)
export type Word = {w: string; s: number; e: number};
export type Clip = {src: string; from: number; to: number};
export type Range = {from: number; to: number};
export type Brand = {accent: string; dark: string; handle: string};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Overlay = Range & {type: string; [k: string]: any};

export type EditSpec = {
  fps: number;
  clips: Clip[];
  words: Word[];
  brand: Brand;
  grade?: (Range & {filter: string})[];
  zooms?: (Range & {scale: [number, number]})[];
  cover?: (Range & {top: number; bottom: number})[]; // Milchglas-Band ueber eingebrannten Texten
  captions: {y: number; maxWords: number; maxChars: number; hide?: [number, number][]};
  overlays: Overlay[];
  sfx?: {at: number; name: string; vol?: number}[];
};

export const at = <T extends Range>(list: T[] | undefined, t: number) =>
  list?.find((r) => t >= r.from && t < r.to);
