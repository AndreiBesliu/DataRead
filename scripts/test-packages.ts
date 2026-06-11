// Suite headless: sursa unică a ofertei (config/packages.ts) — structură, prețuri, mapări și
// paritatea cheilor i18n cu dicționarul primar ro.
import {
  PACKAGES,
  UPSELLS,
  getPackage,
  isValidPackageId,
  resolvePackageByPriceId,
  billingConfigured,
} from '../src/config/packages';
import { PUBLIC_ROUTES } from '../src/site/publicRoutes';
import ro from '../src/i18n/locales/ro';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

/** Rezolvă o cheie i18n cu puncte în obiectul ro — există și e string nenul? */
function keyExists(key: string): boolean {
  let node: unknown = ro;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in (node as Record<string, unknown>))) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node.length > 0;
}

// Structura ofertei.
check('exact 3 pachete', PACKAGES.length === 3);
check('id-uri unice', new Set(PACKAGES.map((p) => p.id)).size === 3);
check('prețuri de listă 149/399/999', JSON.stringify(PACKAGES.map((p) => p.monthlyAmount)) === '[149,399,999]');
check('toate în EUR', PACKAGES.every((p) => p.currency === 'EUR'));
check("toate includ modulul 'marketing'", PACKAGES.every((p) => p.modules.includes('marketing')));
check('exact un pachet evidențiat', PACKAGES.filter((p) => p.highlighted).length === 1);
check('5 upsell-uri', UPSELLS.length === 5);
check('upsell id-uri unice', new Set(UPSELLS.map((u) => u.id)).size === 5);

// Helperi.
check("getPackage('growth') round-trip", getPackage('growth').id === 'growth');
check("isValidPackageId acceptă 'start'", isValidPackageId('start'));
check('isValidPackageId respinge gunoi', !isValidPackageId('enterprise') && !isValidPackageId(null) && !isValidPackageId(42));
check('resolvePackageByPriceId(null) = null', resolvePackageByPriceId(null) === null);
check("resolvePackageByPriceId('') = null", resolvePackageByPriceId('') === null);
// Sub test-runner env-ul e gol ⇒ priceId-urile sunt '' ⇒ self-serve inactiv.
check('fără env: billing neconfigurat', !billingConfigured());
check("fără env: nu mapează 'price_x'", resolvePackageByPriceId('price_x') === null);

// Paritatea cheilor i18n: orice cheie referită de config există în dicționarul primar.
for (const p of PACKAGES) {
  for (const k of [p.nameKey, p.taglineKey, ...(p.inheritsNameKey ? [p.inheritsNameKey] : []), ...p.featureKeys, ...p.excludedKeys]) {
    check(`cheie ro există: ${k}`, keyExists(k));
  }
}
for (const u of UPSELLS) {
  for (const k of [u.nameKey, u.descriptionKey]) check(`cheie ro există: ${k}`, keyExists(k));
}
for (const r of PUBLIC_ROUTES) {
  for (const k of [r.titleKey, r.descriptionKey]) check(`cheie ro există: ${k}`, keyExists(k));
}

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('packages config: all checks passed');
