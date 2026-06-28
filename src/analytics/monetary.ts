/**
 * Axa monetară (Felia 1) — economia clienților clientului: LTV per contact + CAC/ROI per campanie.
 * PUR (fără Firebase/React), testat headless. coerceMoney/sumWonValue/coerceToContactDeal au PORT JS în
 * functions/index.js (paritate asertată e2e). campaignKey/campaignEconomics/wonRevenue = doar UI (TS).
 *
 * LTV-ul unui contact = suma valorilor tranzacțiilor CÂȘTIGATE (lpLeadState.value pe status 'castigat'),
 * recalculată tranzacțional din oglinda `deals/{submissionId}` (idempotent, tiparul D#5). CAC/ROI per campanie
 * = cheltuiala campaniei vs. contactele aduse de ea (atribuire prin contact.acquisition.campaign).
 */
import { MAX_METRIC_VALUE } from './kpi';

export const MAX_MONEY = MAX_METRIC_VALUE; // 1e12 — plafon defensiv pe sume (typo/corupt)
export const CONTACT_CAC_THIN_N = 5; // sub 5 contacte aduse → CAC „eșantion mic" (convenția CLIENT_BASELINE_THIN_N)

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** Normalizează o sumă: negativ/NaN/non-număr → 0, peste plafon → plafon. Niciodată throw. */
export function coerceMoney(v: unknown): number {
  return Math.min(num(v), MAX_MONEY);
}

// ── Oglinda per-tranzacție (deals/{submissionId}) — sursa recalculului LTV. ──
export interface DealRow {
  value: number;
  won: boolean;
}

export interface ContactDeal {
  schema: 1;
  value: number;
  won: boolean;
  slug: string;
  at: number; // ms epoch
}

/** Unicul normaliser pt. un deal (read path + scriere server). Corupt/lipsă → defaults sigure, niciodată throw. */
export function coerceToContactDeal(raw: unknown): ContactDeal {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    schema: 1,
    value: coerceMoney(d.value),
    won: d.won === true,
    slug: typeof d.slug === 'string' ? d.slug.slice(0, 80) : '',
    at: num(d.at),
  };
}

/** LTV = suma valorilor deal-urilor CÂȘTIGATE. Plafonat. (Recalcul-din-zero, NU increment → idempotent.) */
export function sumWonValue(rows: DealRow[]): number {
  let total = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r && r.won === true) total += coerceMoney(r.value);
  }
  return Math.min(total, MAX_MONEY);
}

/** Venitul câștigat al clientului (din lpLeadState deja în memorie în portal) = suma valorilor pe status 'castigat'. */
export function wonRevenue(states: Array<{ status?: string; value?: unknown }>): number {
  let total = 0;
  for (const s of Array.isArray(states) ? states : []) {
    if (s && s.status === 'castigat') total += coerceMoney(s.value);
  }
  return Math.min(total, MAX_MONEY);
}

// ── CAC/ROI per campanie (calculat la citire, nestocat). ──
/** Cheia de potrivire campanie↔contact: trim + lowercase. '' dacă gol (necomparabil). */
export function campaignKey(s: unknown): string {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

export interface AcqContact {
  acquisitionCampaign: string; // contact.acquisition.campaign
  ltv: number; // contact.rollup.value
}

export interface CampaignEconomics {
  campaign: string;
  spend: number;
  acquired: number; // contacte aduse de campanie (după acquisition.campaign)
  cac: number | null; // spend / acquired
  cohortValue: number; // suma LTV a contactelor aduse
  roi: number | null; // cohortValue / spend
  avgLtv: number | null; // cohortValue / acquired
  smallSample: boolean; // acquired în [1, CONTACT_CAC_THIN_N)
}

/** Economia unei campanii dintr-un set de contacte (potrivire pe nume, case-insensitive). Rapoarte null pe numitor 0. */
export function campaignEconomics(campaignName: string, spend: unknown, contacts: AcqContact[]): CampaignEconomics {
  const key = campaignKey(campaignName);
  const sp = coerceMoney(spend);
  let acquired = 0;
  let cohortValue = 0;
  for (const c of Array.isArray(contacts) ? contacts : []) {
    if (c && campaignKey(c.acquisitionCampaign) === key && key !== '') {
      acquired += 1;
      cohortValue += coerceMoney(c.ltv);
    }
  }
  cohortValue = Math.min(cohortValue, MAX_MONEY);
  return {
    campaign: typeof campaignName === 'string' ? campaignName : '',
    spend: sp,
    acquired,
    cac: div(sp, acquired),
    cohortValue,
    roi: div(cohortValue, sp),
    avgLtv: div(cohortValue, acquired),
    smallSample: acquired >= 1 && acquired < CONTACT_CAC_THIN_N,
  };
}

export interface UnattributedBucket {
  contacts: number;
  cohortValue: number;
}

/** Economia tuturor campaniilor + găleata „neatribuit" (contacte fără campanie sau cu campanie ce nu se potrivește
 *  niciunei campanii din listă) — ca totalurile de cohortă să se reconcilieze cu suma LTV. */
export function campaignEconomicsAll(
  campaigns: Array<{ name: string; spend: unknown }>,
  contacts: AcqContact[]
): { perCampaign: CampaignEconomics[]; unattributed: UnattributedBucket } {
  const list = Array.isArray(campaigns) ? campaigns : [];
  // Dedupe pe cheie (campanii cu ACELAȘI nume → O SINGURĂ linie, spend ÎNSUMAT) — altfel cohortValue se dublează
  // (ambele linii potrivesc aceleași contacte) și cheia de randare React se ciocnește.
  const byKey = new Map<string, { name: string; spend: number }>();
  for (const c of list) {
    const k = campaignKey(c.name);
    if (k === '') continue; // campanie fără nume → nu poate atribui contacte (intră implicit în „neatribuit")
    const cur = byKey.get(k);
    if (cur) cur.spend = Math.min(cur.spend + coerceMoney(c.spend), MAX_MONEY);
    else byKey.set(k, { name: typeof c.name === 'string' ? c.name : '', spend: coerceMoney(c.spend) });
  }
  const perCampaign = Array.from(byKey.values()).map((c) => campaignEconomics(c.name, c.spend, contacts));
  const known = new Set(byKey.keys());
  const unattributed: UnattributedBucket = { contacts: 0, cohortValue: 0 };
  for (const c of Array.isArray(contacts) ? contacts : []) {
    if (!c) continue;
    const k = campaignKey(c.acquisitionCampaign);
    if (k === '' || !known.has(k)) {
      unattributed.contacts += 1;
      unattributed.cohortValue += coerceMoney(c.ltv);
    }
  }
  unattributed.cohortValue = Math.min(unattributed.cohortValue, MAX_MONEY);
  return { perCampaign, unattributed };
}
