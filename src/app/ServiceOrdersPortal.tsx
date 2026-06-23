import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { reportError } from '../services/errorReporting';
import { SERVICES } from '../config/services';
import {
  coerceToServiceOrder,
  SERVICE_ORDER_LIMITS,
  SERVICE_ORDER_STATUS_COLORS,
  type ServiceOrder,
} from '../types/serviceOrder';

interface OrderRow extends ServiceOrder { id: string; atMs: number }

/** Portal client — comenzile lui de servicii (Felia 2). Listă proprie (read scoped: clientUid == uid) +
 *  formular „Cere un serviciu" → creează un serviceOrder (source 'client', status 'requested'). Operatorul îl
 *  preia în /admin și-i schimbă statusul + adaugă livrabilul (vizibil aici). Fără note interne în doc. */
export default function ServiceOrdersPortal({ uid, email, displayName }: { uid: string; email: string; displayName: string }) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [service, setService] = useState<string>(SERVICES[0].id);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'sent' | 'err'>('idle');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // DOAR filtru de egalitate (clientUid) → index automat, fără index compozit; sortăm client-side (N mic).
    return onSnapshot(
      query(collection(db, 'serviceOrders'), where('clientUid', '==', uid)),
      (snap) => setOrders(
        snap.docs
          .map((d) => {
            const at = d.data().createdAt as { toMillis?: () => number } | undefined;
            return { id: d.id, atMs: at && typeof at.toMillis === 'function' ? at.toMillis() : 0, ...coerceToServiceOrder(d.data()) };
          })
          .sort((a, b) => b.atMs - a.atMs),
      ),
      () => setOrders([]),
    );
  }, [uid]);

  const submit = async () => {
    if (!note.trim()) return;
    setState('saving');
    try {
      await addDoc(collection(db, 'serviceOrders'), {
        schema: 1,
        service,
        status: 'requested',
        source: 'client',
        clientUid: uid,
        leadId: null,
        companyName: (displayName || '').slice(0, SERVICE_ORDER_LIMITS.company),
        contactEmail: (email || '').slice(0, SERVICE_ORDER_LIMITS.contact),
        contactPhone: '',
        note: note.trim().slice(0, SERVICE_ORDER_LIMITS.note),
        deliverable: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNote('');
      setState('sent');
      setOpen(false);
    } catch (e) {
      reportError(e, { kind: 'service-order' });
      setState('err');
    }
  };

  const card = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 16px', marginTop: 16 } as const;
  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--fg-0)', fontSize: 14 };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{t('serviceOrders.title')}</h2>
        <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 13, padding: '7px 14px' }} onClick={() => { setOpen((o) => !o); setState('idle'); }}>
          {open ? t('serviceOrders.cancel') : t('serviceOrders.request')}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--fg-1)', marginBottom: 4, fontWeight: 600 }}>{t('serviceOrders.service')}</span>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={service} onChange={(e) => setService(e.target.value)}>
              {SERVICES.map((s) => <option key={s.id} value={s.id}>{t(`services.${s.id}.name`)}</option>)}
            </select>
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--fg-1)', marginBottom: 4, fontWeight: 600 }}>{t('serviceOrders.note')}</span>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={note} maxLength={SERVICE_ORDER_LIMITS.note} placeholder={t('serviceOrders.notePh')} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div>
            <button type="button" className="btn btn-primary" style={{ fontSize: 14, padding: '9px 18px' }} disabled={state === 'saving' || !note.trim()} onClick={() => void submit()}>
              {state === 'saving' ? t('serviceOrders.sending') : t('serviceOrders.send')}
            </button>
            {state === 'err' && <span style={{ marginLeft: 10, color: '#e05666', fontSize: 13 }}>{t('serviceOrders.error')}</span>}
          </div>
        </div>
      )}

      {state === 'sent' && !open && <p style={{ margin: '10px 0 0', color: 'var(--accent)', fontSize: 13 }}>{t('serviceOrders.sent')}</p>}

      {orders.length === 0 ? (
        <p style={{ margin: '12px 0 0', color: 'var(--fg-1)', fontSize: 14 }}>{t('serviceOrders.empty')}</p>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {orders.map((o) => (
            <div key={o.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg-0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14 }}>{t(`services.${o.service}.name`)}</strong>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: SERVICE_ORDER_STATUS_COLORS[o.status], borderRadius: 999, padding: '2px 9px' }}>
                  {t(`serviceOrders.status_${o.status}`)}
                </span>
                {o.atMs ? <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-1)' }}>{new Date(o.atMs).toLocaleDateString('ro-RO')}</span> : null}
              </div>
              {o.note ? <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{o.note}</p> : null}
              {o.deliverable ? (
                <div style={{ marginTop: 8, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fg-1)', marginBottom: 4 }}>{t('serviceOrders.deliverable')}</div>
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{o.deliverable}</div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
