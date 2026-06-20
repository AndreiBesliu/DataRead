// Suite headless pentru motorul de automatizare (Felia 0): coerce-ul regulii (clamp/default/enum) + nucleul pur
// (operatori, condiții AND, potrivire trigger + scope multi-tenant, cheie de idempotență, planificare acțiuni +
// anti-buclă). Partea cu efecte (triggere/executeAction/runs) se testează în e2e (functions/index.js real).
import {
  coerceToAutomation, coerceToAutomationCondition, coerceToAutomationAction,
  AUTOMATION_SCHEMA, AUTOMATION_MAX_CONDITIONS, AUTOMATION_MAX_ACTIONS,
} from '../src/types/automation';
import {
  applyOperator, evaluateConditions, matchesTrigger, buildIdempotencyKey, planActions, selectMatching,
  type AutomationEvent,
} from '../src/automation/automationEngine';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}

console.log('AUTOMATION — coerce regulă + nucleu pur (trigger/condiții/idempotență/anti-buclă)');

// ── coerce: default-uri sigure ──
{
  const a = coerceToAutomation(null);
  check('coerce: null → schema 1 + enabled OFF', a.schema === AUTOMATION_SCHEMA && a.enabled === false);
  check('coerce: trigger necunoscut → manual', a.trigger.type === 'manual');
  check('coerce: scope default agency + clientUid gol', a.scope === 'agency' && a.clientUid === '');
}
check('coerce: gunoi nu aruncă', !!coerceToAutomation({ name: 42, conditions: 'x', actions: 7 }));
{
  const a = coerceToAutomation({
    name: 'Alertă spend', enabled: true, scope: 'client', clientUid: 'u1', module: 'optimization',
    trigger: { type: 'campaign.metric_threshold', config: { metric: 'spend', threshold: 500 } },
    conditions: [{ field: 'metric.leads', op: 'eq', value: 0 }, { field: 'x', op: 'zzz', value: 'y' }],
    actions: [{ type: 'notify.operator', config: { text: 'Spend mare, 0 lead-uri' } }, { type: 'bogus', config: {} }],
  });
  check('coerce: enabled true păstrat', a.enabled === true);
  check('coerce: scope client → clientUid păstrat', a.scope === 'client' && a.clientUid === 'u1');
  check('coerce: trigger valid + config', a.trigger.type === 'campaign.metric_threshold' && a.trigger.config.threshold === 500);
  check('coerce: op condiție invalid → eq (default)', a.conditions[0].op === 'eq' && a.conditions[1].op === 'eq');
  check('coerce: acțiune cu tip necunoscut eliminată', a.actions.length === 1 && a.actions[0].type === 'notify.operator');
}
check('coerce: scope agency forțează clientUid gol', coerceToAutomation({ scope: 'agency', clientUid: 'u9' }).clientUid === '');
check('coerce: condiție fără field → null', coerceToAutomationCondition({ op: 'eq', value: 1 }) === null);
check('coerce: acțiune fără tip valid → null', coerceToAutomationAction({ config: {} }) === null);
// plafoane
{
  const many = Array.from({ length: 30 }, (_, i) => ({ field: `f${i}`, op: 'eq', value: i }));
  const manyA = Array.from({ length: 30 }, () => ({ type: 'notify.operator', config: {} }));
  const a = coerceToAutomation({ conditions: many, actions: manyA });
  check('coerce: plafon condiții', a.conditions.length === AUTOMATION_MAX_CONDITIONS);
  check('coerce: plafon acțiuni', a.actions.length === AUTOMATION_MAX_ACTIONS);
}

// ── applyOperator ──
check('op: eq string', applyOperator('eq', 'new', 'new') === true);
check('op: ne', applyOperator('ne', 'new', 'contacted') === true);
check('op: gt numeric', applyOperator('gt', 600, 500) === true && applyOperator('gt', 400, 500) === false);
check('op: gte/lte', applyOperator('gte', 500, 500) === true && applyOperator('lte', 500, 500) === true);
check('op: gt pe non-numeric → false', applyOperator('gt', 'abc', 5) === false);
check('op: in (listă)', applyOperator('in', 'contacted', 'new,contacted,won') === true && applyOperator('in', 'lost', 'new,contacted') === false);
check('op: contains (case-insensitive)', applyOperator('contains', 'Bună Ziua', 'ziua') === true);

