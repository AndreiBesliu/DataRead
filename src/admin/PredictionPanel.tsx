/**
 * Predicție comportamentală (Faza 1) — UI operator. Trei exporturi:
 *  - PredictionCard: prezentational (chips + raționament + next-best-actions + caveats + dataGaps).
 *  - LeadPrediction: card în expanderul de lead (predictLeadBehavior → leadPredictions/{leadId}).
 *  - ClientContacts: listă de contacte (consumatorii clientului) + predicție per contact (predictContactBehavior).
 * Predicțiile sunt admin-only (contactPredictions/leadPredictions). Generarea consumă din cota AI a operatorului.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { coerceToContact, contactDisplay, type Contact, type ContactLifecycle } from '../types/contact';
import { coerceToPrediction, hasPrediction, type Prediction, type ConversionLikelihood, type Temperature, type Confidence } from '../types/prediction';

const LK_COLOR: Record<ConversionLikelihood, string> = { low: '#64748b', med: '#2563eb', high: '#1e7e34' };
const TEMP_COLOR: Record<Temperature, string> = { hot: '#e02639', warm: '#b07b1e', cooling: '#2563eb', cold: '#64748b' };
const CONF_COLOR: Record<Confidence, string> = { low: '#c0392b', med: '#b07b1e', high: '#1e7e34' };
const LIFE_COLOR: Record<ContactLifecycle, string> = { nou: '#64748b', contactat: '#38bdf8', calificat: '#a855f7', castigat: '#22c55e', pierdut: '#ef4444' };

function fmtMs(ms: number, lang: string): string {
  if (!ms) return '—';
  try { return new Date(ms).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ro-RO'); } catch { return '—'; }
}

/** Mesajul de eroare standard pentru callable-urile de predicție (cotă / neactivat / generic). */
function predErrKey(e: unknown): string {
  const code = String((e as { code?: string }).code ?? '');
  if (code.endsWith('resource-exhausted')) return 'admin.predQuota';
  if (code.endsWith('failed-precondition') || code.endsWith('not-found') || code.endsWith('internal')) return 'admin.predNotReady';
  return 'admin.predError';
}

export function PredictionCard({ p }: { p: Prediction }) {
  const { t } = useTranslation();
  const chip = (label: string, color: string) => (
    <span style={{ background: color, color: '#fff', fontWeight: 700, borderRadius: 5, padding: '2px 9px', fontSize: 12 }}>{label}</span>
  );
  const head: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--fg-1)', marginTop: 8 };
  return (
    <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.predConversion')}:</span>
        {chip(t('admin.predLk_' + p.conversionLikelihood), LK_COLOR[p.conversionLikelihood])}
        <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.predTemp')}:</span>
        {chip(t('admin.predTemp_' + p.temperature), TEMP_COLOR[p.temperature])}
        <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.predConfidence')}:</span>
        {chip(t('admin.predConf_' + p.confidence), CONF_COLOR[p.confidence])}
      </div>
      {p.reasoning.trim() && (<><div style={head}>{t('admin.predReasoning')}</div><div style={{ whiteSpace: 'pre-wrap' }}>{p.reasoning}</div></>)}
      {p.nextBestActions.length > 0 && (
        <>
          <div style={head}>{t('admin.predNba')}</div>
          <div style={{ display: 'grid', gap: 4 }}>
            {p.nextBestActions.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--accent, #2563eb)' }}>{t('admin.predAction_' + a.action)}</span>
                {a.detail && <span>{a.detail}</span>}
                {a.whenDays > 0 && <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>· {t('admin.predInDays', { n: a.whenDays })}</span>}
              </div>
            ))}
          </div>
        </>
      )}
      {p.caveats.trim() && (<><div style={head}>{t('admin.predCaveats')}</div><div style={{ whiteSpace: 'pre-wrap', color: 'var(--fg-1)' }}>{p.caveats}</div></>)}
      {p.dataGaps.length > 0 && (
        <>
          <div style={head}>{t('admin.predDataGaps')}</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-1)' }}>{p.dataGaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </>
      )}
    </div>
  );
}

