// Suite headless: axa monetară F2 (economia agenției) — agencyEconomics.ts (venit facturat per client + LTV:CAC).
import { agencyRevenue, clientEconomics, coerceAcquisitionCost, AGENCY_CAC_MAX } from '../src/analytics/agencyEconomics';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

console.log('AXA MONETARĂ F2 — economia agenției (venit facturat + LTV:CAC)');

// Facturi de test (vatRate 0 → total = subtotal, ușor de verificat).
const invoices = [
  { kind: 'factura', number: '1', status: 'sent', currency: 'RON', vatRate: 0, items: [{ description: 'a', qty: 1, unitPrice: 100 }] },
  { kind: 'factura', number: '2', status: 'paid', currency: 'RON', vatRate: 0, items: [{ description: 'b', qty: 1, unitPrice: 50 }] },
  { kind: 'proforma', number: '', status: 'draft', currency: 'RON', vatRate: 0, items: [{ description: 'p', qty: 1, unitPrice: 999 }] }, // proformă → exclusă
  { kind: 'factura', number: '', status: 'draft', currency: 'RON', vatRate: 0, items: [{ description: 'd', qty: 1, unitPrice: 777 }] }, // neemisă → exclusă
  { kind: 'factura', number: '3', status: 'cancelled', currency: 'RON', vatRate: 0, items: [{ description: 'c', qty: 1, unitPrice: 666 }] }, // anulată → exclusă
  // storno (qty negativ + stornoOf) → total NEGATIV, se scade
  { kind: 'factura', number: '4', status: 'sent', currency: 'RON', vatRate: 0, stornoOf: { series: 'A', number: '1', id: 'x' }, items: [{ description: 'a', qty: -1, unitPrice: 100 }] },
];

const rev = agencyRevenue(invoices);
check('agencyRevenue: invoiced = 100 + 50 - 100 (storno) = 50', rev.invoiced === 50);
check('agencyRevenue: paid = 50 (doar status paid)', rev.paid === 50);
check('agencyRevenue: count = 3 facturi emise (proforma/draft/cancelled excluse)', rev.count === 3);
check('agencyRevenue: currency RON, fără mix', rev.currency === 'RON' && rev.mixedCurrency === false);
check('agencyRevenue: gol → zerouri', (() => { const r = agencyRevenue([]); return r.invoiced === 0 && r.paid === 0 && r.count === 0; })());
check('agencyRevenue: VAT inclus în total', (() => {
  const r = agencyRevenue([{ kind: 'factura', number: '9', status: 'sent', currency: 'RON', vatRate: 19, items: [{ description: 'x', qty: 1, unitPrice: 100 }] }]);
  return r.invoiced === 119;
})());
check('agencyRevenue: monede amestecate → flag', (() => {
  const r = agencyRevenue([
    { kind: 'factura', number: '1', status: 'sent', currency: 'RON', vatRate: 0, items: [{ description: 'a', qty: 1, unitPrice: 100 }] },
    { kind: 'factura', number: '2', status: 'sent', currency: 'EUR', vatRate: 0, items: [{ description: 'b', qty: 1, unitPrice: 20 }] },
  ]);
  return r.mixedCurrency === true && r.count === 2;
})());

// coerceAcquisitionCost
check('coerceAcquisitionCost: valid', coerceAcquisitionCost(250) === 250);
check('coerceAcquisitionCost: negativ/NaN/non-număr → 0', coerceAcquisitionCost(-5) === 0 && coerceAcquisitionCost(NaN) === 0 && coerceAcquisitionCost('x') === 0);
check('coerceAcquisitionCost: plafon', coerceAcquisitionCost(1e15) === AGENCY_CAC_MAX);

// clientEconomics: LTV:CAC
{
  const e = clientEconomics(invoices, 25);
  check('clientEconomics: LTV:CAC = invoiced/cost = 50/25 = 2', e.ltvCacRatio === 2 && e.acquisitionCost === 25);
}
check('clientEconomics: cost 0 → ratio null (CAC necunoscut)', clientEconomics(invoices, 0).ltvCacRatio === null);
check('clientEconomics: cost negativ → 0 + ratio null', clientEconomics(invoices, -10).ltvCacRatio === null);

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('agency economics: all checks passed');
