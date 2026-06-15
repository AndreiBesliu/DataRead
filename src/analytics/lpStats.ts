/**
 * Analytics Landing Pages — PUR (fără Firebase/React), testat headless. Modelul de citire e pe
 * rollup-uri zilnice (landingPages/{slug}/stats/{YYYY-MM-DD}) incrementate de serveLp + ingest-ul
 * de beacon, ca dashboardul să nu itereze vizitele brute (scalează la N citiri = N zile). Numitor
 * 0 → null (ca `div` din kpi.ts) ⇒ UI afișează „—". Cheile de breakdown (surse/referrers/țări) se
 * pun pe whitelist la scriere (bucketKey), restul → 'other', ca un rollup să rămână câțiva KB.
 */

export const LP_STAT_SCHEMA = 1;

export const LP_DEVICES = ['mobile', 'desktop', 'tablet', 'bot'] as const;
export type LpDevice = (typeof LP_DEVICES)[number];

export interface LpStatsDay {
  schema: typeof LP_STAT_SCHEMA;
  date: string; // YYYY-MM-DD (= ID-ul documentului)
  visits: number;
  byDevice: Record<string, number>;
  bySource: Record<string, number>;
  byMedium: Record<string, number>; // tip asset (video/static/…) — pe whitelist la scriere
  byReferrerHost: Record<string, number>;
  byCountry: Record<string, number>;
  beacons: number; // câte beacon-uri de engagement au sosit (numitor pt. medii)
  scrollDepthSum: number; // sumă procente scroll
  timeOnPageSum: number; // sumă ms pe pagină
  engaged: number; // sesiuni „engaged" (timp/scroll peste prag)
  ctaClicks: number;
  submissions: number; // conversii (trimiteri de formular)
}

export interface LpTotals {
  visits: number;
  beacons: number;
  scrollDepthSum: number;
  timeOnPageSum: number;
  engaged: number;
  ctaClicks: number;
  submissions: number;
  byDevice: Record<string, number>;
  bySource: Record<string, number>;
  byMedium: Record<string, number>;
  byReferrerHost: Record<string, number>;
  byCountry: Record<string, number>;
}

export interface LpKpis {
  visits: number;
  submissions: number;
  ctaClicks: number;
  engaged: number;
  convRate: number | null; // submissions / visits
  ctaRate: number | null; // ctaClicks / visits
  engagementRate: number | null; // engaged / visits
  avgScrollPct: number | null; // scrollDepthSum / beacons
  avgTimeSec: number | null; // timeOnPageSum / beacons / 1000
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

function mapNums(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof v === 'object' && v !== null) {
    for (const [k, val] of Object.entries(v)) {
      const n = num(val);
      if (n) out[String(k).slice(0, 60)] = n;
    }
  }
  return out;
}

/** Rând de stats valid doar cu dată corectă; altfel null (rândul e sărit, fără crash). */
export function coerceToLpStatsDay(v: unknown): LpStatsDay | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  if (typeof d.date !== 'string' || !VALID_DATE.test(d.date)) return null;
  return {
    schema: LP_STAT_SCHEMA,
    date: d.date,
    visits: num(d.visits),
    byDevice: mapNums(d.byDevice),
    bySource: mapNums(d.bySource),
    byMedium: mapNums(d.byMedium),
    byReferrerHost: mapNums(d.byReferrerHost),
    byCountry: mapNums(d.byCountry),
    beacons: num(d.beacons),
    scrollDepthSum: num(d.scrollDepthSum),
    timeOnPageSum: num(d.timeOnPageSum),
    engaged: num(d.engaged),
    ctaClicks: num(d.ctaClicks),
    submissions: num(d.submissions),
  };
}

export function emptyLpTotals(): LpTotals {
  return {
    visits: 0, beacons: 0, scrollDepthSum: 0, timeOnPageSum: 0, engaged: 0, ctaClicks: 0,
    submissions: 0, byDevice: {}, bySource: {}, byMedium: {}, byReferrerHost: {}, byCountry: {},
  };
}

function addMap(into: Record<string, number>, from: Record<string, number>): void {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] || 0) + v;
}

export function sumLpStats(days: LpStatsDay[]): LpTotals {
  const t = emptyLpTotals();
  for (const d of days) {
    t.visits += d.visits;
    t.beacons += d.beacons;
    t.scrollDepthSum += d.scrollDepthSum;
    t.timeOnPageSum += d.timeOnPageSum;
    t.engaged += d.engaged;
    t.ctaClicks += d.ctaClicks;
    t.submissions += d.submissions;
    addMap(t.byDevice, d.byDevice);
    addMap(t.bySource, d.bySource);
    addMap(t.byMedium, d.byMedium);
    addMap(t.byReferrerHost, d.byReferrerHost);
    addMap(t.byCountry, d.byCountry);
  }
  return t;
}

export function lpKpis(t: LpTotals): LpKpis {
  return {
    visits: t.visits,
    submissions: t.submissions,
    ctaClicks: t.ctaClicks,
    engaged: t.engaged,
    convRate: div(t.submissions, t.visits),
    ctaRate: div(t.ctaClicks, t.visits),
    engagementRate: div(t.engaged, t.visits),
    avgScrollPct: div(t.scrollDepthSum, t.beacons),
    avgTimeSec: t.beacons > 0 ? t.timeOnPageSum / t.beacons / 1000 : null,
  };
}

/** Top N intrări dintr-un breakdown (sortate descrescător). */
export function topEntries(map: Record<string, number>, n: number): [string, number][] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/** Cheie pe whitelist sau 'other' — folosită de functions la scrierea rollup-ului (aici ca să fie
 *  testată): împiedică un parametru UTM ostil să umfle documentul de stats cu chei nelimitate. */
export function bucketKey(key: unknown, whitelist: readonly string[]): string {
  const k = (typeof key === 'string' ? key : '').toLowerCase().slice(0, 60);
  if (!k) return 'other';
  return whitelist.includes(k) ? k : 'other';
}
