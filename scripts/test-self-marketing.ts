// Suite headless: Self Marketing — coerce (profil/strategie/quotă) + validare pură (erorile = chei i18n din ro).
import {
  coerceToSelfCompanyProfile,
  coerceToSelfStrategy,
  coerceToSelfDetails,
  coerceToSelfOpportunities,
  coerceToSelfExecution,
  coerceToSelfQuota,
  OPPORTUNITIES_MAX,
  OPPORTUNITY_LIMITS,
  EXECUTION_WEEKS_MAX,
  EXECUTION_LIMITS,
  emptySelfProfile,
  selfFreeRemaining,
  validateSelfProfile,
  SELF_FREE_TOTAL,
  STRATEGY_DIRECTIONS_MAX,
  STRATEGY_DIRECTION_LIMITS,
  SELF_PROFILE_LIMITS,
  DETAILS_LIMITS,
  type SelfCompanyProfile,
} from '../src/types/selfMarketing';
import ro from '../src/i18n/locales/ro';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

function keyExists(key: string): boolean {
  let node: unknown = ro;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in (node as Record<string, unknown>))) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node.length > 0;
}

function validProfile(): SelfCompanyProfile {
  return {
    ...emptySelfProfile(),
    companyName: 'Presto Construct SRL',
    industry: 'construction',
    productsServices: 'Materiale de construcții și vopseluri pentru renovări.',
    audience: 'Proprietari de case din zona Cluj, 30-55 ani.',
    area: 'Cluj-Napoca',
    goals: 'Mai multe cereri de ofertă și notorietate locală.',
  };
}

console.log('SELF MARKETING — coerce + validare');

// ── coerce profil ──
check('coerce profil: null → empty (schema 1)', coerceToSelfCompanyProfile(null).schema === 1 && coerceToSelfCompanyProfile(null).companyName === '');
check('coerce profil: gunoi nu aruncă', (() => { coerceToSelfCompanyProfile(42 as unknown); coerceToSelfCompanyProfile('x' as unknown); return true; })());
check('coerce profil: industry invalid → ""', coerceToSelfCompanyProfile({ industry: 'magic' }).industry === '');
check('coerce profil: industry valid păstrat', coerceToSelfCompanyProfile({ industry: 'horeca' }).industry === 'horeca');
check('coerce profil: companyName plafonat', coerceToSelfCompanyProfile({ companyName: 'a'.repeat(500) }).companyName.length === SELF_PROFILE_LIMITS.companyName);
check('coerce profil: goals plafonat', coerceToSelfCompanyProfile({ goals: 'g'.repeat(5000) }).goals.length === SELF_PROFILE_LIMITS.goals);

// ── coerce strategie ──
check('coerce strategie: null → 0 direcții', coerceToSelfStrategy(null).directions.length === 0);
check('coerce strategie: direcții peste plafon → capate', coerceToSelfStrategy({ directions: Array.from({ length: 20 }, () => ({ title: 'x' })) }).directions.length === STRATEGY_DIRECTIONS_MAX);
check('coerce strategie: câmp direcție plafonat', (() => {
  const s = coerceToSelfStrategy({ overview: 'o', directions: [{ title: 't'.repeat(500), positioningAngle: 'p'.repeat(2000) }] });
  return s.directions[0].title.length === STRATEGY_DIRECTION_LIMITS.title && s.directions[0].positioningAngle.length === STRATEGY_DIRECTION_LIMITS.positioningAngle;
})());
check('coerce strategie: câmpuri lipsă → "" (nu aruncă)', (() => {
  const s = coerceToSelfStrategy({ directions: [{ title: 'Doar titlu' }] });
  return s.directions[0].kpis === '' && s.directions[0].channelMix === '';
})());

// ── coerce detalii ──
check('coerce detalii: null → empty (schema 1)', coerceToSelfDetails(null).schema === 1 && coerceToSelfDetails(null).budgetSplit === '');
check('coerce detalii: câmpuri peste plafon → clamp', (() => {
  const d = coerceToSelfDetails({ directionTitle: 't'.repeat(500), campaignBrief: 'c'.repeat(5000) });
  return d.directionTitle.length === DETAILS_LIMITS.directionTitle && d.campaignBrief.length === DETAILS_LIMITS.campaignBrief;
})());

