import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { coerceToDeliverables, deliverablesToSections, type RequestDeliverables, type RequestKind } from '../types/request';
import { coerceToLpStatsDay, lpKpis, sumLpStats, topEntries, type LpStatsDay } from '../analytics/lpStats';
import { coerceToLpVariant, variantConvRate, type LpVariant } from '../types/lpAttribution';
import { coerceToLpLeadState, LP_LEAD_STATUSES, LP_LEAD_STATUS_COLORS, LP_LEAD_STATUS_DEFAULT, type LpLeadStatus } from '../types/lpLeadState';
import { toCsv } from '../utils/csv';
import { coerceToInvoice, invoiceTotals, type Invoice } from '../types/invoice';
import { printInvoice, type InvoiceLabels } from '../utils/invoiceDoc';
import { composePrintHtml, printHtmlDoc, printTitle } from '../utils/printDoc';
import i18n from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useEntitlementStore } from '../store/entitlementStore';
import { watchClientProfile } from '../services/clients';
import { createCheckoutSession, createPortalLink } from '../services/billing';
import { reportError } from '../services/errorReporting';
import type { ClientProfile } from '../types/client';
import { getPackage, isValidPackageId } from '../config/packages';
import { coerceToCampaign, coerceToReport, kpisFromTotals, type CampaignDef, type ClientReport } from '../analytics/kpi';
import { coerceToContact, contactDisplay, type Contact } from '../types/contact';
import { coerceToPrediction, predictionToSections, type Prediction } from '../types/prediction';
import AuthPanel, { PKG_INTENT_KEY } from './AuthPanel';
import ServiceOrdersPortal from './ServiceOrdersPortal';
import { isPreviewSearch } from './previewMode';

// Tema portalului /app (pageThemes.app) e aplicată acum de AppThemeLayout pe TOATE rutele /app/* (un singur
// wrapper), ca paginile imbricate să fie consistente cu /app. AppHome nu mai învelește singur conținutul.

const PLATFORM_LABEL: Record<string, string> = { meta: 'Meta', google: 'Google', tiktok: 'TikTok', other: 'Alt' };
const portalMoney = (n: number) => `€${n.toLocaleString('ro-RO', { maximumFractionDigits: 2 })}`;
const portalRoas = (n: number | null) => (n === null ? '—' : `${n.toFixed(2)}×`);

interface DelivVersion { id: string; atMs: number; source: string; deliverables: RequestDeliverables }

/** Istoricul de versiuni al unui livrabil (read-only) — oglindit client-safe de functions sub
 *  clients/{uid}/deliverables/{reqId}/versions. Încărcare leneșă la prima deschidere (getDocs o singură dată). */
function VersionHistory({ uid, reqId, kind }: { uid: string; reqId: string; kind: RequestKind }) {
  const { t } = useTranslation();
  const tr = (k: string): string => t(k);
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<DelivVersion[] | null>(null);

  const load = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'clients', uid, 'deliverables', reqId, 'versions'), orderBy('snapshotAt', 'desc'), limit(20)));
      setVersions(snap.docs.map((d) => {
        const x = d.data();
        const at = x.snapshotAt as { toMillis?: () => number } | undefined;
        return { id: d.id, atMs: at && typeof at.toMillis === 'function' ? at.toMillis() : 0, source: x.source === 'ai' ? 'ai' : 'manual', deliverables: coerceToDeliverables(x.deliverables) };
      }));
    } catch {
      setVersions([]);
    }
  };
  const toggle = () => { const n = !open; setOpen(n); if (n && versions === null) void load(); };

  const linkBtn = { background: 'transparent', border: 'none', color: 'var(--fg-1)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 } as const;

  return (
    <div style={{ marginTop: 8, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
      <button type="button" onClick={toggle} style={linkBtn}>{open ? '▾' : '▸'} {t('appHome.versionsTitle')}</button>
      {open && versions === null && <div style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 4 }}>…</div>}
      {open && versions !== null && versions.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 4 }}>{t('appHome.versionsEmpty')}</div>}
      {open && versions && versions.map((v, i) => (
        <div key={v.id} style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-1)', marginBottom: 4 }}>
            {t('appHome.versionLabel', { n: versions.length - i })}
            {v.atMs ? ` · ${new Date(v.atMs).toLocaleString('ro-RO')}` : ''}
            {` · ${v.source === 'ai' ? 'AI' : t('appHome.versionManual')}`}
          </div>
          {deliverablesToSections(tr, kind, v.deliverables).map((sec) => (
            <div key={sec.label} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fg-1)' }}>{sec.label}</div>
              <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{sec.body}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Bară-skeleton (clasa .skeleton din styles.css) — placeholder de încărcare, fără pâlpâit. */
function Skel({ w, h = 14, r = 6, mt = 0 }: { w: number | string; h?: number; r?: number; mt?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, marginTop: mt }} aria-hidden="true" />;
}

/** Card-skeleton reutilizabil (titlu + linii). */
function SkelCard() {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 18 }}>
      <Skel w="55%" h={16} />
      <Skel w="100%" h={12} mt={12} />
      <Skel w="80%" h={12} mt={8} />
    </div>
  );
}

/** Portalul de marketing al clientului: campaniile LUI (scoped pe clientUid prin rules) cu KPI +
 *  raportul lunar (oglindit în clients/{uid} de functions). Read-only — operatorii gestionează tot. */
