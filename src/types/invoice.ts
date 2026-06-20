/**
 * Facturi / Proforme (Verticala 2 „Lansare Soft", modul `crm`) — prima felie. Documente financiare per client,
 * stocate sub `clients/{uid}/invoices/{id}` (izolare multi-tenant). Model + coerce unic (schema:N, nu aruncă) +
 * calcul totaluri PUR (testat) + compunere HTML A4 escapată pentru PDF (print-to-PDF, fără dependențe).
 * NB: e-Factura (ANAF/SPV) e o fază ulterioară — acum doar generare + PDF + listă.
 */
export const INVOICE_SCHEMA = 1;

export const INVOICE_KINDS = ['proforma', 'factura'] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_DEFAULT_VAT = 19; // TVA standard RO (%); 0 = neplătitor / scutit
export const INVOICE_ITEMS_MAX = 50;
export const INVOICE_LIMITS = {
  series: 20, number: 20, description: 500, party: 200, cui: 40, regCom: 40, address: 300, iban: 40, notes: 1000, currency: 8,
} as const;

export interface InvoiceItem {
  description: string;
  qty: number;
  unitPrice: number;
}

export interface InvoiceParty {
  name: string;
  cui: string;     // CUI / CIF
  regCom: string;  // nr. Reg. Comerțului
  address: string;
  iban: string;
}

export interface Invoice {
  schema: number;
  id?: string;
  kind: InvoiceKind;
  series: string;
  number: string;
  issuedAt: string; // 'YYYY-MM-DD'
  dueAt: string;    // 'YYYY-MM-DD' (poate fi gol)
  currency: string; // ex. 'RON', 'EUR'
  seller: InvoiceParty;
  buyer: InvoiceParty;
  items: InvoiceItem[];
  vatRate: number;  // %
  notes: string;
  status: InvoiceStatus;
  createdBy: string;
  updatedAt: number;
}

function s(v: unknown, max: number): string {
  return (typeof v === 'string' ? v : '').slice(0, max);
}
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function emptyParty(): InvoiceParty {
  return { name: '', cui: '', regCom: '', address: '', iban: '' };
}
function coerceParty(raw: unknown): InvoiceParty {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const L = INVOICE_LIMITS;
  return {
    name: s(d.name, L.party), cui: s(d.cui, L.cui), regCom: s(d.regCom, L.regCom),
    address: s(d.address, L.address), iban: s(d.iban, L.iban),
  };
}

export function coerceToInvoice(raw: unknown): Invoice {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const L = INVOICE_LIMITS;
  const items = (Array.isArray(d.items) ? d.items : [])
    .slice(0, INVOICE_ITEMS_MAX)
    .map((it) => {
      const x = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
      return { description: s(x.description, L.description), qty: Math.max(0, num(x.qty)), unitPrice: Math.max(0, num(x.unitPrice)) };
    });
  let vatRate = num(d.vatRate);
  vatRate = Math.max(0, Math.min(100, vatRate));
  return {
    schema: INVOICE_SCHEMA,
    id: typeof d.id === 'string' ? d.id : undefined,
    kind: INVOICE_KINDS.includes(d.kind as InvoiceKind) ? (d.kind as InvoiceKind) : 'proforma',
    series: s(d.series, L.series),
    number: s(d.number, L.number),
    issuedAt: s(d.issuedAt, 10),
    dueAt: s(d.dueAt, 10),
    currency: s(d.currency, L.currency) || 'RON',
    seller: coerceParty(d.seller),
    buyer: coerceParty(d.buyer),
    items,
    vatRate: d.vatRate === undefined ? INVOICE_DEFAULT_VAT : vatRate,
    notes: s(d.notes, L.notes),
    status: INVOICE_STATUSES.includes(d.status as InvoiceStatus) ? (d.status as InvoiceStatus) : 'draft',
    createdBy: s(d.createdBy, 128),
    updatedAt: num(d.updatedAt),
  };
}

// ── Config furnizor (appConfig/invoiceSeller) — datele agenției + default-uri, salvate o singură dată. ──
export interface InvoiceConfig {
  schema: number;
  seller: InvoiceParty;
  defaultSeries: string;
  defaultVatRate: number;
  defaultCurrency: string;
}

export function coerceToInvoiceConfig(raw: unknown): InvoiceConfig {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  let vat = num(d.defaultVatRate);
  vat = Math.max(0, Math.min(100, vat));
  return {
    schema: INVOICE_SCHEMA,
    seller: coerceParty(d.seller),
    defaultSeries: s(d.defaultSeries, INVOICE_LIMITS.series),
    defaultVatRate: d.defaultVatRate === undefined ? INVOICE_DEFAULT_VAT : vat,
    defaultCurrency: s(d.defaultCurrency, INVOICE_LIMITS.currency) || 'RON',
  };
}

export interface InvoiceTotals { subtotal: number; vat: number; total: number; }

/** Calcul PUR al totalurilor: rotunjire la 2 zecimale per linie, apoi TVA pe subtotal. */
export function invoiceTotals(inv: Pick<Invoice, 'items' | 'vatRate'>): InvoiceTotals {
  const subtotal = round2((inv.items || []).reduce((acc, it) => acc + round2((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)), 0));
  const vat = round2(subtotal * (Math.max(0, Math.min(100, Number(inv.vatRate) || 0)) / 100));
  return { subtotal, vat, total: round2(subtotal + vat) };
}

export function lineTotal(it: Pick<InvoiceItem, 'qty' | 'unitPrice'>): number {
  return round2((Number(it.qty) || 0) * (Number(it.unitPrice) || 0));
}
