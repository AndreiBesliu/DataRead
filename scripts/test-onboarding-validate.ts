// Suite headless: validarea pură a onboarding-ului (erorile = chei i18n, verificate că există în ro).
import { emptyOnboarding, normaliseUrl, validateOnboarding, type OnboardingData } from '../src/types/onboarding';
import ro from '../src/i18n/locales/ro';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

function valid(): OnboardingData {
  return {
    ...emptyOnboarding(),
    companyName: 'Firma Mea SRL',
    contactName: 'Ion Popescu',
    contactEmail: 'ion@firma.ro',
    contactPhone: '0722 123 456',
    industry: 'horeca',
    objectives: ['leads'],
    adBudget: 'b250_500',
    description: 'Restaurant cu specific local, public 25-45 din Cluj.',
  };
}

function keyExists(key: string): boolean {
  let node: unknown = ro;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in (node as Record<string, unknown>))) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node.length > 0;
}

// Formular valid → trece.
check('formular valid → ok', validateOnboarding(valid()).ok);

// Obligatorii.
check('formular gol → multe erori', (() => {
  const r = validateOnboarding(emptyOnboarding());
  return !r.ok && ['companyName', 'contactName', 'contactEmail', 'contactPhone', 'industry', 'objectives', 'adBudget', 'description'].every((f) => f in r.errors);
})());
check('fără obiective → eroarea dedicată', validateOnboarding({ ...valid(), objectives: [] }).errors.objectives === 'onboarding.errors.objectives');
check('industry other fără detalii → required', 'industryOther' in validateOnboarding({ ...valid(), industry: 'other', industryOther: '' }).errors);
check('industry other cu detalii → ok', validateOnboarding({ ...valid(), industry: 'other', industryOther: 'Agricultură' }).ok);

// Formate.
check('email invalid', validateOnboarding({ ...valid(), contactEmail: 'nu-e-email' }).errors.contactEmail === 'onboarding.errors.email');
check('telefon prea scurt', validateOnboarding({ ...valid(), contactPhone: '12 34' }).errors.contactPhone === 'onboarding.errors.phone');
check('telefon cu prefix +40 → ok', validateOnboarding({ ...valid(), contactPhone: '+40 722 123 456' }).ok);
check('descriere peste plafon → tooLong', validateOnboarding({ ...valid(), description: 'x'.repeat(2001) }).errors.description === 'onboarding.errors.tooLong');
check('website invalid', 'website' in validateOnboarding({ ...valid(), website: 'doar text' }).errors);
check('website fără schemă dar valid → ok', validateOnboarding({ ...valid(), website: 'firma-ta.ro' }).ok);

// normaliseUrl.
check("normaliseUrl('') = ''", normaliseUrl('') === '');
check("normaliseUrl('firma.ro') adaugă https", normaliseUrl('firma.ro') === 'https://firma.ro');
check("normaliseUrl păstrează https existent", normaliseUrl('https://firma.ro') === 'https://firma.ro');
check("normaliseUrl păstrează http existent", normaliseUrl('http://firma.ro') === 'http://firma.ro');

// Cheile i18n emise de validator există în dicționarul primar.
const r = validateOnboarding({ ...emptyOnboarding(), contactEmail: 'rau', contactPhone: '1', website: 'x', description: 'd'.repeat(2001) });
for (const k of new Set(Object.values(r.errors))) {
  check(`cheie ro există: ${k}`, keyExists(k));
}

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('onboarding validation: all checks passed');