function MarketingPortal({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const tr = (k: string): string => t(k);
  const [camps, setCamps] = useState<Array<{ id: string; data: CampaignDef }> | null>(null);
  const [report, setReport] = useState<ClientReport | null>(null);
  const [deliv, setDeliv] = useState<Array<{ id: string; kind: RequestKind; title: string; deliverables: RequestDeliverables }>>([]);

  useEffect(() => {
    const off1 = onSnapshot(
      query(collection(db, 'campaigns'), where('clientUid', '==', uid)),
      (snap) => {
        const out: Array<{ id: string; data: CampaignDef }> = [];
        snap.forEach((d) => {
          const c = coerceToCampaign(d.data());
          if (c) out.push({ id: d.id, data: c });
        });
        setCamps(out);
      },
      () => setCamps([])
    );
    const off2 = onSnapshot(
      doc(db, 'clients', uid),
      (snap) => setReport(coerceToReport(snap.data()?.marketingReport)),
      () => {}
    );
    const off3 = onSnapshot(
      query(collection(db, 'clients', uid, 'deliverables'), orderBy('updatedAt', 'desc')),
      (snap) => {
        const out: Array<{ id: string; kind: RequestKind; title: string; deliverables: RequestDeliverables }> = [];
        snap.forEach((d) => {
          const x = d.data();
          out.push({ id: d.id, kind: x.kind === 'content' ? 'content' : 'campaign', title: typeof x.title === 'string' ? x.title : '', deliverables: coerceToDeliverables(x.deliverables) });
        });
        setDeliv(out);
      },
      () => setDeliv([])
    );
    return () => {
      off1();
      off2();
      off3();
    };
  }, [uid]);

  // În loc de `return null` cât se încarcă (pâlpâit): arată titlul + carduri-skeleton; după load → conținut SAU empty state.
  if (camps === null) {
    return (
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>{t('appHome.portalTitle')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <SkelCard /><SkelCard />
        </div>
      </section>
    );
  }
  const hasData = camps.length > 0 || report !== null || deliv.length > 0;

  const pdfReport = () => {
    if (!report) return;
    printHtmlDoc(composePrintHtml({
      title: printTitle([t('appHome.portalReportTitle')]),
      sections: [
        { label: t('admin.reportSummary'), body: report.summary },
        { label: t('admin.reportHighlights'), body: report.highlights },
        { label: t('admin.reportRecommendations'), body: report.recommendations },
      ],
    }));
  };
  const pdfDeliv = (d: { title: string; kind: RequestKind; deliverables: RequestDeliverables }) => {
    printHtmlDoc(composePrintHtml({
      title: printTitle([d.title || t('appHome.portalDeliverables')]),
      sections: deliverablesToSections(tr, d.kind, d.deliverables),
    }));
  };
  const portalPdfBtn = { border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--fg-1)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const;

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>{t('appHome.portalTitle')}</h2>
      {!hasData && <p style={{ color: 'var(--fg-1)' }}>{t('appHome.portalNotLinked')}</p>}

      {report && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 16px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 17 }}>{t('appHome.portalReportTitle')}</h3>
          {[['reportSummary', report.summary], ['reportHighlights', report.highlights], ['reportRecommendations', report.recommendations]].map(([k, body]) =>
            body.trim() ? (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-1)' }}>{t(`admin.${k}`)}</div>
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{body}</div>
              </div>
            ) : null
          )}
          <button onClick={pdfReport} style={{ ...portalPdfBtn, marginTop: 4 }}>{t('appHome.pdfBtn')}</button>
        </div>
      )}

      {camps.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, margin: '0 0 10px' }}>{t('appHome.portalCampaigns')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {camps.map(({ id, data }) => {
              const k = kpisFromTotals(data.totals);
              const cell = (label: string, val: string, hero?: boolean) => (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
                  <div style={{ fontSize: hero ? 18 : 14, fontWeight: 700, color: hero ? 'var(--accent, #2563eb)' : 'var(--fg-0)' }}>{val}</div>
                </div>
              );
              return (
                <div key={id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <strong style={{ fontSize: 15 }}>{data.name}</strong>
                    <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{PLATFORM_LABEL[data.platform] ?? data.platform}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {cell(t('admin.kpiRoas'), portalRoas(k.roas), true)}
                    {cell(t('admin.kpiSpend'), portalMoney(k.spend))}
                    {cell(t('admin.kpiLeads'), String(k.leads))}
                    {cell(t('admin.kpiCpl'), k.cpl === null ? '—' : portalMoney(k.cpl))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {deliv.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, margin: '24px 0 10px' }}>{t('appHome.portalDeliverables')}</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {deliv.map((d) => (
              <div key={d.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <strong style={{ fontSize: 15 }}>{d.title || '—'}</strong>
                  <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t(d.kind === 'content' ? 'admin.reqKindContent' : 'admin.reqKindCampaign')}</span>
                  <button onClick={() => pdfDeliv(d)} style={{ ...portalPdfBtn, marginLeft: 'auto', padding: '4px 10px' }}>{t('appHome.pdfBtn')}</button>
                </div>
                {deliverablesToSections(tr, d.kind, d.deliverables).map((sec) => (
                  <div key={sec.label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--fg-1)' }}>{sec.label}</div>
                    <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{sec.body}</div>
                  </div>
                ))}
                <VersionHistory uid={uid} reqId={d.id} kind={d.kind} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

interface LpIdx { slug: string; title: string; publicUrl: string; status: string }
interface LpSub { id: string; values: Record<string, string>; createdAtMs: number; source: string; campaign: string }
interface LpData { visits: number; submissions: number; convRate: number | null; engRate: number | null; bySource: Record<string, number>; byMedium: Record<string, number>; variants: LpVariant[]; subs: LpSub[] }

function lpTs(v: unknown): number {
  const t = v as { toMillis?: () => number } | null;
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

/** Secțiunea de Landing Pages a clientului: paginile LUI (clients/{uid}/lpIndex) + performanța,
 *  defalcarea pe canal/versiune și lead-urile capturate (scoped prin rules — vede DOAR ce e al lui). */
function LandingPagesPortal({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const [lps, setLps] = useState<LpIdx[] | null>(null);
  const [data, setData] = useState<Record<string, LpData>>({});
  const [leadState, setLeadState] = useState<Record<string, { status: LpLeadStatus; note: string }>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | LpLeadStatus>('all');
  // Ref cu starea CRM cea mai recentă (snapshot + scrieri optimiste) — evită clobber-ul la editări rapide
  // status↔notă înainte ca onSnapshot să revină (citim mereu valoarea curentă, nu closure-ul de la render).
  const leadStateRef = useRef(leadState);

  // Starea de CRM a clientului pe lead-uri (un singur listener; cheia = submissionId, globală).
  useEffect(() => {
    const off = onSnapshot(
      collection(db, 'clients', uid, 'lpLeadState'),
      (snap) => {
        const m: Record<string, { status: LpLeadStatus; note: string }> = {};
        snap.docs.forEach((d) => { const s = coerceToLpLeadState(d.data()); m[d.id] = { status: s.status, note: s.note }; });
        leadStateRef.current = m;
        setLeadState(m);
      },
      () => { leadStateRef.current = {}; setLeadState({}); }
    );
    return off;
  }, [uid]);

  async function saveLeadState(subId: string, slug: string, patch: { status?: LpLeadStatus; note?: string }) {
    const cur = leadStateRef.current[subId] || { status: LP_LEAD_STATUS_DEFAULT, note: '' };
    const next = { status: patch.status ?? cur.status, note: patch.note ?? cur.note };
    leadStateRef.current = { ...leadStateRef.current, [subId]: next }; // optimist: păstrează celălalt câmp corect
    setLeadState(leadStateRef.current);
    try {
      await setDoc(doc(db, 'clients', uid, 'lpLeadState', subId), { schema: 1, status: next.status, note: next.note, slug, updatedAt: serverTimestamp() });
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const off = onSnapshot(
      collection(db, 'clients', uid, 'lpIndex'),
      (snap) => {
        const out = snap.docs.map((d) => {
          const x = d.data();
          return { slug: d.id, title: String(x.title || d.id), publicUrl: String(x.publicUrl || ''), status: String(x.status || 'draft') };
        });
        out.sort((a, b) => a.title.localeCompare(b.title));
        setLps(out);
      },
      () => setLps([])
    );
    return off;
  }, [uid]);

  const slugKey = (lps || []).map((l) => l.slug).sort().join('|');
  useEffect(() => {
    if (!lps || lps.length === 0) { setData({}); return; }
    let cancel = false;
    (async () => {
      const out: Record<string, LpData> = {};
      await Promise.all(lps.map(async (lp) => {
        try {
          const [statsSnap, varSnap, subSnap] = await Promise.all([
            getDocs(query(collection(db, 'landingPages', lp.slug, 'stats'), orderBy('date', 'desc'), limit(30))),
            getDocs(collection(db, 'landingPages', lp.slug, 'variants')),
            getDocs(query(collection(db, 'landingPages', lp.slug, 'submissions'), orderBy('createdAt', 'desc'), limit(100))),
          ]);
          const days = statsSnap.docs.map((d) => coerceToLpStatsDay(d.data())).filter((x): x is LpStatsDay => !!x);
          const totals = sumLpStats(days);
          const k = lpKpis(totals);
          const variants = varSnap.docs.map((d) => coerceToLpVariant(d.id, d.data())).filter((v) => v.key !== '__direct' && v.key !== '__other').sort((a, b) => b.visits - a.visits);
          const subs: LpSub[] = subSnap.docs.map((d) => {
            const x = d.data();
            const vals: Record<string, string> = {};
            if (x.values && typeof x.values === 'object') for (const [vk, vv] of Object.entries(x.values as Record<string, unknown>)) if (typeof vv === 'string') vals[vk] = vv;
            const utm = (x.utm && typeof x.utm === 'object' ? x.utm : {}) as Record<string, string>;
            return { id: d.id, values: vals, createdAtMs: lpTs(x.createdAt), source: String(utm.source || ''), campaign: String(utm.campaign || '') };
          });
          out[lp.slug] = { visits: k.visits, submissions: k.submissions, convRate: k.convRate, engRate: k.engagementRate, bySource: totals.bySource, byMedium: totals.byMedium, variants, subs };
        } catch { /* citire refuzată/eroare per pagină — sărim */ }
      }));
      if (!cancel) setData(out);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugKey]);

  if (lps === null || lps.length === 0) return null;

  const fmtN = (n: number) => n.toLocaleString('ro-RO');
  const fmtPct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
  const cardS: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 14 };
  const kpiCell = (label: string, val: string, hero?: boolean) => (
    <div><div style={{ fontSize: 11, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div><div style={{ fontSize: hero ? 18 : 14, fontWeight: 700, color: hero ? 'var(--accent, #2563eb)' : 'var(--fg-0)' }}>{val}</div></div>
  );
  const breakdown = (label: string, map: Record<string, number>) => {
    const rows = topEntries(map, 5).filter(([key]) => key !== 'other' || Object.keys(map).length === 1);
    if (rows.length === 0) return null;
    return (
      <div style={{ flex: '1 1 160px' }}>
        <div style={{ fontSize: 11, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{label}</div>
        {rows.map(([key, n]) => <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{key}</span><span style={{ color: 'var(--fg-1)' }}>{fmtN(n)}</span></div>)}
      </div>
    );
  };

  const statusLabel = (s: LpLeadStatus) => t(`appHome.ls_${s}`);
  const chip: React.CSSProperties = { borderRadius: 7, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
  const statusBadgeStyle = (s: LpLeadStatus): React.CSSProperties => ({ border: `1px solid ${LP_LEAD_STATUS_COLORS[s]}`, borderRadius: 6, background: 'var(--bg-0)', color: 'var(--fg-0)', fontSize: 12, padding: '2px 6px' });

  // Contoare pe status, peste TOATE lead-urile încărcate (lead fără stare = 'nou').
  const counts: Record<string, number> = { all: 0 };
  for (const s of LP_LEAD_STATUSES) counts[s] = 0;
  for (const lp of lps) {
    const d = data[lp.slug];
    if (!d) continue;
    for (const sub of d.subs) { const st = leadState[sub.id]?.status || LP_LEAD_STATUS_DEFAULT; counts[st] = (counts[st] || 0) + 1; counts.all += 1; }
  }

  function exportLeads(lp: LpIdx, subs: LpSub[], subKeys: string[]) {
    const header = [t('appHome.lpLeadDate'), ...subKeys, t('appHome.lpBySource'), t('appHome.lsCol'), t('appHome.lsNote')];
    const rows = subs.map((s) => {
      const st = leadState[s.id] || { status: LP_LEAD_STATUS_DEFAULT, note: '' };
      return [s.createdAtMs ? fmtDate(s.createdAtMs) : '', ...subKeys.map((k) => s.values[k] || ''), s.source || '', statusLabel(st.status), st.note || ''];
    });
    const url = URL.createObjectURL(new Blob([toCsv([header, ...rows])], { type: 'text/csv;charset=utf-8' })); // toCsv = escaping + anti formula-injection
    const a = document.createElement('a');
    a.href = url; a.download = `leads-${lp.slug}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>{t('appHome.lpTitle')}</h2>
      {counts.all > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {(['all', ...LP_LEAD_STATUSES] as const).map((st) => {
            const active = statusFilter === st;
            return (
              <button key={st} onClick={() => setStatusFilter(st)} style={{ ...chip, background: active ? 'var(--accent)' : 'var(--bg-1)', color: active ? 'var(--accent-contrast)' : 'var(--fg-0)', border: active ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                {st === 'all' ? t('appHome.lsAll') : statusLabel(st)} ({counts[st] || 0})
              </button>
            );
          })}
        </div>
      ) : null}
      {lps.map((lp) => {
        const d = data[lp.slug];
        const subKeys = d ? [...new Set(d.subs.flatMap((s) => Object.keys(s.values)))].slice(0, 6) : [];
        return (
          <div key={lp.slug} style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15 }}>{lp.title}</strong>
              {lp.status === 'published' && lp.publicUrl ? <a href={lp.publicUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent, #2563eb)' }}>{t('appHome.lpOpen')}</a> : <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('appHome.lpDraft')}</span>}
            </div>
            {!d ? <p style={{ color: 'var(--fg-1)', fontSize: 13, margin: 0 }}>…</p> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginBottom: 12 }}>
                  {kpiCell(t('appHome.lpVisits'), fmtN(d.visits), true)}
                  {kpiCell(t('appHome.lpLeadsKpi'), fmtN(d.submissions))}
                  {kpiCell(t('appHome.lpConvRate'), fmtPct(d.convRate))}
                  {kpiCell(t('appHome.lpEngagement'), fmtPct(d.engRate))}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                  {breakdown(t('appHome.lpBySource'), d.bySource)}
                  {breakdown(t('appHome.lpByMedium'), d.byMedium)}
                </div>
                {d.variants.length > 0 ? (
                  <div style={{ marginBottom: d.subs.length ? 12 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--fg-1)', marginBottom: 6 }}>{t('appHome.lpVariants')}</div>
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr style={{ background: 'var(--bg-0)' }}>
                          <th style={lpTd}>{t('appHome.lpBySource')}</th>
                          <th style={lpTd}>{t('appHome.lpByMedium')}</th>
                          <th style={lpTd}>{t('appHome.lpVariantVersion')}</th>
                          <th style={{ ...lpTd, textAlign: 'right' }}>{t('appHome.lpVisits')}</th>
                          <th style={{ ...lpTd, textAlign: 'right' }}>{t('appHome.lpLeadsKpi')}</th>
                          <th style={{ ...lpTd, textAlign: 'right' }}>{t('appHome.lpConvRate')}</th>
                        </tr></thead>
                        <tbody>
                          {d.variants.slice(0, 6).map((v) => {
                            const c = (x: string) => (x && x !== '-' ? x : '—');
                            return (
                              <tr key={v.key}>
                                <td style={lpTd}>{c(v.source)}</td>
                                <td style={lpTd}>{c(v.medium)}</td>
                                <td style={lpTd}>{c(v.content)}</td>
                                <td style={{ ...lpTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtN(v.visits)}</td>
                                <td style={{ ...lpTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtN(v.submissions)}</td>
                                <td style={{ ...lpTd, textAlign: 'right', color: 'var(--fg-1)' }}>{fmtPct(variantConvRate(v))}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
                {d.subs.length > 0 ? (() => {
                  const visible = statusFilter === 'all' ? d.subs : d.subs.filter((s) => (leadState[s.id]?.status || LP_LEAD_STATUS_DEFAULT) === statusFilter);
                  return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--fg-1)' }}>{t('appHome.lpLeads')} ({visible.length})</div>
                      <button onClick={() => exportLeads(lp, visible, subKeys)} style={{ marginLeft: 'auto', ...chip, background: 'var(--bg-0)', color: 'var(--fg-0)', border: '1px solid var(--border)' }}>{t('appHome.lpExport')}</button>
                    </div>
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr style={{ background: 'var(--bg-0)' }}>
                          <th style={lpTd}>{t('appHome.lpLeadDate')}</th>
                          {subKeys.map((kk) => <th key={kk} style={lpTd}>{kk}</th>)}
                          <th style={lpTd}>{t('appHome.lpBySource')}</th>
                          <th style={lpTd}>{t('appHome.lsCol')}</th>
                          <th style={lpTd}>{t('appHome.lsNote')}</th>
                        </tr></thead>
                        <tbody>
                          {visible.slice(0, 50).map((s) => {
                            const st = leadState[s.id] || { status: LP_LEAD_STATUS_DEFAULT, note: '' };
                            return (
                            <tr key={s.id}>
                              <td style={{ ...lpTd, whiteSpace: 'nowrap', color: 'var(--fg-1)' }}>{s.createdAtMs ? fmtDate(s.createdAtMs) : '—'}</td>
                              {subKeys.map((kk) => <td key={kk} style={lpTd}>{s.values[kk] || ''}</td>)}
                              <td style={{ ...lpTd, color: 'var(--fg-1)' }}>{s.source || '—'}</td>
                              <td style={lpTd}>
                                <select value={st.status} onChange={(e) => saveLeadState(s.id, lp.slug, { status: e.target.value as LpLeadStatus })} style={statusBadgeStyle(st.status)}>
                                  {LP_LEAD_STATUSES.map((ss) => <option key={ss} value={ss}>{statusLabel(ss)}</option>)}
                                </select>
                              </td>
                              <td style={lpTd}>
                                <input defaultValue={st.note} placeholder={t('appHome.lsNotePh')} onBlur={(e) => { const v = e.target.value.slice(0, 1000); if (v !== st.note) saveLeadState(s.id, lp.slug, { note: v }); }} style={{ width: 140, boxSizing: 'border-box', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-0)', color: 'var(--fg-0)', fontSize: 12 }} />
                              </td>
                            </tr>
                            );
                          })}
                          {visible.length === 0 ? <tr><td colSpan={subKeys.length + 4} style={{ ...lpTd, color: 'var(--fg-1)', textAlign: 'center' }}>{t('appHome.lsNoneInFilter')}</td></tr> : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  );
                })() : null}
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

const lpTd: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border)', textAlign: 'left' };

function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'ro-RO');
  } catch {
    return '';
  }
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 16px' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 17 }}>{title}</h2>
      {children}
    </div>
  );
}

/** Shell-ul vizual al portalului /app pentru previzualizarea din /admin (?preview=1): randează aspectul
 *  REAL (antet + carduri) dar FĂRĂ autentificare și FĂRĂ date de client. Tema e aplicată de AppThemeLayout
 *  (wrapper-ul comun /app), deci aici nu mai învelim. Scop: vezi tema pe /app fără ecranul de login în iframe. */
function AppThemePreview() {
  const { t } = useTranslation();
  const cards = [t('appHome.onboardingTitle'), t('appHome.portalTitle'), t('appHome.portalReportTitle'), t('appHome.lpTitle')];
  return (
    <main data-page="app-theme-preview" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '28px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{t('appHome.title')}</h1>
        <span style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.site.previewSampleUser')}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <span className="btn" style={{ padding: '6px 12px', fontSize: 13 }}>{t('help.title')}</span>
          <span className="btn" style={{ padding: '6px 12px', fontSize: 13 }}>{t('appHome.signOut')}</span>
        </span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {cards.map((title) => (
          <Card key={title} title={title}>
            <p style={{ margin: 0, color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.site.previewSample')}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}

/** Dashboardul clientului. Structura prevede de pe acum secțiunile Verticalei 1 (cereri de
 *  marketing / rezultate / AI insights) — „în curând" în v1, populate în felia 2. */
/** Feed-ul de automatizări al clientului — notificările + task-urile generate de regulile client-scope (scope:'client')
 *  rulate pe contul lui. Scrise de motor (Admin SDK), citite scoped prin rules. Clientul poate marca un task ca rezolvat. */
function ClientAutomationFeed({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const [notifs, setNotifs] = useState<Array<{ id: string; text?: string; createdAt?: number }>>([]);
  const [tasks, setTasks] = useState<Array<{ id: string; title?: string; createdAt?: number }>>([]);
  useEffect(() => {
    const o1 = onSnapshot(query(collection(db, 'clients', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(20)),
      (s) => setNotifs(s.docs.map((d) => ({ id: d.id, ...(d.data() as { text?: string; createdAt?: number }) }))), () => { /* none */ });
    const o2 = onSnapshot(query(collection(db, 'clients', uid, 'tasks'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(20)),
      (s) => setTasks(s.docs.map((d) => ({ id: d.id, ...(d.data() as { title?: string; createdAt?: number }) }))), () => { /* none */ });
    return () => { o1(); o2(); };
  }, [uid]);
  const done = async (id: string) => { try { await updateDoc(doc(db, 'clients', uid, 'tasks', id), { status: 'done' }); } catch (e) { /* ignore */ } };
  if (notifs.length === 0 && tasks.length === 0) return null;
  const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 13 };
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>{t('appHome.autoTitle')}</h2>
      {tasks.length > 0 && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t('appHome.autoTasks')}</div>
          {tasks.map((tk) => (
            <div key={tk.id} style={row}>
              <span style={{ flex: 1 }}>{tk.title}</span>
              <button className="btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => void done(tk.id)}>{t('appHome.taskDone')}</button>
            </div>
          ))}
        </div>
      )}
      {notifs.length > 0 && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t('appHome.autoNotifs')}</div>
          {notifs.map((n) => (
            <div key={n.id} style={row}>
              <span style={{ flex: 1 }}>{n.text}</span>
              <span style={{ color: 'var(--fg-1)', fontSize: 12 }}>{n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Facturile clientului (Verticala 2) — DOAR cele EMITE (number != ''); drafturile interne ale agenției nu se văd
// (reguli: client citește doar numerotate). Read-only + descărcare PDF (același composer pur ca în /admin).
function InvoicesPortal({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const [list, setList] = useState<Array<Invoice & { id: string; _ts: number }>>([]);
  useEffect(() => {
    // where('number','!=','') → doar facturile emise; sortăm în client (evită index compus).
    const off = onSnapshot(query(collection(db, 'clients', uid, 'invoices'), where('number', '!=', '')),
      (s) => {
        const rows = s.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const tsf = data.issuedNumberAt as { toMillis?: () => number } | undefined;
          const _ts = tsf && typeof tsf.toMillis === 'function' ? tsf.toMillis() : 0;
          return { ...coerceToInvoice({ ...data, id: d.id }), id: d.id, _ts };
        });
        // Data facturii desc; la egalitate / dată golită de operator → momentul emiterii (server-stamped, mereu prezent).
        rows.sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || '') || (b._ts - a._ts));
        setList(rows);
      }, () => setList([]));
    return off;
  }, [uid]);
  if (list.length === 0) return null;
  const pdfLabels = (inv: Invoice): InvoiceLabels => ({
    docTitle: inv.stornoOf ? t('admin.invoices.stornoTitle').toUpperCase() : t(inv.kind === 'factura' ? 'admin.invoices.factura' : 'admin.invoices.proforma').toUpperCase(),
    seller: t('admin.invoices.seller'), buyer: t('admin.invoices.buyer'), cui: t('admin.invoices.cui'), regCom: t('admin.invoices.regCom'), iban: t('admin.invoices.iban'),
    issued: t('admin.invoices.issued'), due: t('admin.invoices.due'), nr: t('admin.invoices.nr'),
    colItem: t('admin.invoices.itemDesc'), colQty: t('admin.invoices.qty'), colPrice: t('admin.invoices.unitPrice'), colTotal: t('admin.invoices.lineTotal'),
    subtotal: t('admin.invoices.subtotal'), vat: t('admin.invoices.vat'), total: t('admin.invoices.total'),
    stornoNote: t('admin.invoices.stornoNote'),
  });
  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontSize: 12 };
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>{t('appHome.invoices.title')}</h2>
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--bg-0)' }}>
            <th style={th}>{t('appHome.invoices.kind')}</th>
            <th style={th}>{t('appHome.invoices.nr')}</th>
            <th style={th}>{t('appHome.invoices.issued')}</th>
            <th style={{ ...th, textAlign: 'right' }}>{t('appHome.invoices.total')}</th>
            <th style={th}>{t('appHome.invoices.status')}</th>
            <th style={th} />
          </tr></thead>
          <tbody>
            {list.map((r) => {
              const tt = invoiceTotals(r);
              return (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }}>{r.stornoOf ? t('admin.invoices.stornoTitle') : t(`admin.invoices.${r.kind}`)}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {[r.series, r.number].filter(Boolean).join(' ') || '—'}
                    {r.stornoOf && <span style={{ display: 'block', fontSize: 11, color: 'var(--fg-1)' }}>↩ {[r.stornoOf.series, r.stornoOf.number].filter(Boolean).join(' ')}</span>}
                  </td>
                  <td style={{ padding: '6px 8px' }}>{r.issuedAt || '—'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tt.total.toFixed(2)} {r.currency}</td>
                  <td style={{ padding: '6px 8px' }}>{t(`admin.invoices.status_${r.status}`)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => printInvoice(r, pdfLabels(r))}>📄 {t('appHome.invoices.download')}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** F4: predicții comportamentale despre PROPRIII clienți (consumatori), oglindite client-safe de functions în
 *  clients/{uid}/predictions (fără UID-ul operatorului). Read-only — generate de agenție (sau, când e activat, de client). */
function ContactPredictions({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const tr = (k: string, opts?: Record<string, unknown>) => t(k, opts) as string;
  const [contacts, setContacts] = useState<Array<{ id: string; data: Contact }> | null>(null);
  const [preds, setPreds] = useState<Record<string, Prediction>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const off1 = onSnapshot(
      query(collection(db, 'clients', uid, 'contacts'), orderBy('rollup.lastSeen', 'desc'), limit(100)),
      (snap) => setContacts(snap.docs.map((d) => ({ id: d.id, data: coerceToContact(d.data()) }))),
      () => setContacts([])
    );
    const off2 = onSnapshot(
      collection(db, 'clients', uid, 'predictions'),
      (snap) => { const m: Record<string, Prediction> = {}; snap.forEach((d) => { m[d.id] = coerceToPrediction(d.data()); }); setPreds(m); },
      () => setPreds({})
    );
    return () => { off1(); off2(); };
  }, [uid]);

  if (contacts === null) return null;
  const visible = contacts.filter(({ data }) => !data.mergedInto);
  if (visible.length === 0) return null;

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{t('appHome.contactsTitle')}</h2>
      <p style={{ color: 'var(--fg-1)', fontSize: 13, margin: '0 0 12px' }}>{t('appHome.contactsHint')}</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {visible.map(({ id, data }) => {
          const p = preds[id];
          const isOpen = open === id;
          return (
            <div key={id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14 }}>{contactDisplay(data) || t('appHome.contactAnon')}</strong>
                <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t(`appHome.ls_${data.lifecycle}`)} · {data.rollup.submissions} {t('appHome.contactInteractions')}</span>
                {p && <button className="btn" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => setOpen(isOpen ? null : id)}>{isOpen ? t('appHome.predHide') : t('appHome.predShow')}</button>}
              </div>
              {p && isOpen && (
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  {predictionToSections(tr, p).map((s) => (
                    <div key={s.label}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--fg-1)' }}>{s.label}</div>
                      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{s.body}</div>
                    </div>
                  ))}
                </div>
              )}
              {!p && <div style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 4 }}>{t('appHome.predNone')}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AppHome() {
  const { t } = useTranslation();
  const { user, initializing, signOutUser } = useAuthStore();
  const ent = useEntitlementStore();
  const { search } = useLocation();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const previewMode = isPreviewSearch(search); // iframe-ul de preview din /admin (?preview=1): shell tematizat, fără auth

  useEffect(() => {
    if (previewMode) return; // preview: niciun watcher/init de cont (nu atingem sesiunea/datele)
    if (!user) {
      setProfile(null);
      useEntitlementStore.getState().reset();
      return;
    }
    useEntitlementStore.getState().init(user.uid);
    return watchClientProfile(user.uid, setProfile);
  }, [user, previewMode]);

  // Preview din /admin: arată aspectul portalului (tema vine din AppThemeLayout), FĂRĂ login și fără date.
  if (previewMode) return <AppThemePreview />;

  if (initializing) {
    // Skeleton care reflectă layout-ul real (antet + bară pas + 3 carduri) → fără „…", fără salt la încărcare.
    return (
      <main data-page="app-loading" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <Skel w={200} h={26} />
          <Skel w={140} h={14} />
        </div>
        <Skel w="100%" h={52} r={10} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 20 }}>
          <SkelCard /><SkelCard /><SkelCard />
        </div>
      </main>
    );
  }
  if (!user) return <AuthPanel />;

  let pkgIntent: string | null = null;
  try {
    pkgIntent = sessionStorage.getItem(PKG_INTENT_KEY);
  } catch {
    /* private mode */
  }
  const intent = isValidPackageId(pkgIntent) ? getPackage(pkgIntent) : null;
  const subActive = ent.status === 'active';
  const checkoutSuccess = new URLSearchParams(search).get('checkout') === 'success';
  const pending = checkoutSuccess && !subActive && !ent.needsResync;
  const activePkg = ent.packageId ? getPackage(ent.packageId) : null;
  const onboardingDone = profile?.onboardingStatus === 'submitted';

  const startCheckout = async () => {
    if (!intent?.priceId) return;
    setBillingBusy(true);
    setBillingError(null);
    try {
      const url = await createCheckoutSession(user.uid, intent.priceId);
      window.location.href = url;
    } catch (e) {
      reportError(e, { kind: 'checkout' });
      setBillingError('appHome.checkoutError');
      setBillingBusy(false);
    }
  };

  const openPortal = async () => {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const url = await createPortalLink();
      window.location.href = url;
    } catch (e) {
      reportError(e, { kind: 'portal' });
      setBillingError('appHome.portalError');
      setBillingBusy(false);
    }
  };

  return (
    <main data-page="app-home" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '28px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{t('appHome.title')}</h1>
        <span style={{ color: 'var(--fg-1)', fontSize: 14 }}>{user.email}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <Link to="/app/ghid" className="btn" style={{ padding: '6px 12px', fontSize: 13 }}>
            {t('help.title')}
          </Link>
          <Link to="/" className="btn" style={{ padding: '6px 12px', fontSize: 13 }}>
            {t('appHome.backToSite')}
          </Link>
          <button className="btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => void signOutUser()}>
            {t('appHome.signOut')}
          </button>
        </span>
      </header>

      {/* Bara „Următorul pas" (#13) — direcție unică, derivată din date deja încărcate (onboarding/abonament). */}
      {(() => {
        const step = !onboardingDone
          ? { label: t('appHome.next_onboarding'), cta: t('appHome.next_onboardingCta'), to: '/app/onboarding', accent: true }
          : !subActive
            ? { label: t('appHome.next_subscription'), cta: t('appHome.next_subscriptionCta'), to: '/pachete', accent: true }
            : { label: t('appHome.next_explore'), cta: t('appHome.next_exploreCta'), to: '/app/self-marketing', accent: false };
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20, padding: '12px 16px', borderRadius: 'var(--radius)', border: `1px solid ${step.accent ? 'var(--accent)' : 'var(--border)'}`, background: step.accent ? 'rgba(224, 38, 57, 0.06)' : 'var(--bg-1)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-1)' }}>{t('appHome.nextStep')}</span>
            <span style={{ fontSize: 14, flex: 1, minWidth: 180 }}>{step.label}</span>
            <Link to={step.to} className={step.accent ? 'btn btn-primary' : 'btn'} style={{ fontSize: 13, padding: '7px 16px' }}>{step.cta}</Link>
          </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Card title={t('appHome.onboardingTitle')}>
          <p style={{ margin: '0 0 10px', color: 'var(--fg-1)', fontSize: 14 }}>
            {onboardingDone ? t('appHome.onboardingSubmitted') : t('appHome.onboardingNone')}
          </p>
          <Link to="/app/onboarding" className="btn btn-primary" style={{ fontSize: 14, padding: '8px 14px' }}>
            {onboardingDone ? t('appHome.onboardingEdit') : t('appHome.onboardingCta')}
          </Link>
        </Card>

        <Card title={t('appHome.selfMarketingTitle')}>
          <p style={{ margin: '0 0 10px', color: 'var(--fg-1)', fontSize: 14 }}>{t('appHome.selfMarketingBody')}</p>
          <Link to="/app/self-marketing" className="btn btn-primary" style={{ fontSize: 14, padding: '8px 14px' }}>
            {t('appHome.selfMarketingCta')}
          </Link>
        </Card>

        <Card title={t('appHome.subscriptionTitle')}>
          <p data-testid="subscription-status" style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: subActive ? '#1e7e34' : pending ? 'var(--accent)' : 'var(--fg-1)' }}>
            {subActive
              ? `${t('appHome.subscriptionActive')}${activePkg ? ` — ${t(activePkg.nameKey)}` : ''}`
              : pending
                ? t('appHome.subscriptionPending')
                : ent.needsResync
                  ? t('appHome.subscriptionExpired')
                  : t('appHome.subscriptionNone')}
          </p>
          {subActive && ent.subscription?.currentPeriodEnd && (
            <p style={{ margin: '0 0 10px', color: 'var(--fg-1)', fontSize: 13 }}>
              {t(ent.subscription.cancelAtPeriodEnd ? 'appHome.subscriptionEnds' : 'appHome.subscriptionRenews', {
                date: fmtDate(ent.subscription.currentPeriodEnd),
              })}
            </p>
          )}
          {!subActive && !pending && intent && (
            <p style={{ margin: '0 0 10px', color: 'var(--fg-1)', fontSize: 14 }}>
              {t('appHome.packageIntent', { name: t(intent.nameKey) })}
            </p>
          )}
          {billingError && <p role="alert" style={{ margin: '0 0 10px', color: '#c0392b', fontSize: 13 }}>{t(billingError)}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {subActive && (
              <button className="btn" style={{ fontSize: 14, padding: '8px 14px' }} disabled={billingBusy} onClick={() => void openPortal()}>
                {t('appHome.subscriptionManage')}
              </button>
            )}
            {ent.needsResync && (
              <button className="btn" style={{ fontSize: 14, padding: '8px 14px' }} disabled={billingBusy} onClick={() => void ent.resync()}>
                {t('appHome.subscriptionResync')}
              </button>
            )}
            {!subActive && !pending && intent && (
              intent.priceId ? (
                <button className="btn btn-primary" style={{ fontSize: 14, padding: '8px 14px' }} disabled={billingBusy} onClick={() => void startCheckout()}>
                  {t('appHome.subscriptionCheckout', { name: t(intent.nameKey), amount: intent.monthlyAmount })}
                </button>
              ) : (
                <Link to="/contact" className="btn btn-primary" style={{ fontSize: 14, padding: '8px 14px' }}>
                  {t('appHome.subscriptionContact')}
                </Link>
              )
            )}
          </div>
        </Card>

      </div>

      {/* Comenzi de servicii (Felia 2 catalog) — clientul cere un serviciu + vede statusul/livrabilul. */}
      <ServiceOrdersPortal uid={user.uid} email={user.email || ''} displayName={user.displayName || ''} />
      {/* Portalul de marketing — datele reale ale clientului (read-only). */}
      <MarketingPortal uid={user.uid} />
      {/* F4: predicții comportamentale despre PROPRIII clienți (oglindite client-safe, read-only). */}
      <ContactPredictions uid={user.uid} />
      {/* Landing Pages ale clientului — performanță + lead-uri capturate (scoped prin rules). */}
      <LandingPagesPortal uid={user.uid} />
      {/* Automatizări client-scope — notificări + task-uri generate de motor pe contul lui. */}
      <ClientAutomationFeed uid={user.uid} />
      {/* Facturile clientului (Verticala 2) — doar cele emise, read-only + PDF. */}
      <InvoicesPortal uid={user.uid} />
    </main>
  );
}
