/**
 * CRM intern — jurnalul de activități al unui lead (timeline). Operatorul loghează interacțiuni (apel/email/
 * întâlnire/notă) cu un tip + text + eventual o dată de follow-up; le vede cronologic. Sub leads/{leadId}/activities
 * (read/write admin). Componentă autonomă (ca LeadRequests/OpportunityBoard) — un singur rând în AdminHome.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { EMAIL_SUBJECT_MAX, EMAIL_BODY_MAX } from '../utils/email';
import { ACTIVITY_TYPES, ACTIVITY_BODY_MAX, coerceToCrmActivity, type ActivityType, type CrmActivity } from '../types/crmActivity';

const TYPE_ICON: Record<ActivityType, string> = { note: '📝', call: '📞', email: '✉️', meeting: '🤝', other: '•' };
type Row = CrmActivity & { id: string };

/** Follow-up-ul denormalizat pe lead = cel mai APROPIAT dueAt (cel mai mic, lexicografic pe 'YYYY-MM-DD') dintre TOATE
 *  activitățile cu dată — NU dueAt-ul ultimei activități adăugate (o notă fără dată ar fi golit un follow-up real). */
function nearestDue(items: Array<{ dueAt?: string }>): string {
  const dates = items.map((r) => r.dueAt || '').filter(Boolean);
  return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : '';
}

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
      // Denormalizează follow-up-ul pe lead → tab-ul „Sugestii" îl vede fără query pe subcolecție. = cel mai apropiat
      // dueAt din TOATE activitățile (cele existente + cea nou-adăugată) — o notă fără dată NU mai golește un follow-up real.
      try { await updateDoc(doc(db, 'leads', leadId), { nextFollowUp: nearestDue([...rows, { dueAt: dueAt || '' }]) }); } catch (e) { console.warn('nextFollowUp update failed:', e); }
      setBody(''); setDueAt(''); setType('note');
    } catch (e) { console.warn('add activity failed:', e); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm(t('admin.activity.deleteConfirm'))) return;
    try {
      await deleteDoc(doc(db, 'leads', leadId, 'activities', id));
      // Recalculează follow-up-ul = cel mai apropiat dueAt dintre activitățile RĂMASE (nu doar al celei mai recente).
      try { await updateDoc(doc(db, 'leads', leadId), { nextFollowUp: nearestDue(rows.filter((r) => r.id !== id)) }); } catch (e) { console.warn('nextFollowUp recompute failed:', e); }
    } catch (e) { console.warn(e); }
  };

  // ── Trimite email (felia 1, gated server-side prin EMAIL_ENABLED) — callable scrie în coadă + loghează activitate. ──
  const [mailOpen, setMailOpen] = useState(false);
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailState, setMailState] = useState<{ s: 'idle' | 'busy' | 'ok' | 'disabled' | 'err'; msg: string }>({ s: 'idle', msg: '' });
  const sendEmail = async () => {
    if (!mailSubject.trim() || !mailBody.trim()) return;
    setMailState({ s: 'busy', msg: '' });
    try {
      const fn = httpsCallable<{ leadId: string; subject: string; body: string }, { status: string }>(functions, 'sendLeadEmail');
      const res = await fn({ leadId, subject: mailSubject.slice(0, EMAIL_SUBJECT_MAX), body: mailBody.slice(0, EMAIL_BODY_MAX) });
      if (res.data?.status === 'disabled') { setMailState({ s: 'disabled', msg: t('admin.activity.mailDisabled') }); return; }
      setMailState({ s: 'ok', msg: t('admin.activity.mailSent') });
      setMailSubject(''); setMailBody(''); setMailOpen(false);
    } catch (e) {
      const code = String((e as { message?: string }).message ?? '');
      setMailState({ s: 'err', msg: code.includes('OPTED_OUT') ? t('admin.activity.mailOptedOut') : code.includes('NO_EMAIL') ? t('admin.activity.mailNoAddr') : t('admin.activity.mailErr') });
    }
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
        <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setMailOpen((o) => !o)}>✉️ {t('admin.activity.emailBtn')}</button>
      </div>

      {/* Trimite email către lead (felia 1) — server-side gated; loghează automat o activitate de tip email. */}
      {mailOpen && (
        <div style={{ marginTop: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-1)', display: 'grid', gap: 6 }}>
          <input style={inp} maxLength={EMAIL_SUBJECT_MAX} placeholder={t('admin.activity.emailSubject')} value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
          <textarea style={{ ...inp, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} maxLength={EMAIL_BODY_MAX} placeholder={t('admin.activity.emailBody')} value={mailBody} onChange={(e) => setMailBody(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={mailState.s === 'busy' || !mailSubject.trim() || !mailBody.trim()} onClick={() => void sendEmail()}>
              {mailState.s === 'busy' ? t('admin.activity.emailSending') : t('admin.activity.emailSend')}
            </button>
            {mailState.msg && <span style={{ fontSize: 12, color: mailState.s === 'ok' ? '#1e7e34' : mailState.s === 'disabled' ? 'var(--fg-1)' : '#c0392b' }}>{mailState.msg}</span>}
          </div>
          <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: 0 }}>{t('admin.activity.emailHint')}</p>
        </div>
      )}

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
