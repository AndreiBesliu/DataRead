import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { composePrintHtml, printHtmlDoc, printTitle } from '../utils/printDoc';
import { parseMetricsCsv } from '../utils/metricsCsv';
import { toCsv } from '../utils/csv';
import PlatformConnect from './PlatformConnect';
import {
  CAMPAIGN_SCHEMA,
  CAMPAIGN_STATUSES,
  METRIC_SCHEMA,
  PLATFORMS,
  addTotals,
  coerceToCampaign,
  coerceToDailyMetric,
  coerceToInsight,
  coerceToReport,
  emptyTotals,
  kpisByPlatform,
  kpisFromTotals,
  sumMetrics,
  type AiInsight,
  type ClientReport,
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

/** Defalcare KPI pe platformă (Meta/Google/TikTok side-by-side) — imaginea centralizată a unui client/portofoliu
 *  care rulează pe mai multe platforme. Agnostică de sursa datelor (manual/CSV/API). Ascunsă dacă e o singură
 *  platformă (agregatul de deasupra o arată deja). */
function PlatformBreakdown({ items, title }: { items: CampaignDef[]; title?: string }) {
  const { t } = useTranslation();
  const rows = kpisByPlatform(items);
  if (rows.length <= 1) return null;
  const td: CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, textAlign: 'right' };
  const tdL: CSSProperties = { ...td, textAlign: 'left' };

  // Export imagine consolidată multi-platformă (deliverable client). CSV = valori brute (utilizabile în Excel);
  // PDF = o linie per platformă (text, brandat). Ambele folosesc utilitarele existente (toCsv / composePrintHtml).
  const exportCsv = () => {
    const header = ['platforma', 'campanii', 'spend', 'revenue', 'roas', 'leads', 'cpl'];
    const data = rows.map((r) => [PLATFORM_SHORT[r.platform], r.campaigns, r.kpis.spend, r.kpis.revenue, r.kpis.roas ?? '', r.kpis.leads, r.kpis.cpl ?? '']);
    const csv = '﻿' + toCsv([header, ...data]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `platforme-${(title || 'total').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportPdf = () => {
    const lines = rows
      .map((r) => `${PLATFORM_SHORT[r.platform]} — ${r.campaigns} ${t('admin.campaignsCol').toLowerCase()} · ${t('admin.kpiSpend')} ${money(r.kpis.spend)} · ${t('admin.kpiRevenue')} ${money(r.kpis.revenue)} · ROAS ${roasFmt(r.kpis.roas)} · ${t('admin.kpiLeads')} ${r.kpis.leads} · ${t('admin.kpiCpl')} ${moneyOrDash(r.kpis.cpl)}`)
      .join('\n');
    printHtmlDoc(composePrintHtml({ title: printTitle([t('admin.byPlatformTitle'), title]), meta: title ? [title] : [], sections: [{ label: t('admin.byPlatformTitle'), body: lines }] }));
  };

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)' }}>{t('admin.byPlatformTitle')}</span>
        <button className="btn" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 11 }} onClick={exportCsv}>⬇ {t('admin.metricExport')}</button>
        <button className="btn" style={{ padding: '3px 10px', fontSize: 11 }} onClick={exportPdf}>{t('admin.pdfBtn')}</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-0)' }}>
            <th style={tdL}>{t('admin.campPlatform')}</th>
            <th style={td}>{t('admin.campaignsCol')}</th>
            <th style={td}>{t('admin.kpiSpend')}</th>
            <th style={td}>{t('admin.kpiRevenue')}</th>
            <th style={td}>{t('admin.kpiRoas')}</th>
            <th style={td}>{t('admin.kpiLeads')}</th>
            <th style={td}>{t('admin.kpiCpl')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.platform}>
              <td style={tdL}><span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: PLATFORM_COLOR[r.platform], borderRadius: 4, padding: '1px 7px' }}>{PLATFORM_SHORT[r.platform]}</span></td>
              <td style={td}>{r.campaigns}</td>
              <td style={td}>{money(r.kpis.spend)}</td>
              <td style={td}>{money(r.kpis.revenue)}</td>
              <td style={{ ...td, fontWeight: 700, color: r.kpis.roas !== null && r.kpis.roas >= 1 ? '#1e7e34' : 'var(--fg-1)' }}>{roasFmt(r.kpis.roas)}</td>
              <td style={td}>{r.kpis.leads}</td>
              <td style={td}>{moneyOrDash(r.kpis.cpl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const [importState, setImportState] = useState<{ busy: boolean; msg: string | null; err: string | null }>({ busy: false, msg: null, err: null });

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

  // Import CSV: bulk-upsert metrici zilnice (export Ads Manager sau format propriu). Parser tolerant
  // (alias-uri antet ro/en, numere ro/en, upsert pe dată). source:'manual' — e introducere de operator,
  // doar în masă; conectorii API vor scrie cu source:'meta'/etc. și NU intră în coliziune logică aici.
  const importCsv = async (file: File) => {
    setImportState({ busy: true, msg: null, err: null });
    try {
      const text = await file.text();
      const { rows, errors } = parseMetricsCsv(text);
      if (rows.length === 0) { setImportState({ busy: false, msg: null, err: errors[0] || t('admin.csvNoRows') }); return; }
      for (let i = 0; i < rows.length; i += 450) {
        const batch = writeBatch(db);
        for (const r of rows.slice(i, i + 450)) {
          const m = coerceToDailyMetric({ ...r, source: 'manual' });
          if (!m) continue;
          batch.set(doc(db, 'campaigns', campaignId, 'metrics', m.date), {
            schema: METRIC_SCHEMA, date: m.date, spend: m.spend, impressions: m.impressions,
            clicks: m.clicks, leads: m.leads, revenue: m.revenue, source: 'manual', updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
      await recomputeTotals();
      await load();
      setImportState({ busy: false, msg: t('admin.csvImported', { count: rows.length }), err: errors.length ? t('admin.csvSkipped', { count: errors.length }) : null });
    } catch (e) {
      console.warn('csv import failed:', e);
      setImportState({ busy: false, msg: null, err: t('admin.csvError') });
    }
  };

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12 }} disabled={saveState === 'saving'} onClick={() => void saveDay()}>
            {saveState === 'saving' ? t('admin.metricSaving') : saveState === 'saved' ? t('admin.metricSaved') : t('admin.metricSave')}
          </button>
          {/* Import CSV (bulk-upsert pe zi) — export din Ads Manager sau format propriu. */}
          <label className="btn" style={{ padding: '6px 14px', fontSize: 12, cursor: importState.busy ? 'default' : 'pointer', opacity: importState.busy ? 0.6 : 1 }}>
            {importState.busy ? t('admin.csvImporting') : `⬆ ${t('admin.csvImport')}`}
            <input
              type="file" accept=".csv,text/csv" style={{ display: 'none' }} disabled={importState.busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void importCsv(f); e.target.value = ''; }}
            />
          </label>
          <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.csvImportHint')}</span>
        </div>
        {importState.msg && <div style={{ fontSize: 12, color: '#1e7e34', marginTop: 6 }}>{importState.msg}{importState.err ? ` · ${importState.err}` : ''}</div>}
        {!importState.msg && importState.err && <div role="alert" style={{ fontSize: 12, color: '#c0392b', marginTop: 6 }}>{importState.err}</div>}
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

/** Raportul lunar de performanță al unui client — agregat pe campaniile lui + generator AI. */
function ClientReportPanel({ leadId, campaigns }: { leadId: string; campaigns: CampaignRow[] }) {
  const { t } = useTranslation();
  const [report, setReport] = useState<ClientReport | null>(null);
  const [reportAt, setReportAt] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadReport = async () => {
    try {
      const snap = await getDoc(doc(db, 'leads', leadId));
      const d = snap.exists() ? snap.data() : {};
      setReport(coerceToReport(d.marketingReport));
      setReportAt(d.marketingReportAt ?? null);
    } catch {
      /* read best-effort */
    }
  };

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const fn = httpsCallable<{ leadId: string }, { report?: ClientReport }>(functions, 'aiClientReport');
      await fn({ leadId });
      await loadReport();
    } catch (e) {
      const code = String((e as { code?: string }).code ?? '');
      setErr(
        code.endsWith('failed-precondition') ? 'admin.reportNoCampaigns'
          : code.endsWith('not-found') || code.endsWith('internal') ? 'admin.reportNotReady'
          : 'admin.reportError'
      );
    } finally {
      setBusy(false);
    }
  };

  const copyReport = () => {
    if (!report) return;
    const txt = [t('admin.reportSummary'), report.summary, '', t('admin.reportHighlights'), report.highlights, '', t('admin.reportRecommendations'), report.recommendations].join('\n');
    navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  const pdfReport = () => {
    if (!report) return;
    const clientName = campaigns[0]?.clientName || '';
    printHtmlDoc(composePrintHtml({
      title: printTitle([t('admin.reportTitle'), clientName]),
      meta: [clientName, `${t('admin.reportAt')} ${fmtTs(reportAt)}`].filter((m) => m && m.trim()),
      sections: [
        { label: t('admin.reportSummary'), body: report.summary },
        { label: t('admin.reportHighlights'), body: report.highlights },
        { label: t('admin.reportRecommendations'), body: report.recommendations },
      ],
    }));
  };

  const kpis = kpisFromTotals(addTotals(campaigns.map((c) => c.data.totals)));
  const section = (label: string, body: string) =>
    body.trim() ? (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-1)' }}>{label}</div>
        <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{body}</div>
      </div>
    ) : null;

  const clientUid = campaigns.find((c) => c.data.clientUid)?.data.clientUid || '';

  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
      <KpiCards kpis={kpis} />
      {/* Conectare conturi de reclame ale clientului pentru ingestie automată (Meta etc.). Apare doar dacă
          lead-ul e conectat la un cont client (clientUid). */}
      {clientUid ? (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', marginTop: 6 }}>{t('admin.connectors.title')}</div>
          <PlatformConnect uid={clientUid} />
        </div>
      ) : null}
      <PlatformBreakdown items={campaigns.map((c) => c.data)} title={campaigns[0]?.clientName || ''} />
      <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>
        {campaigns.map((c) => {
          const k = kpisFromTotals(c.data.totals);
          return <div key={c.id}>• {c.data.name} [{PLATFORM_SHORT[c.data.platform]}] — {money(k.spend)} · ROAS {roasFmt(k.roas)}</div>;
        })}
      </div>
      <div>
        <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }} disabled={busy} onClick={() => void generate()}>
          {busy ? t('admin.reportBusy') : t('admin.reportGenerate')}
        </button>
        {err && <span role="alert" style={{ marginLeft: 10, fontSize: 12, color: '#c0392b' }}>{t(err)}</span>}
      </div>
      {report && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', background: 'var(--bg-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>{t('admin.reportTitle')}</strong>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.reportAt')} {fmtTs(reportAt)}</span>
          </div>
          {section(t('admin.reportSummary'), report.summary)}
          {section(t('admin.reportHighlights'), report.highlights)}
          {section(t('admin.reportRecommendations'), report.recommendations)}
          <button className="btn" style={{ padding: '5px 14px', fontSize: 12, color: copied ? '#1e7e34' : undefined }} onClick={copyReport}>
            {copied ? t('admin.copied') : t('admin.reportCopyAll')}
          </button>
          <button className="btn" style={{ padding: '5px 14px', fontSize: 12, marginLeft: 8 }} onClick={pdfReport}>
            {t('admin.pdfBtn')}
          </button>
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
  const [viewMode, setViewMode] = useState<'campaign' | 'client'>('campaign');
  const [openClient, setOpenClient] = useState<string | null>(null);

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
      // clientUid denormalizat din lead (dacă e deja conectat la un cont client) — leagă campania de
      // contul lui pentru reguli multi-tenant + jobul de ingestie. Dacă lead-ul nu e încă conectat,
      // rămâne gol și se completează automat când adminul îl conectează (trigger onLeadWrite).
      let clientUid = '';
      try {
        const leadSnap = await getDoc(doc(db, 'leads', newC.leadId));
        const lu = leadSnap.exists() ? (leadSnap.data() as Record<string, unknown>).clientUid : '';
        clientUid = typeof lu === 'string' ? lu : '';
      } catch { /* best-effort: rămâne gol, se sincronizează prin trigger */ }
      await addDoc(collection(db, 'campaigns'), {
        schema: CAMPAIGN_SCHEMA,
        name: newC.name.trim().slice(0, 120),
        platform: newC.platform,
        status: 'active',
        currency: 'EUR',
        externalId: '',
        leadId: newC.leadId,
        clientName: client?.label ?? '',
        clientUid,
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

  // Gruparea pe client (view-ul „pe client").
  const clientGroups: Array<{ key: string; clientName: string; campaigns: CampaignRow[] }> = [];
  {
    const map = new Map<string, { key: string; clientName: string; campaigns: CampaignRow[] }>();
    for (const c of visible) {
      const key = c.leadId || c.id;
      if (!map.has(key)) map.set(key, { key, clientName: c.clientName || '—', campaigns: [] });
      map.get(key)!.campaigns.push(c);
    }
    clientGroups.push(...map.values());
  }

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

      {/* Comutator view: pe campanie vs pe client. */}
      <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        {(['campaign', 'client'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            style={{ border: 'none', padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: viewMode === v ? 'var(--accent, #2563eb)' : 'var(--bg-1)', color: viewMode === v ? '#fff' : 'var(--fg-1)' }}
          >
            {v === 'campaign' ? t('admin.viewByCampaign') : t('admin.viewByClient')}
          </button>
        ))}
      </div>

      {/* Agregatul pe campaniile filtrate. */}
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--fg-1)' }}>{t('admin.mcAggregate')} ({visible.length})</div>
      <div style={{ marginBottom: 20 }}>
        <KpiCards kpis={aggregate} />
        <PlatformBreakdown items={visible.map((c) => c.data)} />
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

      {/* View pe client: grupare cu KPI agregat + raport lunar AI. */}
      {viewMode === 'client' && visible.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {clientGroups.map((g) => {
            const k = kpisFromTotals(addTotals(g.campaigns.map((c) => c.data.totals)));
            return (
              <div key={g.key} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 15 }}>{g.clientName}</strong>
                  <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{t('admin.clientCampaignsCount', { count: g.campaigns.length })}</span>
                  <span style={{ fontSize: 13 }}>{money(k.spend)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: k.roas !== null && k.roas >= 1 ? '#1e7e34' : 'var(--fg-1)' }}>ROAS {roasFmt(k.roas)}</span>
                  <button className="btn" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => setOpenClient(openClient === g.key ? null : g.key)}>
                    {openClient === g.key ? t('admin.hideDetail') : t('admin.viewDetail')}
                  </button>
                </div>
                {openClient === g.key && g.campaigns[0]?.leadId && <ClientReportPanel leadId={g.campaigns[0].leadId} campaigns={g.campaigns} />}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'campaign' && visible.length > 0 && (
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
