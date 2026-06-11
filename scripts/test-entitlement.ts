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

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('entitlement (fără trial): all checks passed');
