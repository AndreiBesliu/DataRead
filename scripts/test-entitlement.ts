// Suite headless: rezolvarea entitlement-ului FĂRĂ trial (none | active | expired) + feature
// flags pe module. Regula de aur: un client PLĂTITOR nu e blocat niciodată din greșeală.
import { PERIOD_END_GRACE_MS, resolveEntitlement } from '../src/store/entitlementLogic';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

const NOW = 1_750_000_000_000; // ceas fix — fără Date.now() real în asserts
const DAY = 24 * 60 * 60 * 1000;

// Fără abonament.
check('nelogat → none', (() => {
  const r = resolveEntitlement({ uid: null, subscription: null, now: NOW });
  return r.status === 'none' && r.packageId === null && r.modules.length === 0 && !r.needsResync;
})());
check('logat fără abonament → none (nu expired — fără trial)', (() => {
  const r = resolveEntitlement({ uid: 'u1', subscription: null, now: NOW });
  return r.status === 'none' && !r.needsResync;
})());

// Abonament activ.
check('activ growth în perioadă → active + modulul marketing', (() => {
  const r = resolveEntitlement({
    uid: 'u1',
    subscription: { status: 'active', packageId: 'growth', currentPeriodEnd: NOW + 20 * DAY },
    now: NOW,
  });
  return r.status === 'active' && r.packageId === 'growth' && r.modules.includes('marketing') && !r.needsResync;
})());
check('preț NEMAPAT (packageId null) → active pe start, NU blocat', (() => {
  const r = resolveEntitlement({
    uid: 'u1',
    subscription: { status: 'active', packageId: null, currentPeriodEnd: NOW + 20 * DAY },
    now: NOW,
  });
  return r.status === 'active' && r.packageId === 'start' && r.modules.includes('marketing');
})());
check('fără periodEnd dar status activ → activ (trust the status)', (() => {
  const r = resolveEntitlement({
    uid: 'u1',
    subscription: { status: 'active', packageId: 'premium', currentPeriodEnd: null },
    now: NOW,
  });
  return r.status === 'active' && r.packageId === 'premium';
})());

// Granița perioadei + grația.
check('periodEnd trecut dar ÎN grație → încă activ', (() => {
  const r = resolveEntitlement({
    uid: 'u1',
    subscription: { status: 'active', packageId: 'growth', currentPeriodEnd: NOW - PERIOD_END_GRACE_MS / 2 },
    now: NOW,
  });
  return r.status === 'active';
})());
check('periodEnd trecut DINCOLO de grație → expired + needsResync', (() => {
  const r = resolveEntitlement({
    uid: 'u1',
    subscription: { status: 'active', packageId: 'growth', currentPeriodEnd: NOW - PERIOD_END_GRACE_MS - 1000 },
    now: NOW,
  });
  return r.status === 'expired' && r.needsResync && r.modules.length === 0;
})());

// Statusuri non-active.
check("status 'canceled' → none", (() => {
  const r = resolveEntitlement({
    uid: 'u1',
    subscription: { status: 'canceled', packageId: 'growth', currentPeriodEnd: NOW + 20 * DAY },
    now: NOW,
  });
  return r.status === 'none';
})());
check("status 'past_due' → none (extensia îl scoate din query oricum)", (() => {
  const r = resolveEntitlement({
    uid: 'u1',
    subscription: { status: 'past_due', packageId: 'start', currentPeriodEnd: NOW + 5 * DAY },
    now: NOW,
  });
  return r.status === 'none';
})());
check("status 'trialing' (Stripe) → tratat ca activ", (() => {
  const r = resolveEntitlement({
    uid: 'u1',
    subscription: { status: 'trialing', packageId: 'start', currentPeriodEnd: NOW + 5 * DAY },
    now: NOW,
  });
  return r.status === 'active' && r.packageId === 'start';
})());

// ── F0: multi-abonament × multi-linie (add-on-urile Stripe sunt linii SEPARATE) ────────────────
import { resolveEntitlementFromSubs } from '../src/store/entitlementLogic';
import type { PackageId } from '../src/config/packages';

// Price ID-urile reale vin din env (goale la test) → injectăm rezolvarea, ca suita să nu depindă de configul local.
const FAKE: Record<string, PackageId> = { price_start: 'start', price_growth: 'growth', price_premium: 'premium' };
const resolvePackageId = (p: string | null) => (p && FAKE[p]) || null;
const active = (items: string[], periodEnd = NOW + 5 * DAY) => ({
  status: 'active', currentPeriodEnd: periodEnd, items: items.map((priceId) => ({ priceId })),
});