const genBtn: CSSProperties = { border: '1px solid var(--border)', background: 'var(--bg-0)', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };

/** Card de predicție pentru un LEAD (pipeline-ul nostru). */
export function LeadPrediction({ leadId }: { leadId: string; adminUid: string; clientUid?: string }) {
  const { t, i18n } = useTranslation();
  const [pred, setPred] = useState<Prediction | null>(null);
  const [atMs, setAtMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errKey, setErrKey] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'leadPredictions', leadId), (snap) => {
      const d = snap.data();
      setPred(d ? coerceToPrediction(d) : null);
      const at = d && (d.at as { toMillis?: () => number } | undefined);
      setAtMs(at && typeof at.toMillis === 'function' ? at.toMillis() : 0);
    }, () => { setPred(null); });
  }, [leadId]);

  const generate = async () => {
    setBusy(true); setErrKey(null);
    try {
      await httpsCallable<{ leadId: string }, unknown>(functions, 'predictLeadBehavior')({ leadId }); // listener aduce rezultatul
    } catch (e) { console.warn('predictLeadBehavior failed:', e); setErrKey(predErrKey(e)); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>🔮 {t('admin.predTitle')}</strong>
        {atMs > 0 && <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.predAt')} {fmtMs(atMs, i18n.language)}</span>}
        <button style={{ ...genBtn, marginLeft: 'auto' }} disabled={busy} onClick={() => void generate()}>
          {busy ? t('admin.predBusy') : hasPrediction(pred) ? t('admin.predRegenerate') : t('admin.predGenerate')}
        </button>
      </div>
      {errKey && <div role="alert" style={{ fontSize: 12, color: '#c0392b', marginBottom: 6 }}>{t(errKey)}</div>}
      {pred && hasPrediction(pred) ? <PredictionCard p={pred} /> : !busy && <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: 0 }}>{t('admin.predEmpty')}</p>}
    </div>
  );
}

