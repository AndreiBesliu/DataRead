// Boot smoke test: servește bundle-ul de PRODUCȚIE (dist/) și îl pornește în Chromium headless
// pe o matrice de profile localStorage otrăvite — clasa de bug „aplicația nu se încarcă la un
// client deși la alții merge". Un profil pică dacă apare panoul de eroare React, se declanșează
// un pageerror sau `[DataRead error]` lovește consola. Rulat cu `npm run test:boot`
// (o singură dată: `npx playwright install chromium`); ținut în afara `npm test` pentru că are
// nevoie de browser. Rulat DUPĂ `npm run prerender`, probează și hidratarea HTML-ului static.
import { existsSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}

// ---- Matricea de profile ---------------------------------------------------------------------
const BASE = { dataread_lang: 'ro', dataread_cookie_consent: 'denied' };

const CORRUPT_KEYS = [
  'dataread_lang',
  'dataread_cookie_consent',
  'dataread.onboardingDraft.v1',
  'dataread_ent_u1',
];

const PROFILES = [
  { name: 'vizitator curat /', path: '/', storage: { ...BASE }, expectSelector: '[data-page="landing"]' },
  { name: '/pachete are 3 carduri', path: '/pachete', storage: { ...BASE }, expectSelector: '[data-testid="package-card"]', minCount: 3 },
  {
    name: 'JSON stricat în toate cheile dataread*',
    path: '/',
    storage: Object.fromEntries(CORRUPT_KEYS.map((k) => [k, '{broken json!'])),
    expectSelector: '[data-page="landing"]',
  },
  // Limba derivă din path: chiar cu stored 'ro', /en/pachete trebuie să fie în engleză.
  { name: '/en/pachete în engleză', path: '/en/pachete', storage: { ...BASE }, expectSelector: '[data-page="packages"]', textSelector: 'h1', textIncludes: 'pricing' },
  { name: 'rută inexistentă → 404', path: '/nu-exista', storage: { ...BASE }, expectSelector: '[data-page="not-found"]' },
];

// ---- Runner ------------------------------------------------------------------------------------
const server = await preview({ preview: { port: 0 }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
console.log(`Serving dist at ${url}`);

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
let failures = 0;

for (const profile of PROFILES) {
  const context = await browser.newContext();
  await context.addInitScript((state) => {
    for (const [k, v] of Object.entries(state)) localStorage.setItem(k, v);
  }, profile.storage);

  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error' && /\[DataRead error\]/.test(m.text())) problems.push(`console: ${m.text()}`.slice(0, 200));
  });

  let verdict = '';
  try {
    await page.goto(url + profile.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Sondează până când UI-ul se dovedește viu (selectorul așteptat e vizibil) sau apare panoul
    // de eroare. O scurtă perioadă de grație prinde crash-urile târzii din faza de effects.
    const deadline = Date.now() + 25000;
    let aliveSince = 0;
    for (;;) {
      const state = await page.evaluate(({ sel, minCount, textSelector, textIncludes }) => ({
        errorPanel: [...document.querySelectorAll('div')].some(
          (d) => (d.textContent === 'A apărut o eroare.' || d.textContent === 'Something went wrong.') && d.children.length === 0
        ),
        target:
          document.querySelectorAll(sel).length >= (minCount || 1) &&
          (!textSelector || (document.querySelector(textSelector)?.textContent || '').includes(textIncludes)),
      }), {
        sel: profile.expectSelector,
        minCount: profile.minCount,
        textSelector: profile.textSelector,
        textIncludes: profile.textIncludes,
      });
      if (state.errorPanel) { verdict = 'error panel shown'; break; }
      if (state.target && !aliveSince) aliveSince = Date.now();
      if (state.target && Date.now() - aliveSince > 1500) break; // viu și a rămas viu
      if (Date.now() > deadline) { verdict = `timeout (target=${state.target})`; break; }
      await new Promise((r) => setTimeout(r, 250));
    }
  } catch (e) {
    verdict = `navigation failed: ${e.message}`.slice(0, 160);
  }
  if (problems.length && !verdict) verdict = problems[0];

  if (verdict) {
    failures++;
    console.error(`  ✗ ${profile.name} — ${verdict}`);
    for (const p of problems.slice(0, 3)) console.error(`      ${p}`);
  } else {
    console.log(`  ✓ ${profile.name}`);
  }
  await context.close();
}

await browser.close();
await server.close();
console.log(failures === 0 ? '\nBOOT SMOKE: ALL PASS' : `\nBOOT SMOKE: ${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
