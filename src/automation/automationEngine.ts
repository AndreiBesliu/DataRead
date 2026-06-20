/**
 * Nucleul PUR al motorului de automatizare (zero I/O) — evaluare declanșator + condiții + planificare acțiuni +
 * cheie de idempotență (anti-buclă / anti-dublură). Portat 1:1 în functions/index.js (paritate TS↔JS testată în
 * e2e). Partea cu efecte (înregistrarea triggerelor, executeAction, scrierea în `runs`) trăiește DOAR în functions.
 *
 * Anti-buclă & at-least-once: fiecare potrivire produce o `idempotencyKey` deterministă; functions creează
 * tranzacțional `automations/{id}/runs/{key}` și sare dacă există deja (dedupe). Scrierile motorului poartă un
 * marcaj de origine pe care sursele de trigger îl ignoră.
 */
import type { Automation, AutomationAction, AutomationCondition, AutomationConditionOp } from '../types/automation';

// Un eveniment normalizat produs de o sursă de trigger (Firestore trigger / scheduler / manual).
export interface AutomationEvent {
  trigger: string;                       // tipul declanșatorului (ex. 'campaign.metric_threshold')
  targetId: string;                      // ex. leadId / campaignId (pt. izolare + idempotență)
  clientUid: string;                     // tenantul țintă ('' pt. context pur de agenție)
  ctx: Record<string, unknown>;          // câmpuri pe care condițiile le evaluează (lead.status, metric.spend, ...)
  stateHash?: string;                    // semnătura stării (ex. noua valoare) — intră în cheia de idempotență
  origin?: string;                       // 'automation' dacă evenimentul vine dintr-o scriere a motorului → IGNORAT
}

// Compară două valori cu un operator. Robust la tipuri: 'in'/'contains' lucrează pe string-uri (liste „a,b,c").
export function applyOperator(op: AutomationConditionOp, left: unknown, right: string | number): boolean {
  const ln = typeof left === 'number' ? left : Number(left);
  const rn = typeof right === 'number' ? right : Number(right);
  const numeric = Number.isFinite(ln) && Number.isFinite(rn);
  switch (op) {
    case 'eq': return String(left) === String(right);
    case 'ne': return String(left) !== String(right);
    case 'gt': return numeric && ln > rn;
    case 'lt': return numeric && ln < rn;
    case 'gte': return numeric && ln >= rn;
    case 'lte': return numeric && ln <= rn;
    case 'in': {
      // right = listă „a,b,c"; adevărat dacă left ∈ listă
      const set = String(right).split(',').map((x) => x.trim()).filter(Boolean);
      return set.includes(String(left));
    }
    case 'contains': return String(left).toLowerCase().includes(String(right).toLowerCase());
    default: return false;
  }
}

// Citește un câmp din contextul evenimentului (suportă chei plate „lead.status" exact cum sunt puse de sursă).
function readField(ctx: Record<string, unknown>, field: string): unknown {
  if (field in ctx) return ctx[field];
  // fallback: navigare pe puncte (a.b.c)
  const parts = field.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

// Lanț AND: toate condițiile trebuie să fie adevărate. Listă goală → adevărat (regulă fără condiții = mereu).
export function evaluateConditions(conditions: AutomationCondition[], ctx: Record<string, unknown>): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  for (const c of conditions) {
    if (!applyOperator(c.op, readField(ctx, c.field), c.value)) return false;
  }
  return true;
}

// Potrivirea declanșatorului: regula e pornită, tipul coincide, iar scope-ul/tenantul se potrivesc.
export function matchesTrigger(a: Automation, event: AutomationEvent): boolean {
  if (!a || a.enabled !== true) return false;
  if (a.trigger.type !== event.trigger) return false;
  if (a.scope === 'client') {
    // regulile de client rulează DOAR pe tenantul lor (izolare multi-tenant)
    return !!a.clientUid && a.clientUid === event.clientUid;
  }
  return true; // agency: rulează pe orice tenant
}

// Cheie deterministă pentru dedupe + anti-buclă. Aceeași regulă + aceeași țintă + aceeași stare → aceeași cheie
// ⇒ creearea `runs/{key}` reușește o singură dată (la a doua oară doc-ul există = sărim).
export function buildIdempotencyKey(automationId: string, event: AutomationEvent): string {
  const safe = (x: string) => String(x || '').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120);
  return [safe(automationId), safe(event.trigger), safe(event.targetId), safe(event.stateHash || '')].join('__');
}

// Dry-run / execuție: dacă regula se potrivește ȘI evenimentul NU vine din motor (anti-buclă) ȘI condițiile trec,
// întoarce lista de acțiuni de executat; altfel null. NU produce efecte (planificare pură).
export function planActions(a: Automation, event: AutomationEvent): AutomationAction[] | null {
  if (event.origin === 'automation') return null; // scrierea unei acțiuni nu re-declanșează motorul
  if (!matchesTrigger(a, event)) return null;
  if (!evaluateConditions(a.conditions, event.ctx)) return null;
  return a.actions;
}

// Selectează din mulțimea de reguli pe cele care se aplică evenimentului (cu planul de acțiuni atașat).
export function selectMatching(
  automations: Automation[], event: AutomationEvent,
): Array<{ automation: Automation; actions: AutomationAction[]; key: string }> {
  const out: Array<{ automation: Automation; actions: AutomationAction[]; key: string }> = [];
  for (const a of automations || []) {
    const actions = planActions(a, event);
    if (actions && actions.length) out.push({ automation: a, actions, key: buildIdempotencyKey(a.id || a.name, event) });
  }
  return out;
}
