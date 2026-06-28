/**
 * Axa monetară F2 — economia AGENȚIEI: venitul facturat per client (LTV-ul afacerii NOASTRE) + raport LTV:CAC.
 * PUR (fără Firebase/React), testat headless. DOAR agregare la citire (facturile există deja sub clients/{uid}/invoices,
 * citibile de admin) — fără scrieri, triggere sau colecții noi. Distinct de F1 (economia CLIENȚILOR clientului).
 *
 * LTV agenție = suma facturilor EMISE (kind 'factura' cu number != '', necancelate) ale unui client; stornările au
 * total NEGATIV (qty negative) → se scad natural. CAC = costul nostru de achiziție (manual pe lead, opțional).
 */
import { coerceToInvoice, invoiceTotals } from '../types/invoice';

const r2 = (n: number): number => Math.round(n * 100) / 100;

export interface AgencyRevenue {
  invoiced: number; // suma facturilor emise (inclusiv storno negativ) = LTV-ul agenției pt. client
  paid: number; // suma celor cu status 'paid'
  count: number; // nr. facturi fiscale emise (exclus proforme/draft/cancelled)
  currency: string; // moneda dominantă (prima întâlnită)
  mixedCurrency: boolean; // true dacă facturile amestecă monede (suma e orientativă)
}

/** Agregă venitul facturat dintr-o listă brută de facturi (orice formă; trecute prin coerceToInvoice). */
export function agencyRevenue(invoices: unknown[]): AgencyRevenue {
  let invoiced = 0;
  let paid = 0;
  let count = 0;
  let currency = '';
  let mixed = false;
  for (const raw of Array.isArray(invoices) ? invoices : []) {
    const inv = coerceToInvoice(raw);
    if (inv.kind !== 'factura') continue; // proformele NU sunt venit fiscal
    if (!inv.number) continue; // doar EMISE (numerotate)
    if (inv.status === 'cancelled') continue; // anulate excluse
    const total = invoiceTotals(inv).total; // storno → negativ
    invoiced += total;
    if (inv.status === 'paid') paid += total;
    count += 1;
    if (inv.currency) {
      if (!currency) currency = inv.currency;
      else if (currency !== inv.currency) mixed = true;
    }
  }
  return { invoiced: r2(invoiced), paid: r2(paid), count, currency: currency || 'RON', mixedCurrency: mixed };
}

/** Costul de achiziție manual (per lead): număr ≥0, plafonat. Negativ/NaN/lipsă → 0. */
export const AGENCY_CAC_MAX = 1e9;
export function coerceAcquisitionCost(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, AGENCY_CAC_MAX) : 0;
}

export interface ClientEconomics extends AgencyRevenue {
  acquisitionCost: number;
  ltvCacRatio: number | null; // invoiced / acquisitionCost; null dacă nu e introdus costul (CAC necunoscut)
}

/** Economia agenției pentru un client: venit facturat + cost de achiziție + raportul LTV:CAC (când e cunoscut costul). */
export function clientEconomics(invoices: unknown[], acquisitionCost: unknown): ClientEconomics {
  const rev = agencyRevenue(invoices);
  const cost = coerceAcquisitionCost(acquisitionCost);
  return { ...rev, acquisitionCost: cost, ltvCacRatio: cost > 0 ? r2(rev.invoiced / cost) : null };
}
