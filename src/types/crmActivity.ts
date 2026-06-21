/**
 * CRM intern (Verticala 2 „Lansare Soft") — jurnal de activități per lead. Fiecare interacțiune (apel, email,
 * întâlnire, notă) e un document sub `leads/{leadId}/activities/{id}`, cu tip + corp + moment + eventual o dată de
 * follow-up. Completează nota unică + pipeline-ul de status cu un ISTORIC cronologic al relației. Zona operatorilor
 * (reguli: read/write admin). REGULĂ (CLAUDE.md): un singur `coerceTo*`, niciodată throw; tot textul UI prin t().
 */
export const CRM_ACTIVITY_SCHEMA = 1;

export const ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting', 'other'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_BODY_MAX = 2000;

export interface CrmActivity {
  schema: number;
  id?: string;
  type: ActivityType;
  body: string;
  /** Momentul interacțiunii (millis). Setat la creare (server/clock); folosit pentru sortarea cronologică. */
  at: number;
  /** Follow-up opțional ('YYYY-MM-DD' sau gol) — când trebuie reluată relația. */
  dueAt: string;
  createdBy: string;
}

function s(v: unknown, max: number): string {
  return (typeof v === 'string' ? v : '').slice(0, max);
}
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Normaliser unic — orice intrare (gunoi/parțial) → activitate validă. Nu aruncă. */
export function coerceToCrmActivity(raw: unknown): CrmActivity {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    schema: CRM_ACTIVITY_SCHEMA,
    id: typeof d.id === 'string' ? d.id : undefined,
    type: ACTIVITY_TYPES.includes(d.type as ActivityType) ? (d.type as ActivityType) : 'note',
    body: s(d.body, ACTIVITY_BODY_MAX),
    at: num(d.at),
    dueAt: s(d.dueAt, 10),
    createdBy: s(d.createdBy, 128),
  };
}
