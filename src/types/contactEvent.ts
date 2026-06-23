/**
 * Eveniment din istoricul comportamental al unui contact (Faza 0 predicție).
 * Locație: clients/{uid}/contacts/{contactId}/events/{eventId} — append-only, scris EXCLUSIV de Admin SDK.
 * `at` e timestamp EXPLICIT (ms epoch) ca să avem ordonare cronologică fără a depinde de serverTimestamp
 * (închide golul de timestamp din submissions/lpLeadState). PUR, un singur normaliser (coerceToContactEvent).
 */

export const CONTACT_EVENT_SCHEMA = 1;

export const CONTACT_EVENT_TYPES = ['form_submit', 'status_change'] as const;
export type ContactEventType = (typeof CONTACT_EVENT_TYPES)[number];

export const CONTACT_EVENT_LIMITS = { slug: 80, detail: 200, utmPart: 80 } as const;

export interface ContactEventUtm {
  source: string;
  medium: string;
  campaign: string;
}

export interface ContactEvent {
  schema: typeof CONTACT_EVENT_SCHEMA;
  type: ContactEventType;
  at: number; // ms epoch
  submissionId: string;
  slug: string;
  detail: string; // ex. status nou la status_change
  utm: ContactEventUtm;
}

function coerceUtm(raw: unknown): ContactEventUtm {
  const u = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v.slice(0, CONTACT_EVENT_LIMITS.utmPart) : '');
  return { source: s(u.source), medium: s(u.medium), campaign: s(u.campaign) };
}

/** Unicul normaliser pentru un eveniment de contact (read path). Corupt/lipsă → defaults sigure, niciodată throw. */
export function coerceToContactEvent(raw: unknown): ContactEvent {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    schema: CONTACT_EVENT_SCHEMA,
    type: CONTACT_EVENT_TYPES.includes(d.type as ContactEventType) ? (d.type as ContactEventType) : 'form_submit',
    at: typeof d.at === 'number' && isFinite(d.at) && d.at >= 0 ? d.at : 0,
    submissionId: typeof d.submissionId === 'string' ? d.submissionId.slice(0, 200) : '',
    slug: typeof d.slug === 'string' ? d.slug.slice(0, CONTACT_EVENT_LIMITS.slug) : '',
    detail: typeof d.detail === 'string' ? d.detail.slice(0, CONTACT_EVENT_LIMITS.detail) : '',
    utm: coerceUtm(d.utm),
  };
}
