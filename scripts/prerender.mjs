// Prerender: servește bundle-ul de producție (dist/), vizitează fiecare rută publică × {ro, en}
// în Chromium headless și scrie HTML-ul randat ca fișiere statice în dist/<path>/index.html.
// Firebase Hosting servește fișierul exact ÎNAINTE de rewrite-ul SPA, deci crawlerele (și primul
// paint) primesc HTML complet fără JS. Emite și dist/sitemap.xml cu alternate hreflang.
//
// Pași: 1) dist/index.html (shell-ul curat) e copiat la dist/app.html — destinația rewrite-ului
// SPA pentru /app|/admin; 2) fiecare rută publică e capturată DUPĂ ce Seo.tsx a rulat
// (titlu + canonical + hreflang în <head>); 3) '/' suprascrie dist/index.html.
import { existsSync, copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { rmSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}

// Rutele publice vin din sursa unică src/site/publicRoutes.ts (bundle temporar prin esbuild).
const tmp = 'scripts/.tmp-public-routes.mjs';
await build({
  entryPoints: ['src/site/publicRoutes.ts'],
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  outfile: tmp,
  define: { 'import.meta.env': '{}' },
  logLevel: 'silent',
});
const { PUBLIC_ROUTES } = await import(pathToFileURL(tmp).href);
rmSync(tmp, { force: true });

// Originea publică pentru sitemap (VITE_SITE_ORIGIN din .env.local / .env, fallback web.app).
function readOrigin() {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf-8').match(/^VITE_SITE_ORIGIN=(.+)$/m);
    if (m) return m[1].trim();
  }
  return 'https://dataread-e1bd6.web.app';
}
const ORIGIN = readOrigin();

const enPath = (slug) => (slug === '/' ? '/en' : `/en${slug}`);
const outFile = (path) => (path === '/' ? 'dist/index.html' : join('dist', path.slice(1), 'index.html'));

// Shell-ul curat devine destinația rewrite-ului SPA (/app, /admin, 404) — ÎNAINTE să suprascriem /.
copyFileSync('dist/index.html', 'dist/app.html');

const server = await preview({ preview: { port: 0 }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();

let pageErrors = 0;
page.on('pageerror', (e) => {
  pageErrors++;
  console.error(`  pageerror: ${e.message}`.slice(0, 200));
});

const targets = [];
for (const r of PUBLIC_ROUTES) {
  targets.push({ path: r.slug, lang: 'ro' });
  targets.push({ path: enPath(r.slug), lang: 'en' });
}

let written = 0;
for (const t of targets) {
  await page.goto(url + t.path, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('[data-page]', { timeout: 15000 });
  await page.waitForTimeout(300); // lasă effect-urile (Seo, i18n) să se așeze
  const html = '<!doctype html>\n' + (await page.evaluate(() => document.documentElement.outerHTML));
  const file = outFile(t.path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html, 'utf-8');
  written++;
  console.log(`  ✓ ${t.path} → ${file}`);
}

await browser.close();
await server.close();

// sitemap.xml — doar rutele indexabile, cu perechi hreflang ro/en + x-default.
const indexable = PUBLIC_ROUTES.filter((r) => !r.noindex);
const urlEntry = (slug) => {
  const ro = ORIGIN + slug;
  const en = ORIGIN + enPath(slug);
  const alts =
    `    <xhtml:link rel="alternate" hreflang="ro" href="${ro}"/>\n` +
    `    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>\n` +
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${ro}"/>`;
  return [ro, en].map((loc) => `  <url>\n    <loc>${loc}</loc>\n${alts}\n  </url>`).join('\n');
};
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
  indexable.map((r) => urlEntry(r.slug)).join('\n') +
  '\n</urlset>\n';
writeFileSync('dist/sitemap.xml', sitemap, 'utf-8');
console.log(`  ✓ sitemap.xml (${indexable.length * 2} URL-uri)`);

if (pageErrors > 0) {
  console.error(`\nPRERENDER: ${pageErrors} pageerror(s) — fail`);
  process.exit(1);
}
console.log(`\nPRERENDER: ${written} pagini scrise. ALL PASS`);
