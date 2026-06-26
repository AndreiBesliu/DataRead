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
  return { verdict: d.verdict as Verdict, headline: s(d.headline), reasoning: s(d.reasoning), actions };
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
