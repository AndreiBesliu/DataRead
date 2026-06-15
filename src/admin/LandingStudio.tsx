/**
 * LP Studio — tab în /admin. Listează Landing Pages (landingPages, doc ID = slug) și comută în
 * editor (LpEditor) pentru creare/editare. Stare locală (fără rută URL). Telemetria/analytics se
 * adaugă în P5; agentul AI în P3.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { coerceToLandingPage, htmlByteSize, LP_HTML_MAX, recompileLpAssets, type LandingPage } from '../types/landingPage';
import { coerceToLpStatsDay, lpKpis, sumLpStats, type LpKpis, type LpStatsDay } from '../analytics/lpStats';
import LpEditor from './LpEditor';
import LpTemplatePicker from './LpTemplatePicker';

const OVERVIEW_DAYS = 7; // fereastra de performanță afișată în listă (rollup-uri zilnice)

interface Row {
  id: string;
  data: LandingPage;
  updatedAtMs: number;
}

function tsToMs(v: unknown): number {
  const t = v as { toMillis?: () => number } | null;
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

export default function LandingStudio({ adminUid }: { adminUid: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<{ docId: string | null; initial: LandingPage } | null>(null);
  const [picking, setPicking] = useState(false);
  const [recompiling, setRecompiling] = useState(false);
  const [recompileMsg, setRecompileMsg] = useState('');
  const [metrics, setMetrics] = useState<Record<string, LpKpis>>({});
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const [metricsPartial, setMetricsPartial] = useState(false); // true dacă o citire per pagină a eșuat (total parțial)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'landingPages'), (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, data: coerceToLandingPage(d.data()), updatedAtMs: tsToMs(d.data().updatedAt) }));
      next.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      setRows(next);
    });
    return unsub;
  }, []);

  const existingSlugs = useMemo(() => rows.map((r) => r.id), [rows]);
  // Cheie independentă de ORDINE: rows e sortat după updatedAt, deci o editare reordonează lista fără
  // a schimba SETUL de pagini — sortăm înainte de join ca efectul de metrics să nu refacă citirile la
  // fiecare salvare (altfel „recompilează toate" ar amplifica citirile la O(N²)).
  const slugKey = [...existingSlugs].sort().join('|');

  // Overview de trafic per pagină (ultimele 7 zile) — citește rollup-urile zilnice (limit OVERVIEW_DAYS/pagină,
  // în paralel) și agregă prin motorul pur lpStats. Re-rulează doar când setul de pagini se schimbă (slugKey),
  // nu la fiecare tick onSnapshot, ca să nu refacem citirile la orice editare de metadate.
  useEffect(() => {
    if (existingSlugs.length === 0) { setMetrics({}); setMetricsLoaded(true); setMetricsPartial(false); return; }
    let cancel = false;
    setMetricsLoaded(false);
    (async () => {
      const entries = await Promise.all(
        existingSlugs.map(async (id) => {
          try {
            const snap = await getDocs(query(collection(db, 'landingPages', id, 'stats'), orderBy('date', 'desc'), limit(OVERVIEW_DAYS)));
            const days = snap.docs.map((d) => coerceToLpStatsDay(d.data())).filter((x): x is LpStatsDay => !!x);
            return [id, lpKpis(sumLpStats(days))] as const;
          } catch {
            return [id, null] as const;
          }
        })
      );
      if (cancel) return;
      const m: Record<string, LpKpis> = {};
      let partial = false;
      for (const [id, k] of entries) { if (k) m[id] = k; else partial = true; }
      setMetrics(m);
      setMetricsPartial(partial);
      setMetricsLoaded(true);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugKey]);

  const overview = useMemo(() => {
    const vals = Object.values(metrics);
    const visits = vals.reduce((s, k) => s + k.visits, 0);
    const submissions = vals.reduce((s, k) => s + k.submissions, 0);
    return { visits, submissions, convRate: visits > 0 ? submissions / visits : null };
  }, [metrics]);

  const fmtN = (n: number) => n.toLocaleString('ro-RO');
  const fmtPct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

  const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 14, textAlign: 'left' };
  const tdNum: CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btnPrimary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' };
  const ovCard: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', minWidth: 110 };
  const ovVal: CSSProperties = { fontSize: 20, fontWeight: 800, color: 'var(--fg-0)' };
  const ovLabel: CSSProperties = { fontSize: 11, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.4 };

  if (editing) {
    return (
      <LpEditor
        initial={editing.initial}
        docId={editing.docId}
        adminUid={adminUid}
        existingSlugs={editing.docId === null ? existingSlugs : existingSlugs.filter((s) => s !== editing.docId)}
        onClose={() => setEditing(null)}
        onSaved={(slug) => setEditing((cur) => (cur ? { ...cur, docId: slug } : cur))}
      />
    );
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(t('admin.lpStudio.confirmDelete', { name: title || id }))) return;
    await deleteDoc(doc(db, 'landingPages', id)).catch(() => {});
  }

  // Recompilează asset-urile servite (html din blocuri + pageDecorHtml) ale TUTUROR paginilor cu logica
  // curentă de compilare — paginile vechi prind îmbunătățirile (ex. scalarea decorului) fără re-salvare.
  // Tranzacție per pagină: re-citim documentul PROASPĂT, recompilăm din el și scriem — ca o editare
  // concurentă (alt operator/alt tab) să nu fie suprascrisă cu date vechi (lost-update).
  async function recompileAll() {
    if (!window.confirm(t('admin.lpStudio.recompileConfirm', { count: rows.length }))) return;
    setRecompiling(true);
    setRecompileMsg('');
    let updated = 0, unchanged = 0, skipped = 0, failed = 0;
    for (const r of rows) {
      try {
        const outcome = await runTransaction(db, async (tx) => {
          const ref = doc(db, 'landingPages', r.id);
          const snap = await tx.get(ref);
          if (!snap.exists()) return 'gone';
          const cur = snap.data();
          const a = recompileLpAssets(coerceToLandingPage(cur)); // recompilează din conținutul CURENT
          if (htmlByteSize(a.html) > LP_HTML_MAX) return 'skipped'; // octeți UTF-8 = ce validează regulile
          const changed = a.html !== (cur.html ?? '') || a.pageDecorHtml !== (cur.pageDecorHtml ?? '') || a.hasForm !== !!cur.hasForm;
          if (!changed) return 'unchanged';
          tx.update(ref, { schema: 1, html: a.html, pageDecorHtml: a.pageDecorHtml, hasForm: a.hasForm, form: a.form, updatedAt: serverTimestamp() });
          return 'updated';
        });
        if (outcome === 'updated') updated++;
        else if (outcome === 'unchanged') unchanged++;
        else if (outcome === 'skipped') skipped++;
        // 'gone' (ștearsă între timp) → ignorăm
      } catch {
        failed++;
      }
    }
    setRecompiling(false);
    setRecompileMsg(t('admin.lpStudio.recompileDone', { updated, unchanged, skipped, failed }));
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>{t('admin.lpStudio.title')}</h2>
        {rows.length > 0 ? (
          <button onClick={recompileAll} disabled={recompiling} style={{ ...btn, marginLeft: 'auto', opacity: recompiling ? 0.6 : 1 }} title={t('admin.lpStudio.recompileHint')}>
            ↻ {recompiling ? t('admin.lpStudio.recompileRunning') : t('admin.lpStudio.recompileAll')}
          </button>
        ) : null}
        <button onClick={() => setPicking(true)} style={{ ...btnPrimary, marginLeft: rows.length > 0 ? 0 : 'auto' }}>
          + {t('admin.lpStudio.new')}
        </button>
      </div>
      {recompileMsg ? <p style={{ fontSize: 13, color: 'var(--fg-1)', marginTop: -6, marginBottom: 12 }}>{recompileMsg}</p> : null}

      {rows.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={ovCard}><div style={ovVal}>{metricsLoaded ? fmtN(overview.visits) : '—'}</div><div style={ovLabel}>{t('admin.lpStudio.ovVisits')}</div></div>
          <div style={ovCard}><div style={ovVal}>{metricsLoaded ? fmtN(overview.submissions) : '—'}</div><div style={ovLabel}>{t('admin.lpStudio.ovLeads')}</div></div>
          <div style={ovCard}><div style={ovVal}>{metricsLoaded ? fmtPct(overview.convRate) : '—'}</div><div style={ovLabel}>{t('admin.lpStudio.ovConv')}</div></div>
          <div style={{ alignSelf: 'flex-end', fontSize: 11, color: 'var(--fg-1)', paddingBottom: 4 }}>
            {t('admin.lpStudio.ovLast7')}{metricsLoaded && metricsPartial ? ` · ${t('admin.lpStudio.ovPartial')}` : ''}
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.lpStudio.listEmpty')}</p>
      ) : (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-0)' }}>
                <th style={td}>{t('admin.lpStudio.colTitle')}</th>
                <th style={td}>{t('admin.lpStudio.colSlug')}</th>
                <th style={td}>{t('admin.lpStudio.colStatus')}</th>
                <th style={tdNum}>{t('admin.lpStudio.colVisits7')}</th>
                <th style={tdNum}>{t('admin.lpStudio.colLeads7')}</th>
                <th style={tdNum}>{t('admin.lpStudio.colConv')}</th>
                <th style={td}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={td}>{r.data.title || <span style={{ color: 'var(--fg-1)' }}>—</span>}</td>
                  <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>/p/{r.id}</td>
                  <td style={td}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.data.status === 'published' ? '#1e7e34' : 'var(--fg-1)' }}>
                      {r.data.status === 'published' ? t('admin.lpStudio.statusPublished') : t('admin.lpStudio.statusDraft')}
                    </span>
                  </td>
                  <td style={tdNum}>{metrics[r.id] ? fmtN(metrics[r.id].visits) : '—'}</td>
                  <td style={tdNum}>{metrics[r.id] ? fmtN(metrics[r.id].submissions) : '—'}</td>
                  <td style={{ ...tdNum, color: 'var(--fg-1)' }}>{metrics[r.id] ? fmtPct(metrics[r.id].convRate) : '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditing({ docId: r.id, initial: r.data })} style={{ ...btn, padding: '4px 10px', marginRight: 6 }}>
                      {t('admin.lpStudio.edit')}
                    </button>
                    <button onClick={() => remove(r.id, r.data.title)} style={{ ...btn, padding: '4px 10px', color: '#c0392b' }}>
                      {t('admin.lpStudio.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {picking ? (
        <LpTemplatePicker
          adminUid={adminUid}
          onPick={(initial) => {
            setPicking(false);
            setEditing({ docId: null, initial });
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}
