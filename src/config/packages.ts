/**
 * Sursa unică a ofertei comerciale — pachete, prețuri, module (feature flags pe abonamente),
 * price ID-uri Stripe. Consumată de pagina de pricing, CTA-urile de checkout, rezolvarea
 * entitlement-ului și de scripts/test-packages.ts.
 *
 * Cifrele de listă sunt PROVIZORII (149/399/999 €) până confirmă Andrei + Ionuţ.
 * Detaliile complete ale ofertei: docs/PACHETE-SI-PRETURI.md.
 */

// Modulele platformei — feature flags pe abonamente (principiul 2 din CLAUDE.md).
// v1 activează doar 'marketing'; restul sunt rezervate verticalelor viitoare —
// un modul nou = intrare aici + colecțiile + functions-urile lui, fără refactor al nucleului.
export type ModuleId = 'marketing' | 'crm' | 'sales' | 'chatbot';

export type PackageId = 'start' | 'growth' | 'premium';

export interface PackageDef {
  id: PackageId;
  emoji: string;
  /** Preț de listă lunar, EUR (provizoriu până la confirmarea cifrelor finale). */
  monthlyAmount: number;
  currency: 'EUR';
  /** Stripe price id (price_…) — gol până le creează Andrei; gol ⇒ CTA „Contactează-ne". */
  priceId: string;
  /** Modulele platformei incluse în abonament (feature flags). */
  modules: ModuleId[];
  /** Chei i18n — tot textul vizibil stă în locales (regula t()). */
  nameKey: string;
  taglineKey: string;
  featureKeys: string[];
  excludedKeys: string[];
  /** Cheia i18n a pachetului din care moștenește („Tot din X, plus:"). */
  inheritsNameKey?: string;
  /** Pachetul evidențiat pe pagina de pricing. */
  highlighted?: boolean;
}

// Garda (import.meta.env ?? {}) permite importul sub test-runnerul esbuild (define → '{}').
const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

export const PACKAGES: PackageDef[] = [
  {
    id: 'start',
    emoji: '📢',
    monthlyAmount: 149,
    currency: 'EUR',
    priceId: env.VITE_STRIPE_PRICE_START || '',
    modules: ['marketing'],
    nameKey: 'pachete.start.name',
    taglineKey: 'pachete.start.tagline',
    featureKeys: [
      'pachete.start.f1',
      'pachete.start.f2',
      'pachete.start.f3',
      'pachete.start.f4',
      'pachete.start.f5',
      'pachete.start.f6',
      'pachete.start.f7',
    ],
    excludedKeys: ['pachete.start.x1', 'pachete.start.x2', 'pachete.start.x3'],
  },
  {
    id: 'growth',
    emoji: '🚀',
    monthlyAmount: 399,
    currency: 'EUR',
    priceId: env.VITE_STRIPE_PRICE_GROWTH || '',
    modules: ['marketing'],
    nameKey: 'pachete.growth.name',
    taglineKey: 'pachete.growth.tagline',
    featureKeys: [
      'pachete.growth.f1',
      'pachete.growth.f2',
      'pachete.growth.f3',
      'pachete.growth.f4',
      'pachete.growth.f5',
      'pachete.growth.f6',
      'pachete.growth.f7',
      'pachete.growth.f8',
    ],
    excludedKeys: [],
    inheritsNameKey: 'pachete.start.name',
    highlighted: true,
  },
  {
    id: 'premium',
    emoji: '👑',
    monthlyAmount: 999,
    currency: 'EUR',
    priceId: env.VITE_STRIPE_PRICE_PREMIUM || '',
    modules: ['marketing'],
    nameKey: 'pachete.premium.name',
    taglineKey: 'pachete.premium.tagline',
    featureKeys: [
      'pachete.premium.f1',
      'pachete.premium.f2',
      'pachete.premium.f3',
      'pachete.premium.f4',
      'pachete.premium.f5',
      'pachete.premium.f6',
      'pachete.premium.f7',
      'pachete.premium.f8',
      'pachete.premium.f9',
      'pachete.premium.f10',
    ],
    excludedKeys: [],
    inheritsNameKey: 'pachete.growth.name',
  },
];

export interface UpsellDef {
  id: string;
  emoji: string;
  nameKey: string;
  descriptionKey: string;
}

/** Upsell-uri afișate pe pricing, vândute DOAR prin „contactează-ne" în v1 (gardul de scope). */
export const UPSELLS: UpsellDef[] = [
  { id: 'video-extra', emoji: '🎥', nameKey: 'upsell.video.name', descriptionKey: 'upsell.video.description' },
  { id: 'landing-page', emoji: '🌐', nameKey: 'upsell.landing.name', descriptionKey: 'upsell.landing.description' },
  { id: 'foto-video', emoji: '📸', nameKey: 'upsell.foto.name', descriptionKey: 'upsell.foto.description' },
  { id: 'google-ads', emoji: '📈', nameKey: 'upsell.googleAds.name', descriptionKey: 'upsell.googleAds.description' },
  { id: 'chatbot', emoji: '🤖', nameKey: 'upsell.chatbot.name', descriptionKey: 'upsell.chatbot.description' },
];

export function isValidPackageId(v: unknown): v is PackageId {
  return v === 'start' || v === 'growth' || v === 'premium';
}

export function getPackage(id: PackageId): PackageDef {
  return PACKAGES.find((p) => p.id === id)!;
}

/** Mapează un Stripe price id înapoi pe pachet (pentru afișarea entitlement-ului). */
export function resolvePackageByPriceId(priceId: string | null | undefined): PackageDef | null {
  if (!priceId) return null;
  return PACKAGES.find((p) => p.priceId && p.priceId === priceId) ?? null;
}

/** true doar când TOATE pachetele au price id — checkout-ul self-serve e activ. */
export function billingConfigured(): boolean {
  return PACKAGES.every((p) => !!p.priceId);
}
