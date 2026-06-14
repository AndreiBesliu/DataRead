// Verificare vizuală: decorul se scalează cu lățimea containerului. Randează ACELAȘI decor în 3 boxuri
// de lățimi diferite (390 / 640 / 900), fiecare cu un pătrat alb de referință FIX (40px) — dacă decorul
// scalează, punctele/elementele se micșorează relativ la pătrat pe boxurile mai înguste.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rmSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, 'scripts', '.tmp-decor-scale.cjs');
await build({ entryPoints: [join(root, 'scripts', '_e2e-lp-entry.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: tmp, define: { 'import.meta.env': '{}' }, logLevel: 'silent', external: ['react'] });
const C = createRequire(import.meta.url)(tmp);

const WIDTHS = [390, 640, 900];
const ref = '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:40px;height:40px;background:#fff;border-radius:4px;z-index:2"></div>';

function box(decor, w, idx) {
  const html = C.compileDecor(C.coerceToLpDecor(decor), `b${idx}`, 'block');
  return `<div style="position:relative;width:${w}px;height:360px;background:#0a0f1e;border:1px solid #243154;border-radius:8px;overflow:hidden;flex:0 0 auto">${html}${ref}<div style="position:absolute;top:6px;left:8px;color:#8a9ac0;font:12px sans-serif;z-index:3">${w}px</div></div>`;
}

const constellation = { effect: 'constellation', interaction: 'none', density: 70, speed: 30, size: 4, color: '#38bdf8', opacity: 0.8, intensity: 50 };
const custom = {
  effect: 'custom', interaction: 'none', intensity: 50,
  elements: [
    { shape: 'circle', x: 30, y: 35, size: 70, color: '#38bdf8', opacity: 0.9, anim: 'none' },
    { shape: 'star', x: 68, y: 60, size: 80, color: '#f59e0b', opacity: 0.9, anim: 'none' },
    { shape: 'ring', x: 50, y: 75, size: 60, color: '#22c55e', opacity: 0.9, anim: 'none' },
  ],
};

const row = (title, decor) =>
  `<h3 style="color:#e8eefc;font:600 14px sans-serif;margin:18px 0 8px">${title}</h3>` +
  `<div style="display:flex;gap:14px;align-items:flex-start">${WIDTHS.map((w, i) => box(decor, w, `${title.slice(0, 3)}${i}`)).join('')}</div>`;

const page = `<body style="margin:0;padding:18px;background:#05070f">${row('Constellation', constellation)}${row('Custom (freeform)', custom)}</body>`;

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 2000, height: 860 }, deviceScaleFactor: 1 });
await pg.setContent(page, { waitUntil: 'networkidle' });
await pg.waitForTimeout(800);
const out = join(root, 'scripts', 'decor-scale.png');
await pg.screenshot({ path: out, fullPage: true });
await browser.close();
rmSync(tmp, { force: true });
console.log('Screenshot scris:', out);
