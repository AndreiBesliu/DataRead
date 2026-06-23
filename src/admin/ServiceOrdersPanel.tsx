import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SERVICES } from '../config/services';
import {
  coerceToServiceOrder,
  SERVICE_ORDER_LIMITS,
  SERVICE_ORDER_STATUSES,
  SERVICE_ORDER_STATUS_COLORS,
  type ServiceOrder,
  type ServiceOrderStatus,
} from '../types/serviceOrder';

interface OrderRow extends ServiceOrder { id: string; atMs: number }

const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px', color: 'var(--fg-0)', fontSize: 13 };
const labelStyle: CSSProperties = { display: 'block', fontSize: 11, color: 'var(--fg-1)', margin: '0 0 3px', fontWeight: 600 };

/** Panou operator — board-ul comenzilor de servicii (Felia 2). Listează TOATE comenzile (din /app de la clienți
 *  + cele deschise de operator), cu filtru de status, schimbarea statusului, editarea livrabilului (vizibil clientului),
 *  ștergere + un formular de creare a unei comenzi noi (source 'operator'). Notele interne rămân pe lead/client. */
export default function ServiceOrdersPanel() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState<'all' | ServiceOrderStatus>('all');
  const [newOpen, setNewOpen] = useState(false);
  const [deliverDraft, setDeliverDraft] = useState<Record<string, string>>({});

  // Formular comandă nouă (operator).
  const [nService, setNService] = useState<string>(SERVICES[0].id);
  const [nCompany, setNCompany] = useState('');
  const [nEmail, setNEmail] = useState('');
  const [nPhone, setNPhone] = useState('');
  const [nClientUid, setNClientUid] = useState('');
  const [nNote, setNNote] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'serviceOrders'), orderBy('createdAt', 'desc')),
      (snap) => setRows(snap.docs.map((d) => {
        const at = d.data().createdAt as { toMillis?: () => number } | undefined;
        return { id: d.id, atMs: at && typeof at.toMillis === 'function' ? at.toMillis() : 0, ...coerceToServiceOrder(d.data()) };
      })),
      () => setRows([]),
    );
  }, []);

  const visible = useMemo(() => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)), [rows, filter]);

  const setStatus = async (id: string, status: ServiceOrderStatus) => {
    try { await updateDoc(doc(db, 'serviceOrders', id), { status, updatedAt: serverTimestamp() }); } catch (e) { console.warn('status update failed', e); }
  };
  const saveDeliverable = async (id: string) => {
    const v = (deliverDraft[id] ?? '').slice(0, SERVICE_ORDER_LIMITS.deliverable);
    try { await updateDoc(doc(db, 'serviceOrders', id), { deliverable: v, updatedAt: serverTimestamp() }); } catch (e) { console.warn('deliverable save failed', e); }
  };
  const remove = async (id: string) => {
    if (!window.confirm(t('admin.svc.confirmDelete'))) return;
    try { await deleteDoc(doc(db, 'serviceOrders', id)); } catch (e) { console.warn('delete failed', e); }
  };

  const createOrder = async () => {
    setCreating(true);
    try {
      await addDoc(collection(db, 'serviceOrders'), {
        schema: 1,
        service: nService,
        status: 'requested',
        source: 'operator',
        clientUid: nClientUid.trim() ? nClientUid.trim().slice(0, 128) : null,
        leadId: null,
        companyName: nCompany.slice(0, SERVICE_ORDER_LIMITS.company),
        contactEmail: nEmail.slice(0, SERVICE_ORDER_LIMITS.contact),
        contactPhone: nPhone.slice(0, SERVICE_ORDER_LIMITS.contact),
        note: nNote.slice(0, SERVICE_ORDER_LIMITS.note),
        deliverable: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNCompany(''); setNEmail(''); setNPhone(''); setNClientUid(''); setNNote(''); setNewOpen(false);
    } catch (e) {
      console.warn('create order failed', e);
    } finally {
      setCreating(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of SERVICE_ORDER_STATUSES) c[s] = rows.filter((r) => r.status === s).length;
    return c;
  }, [rows]);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>{t('admin.svc.title')}</h2>
        <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 13, padding: '7px 14px' }} onClick={() => setNewOpen((o) => !o)}>
          {newOpen ? t('admin.svc.cancel') : t('admin.svc.newOrder')}
        </button>
      </div>

      {newOpen && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14, background: 'var(--bg-1)', display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <span style={labelStyle}>{t('admin.svc.service')}</span>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={nService} onChange={(e) => setNService(e.target.value)}>
                {SERVICES.map((s) => <option key={s.id} value={s.id}>{t(`services.${s.id}.name`)}</option>)}
              </select>
            </label>
            <label style={{ display: 'block' }}><span style={labelStyle}>{t('admin.svc.company')}</span><input style={inputStyle} value={nCompany} maxLength={SERVICE_ORDER_LIMITS.company} onChange={(e) => setNCompany(e.target.value)} /></label>
            <label style={{ display: 'block' }}><span style={labelStyle}>{t('admin.svc.email')}</span><input style={inputStyle} value={nEmail} maxLength={SERVICE_ORDER_LIMITS.contact} onChange={(e) => setNEmail(e.target.value)} /></label>
            <label style={{ display: 'block' }}><span style={labelStyle}>{t('admin.svc.phone')}</span><input style={inputStyle} value={nPhone} maxLength={SERVICE_ORDER_LIMITS.contact} onChange={(e) => setNPhone(e.target.value)} /></label>
            <label style={{ display: 'block' }}><span style={labelStyle}>{t('admin.svc.clientUid')}</span><input style={inputStyle} value={nClientUid} placeholder={t('admin.svc.clientUidPh')} onChange={(e) => setNClientUid(e.target.value)} /></label>
          </div>
          <label style={{ display: 'block' }}><span style={labelStyle}>{t('admin.svc.note')}</span><textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={nNote} maxLength={SERVICE_ORDER_LIMITS.note} onChange={(e) => setNNote(e.target.value)} /></label>
          <div><button type="button" className="btn btn-primary" style={{ fontSize: 13, padding: '8px 16px' }} disabled={creating} onClick={() => void createOrder()}>{creating ? t('admin.svc.creating') : t('admin.svc.create')}</button></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {(['all', ...SERVICE_ORDER_STATUSES] as const).map((f) => (
          <button key={f} type="button" className={filter === f ? 'btn btn-primary' : 'btn'} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setFilter(f)}>
            {f === 'all' ? t('admin.svc.all') : t(`serviceOrders.status_${f}`)} ({counts[f] || 0})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.svc.empty')}</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {visible.map((o) => (
            <div key={o.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', background: 'var(--bg-1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 15 }}>{t(`services.${o.service}.name`)}</strong>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>
                  {t(o.source === 'client' ? 'admin.svc.srcClient' : 'admin.svc.srcOperator')}
                </span>
                <select
                  value={o.status}
                  onChange={(e) => void setStatus(o.id, e.target.value as ServiceOrderStatus)}
                  style={{ marginLeft: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', fontSize: 12, fontWeight: 700, color: SERVICE_ORDER_STATUS_COLORS[o.status], background: 'var(--bg-0)' }}
                >
                  {SERVICE_ORDER_STATUSES.map((s) => <option key={s} value={s}>{t(`serviceOrders.status_${s}`)}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 4 }}>
                {[o.companyName, o.contactEmail, o.contactPhone].filter(Boolean).join(' · ') || '—'}
                {o.clientUid ? ` · ${t('admin.svc.linkedClient')}` : ''}
                {o.atMs ? ` · ${new Date(o.atMs).toLocaleString('ro-RO')}` : ''}
              </div>
              {o.note ? <p style={{ margin: '8px 0 0', fontSize: 13, whiteSpace: 'pre-wrap' }}>{o.note}</p> : null}
              <div style={{ marginTop: 10 }}>
                <span style={labelStyle}>{t('admin.svc.deliverable')}</span>
                <textarea
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  value={deliverDraft[o.id] ?? o.deliverable}
                  maxLength={SERVICE_ORDER_LIMITS.deliverable}
                  placeholder={t('admin.svc.deliverablePh')}
                  onChange={(e) => setDeliverDraft((d) => ({ ...d, [o.id]: e.target.value }))}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} disabled={(deliverDraft[o.id] ?? o.deliverable) === o.deliverable} onClick={() => void saveDeliverable(o.id)}>{t('admin.svc.saveDeliverable')}</button>
                  <button type="button" className="btn" style={{ fontSize: 12, padding: '5px 12px', marginLeft: 'auto', color: '#e06363' }} onClick={() => void remove(o.id)}>{t('admin.svc.delete')}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
