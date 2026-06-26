// Suite headless pentru ingestia de date de campanie: parserul CSV (import metrici), coerce-ul de credențiale
// de platformă, clientUid pe campanie + plafonul valoric pe metrici. Partea JS a conectorului (mapMetaInsight/
// crypto/runMetaPull) e testată în e2e-lp-serve.mjs (require pe functions/index.js real).
import { parseMetricsCsv, parseLooseNumber } from '../src/utils/metricsCsv';
import { coerceToPlatformCredential, CRED_PLATFORMS } from '../src/types/platformCredentials';
import { coerceToCampaign, coerceToDailyMetric, MAX_METRIC_VALUE } from '../src/analytics/kpi';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}

console.log('CONNECTORS — import CSV + credențiale + clientUid + plafoane');

// ── parseLooseNumber: formate ro/en + simboluri ──
check('num: en „1,234.56" → 1234.56', parseLooseNumber('1,234.56') === 1234.56);
check('num: ro „1.234,56" → 1234.56', parseLooseNumber('1.234,56') === 1234.56);
check('num: „12,50" (zecimală ro) → 12.5', parseLooseNumber('12,50') === 12.5);
check('num: „€ 1 200,00" → 1200', parseLooseNumber('€ 1 200,00') === 1200);
// Întregi cu virgulă-mie en (bug-fix: înainte „1,000,000" → 1). Grupuri de exact 3 cifre = separator de mii.
check('num: en „1,000,000" (mii) → 1000000', parseLooseNumber('1,000,000') === 1000000);
check('num: en „12,345" (mii) → 12345', parseLooseNumber('12,345') === 12345);
check('num: en „1,234" (grup de 3) → 1234', parseLooseNumber('1,234') === 1234);
check('num: en „1,234,567.89" → 1234567.89', parseLooseNumber('1,234,567.89') === 1234567.89);
check('num: gol → 0', parseLooseNumber('') === 0);
check('num: negativ → 0', parseLooseNumber('-5') === 0);
check('num: text → 0', parseLooseNumber('abc') === 0);

// ── parseMetricsCsv: format propriu (;) ──
{
  const csv = 'date;spend;impressions;clicks;leads;revenue\n2026-06-18;12,50;1000;40;3;150\n2026-06-19;20;2000;80;5;300';
  const { rows, errors } = parseMetricsCsv(csv);
  check('csv ;: 2 rânduri', rows.length === 2 && errors.length === 0);
  check('csv ;: valori prima zi', rows[0].date === '2026-06-18' && rows[0].spend === 12.5 && rows[0].clicks === 40 && rows[0].leads === 3);
}

// ── alias-uri antet (Meta-style, virgulă, ordine diferită, en) ──
{
  const csv = 'Day,Amount spent,Impressions,Link clicks,Results,Conversion value\n2026-06-18,100.5,5000,200,10,1200';
  const { rows } = parseMetricsCsv(csv);
  check('csv alias en: mapare corectă', rows.length === 1 && rows[0].spend === 100.5 && rows[0].clicks === 200 && rows[0].leads === 10 && rows[0].revenue === 1200);
}

// ── alias ro + BOM + ghilimele ──
{
  const csv = '﻿"data";"cheltuiala";"afisari";"clicuri";"conversii";"venit"\n2026-06-20;7,5;300;12;1;90';
  const { rows } = parseMetricsCsv(csv);
  check('csv ro + BOM + ghilimele: parsate', rows.length === 1 && rows[0].date === '2026-06-20' && rows[0].spend === 7.5 && rows[0].leads === 1);
}

// ── dată invalidă sărită, dată duplicată (ultima câștigă) ──
{
  const csv = 'date;spend\n2026-06-18;10\nnu-e-data;99\n2026-06-18;15';
  const { rows, errors } = parseMetricsCsv(csv);
  check('csv: rând cu dată invalidă sărit (eroare raportată)', errors.some((e) => /dat[ăa] invalid/i.test(e)));
  check('csv: dată duplicată → ultima câștigă (15)', rows.length === 1 && rows[0].spend === 15);
}

// ── lipsă coloană dată → eroare, fără rânduri ──
{
  const { rows, errors } = parseMetricsCsv('spend;clicks\n10;5');
  check('csv: fără coloană dată → 0 rânduri + eroare', rows.length === 0 && errors.length === 1);
}

// ── fișier gol ──
check('csv: gol → eroare', parseMetricsCsv('').errors.length === 1 && parseMetricsCsv('').rows.length === 0);

// ── coerceToPlatformCredential ──
check('cred: null → null', coerceToPlatformCredential(null) === null);
check('cred: platformă necunoscută → null', coerceToPlatformCredential({ platform: 'linkedin' }) === null);
{
  const c = coerceToPlatformCredential({ platform: 'meta', accountId: 'act_123', accountName: 'Firma SRL', status: 'active', accountTimezone: 'Europe/Bucharest', accountCurrency: 'EUR', expiresAt: 123, connectedBy: 'u1', tokenEnc: 'v1.x.y.z' });
  check('cred: meta valid coerce', !!c && c.platform === 'meta' && c.accountId === 'act_123' && c.status === 'active');
  check('cred: tokenEnc NU e în tipul coerce (nu se scurge client-side)', !!c && !('tokenEnc' in (c as Record<string, unknown>)));
}
check('cred: status invalid → active (default)', coerceToPlatformCredential({ platform: 'google', status: 'hacked' })?.status === 'active');
check('cred: timezone/currency goale → default-uri', (() => { const c = coerceToPlatformCredential({ platform: 'tiktok' }); return !!c && c.accountTimezone === 'Europe/Bucharest' && c.accountCurrency === 'EUR'; })());
check('cred: toate platformele acceptate', CRED_PLATFORMS.every((p) => coerceToPlatformCredential({ platform: p })?.platform === p));
check('cred: ingestEnabled default true', coerceToPlatformCredential({ platform: 'meta' })?.ingestEnabled === true);
check('cred: ingestEnabled false păstrat', coerceToPlatformCredential({ platform: 'meta', ingestEnabled: false })?.ingestEnabled === false);

// ── coerceToCampaign: clientUid nou ──
check('campaign: clientUid păstrat', coerceToCampaign({ name: 'X', clientUid: 'uid-123' })?.clientUid === 'uid-123');
check('campaign: fără clientUid → gol', coerceToCampaign({ name: 'X' })?.clientUid === '');
check('campaign: clientUid non-string → gol', coerceToCampaign({ name: 'X', clientUid: 42 })?.clientUid === '');

// ── coerceToDailyMetric: plafon valoric (anti intrare absurdă / date corupte) ──
{
  const m = coerceToDailyMetric({ date: '2026-06-18', spend: 1e15, impressions: -5, clicks: 'x', leads: 3, revenue: 999 });
  check('metric: spend peste plafon → MAX_METRIC_VALUE', m?.spend === MAX_METRIC_VALUE);
  check('metric: impressions negativ → 0', m?.impressions === 0);
  check('metric: clicks non-număr → 0', m?.clicks === 0);
  check('metric: valori normale păstrate', m?.leads === 3 && m?.revenue === 999);
  check('metric: dată invalidă → null', coerceToDailyMetric({ date: 'x', spend: 1 }) === null);
}

console.log(`\nconnectors: ${failures ? failures + ' EȘUATE' : 'all checks passed'}`);
if (failures) process.exit(1);