// ── coerce oportunități (S2) ──
check('coerce oportunități: null → 0 items', coerceToSelfOpportunities(null).items.length === 0);
check('coerce oportunități: impact invalid → medium', coerceToSelfOpportunities({ items: [{ title: 'x', impact: 'huge' }] }).items[0].impact === 'medium');
check('coerce oportunități: sortare pe impact (high înaintea low)', (() => {
  const o = coerceToSelfOpportunities({ items: [{ title: 'L', impact: 'low' }, { title: 'H', impact: 'high' }, { title: 'M', impact: 'medium' }] });
  return o.items[0].impact === 'high' && o.items[1].impact === 'medium' && o.items[2].impact === 'low';
})());
check('coerce oportunități: peste plafon → capate', coerceToSelfOpportunities({ items: Array.from({ length: 25 }, () => ({ title: 'x', impact: 'high' })) }).items.length === OPPORTUNITIES_MAX);
check('coerce oportunități: câmp plafonat', coerceToSelfOpportunities({ items: [{ title: 't'.repeat(500), impact: 'high' }] }).items[0].title.length === OPPORTUNITY_LIMITS.title);

// ── coerce execuție (S3) ──
check('coerce execuție: null → 0 săptămâni (schema 1)', coerceToSelfExecution(null).weeks.length === 0 && coerceToSelfExecution(null).schema === 1);
check('coerce execuție: săptămâni peste plafon → capate', coerceToSelfExecution({ weeks: Array.from({ length: 12 }, () => ({ title: 'S' })) }).weeks.length === EXECUTION_WEEKS_MAX);
check('coerce execuție: câmpuri plafonate', (() => {
  const e = coerceToSelfExecution({ summary: 's'.repeat(5000), weeks: [{ title: 't'.repeat(500), actions: 'a'.repeat(5000) }] });
  return e.summary.length === EXECUTION_LIMITS.summary && e.weeks[0].title.length === EXECUTION_LIMITS.weekTitle && e.weeks[0].actions.length === EXECUTION_LIMITS.actions;
})());
check('coerce execuție: câmpuri lipsă pe săptămână → "" (nu aruncă)', coerceToSelfExecution({ weeks: [{ title: 'Doar titlu' }] }).weeks[0].kpi === '');

// ── coerce quotă + remaining ──
check('coerce quotă: null → total 0', coerceToSelfQuota(null).total === 0);
check('selfFreeRemaining: fără quotă → trial plin', selfFreeRemaining(null) === SELF_FREE_TOTAL);
check('selfFreeRemaining: scade cu total', selfFreeRemaining(coerceToSelfQuota({ total: 2 })) === SELF_FREE_TOTAL - 2);
check('selfFreeRemaining: nu coboară sub 0', selfFreeRemaining(coerceToSelfQuota({ total: 999 })) === 0);

// ── validare ──
check('validare: profil valid → ok', validateSelfProfile(validProfile()).ok);
check('validare: lipsă nume/ofertă/public/obiective → erori', (() => {
  const r = validateSelfProfile(emptySelfProfile());
  return !r.ok && r.errors.companyName && r.errors.productsServices && r.errors.audience && r.errors.goals && r.errors.industry;
})());
check('validare: industry "other" cere industryOther', (() => {
  const r = validateSelfProfile({ ...validProfile(), industry: 'other', industryOther: '' });
  return !r.ok && r.errors.industryOther === 'selfMarketing.errors.required';
})());
check('validare: buget/zonă/concurenți opționale', (() => {
  const r = validateSelfProfile({ ...validProfile(), budget: '', area: '', competitors: '' });
  return r.ok;
})());
check('validare: tooLong pe câmp peste plafon (input necoerceat)', (() => {
  const r = validateSelfProfile({ ...validProfile(), goals: 'g'.repeat(SELF_PROFILE_LIMITS.goals + 10) });
  return !r.ok && r.errors.goals === 'selfMarketing.errors.tooLong';
})());

// ── cheile i18n de eroare există în ro ──
check('i18n: selfMarketing.errors.required există', keyExists('selfMarketing.errors.required'));
check('i18n: selfMarketing.errors.tooLong există', keyExists('selfMarketing.errors.tooLong'));
check('i18n: selfMarketing.step_strategy + cta există', keyExists('selfMarketing.step_strategy') && keyExists('selfMarketing.cta'));
check('i18n: seo.selfMarketingTitle + nav.selfMarketing există', keyExists('seo.selfMarketingTitle') && keyExists('nav.selfMarketing'));

console.log(`\nself-marketing: ${failures ? failures + ' EȘUATE' : 'all checks passed'}`);
if (failures) process.exit(1);