/** Lista de contacte a unui client (consumatorii lui) + predicție per contact. */
export function ClientContacts({ uid }: { uid: string }) {
  const { t, i18n } = useTranslation();
  const [contacts, setContacts] = useState<Array<{ id: string; data: Contact }> | null>(null);
  const [preds, setPreds] = useState<Record<string, { p: Prediction; atMs: number }>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errKey, setErrKey] = useState<string | null>(null);

  useEffect(() => {
    const off1 = onSnapshot(
      query(collection(db, 'clients', uid, 'contacts'), orderBy('rollup.lastSeen', 'desc'), limit(100)),
      (snap) => setContacts(snap.docs.map((d) => ({ id: d.id, data: coerceToContact(d.data()) }))),
      () => setContacts([])
    );
    const off2 = onSnapshot(
      query(collection(db, 'contactPredictions'), where('clientUid', '==', uid)),
      (snap) => {
        const m: Record<string, { p: Prediction; atMs: number }> = {};
        snap.forEach((d) => { const x = d.data(); const at = x.at as { toMillis?: () => number } | undefined; m[d.id] = { p: coerceToPrediction(x), atMs: at && typeof at.toMillis === 'function' ? at.toMillis() : 0 }; });
        setPreds(m);
      },
      () => setPreds({})
    );
    return () => { off1(); off2(); };
  }, [uid]);

  const generate = async (contactId: string) => {
    setBusy(contactId); setErrKey(null);
    try {
      await httpsCallable<{ clientUid: string; contactId: string }, unknown>(functions, 'predictContactBehavior')({ clientUid: uid, contactId });
      setOpen(contactId);
    } catch (e) { console.warn('predictContactBehavior failed:', e); setErrKey(predErrKey(e)); }
    finally { setBusy(null); }
  };

  // F3: combină un duplicat (mergeWith[0]) în contactul curent. Listener-ul aduce starea actualizată.
  const merge = async (toId: string, fromId: string) => {
    if (!fromId || !window.confirm(t('admin.contactMergeConfirm'))) return;
    setBusy(toId); setErrKey(null);
    try {
      await httpsCallable<{ clientUid: string; fromId: string; toId: string }, unknown>(functions, 'mergeContacts')({ clientUid: uid, fromId, toId });
    } catch (e) { console.warn('mergeContacts failed:', e); setErrKey(predErrKey(e)); }
    finally { setBusy(null); }
  };

  if (contacts === null) return null;
  // Ascunde tombstone-urile (contacte combinate în altele).
  const visible = contacts.filter(({ data }) => !data.mergedInto);

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <strong style={{ fontSize: 13 }}>👥 {t('admin.contactsTitle')}{visible.length > 0 ? ` (${visible.length})` : ''}</strong>
      <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '2px 0 8px' }}>{t('admin.contactsHint')}</p>
      {errKey && <div role="alert" style={{ fontSize: 12, color: '#c0392b', marginBottom: 6 }}>{t(errKey)}</div>}
      {visible.length === 0 && <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: 0 }}>{t('admin.contactsEmpty')}</p>}
      <div style={{ display: 'grid', gap: 6 }}>
        {visible.map(({ id, data }) => {
          const pr = preds[id];
          const isOpen = open === id;
          const dupId = data.mergeCandidate && data.mergeWith.length > 0 ? data.mergeWith[0] : '';
          return (
            <div key={id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13 }}>{contactDisplay(data) || t('admin.contactAnon')}</strong>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 9px', background: 'var(--bg-0)', color: LIFE_COLOR[data.lifecycle], border: `1px solid ${LIFE_COLOR[data.lifecycle]}` }}>
                  {t(`appHome.ls_${data.lifecycle}`)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{data.rollup.submissions} {t('admin.contactSubmissions')} · {t('admin.contactLast')} {fmtMs(data.rollup.lastSeen, i18n.language)}</span>
                {/* F1: LTV (valoarea realizată din lead-urile câștigate) + campania de achiziție. */}
                {data.rollup.value > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 9px', background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid var(--success)' }}>
                    {t('admin.contactLtv')}: {Math.round(data.rollup.value * 100) / 100} €
                  </span>
                )}
                {data.acquisition.campaign && <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>· {t('admin.contactAcq')}: {data.acquisition.campaign}</span>}
                {dupId && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, borderRadius: 4, padding: '1px 7px', background: '#fff4e5', color: '#b25e09' }}>{t('admin.contactDup')}</span>}
                {pr && <button style={{ ...genBtn, marginLeft: 'auto', padding: '2px 8px' }} onClick={() => setOpen(isOpen ? null : id)}>{isOpen ? '▾' : '▸'} {t('admin.predTitle')}</button>}
                {dupId && <button style={{ ...genBtn, marginLeft: pr ? 0 : 'auto', padding: '4px 10px' }} disabled={busy === id} onClick={() => void merge(id, dupId)}>{t('admin.contactMerge')}</button>}
                <button style={{ ...genBtn, marginLeft: pr || dupId ? 0 : 'auto', padding: '4px 10px' }} disabled={busy === id} onClick={() => void generate(id)}>
                  {busy === id ? t('admin.predBusy') : pr ? t('admin.predRegenerate') : t('admin.predGenerate')}
                </button>
              </div>
              {pr && isOpen && (
                <div style={{ marginTop: 8, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                  {pr.atMs > 0 && <div style={{ fontSize: 11, color: 'var(--fg-1)', marginBottom: 4 }}>{t('admin.predAt')} {fmtMs(pr.atMs, i18n.language)}</div>}
                  <PredictionCard p={pr.p} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
