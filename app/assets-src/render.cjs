// Rendert Icon und Store-Grafiken aus graphics.html (node assets-src/render.cjs im Ordner app)
const { chromium } = require('playwright');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const jobs = [
  // [Datei, kind, w, h, logo]
  ['app/assets/icon.png', 'icon', 1024, 1024],
  ['app/assets/icon-foreground.png', 'fg', 1024, 1024],
  ['store/play/icon-512.png', 'icon', 512, 512],
  ['store/play/feature-graphic-1024x500.png', 'scene', 1024, 500, 1],
  ['store/steam/header-capsule-920x430.png', 'scene', 920, 430, 1],
  ['store/steam/small-capsule-462x174.png', 'scene', 462, 174, 1],
  ['store/steam/main-capsule-1232x706.png', 'scene', 1232, 706, 1],
  ['store/steam/vertical-capsule-748x896.png', 'scene', 748, 896, 1],
  ['store/steam/library-capsule-600x900.png', 'scene', 600, 900, 1],
  ['store/steam/library-header-920x430.png', 'scene', 920, 430, 1],
  ['store/steam/library-hero-3840x1240.png', 'scene', 3840, 1240, 0],
  ['store/steam/library-logo-1280x720.png', 'logo', 1280, 720],
  ['store/steam/page-background-1438x810.png', 'scene', 1438, 810, 0],
  ['store/steam/community-icon-184x184.png', 'icon', 184, 184]
];
(async () => {
  const b = await chromium.launch();
  for (const [file, kind, w, h, logo] of jobs) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('file://' + path.join(__dirname, 'graphics.html') + `?kind=${kind}&w=${w}&h=${h}&logo=${logo ? 1 : 0}`);
    await p.waitForFunction(() => document.title === 'fertig');
    await p.locator('canvas').screenshot({ path: path.join(root, file), omitBackground: kind === 'fg' || kind === 'logo' });
    await p.close();
    console.log(file);
  }
  await b.close();
})();
