/**
 * Builder UI pentru motorul de automatizare (Felia 1) — operatorul construiește reguli „dacă … atunci …":
 * un Declanșator + Condiții (AND) + Acțiuni (secvență). Mutațiile trec prin callable-uri admin-gated
 * (saveAutomation/deleteAutomation/setAutomationEnabled) — Firestore `automations` e write:false din client.
 * Motorul care LE EXECUTĂ se cablează în felia următoare (triggere + flip AUTOMATION_ENABLED); aici doar
 * pregătim regulile. Tot textul prin t(); culori doar din variabilele temei admin.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import {
  AUTOMATION_TRIGGERS, AUTOMATION_OPS, AUTOMATION_ACTIONS_V1, AUTOMATION_SCOPES,
  AUTOMATION_MAX_CONDITIONS, AUTOMATION_MAX_ACTIONS, coerceToAutomation,
  type Automation, type AutomationActionType,
} from '../types/automation';

// Câmpul de config (cheie unică) afișat per tip de acțiune. Acțiunile fără config nu apar aici.
const ACTION_CFG: Partial<Record<AutomationActionType, 'text' | 'status' | 'title'>> = {
  'notify.operator': 'text',
  'lead.set_status': 'status',
  'task.create': 'title',
};

// Sugestii de câmpuri pentru condiții (datalist) — orientative, câmpul rămâne liber.
const FIELD_SUGGESTIONS = ['lead.status', 'lead.source', 'metric.spend', 'metric.leads', 'metric.cpl', 'metric.roas', 'campaign.platform', 'campaign.aiInsight.verdict'];

type Rule = Automation & { id: string };
type Notif = { id: string; automationName?: string; text?: string; trigger?: string; createdAt?: number };

export default function AutomationsPanel() {
  const { t } = useTranslation();
  const [rules, setRules] = useState<Rule[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [draft, setDraft] = useState<Automation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'automations'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setRules(snap.docs.map((d) => ({ ...coerceToAutomation({ ...d.data(), id: d.id }), id: d.id })));
    }, () => { /* fără acces / offline → listă goală */ });
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notif, 'id'>) })));
    }, () => { /* fără notificări încă */ });
  }, []);

  const startNew = () => { setErr(''); setDraft(coerceToAutomation({ enabled: false, module: 'marketing' })); };
  const startEdit = (r: Rule) => { setErr(''); setDraft(coerceToAutomation(r)); };
  const patch = (p: Partial<Automation>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const save = async () => {
    if (!draft) return;
    setBusy(true); setErr('');
    try {
      await httpsCallable(functions, 'saveAutomation')({ ...draft, id: draft.id });
      setDraft(null);
    } catch (e) { console.warn('saveAutomation failed:', e); setErr(t('admin.automation.err')); }
    finally { setBusy(false); }
  };
  const remove = async (r: Rule) => {
    if (!window.confirm(t('admin.automation.deleteConfirm'))) return;
    setBusy(true); setErr('');
    try { await httpsCallable(functions, 'deleteAutomation')({ id: r.id }); }
    catch (e) { console.warn('deleteAutomation failed:', e); setErr(t('admin.automation.err')); }
    finally { setBusy(false); }
  };
  const toggle = async (r: Rule) => {
    setBusy(true); setErr('');
    try { await httpsCallable(functions, 'setAutomationEnabled')({ id: r.id, enabled: !r.enabled }); }
    catch (e) { console.warn('setAutomationEnabled failed:', e); setErr(t('admin.automation.err')); }
    finally { setBusy(false); }
  };

  const input: CSSProperties = { padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-1)', color: 'var(--fg-0)' };
  const label: CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', display: 'block', marginBottom: 3 };
  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 };
  const valid = !!draft && draft.name.trim().length > 0 && draft.actions.length > 0;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>{t('admin.automation.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '4px 0 0', maxWidth: 640 }}>{t('admin.automation.hint')}</p>
        </div>
        {!draft && <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={startNew}>{t('admin.automation.new')}</button>}
      </div>

      {err ? <p role="alert" style={{ color: '#c0392b', fontSize: 13 }}>{err}</p> : null}

      {/* Editor */}
      {draft && (
        <div style={{ ...card, marginTop: 12, borderColor: 'var(--accent)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>{t('admin.automation.name')}</label>
              <input style={{ ...input, width: '100%' }} value={draft.name} placeholder={t('admin.automation.namePh')} maxLength={80}
                onChange={(e) => patch({ name: e.target.value })} />
            </div>
            <div>
              <label style={label}>{t('admin.automation.trigger')}</label>
              <select style={{ ...input, width: '100%' }} value={draft.trigger.type}
                onChange={(e) => patch({ trigger: { type: e.target.value as Automation['trigger']['type'], config: draft.trigger.config } })}>
                {AUTOMATION_TRIGGERS.map((tr) => <option key={tr} value={tr}>{t(`admin.automation.trig.${tr}`)}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>{t('admin.automation.scope')}</label>
              <select style={{ ...input, width: '100%' }} value={draft.scope}
                onChange={(e) => patch({ scope: e.target.value as Automation['scope'] })}>
                {AUTOMATION_SCOPES.map((sc) => <option key={sc} value={sc}>{t(sc === 'agency' ? 'admin.automation.scopeAgency' : 'admin.automation.scopeClient')}</option>)}
              </select>
            </div>
            {draft.scope === 'client' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>{t('admin.automation.clientUid')}</label>
                <input style={{ ...input, width: '100%' }} value={draft.clientUid} maxLength={128} onChange={(e) => patch({ clientUid: e.target.value })} />
              </div>
            )}
          </div>

          {/* Condiții */}
          <div style={{ marginTop: 12 }}>
            <label style={label}>{t('admin.automation.conditions')}</label>
            {draft.conditions.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <input style={{ ...input, flex: '2 1 140px' }} list="auto-fields" value={c.field} placeholder={t('admin.automation.field')}
                  onChange={(e) => { const cs = [...draft.conditions]; cs[i] = { ...c, field: e.target.value }; patch({ conditions: cs }); }} />
                <select style={{ ...input, flex: '1 1 90px' }} value={c.op}
                  onChange={(e) => { const cs = [...draft.conditions]; cs[i] = { ...c, op: e.target.value as typeof c.op }; patch({ conditions: cs }); }}>
                  {AUTOMATION_OPS.map((op) => <option key={op} value={op}>{t(`admin.automation.ops.${op}`)}</option>)}
                </select>
                <input style={{ ...input, flex: '1 1 100px' }} value={String(c.value)} placeholder={t('admin.automation.value')}
                  onChange={(e) => { const cs = [...draft.conditions]; cs[i] = { ...c, value: e.target.value }; patch({ conditions: cs }); }} />
                <button className="btn" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => patch({ conditions: draft.conditions.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <datalist id="auto-fields">{FIELD_SUGGESTIONS.map((f) => <option key={f} value={f} />)}</datalist>
            {draft.conditions.length < AUTOMATION_MAX_CONDITIONS && (
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => patch({ conditions: [...draft.conditions, { field: '', op: 'eq', value: '' }] })}>{t('admin.automation.addCondition')}</button>
            )}
          </div>

          {/* Acțiuni */}
          <div style={{ marginTop: 12 }}>
            <label style={label}>{t('admin.automation.actions')}</label>
            {draft.actions.map((a, i) => {
              const cfgKey = ACTION_CFG[a.type];
              return (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <select style={{ ...input, flex: '1 1 160px' }} value={a.type}
                    onChange={(e) => { const as = [...draft.actions]; as[i] = { type: e.target.value as AutomationActionType, config: {} }; patch({ actions: as }); }}>
                    {AUTOMATION_ACTIONS_V1.map((ac) => <option key={ac} value={ac}>{t(`admin.automation.act.${ac}`)}</option>)}
                  </select>
                  {cfgKey && (
                    <input style={{ ...input, flex: '2 1 160px' }} value={String(a.config[cfgKey] ?? '')} placeholder={t(`admin.automation.cfg.${cfgKey}`)}
                      onChange={(e) => { const as = [...draft.actions]; as[i] = { ...a, config: { ...a.config, [cfgKey]: e.target.value } }; patch({ actions: as }); }} />
                  )}
                  <button className="btn" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => patch({ actions: draft.actions.filter((_, j) => j !== i) })}>✕</button>
                </div>
              );
            })}
            {draft.actions.length < AUTOMATION_MAX_ACTIONS && (
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => patch({ actions: [...draft.actions, { type: 'notify.operator', config: {} }] })}>{t('admin.automation.addAction')}</button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
              <input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
              {t('admin.automation.enabled')}
            </label>
            <div style={{ flex: 1 }} />
            <button className="btn" style={{ padding: '6px 12px', fontSize: 13 }} disabled={busy} onClick={() => setDraft(null)}>{t('admin.automation.cancel')}</button>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} disabled={busy || !valid} onClick={() => void save()}>{busy ? t('admin.automation.saving') : t('admin.automation.save')}</button>
          </div>
        </div>
      )}

      {/* Notificări recente produse de motor (acțiunea notify.operator) */}
      {!draft && notifs.length > 0 && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t('admin.automation.notifTitle')}</div>
          {notifs.map((n) => (
            <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 0', borderTop: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{n.automationName || '—'}</span>
              <span style={{ flex: 1 }}>{n.text}</span>
              <span style={{ color: 'var(--fg-1)' }}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Listă */}
      {!draft && (
        rules.length === 0
          ? <p style={{ fontSize: 13, color: 'var(--fg-1)', marginTop: 16 }}>{t('admin.automation.empty')}</p>
          : <div style={{ marginTop: 12 }}>
            {rules.map((r) => (
              <div key={r.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => void toggle(r)} disabled={busy} title={t('admin.automation.enabled')}
                  style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: r.enabled ? '#1e7e34' : 'var(--bg-0)', color: r.enabled ? '#fff' : 'var(--fg-1)' }}>
                  {r.enabled ? t('admin.automation.on') : t('admin.automation.off')}
                </button>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>
                    {t(`admin.automation.trig.${r.trigger.type}`)} · {r.conditions.length} {t('admin.automation.conditionsShort')} · {r.actions.length} {t('admin.automation.actionsShort')}
                    {r.scope === 'client' ? ` · ${t('admin.automation.scopeClient')}` : ''} · {r.runCount} {t('admin.automation.runs')}
                  </div>
                </div>
                <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => startEdit(r)}>{t('admin.automation.edit')}</button>
                <button className="btn" style={{ padding: '4px 10px', fontSize: 12, color: '#c0392b' }} onClick={() => void remove(r)}>{t('admin.automation.delete')}</button>
              </div>
            ))}
          </div>
      )}
    </div>
  );
}
