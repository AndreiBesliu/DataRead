/**
 * Atribuire per-link pentru Landing Pages — PUR (fără Firebase/React), testat headless.
 *
 * Linkul public (/p/{slug}) se postează pe multe platforme și pe assets video/statice cu versiuni
 * diferite, codificate prin UTM. O „variantă" = combinația (source, medium, campaign, content). Cheia
 * variantei (`variantKey`) e ID-ul documentului contor `landingPages/{slug}/variants/{key}` — DECI
 * trebuie calculată IDENTIC în TS (Link Builder scrie cheia) și în portul JS din functions/index.js
 * (serveLp incrementează contorul). Orice divergență rupe varianta în două docs. Format dead-simple
 * tocmai pentru paritate exactă; vezi testul de paritate din scripts/e2e-lp-serve.mjs.
 */

export const LP_ATTRIBUTION_SCHEMA = 1;

/** Tipuri de asset (medium UTM) sugerate în builder ȘI whitelist pentru bucketing în rollup-ul zilnic. */
export const LP_MEDIA = ['video', 'static', 'image', 'story', 'reel', 'carousel', 'post', 'email', 'bio', 'qr', 'sms', 'other'] as const;
export type LpMedium = (typeof LP_MEDIA)[number];
export const LP_MEDIUM_WHITELIST: readonly string[] = LP_MEDIA;

/** Platforme sugerate pentru câmpul „source" (doar sugestii UI; source-ul stocat e cel sanitizat). */
export const LP_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'google', 'linkedin', 'x', 'pinterest', 'snapchat', 'whatsapp', 'telegram', 'reddit', 'email', 'sms', 'other'] as const;

export const LP_ATTR_PART_MAX = 40; // lungime maximă per dimensiune (source/medium/campaign/content/term)
export const LP_LINK_LABEL_MAX = 80;
export const LP_KNOWN_VARIANTS_MAX = 200; // plafon chei în landingPages/{slug}.knownVariants (anti-bloat)

export interface LpAttr {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
}

export const EMPTY_ATTR: LpAttr = { source: '', medium: '', campaign: '', content: '', term: '' };

/**
 * Sanitizează o dimensiune la o formă canonică, sigură ca parte de ID Firestore: fără diacritice,
 * minuscule, doar [a-z0-9-], fără `~` (separatorul de cheie), max LP_ATTR_PART_MAX. Gol → '-'.
 * IDENTIC cu portul JS din functions/index.js (sanitizeVariantPart).
 */
export function sanitizeVariantPart(x: unknown): string {
  const s = String(x == null ? '' : x)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // taie semnele diacritice combinate (U+0300..U+036F)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LP_ATTR_PART_MAX);
  return s || '-';
}

/** Normalizează un obiect de atribuire (din UTM brut sau din câmpuri de UI) la părți canonice. */
export function cleanAttr(raw: unknown): LpAttr {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    source: sanitizeVariantPart(o.source),
    medium: sanitizeVariantPart(o.medium),
    campaign: sanitizeVariantPart(o.campaign),
    content: sanitizeVariantPart(o.content),
    term: sanitizeVariantPart(o.term),
  };
}

/**
 * Cheia variantei = [source, medium, campaign, content] sanitizate, unite cu `~`, plafonate la 160.
 * `term` NU intră în cheie (e doar metadată). `__direct`/`__other` (rezervate) nu pot fi produse de
 * sanitizeVariantPart (underscore-ul nu e în [a-z0-9-]). IDENTIC cu portul JS.
 */
export function variantKey(attr: unknown): string {
  const a = cleanAttr(attr);
  return [a.source, a.medium, a.campaign, a.content].map(sanitizeVariantPart).join('~').slice(0, 160);
}

export const LP_VARIANT_DIRECT = '__direct'; // vizită fără niciun UTM
export const LP_VARIANT_OTHER = '__other'; // UTM prezent dar nu e o variantă cunoscută (allowlist)

/** True dacă atribuirea conține CEL PUȚIN o dimensiune reală (nu doar '-'). */
export function hasAttr(attr: LpAttr): boolean {
  return [attr.source, attr.medium, attr.campaign, attr.content].some((p) => p && p !== '-');
}

/**
 * Construiește URL-ul public etichetat: {origin}/p/{slug}?utm_source=...&utm_medium=...&... (doar
 * dimensiunile ne-goale). Folosește părțile sanitizate, ca UTM-urile din link să coincidă cu variantKey.
 */
export function buildLpUrl(origin: string, slug: string, attr: unknown): string {
  const a = cleanAttr(attr);
  const base = `${(origin || '').replace(/\/$/, '')}/p/${slug}`;
  const params: string[] = [];
  const add = (k: string, v: string) => { if (v && v !== '-') params.push(`${k}=${encodeURIComponent(v)}`); };
  add('utm_source', a.source);
  add('utm_medium', a.medium);
  add('utm_campaign', a.campaign);
  add('utm_content', a.content);
  add('utm_term', a.term);
  return params.length ? `${base}?${params.join('&')}` : base;
}

const numN = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const strN = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

/** Modelul unui link salvat (landingPages/{slug}/links/{id}). createdAt/createdBy = adăugate la scriere. */
export interface LpLink {
  schema: number;
  label: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  url: string;
  variantKey: string;
}

export function coerceToLpLink(raw: unknown): LpLink {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const a = cleanAttr(o);
  return {
    schema: LP_ATTRIBUTION_SCHEMA,
    label: strN(o.label, LP_LINK_LABEL_MAX),
    source: a.source, medium: a.medium, campaign: a.campaign, content: a.content, term: a.term,
    url: strN(o.url, 600),
    variantKey: variantKey(a),
  };
}

/** Modelul de citire al unui contor de variantă (landingPages/{slug}/variants/{key}). */
export interface LpVariant {
  key: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  visits: number;
  beacons: number;
  scrollDepthSum: number;
  timeOnPageSum: number;
  engaged: number;
  ctaClicks: number;
  submissions: number;
}

export function coerceToLpVariant(key: string, raw: unknown): LpVariant {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    key,
    source: strN(o.source, LP_ATTR_PART_MAX),
    medium: strN(o.medium, LP_ATTR_PART_MAX),
    campaign: strN(o.campaign, LP_ATTR_PART_MAX),
    content: strN(o.content, LP_ATTR_PART_MAX),
    term: strN(o.term, LP_ATTR_PART_MAX),
    visits: numN(o.visits),
    beacons: numN(o.beacons),
    scrollDepthSum: numN(o.scrollDepthSum),
    timeOnPageSum: numN(o.timeOnPageSum),
    engaged: numN(o.engaged),
    ctaClicks: numN(o.ctaClicks),
    submissions: numN(o.submissions),
  };
}

/** Rata de conversie a unei variante (submissions / visits) sau null (numitor 0) — ca lpStats. */
export function variantConvRate(v: LpVariant): number | null {
  return v.visits > 0 ? v.submissions / v.visits : null;
}

/** Allowlist-ul de variante de pe LP (landingPages/{slug}.knownVariants): chei valide → true, plafonat. */
export function coerceKnownVariants(raw: unknown): Record<string, true> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<string, true> = {};
  let n = 0;
  for (const k of Object.keys(o)) {
    if (n >= LP_KNOWN_VARIANTS_MAX) break;
    if (o[k] === true && /^[a-z0-9~-]+$/.test(k) && k.length <= 161) { out[k] = true; n++; }
  }
  return out;
}
