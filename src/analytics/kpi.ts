/**
 * Motorul de analytics marketing — PUR (fără Firebase, fără React), ca să fie testat headless.
 * Platform-agnostic: o metrică zilnică are aceeași formă indiferent de unde vine (introdusă
 * manual azi, sau scrisă de un conector Meta/Google Ads API mai târziu — vezi
 * docs/CONNECTORS-ADS-API.md). KPI-urile (ROAS, CPL, CTR, ...) se calculează din însumarea
 * metricilor brute; numitorul 0 → null (nu Infinity/NaN), ca UI-ul să afișeze „—".
 *
 * Invariant de persistență (CLAUDE.md): orice metrică/campanie încărcată trece prin coerce* —
 * date corupte/legacy → defaults sigure, niciodată throw.
 */

export const PLATFORMS = ['meta', 'google', 'tiktok', 'other'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CAMPAIGN_STATUSES = ['active', 'paused', 'ended'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_SCHEMA = 1;
export const METRIC_SCHEMA = 1;

/** Sumele brute ale unei campanii — menținute denormalizat pe documentul campaniei, ca panoul
 *  să agrege pe toți clienții fără să încarce fiecare metrică zilnică. */
export interface Totals {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  revenue: number;
}

export function emptyTotals(): Totals {
  return { spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0 };
}

export interface CampaignDef {
  schema: typeof CAMPAIGN_SCHEMA;
  name: string;
  platform: Platform;
  status: CampaignStatus;
  /** Cod de monedă (v1: EUR peste tot — câmpul există pentru extindere). */
  currency: string;
  /** ID-ul campaniei pe platforma externă (gol până la conectarea API-ului). */
  externalId: string;
  /** UID-ul clientului (denormalizat din lead) — leagă campania de contul lui pentru reguli
   *  multi-tenant ȘI pentru jobul de ingestie (mapează campania → credențiala clientului). Gol
   *  până când adminul conectează lead-ul la un cont client; ținut în sincron de onLeadWrite. */
  clientUid: string;
  /** Sumele brute (rollup) — recalculate la fiecare scriere de metrică. */
  totals: Totals;
}

/** O zi de performanță a unei campanii. ID-ul documentului = data (YYYY-MM-DD) → reintroducerea
 *  unei zile face upsert; conectorii API vor face upsert pe aceeași cheie (idempotent pe dată). */
export interface DailyMetric {
  schema: typeof METRIC_SCHEMA;
  date: string; // YYYY-MM-DD
  spend: number; // cheltuit, unități majore (EUR)
  impressions: number;
  clicks: number;
  leads: number; // lead-uri / conversii
  revenue: number; // venit atribuit (pentru ROAS), EUR
  /** Cine a scris valoarea: 'manual' acum, 'meta'/'google'/… când vine conectorul. */
  source: 'manual' | Platform;
}

export interface Kpis {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  revenue: number;
  /** Cost per lead = spend / leads. */
  cpl: number | null;
  /** Return on ad spend = revenue / spend. */
  roas: number | null;
  /** Click-through rate = clicks / impressions (fracție, 0..1). */
  ctr: number | null;
  /** Cost per click = spend / clicks. */
  cpc: number | null;
  /** Cost per mille = spend / impressions * 1000. */
  cpm: number | null;
  /** Rata de conversie = leads / clicks (fracție, 0..1). */
  convRate: number | null;
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
/** Plafon defensiv pe valorile metrice (anti intrare absurdă: 999999€ dintr-un typo, sau date corupte din
 *  CSV/API). Negativ/NaN → 0 (prin num), peste plafon → plafon. Nu aruncă (coerce-everything). */
export const MAX_METRIC_VALUE = 1e12;
const numCap = (v: unknown): number => Math.min(num(v), MAX_METRIC_VALUE);

/** Derivă KPI-urile din sumele brute. Numitor 0 → null. */
export function kpisFromTotals(t: Totals): Kpis {
  return {
    spend: t.spend,
    impressions: t.impressions,
    clicks: t.clicks,
    leads: t.leads,
    revenue: t.revenue,
    cpl: div(t.spend, t.leads),
    roas: div(t.revenue, t.spend),
    ctr: div(t.clicks, t.impressions),
    cpc: div(t.spend, t.clicks),
    cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null,
    convRate: div(t.leads, t.clicks),
  };
}

/** Însumează metricile zilnice → totaluri. */
export function sumMetrics(metrics: DailyMetric[]): Totals {
  const t = emptyTotals();
  for (const m of metrics) {
    t.spend += num(m.spend);
    t.impressions += num(m.impressions);
    t.clicks += num(m.clicks);
    t.leads += num(m.leads);
    t.revenue += num(m.revenue);
  }
  return t;
}

/** Adună totalurile mai multor campanii (pentru agregatul din panou). */
export function addTotals(list: Totals[]): Totals {
  const t = emptyTotals();
  for (const x of list) {
    t.spend += num(x.spend);
    t.impressions += num(x.impressions);
    t.clicks += num(x.clicks);
    t.leads += num(x.leads);
    t.revenue += num(x.revenue);
  }
  return t;
}

/** Însumează metricile și derivă KPI-urile. Pură — same input, same output. */
export function computeKpis(metrics: DailyMetric[]): Kpis {
  return kpisFromTotals(sumMetrics(metrics));
}

/** KPI-urile unei platforme, pentru defalcarea unei imagini multi-platformă (un client care rulează pe
 *  Meta + Google + TikTok simultan). */
export interface PlatformKpis {
  platform: Platform;
  kpis: Kpis;
  campaigns: number;
}

/** Grupează campaniile pe platformă și derivă KPI-urile per platformă (răspunsul la „centralizează o campanie
 *  care rulează pe mai multe platforme"). Pură, agnostică de sursa metricilor (manual/CSV/API). Ordinea = PLATFORMS;
 *  o platformă fără campanii nu apare. */
export function kpisByPlatform(items: Array<{ platform: Platform; totals: Totals }>): PlatformKpis[] {
  const groups = new Map<Platform, { totals: Totals[]; count: number }>();
  for (const it of items) {
    const p = PLATFORMS.includes(it.platform) ? it.platform : 'other';
    const g = groups.get(p) ?? { totals: [], count: 0 };
    g.totals.push(it.totals);
    g.count++;
    groups.set(p, g);
  }
  const out: PlatformKpis[] = [];
  for (const p of PLATFORMS) {
    const g = groups.get(p);
    if (g) out.push({ platform: p, kpis: kpisFromTotals(addTotals(g.totals)), campaigns: g.count });
  }
  return out;
}

// ── B2: reperul PROPRIU al clientului (mediana propriilor campanii) ──
// DESCRIPTIV (cum stă clientul față de propriul istoric), distinct de reperul de INDUSTRIE (Pachet B,
// cross-tenant, în blocul L2 cache-uit). Pur: doar din `totals` (fără citiri de metrici zilnice).
// Numeric core aici (TS, testat) + port byte-echivalent în functions/index.js; proza RO stă în functions.
export const CLIENT_BASELINE_MIN_N = 3; // min campanii eligibile/KPI ca să emitem linia (sub 3 nu e „mediană")
export const CLIENT_BASELINE_THIN_N = 5; // n în [MIN_N, THIN_N) → caveat „eșantion mic" (oglindă cu BENCHMARK_MIN_SAMPLES=5)
// Polaritatea fiecărui KPI: la CPL „mai mic = mai bine"; la restul „mai mare = mai bine".
export const KPI_LOWER_IS_BETTER = { cpl: true, roas: false, ctr: false, convRate: false } as const;
export type BaselineKpiName = keyof typeof KPI_LOWER_IS_BETTER;

export interface BaselineKpi {
  median: number | null; // null dacă n < CLIENT_BASELINE_MIN_N
  n: number; // câte campanii au contribuit (KPI non-null)
  smallSample: boolean; // n în [MIN_N, THIN_N)
}

export interface ClientBaseline {
  cohortSize: number; // campanii cu spend>0 (după excludeId)
  platformsPresent: string[]; // platforme distincte în cohortă (pentru caveat-ul de mix)
  roas: BaselineKpi;
  cpl: BaselineKpi;
  ctr: BaselineKpi;
  convRate: BaselineKpi;
  present: boolean; // cohortSize>=2 ȘI cel puțin un KPI are mediană
}

export interface BaselineComparison {
  pct: number; // procent semnat față de mediană
  dir: 'peste' | 'sub' | 'la nivelul';
  verdict: 'mai bine' | 'mai slab' | 'la fel';
}

/** Mediana valorilor finite >=0; gol → null. Pură. (CTR/convRate rămân fracții 0..1; rotunjirea e la afișare.) */
export function median(xs: number[]): number | null {
  const clean = (Array.isArray(xs) ? xs : []).filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0);
  if (!clean.length) return null;
  clean.sort((a, b) => a - b);
  const mid = clean.length >> 1;
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function baselineKpiFrom(values: Array<number | null>): BaselineKpi {
  const kept = values.filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);
  const n = kept.length;
  return {
    median: n >= CLIENT_BASELINE_MIN_N ? median(kept) : null,
    n,
    smallSample: n >= CLIENT_BASELINE_MIN_N && n < CLIENT_BASELINE_THIN_N,
  };
}

/** Reperul intern al clientului din campaniile lui. Fiecare item are nevoie doar de { id?, platform?, totals }.
 *  Cohortă = campanii cu spend>0 (după excludeId). Mediana per-KPI peste RATELE per-campanie (egal-ponderate —
 *  „față de campania ta TIPICĂ", nu reformulare a marilor cheltuitori, pe care îi dă deja linia de TOTAL). */
export function computeClientBaseline(
  items: Array<{ id?: string; platform?: string; totals?: Totals }>,
  opts?: { excludeId?: string }
): ClientBaseline {
  const excludeId = opts?.excludeId;
  const cohort = (Array.isArray(items) ? items : [])
    .filter((it) => it && it.totals && num(it.totals.spend) > 0)
    .filter((it) => !(excludeId && it.id === excludeId));
  const roasV: Array<number | null> = [];
  const cplV: Array<number | null> = [];
  const ctrV: Array<number | null> = [];
  const convV: Array<number | null> = [];
  for (const it of cohort) {
    const t = it.totals as Totals;
    const spend = num(t.spend), rev = num(t.revenue), leads = num(t.leads), clicks = num(t.clicks), impr = num(t.impressions);
    roasV.push(div(rev, spend));
    cplV.push(div(spend, leads));
    ctrV.push(div(clicks, impr));
    convV.push(div(leads, clicks));
  }
  const roas = baselineKpiFrom(roasV);
  const cpl = baselineKpiFrom(cplV);
  const ctr = baselineKpiFrom(ctrV);
  const convRate = baselineKpiFrom(convV);
  const platformsPresent = Array.from(new Set(cohort.map((it) => String(it.platform || '')).filter(Boolean)));
  const present = cohort.length >= 2 && [roas, cpl, ctr, convRate].some((b) => b.median !== null);
  return { cohortSize: cohort.length, platformsPresent, roas, cpl, ctr, convRate, present };
}

/** Compară o valoare cu mediana de reper, ținând cont de POLARITATE (la CPL mic = bine). null dacă lipsește
 *  o latură sau mediana <= 0. |pct| <= 3 → „la nivelul / la fel" (fără peste/sub spurios pe zgomot). */
export function compareToBaseline(kpi: BaselineKpiName, value: number | null, base: BaselineKpi | null): BaselineComparison | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  if (!base || base.median === null || !(base.median > 0)) return null;
  const pct = Math.round(((value - base.median) / base.median) * 100);
  if (Math.abs(pct) <= 3) return { pct, dir: 'la nivelul', verdict: 'la fel' };
  const higher = pct > 0;
  const better = higher !== KPI_LOWER_IS_BETTER[kpi]; // higher XOR lowerIsBetter
  return { pct, dir: higher ? 'peste' : 'sub', verdict: better ? 'mai bine' : 'mai slab' };
}

// ── AI Optimization Engine (spec 5.5): recomandarea AI pe baza performanței campaniei ──
export const VERDICTS = ['scale', 'maintain', 'pause', 'test'] as const;
export type Verdict = (typeof VERDICTS)[number];

// Felia 5b: acțiunile recomandate au devenit SCHEMĂ TIPATĂ (array de obiecte) — chips în UI + pregătire
// pentru declanșatoare de automatizare/sugestii. `verdict` = axă separată (recomandarea globală).
export const INSIGHT_CHANGE_TYPES = ['scale', 'reduce', 'pause', 'keep', 'test'] as const;
export type InsightChangeType = (typeof INSIGHT_CHANGE_TYPES)[number];
export const INSIGHT_TARGETS = ['budget', 'audience', 'creative', 'placement', 'bid'] as const;
export type InsightTarget = (typeof INSIGHT_TARGETS)[number];
export const INSIGHT_MAGNITUDES = ['small', 'medium', 'large'] as const;
// Încrederea în analiză (Pachet C) — calibrată DUPĂ cantitatea de date (clicuri/lead-uri). 'low' = eșantion subțire
// → UI o marchează + automatizarea NU se declanșează pe ea. Pragul exact = insightConfidence (mai jos).
export const INSIGHT_CONFIDENCES = ['low', 'med', 'high'] as const;
export type InsightConfidence = (typeof INSIGHT_CONFIDENCES)[number];
export const INSIGHT_MIN_CLICKS = 50; // sub acest prag de clicuri SAU lead-uri → confidence forțat 'low'
export const INSIGHT_MIN_LEADS = 15;

/** Încrederea finală în insight: plafonată de eșantion (date subțiri → 'low'), altfel ce a raportat modelul.
 *  PUR — folosit în functions (port) + testabil. */
export function insightConfidence(totalClicks: number, totalLeads: number, modelConfidence: unknown): InsightConfidence {
  const c = INSIGHT_CONFIDENCES.includes(modelConfidence as InsightConfidence) ? (modelConfidence as InsightConfidence) : 'med';
  const clicks = typeof totalClicks === 'number' && totalClicks >= 0 ? totalClicks : 0;
  const leads = typeof totalLeads === 'number' && totalLeads >= 0 ? totalLeads : 0;
  if (clicks < INSIGHT_MIN_CLICKS || leads < INSIGHT_MIN_LEADS) return 'low'; // eșantion insuficient → niciodată peste 'low'
  return c;
}
export type InsightMagnitude = (typeof INSIGHT_MAGNITUDES)[number];
export const INSIGHT_ACTIONS_MAX = 8;
export const INSIGHT_TEXT_MAX = 4000;

export interface InsightAction {
  changeType: InsightChangeType;
  target: InsightTarget;
  magnitude: InsightMagnitude;
}

export interface AiInsight {
  verdict: Verdict;
  headline: string;
  reasoning: string;
  actions: InsightAction[];
  confidence: InsightConfidence; // calibrată după eșantion (vezi insightConfidence)
}

function inInsightEnum<T extends string>(list: readonly T[], v: unknown, fb: T): T {
  return list.includes(v as T) ? (v as T) : fb;
}

/** Normalizează o acțiune recomandată (enum cu fallback) — pe modelul coerceAdVariant din request.ts. */
export function coerceInsightAction(v: unknown): InsightAction {
  const d = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    changeType: inInsightEnum(INSIGHT_CHANGE_TYPES, d.changeType, 'keep'),
    target: inInsightEnum(INSIGHT_TARGETS, d.target, 'budget'),
    magnitude: inInsightEnum(INSIGHT_MAGNITUDES, d.magnitude, 'medium'),
  };
}

