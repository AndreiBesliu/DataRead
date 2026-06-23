// Suite headless: normaliserul auditului SEO (coerceToSeoAudit) + nota + paritatea cheilor i18n (ro+en).
// Extragerea/scorul trăiesc în functions (au nevoie de fetch) și sunt testate în scripts/e2e-lp-serve.mjs.
import { coerceToSeoAudit, seoGrade, SEO_GRADE_COLORS, SEO_SEVERITIES, SEO_PRIORITIES } from '../src/types/seoAudit';
import ro from '../src/i18n/locales/ro';
import en from '../src/i18n/locales/en';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}
function keyIn(dict: unknown, key: string): boolean {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in (node as Record<string, unknown>))) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node.length > 0;
}
const inBoth = (k: string) => keyIn(ro, k) && keyIn(en, k);

// coerce.
check('coerce(null) → defaults sigure', (() => {
  const a = coerceToSeoAudit(null);
  return a.schema === 1 && a.score === 0 && a.signals === null && a.issues.length === 0 && a.recommendations.length === 0 && a.url === '' && a.keyword === '';
})());
check('coerce: scor plafonat 0-100 + rotunjit', coerceToSeoAudit({ score: 250 }).score === 100 && coerceToSeoAudit({ score: -5 }).score === 0 && coerceToSeoAudit({ score: 73.6 }).score === 74);
check('coerce: issues — enum fallback + clamp', (() => {
  const a = coerceToSeoAudit({ issues: [{ severity: 'boom', area: 'nope', message: 'x' }, 'gunoi'] });
  return a.issues.length === 2 && a.issues[0].severity === 'warning' && a.issues[0].area === 'technical' && a.issues[1].message === '';
})());
check('coerce: recommendations — priority fallback', (() => {
  const a = coerceToSeoAudit({ recommendations: [{ priority: 'urgent', title: 'T', detail: 'D' }] });
  return a.recommendations[0].priority === 'medium' && a.recommendations[0].title === 'T';
})());
check('coerce: signals coerce-uite (numere/booleeni)', (() => {
  const a = coerceToSeoAudit({ signals: { title: 'Salut', titleLength: 5, h1Count: 1, hasViewport: true, keywordDensity: 2.5 } });
  return !!a.signals && a.signals.title === 'Salut' && a.signals.titleLength === 5 && a.signals.h1Count === 1 && a.signals.hasViewport === true && a.signals.keywordDensity === 2.5;
})());
check('coerce: signals lipsă → null', coerceToSeoAudit({ signals: 'gunoi' }).signals === null);

// seoGrade.
check('seoGrade: praguri A–F', seoGrade(95) === 'A' && seoGrade(80) === 'B' && seoGrade(65) === 'C' && seoGrade(45) === 'D' && seoGrade(10) === 'F');
check('SEO_GRADE_COLORS: hex valid pt. fiecare notă', ['A', 'B', 'C', 'D', 'F'].every((g) => /^#[0-9a-fA-F]{6}$/.test(SEO_GRADE_COLORS[g])));

// i18n.
check('admin.navSeo + admin.seo.* în ro+en', ['admin.navSeo', 'admin.seo.title', 'admin.seo.hint', 'admin.seo.url', 'admin.seo.run', 'admin.seo.issues', 'admin.seo.recommendations', 'admin.seo.history'].every(inBoth));
check('admin.seo severități + fact-labels în ro+en', [...SEO_SEVERITIES.map((s) => `admin.seo.sev_${s}`), 'admin.seo.f_title', 'admin.seo.f_meta', 'admin.seo.f_words', 'admin.seo.f_imgAlt', 'admin.seo.f_links', 'admin.seo.f_density'].every(inBoth));
check('enum-uri SEO ne-goale', SEO_SEVERITIES.length === 3 && SEO_PRIORITIES.length === 3);

if (failures) { console.error(`${failures} checks failed`); process.exit(1); }
console.log('seo audit: all checks passed');
