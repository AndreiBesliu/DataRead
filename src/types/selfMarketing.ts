/**
 * „Self Marketing" — generatorul AI de strategie self-serve pentru clienți (callable selfGenerateStrategy).
 * Profilul firmei (clients/{uid}/selfMarketing/profile) + strategia generată (.../strategy) + quota de trial
 * (.../quota, scrisă doar de functions). REGULĂ (CLAUDE.md): toate căile de încărcare trec prin câte un
 * coerceTo*, niciodată throw; validarea profilului e pură (erori = chei i18n), testată headless. Paritate cu
 * clampul JS din functions/index.js (selfGenerateStrategy normalizează la scriere, TS coerce la citire).
 */
import { INDUSTRIES, type Industry } from './onboarding';

export const SELF_MARKETING_SCHEMA = 1;
export const SELF_PROFILE_DRAFT_KEY = 'dataread.selfProfileDraft.v1';

// Trial gratuit (paritate cu SELF_FREE_TOTAL / SELF_DAILY_CAP din functions/index.js — sursă duală).
export const SELF_FREE_TOTAL = 5; // explorări gratuite totale (lifetime) per client
export const SELF_DAILY_CAP = 2; // generări pe zi per client

// Plafoane per câmp — sursă unică pt. coerce + paritate cu clampul server-side.
export const SELF_PROFILE_LIMITS = {
  companyName: 120,
  industryOther: 80,
  productsServices: 2000,
  audience: 1000,
  area: 200,
  competitors: 1000,
  budget: 200,
  goals: 2000,
} as const;