export function coerceToInsight(v: unknown): AiInsight | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  if (!VERDICTS.includes(d.verdict as Verdict)) return null;
  const s = (x: unknown) => (typeof x === 'string' ? x.slice(0, INSIGHT_TEXT_MAX) : '');
  // Clean break: format vechi (string) / non-array → listă goală, fără throw/parsare.
  const actions = Array.isArray(d.actions) ? d.actions.slice(0, INSIGHT_ACTIONS_MAX).map(coerceInsightAction) : [];
  // confidence: insight-urile vechi (fără câmp) → 'med' (neutru), ca să nu fie marcate fals drept incerte.
  const confidence = INSIGHT_CONFIDENCES.includes(d.confidence as InsightConfidence) ? (d.confidence as InsightConfidence) : 'med';
  return { verdict: d.verdict as Verdict, headline: s(d.headline), reasoning: s(d.reasoning), actions, confidence };
}

/** Flatten acțiunile → text numerotat pt. copy/PDF (reutilizat de MarketingCenter; pe modelul deliverablesToSections). */
export function insightActionsToText(t: (k: string) => string, actions: InsightAction[]): string {
  return actions
    .map((a, i) => `${i + 1}. ${t('admin.insChange_' + a.changeType)} · ${t('admin.insTarget_' + a.target)} · ${t('admin.insMag_' + a.magnitude)}`)
    .join('\n');
}

