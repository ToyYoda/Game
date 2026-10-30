// Baut die App-Fassung nach app/www: Spielseite mit mitgelieferten Schriften und PeerJS (läuft offline)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(here, 'www');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts'), { recursive: true });

let src = readFileSync(join(root, 'src', 'lichtschlinge.html'), 'utf8');
src = src.replace('<script src="sim.js"></script>', () => '<script>\n' + readFileSync(join(root, 'src', 'sim.js'), 'utf8') + '</script>');

// Google-Fonts-Verweise durch lokale Schriften ersetzen
const fontLinks = /<link rel="preconnect"[^>]*>\n|<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n/g;
if ((src.match(fontLinks) || []).length !== 3) throw new Error('Schrift-Verweise nicht gefunden');
src = src.replace(fontLinks, '');
const fonts = [
  ['Unbounded', 500, '@fontsource/unbounded/files/unbounded-latin-500-normal.woff2'],
  ['Unbounded', 800, '@fontsource/unbounded/files/unbounded-latin-800-normal.woff2'],
  ['Chakra Petch', 400, '@fontsource/chakra-petch/files/chakra-petch-latin-400-normal.woff2'],
  ['Chakra Petch', 600, '@fontsource/chakra-petch/files/chakra-petch-latin-600-normal.woff2']
];
let css = '';
for (const [family, weight, file] of fonts) {
  const name = file.split('/').pop();
  copyFileSync(join(here, 'node_modules', file), join(out, 'fonts', name));
  css += `@font-face { font-family: "${family}"; font-weight: ${weight}; font-style: normal; font-display: swap; src: url("fonts/${name}") format("woff2"); }\n`;
}
for (const lic of ['@fontsource/unbounded/LICENSE', '@fontsource/chakra-petch/LICENSE']) {
  copyFileSync(join(here, 'node_modules', lic), join(out, 'fonts', lic.split('/')[1] + '-LICENSE.txt'));
}
writeFileSync(join(out, 'fonts.css'), css);
copyFileSync(join(here, 'node_modules', 'peerjs', 'dist', 'peerjs.min.js'), join(out, 'peerjs.min.js'));
copyFileSync(join(here, 'node_modules', 'peerjs', 'LICENSE'), join(out, 'peerjs-LICENSE.txt'));

const cut = src.indexOf('</style>') + 8;
const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="fonts.css">
<script>window.LS_PEER_SRC = 'peerjs.min.js';</script>
${src.slice(0, cut)}
</head>
<body>${src.slice(cut)}</body>
</html>
`;
writeFileSync(join(out, 'index.html'), html);
console.log('app/www gebaut');
