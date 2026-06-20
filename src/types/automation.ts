/**
 * Motor de automatizare DataRead — model UNIC, extensibil: o REGULĂ = Declanșator (1) → Condiții (AND) →
 * Acțiuni (secvență). Toate cele 4 verticale (workflows marketing / optimizare campanii / creare campanii /
 * CRM) se montează pe ACELAȘI motor prin valori de enum diferite — fără refactor de nucleu (principiul de
 * modularitate al platformei). Motorul rulează DOAR în backend; tipurile + coerce-ul de aici sunt sursa unică,
 * portate 1:1 în functions/index.js (paritate TS↔JS testată). Persistență: schema:N + un singur coerce, nu aruncă.
 *
 * Felia 0 = doar fundația (tipuri + coerce + nucleu pur, dormant + flag-gated). Triggere/UI/acțiuni cu cost
 * extern vin în feliile următoare.
 */

export const AUTOMATION_SCHEMA = 1;

// ── Declanșatoare (sursa care pornește o regulă). Extensibil: adăugarea unui tip nou = o intrare aici + sursa lui. ──
export type AutomationTriggerType =
  | 'lead.created'
  | 'lead.status_changed'
  | 'lead.inactive'
  | 'campaign.metric_threshold'
  | 'campaign.insight'
  | 'lp.submission'
  | 'schedule.daily'
  | 'schedule.weekly'
  | 'manual';

export const AUTOMATION_TRIGGERS: AutomationTriggerType[] = [
  'lead.created', 'lead.status_changed', 'lead.inactive',
  'campaign.metric_threshold', 'campaign.insight', 'lp.submission',
  'schedule.daily', 'schedule.weekly', 'manual',
];

// ── Operatori de condiție ──
export type AutomationConditionOp = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
export const AUTOMATION_OPS: AutomationConditionOp[] = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'contains'];

// ── Acțiuni. v1 (Felia 1-3) = doar cele fără cost extern + cele AI (cu cotă). email/sms/publish/webhook
//    rămân în enum dar sunt gate-uite separat în feliile lor (deploy-safe). ──
export type AutomationActionType =
  | 'notify.operator'   // scrie o notificare internă (surfacing în tab Sugestii) — FĂRĂ cost extern
  | 'lead.set_status'   // schimbă statusul lead-ului
  | 'task.create'       // creează un task operator
  | 'report.generate'   // cheamă aiClientReport (mărginit de cotă AI)
  | 'campaign.recommend'// cheamă aiAnalyzeCampaign (recomandare, NU acțiune automată) (cotă AI)
  | 'email.send'        // Felia 4 — necesită provider email + plafoane
  | 'sms.send'          // Felia 4
  | 'campaign.pause'    // viitor — necesită ads_management
  | 'campaign.publish'  // viitor — necesită ads_management
  | 'webhook.call';     // viitor

export const AUTOMATION_ACTIONS: AutomationActionType[] = [
  'notify.operator', 'lead.set_status', 'task.create', 'report.generate', 'campaign.recommend',
  'email.send', 'sms.send', 'campaign.pause', 'campaign.publish', 'webhook.call',
];

// Subsetul de acțiuni SIGURE pentru v1 (fără cost extern / fără scope nou). Server-ul refuză restul cât timp
// flag-urile lor nu sunt active — dar le păstrăm în enum ca builder-ul să le poată afișa „în curând".
export const AUTOMATION_ACTIONS_V1: AutomationActionType[] = [
  'notify.operator', 'lead.set_status', 'task.create', 'report.generate', 'campaign.recommend',
];

// Acțiunile care consumă AI (trec prin cotă) — pentru gardă de cost.
export const AUTOMATION_AI_ACTIONS: AutomationActionType[] = ['report.generate', 'campaign.recommend'];

export type AutomationScope = 'agency' | 'client';
export const AUTOMATION_SCOPES: AutomationScope[] = ['agency', 'client'];

export interface AutomationCondition {
  field: string;                 // ex. 'lead.status', 'metric.spend', 'metric.cpl'
  op: AutomationConditionOp;
  value: string | number;
}

export interface AutomationTrigger {
  type: AutomationTriggerType;
  config: Record<string, string | number>; // ex. { metric:'spend', threshold:500 } sau { statuses:'new,contacted' }
}