// Raportul lunar de performanță prezentat clientului (generat de AI din campaniile lui).
export interface ClientReport {
  summary: string;
  highlights: string;
  recommendations: string;
}

export function coerceToReport(v: unknown): ClientReport | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === 'string' ? x.slice(0, 6000) : '');
  const r = { summary: s(d.summary), highlights: s(d.highlights), recommendations: s(d.recommendations) };
  return r.summary || r.highlights || r.recommendations ? r : null;
}

// Pachet C2: realocare buget cross-campanie (aiBudgetAllocation). Acțiunile = enum stabil — PARITATE cu
// ALLOCATION_SCHEMA.properties.moves.items.properties.action.enum din functions/index.js. UI-ul operatorului
// citește budgetAllocations/{leadId} prin coerceToAllocation (defensiv: doc corupt → null/mișcare ignorată).
export const ALLOCATION_ACTIONS = ['scale', 'reduce', 'pause', 'keep'] as const;
export type AllocationAction = (typeof ALLOCATION_ACTIONS)[number];

export interface AllocationMove {
  campaign: string;
  action: AllocationAction;
  reason: string;
}

export interface BudgetAllocation {
  headline: string;
  summary: string;
  moves: AllocationMove[];
}

export function coerceToAllocation(v: unknown): BudgetAllocation | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  const moves: AllocationMove[] = Array.isArray(d.moves)
    ? d.moves
        .slice(0, 24)
        .map((m) => {
          const x = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
          return {
            campaign: typeof x.campaign === 'string' ? x.campaign.slice(0, 200) : '',
            action: ALLOCATION_ACTIONS.includes(x.action as AllocationAction) ? (x.action as AllocationAction) : 'keep',
            reason: typeof x.reason === 'string' ? x.reason.slice(0, 600) : '',
          };
        })
        .filter((m) => m.campaign)
    : [];
  const headline = typeof d.headline === 'string' ? d.headline.slice(0, 500) : '';
  const summary = typeof d.summary === 'string' ? d.summary.slice(0, 3000) : '';
  // Doc gol/corupt → null (UI nu afișează card gol). Util dacă există măcar headline/summary sau o mișcare.
  return headline || summary || moves.length ? { headline, summary, moves } : null;
}

