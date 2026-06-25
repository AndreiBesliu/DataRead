/**
 * Onboarding-ul clientului (clients/{uid}/onboarding/main + draftul local) — schema 1.
 * REGULĂ (CLAUDE.md): TOATE căile de încărcare (Firestore, draftul din localStorage, teste)
 * trec prin unicul normaliser coerceToOnboarding; validarea e pură (erorile = chei i18n),
 * testată headless în scripts/test-onboarding-validate.ts.
 */
import { isValidPackageId, type PackageId } from '../config/packages';
import { isValidServiceId, type ServiceId } from '../config/services';

export const ONBOARDING_SCHEMA = 1;
export const ONBOARDING_DRAFT_KEY = 'dataread.onboardingDraft.v1';

export const INDUSTRIES = [
  'retail',
  'horeca',
  'services',
  'construction',
  'beauty',
  'auto',
  'medical',
  'education',
  'other',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const OBJECTIVES = ['leads', 'sales', 'awareness', 'traffic', 'other'] as const;
export type Objective = (typeof OBJECTIVES)[number];

export const AD_BUDGETS = ['under250', 'b250_500', 'b500_1000', 'over1000', 'undecided'] as const;
export type AdBudget = (typeof AD_BUDGETS)[number];

export interface OnboardingData {
  schema: typeof ONBOARDING_SCHEMA;
  companyName: string;
  cui: string;
  website: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  industry: Industry | '';
  industryOther: string;
  objectives: Objective[];
  adBudget: AdBudget | '';
  facebook: string;
  instagram: string;
  tiktok: string;
  description: string;
  packageInterest: PackageId | null;
  /** Serviciul de interes din catalogul /servicii (?service=…) — null dacă lead-ul vine din alt flux. */
  serviceInterest: ServiceId | null;
}

export function emptyOnboarding(): OnboardingData {
  return {
    schema: ONBOARDING_SCHEMA,
    companyName: '',
    cui: '',
    website: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    industry: '',
    industryOther: '',
    objectives: [],
    adBudget: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    description: '',
    packageInterest: null,
    serviceInterest: null,
  };
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/** Unicul punct de intrare pentru orice date care pretind a fi un onboarding — corupt/legacy/
 *  viitor → defaults sigure, niciodată throw. */
export function coerceToOnboarding(data: unknown): OnboardingData {
  if (typeof data !== 'object' || data === null) return emptyOnboarding();
  const d = data as Record<string, unknown>;
  const industry = INDUSTRIES.includes(d.industry as Industry) ? (d.industry as Industry) : '';
  const objectives = Array.isArray(d.objectives)
    ? (d.objectives.filter((o) => OBJECTIVES.includes(o as Objective)) as Objective[])
    : [];
  return {
    schema: ONBOARDING_SCHEMA,
    companyName: str(d.companyName, 120),
    cui: str(d.cui, 20),
    website: str(d.website, 200),
    contactName: str(d.contactName, 80),
    contactEmail: str(d.contactEmail, 120),
    contactPhone: str(d.contactPhone, 30),
    industry,
    industryOther: str(d.industryOther, 80),
    objectives: [...new Set(objectives)],
    adBudget: AD_BUDGETS.includes(d.adBudget as AdBudget) ? (d.adBudget as AdBudget) : '',
    facebook: str(d.facebook, 200),
    instagram: str(d.instagram, 200),
    tiktok: str(d.tiktok, 200),
    description: str(d.description, 2000),
    packageInterest: isValidPackageId(d.packageInterest) ? d.packageInterest : null,
    serviceInterest: isValidServiceId(d.serviceInterest) ? d.serviceInterest : null,
  };
}

/** Draftul local (string JSON din localStorage) → date sigure. Nu aruncă niciodată. */
export function coerceToOnboardingDraft(raw: string | null): OnboardingData | null {
  if (!raw) return null;
  try {
    return coerceToOnboarding(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** https:// implicit pentru linkurile introduse fără schemă; golul rămâne gol. */
export function normaliseUrl(v: string): string {
  const s = v.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]{2,}$/i;

function phoneOk(v: string): boolean {
  const digits = v.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export interface ValidationResult {
  ok: boolean;
  /** câmp → cheie i18n de eroare (onboarding.errors.*) */
  errors: Record<string, string>;
}

/** Modul de validare:
 *  - 'full' (cont client /app): profil complet — industrie, buget, descriere OBLIGATORII (comportamentul de dinainte).
 *  - 'lead' (formularul public /start): doar nucleul de contact + intenție (firmă, nume, CEL PUȚIN un contact, obiectiv);
 *    restul sunt opționale (formularul promite „2 minute" → fricțiune mică). Modelul `leads` nu se schimbă; coerce-ul
 *    tolerează deja golurile. Format-urile (email/telefon/URL) se validează când câmpul ESTE completat, în ambele moduri. */
export type OnboardingValidateMode = 'full' | 'lead';

/** Validare pură — fără DOM, fără Firestore — ca să fie testabilă headless. */
export function validateOnboarding(d: OnboardingData, mode: OnboardingValidateMode = 'full'): ValidationResult {
  const errors: Record<string, string> = {};
  const req = (field: keyof OnboardingData) => {
    if (!String(d[field] ?? '').trim()) errors[field] = 'onboarding.errors.required';
  };

  req('companyName');
  req('contactName');

  const emailFilled = !!d.contactEmail.trim();
  const phoneFilled = !!d.contactPhone.trim();
  if (mode === 'lead') {
    // Cel puțin o cale de contact; format validat doar pe cele completate.
    if (!emailFilled && !phoneFilled) errors.contactEmail = 'onboarding.errors.contactRequired';
  } else {
    // Cont complet: ambele obligatorii.
    if (!emailFilled) errors.contactEmail = 'onboarding.errors.required';
    req('contactPhone');
  }
  if (emailFilled && !EMAIL_RE.test(d.contactEmail.trim())) errors.contactEmail = 'onboarding.errors.email';
  if (phoneFilled && !phoneOk(d.contactPhone)) errors.contactPhone = 'onboarding.errors.phone';

  if (d.objectives.length === 0) errors.objectives = 'onboarding.errors.objectives';
  if (d.industry === 'other' && !d.industryOther.trim()) errors.industryOther = 'onboarding.errors.required';

  if (mode === 'full') {
    if (!d.industry) errors.industry = 'onboarding.errors.required';
    if (!d.adBudget) errors.adBudget = 'onboarding.errors.required';
    if (!d.description.trim()) errors.description = 'onboarding.errors.required';
  }
  if (d.description.length > 2000) errors.description = 'onboarding.errors.tooLong';

  for (const f of ['website', 'facebook', 'instagram', 'tiktok'] as const) {
    const v = d[f].trim();
    if (v && !URL_RE.test(normaliseUrl(v))) errors[f] = 'onboarding.errors.url';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
