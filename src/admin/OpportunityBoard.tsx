/**
 * Pasul „Oportunități" — board de canale recomandate de AI pentru un lead (callable aiRecommendChannels).
 * Admin-only. Generează/regenerează, sortează după impact și „Creează cerere" pre-completată din
 * oportunitate (kind=campanie). Cererea apare automat în <LeadRequests> (listener propriu) — fără cuplare.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { REQUEST_SCHEMA, emptyDeliverables } from '../types/request';
import { AD_BUDGETS } from '../types/onboarding';
import { coerceToRecommendedChannels, sortByImpact, type ImpactLevel, type RecommendedChannel } from '../types/recommendation';

const IMPACT_COLOR: Record<ImpactLevel, { bg: string; fg: string }> = {
  ridicat: { bg: '#e8f5ec', fg: '#1e7e34' },
  'mediu-ridicat': { bg: '#e8f0fe', fg: '#2563eb' },
  mediu: { bg: '#fff4e5', fg: '#b25e09' },
  scazut: { bg: '#f1f3f5', fg: '#64748b' },
};
const IMPACT_KEY: Record<ImpactLevel, string> = {
  ridicat: 'admin.oppImpact_ridicat',
  'mediu-ridicat': 'admin.oppImpact_mediuRidicat',
  mediu: 'admin.oppImpact_mediu',
  scazut: 'admin.oppImpact_scazut',
};

export default function OpportunityBoard({ leadId, adminUid, clientUid }: { leadId: string; adminUid: string; clientUid?: string }) {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<RecommendedChannel[] | null>(null);
  const [adBudget, setAdBudget] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; key: string } | null>(null);
  const [sorted, setSorted] = useState(true);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'leads', leadId),
      (snap) => {
        const d = (snap.data() || {}) as Record<string, unknown>;
        const rec = d.channelRecommendations && typeof d.channelRecommendations === 'object'
          ? (d.channelRecommendations as { channels?: unknown }).channels
          : null;
        setChannels(coerceToRecommendedChannels(rec));
        setAdBudget(typeof d.adBudget === 'string' ? d.adBudget : '');
      },
      (err) => {
        console.warn('opportunity board listener:', err);
        setChannels([]);
        setAdBudget('');
      }
    );
  }, [leadId]);

  const view = useMemo(() => (channels ? (sorted ? sortByImpact(channels) : channels) : []), [channels, sorted]);

  const generate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const fn = httpsCallable<{ leadId: string }, { channels?: unknown }>(functions, 'aiRecommendChannels');
      await fn({ leadId });
      setMsg({ kind: 'ok', key: 'admin.oppDone' }); // listener-ul aduce datele live
    } catch (e) {
      const code = String((e as { code?: string }).code ?? '');
      // 'functions/not-found' / 'internal' (preflight) = callable nedeployat → neactivat.
      const key = code.endsWith('not-found') || code.endsWith('internal')
        ? 'admin.oppNotReady'
        : code.endsWith('resource-exhausted')
          ? 'admin.oppQuota'
          : 'admin.oppError';
      console.warn('aiRecommendChannels failed:', e);
      setMsg({ kind: 'err', key });
    } finally {
      setBusy(false);
    }
  };

  const createRequest = async (o: RecommendedChannel) => {
    try {
      await addDoc(collection(db, 'leads', leadId, 'requests'), {
        schema: REQUEST_SCHEMA,
        kind: 'campaign',
        title: o.title.slice(0, 120),
        offer: (o.suggestedOffer || o.description).slice(0, 500),
        budget: adBudget && (AD_BUDGETS as readonly string[]).includes(adBudget) ? t(`onboarding.budget.${adBudget}`) : '',
        objective: o.suggestedObjective || 'leads',
        status: 'open',
        source: 'manual',
        deliverables: emptyDeliverables(),
        clientUid: clientUid || '',
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCreatedKey(o.title);
      setTimeout(() => setCreatedKey((k) => (k === o.title ? null : k)), 2500);
    } catch (e) {
      console.warn('create request from opportunity failed:', e);
      setMsg({ kind: 'err', key: 'admin.oppError' });
    }
  };

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 6, alignContent: 'start' };

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>{t('admin.oppTitle')}</strong>
        {channels && channels.length > 0 && <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>({channels.length})</span>}
        {channels && channels.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--fg-1)' }}>
            <input type="checkbox" checked={sorted} onChange={(e) => setSorted(e.target.checked)} />
            {t('admin.oppSortImpact')}
          </label>
        )}
        <button className="btn" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12 }} disabled={busy} onClick={() => void generate()}>
          {busy ? t('admin.oppBusy') : channels && channels.length > 0 ? t('admin.oppRegenerate') : t('admin.oppGenerate')}
        </button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '0 0 8px' }}>{t('admin.oppHint')}</p>

      {msg && (
        <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ fontSize: 12, marginBottom: 8, color: msg.kind === 'err' ? '#c0392b' : '#1e7e34', background: msg.kind === 'err' ? '#fdf0ef' : '#e8f5ec', border: `1px solid ${msg.kind === 'err' ? '#f0c4c0' : '#b5dcc0'}`, borderRadius: 6, padding: '6px 10px' }}>
          {t(msg.key)}
        </div>
      )}

      {channels === null && <p style={{ color: 'var(--fg-1)', fontSize: 12, margin: 0 }}>…</p>}
      {channels !== null && channels.length === 0 && <p style={{ color: 'var(--fg-1)', fontSize: 12, margin: 0 }}>{t('admin.oppEmpty')}</p>}

      {view.length > 0 && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {view.map((o, i) => {
            const col = IMPACT_COLOR[o.impact];
            return (
              <div key={`${o.title}-${i}`} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, borderRadius: 4, padding: '1px 7px', background: col.bg, color: col.fg }}>
                    {t(IMPACT_KEY[o.impact])}
                  </span>
                  {o.suggestedObjective && <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t(`onboarding.objective.${o.suggestedObjective}`)}</span>}
                </div>
                <strong style={{ fontSize: 13 }}>{o.title || '—'}</strong>
                {o.impactReason && <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{o.impactReason}</span>}
                {o.description && <span style={{ fontSize: 12, color: 'var(--fg-0)' }}>{o.description}</span>}
                <div>
                  <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12, marginTop: 2 }} disabled={createdKey === o.title} onClick={() => void createRequest(o)}>
                    {createdKey === o.title ? t('admin.oppCreated') : t('admin.oppCreateRequest')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
