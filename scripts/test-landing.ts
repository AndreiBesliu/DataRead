// Suite headless: coerce + slug + validare submission (landingPage.ts) + math rollup (lpStats.ts).
import {
  coerceToLandingPage,
  coerceToLpSubmission,
  sanitizeSlug,
  sanitizeSubmissionValues,
  LP_HTML_MAX,
  LP_FORM_FIELDS_MAX,
  type LpFormField,
} from '../src/types/landingPage';
import {
  bucketKey,
  coerceToLpStatsDay,
  lpKpis,
  sumLpStats,
  topEntries,
  type LpStatsDay,
} from '../src/analytics/lpStats';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// ── coerceToLandingPage ──
check('coerce(null) → default sigur (draft, html gol, slug gol)', (() => {
  const lp = coerceToLandingPage(null);
  return lp.status === 'draft' && lp.html === '' && lp.slug === '' && lp.schema === 1 && lp.lang === 'ro';
})());
check('coerce(gunoi) nu aruncă, design valid', (() => {
  const lp = coerceToLandingPage({ status: 'turbo', design: { vars: { accent: 'nu-e-hex' } }, lang: 'fr' });
  return lp.status === 'draft' && HEX.test(lp.design.vars.accent) && lp.lang === 'ro';
})());
check('coerce: html peste limită → tăiat la LP_HTML_MAX', (() => {
  const lp = coerceToLandingPage({ html: 'x'.repeat(LP_HTML_MAX + 5000) });
  return lp.html.length === LP_HTML_MAX;
})());
check('coerce: status published păstrat', coerceToLandingPage({ status: 'published' }).status === 'published');
check('invariant hasForm === form.enabled (true)', coerceToLandingPage({ form: { enabled: true } }).hasForm === true);
check('invariant hasForm === form.enabled (hasForm ignorat fără enabled)', coerceToLandingPage({ hasForm: true, form: { enabled: false } }).hasForm === false);
check('coerce: câmpuri form plafonate la LP_FORM_FIELDS_MAX', (() => {
  const fields = Array.from({ length: 20 }, (_, i) => ({ name: `f${i}`, type: 'text' }));
  return coerceToLandingPage({ form: { enabled: true, fields } }).form.fields.length === LP_FORM_FIELDS_MAX;
})());
check('coerce: tip câmp necunoscut → text; options doar pt select', (() => {
  const lp = coerceToLandingPage({ form: { enabled: true, fields: [
    { name: 'a', type: 'magic', options: ['x'] },
    { name: 'b', type: 'select', options: ['x', 'y'] },
  ] } });
  const a = lp.form.fields[0];
  const b = lp.form.fields[1];
  return a.type === 'text' && a.options.length === 0 && b.type === 'select' && b.options.length === 2;
})());
check('coerce: câmp fără name → eliminat', coerceToLandingPage({ form: { enabled: true, fields: [{ type: 'text' }] } }).form.fields.length === 0);

// ── sanitizeSlug ──
check('slug: "Hello World!" → hello-world', sanitizeSlug('Hello World!') === 'hello-world');
check('slug: diacritice "Pagină Nouă" → pagina-noua', sanitizeSlug('Pagină Nouă') === 'pagina-noua');
check('slug: taie dash-uri marginale + duble', sanitizeSlug('--A & B--') === 'a-b');
check('slug: gol rămâne gol', sanitizeSlug('') === '' && sanitizeSlug(42) === '');
check('slug: lungime plafonată', sanitizeSlug('a'.repeat(200)).length <= 60);

// ── submissions ──
check('sanitizeSubmissionValues: aruncă chei necunoscute, plafonează, semnalează required', (() => {
  const fields: LpFormField[] = [
    { name: 'email', label: 'Email', type: 'email', required: true, options: [] },
    { name: 'msg', label: 'Mesaj', type: 'textarea', required: false, options: [] },
  ];
  const r = sanitizeSubmissionValues({ email: '', msg: 'salut', hacker: 'drop' }, fields);
  return r.values.msg === 'salut' && !('hacker' in r.values) && r.missingRequired.length === 1 && r.missingRequired[0] === 'email';
})());
check('coerceToLpSubmission: doar valori string, plafonate', (() => {
  const s = coerceToLpSubmission({ values: { a: 'x'.repeat(5000), b: 99 }, referrer: 'https://r' });
  return s.values.a.length === 2000 && !('b' in s.values) && s.status === 'new' && s.schema === 1;
})());

// ── lpStats (math rollup) ──
const day = (over: Partial<LpStatsDay>): LpStatsDay => coerceToLpStatsDay({ date: '2026-06-13', ...over })!;
check('coerceToLpStatsDay: dată invalidă → null', coerceToLpStatsDay({ date: 'azi' }) === null);
check('coerceToLpStatsDay: dată validă → obiect', coerceToLpStatsDay({ date: '2026-06-13', visits: 5 })?.visits === 5);
check('sumLpStats: adună vizite + hărți', (() => {
  const t = sumLpStats([
    day({ visits: 10, bySource: { google: 6, meta: 4 } }),
    day({ visits: 5, bySource: { google: 2, other: 3 } }),
  ]);
  return t.visits === 15 && t.bySource.google === 8 && t.bySource.meta === 4 && t.bySource.other === 3;
})());
check('lpKpis: convRate = submissions/visits', (() => {
  const k = lpKpis(sumLpStats([day({ visits: 100, submissions: 5 })]));
  return k.convRate === 0.05;
})());
check('lpKpis: numitor 0 → null (nu NaN)', (() => {
  const k = lpKpis(sumLpStats([day({ visits: 0, submissions: 0, beacons: 0 })]));
  return k.convRate === null && k.avgScrollPct === null && k.avgTimeSec === null;
})());
check('lpKpis: avgTimeSec = timeOnPageSum/beacons/1000', (() => {
  const k = lpKpis(sumLpStats([day({ beacons: 2, timeOnPageSum: 30000 })]));
  return k.avgTimeSec === 15;
})());
check('topEntries: sortează descrescător + limitează', (() => {
  const top = topEntries({ a: 1, b: 9, c: 5 }, 2);
  return top.length === 2 && top[0][0] === 'b' && top[1][0] === 'c';
})());
check('bucketKey: whitelist păstrat, restul → other', (() => {
  const wl = ['google', 'meta'];
  return bucketKey('GOOGLE', wl) === 'google' && bucketKey('shady', wl) === 'other' && bucketKey('', wl) === 'other';
})());

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('landing pages: all checks passed');