export function coerceToTotals(v: unknown): Totals {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  // numCap (nu num): un rollup `totals` corupt e citit DIRECT de dashboard, defalcarea pe platformă și prompturile AI —
  // plafonul trebuie aplicat și aici, nu doar pe metricile zilnice, ca o valoare absurdă să nu otrăvească KPI/AI.
  return { spend: numCap(d.spend), impressions: numCap(d.impressions), clicks: numCap(d.clicks), leads: numCap(d.leads), revenue: numCap(d.revenue) };
}

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function coerceToCampaign(data: unknown): CampaignDef | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  return {
    schema: CAMPAIGN_SCHEMA,
    name: typeof d.name === 'string' ? d.name.slice(0, 120) : '',
    platform: PLATFORMS.includes(d.platform as Platform) ? (d.platform as Platform) : 'other',
    status: CAMPAIGN_STATUSES.includes(d.status as CampaignStatus) ? (d.status as CampaignStatus) : 'active',
    currency: typeof d.currency === 'string' && d.currency ? d.currency.slice(0, 8) : 'EUR',
    externalId: typeof d.externalId === 'string' ? d.externalId.slice(0, 120) : '',
    clientUid: typeof d.clientUid === 'string' ? d.clientUid.slice(0, 128) : '',
    totals: coerceToTotals(d.totals),
  };
}

/** Metrică validă doar cu dată în format corect; altfel null (rândul e sărit, fără crash). */
export function coerceToDailyMetric(data: unknown): DailyMetric | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.date !== 'string' || !VALID_DATE.test(d.date)) return null;
  const src = d.source;
  return {
    schema: METRIC_SCHEMA,
    date: d.date,
    spend: numCap(d.spend),
    impressions: numCap(d.impressions),
    clicks: numCap(d.clicks),
    leads: numCap(d.leads),
    revenue: numCap(d.revenue),
    source: src === 'meta' || src === 'google' || src === 'tiktok' || src === 'other' ? src : 'manual',
  };
}
