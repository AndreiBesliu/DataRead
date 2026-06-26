// Suite headless: motorul de KPI marketing + coerce-urile (model multi-platformă).
import {
  addTotals,
  computeKpis,
  kpisFromTotals,
  coerceToCampaign,
  coerceToDailyMetric,
  coerceToInsight,
  coerceToReport,
  coerceToAllocation,
  coerceToTotals,
  emptyTotals,
  kpisByPlatform,
  insightConfidence,
  ALLOCATION_ACTIONS,
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

// AI insight coerce.
check('insight: null → null', coerceToInsight(null) === null);
check('insight: verdict invalid → null', coerceToInsight({ verdict: 'explode', headline: 'x' }) === null);
check('insight: valid trece (actions = array tipat, felia 5b)', (() => {
  const i = coerceToInsight({ verdict: 'scale', headline: 'Merge bine', reasoning: 'ROAS 3.5', actions: [{ changeType: 'scale', target: 'budget', magnitude: 'medium' }] });
  return i?.verdict === 'scale' && i.headline === 'Merge bine' && Array.isArray(i.actions) && i.actions.length === 1 && i.actions[0].changeType === 'scale';
})());
check('insight: câmpuri lipsă → string gol + listă goală, nu crash', (() => {
  const i = coerceToInsight({ verdict: 'pause' });
  return i?.verdict === 'pause' && i.headline === '' && i.reasoning === '' && Array.isArray(i.actions) && i.actions.length === 0;
})());

// Raport client coerce.
check('raport: null/gol → null', coerceToReport(null) === null && coerceToReport({}) === null);
check('raport: cu conținut → obiect', (() => {
  const r = coerceToReport({ summary: 'Luna bună', highlights: '', recommendations: 'Scalează' });
  return r?.summary === 'Luna bună' && r.recommendations === 'Scalează' && r.highlights === '';
})());
check('raport: tipuri greșite → stringuri goale (dar păstrat dacă măcar unul are text)', (() => {
  const r = coerceToReport({ summary: 42, highlights: 'x', recommendations: null });
  return r?.summary === '' && r.highlights === 'x';
})());

// Defalcare pe platformă (vizualizare multi-platformă: un client pe Meta+Google+TikTok).
{
  const items = [
    { platform: 'meta' as const, totals: { spend: 100, impressions: 1000, clicks: 50, leads: 5, revenue: 300 } },
    { platform: 'meta' as const, totals: { spend: 50, impressions: 500, clicks: 20, leads: 2, revenue: 150 } },
    { platform: 'google' as const, totals: { spend: 80, impressions: 800, clicks: 40, leads: 4, revenue: 160 } },
  ];
  const byP = kpisByPlatform(items);
  check('byPlatform: 2 platforme prezente (meta+google), tiktok absent', byP.length === 2);
  check('byPlatform: ordinea PLATFORMS (meta înaintea google)', byP[0].platform === 'meta' && byP[1].platform === 'google');
  const meta = byP.find((x) => x.platform === 'meta');
  check('byPlatform: meta agregă 2 campanii (spend 150, revenue 450)', !!meta && meta.campaigns === 2 && meta.kpis.spend === 150 && meta.kpis.revenue === 450);
  check('byPlatform: meta ROAS = 450/150 = 3', meta?.kpis.roas === 3);
  check('byPlatform: gol → []', kpisByPlatform([]).length === 0);
  check('byPlatform: platformă necunoscută → grupată la „other"', kpisByPlatform([{ platform: 'linkedin' as never, totals: emptyTotals() }])[0].platform === 'other');
}

// Pachet C: încrederea în insight calibrată după eșantion
check('insightConfidence: eșantion bogat → ce zice modelul (high)', insightConfidence(500, 40, 'high') === 'high');
check('insightConfidence: click-uri puține → low (override)', insightConfidence(20, 40, 'high') === 'low');
check('insightConfidence: lead-uri puține → low (override)', insightConfidence(500, 5, 'high') === 'low');
check('insightConfidence: model invalid + eșantion ok → med', insightConfidence(500, 40, 'banana') === 'med');
check('insightConfidence: la prag exact (50/15) → ce zice modelul', insightConfidence(50, 15, 'high') === 'high');
check('coerceToInsight: confidence vechi lipsă → med', coerceToInsight({ verdict: 'scale', headline: 'x' })?.confidence === 'med');
check('coerceToInsight: confidence valid păstrat', coerceToInsight({ verdict: 'scale', confidence: 'low' })?.confidence === 'low');

// Pachet C2: realocare buget — coerceToAllocation (paritate enum cu ALLOCATION_SCHEMA din functions).
check('allocActions: enum = scale/reduce/pause/keep', JSON.stringify(ALLOCATION_ACTIONS) === JSON.stringify(['scale', 'reduce', 'pause', 'keep']));
check('coerceToAllocation: null/gol → null', coerceToAllocation(null) === null && coerceToAllocation({}) === null);
{
  const a = coerceToAllocation({
    headline: 'Mută buget spre Camp A',
    summary: 'Camp A are ROAS 5, Camp B are 0.25.',
    moves: [
      { campaign: 'Camp A', action: 'scale', reason: 'ROAS cel mai bun' },
      { campaign: 'Camp B', action: 'pause', reason: 'irosește buget' },
      { campaign: '', action: 'keep', reason: 'fără nume → ignorată' },
      { campaign: 'Camp C', action: 'banana', reason: 'enum invalid → keep' },
    ],
  });
  check('coerceToAllocation: headline/summary păstrate', a?.headline === 'Mută buget spre Camp A' && !!a?.summary);
  check('coerceToAllocation: mișcare fără nume ignorată (3 valide)', a?.moves.length === 3);
  check('coerceToAllocation: acțiune validă păstrată', a?.moves[0].action === 'scale');
  check('coerceToAllocation: enum invalid → keep (fallback)', a?.moves[2].action === 'keep');
}
{
  const a = coerceToAllocation({ headline: 'Doar titlu', summary: '', moves: 'nu e array' as unknown });
  check('coerceToAllocation: moves non-array → [] dar util prin headline', a !== null && a.moves.length === 0);
}

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('analytics KPI: all checks passed');
