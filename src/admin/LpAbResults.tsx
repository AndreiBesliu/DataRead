/**
 * Panou de rezultate A/B (în LpAnalytics). Citește experimentele de pe doc-ul LP + contoarele
 * `landingPages/{slug}/abStats/{expId__armId}`, calculează verdictul cu motorul PUR `pickAbWinner` (z-test) și
 * permite „Promovează câștigătorul" (DOAR când verdictul e statistic — anti-peeking). Promovarea scrie
 * `experiment.winnerArm` + `status:'stopped'` pe doc → serveLp servește 100% acea variantă.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, getDocs, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { pickAbWinner, type AbVerdict } from '../analytics/lpABWinner';
import { coerceToLandingPage, type LpExperiment } from '../types/landingPage';

interface ExpView { exp: LpExperiment; verdict: AbVerdict }

export default function LpAbResults({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const [experiments, setExperiments] = useState<LpExperiment[]>([]);
  const [counts, setCounts] = useState<Record<string, { visits: number; submissions: number }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [docSnap, abSnap] = await Promise.all([
        getDoc(doc(db, 'landingPages', slug)),
        getDocs(collection(db, 'landingPages', slug, 'abStats')),
      ]);
      setExperiments(docSnap.exists() ? coerceToLandingPage(docSnap.data()).experiments : []);
      const c: Record<string, { visits: number; submissions: number }> = {};
      abSnap.docs.forEach((d) => {
        const x = d.data();
        c[d.id] = { visits: typeof x.visits === 'number' ? x.visits : 0, submissions: typeof x.submissions === 'number' ? x.submissions : 0 };
      });
      setCounts(c);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  const promote = async (expId: string, armId: string) => {
    setBusy(expId);
    try {
      const next = experiments.map((e) => (e.id === expId ? { ...e, winnerArm: armId, status: 'stopped' as const } : e));
      await updateDoc(doc(db, 'landingPages', slug), { experiments: next, updatedAt: serverTimestamp() });
      setExperiments(next);
    } catch (e) {
      console.warn('promote winner failed:', e);
    } finally {
      setBusy('');
    }
  };

  if (loading || experiments.length === 0) return null;

  const views: ExpView[] = experiments.map((exp) => ({
    exp,
    verdict: pickAbWinner(
      exp.arms.map((a) => ({ id: a.id, label: a.label || a.id, visits: counts[exp.id + '__' + a.id]?.visits || 0, submissions: counts[exp.id + '__' + a.id]?.submissions || 0 })),
      { minSamplePerArm: exp.minSample }
    ),
  }));

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 14 };
  const td: CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, textAlign: 'right' };
  const tdL: CSSProperties = { ...td, textAlign: 'left' };
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const verdictColor = (s: AbVerdict['status']) => (s === 'winner' ? '#1e7e34' : s === 'no-difference' ? '#b07b1e' : 'var(--fg-1)');

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>🧪 {t('admin.lpStudio.abResultsTitle')}</h3>
      {views.map(({ exp, verdict }) => (
        <div key={exp.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>{exp.name || exp.id}</strong>
            <span style={{ fontSize: 11, color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 8px' }}>{t('admin.lpStudio.abStatus_' + exp.status)}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: verdictColor(verdict.status) }}>
              {t('admin.lpStudio.abVerdict_' + (verdict.status === 'no-difference' ? 'noDifference' : verdict.status))}
              {verdict.pValue !== null ? ` · p=${verdict.pValue.toFixed(3)}` : ''}
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-0)' }}>
                <th style={tdL}>{t('admin.lpStudio.abColArm')}</th>
                <th style={td}>{t('admin.lpStudio.abColVisits')}</th>
                <th style={td}>{t('admin.lpStudio.abColSubmissions')}</th>
                <th style={td}>{t('admin.lpStudio.abColConv')}</th>
                <th style={td}></th>
              </tr>
            </thead>
            <tbody>
              {verdict.arms.map((a) => (
                <tr key={a.id}>
                  <td style={tdL}>
                    <span style={{ fontWeight: 700 }}>{a.label}</span>
                    {verdict.winnerId === a.id ? <span style={{ marginLeft: 6, color: '#1e7e34' }}>⭐</span> : null}
                    {exp.winnerArm === a.id ? <span style={{ marginLeft: 6, fontSize: 11, color: '#1e7e34' }}>({t('admin.lpStudio.abServedNow')})</span> : null}
                  </td>
                  <td style={td}>{a.visits.toLocaleString('ro-RO')}</td>
                  <td style={td}>{a.submissions.toLocaleString('ro-RO')}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{pct(a.convRate)}</td>
                  <td style={td}>
                    {verdict.status === 'winner' && verdict.winnerId === a.id && exp.winnerArm !== a.id ? (
                      <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: 11 }} disabled={busy === exp.id} onClick={() => void promote(exp.id, a.id)}>
                        {t('admin.lpStudio.abPromote')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {verdict.status === 'insufficient' ? <p style={{ fontSize: 11, color: 'var(--fg-1)', margin: '6px 0 0' }}>{t('admin.lpStudio.abInsufficientHint', { n: exp.minSample })}</p> : null}
        </div>
      ))}
    </div>
  );
}
