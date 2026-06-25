// Suite headless: scorul determinist de prioritate a lead-urilor (#10) + paritatea cheilor de motiv în i18n.
import { leadPriority, PRIORITY_TIER_COLORS } from '../src/admin/leadPriority';
import ro from '../src/i18n/locales/ro';
import en from '../src/i18n/locales/en';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}
function keyIn(dict: unknown, key: string): boolean {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in (node as Record<string, unknown>))) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node.length > 0;
}
const inBoth = (k: string) => keyIn(ro, k) && keyIn(en, k);

const NOW = Date.parse('2026-06-23T12:00:00Z');
const DAY = 86400000;

// won/lost → 0, jos.
check('won → scor 0', leadPriority({ status: 'won', createdAtMs: NOW }, NOW).score === 0);
check('lost → scor 0 + tier low', (() => { const r = leadPriority({ status: 'lost', createdAtMs: NOW }, NOW); return r.score === 0 && r.tier === 'low'; })());

// hot + high + new → scor mare, tier high, motiv dominant follow-up dacă scadent.
check('hot+high+new → high', (() => {
  const r = leadPriority({ status: 'new', createdAtMs: NOW, temperature: 'hot', conversionLikelihood: 'high' }, NOW);
  return r.score >= 60 && r.tier === 'high';
})());
check('follow-up scadent → bonus + motiv dominant', (() => {
  const r = leadPriority({ status: 'contacted', createdAtMs: NOW, nextFollowUpMs: NOW - DAY }, NOW);
  return r.score >= 30 && r.reasonKey === 'followUpDue';
})());
check('follow-up viitor → NU declanșează', leadPriority({ status: 'contacted', createdAtMs: NOW, nextFollowUpMs: NOW + DAY }, NOW).reasonKey !== 'followUpDue');

// recență: new vechi de N zile → bump (untouched), dar plafonat.
check('new vechi → untouched + scor mai mare decât new proaspăt', (() => {
  const fresh = leadPriority({ status: 'new', createdAtMs: NOW }, NOW).score;
  const stale = leadPriority({ status: 'new', createdAtMs: NOW - 6 * DAY }, NOW);
  return stale.score > fresh && (stale.reasonKey === 'untouched' || stale.reasonKey === 'new');
})());

// fără predicție: scorul tot se calculează din status+recență (nu aruncă).
check('fără predicție → scor din status', leadPriority({ status: 'new', createdAtMs: NOW }, NOW).score > 0);
// clamp 0-100.
check('scor în 0-100', (() => {
  const r = leadPriority({ status: 'new', createdAtMs: NOW - 60 * DAY, temperature: 'hot', conversionLikelihood: 'high', nextFollowUpMs: NOW - DAY }, NOW);
  return r.score >= 0 && r.score <= 100;
})());
check('cold+low < hot+high (ordonare)', leadPriority({ status: 'contacted', createdAtMs: NOW, temperature: 'cold', conversionLikelihood: 'low' }, NOW).score < leadPriority({ status: 'contacted', createdAtMs: NOW, temperature: 'hot', conversionLikelihood: 'high' }, NOW).score);

// culori tier valide.
check('culori tier hex', (['high', 'medium', 'low'] as const).every((t) => /^#[0-9a-fA-F]{6}$/.test(PRIORITY_TIER_COLORS[t])));

// i18n: toate cheile de motiv + sort în ro+en.
check('admin.leadSort_* + admin.priority.r_* în ro+en', [
  'admin.leadSort_recent', 'admin.leadSort_priority',
  'admin.priority.r_followUpDue', 'admin.priority.r_hot', 'admin.priority.r_high', 'admin.priority.r_new',
  'admin.priority.r_untouched', 'admin.priority.r_warm', 'admin.priority.r_cooling', 'admin.priority.r_cold',
  'admin.priority.r_won', 'admin.priority.r_lost', 'admin.priority.r_low',
  'admin.activity.draftBtn', 'admin.activity.drafting', 'admin.activity.draftErr',
].every(inBoth));

if (failures) { console.error(`${failures} checks failed`); process.exit(1); }
console.log('lead priority: all checks passed');
