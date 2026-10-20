import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Schriften: Anton/Montserrat lokal (OFL); Fontshare-Schriften (ITF FFL) laedt setup.sh nach public/fonts/fontshare/.
// Titel/Text-Schrift je Projekt ueber brand.fontHead / brand.fontBody (CSS-Variablen in Reel.tsx).
export const HEAD = 'var(--font-head)';
export const BODY = 'var(--font-body)';
export const CANVAS_HEAD = 'Anton';
export const SERIF = 'Instrument Serif'; // Akzent-Woerter (kursiv) im Kinetik-Stil // Canvas (3D-Texturen) kennt keine CSS-Variablen

const files: [string, string, string][] = [
  ['Anton', 'anton-latin-400-normal.woff2', '400'],
  ['Montserrat', 'montserrat-latin-700-normal.woff2', '700'],
  ['Instrument Serif', 'instrument-serif-latin-400-normal.woff2', '400'],
  ['Montserrat', 'montserrat-latin-800-normal.woff2', '800'],
  ['Montserrat', 'montserrat-latin-900-normal.woff2', '900'],
  // Titel-Schriften: fette Schnitte unter Gewicht 400 registriert, damit Titel ohne fontWeight kraeftig erscheinen
  ['Clash Display', 'fontshare/ClashDisplay-Bold.woff2', '400'],
  ['Cabinet Grotesk', 'fontshare/CabinetGrotesk-Extrabold.woff2', '400'],
  ['Satoshi', 'fontshare/Satoshi-Bold.woff2', '700'],
  ['Satoshi', 'fontshare/Satoshi-Black.woff2', '800'],
  ['Satoshi', 'fontshare/Satoshi-Black.woff2', '900'],
];

export const fontsReady = Promise.all([
  ...files.map(([family, file, weight]) => loadFont({family, url: staticFile(`fonts/${file}`), weight})),
  loadFont({family: SERIF, url: staticFile('fonts/instrument-serif-latin-400-italic.woff2'), weight: '400', style: 'italic'}),
]);
