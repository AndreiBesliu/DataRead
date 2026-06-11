// Suite headless: normaliserii de date persistate — invariantul „corupt/legacy/viitor → defaults
// sigure, niciodată throw" (clasa de bug a incidentului CNCVS „aplicația nu se mai încarcă").
import { coerceToClientProfile } from '../src/types/client';
import { coerceToOnboarding, coerceToOnboardingDraft, emptyOnboarding } from '../src/types/onboarding';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

// ── coerceToClientProfile ─────────────────────────────────────────────────────────────────────
check('client: undefined → null', coerceToClientProfile(undefined) === null);
check('client: null → null', coerceToClientProfile(null) === null);
check('client: string → null', coerceToClientProfile('garbage') === null);
check('client: {} → defaults', (() => {
  const p = coerceToClientProfile({});
  return !!p && p.schema === 1 && p.locale === 'ro' && p.onboardingStatus === 'none' && p.entitlement === null;
})());
check('client: tipuri greșite → defaults', (() => {
  const p = coerceToClientProfile({ email: 42, displayName: [], locale: 'de', onboardingStatus: 'maybe', entitlement: 'yes' });
  return !!p && p.email === null && p.displayName === null && p.locale === 'ro' && p.onboardingStatus === 'none' && p.entitlement === null;
})());
check('client: entitlement corupt → normalizat', (() => {
  const p = coerceToClientProfile({ entitlement: { active: 'yes', status: 7, periodEnd: 'soon', priceId: 9 } });
  return !!p && !!p.entitlement && p.entitlement.active === false && p.entitlement.status === 'none'
    && p.entitlement.periodEnd === 0 && p.entitlement.priceId === null;
})());
check('client: valori valide trec', (() => {
  const p = coerceToClientProfile({ email: 'x@y.ro', locale: 'en', onboardingStatus: 'submitted', entitlement: { active: true, status: 'active', periodEnd: 123, priceId: 'price_1' } });
  return !!p && p.email === 'x@y.ro' && p.locale === 'en' && p.onboardingStatus === 'submitted'
    && p.entitlement?.active === true && p.entitlement.periodEnd === 123;
})());
check('client: schema viitoare → normalizat la 1, fără throw', (() => {
  const p = coerceToClientProfile({ schema: 99, newField: { deep: true } });
  return !!p && p.schema === 1;
})());

// ── coerceToOnboarding ────────────────────────────────────────────────────────────────────────
check('onboarding: non-obiect → empty', JSON.stringify(coerceToOnboarding('x')) === JSON.stringify(emptyOnboarding()));
check('onboarding: null → empty', JSON.stringify(coerceToOnboarding(null)) === JSON.stringify(emptyOnboarding()));
check('onboarding: tipuri greșite → defaults', (() => {
  const o = coerceToOnboarding({ companyName: 42, objectives: 'leads', industry: 'space', adBudget: 1000, packageInterest: 'mega' });
  return o.companyName === '' && o.objectives.length === 0 && o.industry === '' && o.adBudget === '' && o.packageInterest === null;
})());
check('onboarding: obiective filtrate + dedup', (() => {
  const o = coerceToOnboarding({ objectives: ['leads', 'nope', 'sales', 'leads', 7] });
  return JSON.stringify(o.objectives) === JSON.stringify(['leads', 'sales']);
})());
check('onboarding: stringuri tăiate la plafon', coerceToOnboarding({ description: 'x'.repeat(5000) }).description.length === 2000);
check('onboarding: valori valide trec', (() => {
  const o = coerceToOnboarding({ companyName: 'Firma SRL', industry: 'horeca', objectives: ['leads'], adBudget: 'b250_500', packageInterest: 'growth' });
  return o.companyName === 'Firma SRL' && o.industry === 'horeca' && o.adBudget === 'b250_500' && o.packageInterest === 'growth';
})());

// ── coerceToOnboardingDraft (calea localStorage) ─────────────────────────────────────────────
check('draft: null → null', coerceToOnboardingDraft(null) === null);
check('draft: JSON stricat → null, fără throw', coerceToOnboardingDraft('{broken json!') === null);
check('draft: "null" → empty (nu crash)', (() => {
  const d = coerceToOnboardingDraft('null');
  return d === null || d.schema === 1; // JSON.parse('null') → null → coerce decide; important: nu aruncă
})());
check('draft: valid → date', coerceToOnboardingDraft('{"companyName":"Test"}')?.companyName === 'Test');

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('normalisers: all checks passed');
