/**
 * Motor PUR de verdict pentru A/B testing pe Landing Pages (fișier separat — NU atinge lpStats.ts testat).
 * Declară un câștigător DOAR cu rigoare statistică: z-test pe DOUĂ proporții (top vs runner-up) la α=0.05,
 * peste un prag minim de vizite/variantă. Fără asta, „rata de conversie mai mare" = fals-pozitiv din zgomot
 * (vezi review-ul de design). Fără dependențe (CDF normal aproximat cu erf). Testat headless.
 */

export const AB_ALPHA = 0.05; // prag de semnificație (two-sided) → |z| > 1.96

export interface AbArmStat {
  id: string;
  label: string;
  visits: number;
  submissions: number;
}

export interface AbArmKpi extends AbArmStat {
  convRate: number; // submissions / visits; 0 dacă visits === 0
}

export type AbVerdictStatus = 'insufficient' | 'no-difference' | 'winner';

export interface AbVerdict {
  status: AbVerdictStatus;
  winnerId: string | null; // setat DOAR la status 'winner'
  leaderId: string | null; // arm-ul cu cea mai mare rată (provizoriu) — pentru afișaj, NU pentru decizie
  pValue: number | null; // p-value top vs runner-up (null dacă nu se poate calcula)
  reasonKey: string; // cheie i18n: 'ab.verdict.insufficient' | 'ab.verdict.noDifference' | 'ab.verdict.winner'
  arms: AbArmKpi[]; // sortate desc după convRate
}

const nn = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** CDF normal standard via aproximarea erf (Abramowitz–Stegun 7.1.26). Pură, deterministă. */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** p-value two-sided pentru z-test pe două proporții (pooled). Întoarce null dacă numitorii sunt 0/SE=0. */
export function twoProportionPValue(c1: number, n1: number, c2: number, n2: number): number | null {
  const a1 = nn(c1), m1 = nn(n1), a2 = nn(c2), m2 = nn(n2);
  if (m1 <= 0 || m2 <= 0) return null;
  const p1 = a1 / m1, p2 = a2 / m2;
  const pPool = (a1 + a2) / (m1 + m2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / m1 + 1 / m2));
  if (!Number.isFinite(se) || se === 0) return null;
  const z = (p1 - p2) / se;
  return 2 * (1 - normalCdf(Math.abs(z))); // two-sided
}

export function abArmKpi(arm: AbArmStat): AbArmKpi {
  const visits = nn(arm.visits);
  const submissions = nn(arm.submissions);
  return { id: arm.id, label: arm.label, visits, submissions, convRate: visits > 0 ? submissions / visits : 0 };
}

/**
 * Verdict A/B. Reguli (oneste, fără peeking-friendly „lider acționabil"):
 *  - < 2 arme cu date → insufficient.
 *  - vreun arm sub `minSamplePerArm` vizite → insufficient (colectare în curs).
 *  - altfel z-test top vs runner-up: p < AB_ALPHA ȘI top.convRate > runner.convRate → winner;
 *  - altfel → no-difference (diferență neconcludentă; continuă testul).
 */
export function pickAbWinner(arms: AbArmStat[], opts: { minSamplePerArm: number }): AbVerdict {
  const minSample = nn(opts && opts.minSamplePerArm) || 1;
  const kpis = (Array.isArray(arms) ? arms : []).map(abArmKpi).sort((a, b) => b.convRate - a.convRate || b.visits - a.visits);
  const leaderId = kpis.length ? kpis[0].id : null;

  if (kpis.length < 2) {
    return { status: 'insufficient', winnerId: null, leaderId, pValue: null, reasonKey: 'ab.verdict.insufficient', arms: kpis };
  }
  if (kpis.some((a) => a.visits < minSample)) {
    return { status: 'insufficient', winnerId: null, leaderId, pValue: null, reasonKey: 'ab.verdict.insufficient', arms: kpis };
  }
  const top = kpis[0], runner = kpis[1];
  const p = twoProportionPValue(top.submissions, top.visits, runner.submissions, runner.visits);
  if (p !== null && p < AB_ALPHA && top.convRate > runner.convRate) {
    return { status: 'winner', winnerId: top.id, leaderId, pValue: p, reasonKey: 'ab.verdict.winner', arms: kpis };
  }
  return { status: 'no-difference', winnerId: null, leaderId, pValue: p, reasonKey: 'ab.verdict.noDifference', arms: kpis };
}
