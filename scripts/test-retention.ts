// Suite headless: motorul de retenție. Regula de aur verificată aici: datele financiare și cele de business
// ale clientului NU pot fi șterse automat, oricât de greșit ar fi editat tabelul de reguli.
import {
  DAY_MS,
  PROTECTED_COLLECTIONS,
  RETENTION_RULES,
  dayKey,
  retentionCutoffMs,
  retentionCutoffValue,
  shouldDelete,
  validateRetentionRules,
  type RetentionRule,
} from '../src/analytics/retention';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

const NOW = Date.parse('2026-08-07T12:00:00.000Z'); // ceas fix — zero Date.now() în aserțiuni

// ── REGULA DE AUR ──────────────────────────────────────────────────────────────────────────────
check('regulile ACTIVE sunt valide (fără colecții protejate, fără duplicate, cu motivație)',
  validateRetentionRules(RETENTION_RULES).length === 0);

check('o regulă pe o colecție FINANCIARĂ e respinsă', (() => {
  const bad: RetentionRule[] = [{ collection: 'invoices', field: 'at', kind: 'timestamp', days: 30, why: 'motivație suficient de lungă ca să treacă' }];
  return validateRetentionRules(bad).some((e) => e.includes('PROTEJATĂ'));
})());
check('o regulă pe datele CLIENTULUI (submissions/leads/contacts) e respinsă', (() => {
  return ['submissions', 'leads', 'contacts', 'invoiceCounters'].every((c) =>
    validateRetentionRules([{ collection: c, field: 'at', kind: 'timestamp', days: 30, why: 'motivație suficient de lungă ca să treacă' }])
      .some((e) => e.includes('PROTEJATĂ')));
})());
check('nicio regulă activă nu atinge o colecție protejată', (() =>
  RETENTION_RULES.every((r) => !PROTECTED_COLLECTIONS.includes(r.collection)))());
check('regulile active acoperă exact telemetria pe care o știm nemărginită', (() => {
  const cols = RETENTION_RULES.map((r) => r.collection).sort();
  return JSON.stringify(cols) === JSON.stringify(['abuseGuard', 'campaignInsightLog', 'errorReports', 'predictionLog']);
})());
check('zile invalide sunt respinse', (() => {
  const mk = (days: number): RetentionRule => ({ collection: 'x', field: 'at', kind: 'timestamp', days, why: 'motivație suficient de lungă ca să treacă' });
  return [0, -1, 1.5, 99999].every((d) => validateRetentionRules([mk(d)]).some((e) => e.includes('zile invalide')));
})());
check('motivația prea scurtă e respinsă (cifra nu se schimbă fără explicație)',
  validateRetentionRules([{ collection: 'x', field: 'at', kind: 'timestamp', days: 30, why: 'pt.' }]).some((e) => e.includes('motivație')));

// ── Praguri ────────────────────────────────────────────────────────────────────────────────────
const rTs: RetentionRule = { collection: 'errorReports', field: 'at', kind: 'timestamp', days: 90, why: 'motivație suficient de lungă ca să treacă' };
const rDay: RetentionRule = { collection: 'abuseGuard', field: 'day', kind: 'dayString', days: 3, why: 'motivație suficient de lungă ca să treacă' };

check('pragul timestamp = acum − zile', retentionCutoffMs(rTs, NOW) === NOW - 90 * DAY_MS);
check('pragul dayString e ISO YYYY-MM-DD', retentionCutoffValue(rDay, NOW) === dayKey(NOW - 3 * DAY_MS));
check('dayKey e stabil (UTC)', dayKey(Date.parse('2026-08-07T23:59:59Z')) === '2026-08-07');

// ── Decizia de ștergere ────────────────────────────────────────────────────────────────────────
check('timestamp: mai vechi decât pragul → se șterge', shouldDelete(rTs, NOW - 91 * DAY_MS, NOW));
check('timestamp: mai nou decât pragul → NU se șterge', !shouldDelete(rTs, NOW - 89 * DAY_MS, NOW));
check('timestamp: exact pe prag → NU se șterge (strict mai vechi)', !shouldDelete(rTs, NOW - 90 * DAY_MS, NOW));
check('dayString: ziua veche → se șterge', shouldDelete(rDay, '2026-08-01', NOW));
check('dayString: ziua curentă → NU se șterge', !shouldDelete(rDay, '2026-08-07', NOW));

// FAIL-SAFE: nu ștergem ce nu înțelegem. Un câmp lipsă/corupt trebuie să PĂSTREZE documentul.
check('valoare lipsă/coruptă → NU se șterge (fail-safe)', (() => {
  const junk = [undefined, null, '', 'ieri', {}, [], NaN, '2026-13-99', true];
  return junk.every((v) => !shouldDelete(rTs, v, NOW)) && junk.every((v) => !shouldDelete(rDay, v, NOW));
})());
check('dayString: număr în loc de string → NU se șterge', !shouldDelete(rDay, NOW - 99 * DAY_MS, NOW));
check('timestamp: string în loc de număr → NU se șterge', !shouldDelete(rTs, '2020-01-01', NOW));

// Datele de retenție lungă chiar supraviețuiesc unui an minus o zi (bucla de învățare are nevoie de ele).
check('predictionLog la 364 de zile încă se păstrează', (() => {
  const r = RETENTION_RULES.find((x) => x.collection === 'predictionLog')!;
  return !shouldDelete(r, NOW - 364 * DAY_MS, NOW) && shouldDelete(r, NOW - 366 * DAY_MS, NOW);
})());

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('retention: all checks passed');
