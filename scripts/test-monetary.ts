// Suite headless: axa monetară F1 (LTV per contact + CAC/ROI per campanie) — modulul pur src/analytics/monetary.ts.
import {
  coerceMoney,
  sumWonValue,
  coerceToContactDeal,
  wonRevenue,
  campaignKey,
  campaignEconomics,
  campaignEconomicsAll,
  MAX_MONEY,
  CONTACT_CAC_THIN_N,
} from '../src/analytics/monetary';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}
const approx = (a: number | null, b: number, eps = 1e-9) => a !== null && Math.abs(a - b) < eps;

console.log('AXA MONETARĂ — LTV + CAC/ROI');

// coerceMoney
check('coerceMoney: număr valid', coerceMoney(120.5) === 120.5);
check('coerceMoney: negativ → 0', coerceMoney(-5) === 0);
check('coerceMoney: NaN/non-număr → 0', coerceMoney(NaN) === 0 && coerceMoney('x') === 0 && coerceMoney(null) === 0);
check('coerceMoney: peste plafon → plafon', coerceMoney(1e15) === MAX_MONEY);

// coerceToContactDeal
{
  const d = coerceToContactDeal({ value: 300, won: true, slug: 'lp-a', at: 123 });
  check('coerceToContactDeal: câmpuri valide', d.schema === 1 && d.value === 300 && d.won === true && d.slug === 'lp-a' && d.at === 123);
  const e = coerceToContactDeal({ value: -1, won: 'yes', slug: 5, at: -9 });
  check('coerceToContactDeal: corupt → defaults sigure', e.value === 0 && e.won === false && e.slug === '' && e.at === 0);
}

// sumWonValue
check('sumWonValue: doar deal-urile câștigate', sumWonValue([
  { value: 100, won: true },
  { value: 50, won: false },
  { value: 200, won: true },
]) === 300);
check('sumWonValue: gol → 0', sumWonValue([]) === 0);
check('sumWonValue: valori corupte ignorate (fără NaN)', sumWonValue([{ value: NaN as unknown as number, won: true }, { value: 40, won: true }]) === 40);
check('sumWonValue: plafonat', sumWonValue([{ value: 1e15, won: true }]) === MAX_MONEY);

// wonRevenue (portal)
check('wonRevenue: suma valorilor pe castigat', wonRevenue([
  { status: 'castigat', value: 100 },
  { status: 'pierdut', value: 999 },
  { status: 'castigat', value: 250 },
  { status: 'nou', value: 5 },
]) === 350);
check('wonRevenue: gol → 0', wonRevenue([]) === 0);

// campaignKey
check('campaignKey: trim + lowercase', campaignKey('  Black Friday ') === 'black friday');
check('campaignKey: gol/non-string → ""', campaignKey('') === '' && campaignKey(null) === '' && campaignKey(42) === '');

// campaignEconomics
{
  const contacts = [
    { acquisitionCampaign: 'BF', ltv: 100 },
    { acquisitionCampaign: 'bf', ltv: 200 }, // case-insensitive match
    { acquisitionCampaign: 'Other', ltv: 999 },
  ];
  const e = campaignEconomics('bf', 50, contacts);
  check('campaignEconomics: acquired (case-insensitive)', e.acquired === 2);
  check('campaignEconomics: cohortValue', e.cohortValue === 300);
  check('campaignEconomics: CAC = spend/acquired', approx(e.cac, 25));
  check('campaignEconomics: ROI = cohortValue/spend', approx(e.roi, 6));
  check('campaignEconomics: avgLtv', approx(e.avgLtv, 150));
  check('campaignEconomics: smallSample (2 < 5)', e.smallSample === true);
}
check('campaignEconomics: 0 contacte → CAC/avgLtv null, ROI=0 (cheltuit fără randament)', (() => {
  const e = campaignEconomics('x', 100, []);
  return e.acquired === 0 && e.cac === null && e.roi === 0 && e.avgLtv === null && e.smallSample === false;
})());
check('campaignEconomics: spend 0 → ROI null', campaignEconomics('x', 0, [{ acquisitionCampaign: 'x', ltv: 100 }]).roi === null);
check('campaignEconomics: campanie fără nume nu potrivește contacte fără campanie', campaignEconomics('', 10, [{ acquisitionCampaign: '', ltv: 100 }]).acquired === 0);

// campaignEconomicsAll — găleata „neatribuit" reconciliază totalurile
{
  const campaigns = [{ name: 'A', spend: 100 }, { name: 'B', spend: 200 }];
  const contacts = [
    { acquisitionCampaign: 'A', ltv: 50 },
    { acquisitionCampaign: 'A', ltv: 70 },
    { acquisitionCampaign: 'B', ltv: 0 },
    { acquisitionCampaign: 'Necunoscut', ltv: 30 }, // campanie inexistentă → neatribuit
    { acquisitionCampaign: '', ltv: 10 }, // fără campanie → neatribuit
  ];
  const r = campaignEconomicsAll(campaigns, contacts);
  const a = r.perCampaign.find((e) => e.campaign === 'A')!;
  check('campaignEconomicsAll: A acquired/cohort', a.acquired === 2 && a.cohortValue === 120);
  check('campaignEconomicsAll: neatribuit = 2 contacte, 40 valoare', r.unattributed.contacts === 2 && r.unattributed.cohortValue === 40);
  // Reconciliere: suma cohortelor (atribuite + neatribuit) == suma LTV a tuturor contactelor.
  const totalCohort = r.perCampaign.reduce((s, e) => s + e.cohortValue, 0) + r.unattributed.cohortValue;
  check('campaignEconomicsAll: reconciliere totaluri (120+0+40 = 160)', totalCohort === 160);
}
check('CONTACT_CAC_THIN_N = 5', CONTACT_CAC_THIN_N === 5);

// Fix review #3: nume de campanie DUPLICAT → o singură linie, spend însumat, cohortValue numărat O DATĂ.
{
  const campaigns = [{ name: 'Promo', spend: 100 }, { name: 'promo', spend: 50 }]; // aceeași cheie
  const contacts = [{ acquisitionCampaign: 'Promo', ltv: 200 }, { acquisitionCampaign: 'PROMO', ltv: 100 }];
  const r = campaignEconomicsAll(campaigns, contacts);
  check('campaignEconomicsAll: nume duplicat → o singură linie', r.perCampaign.length === 1);
  check('campaignEconomicsAll: spend însumat (150), cohort o dată (300)', r.perCampaign[0].spend === 150 && r.perCampaign[0].cohortValue === 300 && r.perCampaign[0].acquired === 2);
  check('campaignEconomicsAll: dup → neatribuit gol (toate potrivesc)', r.unattributed.contacts === 0);
}

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('monetary: all checks passed');
