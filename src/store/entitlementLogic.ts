/**
 * Rezolvarea pură a entitlement-ului — fără Firebase, fără React. Date fiind subscripția
 * curentă și ceasul, decide statusul + modulele active (feature flags pe abonament).
 * FĂRĂ trial în DataRead: statusurile sunt `none | active | expired`.
 * Ținută separat ca să fie testată headless (scripts/test-entitlement.ts).
 */
import { getPackage, resolvePackageByPriceId, type ModuleId, type PackageId } from '../config/packages';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mic tampon după `currentPeriodEnd` înainte să blocăm — lagul webhook-ului Stripe→Firestore
 * sau un ceas ușor deviat nu trebuie să blocheze un client care tocmai a plătit.
 */
export const PERIOD_END_GRACE_MS = DAY_MS;

export type EntitlementStatus = 'none' | 'active' | 'expired';

export interface SubInput {
  status: string;
  packageId: PackageId | null;
  /** Stripe `current_period_end` în ms — entitlement-ul e valid până aici. */
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
}

export interface EntitlementResult {
  status: EntitlementStatus;
  packageId: PackageId | null;
  /** Modulele platformei active pe abonament (feature flags — principiul 2). */
  modules: ModuleId[];
  /**
   * true când ȘTIM de un abonament plătit a cărui perioadă cunoscută a trecut fără o reînnoire
   * confirmată (offline pe cache vechi / webhook nevăzut). UI-ul blochează și cere resync;
   * o sincronizare care arată un periodEnd mai târziu îl întoarce la `active`.
   */
  needsResync: boolean;
}

/** Ierarhia pachetelor — pentru „cel mai mare pachet" când un client are mai multe linii/abonamente. */
const PACKAGE_RANK: Record<PackageId, number> = { start: 1, growth: 2, premium: 3 };

/** Formă NORMALIZATĂ peste care rulează UNICA implementare (client single-sub ȘI server multi-sub). */
interface NormalizedSub {
  status: string;
  currentPeriodEnd: number | null;
  /** TOATE pachetele recunoscute pe abonamentul ăsta (un add-on e o linie separată!). */
  packageIds: PackageId[];
}

function isPaidStatus(s: string): boolean {
  return s === 'active' || s === 'trialing';
}

/** Nucleul: una singură implementare, ca să nu derive două copii (lecția oglinzilor). */
function resolveCore(uid: string | null, subs: NormalizedSub[], now: number): EntitlementResult {
  if (!uid || subs.length === 0) return { status: 'none', packageId: null, modules: [], needsResync: false };
  const paid = subs.filter((s) => isPaidStatus(s.status));
  if (paid.length === 0) return { status: 'none', packageId: null, modules: [], needsResync: false };

  const stillValid = paid.filter((s) => {
    const validThrough = s.currentPeriodEnd != null ? s.currentPeriodEnd + PERIOD_END_GRACE_MS : null;
    return validThrough == null || now < validThrough;
  });

  const topOf = (list: NormalizedSub[]): PackageId | null => {
    let best: PackageId | null = null;
    for (const s of list) for (const p of s.packageIds) if (!best || PACKAGE_RANK[p] > PACKAGE_RANK[best]) best = p;
    return best;
  };

  if (stillValid.length === 0) {
    // Perioada cunoscută a trecut fără reînnoire confirmată → blocat până la resync.
    return { status: 'expired', packageId: topOf(paid), modules: [], needsResync: true };
  }

  // Un abonament activ cu un preț care nu e (încă) în config NU retrogradează un client PLĂTITOR la
  // `none` — primește conservator pachetul de bază. Under-grant, never lock out.
  const top = topOf(stillValid) ?? 'start';
  // Modulele = REUNIUNEA tuturor liniilor active. Un add-on vândut ca linie separată trebuie să conteze;
  // înainte se citea doar prima linie a unui singur abonament, deci add-on-urile erau invizibile.
  const modules = new Set<ModuleId>();
  let anyRecognized = false;
  for (const s of stillValid) {
    for (const p of s.packageIds) {
      anyRecognized = true;
      for (const m of getPackage(p).modules) modules.add(m);
    }
  }
  if (!anyRecognized) for (const m of getPackage('start').modules) modules.add(m);

  return { status: 'active', packageId: top, modules: [...modules], needsResync: false };
}

export function resolveEntitlement(args: {
  uid: string | null;
  subscription: SubInput | null;
  now?: number;
}): EntitlementResult {
  const { uid, subscription } = args;
  const now = args.now ?? Date.now();
  const subs: NormalizedSub[] = subscription
    ? [{
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd ?? null,
        packageIds: subscription.packageId ? [subscription.packageId] : [],
      }]
    : [];
  return resolveCore(uid, subs, now);
}

// ── Multi-abonament × multi-linie (F0) ────────────────────────────────────────────────────────
// Stripe modelează un add-on ca `subscription item` SEPARAT pe același abonament, iar un client cu
// două servicii poate avea două abonamente. Ambele căi (client + server) citeau doar `items[0]` din
// UN SINGUR abonament „best" ⇒ add-on-urile și al doilea abonament dispăreau tăcut.

/** O linie de abonament Stripe (un pachet SAU un add-on). */
export interface SubItemInput {
  priceId: string | null;
}

/** Un abonament Stripe cu TOATE liniile lui. */
export interface SubMultiInput {
  status: string;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  items: SubItemInput[];
}

/** Rezolvă entitlement-ul din TOATE abonamentele × TOATE liniile. Pură (fără Firebase/ceas propriu). */
export function resolveEntitlementFromSubs(args: {
  uid: string | null;
  subscriptions: SubMultiInput[];
  now?: number;
  /** Injectat ca modulul să rămână pur/testabil; implicit rezolvarea din configul de pachete. */
  resolvePackageId?: (priceId: string | null) => PackageId | null;
}): EntitlementResult {
  const now = args.now ?? Date.now();
  const resolveId = args.resolvePackageId ?? ((priceId) => resolvePackageByPriceId(priceId)?.id ?? null);
  const subs: NormalizedSub[] = (Array.isArray(args.subscriptions) ? args.subscriptions : []).map((s) => {
    const ids: PackageId[] = [];
    for (const it of Array.isArray(s.items) ? s.items : []) {
      const id = resolveId(it && typeof it.priceId === 'string' ? it.priceId : null);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return { status: String(s.status || ''), currentPeriodEnd: s.currentPeriodEnd ?? null, packageIds: ids };
  });
  return resolveCore(args.uid, subs, now);
}
