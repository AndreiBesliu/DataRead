/**
 * Dashboard de trafic per Landing Page — „nexus-ul de date". Citește DOAR rollup-urile zilnice
 * (landingPages/{slug}/stats/{YYYY-MM-DD}) + submission-urile; agregare prin motorul pur lpStats.ts.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { coerceToLpStatsDay, lpKpis, sumLpStats, topEntries, type LpStatsDay } from '../analytics/lpStats';
import { coerceToLpVariant, variantConvRate, type LpVariant } from '../types/lpAttribution';

interface SubRow {
  id: string;
  values: Record<string, string>;
  createdAt: { toDate?: () => Date } | null;
}

export default function LpAnalytics({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const [days, setDays] = useState<LpStatsDay[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [variants, setVariants] = useState<LpVariant[]>([]);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [statsSnap, subsSnap, varSnap] = await Promise.all([
          getDocs(query(collection(db, 'landingPages', slug, 'stats'), orderBy('date', 'desc'), limit(120))),
          getDocs(query(collection(db, 'landingPages', slug, 'submissions'), orderBy('createdAt', 'desc'), limit(200))),
          getDocs(collection(db, 'landingPages', slug, 'variants')),
        ]);
        if (cancel) return;
        setDays(statsSnap.docs.map((d) => coerceToLpStatsDay(d.data())).filter((x): x is LpStatsDay => !!x));
        setSubs(subsSnap.docs.map((d) => ({ id: d.id, values: (d.data().values || {}) as Record<string, string>, createdAt: (d.data().createdAt as SubRow['createdAt']) || null })));
        setVariants(varSnap.docs.map((d) => coerceToLpVariant(d.id, d.data())).sort((a, b) => b.visits - a.visits));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [slug]);

  const windowDays = useMemo(() => [...days].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-range), [days, range]);
  const totals = useMemo(() => sumLpStats(windowDays), [windowDays]);
  const k = lpKpis(totals);

  const fmtN = (n: number) => n.toLocaleString('ro-RO');
  const fmtPct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
  const fmtSec = (n: number | null) => (n === null ? '—' : `${Math.round(n)}s`);

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', minWidth: 120 };
  const kpiVal: CSSProperties = { fontSize: 22, fontWeight: 800, color: 'var(--fg-0)' };
  const kpiLabel: CSSProperties = { fontSize: 11, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.4 };
  const td: CSSProperties = { padding: '5px 8px', borderBottom: '1px solid var(--border)', fontSize: 13, textAlign: 'left' };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '5px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };

  // Sparkline vizite (cronologic).
  const spark = useMemo(() => {
    const vals = windowDays.map((d) => d.visits);
    if (vals.length < 2) return '';
    const max = Math.max(...vals, 1);
    const w = 240;
    const h = 40;
    return vals
      .map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * h}`)
      .join(' ');
  }, [windowDays]);

  const subKeys = useMemo(() => {
    const set = new Set<string>();
    subs.forEach((s) => Object.keys(s.values).forEach((kk) => set.add(kk)));
    return [...set].slice(0, 12);
  }, [subs]);

  function exportCsv() {
    const header = ['data', ...subKeys];
    const rows = subs.map((s) => {
      const dt = s.createdAt?.toDate ? s.createdAt.toDate().toISOString() : '';
      return [dt, ...subKeys.map((kk) => (s.values[kk] || '').replace(/"/g, '""'))];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `lp-${slug}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const Breakdown = ({ titleKey, map }: { titleKey: string; map: Record<string, number> }) => {
    const rows = topEntries(map, 8);
    return (
      <div style={{ ...card, flex: '1 1 200px' }}>
        <div style={{ ...kpiLabel, marginBottom: 6 }}>{t(titleKey)}</div>
        {rows.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>—</div>
        ) : (
          rows.map(([key, n]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
              <span style={{ color: 'var(--fg-0)' }}>{key}</span>
              <span style={{ color: 'var(--fg-1)' }}>{fmtN(n)}</span>
            </div>
          ))
        )}
      </div>
    );
  };

  if (loading) return <p style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.lpStudio.anLoading')}</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[7, 30, 90].map((r) => (
          <button key={r} onClick={() => setRange(r)} style={{ ...btn, background: range === r ? 'var(--accent)' : 'var(--bg-0)', color: range === r ? 'var(--accent-contrast)' : 'var(--fg-1)', border: range === r ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            {t(`admin.lpStudio.anRange${r}`)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={card}><div style={kpiVal}>{fmtN(k.visits)}</div><div style={kpiLabel}>{t('admin.lpStudio.anVisits')}</div></div>
        <div style={card}><div style={kpiVal}>{fmtN(k.submissions)}</div><div style={kpiLabel}>{t('admin.lpStudio.anSubmissions')}</div></div>
        <div style={card}><div style={kpiVal}>{fmtPct(k.convRate)}</div><div style={kpiLabel}>{t('admin.lpStudio.anConvRate')}</div></div>
        <div style={card}><div style={kpiVal}>{fmtPct(k.ctaRate)}</div><div style={kpiLabel}>{t('admin.lpStudio.anCtaRate')}</div></div>
        <div style={card}><div style={kpiVal}>{fmtPct(k.engagementRate)}</div><div style={kpiLabel}>{t('admin.lpStudio.anEngagement')}</div></div>
        <div style={card}><div style={kpiVal}>{fmtSec(k.avgTimeSec)}</div><div style={kpiLabel}>{t('admin.lpStudio.anAvgTime')}</div></div>
        <div style={card}><div style={kpiVal}>{k.avgScrollPct === null ? '—' : `${Math.round(k.avgScrollPct)}%`}</div><div style={kpiLabel}>{t('admin.lpStudio.anAvgScroll')}</div></div>
      </div>

      {spark ? (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ ...kpiLabel, marginBottom: 6 }}>{t('admin.lpStudio.anVisitsTrend')}</div>
          <svg viewBox="0 0 240 40" width="100%" height="40" preserveAspectRatio="none">
            <polyline points={spark} fill="none" stroke="var(--accent)" strokeWidth="2" />
          </svg>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <Breakdown titleKey="admin.lpStudio.anSources" map={totals.bySource} />
        <Breakdown titleKey="admin.lpStudio.anMedium" map={totals.byMedium} />
        <Breakdown titleKey="admin.lpStudio.anReferrers" map={totals.byReferrerHost} />
        <Breakdown titleKey="admin.lpStudio.anCountries" map={totals.byCountry} />
        <Breakdown titleKey="admin.lpStudio.anDevices" map={totals.byDevice} />
      </div>

      <h3 style={{ fontSize: 15, margin: '4px 0 8px' }}>{t('admin.lpStudio.anVariants')} ({variants.length})</h3>
      {variants.length === 0 ? (
        <p style={{ color: 'var(--fg-1)', fontSize: 13, marginBottom: 18 }}>{t('admin.lpStudio.anNoVariants')}</p>
      ) : (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto', marginBottom: 18 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-0)' }}>
                <th style={td}>{t('admin.lpStudio.lbPlatform')}</th>
                <th style={td}>{t('admin.lpStudio.lbMedium')}</th>
                <th style={td}>{t('admin.lpStudio.lbCampaign')}</th>
                <th style={td}>{t('admin.lpStudio.lbContent')}</th>
                <th style={{ ...td, textAlign: 'right' }}>{t('admin.lpStudio.anVisits')}</th>
                <th style={{ ...td, textAlign: 'right' }}>{t('admin.lpStudio.anSubmissions')}</th>
                <th style={{ ...td, textAlign: 'right' }}>{t('admin.lpStudio.anConvRate')}</th>
                <th style={{ ...td, textAlign: 'right' }}>{t('admin.lpStudio.anEngagement')}</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const label = (s: string) => (s === '__direct' ? t('admin.lpStudio.anDirect') : s === '__other' ? t('admin.lpStudio.anOther') : null);
                const lab = label(v.key);
                const eng = v.visits > 0 ? v.engaged / v.visits : null;
                const cell = (x: string) => (lab ? '—' : (x && x !== '-' ? x : '—'));
                return (
                  <tr key={v.key}>
                    <td style={td}>{lab ? <strong style={{ color: 'var(--fg-1)' }}>{lab}</strong> : cell(v.source)}</td>
                    <td style={td}>{cell(v.medium)}</td>
                    <td style={td}>{cell(v.campaign)}</td>
                    <td style={td}>{cell(v.content)}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtN(v.visits)}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtN(v.submissions)}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--fg-1)' }}>{fmtPct(variantConvRate(v))}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--fg-1)' }}>{fmtPct(eng)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>{t('admin.lpStudio.anSubmissionsList')} ({subs.length})</h3>
        {subs.length > 0 ? <button onClick={exportCsv} style={{ ...btn, marginLeft: 'auto' }}>{t('admin.lpStudio.anExport')}</button> : null}
      </div>
      {subs.length === 0 ? (
        <p style={{ color: 'var(--fg-1)', fontSize: 13 }}>{t('admin.lpStudio.anNoSubmissions')}</p>
      ) : (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-0)' }}>
                <th style={td}>{t('admin.lpStudio.anDate')}</th>
                {subKeys.map((kk) => <th key={kk} style={td}>{kk}</th>)}
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--fg-1)', fontSize: 12 }}>{s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString('ro-RO') : '—'}</td>
                  {subKeys.map((kk) => <td key={kk} style={td}>{s.values[kk] || ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
