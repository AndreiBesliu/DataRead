/**
 * CRM intern — jurnalul de activități al unui lead (timeline). Operatorul loghează interacțiuni (apel/email/
 * întâlnire/notă) cu un tip + text + eventual o dată de follow-up; le vede cronologic. Sub leads/{leadId}/activities
 * (read/write admin). Componentă autonomă (ca LeadRequests/OpportunityBoard) — un singur rând în AdminHome.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { ACTIVITY_TYPES, ACTIVITY_BODY_MAX, coerceToCrmActivity, type ActivityType, type CrmActivity } from '../types/crmActivity';

const TYPE_ICON: Record<ActivityType, string> = { note: '📝', call: '📞', email: '✉️', meeting: '🤝', other: '•' };
type Row = CrmActivity & { id: string };

export default function LeadActivity({ leadId, adminUid }: { leadId: string; adminUid: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [type, setType] = useState<ActivityType>('note');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const off = onSnapshot(
      query(collection(db, 'leads', leadId, 'activities'), orderBy('at', 'desc'), limit(50)),
      (s) => setRows(s.docs.map((d) => ({ ...coerceToCrmActivity({ ...d.data(), id: d.id }), id: d.id }))),
      () => setRows([]),
    );
    return off;
  }, [leadId]);

  const add = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, 'leads', leadId, 'activities'), {
        schema: 1, type, body: body.slice(0, ACTIVITY_BODY_MAX), at: Date.now(), dueAt: dueAt || '', createdBy: adminUid,
      });
      setBody(''); setDueAt(''); setType('note');
    } catch (e) { console.warn('add activity failed:', e); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm(t('admin.activity.deleteConfirm'))) return;
    try { await deleteDoc(doc(db, 'leads', leadId, 'activities', id)); } catch (e) { console.warn(e); }
  };

  const fmt = (ms: number) => (ms ? new Date(ms).toLocaleString('ro-RO') : '—');
  const inp: CSSProperties = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-1)', color: 'var(--fg-0)' };
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <strong style={{ fontSize: 13 }}>{t('admin.activity.title')}</strong>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 6 }}>
        <select style={{ ...inp, width: 120 }} value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
          {ACTIVITY_TYPES.map((tp) => <option key={tp} value={tp}>{TYPE_ICON[tp]} {t(`admin.activity.type_${tp}`)}</option>)}
        </select>
        <textarea style={{ ...inp, flex: '1 1 240px', minHeight: 38, resize: 'vertical', fontFamily: 'inherit' }} maxLength={ACTIVITY_BODY_MAX}
          placeholder={t('admin.activity.placeholder')} value={body} onChange={(e) => setBody(e.target.value)} />
        <label style={{ fontSize: 11, color: 'var(--fg-1)', display: 'grid', gap: 2 }}>{t('admin.activity.followUp')}
          <input type="date" style={inp} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>
        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={busy || !body.trim()} onClick={() => void add()}>{t('admin.activity.add')}</button>
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '8px 0 0' }}>{t('admin.activity.empty')}</p>
      ) : (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
              <span title={t(`admin.activity.type_${r.type}`)}>{TYPE_ICON[r.type]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{r.body}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>
                  {fmt(r.at)}
                  {r.dueAt && <span style={{ marginLeft: 8, color: r.dueAt < todayIso ? '#c0392b' : '#b07b1e', fontWeight: 700 }}>⏰ {t('admin.activity.followUp')}: {r.dueAt}</span>}
                </div>
              </div>
              <button className="btn" style={{ padding: '2px 8px', fontSize: 11, color: '#c0392b' }} onClick={() => void remove(r.id)}>{t('admin.activity.delete')}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
