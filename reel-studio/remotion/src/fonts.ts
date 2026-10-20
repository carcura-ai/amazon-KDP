import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Lokal eingebundene Schriften (SIL Open Font License, siehe public/fonts/OFL-*.txt)
export const HEAD = 'Anton';
export const BODY = 'Montserrat';

const files: [string, string, string][] = [
  [HEAD, 'anton-latin-400-normal.woff2', '400'],
  [BODY, 'montserrat-latin-700-normal.woff2', '700'],
  [BODY, 'montserrat-latin-800-normal.woff2', '800'],
  [BODY, 'montserrat-latin-900-normal.woff2', '900'],
];

export const fontsReady = Promise.all(
  files.map(([family, file, weight]) => loadFont({family, url: staticFile(`fonts/${file}`), weight})),
);
