// Baut index.html (eigenständige Seite) aus src/lichtschlinge.html und src/sim.js
import { readFileSync, writeFileSync } from 'node:fs';
const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');
let src = read('./src/lichtschlinge.html');
const tag = '<script src="sim.js"></script>';
if (!src.includes(tag)) throw new Error('sim.js-Einbindung fehlt');
src = src.replace(tag, () => '<script>\n' + read('./src/sim.js') + '</script>');
const cut = src.indexOf('</style>') + 8;
const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${src.slice(0, cut)}
</head>
<body>${src.slice(cut)}</body>
</html>
`;
writeFileSync(new URL('./index.html', import.meta.url), html);
console.log('index.html geschrieben', html.length, 'Bytes');
