// Baut index.html (eigenständige Seite) aus src/lichtschlinge.html
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('./src/lichtschlinge.html', import.meta.url), 'utf8');
const head = src.slice(0, src.indexOf('</style>') + 8);
const bodyPart = src.slice(src.indexOf('</style>') + 8);
const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>${bodyPart}</body>
</html>
`;
writeFileSync(new URL('./index.html', import.meta.url), html);
console.log('index.html geschrieben', html.length, 'Bytes');
