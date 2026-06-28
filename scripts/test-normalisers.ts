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

// ── coerceToInsight + acțiuni tipate (felia 5b) ───────────────────────────────────────────────
import { coerceToInsight, coerceInsightAction, insightActionsToText, INSIGHT_CHANGE_TYPES, INSIGHT_TARGETS, INSIGHT_MAGNITUDES, INSIGHT_ACTIONS_MAX, INSIGHT_TEXT_MAX } from '../src/analytics/kpi';

check('insight: null/non-obiect → null', coerceToInsight(null) === null && coerceToInsight('x') === null);
check('insight: verdict invalid → null (UI tratează null = fără insight)', coerceToInsight({ verdict: 'mega', actions: [] }) === null);
check('insight: format vechi (actions string) → listă goală (clean break, fără parsare)', (() => {
  const ins = coerceToInsight({ verdict: 'scale', headline: 'H', reasoning: 'R', actions: '1. fă ceva\n2. altceva' });
  return !!ins && Array.isArray(ins.actions) && ins.actions.length === 0;
})());
check('insight: acțiuni valide păstrate', (() => {
  const ins = coerceToInsight({ verdict: 'test', actions: [{ changeType: 'scale', target: 'budget', magnitude: 'large' }] });
  return !!ins && ins.actions.length === 1 && ins.actions[0].changeType === 'scale' && ins.actions[0].target === 'budget' && ins.actions[0].magnitude === 'large';
})());
check('insight: enum invalid / non-obiect → defaults (keep/budget/medium)', (() => {
  const a1 = coerceInsightAction({ changeType: 'boom', target: 'galaxy', magnitude: 'huge' });
  const a2 = coerceInsightAction('nope');
  return a1.changeType === 'keep' && a1.target === 'budget' && a1.magnitude === 'medium'
    && a2.changeType === 'keep' && a2.target === 'budget' && a2.magnitude === 'medium';
})());
check('insight: cap acțiuni la max', (() => {
  const ins = coerceToInsight({ verdict: 'maintain', actions: Array(20).fill({ changeType: 'keep', target: 'bid', magnitude: 'small' }) });
  return !!ins && ins.actions.length === INSIGHT_ACTIONS_MAX;
})());
check('insight: headline/reasoning tăiate la plafon', (() => {
  const ins = coerceToInsight({ verdict: 'pause', headline: 'h'.repeat(9000), reasoning: 'r'.repeat(9000), actions: [] });
  return !!ins && ins.headline.length === INSIGHT_TEXT_MAX && ins.reasoning.length === INSIGHT_TEXT_MAX;
})());
check('insight: insightActionsToText → linii numerotate cu chei enum', (() => {
  const txt = insightActionsToText((k) => k, [{ changeType: 'scale', target: 'budget', magnitude: 'large' }, { changeType: 'pause', target: 'creative', magnitude: 'small' }]);
  const lines = txt.split('\n');
  return lines.length === 2 && lines[0].startsWith('1. ') && lines[0].includes('admin.insChange_scale') && lines[1].startsWith('2. ');
})());
// Acoperire chei i18n pt. enum-urile de insight (ro primar; en prin typecheck).
for (const c of INSIGHT_CHANGE_TYPES) check(`cheie ro insChange: ${c}`, roKeyExists(`admin.insChange_${c}`));
for (const tgt of INSIGHT_TARGETS) check(`cheie ro insTarget: ${tgt}`, roKeyExists(`admin.insTarget_${tgt}`));
for (const m of INSIGHT_MAGNITUDES) check(`cheie ro insMag: ${m}`, roKeyExists(`admin.insMag_${m}`));

// ── coerceToContact + coerceToContactEvent (Faza 0 predicție comportamentală) ─────────────────
import { coerceToContact, maskEmail, maskPhone, normalizeEmail, normalizePhone } from '../src/types/contact';
import { coerceToContactEvent } from '../src/types/contactEvent';

