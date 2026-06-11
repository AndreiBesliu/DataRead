/**
 * Profilul de client (documentul clients/{uid}) — schema 1.
 * REGULĂ (CLAUDE.md): orice citire a acestui shape — Firestore, cache, teste — trece prin
 * UNICUL normaliser coerceToClientProfile; date corupte/legacy/viitoare → defaults sigure,
 * niciodată crash.
 */

export const CLIENT_SCHEMA = 1;

export interface ClientEntitlement {
  active: boolean;
  status: string;
  periodEnd: number;
  priceId: string | null;
}

export interface ClientProfile {
  schema: typeof CLIENT_SCHEMA;
  email: string | null;
  displayName: string | null;
  locale: 'ro' | 'en';
  onboardingStatus: 'none' | 'submitted';
  /** Scris DOAR de Cloud Functions (mirror din Stripe) — clientul nu-l poate modifica (rules). */
  entitlement: ClientEntitlement | null;
}

/** Unicul punct de intrare pentru orice date care pretind a fi un profil de client.
 *  null doar pentru ne-obiecte (doc inexistent); altfel normalizează cu defaults. */
export function coerceToClientProfile(data: unknown): ClientProfile | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;

  let entitlement: ClientEntitlement | null = null;
  if (typeof d.entitlement === 'object' && d.entitlement !== null) {
    const e = d.entitlement as Record<string, unknown>;
    entitlement = {
      active: e.active === true,
      status: typeof e.status === 'string' ? e.status : 'none',
      periodEnd: typeof e.periodEnd === 'number' && Number.isFinite(e.periodEnd) ? e.periodEnd : 0,
      priceId: typeof e.priceId === 'string' ? e.priceId : null,
    };
  }

  return {
    schema: CLIENT_SCHEMA,
    email: typeof d.email === 'string' ? d.email : null,
    displayName: typeof d.displayName === 'string' ? d.displayName : null,
    locale: d.locale === 'en' ? 'en' : 'ro',
    onboardingStatus: d.onboardingStatus === 'submitted' ? 'submitted' : 'none',
    entitlement,
  };
}
