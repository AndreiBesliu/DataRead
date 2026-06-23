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

// ── lead pipeline (status + note, scrise de admini) ──────────────────────────────────────────
import { coerceLeadNotes, coerceLeadStatus } from '../src/types/lead';
check("lead status: 'contacted' trece", coerceLeadStatus('contacted') === 'contacted');
check("lead status: 'won' trece", coerceLeadStatus('won') === 'won');
check('lead status: gunoi → new', coerceLeadStatus('hacked') === 'new' && coerceLeadStatus(null) === 'new' && coerceLeadStatus(42) === 'new');
check('lead notes: non-string → gol', coerceLeadNotes(42) === '' && coerceLeadNotes(null) === '');
check('lead notes: tăiate la plafon', coerceLeadNotes('x'.repeat(9000)).length === 4000);

// ── cereri de marketing (Verticala 1: campanii + plan de conținut) ───────────────────────────
import { coerceToMarketingRequest, deliverableFieldsFor, emptyRequest, DELIVERABLE_LIST_MAX } from '../src/types/request';
import roDict from '../src/i18n/locales/ro';

function roKeyExists(key: string): boolean {
  let node: unknown = roDict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in (node as Record<string, unknown>))) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node.length > 0;
}

check("request kind: 'content' trece", coerceToMarketingRequest({ kind: 'content' }).kind === 'content');
check("request kind: gunoi/lipsa → 'campaign' (compatibilitate cu cererile vechi)", (() => {
  return coerceToMarketingRequest({ kind: 'mega' }).kind === 'campaign' && coerceToMarketingRequest({}).kind === 'campaign';
})());
check('request: format vechi (string) → liste goale (clean break, fără migrare)', (() => {
  const r = coerceToMarketingRequest({ kind: 'content', deliverables: { calendar: 'Ziua 1 blob vechi', posts: 'blob', ideas: 'x' } });
  return r.deliverables.calendar.length === 0 && r.deliverables.posts.length === 0 && r.deliverables.ideas.length === 0;
})());
check('request: adVariants coerce (item parțial → stage default, sub-câmp tăiat, non-obiect → gol)', (() => {
  const r = coerceToMarketingRequest({ deliverables: { adVariants: [
    { hook: 'H', body: 'B', cta: 'Sună', angle: 'urgență', stage: 'cald' },
    { hook: 'x'.repeat(500), stage: 'invalid' },
    'not-an-object',
  ] } });
  const av = r.deliverables.adVariants;
  return av.length === 3 && av[0].stage === 'cald' && av[1].stage === 'rece' && av[1].hook.length === 200 && av[2].hook === '' && av[2].stage === 'rece';
})());
check('request: calendar format enum invalid → gol; valid păstrat', (() => {
  const r = coerceToMarketingRequest({ kind: 'content', deliverables: { calendar: [
    { day: 'Ziua 1', theme: 'Lansare', format: 'reel', channel: 'Instagram' },
    { day: 'Ziua 2', format: 'tiktok-dance' },
  ] } });
  return r.deliverables.calendar[0].format === 'reel' && r.deliverables.calendar[1].format === '';
})());
check('request: ideas = string[] (non-string/goale filtrate, cap item + listă)', (() => {
  const r = coerceToMarketingRequest({ deliverables: { ideas: ['idee bună', 42, '', '  ', 'x'.repeat(500), ...Array(50).fill('umplutură')] } });
  const ideas = r.deliverables.ideas;
  return ideas.length === DELIVERABLE_LIST_MAX.ideas && ideas[0] === 'idee bună' && ideas.every((s) => typeof s === 'string') && ideas.some((s) => s.length === 200);
})());
check('request: cap listă adVariants (>max → tăiat)', coerceToMarketingRequest({ deliverables: { adVariants: Array(20).fill({ hook: 'h' }) } }).deliverables.adVariants.length === DELIVERABLE_LIST_MAX.adVariants);
// Acoperire chei i18n: secțiuni + sub-câmpuri + enum-uri (ro primar; en prin typecheck).
for (const kind of ['campaign', 'content'] as const) {
  for (const f of deliverableFieldsFor(kind)) {
    check(`cheie ro (${kind}): ${f.labelKey}`, roKeyExists(f.labelKey));
    if (f.type === 'objlist') {
      for (const sf of f.itemFields) {
        check(`cheie ro sub-câmp (${kind}): ${sf.labelKey}`, roKeyExists(sf.labelKey));
        if (sf.enum) for (const e of sf.enum) check(`cheie ro enum: ${sf.enumLabelPrefix}${e}`, roKeyExists(`${sf.enumLabelPrefix}${e}`));
      }
    }
  }
}
check('request: non-obiect → empty', JSON.stringify(coerceToMarketingRequest('x')) === JSON.stringify(emptyRequest()));
check('request: defaults corecte', (() => {
  const r = emptyRequest();
  return r.status === 'open' && r.source === 'manual' && r.objective === '' && r.deliverables.adVariants.length === 0 && r.deliverables.ideas.length === 0;
})());
check('request: tipuri greșite → defaults', (() => {
  const r = coerceToMarketingRequest({ title: 42, status: 'archived', source: 'robot', objective: 'spam', deliverables: 'x' });
  return r.title === '' && r.status === 'open' && r.source === 'manual' && r.objective === '' && r.deliverables.notes === '' && r.deliverables.adVariants.length === 0;
})());
check('request: valori valide trec', (() => {
  const r = coerceToMarketingRequest({ title: 'Campanie vară', offer: 'Meniu nou', budget: '500 €', objective: 'sales', status: 'done', source: 'ai', deliverables: { adVariants: [{ hook: 'Hook 1', cta: 'Comandă' }] } });
  return r.title === 'Campanie vară' && r.objective === 'sales' && r.status === 'done' && r.source === 'ai' && r.deliverables.adVariants.length === 1 && r.deliverables.adVariants[0].hook === 'Hook 1' && r.deliverables.videoScripts.length === 0;
})());
check('request: campaignStructure (proză) tăiat la plafon', coerceToMarketingRequest({ deliverables: { campaignStructure: 'x'.repeat(20000) } }).deliverables.campaignStructure.length === 8000);

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
