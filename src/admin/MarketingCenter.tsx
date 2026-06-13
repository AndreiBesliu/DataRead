import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import {
  CAMPAIGN_SCHEMA,
  CAMPAIGN_STATUSES,
  METRIC_SCHEMA,
  PLATFORMS,
  addTotals,
  coerceToCampaign,
  coerceToDailyMetric,
  coerceToInsight,
  emptyTotals,
  kpisFromTotals,
  sumMetrics,
  type AiInsight,
  type CampaignDef,
  type CampaignStatus,
  type DailyMetric,
  type Kpis,
  type Platform,
  type Verdict,
} from '../analytics/kpi';

const VERDICT_KEY: Record<Verdict, string> = { scale: 'admin.verdictScale', maintain: 'admin.verdictMaintain', pause: 'admin.verdictPause', test: 'admin.verdictTest' };
const VERDICT_COLOR: Record<Verdict, string> = { scale: '#1e7e34', maintain: '#2563eb', pause: '#c0392b', test: '#b07b1e' };

const PLATFORM_KEY: Record<Platform, string> = { meta: 'admin.platMeta', google: 'admin.platGoogle', tiktok: 'admin.platTiktok', other: 'admin.platOther' };
const PLATFORM_SHORT: Record<Platform, string> = { meta: 'Meta', google: 'Google', tiktok: 'TikTok', other: 'Alt' };
const PLATFORM_COLOR: Record<Platform, string> = { meta: '#1877f2', google: '#ea4335', tiktok: '#111', other: '#6b7280' };
const STATUS_KEY: Record<CampaignStatus, string> = { active: 'admin.campStatusActive', paused: 'admin.campStatusPaused', ended: 'admin.campStatusEnded' };

const money = (n: number) => `€${n.toLocaleString('ro-RO', { maximumFractionDigits: 2 })}`;
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
const roasFmt = (n: number | null) => (n === null ? '—' : `${n.toFixed(2)}×`);
const moneyOrDash = (n: number | null) => (n === null ? '—' : money(n));

function fmtTs(v: unknown): string {
  try {
    const d = (v as { toDate?: () => Date })?.toDate?.();
    return d ? d.toLocaleDateString('ro-RO') : '';
  } catch {
    return '';
  }
}

interface CampaignRow {
  id: string;
  leadId: string;
  clientName: string;
  data: CampaignDef;
  createdAt: unknown;
  insight: AiInsight | null;
  insightAt: unknown;
}

/** Sparkline SVG pur (determinist) — seria zilnică de cheltuială. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 160;
  const h = 36;
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="var(--accent, #2563eb)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KpiCards({ kpis }: { kpis: Kpis }) {
  const { t } = useTranslation();
  const cells: Array<[string, string, boolean?]> = [
    ['admin.kpiSpend', money(kpis.spend)],
    ['admin.kpiRevenue', money(kpis.revenue)],
    ['admin.kpiRoas', roasFmt(kpis.roas), true],
    ['admin.kpiLeads', String(kpis.leads)],
    ['admin.kpiCpl', moneyOrDash(kpis.cpl)],
    ['admin.kpiCtr', pct(kpis.ctr)],
    ['admin.kpiCpc', moneyOrDash(kpis.cpc)],
    ['admin.kpiCpm', moneyOrDash(kpis.cpm)],
    ['admin.kpiConv', pct(kpis.convRate)],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
      {cells.map(([k, v, hero]) => (
        <div key={k} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 11, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{t(k)}</div>
          <div style={{ fontSize: hero ? 20 : 16, fontWeight: 800, color: hero ? 'var(--accent, #2563eb)' : 'var(--fg-0)' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

const inp: CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-1)' };

/** Editorul de metrici al unei campanii — intrare manuală pe zi (upsert pe dată), KPI live, CSV
 *  + AI Optimization Engine (recomandare scale/maintain/pause/test pe baza cifrelor reale). */
