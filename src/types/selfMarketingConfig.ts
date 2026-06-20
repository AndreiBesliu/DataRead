/**
 * Configurarea costului AI pentru „Self Marketing" (suprafața AI expusă CLIENȚILOR non-admin).
 *
 * Problema (din auditul de cost/abuz): plafonul global de generări gratuite era UN SINGUR coș partajat — un
 * atacator care fermentează conturi (uid-urile sunt gratis) sau un script putea să-l golească și să BLOCHEZE
 * clienții PLĂTITORI până a doua zi. Adică backstop-ul de cost se transforma într-o gaură de disponibilitate.
 *
 * Soluția: DOUĂ coșuri separate pe zi — unul rezervat clienților cu abonament activ (entitlement), altul pentru
 * trial/gratuit. Abuzul trial NU mai poate epuiza capacitatea plătitorilor, iar costul de abuz e mărginit DOAR de
 * `trialDailyCap` (independent de câți clienți plătitori folosesc platforma). Plafoanele + gate-ul email-verificat
 * sunt setabile din /admin (ca plafonul AI al automatizărilor) și citite server-side prin Admin SDK.
 *
 * REGULĂ (CLAUDE.md): un singur `coerceTo*`, niciodată throw; paritate cu portul JS din functions/index.js
 * (`coerceSelfMarketingConfigServer` / `selfPoolFor`) — verificată în e2e.
 */

export const SELF_MKT_CONFIG_SCHEMA = 1;

export interface SelfMarketingConfig {
  schema: typeof SELF_MKT_CONFIG_SCHEMA;
  /** Plafon global/zi pentru clienții cu abonament activ (pool rezervat — generos, susținut de venit). */
  entitledDailyCap: number;
  /** Plafon global/zi pentru trial/gratuit — ACESTA mărginește costul de abuz (conturi farm-uite). Ține-l mic. */
  trialDailyCap: number;
  /** Dacă true, generările self-serve cer email verificat (descurajează farm-area cu adrese inexistente). */
  requireEmailVerified: boolean;
}

export const SELF_MKT_CONFIG_DEFAULT: SelfMarketingConfig = {
  schema: SELF_MKT_CONFIG_SCHEMA,
  entitledDailyCap: 200,
  trialDailyCap: 40,
  requireEmailVerified: true,
};

/** Plafon maxim acceptat la coerce (anti-typo în UI: nu lăsăm un milion de generări AI dintr-o greșeală). */
export const SELF_MKT_CAP_MAX = 100000;

function clampCap(v: unknown, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.max(0, Math.min(SELF_MKT_CAP_MAX, n));
}

/** Normaliser unic — orice intrare (doc lipsă, gunoi, parțial) → config valid. Nu aruncă niciodată. */
export function coerceToSelfMarketingConfig(raw: unknown): SelfMarketingConfig {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    schema: SELF_MKT_CONFIG_SCHEMA,
    entitledDailyCap: clampCap(d.entitledDailyCap, SELF_MKT_CONFIG_DEFAULT.entitledDailyCap),
    trialDailyCap: clampCap(d.trialDailyCap, SELF_MKT_CONFIG_DEFAULT.trialDailyCap),
    // Implicit STRICT (true): securizat din oficiu; se dezactivează explicit din /admin doar dacă e nevoie.
    requireEmailVerified: d.requireEmailVerified !== false,
  };
}

/** Id-urile documentelor de contor (aiUsage/*) pentru cele două coșuri. Separate de vechiul `__selfGlobal`. */
export const SELF_POOL_ENTITLED_DOC = '__selfGlobalEntitled';
export const SELF_POOL_TRIAL_DOC = '__selfGlobalTrial';

export interface SelfPool {
  docId: string;
  cap: number;
}

/** Pur: alege coșul (doc contor + plafon) după statutul de abonament. Port identic în JS (functions). */
export function selfPoolFor(entitlementActive: boolean, cfg: SelfMarketingConfig): SelfPool {
  return entitlementActive
    ? { docId: SELF_POOL_ENTITLED_DOC, cap: cfg.entitledDailyCap }
    : { docId: SELF_POOL_TRIAL_DOC, cap: cfg.trialDailyCap };
}
