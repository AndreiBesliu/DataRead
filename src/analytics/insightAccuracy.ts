/**
 * Bucla de învățare pentru VERDICTELE de campanie (audit analytics/AI, insight-accuracy). PUR, testat headless.
 * Măsoară DIRECȚIONAL dacă verdictele AI (scale/maintain/pause/test) s-au aliniat cu mișcarea ROAS după orizontul de
 * reconciliere. Sursa = `campaignInsightLog` (snapshot append-only cu `totalsAt` la momentul verdictului), reconciliat
 * de jobul `reconcileInsights` care stampează `roasAt`/`roasNow`. Modul de CITIRE (ca predictionAccuracy.ts) — fără port JS.
 *
 * ATENȚIE la interpretare: `totals` sunt CUMULATIVE, deci deltaRoas amestecă perioada de dinainte de verdict. E un semnal
 * ORIENTATIV (nu cauzalitate strictă): „după verdict, ROAS a urcat/coborât". De aceea etichetăm descriptiv, nu ca dovadă.
 */

export const INSIGHT_VERDICTS = ['scale', 'maintain', 'pause', 'test'] as const;
export type InsightVerdict = (typeof INSIGHT_VERDICTS)[number];

/** Prag ROAS sub care o campanie „pierde bani" → un verdict `pause` e justificat. */
export const INSIGHT_ROAS_FLOOR = 1;
/** Toleranță relativă pentru „ROAS stabil" (verdict maintain). */
export const INSIGHT_STABLE_EPS = 0.1;

export interface InsightLogRow {
  verdict: unknown;
  roasAt: unknown; // ROAS la momentul verdictului (din totalsAt)
  roasNow: unknown; // ROAS curent (după orizont)
}

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/** Un verdict e „aliniat" dacă mișcarea ROAS confirmă recomandarea:
 *  - scale: ROAS nu s-a degradat (roasNow ≥ roasAt) → scalarea a fost sănătoasă;
 *  - maintain: ROAS ~stabil (|delta| ≤ eps·roasAt);
 *  - pause: verdictul e justificat dacă la momentul lui ROAS era sub prag (campanie în pierdere);
 *  - test: neutru (nu se punctează — se numără doar în total).
 *  Întoarce null dacă nu se poate evalua (ROAS lipsă acolo unde e nevoie). */
export function verdictAligned(verdict: InsightVerdict, roasAt: number | null, roasNow: number | null): boolean | null {
  switch (verdict) {
    case 'scale':
      return roasAt !== null && roasNow !== null ? roasNow >= roasAt : null;
    case 'maintain':
      return roasAt !== null && roasNow !== null ? Math.abs(roasNow - roasAt) <= INSIGHT_STABLE_EPS * roasAt : null;
    case 'pause':
      return roasAt !== null ? roasAt < INSIGHT_ROAS_FLOOR : null;
    case 'test':
      return null; // neutru
    default:
      return null;
  }
}

export interface VerdictStat {
  verdict: InsightVerdict;
  n: number; // câte snapshot-uri reconciliate cu acest verdict
  scored: number; // câte au putut fi evaluate (aligned != null)
  aligned: number; // câte s-au aliniat
  avgDeltaRoas: number | null; // media (roasNow - roasAt) pe cele cu ambele ROAS
}

export interface InsightAccuracy {
  byVerdict: VerdictStat[];
  total: number; // total snapshot-uri reconciliate
  scored: number; // total evaluabile
  aligned: number;
  alignedRate: number | null; // aligned / scored
}

/** Agregă acuratețea insight-urilor din rândurile RECONCILIATE (roasAt/roasNow stampate). */
export function insightAccuracy(rows: InsightLogRow[]): InsightAccuracy {
  const acc = new Map<InsightVerdict, { n: number; scored: number; aligned: number; deltaSum: number; deltaN: number }>();
  for (const v of INSIGHT_VERDICTS) acc.set(v, { n: 0, scored: 0, aligned: 0, deltaSum: 0, deltaN: 0 });
  for (const r of Array.isArray(rows) ? rows : []) {
    const verdict = r && INSIGHT_VERDICTS.includes(r.verdict as InsightVerdict) ? (r.verdict as InsightVerdict) : null;
    if (!verdict) continue;
    const roasAt = numOrNull(r.roasAt);
    const roasNow = numOrNull(r.roasNow);
    const a = acc.get(verdict)!;
    a.n += 1;
    if (roasAt !== null && roasNow !== null) { a.deltaSum += roasNow - roasAt; a.deltaN += 1; }
    const al = verdictAligned(verdict, roasAt, roasNow);
    if (al !== null) { a.scored += 1; if (al) a.aligned += 1; }
  }
  const byVerdict: VerdictStat[] = INSIGHT_VERDICTS.map((verdict) => {
    const a = acc.get(verdict)!;
    return { verdict, n: a.n, scored: a.scored, aligned: a.aligned, avgDeltaRoas: a.deltaN > 0 ? Math.round((a.deltaSum / a.deltaN) * 100) / 100 : null };
  });
  const total = byVerdict.reduce((s, v) => s + v.n, 0);
  const scored = byVerdict.reduce((s, v) => s + v.scored, 0);
  const aligned = byVerdict.reduce((s, v) => s + v.aligned, 0);
  return { byVerdict, total, scored, aligned, alignedRate: scored > 0 ? Math.round((aligned / scored) * 100) / 100 : null };
}
