/**
 * Config-ul motorului de automatizare pentru acțiunile AI (Felia 2b) — setat din /admin, citit de motor (functions)
 * prin Admin SDK. `aiDailyCap` = plafon GLOBAL/zi de acțiuni AI declanșate de automatizări (backstop de cost).
 * `aiBypassEntitlement` = comutatorul de bypass: când e ON, acțiunile AI rulează indiferent de abonamentul clientului
 * (altfel, AI doar pentru clienții cu entitlement activ). schema:1 + coerce unic, nu aruncă. Doc: appConfig/automation.
 */
export const AUTOMATION_CONFIG_SCHEMA = 1;
export const AUTOMATION_AI_CAP_DEFAULT = 50;
export const AUTOMATION_AI_CAP_MAX = 100000;

export interface AutomationConfig {
  schema: number;
  aiDailyCap: number;
  aiBypassEntitlement: boolean;
}

export function coerceToAutomationConfig(raw: unknown): AutomationConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  let cap = typeof r.aiDailyCap === 'number' && Number.isFinite(r.aiDailyCap) ? Math.floor(r.aiDailyCap) : AUTOMATION_AI_CAP_DEFAULT;
  cap = Math.max(0, Math.min(AUTOMATION_AI_CAP_MAX, cap));
  return { schema: AUTOMATION_CONFIG_SCHEMA, aiDailyCap: cap, aiBypassEntitlement: r.aiBypassEntitlement === true };
}