// ── evaluateConditions (AND) ──
{
  const ctx = { 'metric.spend': 600, 'metric.leads': 0, 'lead.status': 'new' };
  check('cond: AND toate adevărate', evaluateConditions([{ field: 'metric.spend', op: 'gt', value: 500 }, { field: 'metric.leads', op: 'eq', value: 0 }], ctx) === true);
  check('cond: AND una falsă → false', evaluateConditions([{ field: 'metric.spend', op: 'gt', value: 500 }, { field: 'metric.leads', op: 'gt', value: 0 }], ctx) === false);
  check('cond: listă goală → true', evaluateConditions([], ctx) === true);
  check('cond: field navigare pe puncte', evaluateConditions([{ field: 'lead.status', op: 'eq', value: 'new' }], ctx) === true);
}

// ── matchesTrigger (+ scope multi-tenant) ──
{
  const ev: AutomationEvent = { trigger: 'lead.created', targetId: 'L1', clientUid: 'u1', ctx: {} };
  check('trigger: dezactivat → false', matchesTrigger(coerceToAutomation({ trigger: { type: 'lead.created' }, enabled: false }), ev) === false);
  check('trigger: tip diferit → false', matchesTrigger(coerceToAutomation({ trigger: { type: 'lead.inactive' }, enabled: true }), ev) === false);
  check('trigger: agency activ → true', matchesTrigger(coerceToAutomation({ trigger: { type: 'lead.created' }, enabled: true, scope: 'agency' }), ev) === true);
  check('trigger: client alt tenant → false', matchesTrigger(coerceToAutomation({ trigger: { type: 'lead.created' }, enabled: true, scope: 'client', clientUid: 'u2' }), ev) === false);
  check('trigger: client același tenant → true', matchesTrigger(coerceToAutomation({ trigger: { type: 'lead.created' }, enabled: true, scope: 'client', clientUid: 'u1' }), ev) === true);
}

// ── idempotență / anti-buclă ──
{
  const ev: AutomationEvent = { trigger: 'lead.status_changed', targetId: 'L1', clientUid: 'u1', ctx: {}, stateHash: 'contacted' };
  const k1 = buildIdempotencyKey('rule1', ev);
  const k2 = buildIdempotencyKey('rule1', ev);
  const k3 = buildIdempotencyKey('rule1', { ...ev, stateHash: 'won' });
  check('idem: stabilă pt. aceeași stare', k1 === k2);
  check('idem: diferă la stare nouă', k1 !== k3);
  check('idem: doar caractere sigure pt. doc id', /^[A-Za-z0-9_.-]+$/.test(k1));
}

// ── planActions: anti-buclă pe origine + flux complet ──
{
  const rule = coerceToAutomation({
    id: 'r1', enabled: true, scope: 'agency', trigger: { type: 'campaign.metric_threshold' },
    conditions: [{ field: 'metric.spend', op: 'gt', value: 500 }, { field: 'metric.leads', op: 'eq', value: 0 }],
    actions: [{ type: 'notify.operator', config: { text: 'Verifică campania' } }],
  });
  const hit: AutomationEvent = { trigger: 'campaign.metric_threshold', targetId: 'C1', clientUid: 'u1', ctx: { 'metric.spend': 700, 'metric.leads': 0 } };
  const miss: AutomationEvent = { ...hit, ctx: { 'metric.spend': 100, 'metric.leads': 0 } };
  const loop: AutomationEvent = { ...hit, origin: 'automation' };
  check('plan: condiții îndeplinite → acțiuni', (planActions(rule, hit) || []).length === 1);
  check('plan: condiții neîndeplinite → null', planActions(rule, miss) === null);
  check('plan: eveniment din motor (origin) → null (anti-buclă)', planActions(rule, loop) === null);
}

// ── selectMatching: mai multe reguli ──
{
  const rules = [
    coerceToAutomation({ id: 'a', enabled: true, trigger: { type: 'lead.created' }, actions: [{ type: 'task.create', config: {} }] }),
    coerceToAutomation({ id: 'b', enabled: false, trigger: { type: 'lead.created' }, actions: [{ type: 'task.create', config: {} }] }),
    coerceToAutomation({ id: 'c', enabled: true, trigger: { type: 'lead.inactive' }, actions: [{ type: 'task.create', config: {} }] }),
  ];
  const ev: AutomationEvent = { trigger: 'lead.created', targetId: 'L1', clientUid: 'u1', ctx: {} };
  const matched = selectMatching(rules, ev);
  check('select: doar regula pornită + tip corect', matched.length === 1 && matched[0].automation.id === 'a' && !!matched[0].key);
}

console.log(`\nautomation: ${failures ? failures + ' EȘUATE' : 'all checks passed'}`);
if (failures) process.exit(1);
