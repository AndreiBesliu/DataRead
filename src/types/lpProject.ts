/**
 * Proiecte LP — colecție gestionată `lpProjects/{id}` pentru organizarea Landing Page-urilor.
 * Un LP referă un proiect prin `LandingPage.projectId` (+ opțional `clientUid` pentru client). PUR
 * (fără Firebase/React), testat headless; un singur normaliser pe toate căile de încărcare.
 */

export const LP_PROJECT_SCHEMA = 1;
export const LP_PROJECT_NAME_MAX = 60;

/** Paletă de culori pentru badge-ul proiectului (prima = implicită). */
export const LP_PROJECT_COLORS = ['#38bdf8', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'] as const;

export interface LpProject {
  schema: number;
  name: string;
  color: string; // hex din LP_PROJECT_COLORS (fallback la prima)
  clientUid: string; // client implicit (opțional) — '' dacă nu
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

export function coerceToLpProject(raw: unknown): LpProject {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const color = typeof d.color === 'string' && HEX.test(d.color) ? d.color : LP_PROJECT_COLORS[0];
  return {
    schema: LP_PROJECT_SCHEMA,
    name: str(d.name, LP_PROJECT_NAME_MAX),
    color,
    clientUid: str(d.clientUid, 128),
  };
}