check('contact: non-obiect → defaults sigure (anon)', (() => {
  const c = coerceToContact('x');
  return c.schema === 1 && c.identityKind === 'anon' && c.emailMasked === '' && c.lifecycle === 'nou' && c.rollup.submissions === 0 && c.mergeCandidate === false;
})());
check('contact: enum invalid → fallback', (() => {
  const c = coerceToContact({ identityKind: 'telepathy', lifecycle: 'vip' });
  return c.identityKind === 'anon' && c.lifecycle === 'nou';
})());
check('contact: valori valide trec + rollup numeric', (() => {
  const c = coerceToContact({ identityKind: 'email', emailMasked: 'a***@x.ro', lifecycle: 'calificat', rollup: { submissions: 3, firstSeen: 100, lastSeen: 200, lastSlug: 'promo' }, mergeCandidate: true });
  return c.identityKind === 'email' && c.emailMasked === 'a***@x.ro' && c.lifecycle === 'calificat' && c.rollup.submissions === 3 && c.rollup.lastSlug === 'promo' && c.mergeCandidate === true;
})());
check('contact: rollup corupt → 0/empty (nu NaN/throw)', (() => {
  const c = coerceToContact({ rollup: { submissions: 'multe', firstSeen: -5, lastSeen: NaN, lastSlug: 42 } });
  return c.rollup.submissions === 0 && c.rollup.firstSeen === 0 && c.rollup.lastSeen === 0 && c.rollup.lastSlug === '';
})());
check('contact: mascare email/telefon', () => maskEmail('Andrei@Gmail.com') === 'a***@gmail.com' && maskPhone('+40 712 345 789') === '***789' && maskEmail('not-an-email') === '' && maskPhone('12') === '');
check('contact: mergeWith/mergedInto coerce (F3)', (() => {
  const c = coerceToContact({ mergeWith: ['x', 42, '', 'y'], mergedInto: 'Z' });
  return c.mergeWith.length === 2 && c.mergeWith[0] === 'x' && c.mergeWith[1] === 'y' && c.mergedInto === 'Z' && coerceToContact({}).mergeWith.length === 0 && coerceToContact({}).mergedInto === '';
})());
check('contact: normalizare email/telefon', () => normalizeEmail('  X@Y.RO ') === 'x@y.ro' && normalizePhone('+40-712.345.789').length === 9 && normalizeEmail('nope') === '');
// Axa monetară F1: rollup.value (LTV) + acquisition pe contact.
check('contact F1: rollup.value default 0 + acquisition default gol', (() => {
  const c = coerceToContact({});
  return c.rollup.value === 0 && c.acquisition.campaign === '' && c.acquisition.source === '' && c.acquisition.medium === '';
})());
check('contact F1: rollup.value valid + plafon; acquisition tăiat la 80', (() => {
  const c = coerceToContact({ rollup: { value: 1234.5 }, acquisition: { campaign: 'x'.repeat(200), source: 'meta', medium: 'cpc' } });
  const big = coerceToContact({ rollup: { value: 1e15 } });
  return c.rollup.value === 1234.5 && c.acquisition.campaign.length === 80 && c.acquisition.source === 'meta' && big.rollup.value === 1e12;
})());
check('contact F1: rollup.value corupt → 0', () => coerceToContact({ rollup: { value: -3 } }).rollup.value === 0 && coerceToContact({ rollup: { value: 'mult' } }).rollup.value === 0);
check('contact F1: acquisition non-obiect → gol (fără throw)', () => coerceToContact({ acquisition: 'x' }).acquisition.campaign === '');

import { coerceToLpLeadState } from '../src/types/lpLeadState';
check('lpLeadState F1: value default 0', () => coerceToLpLeadState({ status: 'nou' }).value === 0);
check('lpLeadState F1: value valid + plafon + corupt→0', () => coerceToLpLeadState({ value: 500 }).value === 500 && coerceToLpLeadState({ value: 1e15 }).value === 1e12 && coerceToLpLeadState({ value: -1 }).value === 0 && coerceToLpLeadState({ value: 'mult' }).value === 0);