export interface SelfCompanyProfile {
  schema: typeof SELF_MARKETING_SCHEMA;
  /** Firma */
  companyName: string;
  industry: Industry | '';
  industryOther: string;
  /** Ofertă */
  productsServices: string;
  /** Piață */
  audience: string;
  area: string; // localitate / zonă
  competitors: string;
  /** Obiective */
  budget: string; // buget estimativ — text liber
  goals: string; // obiective de marketing
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

export function emptySelfProfile(): SelfCompanyProfile {
  return {
    schema: SELF_MARKETING_SCHEMA,
    companyName: '',
    industry: '',
    industryOther: '',
    productsServices: '',
    audience: '',
    area: '',
    competitors: '',
    budget: '',
    goals: '',
  };
}

/** Unicul punct de intrare pentru orice date care pretind a fi un profil de firmă — corupt/legacy/viitor
 *  → defaults sigure, niciodată throw. */
export function coerceToSelfCompanyProfile(data: unknown): SelfCompanyProfile {
  if (typeof data !== 'object' || data === null) return emptySelfProfile();
  const d = data as Record<string, unknown>;
  const L = SELF_PROFILE_LIMITS;
  return {
    schema: SELF_MARKETING_SCHEMA,
    companyName: str(d.companyName, L.companyName),
    industry: INDUSTRIES.includes(d.industry as Industry) ? (d.industry as Industry) : '',
    industryOther: str(d.industryOther, L.industryOther),
    productsServices: str(d.productsServices, L.productsServices),
    audience: str(d.audience, L.audience),
    area: str(d.area, L.area),
    competitors: str(d.competitors, L.competitors),
    budget: str(d.budget, L.budget),
    goals: str(d.goals, L.goals),
  };
}

/** Draftul local (string JSON din localStorage) → profil sigur. Nu aruncă niciodată. */
export function coerceToSelfProfileDraft(raw: string | null): SelfCompanyProfile | null {
  if (!raw) return null;
  try {
    return coerceToSelfCompanyProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

// ── Strategia generată ──

export const STRATEGY_OVERVIEW_MAX = 1500;
export const STRATEGY_DIRECTIONS_MAX = 6;
/** Plafoane per câmp ale unei direcții — sursă unică (TS coerce + paritate cu clampul din functions). */
export const STRATEGY_DIRECTION_LIMITS = {
  title: 140,
  positioningAngle: 600,
  targetSegment: 400,
  channelMix: 600,
  keyMessages: 800,
  campaignIdeas: 1000,
  kpis: 400,
} as const;

export interface StrategyDirection {
  title: string; // numele unghiului / direcției
  positioningAngle: string; // unghiul de poziționare
  targetSegment: string; // segmentul țintă
  channelMix: string; // mixul de canale
  keyMessages: string; // mesaje-cheie
  campaignIdeas: string; // idei de campanie
  kpis: string; // indicatori de urmărit
}

export interface SelfStrategy {
  schema: typeof SELF_MARKETING_SCHEMA;
  overview: string; // rezumat de poziționare
  directions: StrategyDirection[]; // 3-4 direcții (cap STRATEGY_DIRECTIONS_MAX)
}

export function coerceToSelfStrategy(v: unknown): SelfStrategy {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const L = STRATEGY_DIRECTION_LIMITS;
  const directions = (Array.isArray(d.directions) ? d.directions : [])
    .slice(0, STRATEGY_DIRECTIONS_MAX)
    .map((raw) => {
      const x = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      return {
        title: str(x.title, L.title),
        positioningAngle: str(x.positioningAngle, L.positioningAngle),
        targetSegment: str(x.targetSegment, L.targetSegment),
        channelMix: str(x.channelMix, L.channelMix),
        keyMessages: str(x.keyMessages, L.keyMessages),
        campaignIdeas: str(x.campaignIdeas, L.campaignIdeas),
        kpis: str(x.kpis, L.kpis),
      };
    });
  return {
    schema: SELF_MARKETING_SCHEMA,
    overview: str(d.overview, STRATEGY_OVERVIEW_MAX),
    directions,
  };
}

// ── Oportunități: ~10 idei de promovare prioritizate pe impact (pasul „Oportunități", intrarea în funnel) ──

export const OPPORTUNITIES_MAX = 10;
export const OPPORTUNITY_LIMITS = {
  title: 140,
  channel: 80,
  why: 600,
  description: 800,
  firstStep: 400,
} as const;

export const SELF_IMPACT_LEVELS = ['high', 'medium', 'low'] as const;
export type SelfImpact = (typeof SELF_IMPACT_LEVELS)[number];
const IMPACT_ORDER: Record<SelfImpact, number> = { high: 0, medium: 1, low: 2 };

export interface SelfOpportunity {
  title: string; // ideea de promovare
  channel: string; // canalul principal (ex. Meta Ads, Google Search, email)
  impact: SelfImpact; // impact estimat — pentru prioritizare
  why: string; // de ce e potrivită firmei
  description: string; // ce presupune concret
  firstStep: string; // primul pas de făcut
}

export interface SelfOpportunities {
  schema: typeof SELF_MARKETING_SCHEMA;
  items: SelfOpportunity[]; // sortate pe impact (cap OPPORTUNITIES_MAX)
}

export function coerceToSelfOpportunities(v: unknown): SelfOpportunities {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const L = OPPORTUNITY_LIMITS;
  const items = (Array.isArray(d.items) ? d.items : [])
    .map((raw) => {
      const x = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      const impact: SelfImpact = SELF_IMPACT_LEVELS.includes(x.impact as SelfImpact) ? (x.impact as SelfImpact) : 'medium';
      return {
        title: str(x.title, L.title),
        channel: str(x.channel, L.channel),
        impact,
        why: str(x.why, L.why),
        description: str(x.description, L.description),
        firstStep: str(x.firstStep, L.firstStep),
      };
    })
    .sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact])
    .slice(0, OPPORTUNITIES_MAX);
  return { schema: SELF_MARKETING_SCHEMA, items };
}

// ── Detalii: aprofundarea tactică a UNEI direcții alese din strategie (pasul „Detalii") ──

export const DETAILS_LIMITS = {
  directionTitle: 140,
  budgetSplit: 1000,
  audienceDetail: 1000,
  messaging: 1200,
  funnel: 1200,
  campaignBrief: 1500,
  timeline: 800,
} as const;

export interface SelfDetails {
  schema: typeof SELF_MARKETING_SCHEMA;
  directionTitle: string; // direcția aprofundată (din strategie)
  budgetSplit: string; // împărțirea bugetului pe canale
  audienceDetail: string; // public țintă detaliat / segmentare
  messaging: string; // mesaje & unghiuri de comunicare
  funnel: string; // pâlnia (etape + acțiuni)
  campaignBrief: string; // brief concret de campanie
  timeline: string; // calendar / pași în timp
}

export function coerceToSelfDetails(v: unknown): SelfDetails {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const L = DETAILS_LIMITS;
  return {
    schema: SELF_MARKETING_SCHEMA,
    directionTitle: str(d.directionTitle, L.directionTitle),
    budgetSplit: str(d.budgetSplit, L.budgetSplit),
    audienceDetail: str(d.audienceDetail, L.audienceDetail),
    messaging: str(d.messaging, L.messaging),
    funnel: str(d.funnel, L.funnel),
    campaignBrief: str(d.campaignBrief, L.campaignBrief),
    timeline: str(d.timeline, L.timeline),
  };
}

// ── Execuție: plan pe 30 de zile (faze săptămânale) + KPI + sugestii A/B + optimizare buget (pasul „Execuție") ──

export const EXECUTION_WEEKS_MAX = 6;
export const EXECUTION_LIMITS = {
  directionTitle: 140,
  summary: 1000,
  weekTitle: 140,
  focus: 600,
  actions: 1000,
  kpi: 400,
  abTests: 1000,
  optimization: 1000,
} as const;

export interface SelfExecutionWeek {
  title: string; // ex. „Săptămâna 1 — Pregătire"
  focus: string; // obiectivul săptămânii
  actions: string; // acțiunile concrete ale săptămânii
  kpi: string; // ce se măsoară în acea săptămână
}

export interface SelfExecution {
  schema: typeof SELF_MARKETING_SCHEMA;
  directionTitle: string; // direcția pe care se bazează planul (din strategie)
  summary: string; // rezumatul planului de 30 de zile
  weeks: SelfExecutionWeek[]; // fazele săptămânale (cap EXECUTION_WEEKS_MAX)
  abTests: string; // sugestii de testare A/B
  optimization: string; // recomandări de optimizare a bugetului
}

export function coerceToSelfExecution(v: unknown): SelfExecution {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const L = EXECUTION_LIMITS;
  const weeks = (Array.isArray(d.weeks) ? d.weeks : [])
    .slice(0, EXECUTION_WEEKS_MAX)
    .map((raw) => {
      const x = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      return {
        title: str(x.title, L.weekTitle),
        focus: str(x.focus, L.focus),
        actions: str(x.actions, L.actions),
        kpi: str(x.kpi, L.kpi),
      };
    });
  return {
    schema: SELF_MARKETING_SCHEMA,
    directionTitle: str(d.directionTitle, L.directionTitle),
    summary: str(d.summary, L.summary),
    weeks,
    abTests: str(d.abTests, L.abTests),
    optimization: str(d.optimization, L.optimization),
  };
}

// ── Quota de trial (clients/{uid}/selfMarketing/quota — scrisă doar de functions) ──

export interface SelfQuota {
  schema: typeof SELF_MARKETING_SCHEMA;
  total: number; // generări reușite (lifetime)
  day: string; // 'YYYY-MM-DD'
  dayCount: number; // generări azi
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

export function coerceToSelfQuota(v: unknown): SelfQuota {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  return {
    schema: SELF_MARKETING_SCHEMA,
    total: num(d.total),
    day: typeof d.day === 'string' ? d.day.slice(0, 10) : '',
    dayCount: num(d.dayCount),
  };
}

/** Câte explorări gratuite (lifetime) mai are clientul. Quota lipsă = trialul plin. */
export function selfFreeRemaining(q: SelfQuota | null): number {
  return Math.max(0, SELF_FREE_TOTAL - (q ? q.total : 0));
}

// ── Validare pură (erorile = chei i18n selfMarketing.errors.*) — testabilă headless ──

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

/** Validare pură — fără DOM, fără Firestore. Obligatorii: nume, domeniu (+altul dacă „other"), ofertă,
 *  public țintă, obiective. Buget / zonă / concurenți sunt opționale (ajută strategia, nu o blochează). */
export function validateSelfProfile(d: SelfCompanyProfile): ValidationResult {
  const errors: Record<string, string> = {};
  const req = (field: keyof SelfCompanyProfile) => {
    if (!String(d[field] ?? '').trim()) errors[field] = 'selfMarketing.errors.required';
  };

  req('companyName');
  req('productsServices');
  req('audience');
  req('goals');

  if (!d.industry) errors.industry = 'selfMarketing.errors.required';
  if (d.industry === 'other' && !d.industryOther.trim()) errors.industryOther = 'selfMarketing.errors.required';

  for (const [field, max] of Object.entries(SELF_PROFILE_LIMITS) as [keyof SelfCompanyProfile, number][]) {
    if (String(d[field] ?? '').length > max) errors[field] = 'selfMarketing.errors.tooLong';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
