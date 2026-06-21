/**
 * Tab „Sugestii" — next-step proactiv pentru operator, derivat din date DEJA generate (lead-uri netratate,
 * campanii cu verdict AI de acțiune, lead-uri cu campanii fără raport luna curentă). Logica = `buildSuggestions`
 * (pură, testată); aici doar normalizăm snapshot-urile leads+campaigns și randăm lista. NU generează AI.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { buildSuggestions, type SuggestionCampaign, type SuggestionLead, type SuggestionSeverity } from './suggestions';

function tsMs(v: unknown): number {
  const t = v as { toMillis?: () => number } | null;
  try {
    return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
  } catch {
    return 0;
  }
}

const SEV_COLOR: Record<SuggestionSeverity, { bg: string; fg: string }> = {
  high: { bg: '#fdecea', fg: '#c0392b' },
  medium: { bg: '#fff4e5', fg: '#b25e09' },
  low: { bg: '#eef4ff', fg: '#2563eb' },
};

export default function SuggestionsPanel({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<SuggestionLead[]>([]);
  const [camps, setCamps] = useState<SuggestionCampaign[]>([]);
  // verdict/headline-ul AI stă în colecția admin-only `campaignInsights` (NU pe documentul campaniei,
  // citibil de client) → listener separat, indexat pe id-ul campaniei, îmbinat în useMemo.
  const [insights, setInsights] = useState<Map<string, { verdict: string; headline: string }>>(new Map());

  useEffect(() => {
    const offL = onSnapshot(
      query(collection(db, 'leads'), orderBy('createdAt', 'desc'), limit(200)),
      (snap) => setLeads(snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          companyName: typeof x.companyName === 'string' ? x.companyName : '',
          status: typeof x.status === 'string' ? x.status : 'new',
          createdAtMs: tsMs(x.createdAt),
          reportAtMs: tsMs(x.marketingReportAt),
          clientUid: typeof x.clientUid === 'string' ? x.clientUid : '',
          nextFollowUp: typeof x.nextFollowUp === 'string' ? x.nextFollowUp : '',
        };
      })),
      () => setLeads([])
    );
    const offC = onSnapshot(
      query(collection(db, 'campaigns'), limit(300)),
      (snap) => setCamps(snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          name: typeof x.name === 'string' ? x.name : '',
          leadId: typeof x.leadId === 'string' ? x.leadId : '',
          clientName: typeof x.clientName === 'string' ? x.clientName : '',
          verdict: '',
          headline: '',
        };
      })),
      () => setCamps([])
    );
    const offI = onSnapshot(
      collection(db, 'campaignInsights'),
      (snap) => {
        const m = new Map<string, { verdict: string; headline: string }>();
        snap.forEach((d) => {
          const x = d.data();
          m.set(d.id, {
            verdict: typeof x.verdict === 'string' ? x.verdict : '',
            headline: typeof x.headline === 'string' ? x.headline : '',
          });
        });
        setInsights(m);
      },
      () => setInsights(new Map())
    );
    return () => { offL(); offC(); offI(); };
  }, []);

  const suggestions = useMemo(() => {
    const enriched = camps.map((c) => {
      const ins = insights.get(c.id);
      return ins ? { ...c, verdict: ins.verdict, headline: ins.headline } : c;
    });
    return buildSuggestions({ leads, campaigns: enriched, nowMs: Date.now() });
  }, [leads, camps, insights]);

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>{t('admin.sugTitle')}</h2>
        {suggestions.length > 0 ? <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>({suggestions.length})</span> : null}
      </div>
      <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '0 0 14px' }}>{t('admin.sugHint')}</p>

      {suggestions.length === 0 ? (
        <p style={{ color: 'var(--fg-1)' }}>{t('admin.sugEmpty')}</p>
      ) : (
        suggestions.map((s) => {
          const col = SEV_COLOR[s.severity] || SEV_COLOR.low;
          return (
            <div key={s.id} style={card}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, borderRadius: 4, padding: '2px 8px', background: col.bg, color: col.fg, whiteSpace: 'nowrap' }}>
                {t(`admin.sugSeverity_${s.severity}`)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t(s.titleKey, s.params)}</div>
                {s.detail ? <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{s.detail}</div> : null}
              </div>
              <button className="btn" style={{ padding: '5px 12px', fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => onNavigate(s.view)}>
                {t('admin.sugOpen')}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
