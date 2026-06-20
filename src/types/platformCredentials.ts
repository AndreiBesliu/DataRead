/**
 * Credențiala de platformă de reclame (Meta/Google/TikTok Ads) a unui client — METADATA citită de admin
 * pentru UI-ul de status al conectorilor. Stocată la `clients/{uid}/platformCredentials/{platform}`,
 * scrisă EXCLUSIV de functions (Admin SDK) după fluxul OAuth admin-gated. Doc-ul mai conține un token de
 * acces CRIPTAT (AES-256-GCM), care NU face parte din acest tip (nu se citește niciodată client-side; reguli
 * = admin-read). Vezi docs/CONNECTORS-ADS-API.md. REGULĂ (CLAUDE.md): orice încărcare trece prin coerce.
 */
export const PLATFORM_CRED_SCHEMA = 1;

export const CRED_PLATFORMS = ['meta', 'google', 'tiktok'] as const;
export type CredPlatform = (typeof CRED_PLATFORMS)[number];

export const CRED_STATUSES = ['active', 'needs_reconnect', 'revoked'] as const;
export type CredStatus = (typeof CRED_STATUSES)[number];

export interface PlatformCredential {
  schema: typeof PLATFORM_CRED_SCHEMA;
  platform: CredPlatform;
  /** ID-ul contului de reclame: Meta `act_<id>` / Google `customer_id` / TikTok `advertiser_id`. */
  accountId: string;
  /** Numele contului (din API) — afișat operatorului la conectare (confirmare anti cross-tenant). */
  accountName: string;
  status: CredStatus;
  /** Timezone-ul contului — granița zilei e în tz-ul contului, nu UTC (cheia metricii = data locală). */
  accountTimezone: string;
  /** Moneda contului — `spend` e în moneda contului. */
  accountCurrency: string;
  /** Expirarea token-ului (unix ms); 0 = necunoscut / nu expiră (ex. Meta System User token). */
  expiresAt: number;
  /** UID-ul adminului care a conectat contul (audit). */
  connectedBy: string;
  /** Comutatorul fluxului de date: jobul zilnic trage DOAR dacă ≠ false. OFF = pauză (token-ul rămâne). */
  ingestEnabled: boolean;
}

const s = (v: unknown, n: number): string => (typeof v === 'string' ? v.slice(0, n) : '');
const nonNeg = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Normaliser unic. Platformă necunoscută → null (rândul e ignorat în UI, fără crash). */
export function coerceToPlatformCredential(raw: unknown): PlatformCredential | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (!CRED_PLATFORMS.includes(d.platform as CredPlatform)) return null;
  return {
    schema: PLATFORM_CRED_SCHEMA,
    platform: d.platform as CredPlatform,
    accountId: s(d.accountId, 200),
    accountName: s(d.accountName, 200),
    status: CRED_STATUSES.includes(d.status as CredStatus) ? (d.status as CredStatus) : 'active',
    accountTimezone: s(d.accountTimezone, 64) || 'Europe/Bucharest',
    accountCurrency: s(d.accountCurrency, 8) || 'EUR',
    expiresAt: nonNeg(d.expiresAt),
    connectedBy: s(d.connectedBy, 128),
    ingestEnabled: d.ingestEnabled !== false, // default ON (legacy fără câmp = activ)
  };
}
