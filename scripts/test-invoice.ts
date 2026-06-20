// Suite headless: Facturi/Proforme — coerce (schema/default/clamp) + calcul PUR al totalurilor + compunere HTML escapată.
import {
  coerceToInvoice, invoiceTotals, lineTotal, coerceToInvoiceConfig, safeSeries, INVOICE_DEFAULT_VAT, INVOICE_ITEMS_MAX,
} from '../src/types/invoice';
import { composeInvoiceHtml, type InvoiceLabels } from '../src/utils/invoiceDoc';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}

console.log('INVOICE — coerce + totaluri + HTML');

// ── coerce ──
{
  const a = coerceToInvoice(null);
  check('coerce: null → schema 1 + proforma + RON + draft', a.schema === 1 && a.kind === 'proforma' && a.currency === 'RON' && a.status === 'draft');
  check('coerce: vatRate default 19', a.vatRate === INVOICE_DEFAULT_VAT);
  check('coerce: items gol', a.items.length === 0 && a.seller.name === '' && a.buyer.name === '');
}
check('coerce: gunoi nu aruncă', !!coerceToInvoice({ kind: 7, items: 'x', vatRate: 'y' }));
check('coerce: kind/status invalid → default', (() => { const a = coerceToInvoice({ kind: 'zzz', status: 'hacked' }); return a.kind === 'proforma' && a.status === 'draft'; })());
check('coerce: vatRate peste 100 → clamp', coerceToInvoice({ vatRate: 999 }).vatRate === 100);
check('coerce: vatRate negativ → 0', coerceToInvoice({ vatRate: -5 }).vatRate === 0);
check('coerce: qty/preț negativ → 0', (() => { const a = coerceToInvoice({ items: [{ description: 'x', qty: -2, unitPrice: -9 }] }); return a.items[0].qty === 0 && a.items[0].unitPrice === 0; })());
check('coerce: plafon articole', coerceToInvoice({ items: Array.from({ length: 80 }, () => ({ description: 'x', qty: 1, unitPrice: 1 })) }).items.length === INVOICE_ITEMS_MAX);

// ── totaluri (rotunjire la 2 zecimale per linie, apoi TVA pe subtotal) ──
{
  const inv = coerceToInvoice({ vatRate: 19, items: [{ description: 'A', qty: 2, unitPrice: 10 }, { description: 'B', qty: 1, unitPrice: 5.555 }] });
  check('lineTotal: 1×5.555 → 5.56 (rotunjit)', lineTotal({ qty: 1, unitPrice: 5.555 }) === 5.56);
  const t = invoiceTotals(inv);
  check('totaluri: subtotal 25.56', t.subtotal === 25.56);
  check('totaluri: TVA 19% → 4.86', t.vat === 4.86);
  check('totaluri: total 30.42', t.total === 30.42);
}
check('totaluri: vatRate 0 → vat 0', invoiceTotals(coerceToInvoice({ vatRate: 0, items: [{ description: 'x', qty: 1, unitPrice: 100 }] })).vat === 0);
check('totaluri: fără articole → 0', (() => { const t = invoiceTotals(coerceToInvoice({})); return t.subtotal === 0 && t.total === 0; })());

// ── compunere HTML escapată (anti-injecție din câmpurile operatorului) ──
{
  const L: InvoiceLabels = { docTitle: 'PROFORMĂ', seller: 'Furnizor', buyer: 'Client', cui: 'CUI', regCom: 'RC', iban: 'IBAN', issued: 'Data', due: 'Scadență', nr: 'Nr', colItem: 'Descriere', colQty: 'Cant', colPrice: 'Preț', colTotal: 'Total', subtotal: 'Subtotal', vat: 'TVA', total: 'Total' };
  const html = composeInvoiceHtml(coerceToInvoice({ kind: 'proforma', currency: 'RON', series: 'DR', number: '001', items: [{ description: '<script>alert(1)</script>', qty: 1, unitPrice: 10 }], buyer: { name: 'Firma & Co <x>', cui: '', regCom: '', address: '', iban: '' } }), L);
  check('html: conține titlul + nr', html.includes('PROFORMĂ') && html.includes('DR 001'));
  check('html: descrierea periculoasă e ESCAPATĂ', !html.includes('<script>alert(1)</script>') && html.includes('&lt;script&gt;'));
  check('html: numele cu & < e escapat', html.includes('Firma &amp; Co &lt;x&gt;'));
  check('html: total prezent (10.00 + TVA)', html.includes('11.90 RON'));
}

// ── config furnizor (appConfig/invoiceSeller) ──
{
  const c = coerceToInvoiceConfig(null);
  check('config: null → schema 1 + seller gol + RON + vat 19', c.schema === 1 && c.seller.name === '' && c.defaultCurrency === 'RON' && c.defaultVatRate === INVOICE_DEFAULT_VAT);
  check('config: seller + serie păstrate', (() => { const x = coerceToInvoiceConfig({ seller: { name: 'DataRead SRL', cui: 'RO123' }, defaultSeries: 'DR' }); return x.seller.name === 'DataRead SRL' && x.seller.cui === 'RO123' && x.defaultSeries === 'DR'; })());
  check('config: vatRate clamp', coerceToInvoiceConfig({ defaultVatRate: 500 }).defaultVatRate === 100);
  // startNumber (numerotare): absent → 1; păstrat; negativ → 1; fracție → floor; clamp la maxim.
  check('config: startNumber absent → 1', coerceToInvoiceConfig({}).startNumber === 1);
  check('config: startNumber păstrat', coerceToInvoiceConfig({ startNumber: 248 }).startNumber === 248);
  check('config: startNumber negativ/0 → 1', coerceToInvoiceConfig({ startNumber: -5 }).startNumber === 1 && coerceToInvoiceConfig({ startNumber: 0 }).startNumber === 1);
  check('config: startNumber fracție → floor', coerceToInvoiceConfig({ startNumber: 12.9 }).startNumber === 12);
}

// ── serie = cheia contorului → bijecție [A-Za-z0-9_-] (altfel serii distincte ar partaja contorul → goluri) ──
{
  check('safeSeries: păstrează caractere sigure', safeSeries('DR-2026_A') === 'DR-2026_A');
  check('safeSeries: strip spații/slash/punct/diacritice', safeSeries('A/B 2026.ă') === 'AB2026');
  check('safeSeries: non-string → gol', safeSeries(42) === '' && safeSeries(null) === '');
  check('coerce factură: serie nesigură strip-uită', coerceToInvoice({ series: 'A/B.C' }).series === 'ABC');
  check('coerce config: defaultSeries nesigură strip-uită', coerceToInvoiceConfig({ defaultSeries: 'D R' }).defaultSeries === 'DR');
}

console.log(`\ninvoice: ${failures ? failures + ' EȘUATE' : 'all checks passed'}`);
if (failures) process.exit(1);
