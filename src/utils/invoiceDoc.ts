/**
 * Compunere HTML A4 pentru o factură/proformă (print-to-PDF din browser). PUR + escapat (anti-injecție din
 * datele introduse de operator) — reutilizează `escapeHtml`/`printHtmlDoc` din printDoc.ts. Etichetele vin
 * traduse din UI (fără t() aici, ca să rămână pur și testabil headless).
 */
import { escapeHtml, printHtmlDoc } from './printDoc';
import { invoiceTotals, lineTotal, type Invoice, type InvoiceParty } from '../types/invoice';

export interface InvoiceLabels {
  docTitle: string; // „PROFORMĂ" / „FACTURĂ"
  seller: string; buyer: string; cui: string; regCom: string; iban: string;
  issued: string; due: string; nr: string;
  colItem: string; colQty: string; colPrice: string; colTotal: string;
  subtotal: string; vat: string; total: string;
}

function money(n: number, currency: string): string {
  return `${(Number(n) || 0).toFixed(2)} ${escapeHtml(currency)}`;
}

function partyHtml(p: InvoiceParty, L: InvoiceLabels): string {
  const lines = [p.name, p.cui ? `${L.cui}: ${p.cui}` : '', p.regCom ? `${L.regCom}: ${p.regCom}` : '', p.address, p.iban ? `${L.iban}: ${p.iban}` : '']
    .filter(Boolean)
    .map((x) => escapeHtml(x));
  return lines.length ? lines.join('<br>') : '—';
}

export function composeInvoiceHtml(inv: Invoice, L: InvoiceLabels): string {
  const t = invoiceTotals(inv);
  const e = escapeHtml;
  const docNo = [inv.series, inv.number].filter(Boolean).map((x) => e(x)).join(' ') || '—';
  const rows = inv.items.map((it) =>
    `<tr><td>${e(it.description) || '—'}</td><td class="r">${Number(it.qty) || 0}</td><td class="r">${money(it.unitPrice, inv.currency)}</td><td class="r">${money(lineTotal(it), inv.currency)}</td></tr>`).join('');
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>${e(L.docTitle)} ${docNo}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:32px;font-size:13px}
  .doc{max-width:760px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px} .muted{color:#555}
  .head{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:20px}
  .parties{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:18px}
  .box{flex:1 1 240px;border:1px solid #ddd;border-radius:8px;padding:12px}
  .box h2{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#555;margin:0 0 6px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px} th,td{padding:8px;border-bottom:1px solid #e5e5e5;text-align:left} th{background:#f5f5f5;font-size:11px;text-transform:uppercase} .r{text-align:right;white-space:nowrap}
  .totals{margin-left:auto;width:280px} .totals .row{display:flex;justify-content:space-between;padding:4px 0} .totals .grand{font-weight:700;font-size:16px;border-top:2px solid #111;margin-top:6px;padding-top:8px}
  .notes{margin-top:18px;color:#444;white-space:pre-wrap}
</style></head><body><div class="doc">
  <div class="head">
    <div><h1>${e(L.docTitle)}</h1><div class="muted">${e(L.nr)}: <strong>${docNo}</strong></div></div>
    <div class="muted" style="text-align:right">${e(L.issued)}: ${e(inv.issuedAt) || '—'}${inv.dueAt ? `<br>${e(L.due)}: ${e(inv.dueAt)}` : ''}</div>
  </div>
  <div class="parties">
    <div class="box"><h2>${e(L.seller)}</h2>${partyHtml(inv.seller, L)}</div>
    <div class="box"><h2>${e(L.buyer)}</h2>${partyHtml(inv.buyer, L)}</div>
  </div>
  <table><thead><tr><th>${e(L.colItem)}</th><th class="r">${e(L.colQty)}</th><th class="r">${e(L.colPrice)}</th><th class="r">${e(L.colTotal)}</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table>
  <div class="totals">
    <div class="row"><span>${e(L.subtotal)}</span><span>${money(t.subtotal, inv.currency)}</span></div>
    <div class="row"><span>${e(L.vat)} (${Number(inv.vatRate) || 0}%)</span><span>${money(t.vat, inv.currency)}</span></div>
    <div class="row grand"><span>${e(L.total)}</span><span>${money(t.total, inv.currency)}</span></div>
  </div>
  ${inv.notes ? `<div class="notes">${e(inv.notes)}</div>` : ''}
</div></body></html>`;
}

export function printInvoice(inv: Invoice, L: InvoiceLabels): void {
  printHtmlDoc(composeInvoiceHtml(inv, L));
}
