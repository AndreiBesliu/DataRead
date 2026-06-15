/**
 * Starea de CRM a clientului pe un lead capturat de o Landing Page (clients/{uid}/lpLeadState/{submissionId}).
 * SEPARAT de `submissions.status` (pipeline-ul intern al agenției). Deținut + scris de client (owner-only
 * via reguli). PUR (fără Firebase/React), un singur normaliser pe toate căile de încărcare.
 */

export const LP_LEAD_STATE_SCHEMA = 1;

/** Pipeline de vânzări al clientului (id-uri; etichetele vin din i18n appHome.ls*). */
export const LP_LEAD_STATUSES = ['nou', 'contactat', 'calificat', 'castigat', 'pierdut'] as const;
export type LpLeadStatus = (typeof LP_LEAD_STATUSES)[number];
export const LP_LEAD_STATUS_DEFAULT: LpLeadStatus = 'nou';

/** Culoare de badge per etapă. */
export const LP_LEAD_STATUS_COLORS: Record<LpLeadStatus, string> = {
  nou: '#64748b',
  contactat: '#38bdf8',
  calificat: '#a855f7',
  castigat: '#22c55e',
  pierdut: '#ef4444',
};

export const LP_LEAD_NOTE_MAX = 1000;

export interface LpLeadState {
  schema: number;
  status: LpLeadStatus;
  note: string;
  slug: string;
}

export function coerceToLpLeadState(raw: unknown): LpLeadState {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const status = LP_LEAD_STATUSES.includes(d.status as LpLeadStatus) ? (d.status as LpLeadStatus) : LP_LEAD_STATUS_DEFAULT;
  return {
    schema: LP_LEAD_STATE_SCHEMA,
    status,
    note: typeof d.note === 'string' ? d.note.slice(0, LP_LEAD_NOTE_MAX) : '',
    slug: typeof d.slug === 'string' ? d.slug.slice(0, 60) : '',
  };
}
