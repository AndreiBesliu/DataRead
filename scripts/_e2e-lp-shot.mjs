// Screenshot al paginii LP compuse de serveLp (scrisă de e2e-lp-serve.mjs) — dovadă vizuală.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'scripts', '.tmp-lp-page.html'), 'utf8');
const out = join(root, 'scripts', 'lp-verif-render.png');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(900); // lasă canvas-ul decor să deseneze câteva cadre
await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log('Screenshot scris:', out);