check('multi: fără abonamente → none', (() => {
  const r = resolveEntitlementFromSubs({ uid: 'u1', subscriptions: [], now: NOW, resolvePackageId });
  return r.status === 'none' && r.modules.length === 0;
})());
check('multi: nelogat → none', (() => {
  const r = resolveEntitlementFromSubs({ uid: null, subscriptions: [active(['price_premium'])], now: NOW, resolvePackageId });
  return r.status === 'none';
})());
// REGRESIA #1: add-on ca linie SEPARATĂ pe același abonament — înainte se citea doar items[0].
check('multi: a DOUA linie (add-on) contează — tier = cel mai mare de pe abonament', (() => {
  const r = resolveEntitlementFromSubs({
    uid: 'u1', subscriptions: [active(['price_start', 'price_premium'])], now: NOW, resolvePackageId,
  });
  return r.status === 'active' && r.packageId === 'premium';
})());
// REGRESIA #2: al DOILEA abonament al aceluiași client — înainte câștiga doar unul („best" după perioadă).
check('multi: al doilea abonament NU mai dispare (tier maxim din ambele)', (() => {
  const r = resolveEntitlementFromSubs({
    uid: 'u1',
    subscriptions: [active(['price_start'], NOW + 30 * DAY), active(['price_premium'], NOW + 5 * DAY)],
    now: NOW,
    resolvePackageId,
  });
  return r.status === 'active' && r.packageId === 'premium';
})());
check('multi: modulele = REUNIUNEA liniilor active', (() => {
  const r = resolveEntitlementFromSubs({
    uid: 'u1', subscriptions: [active(['price_start']), active(['price_growth'])], now: NOW, resolvePackageId,
  });
  return r.status === 'active' && r.modules.includes('marketing');
})());
// Under-grant, never lock out: preț necunoscut pe un abonament PLĂTIT → pachetul de bază, nu `none`.
check('multi: preț nerecunoscut pe abonament activ → start (nu none)', (() => {
  const r = resolveEntitlementFromSubs({
    uid: 'u1', subscriptions: [active(['price_viitor_necunoscut'])], now: NOW, resolvePackageId,
  });
  return r.status === 'active' && r.packageId === 'start' && r.modules.length > 0;
})());
check('multi: toate perioadele trecute → expired + needsResync (nu none)', (() => {
  const r = resolveEntitlementFromSubs({
    uid: 'u1', subscriptions: [active(['price_growth'], NOW - 10 * DAY)], now: NOW, resolvePackageId,
  });
  return r.status === 'expired' && r.needsResync && r.packageId === 'growth';
})());
check('multi: o perioadă expirată + una validă → active (nu blochează un plătitor)', (() => {
  const r = resolveEntitlementFromSubs({
    uid: 'u1',
    subscriptions: [active(['price_premium'], NOW - 10 * DAY), active(['price_start'], NOW + 5 * DAY)],
    now: NOW,
    resolvePackageId,
  });
  return r.status === 'active' && r.packageId === 'start';
})());
check('multi: grația de la finalul perioadei se aplică și aici', (() => {
  const r = resolveEntitlementFromSubs({
    uid: 'u1', subscriptions: [active(['price_growth'], NOW - PERIOD_END_GRACE_MS / 2)], now: NOW, resolvePackageId,
  });
  return r.status === 'active';
})());
check('multi: status neplătit (past_due) → none', (() => {
  const r = resolveEntitlementFromSubs({
    uid: 'u1',
    subscriptions: [{ status: 'past_due', currentPeriodEnd: NOW + 5 * DAY, items: [{ priceId: 'price_premium' }] }],
    now: NOW,
    resolvePackageId,
  });
  return r.status === 'none';
})());
check('multi: items lipsă/corupt → nu aruncă', (() => {
  const r = resolveEntitlementFromSubs({
    uid: 'u1',
    subscriptions: [{ status: 'active', currentPeriodEnd: NOW + DAY, items: null as unknown as [] }],
    now: NOW,
    resolvePackageId,
  });
  return r.status === 'active' && r.packageId === 'start'; // plătitor fără linii recunoscute → under-grant
})());

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('entitlement (fără trial): all checks passed');
