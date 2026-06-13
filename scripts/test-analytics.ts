// Suite headless: motorul de KPI marketing + coerce-urile (model multi-platformă).
import {
  addTotals,
  computeKpis,
  kpisFromTotals,
  coerceToCampaign,
  coerceToDailyMetric,
  coerceToTotals,
  emptyTotals,
  type DailyMetric,
} from '../src/analytics/kpi';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

function m(date: string, p: Partial<DailyMetric>): DailyMetric {
  return { schema: 1, date, spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0, source: 'manual', ...p };
}

// Set gol → toate sumele 0, toate ratele null (nu NaN/Infinity).
check('gol → sume 0', (() => {
  const k = computeKpis([]);
  return k.spend === 0 && k.impressions === 0 && k.leads === 0;
})());
check('gol → rate null', (() => {
  const k = computeKpis([]);
  return k.cpl === null && k.roas === null && k.ctr === null && k.cpc === null && k.cpm === null && k.convRate === null;
})());

// Calcule de bază pe o singură zi.
check('ROAS = revenue/spend', computeKpis([m('2026-06-01', { spend: 100, revenue: 350 })]).roas === 3.5);
check('CPL = spend/leads', computeKpis([m('2026-06-01', { spend: 100, leads: 25 })]).cpl === 4);
check('CTR = clicks/impressions', computeKpis([m('2026-06-01', { impressions: 1000, clicks: 50 })]).ctr === 0.05);
check('CPC = spend/clicks', computeKpis([m('2026-06-01', { spend: 100, clicks: 50 })]).cpc === 2);
check('CPM = spend/impressions*1000', computeKpis([m('2026-06-01', { spend: 20, impressions: 10000 })]).cpm === 2);
check('convRate = leads/clicks', computeKpis([m('2026-06-01', { clicks: 200, leads: 10 })]).convRate === 0.05);

// Însumare pe mai multe zile înainte de derivare (NU media ratelor pe zi).
check('însumează zilele apoi derivă ROAS', (() => {
  const k = computeKpis([m('2026-06-01', { spend: 100, revenue: 200 }), m('2026-06-02', { spend: 300, revenue: 300 })]);
  return k.spend === 400 && k.revenue === 500 && k.roas === 1.25;
})());

// Protecție la împărțire — numitor 0 → null, nu Infinity/NaN.
check('spend>0, leads=0 → cpl null', computeKpis([m('2026-06-01', { spend: 50 })]).cpl === null);
check('clicks=0 → ctr/convRate null', (() => {
  const k = computeKpis([m('2026-06-01', { impressions: 0, clicks: 0 })]);
  return k.ctr === null && k.convRate === null;
})());

// Valori negative/invalide în date brute → tratate ca 0 (defensiv).
check('valori negative → 0', computeKpis([m('2026-06-01', { spend: -50, revenue: 100 })]).roas === null);

// coerceToCampaign.
check('campanie: null → null', coerceToCampaign(null) === null);
check('campanie: defaults', (() => {
  const c = coerceToCampaign({});
  return !!c && c.platform === 'other' && c.status === 'active' && c.currency === 'EUR';
})());
check('campanie: platformă invalidă → other', coerceToCampaign({ platform: 'snapchat' })?.platform === 'other');
check('campanie: valori valide trec', (() => {
  const c = coerceToCampaign({ name: 'Vară', platform: 'meta', status: 'paused', externalId: '123' });
  return c?.name === 'Vară' && c.platform === 'meta' && c.status === 'paused' && c.externalId === '123';
})());

// coerceToDailyMetric.
check('metrică: fără dată validă → null', coerceToDailyMetric({ spend: 10 }) === null && coerceToDailyMetric({ date: '2026/06/01' }) === null);
check('metrică: dată validă → defaults 0', (() => {
  const x = coerceToDailyMetric({ date: '2026-06-01' });
  return !!x && x.spend === 0 && x.source === 'manual';
})());
check('metrică: tipuri greșite → 0', (() => {
  const x = coerceToDailyMetric({ date: '2026-06-01', spend: 'mult', clicks: -5, revenue: 200 });
  return x?.spend === 0 && x.clicks === 0 && x.revenue === 200;
})());
check('metrică: source platformă păstrat', coerceToDailyMetric({ date: '2026-06-01', source: 'meta' })?.source === 'meta');
check('metrică: source necunoscut → manual', coerceToDailyMetric({ date: '2026-06-01', source: 'hacker' })?.source === 'manual');

// Agregat din totaluri denormalizate (calea panoului — fără a încărca metricile).
check('addTotals adună mai multe campanii', (() => {
  const t = addTotals([
    { spend: 100, impressions: 1000, clicks: 50, leads: 5, revenue: 200 },
    { spend: 300, impressions: 2000, clicks: 100, leads: 20, revenue: 700 },
  ]);
  return t.spend === 400 && t.leads === 25 && t.revenue === 900;
})());
check('kpisFromTotals = computeKpis pe aceleași date', (() => {
  const metrics: DailyMetric[] = [m('2026-06-01', { spend: 100, revenue: 250, clicks: 50, impressions: 1000, leads: 10 })];
  const a = computeKpis(metrics);
  const b = kpisFromTotals({ spend: 100, impressions: 1000, clicks: 50, leads: 10, revenue: 250 });
  return JSON.stringify(a) === JSON.stringify(b) && a.roas === 2.5;
})());
check('coerceToTotals: gunoi → zerouri', (() => {
  const t = coerceToTotals({ spend: 'x', leads: -3, revenue: 50 });
  return t.spend === 0 && t.leads === 0 && t.revenue === 50;
})());
check('emptyTotals e zero', JSON.stringify(emptyTotals()) === JSON.stringify({ spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0 }));
check('campanie: totals coerce-uit din doc', (() => {
  const c = coerceToCampaign({ name: 'X', totals: { spend: 120, leads: 4 } });
  return c?.totals.spend === 120 && c.totals.leads === 4 && c.totals.revenue === 0;
})());

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('analytics KPI: all checks passed');
