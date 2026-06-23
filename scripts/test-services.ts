// Suite headless: catalogul de servicii (config/services.ts) — structură + paritatea cheilor i18n
// în AMBELE dicționare (ro + en). Plus prezența rutei /servicii și a tag-ului de serviciu pe lead.
import {
  SERVICES,
  SERVICE_IDS,
  isValidServiceId,
  getService,
  serviceBulletKeys,
  serviceNameKey,
} from '../src/config/services';
import { PUBLIC_ROUTES } from '../src/site/publicRoutes';
import { PAGE_KEYS, PAGE_KEY_BY_SLUG } from '../src/types/pageThemes';
import { coerceToOnboarding } from '../src/types/onboarding';
import { coerceToServiceOrder, SERVICE_ORDER_STATUSES, SERVICE_ORDER_STATUS_COLORS } from '../src/types/serviceOrder';
import ro from '../src/i18n/locales/ro';
import en from '../src/i18n/locales/en';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

/** Rezolvă o cheie i18n cu puncte într-un dicționar — există și e string nenul? */
function keyIn(dict: unknown, key: string): boolean {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in (node as Record<string, unknown>))) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node.length > 0;
}
const inBoth = (key: string): boolean => keyIn(ro, key) && keyIn(en, key);

// Structura.
check('exact 7 servicii', SERVICES.length === 7);
check('id-uri unice', new Set(SERVICES.map((s) => s.id)).size === SERVICES.length);
check('SERVICE_IDS == id-urile din SERVICES', JSON.stringify([...SERVICE_IDS]) === JSON.stringify(SERVICES.map((s) => s.id)));
check('fiecare are ≥1 bullet', SERVICES.every((s) => s.bulletCount >= 1));
check("cta ∈ {lead, self}", SERVICES.every((s) => s.cta === 'lead' || s.cta === 'self'));
check("exact un serviciu live (self)", SERVICES.filter((s) => s.cta === 'self').length === 1);
check("serviciul self e 'self'", getService('self').cta === 'self');

// Helperi.
check("isValidServiceId acceptă 'seo'", isValidServiceId('seo'));
check('isValidServiceId respinge gunoi', !isValidServiceId('xxx') && !isValidServiceId(null) && !isValidServiceId(42));
check("getService('audit') round-trip", getService('audit').id === 'audit');

// Paritate i18n (ro + en): name, tagline, toate bullet-urile.
check('toate numele de servicii există în ro+en', SERVICES.every((s) => inBoth(serviceNameKey(s.id))));
check('toate tagline-urile există în ro+en', SERVICES.every((s) => inBoth(`services.${s.id}.tagline`)));
check('toate bullet-urile există în ro+en', SERVICES.every((s) => serviceBulletKeys(s).every((k) => inBoth(k))));
check('chrome/CTA-uri servicii există în ro+en', ['services.kicker', 'services.heroTitle', 'services.heroBody', 'services.ctaLead', 'services.ctaTry', 'services.liveBadge', 'services.finalTitle', 'services.finalCta', 'services.pill1', 'services.pill2', 'services.pill3', 'services.pill4'].every(inBoth));
check('nav.services + seo.servicesTitle/Description în ro+en', ['nav.services', 'seo.servicesTitle', 'seo.servicesDescription'].every(inBoth));
check('eticheta de serviciu pe lead (admin.fService + start.serviceInterest) în ro+en', ['admin.fService', 'start.serviceInterest'].every(inBoth));

// Integrare: ruta /servicii + cheia de pagină + tag pe lead.
check('/servicii e în PUBLIC_ROUTES', PUBLIC_ROUTES.some((r) => r.slug === '/servicii'));
check("'servicii' e cheie de pagină (pageThemes)", (PAGE_KEYS as readonly string[]).includes('servicii') && PAGE_KEY_BY_SLUG['/servicii'] === 'servicii');
check('coerceToOnboarding: serviceInterest valid păstrat', coerceToOnboarding({ serviceInterest: 'seo' }).serviceInterest === 'seo');
check('coerceToOnboarding: serviceInterest gunoi → null', coerceToOnboarding({ serviceInterest: 'nope' }).serviceInterest === null && coerceToOnboarding({}).serviceInterest === null);

// ── Comenzi de servicii (Felia 2) ──
check('serviceOrder: coerce(null) → defaults sigure', (() => {
  const o = coerceToServiceOrder(null);
  return o.schema === 1 && o.service === 'audit' && o.status === 'requested' && o.source === 'operator' && o.clientUid === null && o.leadId === null && o.deliverable === '';
})());
check('serviceOrder: service invalid → audit; status/source invalide → default', (() => {
  const o = coerceToServiceOrder({ service: 'nope', status: 'xxx', source: 'yyy' });
  return o.service === 'audit' && o.status === 'requested' && o.source === 'operator';
})());
check('serviceOrder: câmpuri valide păstrate + clamp', (() => {
  const o = coerceToServiceOrder({ service: 'seo', status: 'delivered', source: 'client', clientUid: 'u1', leadId: 'l1', companyName: 'X', note: 'n'.repeat(5000) });
  return o.service === 'seo' && o.status === 'delivered' && o.source === 'client' && o.clientUid === 'u1' && o.leadId === 'l1' && o.note.length === 2000;
})());
check('serviceOrder: culori de status pt. toate statusurile', SERVICE_ORDER_STATUSES.every((s) => /^#[0-9a-fA-F]{6}$/.test(SERVICE_ORDER_STATUS_COLORS[s])));
check('serviceOrders: status + chei portal client în ro+en', [...SERVICE_ORDER_STATUSES.map((s) => `serviceOrders.status_${s}`), 'serviceOrders.title', 'serviceOrders.request', 'serviceOrders.send', 'serviceOrders.empty', 'serviceOrders.deliverable'].every(inBoth));
check('admin.svc + navServiceOrders în ro+en', ['admin.navServiceOrders', 'admin.svc.title', 'admin.svc.newOrder', 'admin.svc.deliverable', 'admin.svc.create', 'admin.svc.confirmDelete', 'admin.svc.srcClient', 'admin.svc.srcOperator'].every(inBoth));

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('services: all checks passed');