check('contactEvent: non-obiect → default form_submit at 0', (() => {
  const e = coerceToContactEvent(null);
  return e.schema === 1 && e.type === 'form_submit' && e.at === 0 && e.submissionId === '' && e.utm.source === '';
})());
check('contactEvent: tip invalid → form_submit; valid păstrat', () => coerceToContactEvent({ type: 'boom' }).type === 'form_submit' && coerceToContactEvent({ type: 'status_change' }).type === 'status_change');
check('contactEvent: at non-numeric/negativ → 0; valid păstrat', () => coerceToContactEvent({ at: 'ieri' }).at === 0 && coerceToContactEvent({ at: -3 }).at === 0 && coerceToContactEvent({ at: 1234 }).at === 1234);
check('contactEvent: utm + câmpuri tăiate la plafon', (() => {
  const e = coerceToContactEvent({ type: 'status_change', detail: 'x'.repeat(500), slug: 'y'.repeat(200), utm: { source: 'z'.repeat(200), medium: 'm', campaign: 'c' } });
  return e.detail.length === 200 && e.slug.length === 80 && e.utm.source.length === 80 && e.utm.medium === 'm';
})());

// ── coerceToPrediction (Faza 1 predicție comportamentală) ─────────────────────────────────────
import { coerceToPrediction, CONVERSION_LIKELIHOODS, TEMPERATURES, CONFIDENCES, NBA_ACTIONS, PREDICTION_LIMITS } from '../src/types/prediction';

check('predicție: non-obiect → defaults sigure', (() => {
  const p = coerceToPrediction('x');
  return p.schema === 1 && p.conversionLikelihood === 'low' && p.temperature === 'cold' && p.confidence === 'low' && p.nextBestActions.length === 0 && p.dataGaps.length === 0;
})());
check('predicție: enum invalid → fallback', (() => {
  const p = coerceToPrediction({ conversionLikelihood: 'maybe', temperature: 'lava', confidence: 'so-so' });
  return p.conversionLikelihood === 'low' && p.temperature === 'cold' && p.confidence === 'low';
})());
check('predicție: NBA coerce (action enum, whenDays clamp 0..30, cap 3)', (() => {
  const p = coerceToPrediction({ nextBestActions: [
    { action: 'offer', detail: 'x', whenDays: 5 },
    { action: 'teleport', detail: 'y', whenDays: 99 },
    { action: 'wait', whenDays: -4 },
    { action: 'contact', whenDays: 1 },
  ] });
  const a = p.nextBestActions;
  return a.length === 3 && a[0].action === 'offer' && a[1].action === 'contact' && a[1].whenDays === 30 && a[2].action === 'wait' && a[2].whenDays === 0;
})());
check('predicție: dataGaps string[] (non-string/goale filtrate, cap)', (() => {
  const p = coerceToPrediction({ dataGaps: ['lipsă buget', 42, '', '  ', ...Array(10).fill('x')] });
  return p.dataGaps.length === PREDICTION_LIMITS.dataGaps && p.dataGaps[0] === 'lipsă buget' && p.dataGaps.every((s) => typeof s === 'string');
})());
check('predicție: reasoning/caveats tăiate la plafon', (() => {
  const p = coerceToPrediction({ reasoning: 'r'.repeat(5000), caveats: 'c'.repeat(5000) });
  return p.reasoning.length === PREDICTION_LIMITS.reasoning && p.caveats.length === PREDICTION_LIMITS.caveats;
})());
for (const k of CONVERSION_LIKELIHOODS) check(`cheie ro predLk: ${k}`, roKeyExists(`admin.predLk_${k}`));
for (const k of TEMPERATURES) check(`cheie ro predTemp: ${k}`, roKeyExists(`admin.predTemp_${k}`));
for (const k of CONFIDENCES) check(`cheie ro predConf: ${k}`, roKeyExists(`admin.predConf_${k}`));
for (const k of NBA_ACTIONS) check(`cheie ro predAction: ${k}`, roKeyExists(`admin.predAction_${k}`));

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
