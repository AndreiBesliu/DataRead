/**
 * Rezolvarea pură a entitlement-ului — fără Firebase, fără React. Date fiind subscripția
 * curentă și ceasul, decide statusul + modulele active (feature flags pe abonament).
 * FĂRĂ trial în DataRead: statusurile sunt `none | active | expired`.
 * Ținută separat ca să fie testată headless (scripts/test-entitlement.ts).
 */
import { getPackage, type ModuleId, type PackageId } from '../config/packages';

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

export function resolveEntitlement(args: {
  uid: string | null;
  subscription: SubInput | null;
  now?: number;
}): EntitlementResult {
  const { uid, subscription } = args;
  const now = args.now ?? Date.now();

  if (uid && subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
    const periodEnd = subscription.currentPeriodEnd ?? null;
    const validThrough = periodEnd != null ? periodEnd + PERIOD_END_GRACE_MS : null;

    if (validThrough == null || now < validThrough) {
      // Un abonament activ cu un preț care nu e (încă) în config NU retrogradează un client
      // PLĂTITOR la `none` — primește conservator pachetul de bază. Under-grant, never lock out.
      const effective: PackageId = subscription.packageId ?? 'start';
      return {
        status: 'active',
        packageId: effective,
        modules: getPackage(effective).modules,
        needsResync: false,
      };
    }

    // Perioada cunoscută a trecut fără reînnoire confirmată → blocat până la resync.
    return { status: 'expired', packageId: subscription.packageId, modules: [], needsResync: true };
  }

  // Fără abonament (sau nelogat): none. (Fără trial — nu există stări intermediare.)
  return { status: 'none', packageId: null, modules: [], needsResync: false };
}
