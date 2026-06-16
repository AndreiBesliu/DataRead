// Suite headless: Self Marketing — coerce (profil/strategie/quotă) + validare pură (erorile = chei i18n din ro).
import {
  coerceToSelfCompanyProfile,
  coerceToSelfStrategy,
  coerceToSelfQuota,
  emptySelfProfile,
  selfFreeRemaining,
  validateSelfProfile,
  SELF_FREE_TOTAL,
  STRATEGY_DIRECTIONS_MAX,
  STRATEGY_DIRECTION_LIMITS,
  SELF_PROFILE_LIMITS,
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
