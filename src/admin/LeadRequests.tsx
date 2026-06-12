import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { OBJECTIVES, type Objective } from '../types/onboarding';
import {
  DELIVERABLE_MAX,
  REQUEST_SCHEMA,
  REQUEST_STATUSES,
  coerceToMarketingRequest,
  deliverableFieldsFor,
  type MarketingRequest,
  type RequestKind,
  type RequestStatus,
} from '../types/request';

const KIND_KEY: Record<RequestKind, string> = {
  campaign: 'admin.reqKindCampaign',
  content: 'admin.reqKindContent',
};

interface Row {
  id: string;
  data: MarketingRequest;
  updatedAt: unknown;
}

interface VersionRow {
  id: string;
  data: MarketingRequest;
  snapshotAt: unknown;
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
  const [newReq, setNewReq] = useState({ kind: 'campaign' as RequestKind, title: '', offer: '', budget: '', objective: 'leads' as Objective });
  const [formError, setFormError] = useState(false);
  const [openReq, setOpenReq] = useState<string | null>(null);
  const [draft, setDraft] = useState<MarketingRequest | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ kind: 'ok' | 'err'; key: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<VersionRow[] | null>(null);

  const copyText = (key: string, text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
      })
      .catch((e) => console.warn('clipboard failed:', e));
  };

  /** Pachetul complet de livrabile, formatat pentru trimiterea către client (fără notele interne). */
  const buildCopyAll = (d: MarketingRequest): string => {
    const parts = [`=== ${d.title} ===`, `Ofertă: ${d.offer}`];
    if (d.budget) parts.push(`Buget: ${d.budget}`);
    if (d.objective) parts.push(`Obiectiv: ${t(`onboarding.objective.${d.objective}`)}`);
    for (const f of deliverableFieldsFor(d.kind)) {
      if (f.key === 'notes') continue;
      const text = d.deliverables[f.key].trim();
      if (text) parts.push('', `— ${t(f.labelKey)} —`, text);
    }
    return parts.join('\n');
  };

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
        kind: newReq.kind,
        title: newReq.title.trim().slice(0, 120),
        offer: newReq.offer.trim().slice(0, 500),
        budget: newReq.budget.trim().slice(0, 80),
        objective: newReq.objective,
        status: 'open',
        source: 'manual',
        deliverables: { adTexts: '', videoScripts: '', campaignStructure: '', calendar: '', posts: '', ideas: '', notes: '' },
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCreating(false);
      setNewReq({ kind: 'campaign', title: '', offer: '', budget: '', objective: 'leads' });
      setFormError(false);
    } catch (e) {
      console.warn('request create failed:', e);
    }
  };

  const toggleOpen = (row: Row) => {
    if (openReq === row.id) {
      setOpenReq(null);
      setDraft(null);
      setShowVersions(false);
      setVersions(null);
      return;
    }
    setOpenReq(row.id);
    setDraft(row.data);
    setSaveState('idle');
    setShowVersions(false);
    setVersions(null);
  };

  const loadVersions = async (reqId: string) => {
    try {
      const snap = await getDocs(
        query(collection(db, 'leads', leadId, 'requests', reqId, 'versions'), orderBy('snapshotAt', 'desc'), limit(20))
      );
      setVersions(snap.docs.map((d) => ({ id: d.id, data: coerceToMarketingRequest(d.data()), snapshotAt: d.data().snapshotAt })));
    } catch (e) {
      console.warn('versions load failed:', e);
      setVersions([]);
    }
  };

  const toggleVersions = (reqId: string) => {
    const next = !showVersions;
    setShowVersions(next);
    if (next && versions === null) void loadVersions(reqId);
  };

  /** Restaurează o versiune: starea curentă devine la rândul ei versiune (nimic nu se pierde),
   *  apoi câmpurile tipului curent se înlocuiesc cu cele din versiune. Notele rămân neatinse. */
  const restoreVersion = async (reqId: string, v: VersionRow) => {
    if (!draft || !window.confirm(t('admin.verRestoreConfirm'))) return;
    try {
      const versionsCol = collection(db, 'leads', leadId, 'requests', reqId, 'versions');
      await addDoc(versionsCol, {
        deliverables: draft.deliverables,
        kind: draft.kind,
        source: draft.source,
        reason: 'pre-restore',
        snapshotAt: serverTimestamp(),
        snapshotBy: adminUid,
      });
      const merged = { ...draft.deliverables };
      for (const f of deliverableFieldsFor(draft.kind)) {
        if (f.key !== 'notes') merged[f.key] = v.data.deliverables[f.key];
      }
      await updateDoc(doc(db, 'leads', leadId, 'requests', reqId), {
        deliverables: merged,
        source: v.data.source,
        updatedAt: serverTimestamp(),
      });
      setDraft((d) => (d ? { ...d, deliverables: merged, source: v.data.source } : d));
      setSaveState('saved');
      void loadVersions(reqId);
    } catch (e) {
      console.warn('restore failed:', e);
    }
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
        deliverables: Object.fromEntries(
          (Object.keys(draft.deliverables) as Array<keyof MarketingRequest['deliverables']>).map((k) => [
            k,
            draft.deliverables[k].slice(0, DELIVERABLE_MAX),
          ])
        ),
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

  /** Verticala 1: cere backend-ului să genereze livrabilele cu AI (callable aiGenerateCampaign).
   *  Functions citește lead-ul + cererea din Firestore și scrie rezultatul pe cerere; aici doar
   *  pornim apelul și aducem rezultatul în editor. Dacă functions-ul nu e deployat încă (cheia
   *  Anthropic nesetată), arătăm mesajul de „neactivat" — integrarea nu e dependență critică. */
  const generateWithAi = async (id: string) => {
    const aiFields = draft ? deliverableFieldsFor(draft.kind).filter((f) => f.key !== 'notes') : [];
    const hasContent = !!draft && aiFields.some((f) => draft.deliverables[f.key].trim());
    if (hasContent && !window.confirm(t('admin.reqAiOverwriteConfirm'))) return;
    setAiBusy(true);
    setAiMessage(null);
    try {
      const fn = httpsCallable<{ leadId: string; requestId: string }, { deliverables?: Record<string, string> }>(
        functions,
        'aiGenerateCampaign'
      );
      const { data } = await fn({ leadId, requestId: id });
      const del = data?.deliverables ?? {};
      setDraft((d) => {
        if (!d) return d;
        const merged = { ...d.deliverables };
        for (const f of deliverableFieldsFor(d.kind)) {
          if (f.key !== 'notes' && typeof del[f.key] === 'string') merged[f.key] = del[f.key];
        }
        return { ...d, source: 'ai', deliverables: merged };
      });
      setSaveState('saved'); // functions a salvat deja documentul
      setAiMessage({ kind: 'ok', key: 'admin.reqAiDone' });
    } catch (e) {
      const code = String((e as { code?: string }).code ?? '');
      // 'functions/not-found' (sau 'internal' din preflight-ul CORS) = callable-ul nu e deployat → neactivat.
      const key = code.endsWith('not-found') || code.endsWith('internal')
        ? 'admin.reqAiNotReady'
        : code.endsWith('resource-exhausted')
          ? 'admin.reqAiQuota'
          : 'admin.reqAiError';
      console.warn('aiGenerateCampaign failed:', e);
      setAiMessage({ kind: 'err', key });
    } finally {
      setAiBusy(false);
    }
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
              {t('admin.reqFormKind')}
              <select style={field} value={newReq.kind} onChange={(e) => setNewReq((r) => ({ ...r, kind: e.target.value as RequestKind }))}>
                <option value="campaign">{t('admin.reqKindCampaign')}</option>
                <option value="content">{t('admin.reqKindContent')}</option>
              </select>
            </label>
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
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, borderRadius: 4, padding: '1px 7px', background: r.data.kind === 'content' ? '#f3e8ff' : '#e8f0fe', color: r.data.kind === 'content' ? '#7c3aed' : '#2563eb' }}>
                {t(KIND_KEY[r.data.kind])}
              </span>
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
                  <button
                    className="btn"
                    style={{ padding: '5px 12px', fontSize: 12 }}
                    disabled={aiBusy}
                    onClick={() => void generateWithAi(r.id)}
                  >
                    {aiBusy ? t('admin.reqAiBusy') : t('admin.reqAiGenerate')}
                  </button>
                  <button className="btn" style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 12, color: '#c0392b' }} onClick={() => void remove(r.id)}>
                    {t('admin.reqDelete')}
                  </button>
                </div>

                {/* Istoricul versiunilor — snapshot automat înainte de fiecare regenerare/restaurare. */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleVersions(r.id)}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent, #2563eb)', cursor: 'pointer' }}
                  >
                    {showVersions ? `▾ ${t('admin.verHide')}` : `▸ ${t('admin.verShow')}`}
                    {versions !== null && versions.length > 0 ? ` (${versions.length})` : ''}
                  </button>
                  {showVersions && (
                    <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                      {versions === null && <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>…</span>}
                      {versions !== null && versions.length === 0 && (
                        <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{t('admin.verEmpty')}</span>
                      )}
                      {versions !== null &&
                        versions.map((v) => (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px' }}>
                            <span style={{ whiteSpace: 'nowrap' }}>{fmtTs(v.snapshotAt)}</span>
                            <span style={{ fontWeight: 700, borderRadius: 4, padding: '0 7px', fontSize: 10, textTransform: 'uppercase', background: v.data.source === 'ai' ? '#e8f0fe' : '#f1f3f5', color: v.data.source === 'ai' ? '#2563eb' : 'var(--fg-1)' }}>
                              {t(v.data.source === 'ai' ? 'admin.verAi' : 'admin.verManual')}
                            </span>
                            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => copyText(`ver-${v.id}`, buildCopyAll({ ...v.data, title: draft.title, offer: draft.offer, budget: draft.budget, objective: draft.objective }))}
                                style={{ border: '1px solid var(--border)', background: 'var(--bg-0)', borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: copiedKey === `ver-${v.id}` ? '#1e7e34' : 'var(--fg-1)' }}
                              >
                                {copiedKey === `ver-${v.id}` ? t('admin.copied') : t('admin.copy')}
                              </button>
                              <button
                                type="button"
                                onClick={() => void restoreVersion(r.id, v)}
                                style={{ border: '1px solid var(--border)', background: 'var(--bg-0)', borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                              >
                                {t('admin.verRestore')}
                              </button>
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {aiMessage && (
                  <div role={aiMessage.kind === 'err' ? 'alert' : 'status'} style={{ fontSize: 12, color: aiMessage.kind === 'err' ? '#c0392b' : '#1e7e34', background: aiMessage.kind === 'err' ? '#fdf0ef' : '#e8f5ec', border: `1px solid ${aiMessage.kind === 'err' ? '#f0c4c0' : '#b5dcc0'}`, borderRadius: 6, padding: '6px 10px' }}>
                    {t(aiMessage.key)}
                  </div>
                )}

                <label style={{ display: 'grid', gap: 3, fontSize: 12, fontWeight: 700 }}>
                  {t('admin.reqFormOffer')}
                  <textarea style={{ ...field, minHeight: 40, resize: 'vertical', fontFamily: 'inherit' }} value={draft.offer} maxLength={500} onChange={(e) => { setDraft((d) => (d ? { ...d, offer: e.target.value } : d)); setSaveState('idle'); }} />
                </label>

                {deliverableFieldsFor(draft.kind).map((f) => (
                  <label key={f.key} style={{ display: 'grid', gap: 3, fontSize: 12, fontWeight: 700 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t(f.labelKey)}
                      {f.key !== 'notes' && draft.deliverables[f.key].trim() && (
                        <button
                          type="button"
                          onClick={() => copyText(f.key, draft.deliverables[f.key])}
                          style={{ border: '1px solid var(--border)', background: 'var(--bg-1)', borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: copiedKey === f.key ? '#1e7e34' : 'var(--fg-1)' }}
                        >
                          {copiedKey === f.key ? t('admin.copied') : t('admin.copy')}
                        </button>
                      )}
                    </span>
                    <textarea
                      style={{ ...field, minHeight: f.key === 'notes' ? 50 : 90, resize: 'vertical', fontFamily: 'inherit' }}
                      value={draft.deliverables[f.key]}
                      maxLength={DELIVERABLE_MAX}
                      onChange={(e) => setDel(f.key, e.target.value)}
                    />
                  </label>
                ))}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12 }} disabled={saveState === 'saving'} onClick={() => void save(r.id)}>
                    {saveState === 'saving' ? t('admin.reqSaving') : saveState === 'saved' ? t('admin.reqSaved') : t('admin.reqSave')}
                  </button>
                  {deliverableFieldsFor(draft.kind).some((f) => f.key !== 'notes' && draft.deliverables[f.key].trim()) && (
                    <button className="btn" style={{ padding: '6px 16px', fontSize: 12, color: copiedKey === 'all' ? '#1e7e34' : undefined }} onClick={() => copyText('all', buildCopyAll(draft))}>
                      {copiedKey === 'all' ? t('admin.copied') : `📋 ${t('admin.copyAll')}`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
