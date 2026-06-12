/**
 * Câmpurile operaționale ale unui lead (colecția `leads`) — statusul de pipeline și notele
 * interne, scrise DOAR de admini (rules). Conținutul formularului în sine e OnboardingData
 * (types/onboarding.ts). Coerce-urile respectă invariantul: date corupte → defaults, fără throw.
 */

export const LEAD_STATUSES = ['new', 'contacted', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function coerceLeadStatus(v: unknown): LeadStatus {
  return LEAD_STATUSES.includes(v as LeadStatus) ? (v as LeadStatus) : 'new';
}

export const LEAD_NOTES_MAX = 4000;

export function coerceLeadNotes(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, LEAD_NOTES_MAX) : '';
}