function CampaignDetail({ campaignId, insight, insightAt }: { campaignId: string; currency: string; insight: AiInsight | null; insightAt: unknown }) {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<DailyMetric[] | null>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), spend: '', impressions: '', clicks: '', leads: '', revenue: '' });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const analyze = async () => {
    setAiBusy(true);
    setAiErr(null);
    try {
      const fn = httpsCallable<{ campaignId: string }, { insight?: AiInsight }>(functions, 'aiAnalyzeCampaign');
      await fn({ campaignId });
      // Documentul campaniei e actualizat de functions → onSnapshot din părinte aduce insight-ul nou.
    } catch (e) {
      const code = String((e as { code?: string }).code ?? '');
      setAiErr(
        code.endsWith('failed-precondition') ? 'admin.aiNoData'
          : code.endsWith('not-found') || code.endsWith('internal') ? 'admin.aiNotReady'
          : 'admin.aiAnalyzeError'
      );
    } finally {
      setAiBusy(false);
    }
  };

  const load = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'campaigns', campaignId, 'metrics'), orderBy('date', 'asc')));
      setMetrics(snap.docs.map((d) => coerceToDailyMetric(d.data())).filter((x): x is DailyMetric => x !== null));
    } catch (e) {
      console.warn('metrics load failed:', e);
      setMetrics([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const recomputeTotals = async () => {
    const snap = await getDocs(collection(db, 'campaigns', campaignId, 'metrics'));
    const all = snap.docs.map((d) => coerceToDailyMetric(d.data())).filter((x): x is DailyMetric => x !== null);
    await updateDoc(doc(db, 'campaigns', campaignId), { totals: sumMetrics(all), updatedAt: serverTimestamp() });
  };

  const numOf = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const saveDay = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return;
    setSaveState('saving');
    try {
      await setDoc(doc(db, 'campaigns', campaignId, 'metrics', form.date), {
        schema: METRIC_SCHEMA,
        date: form.date,
        spend: numOf(form.spend),
        impressions: Math.round(numOf(form.impressions)),
        clicks: Math.round(numOf(form.clicks)),
        leads: Math.round(numOf(form.leads)),
        revenue: numOf(form.revenue),
        source: 'manual',
        updatedAt: serverTimestamp(),
      });
      await recomputeTotals();
      await load();
      setForm((f) => ({ ...f, spend: '', impressions: '', clicks: '', leads: '', revenue: '' }));
      setSaveState('saved');
    } catch (e) {
      console.warn('metric save failed:', e);
      setSaveState('idle');
    }
  };

  const deleteDay = async (date: string) => {
    try {
      await deleteDoc(doc(db, 'campaigns', campaignId, 'metrics', date));
      await recomputeTotals();
      await load();
    } catch (e) {
      console.warn('metric delete failed:', e);
    }
  };

  const editDay = (m: DailyMetric) =>
    setForm({ date: m.date, spend: String(m.spend), impressions: String(m.impressions), clicks: String(m.clicks), leads: String(m.leads), revenue: String(m.revenue) });

  const exportCsv = () => {
    const rows = (metrics ?? []).map((m) => [m.date, m.spend, m.impressions, m.clicks, m.leads, m.revenue].join(';'));
    const csv = '﻿' + ['data;spend;impressions;clicks;leads;revenue', ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `campanie-${campaignId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpis = useMemo(() => kpisFromTotals(sumMetrics(metrics ?? [])), [metrics]);
  const td: CSSProperties = { padding: '5px 8px', borderBottom: '1px solid var(--border)', fontSize: 13, textAlign: 'right' };
  const tdL: CSSProperties = { ...td, textAlign: 'left' };

  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 14 }}>
      <KpiCards kpis={kpis} />

      {/* AI Optimization Engine: buton + cardul recomandării. */}
      <div>
        <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }} disabled={aiBusy} onClick={() => void analyze()}>
          {aiBusy ? t('admin.aiAnalyzeBusy') : t('admin.aiAnalyze')}
        </button>
        {aiErr && <span role="alert" style={{ marginLeft: 10, fontSize: 12, color: '#c0392b' }}>{t(aiErr)}</span>}
      </div>
      {insight && (
        <div style={{ border: `1px solid ${VERDICT_COLOR[insight.verdict]}`, borderLeft: `4px solid ${VERDICT_COLOR[insight.verdict]}`, borderRadius: 8, padding: '12px 14px', background: 'var(--bg-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ background: VERDICT_COLOR[insight.verdict], color: '#fff', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, borderRadius: 5, padding: '2px 10px' }}>
              {t(VERDICT_KEY[insight.verdict])}
            </span>
            <strong style={{ fontSize: 14 }}>{insight.headline}</strong>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.aiInsightAt')} {fmtTs(insightAt)}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--fg-1)', margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{insight.reasoning}</p>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{insight.actions}</div>
        </div>
      )}

      {metrics && metrics.length >= 2 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-1)', marginBottom: 2 }}>{t('admin.kpiSpend')} / {t('admin.metricDate').toLowerCase()}</div>
          <Sparkline values={metrics.map((m) => m.spend)} />
        </div>
      )}

      {/* Formular zi (upsert pe dată — aceeași cheie pe care o vor folosi conectorii API). */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{t('admin.metricsTitle')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 8, alignItems: 'end' }}>
          <label style={{ fontSize: 11, fontWeight: 600 }}>{t('admin.metricDate')}<input style={inp} type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></label>
          <label style={{ fontSize: 11, fontWeight: 600 }}>{t('admin.kpiSpend')} €<input style={inp} inputMode="decimal" value={form.spend} onChange={(e) => setForm((f) => ({ ...f, spend: e.target.value }))} /></label>
          <label style={{ fontSize: 11, fontWeight: 600 }}>{t('admin.kpiImpressions')}<input style={inp} inputMode="numeric" value={form.impressions} onChange={(e) => setForm((f) => ({ ...f, impressions: e.target.value }))} /></label>
          <label style={{ fontSize: 11, fontWeight: 600 }}>{t('admin.kpiClicks')}<input style={inp} inputMode="numeric" value={form.clicks} onChange={(e) => setForm((f) => ({ ...f, clicks: e.target.value }))} /></label>
          <label style={{ fontSize: 11, fontWeight: 600 }}>{t('admin.kpiLeads')}<input style={inp} inputMode="numeric" value={form.leads} onChange={(e) => setForm((f) => ({ ...f, leads: e.target.value }))} /></label>
          <label style={{ fontSize: 11, fontWeight: 600 }}>{t('admin.kpiRevenue')} €<input style={inp} inputMode="decimal" value={form.revenue} onChange={(e) => setForm((f) => ({ ...f, revenue: e.target.value }))} /></label>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 8, padding: '6px 16px', fontSize: 12 }} disabled={saveState === 'saving'} onClick={() => void saveDay()}>
          {saveState === 'saving' ? t('admin.metricSaving') : saveState === 'saved' ? t('admin.metricSaved') : t('admin.metricSave')}
        </button>
      </div>

      {metrics !== null && metrics.length === 0 && <p style={{ color: 'var(--fg-1)', fontSize: 13, margin: 0 }}>{t('admin.metricEmpty')}</p>}
      {metrics !== null && metrics.length > 0 && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px' }}>
            <button className="btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={exportCsv}>⬇ {t('admin.metricExport')}</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-0)' }}>
                <th style={tdL}>{t('admin.metricDate')}</th>
                <th style={td}>{t('admin.kpiSpend')}</th>
                <th style={td}>{t('admin.kpiImpressions')}</th>
                <th style={td}>{t('admin.kpiClicks')}</th>
                <th style={td}>{t('admin.kpiLeads')}</th>
                <th style={td}>{t('admin.kpiRevenue')}</th>
                <th style={td}>{t('admin.kpiRoas')}</th>
                <th style={td}></th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const r = m.spend > 0 ? m.revenue / m.spend : null;
                return (
                  <tr key={m.date}>
                    <td style={tdL}>{m.date}</td>
                    <td style={td}>{money(m.spend)}</td>
                    <td style={td}>{m.impressions.toLocaleString('ro-RO')}</td>
                    <td style={td}>{m.clicks.toLocaleString('ro-RO')}</td>
                    <td style={td}>{m.leads}</td>
                    <td style={td}>{money(m.revenue)}</td>
                    <td style={{ ...td, fontWeight: 700, color: r !== null && r >= 1 ? '#1e7e34' : 'var(--fg-1)' }}>{roasFmt(r)}</td>
                    <td style={td}>
                      <button className="btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => editDay(m)}>✎</button>{' '}
                      <button className="btn" style={{ padding: '2px 8px', fontSize: 11, color: '#c0392b' }} onClick={() => void deleteDay(m.date)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Panoul Marketing Center — campaniile tuturor clienților, agregat + drill-down per campanie. */
export default function MarketingCenter({ leads }: { leads: Array<{ id: string; label: string }> }) {
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newC, setNewC] = useState({ leadId: '', name: '', platform: 'meta' as Platform });
  const [formError, setFormError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const out: CampaignRow[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          const data = coerceToCampaign(raw);
          if (data) out.push({ id: d.id, leadId: typeof raw.leadId === 'string' ? raw.leadId : '', clientName: typeof raw.clientName === 'string' ? raw.clientName : '', data, createdAt: raw.createdAt, insight: coerceToInsight(raw.aiInsight), insightAt: raw.aiInsightAt });
        });
        setCampaigns(out);
      },
      (err) => {
        console.warn('campaigns listener:', err);
        setCampaigns([]);
      }
    );
  }, []);

  const create = async () => {
    if (!newC.name.trim() || !newC.leadId) {
      setFormError(true);
      return;
    }
    const client = leads.find((l) => l.id === newC.leadId);
    try {
      await addDoc(collection(db, 'campaigns'), {
        schema: CAMPAIGN_SCHEMA,
        name: newC.name.trim().slice(0, 120),
        platform: newC.platform,
        status: 'active',
        currency: 'EUR',
        externalId: '',
        leadId: newC.leadId,
        clientName: client?.label ?? '',
        totals: emptyTotals(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCreating(false);
      setNewC({ leadId: '', name: '', platform: 'meta' });
      setFormError(false);
    } catch (e) {
      console.warn('campaign create failed:', e);
    }
  };

  const setStatus = async (id: string, status: CampaignStatus) => {
    try {
      await updateDoc(doc(db, 'campaigns', id), { status, updatedAt: serverTimestamp() });
    } catch (e) {
      console.warn('campaign status failed:', e);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!window.confirm(t('admin.campDeleteConfirm'))) return;
    try {
      const metrics = await getDocs(collection(db, 'campaigns', id, 'metrics'));
      await Promise.all(metrics.docs.map((m) => deleteDoc(m.ref)));
      await deleteDoc(doc(db, 'campaigns', id));
      if (openId === id) setOpenId(null);
    } catch (e) {
      console.warn('campaign delete failed:', e);
    }
  };

  const q = search.trim().toLowerCase();
  const visible = (campaigns ?? []).filter(
    (c) =>
      (platformFilter === 'all' || c.data.platform === platformFilter) &&
      (statusFilter === 'all' || c.data.status === statusFilter) &&
      (!q || `${c.data.name} ${c.clientName}`.toLowerCase().includes(q))
  );
  const aggregate = kpisFromTotals(addTotals(visible.map((c) => c.data.totals)));

  const chipSel: CSSProperties = { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--bg-1)' };
  const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 14, textAlign: 'left' };

  if (leads.length === 0) {
    return (
      <div>
        <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>{t('admin.mcTitle')}</h2>
        <p style={{ color: 'var(--fg-1)' }}>{t('admin.mcNoLeads')}</p>
      </div>
    );
  }

  return (
    <div data-page="marketing-center">
      <h2 style={{ fontSize: 20, margin: '0 0 2px' }}>{t('admin.mcTitle')}</h2>
      <p style={{ color: 'var(--fg-1)', fontSize: 14, marginTop: 0 }}>{t('admin.mcSubtitle')}</p>
      <div style={{ fontSize: 12, color: 'var(--fg-1)', background: 'var(--bg-1)', border: '1px dashed var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
        ℹ️ {t('admin.apiSoon')}
      </div>

      {/* Agregatul pe campaniile filtrate. */}
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--fg-1)' }}>{t('admin.mcAggregate')} ({visible.length})</div>
      <div style={{ marginBottom: 20 }}>
        <KpiCards kpis={aggregate} />
      </div>

      {/* Filtre + creare. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.mcSearch')} style={{ ...chipSel, flex: '1 1 240px' }} />
        <select style={chipSel} value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as 'all' | Platform)}>
          <option value="all">{t('admin.mcAllPlatforms')}</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{t(PLATFORM_KEY[p])}</option>)}
        </select>
        <select style={chipSel} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | CampaignStatus)}>
          <option value="all">{t('admin.mcAllStatuses')}</option>
          {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_KEY[s])}</option>)}
        </select>
        {!creating && <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => setCreating(true)}>{t('admin.campNew')}</button>}
      </div>

      {creating && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'grid', gap: 3 }}>{t('admin.mcClient')}
              <select style={chipSel} value={newC.leadId} onChange={(e) => setNewC((c) => ({ ...c, leadId: e.target.value }))}>
                <option value="">{t('admin.mcPickClient')}</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'grid', gap: 3 }}>{t('admin.campName')}
              <input style={chipSel} value={newC.name} maxLength={120} placeholder={t('admin.campNamePh')} onChange={(e) => setNewC((c) => ({ ...c, name: e.target.value }))} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'grid', gap: 3 }}>{t('admin.campPlatform')}
              <select style={chipSel} value={newC.platform} onChange={(e) => setNewC((c) => ({ ...c, platform: e.target.value as Platform }))}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{t(PLATFORM_KEY[p])}</option>)}
              </select>
            </label>
          </div>
          {formError && <div role="alert" style={{ color: '#c0392b', fontSize: 12 }}>{t('admin.campRequired')}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12 }} onClick={() => void create()}>{t('admin.campCreate')}</button>
            <button className="btn" style={{ padding: '6px 16px', fontSize: 12 }} onClick={() => { setCreating(false); setFormError(false); }}>{t('admin.reqCancel')}</button>
          </div>
        </div>
      )}

      {campaigns === null && <p style={{ color: 'var(--fg-1)' }}>…</p>}
      {campaigns !== null && visible.length === 0 && <p style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.campEmpty')}</p>}

      {visible.length > 0 && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-0)' }}>
                <th style={td}>{t('admin.campName')}</th>
                <th style={td}>{t('admin.mcClient')}</th>
                <th style={td}>{t('admin.campPlatform')}</th>
                <th style={{ ...td, textAlign: 'right' }}>{t('admin.kpiSpend')}</th>
                <th style={{ ...td, textAlign: 'right' }}>{t('admin.kpiRoas')}</th>
                <th style={{ ...td, textAlign: 'right' }}>{t('admin.kpiCpl')}</th>
                <th style={td}>{t('admin.campStatus')}</th>
                <th style={td}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const k = kpisFromTotals(c.data.totals);
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td style={{ ...td, fontWeight: 600 }}>{c.data.name}</td>
                      <td style={td}>{c.clientName || '—'}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: PLATFORM_COLOR[c.data.platform], borderRadius: 4, padding: '1px 7px' }}>{PLATFORM_SHORT[c.data.platform]}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{money(k.spend)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: k.roas !== null && k.roas >= 1 ? '#1e7e34' : 'var(--fg-1)' }}>{roasFmt(k.roas)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{moneyOrDash(k.cpl)}</td>
                      <td style={td}>
                        <select value={c.data.status} onChange={(e) => void setStatus(c.id, e.target.value as CampaignStatus)} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', fontSize: 12, background: 'var(--bg-1)' }}>
                          {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_KEY[s])}</option>)}
                        </select>
                      </td>
                      <td style={td}>
                        <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                          {openId === c.id ? t('admin.hideDetail') : t('admin.viewDetail')}
                        </button>
                      </td>
                    </tr>
                    {openId === c.id && (
                      <tr>
                        <td style={{ ...td, background: 'var(--bg-0)' }} colSpan={8}>
                          <CampaignDetail campaignId={c.id} currency={c.data.currency} insight={c.insight} insightAt={c.insightAt} />
                          <div style={{ marginTop: 12, textAlign: 'right' }}>
                            <button className="btn" style={{ padding: '4px 12px', fontSize: 12, color: '#c0392b' }} onClick={() => void deleteCampaign(c.id)}>{t('admin.campDelete')}</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