export interface AutomationAction {
  type: AutomationActionType;
  config: Record<string, string | number>; // ex. { status:'contacted' } sau { title:'Sună clientul' }
}

export interface Automation {
  schema: number;
  id?: string;
  name: string;
  enabled: boolean;              // comutator master al regulii (ca ingestEnabled la conectori)
  scope: AutomationScope;        // 'agency' = la nivel de operator; 'client' = per clientUid (Verticala 2)
  clientUid: string;            // '' pentru agency
  module: string;               // ModuleId-ul verticalei (marketing/optimization/crm/...) — pt. feature flags
  trigger: AutomationTrigger;
  conditions: AutomationCondition[]; // lanț AND
  actions: AutomationAction[];       // execuție secvențială
  createdBy: string;
  updatedAt: number;
  lastRunAt: number;
  runCount: number;
}

// ── Plafoane (anti-bloat + anti-runaway) ──
export const AUTOMATION_MAX_CONDITIONS = 10;
export const AUTOMATION_MAX_ACTIONS = 8;
export const AUTOMATION_NAME_MAX = 80;
export const AUTOMATION_STR_MAX = 500;
export const AUTOMATION_FIELD_MAX = 60;
// Backstop loop-guard: numărul maxim de rulări pentru aceeași țintă într-o fereastră de 1h (vezi motorul).
export const AUTOMATION_MAX_RUNS_PER_TARGET_HOUR = 5;

// ── Helpers de coerce (nu aruncă; clamp + default-uri sigure) ──
function s(v: unknown, max: number): string {
  return (typeof v === 'string' ? v : '').slice(0, max);
}
function clampNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
function coerceConfig(raw: unknown): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!raw || typeof raw !== 'object') return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= 20) break;
    const key = k.slice(0, AUTOMATION_FIELD_MAX);
    if (typeof v === 'string') out[key] = v.slice(0, AUTOMATION_STR_MAX);
    else if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else continue;
    n++;
  }
  return out;
}

export function coerceToAutomationTrigger(raw: unknown): AutomationTrigger {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const type = AUTOMATION_TRIGGERS.includes(r.type as AutomationTriggerType) ? (r.type as AutomationTriggerType) : 'manual';
  return { type, config: coerceConfig(r.config) };
}

export function coerceToAutomationCondition(raw: unknown): AutomationCondition | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const field = s(r.field, AUTOMATION_FIELD_MAX);
  if (!field) return null;
  const op = AUTOMATION_OPS.includes(r.op as AutomationConditionOp) ? (r.op as AutomationConditionOp) : 'eq';
  const value = typeof r.value === 'number' && Number.isFinite(r.value) ? r.value : s(r.value, AUTOMATION_STR_MAX);
  return { field, op, value };
}

export function coerceToAutomationAction(raw: unknown): AutomationAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!AUTOMATION_ACTIONS.includes(r.type as AutomationActionType)) return null;
  return { type: r.type as AutomationActionType, config: coerceConfig(r.config) };
}

export function coerceToAutomation(raw: unknown): Automation {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const scope: AutomationScope = AUTOMATION_SCOPES.includes(r.scope as AutomationScope) ? (r.scope as AutomationScope) : 'agency';
  const conditions = Array.isArray(r.conditions)
    ? (r.conditions.map(coerceToAutomationCondition).filter(Boolean) as AutomationCondition[]).slice(0, AUTOMATION_MAX_CONDITIONS)
    : [];
  const actions = Array.isArray(r.actions)
    ? (r.actions.map(coerceToAutomationAction).filter(Boolean) as AutomationAction[]).slice(0, AUTOMATION_MAX_ACTIONS)
    : [];
  return {
    schema: AUTOMATION_SCHEMA,
    id: typeof r.id === 'string' ? r.id : undefined,
    name: s(r.name, AUTOMATION_NAME_MAX),
    enabled: r.enabled === true,           // default OFF: o regulă nouă nu rulează până nu e pornită explicit
    scope,
    clientUid: scope === 'client' ? s(r.clientUid, 128) : '',
    module: s(r.module, 40) || 'marketing',
    trigger: coerceToAutomationTrigger(r.trigger),
    conditions,
    actions,
    createdBy: s(r.createdBy, 128),
    updatedAt: clampNum(r.updatedAt),
    lastRunAt: clampNum(r.lastRunAt),
    runCount: clampNum(r.runCount),
  };
}
