import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { OBJECTIVES, type Objective } from '../types/onboarding';
import {
  DELIVERABLE_FIELDS,
  DELIVERABLE_MAX,
  REQUEST_SCHEMA,
  REQUEST_STATUSES,
  coerceToMarketingRequest,
  type MarketingRequest,
  type RequestStatus,
} from '../types/request';

interface Row {
  id: string;
  data: MarketingRequest;
  updatedAt: unknown;
}

const field: CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 13,
  background: 'var(--bg-1)',
};

function fmtTs(v: unknown): string {
  try {
    const d = (v as { toDate?: () => Date })?.toDate?.();
    return d ? d.toLocaleString('ro-RO') : '—';
  } catch {
    return '—';
  }
}

/** Cererile de marketing ale unui lead (Verticala 1, semi-manual). Adminul creează cererea
 *  (ofertă + buget + obiectiv) și scrie livrabilele; în felia 2, „Generează cu AI" va completa
 *  ACELEAȘI câmpuri prin callable-ul aiGenerateCampaign (source: 'ai'). */
export default function LeadRequests({ leadId, adminUid }: { leadId: string; adminUid: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newReq, setNewReq] = useState({ title: '', offer: '', budget: '', objective: 'leads' as Objective });
  const [formError, setFormError] = useState(false);
  const [openReq, setOpenReq] = useState<string | null>(null);
  const [draft, setDraft] = useState<MarketingRequest | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    const q = query(collection(db, 'leads', leadId, 'requests'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const out: Row[] = [];
        snap.forEach((d) => out.push({ id: d.id, data: coerceToMarketingRequest(d.data()), updatedAt: d.data().updatedAt }));
        setRows(out);
      },
      (err) => {
        console.warn('lead requests listener:', err);
        setRows([]);
      }
    );
  }, [leadId]);

  const create = async () => {
    if (!newReq.title.trim() || !newReq.offer.trim()) {
      setFormError(true);
      return;
    }
    try {
      await addDoc(collection(db, 'leads', leadId, 'requests'), {
        schema: REQUEST_SCHEMA,
        title: newReq.title.trim().slice(0, 120),
        offer: newReq.offer.trim().slice(0, 500),
        budget: newReq.budget.trim().slice(0, 80),
        objective: newReq.objective,
        status: 'open',
        source: 'manual',
        deliverables: { adTexts: '', videoScripts: '', campaignStructure: '', notes: '' },
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCreating(false);
      setNewReq({ title: '', offer: '', budget: '', objective: 'leads' });
      setFormError(false);
    } catch (e) {
      console.warn('request create failed:', e);
    }
  };

  const toggleOpen = (row: Row) => {
    if (openReq === row.id) {
      setOpenReq(null);
      setDraft(null);
      return;
    }
    setOpenReq(row.id);
    setDraft(row.data);
    setSaveState('idle');
  };

  const save = async (id: string) => {
    if (!draft) return;
    setSaveState('saving');
    try {
      await updateDoc(doc(db, 'leads', leadId, 'requests', id), {
        title: draft.title.slice(0, 120),
        offer: draft.offer.slice(0, 500),
        budget: draft.budget.slice(0, 80),
        objective: draft.objective,
        status: draft.status,
        deliverables: {
          adTexts: draft.deliverables.adTexts.slice(0, DELIVERABLE_MAX),
          videoScripts: draft.deliverables.videoScripts.slice(0, DELIVERABLE_MAX),
          campaignStructure: draft.deliverables.campaignStructure.slice(0, DELIVERABLE_MAX),
          notes: draft.deliverables.notes.slice(0, DELIVERABLE_MAX),
        },
        updatedAt: serverTimestamp(),
      });
      setSaveState('saved');
    } catch (e) {
      console.warn('request save failed:', e);
      setSaveState('idle');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t('admin.reqDeleteConfirm'))) return;
    try {
      await deleteDoc(doc(db, 'leads', leadId, 'requests', id));
      if (openReq === id) {
        setOpenReq(null);
        setDraft(null);
      }
    } catch (e) {
      console.warn('request delete failed:', e);
    }
  };

  const setDel = (key: keyof MarketingRequest['deliverables'], v: string) => {
    setDraft((d) => (d ? { ...d, deliverables: { ...d.deliverables, [key]: v } } : d));
    setSaveState('idle');
  };

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>{t('admin.reqTitle')}</strong>
        {rows && rows.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>({rows.length})</span>
        )}
        {!creating && (
          <button className="btn" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 12 }} onClick={() => setCreating(true)}>
            {t('admin.reqNew')}
          </button>
        )}
      </div>

      {creating && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 3, fontSize: 12, fontWeight: 700 }}>
              {t('admin.reqFormTitle')}
              <input style={field} value={newReq.title} maxLength={120} placeholder={t('admin.reqFormTitlePh')} onChange={(e) => setNewReq((r) => ({ ...r, title: e.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 3, fontSize: 12, fontWeight: 700 }}>
              {t('admin.reqFormBudget')}
              <input style={field} value={newReq.budget} maxLength={80} placeholder={t('admin.reqFormBudgetPh')} onChange={(e) => setNewReq((r) => ({ ...r, budget: e.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 3, fontSize: 12, fontWeight: 700 }}>
              {t('admin.reqFormObjective')}
              <select style={field} value={newReq.objective} onChange={(e) => setNewReq((r) => ({ ...r, objective: e.target.value as Objective }))}>
                {OBJECTIVES.map((o) => (
                  <option key={o} value={o}>{t(`onboarding.objective.${o}`)}</option>
                ))}
              </select>
            </label>
          </div>
          <label style={{ display: 'grid', gap: 3, fontSize: 12, fontWeight: 700 }}>
            {t('admin.reqFormOffer')}
            <textarea style={{ ...field, minHeight: 48, resize: 'vertical', fontFamily: 'inherit' }} value={newReq.offer} maxLength={500} placeholder={t('admin.reqFormOfferPh')} onChange={(e) => setNewReq((r) => ({ ...r, offer: e.target.value }))} />
          </label>
          {formError && <div role="alert" style={{ color: '#c0392b', fontSize: 12 }}>{t('admin.reqRequired')}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => void create()}>{t('admin.reqCreate')}</button>
            <button className="btn" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => { setCreating(false); setFormError(false); }}>{t('admin.reqCancel')}</button>
          </div>
        </div>
      )}

      {rows === null && <p style={{ color: 'var(--fg-1)', fontSize: 12, margin: 0 }}>…</p>}
      {rows !== null && rows.length === 0 && !creating && <p style={{ color: 'var(--fg-1)', fontSize: 12, margin: 0 }}>{t('admin.reqEmpty')}</p>}

      {rows !== null &&
        rows.map((r) => (
          <div key={r.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>{r.data.title || '—'}</strong>
              {r.data.objective && <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t(`onboarding.objective.${r.data.objective}`)}</span>}
              {r.data.budget && <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>· {r.data.budget}</span>}
              <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 9px', background: r.data.status === 'done' ? '#e8f5ec' : '#eef4ff', color: r.data.status === 'done' ? '#1e7e34' : '#2563eb' }}>
                {t(r.data.status === 'done' ? 'admin.reqStatusDone' : 'admin.reqStatusOpen')}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.reqUpdated')} {fmtTs(r.updatedAt)}</span>
              <button className="btn" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => toggleOpen(r)}>
                {openReq === r.id ? t('admin.hideDetail') : t('admin.viewDetail')}
              </button>
            </div>

            {openReq === r.id && draft && (
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    style={{ ...field, width: 'auto', fontWeight: 700 }}
                    value={draft.status}
                    onChange={(e) => { setDraft((d) => (d ? { ...d, status: e.target.value as RequestStatus } : d)); setSaveState('idle'); }}
                  >
                    {REQUEST_STATUSES.map((s) => (
                      <option key={s} value={s}>{t(s === 'done' ? 'admin.reqStatusDone' : 'admin.reqStatusOpen')}</option>
                    ))}
                  </select>
                  <button className="btn" style={{ padding: '5px 12px', fontSize: 12, opacity: 0.55, cursor: 'not-allowed' }} disabled title={t('admin.reqAiSoonHint')}>
                    {t('admin.reqAiSoon')}
                  </button>
                  <button className="btn" style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 12, color: '#c0392b' }} onClick={() => void remove(r.id)}>
                    {t('admin.reqDelete')}
                  </button>
                </div>

                <label style={{ display: 'grid', gap: 3, fontSize: 12, fontWeight: 700 }}>
                  {t('admin.reqFormOffer')}
                  <textarea style={{ ...field, minHeight: 40, resize: 'vertical', fontFamily: 'inherit' }} value={draft.offer} maxLength={500} onChange={(e) => { setDraft((d) => (d ? { ...d, offer: e.target.value } : d)); setSaveState('idle'); }} />
                </label>

                {DELIVERABLE_FIELDS.map((f) => (
                  <label key={f.key} style={{ display: 'grid', gap: 3, fontSize: 12, fontWeight: 700 }}>
                    {t(f.labelKey)}
                    <textarea
                      style={{ ...field, minHeight: f.key === 'notes' ? 50 : 90, resize: 'vertical', fontFamily: 'inherit' }}
                      value={draft.deliverables[f.key]}
                      maxLength={DELIVERABLE_MAX}
                      onChange={(e) => setDel(f.key, e.target.value)}
                    />
                  </label>
                ))}

                <button className="btn btn-primary" style={{ justifySelf: 'start', padding: '6px 16px', fontSize: 12 }} disabled={saveState === 'saving'} onClick={() => void save(r.id)}>
                  {saveState === 'saving' ? t('admin.reqSaving') : saveState === 'saved' ? t('admin.reqSaved') : t('admin.reqSave')}
                </button>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
