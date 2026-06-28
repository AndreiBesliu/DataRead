/**
 * Contact = consumatorul FINAL al unui client (Faza 0 predicție comportamentală).
 * Locație: clients/{uid}/contacts/{contactId} — scris EXCLUSIV de Admin SDK (triggere de ingestie), citit
 * owner+admin. PII BRUT (email/telefon real) NU se stochează aici — doar forme MASCATE + un identityHash
 * (calculat server-side). Sursa de adevăr a PII rămâne `submissions`. PUR (fără Firebase/React), un singur
 * normaliser pe toate căile de citire (coerceToContact). Helperii de mascare/normalizare sunt puri și au
 * port JS în functions (identityHash trăiește DOAR în JS — folosește crypto server-side).
 */
import { LP_LEAD_STATUSES, LP_LEAD_STATUS_DEFAULT, type LpLeadStatus } from './lpLeadState';

export const CONTACT_SCHEMA = 1;

/** Ciclul de viață al contactului — ACELAȘI vocabular ca pipeline-ul clientului (lpLeadState). */
export const CONTACT_LIFECYCLES = LP_LEAD_STATUSES;
export type ContactLifecycle = LpLeadStatus;
export const CONTACT_LIFECYCLE_DEFAULT: ContactLifecycle = LP_LEAD_STATUS_DEFAULT;

/** Cum a fost identificat contactul (ce a stat la baza identityHash-ului). */
export const IDENTITY_KINDS = ['email', 'phone', 'anon'] as const;
export type IdentityKind = (typeof IDENTITY_KINDS)[number];

export const CONTACT_LIMITS = { emailMasked: 160, phoneMasked: 40, lastSlug: 80 } as const;

export interface ContactRollup {
  submissions: number;
  firstSeen: number; // ms epoch
  lastSeen: number; // ms epoch
  lastSlug: string;
  /** Axa monetară F1: LTV = suma valorilor tranzacțiilor câștigate (recalculat din deals/{subId}). */
  value: number;
}

/** Axa monetară F1: campania/sursa care a ADUS contactul (din primul form_submit), pentru CAC/ROI per campanie. */
export interface ContactAcquisition {
  campaign: string;
  source: string;
  medium: string;
}

export interface Contact {
  schema: typeof CONTACT_SCHEMA;
  identityKind: IdentityKind;
  emailMasked: string;
  phoneMasked: string;
  lifecycle: ContactLifecycle;
  rollup: ContactRollup;
  /** F3: contact posibil duplicat (același om cu email pe o pagină, telefon pe alta) → de combinat manual. */
  mergeCandidate: boolean;
  /** F3: id-uri de contacte candidate la combinare cu acesta (operatorul confirmă). */
  mergeWith: string[];
  /** F3: dacă contactul a fost COMBINAT într-altul, id-ul țintă (tombstone — ascuns în UI, redirect la ingestie). */
  mergedInto: string;
  /** Axa monetară F1: atribuirea de achiziție (set-once la primul form_submit cu campanie). */
  acquisition: ContactAcquisition;
}

// ── Helperi puri de identitate (normalizare + mascare). Port JS în functions (paritate e2e). ──
// Hash-ul de identitate (sha256) trăiește DOAR în JS (crypto server-side) — aici nu e nevoie (UI citește contactId ca atare).

/** Normalizează un email pt. identitate: trim + lowercase. Întoarce '' dacă nu pare email (fără '@'). */
export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const e = raw.trim().toLowerCase();
  return e.includes('@') && e.length <= 254 ? e : '';
}

/** Normalizează un telefon: doar cifre, ultimele 9 (suficient pt. RO; evită prefixe inconsistente). '' dacă prea scurt. */
export function normalizePhone(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-9) : '';
}

/** Mască afișabilă pt. email: „a***@gmail.com". '' dacă invalid. */
export function maskEmail(rawEmail: unknown): string {
  const e = normalizeEmail(rawEmail);
  if (!e) return '';
  const at = e.indexOf('@');
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!domain) return '';
  return `${local.slice(0, 1)}***@${domain}`.slice(0, CONTACT_LIMITS.emailMasked);
}

/** Mască afișabilă pt. telefon: „***789" (ultimele 3 cifre). '' dacă invalid. */
export function maskPhone(rawPhone: unknown): string {
  const p = normalizePhone(rawPhone);
  if (!p) return '';
  return `***${p.slice(-3)}`;
}

function coerceRollup(raw: unknown): ContactRollup {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
  return {
    submissions: Math.floor(n(r.submissions)),
    firstSeen: n(r.firstSeen),
    lastSeen: n(r.lastSeen),
    lastSlug: typeof r.lastSlug === 'string' ? r.lastSlug.slice(0, CONTACT_LIMITS.lastSlug) : '',
    value: Math.min(n(r.value), 1e12), // LTV plafonat (paritate cu MAX_MONEY)
  };
}

/** Unicul normaliser pentru un contact (read path). Corupt/lipsă → defaults sigure, niciodată throw. */
export function coerceToContact(raw: unknown): Contact {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    schema: CONTACT_SCHEMA,
    identityKind: IDENTITY_KINDS.includes(d.identityKind as IdentityKind) ? (d.identityKind as IdentityKind) : 'anon',
    emailMasked: s(d.emailMasked, CONTACT_LIMITS.emailMasked),
    phoneMasked: s(d.phoneMasked, CONTACT_LIMITS.phoneMasked),
    lifecycle: LP_LEAD_STATUSES.includes(d.lifecycle as ContactLifecycle) ? (d.lifecycle as ContactLifecycle) : CONTACT_LIFECYCLE_DEFAULT,
    rollup: coerceRollup(d.rollup),
    mergeCandidate: d.mergeCandidate === true,
    mergeWith: (Array.isArray(d.mergeWith) ? d.mergeWith : []).filter((x): x is string => typeof x === 'string' && !!x).slice(0, 10),
    mergedInto: typeof d.mergedInto === 'string' ? d.mergedInto.slice(0, 60) : '',
    acquisition: ((): ContactAcquisition => {
      const a = (d.acquisition && typeof d.acquisition === 'object' ? d.acquisition : {}) as Record<string, unknown>;
      return { campaign: s(a.campaign, 80), source: s(a.source, 80), medium: s(a.medium, 80) };
    })(),
  };
}

/** Eticheta afișabilă a unui contact (email mascat > telefon mascat > „Contact anonim"). i18n cheia anon e a apelantului. */
export function contactDisplay(c: Contact): string {
  return c.emailMasked || c.phoneMasked || '';
}
