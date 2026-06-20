/**
 * „Sănătate" — tab read-only de observabilitate pentru operatori. Acum că suprafața AI e publică (Self Marketing)
 * și avem un plafon de instanțe, aici vezi: consumul AI de azi (backstop-urile globale) + ultimele rapoarte de
 * crash. Pur citire (errorReports = read admin; aiUsage = read admin); nu scrie nimic.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

interface ErrRow { id: string; name?: string; message?: string; kind?: string; version?: string; at?: { toMillis?: () => number } }
interface Counter { day: string; count: number }

const today = () => new Date().toISOString().slice(0, 10);

export default function HealthPanel() {
  const { t } = useTranslation();
  const [errs, setErrs] = useState<ErrRow[]>([]);
  const [selfGlobal, setSelfGlobal] = useState<Counter | null>(null);
  const [autoGlobal, setAutoGlobal] = useState<Counter | null>(null);

  useEffect(() => {
    const o1 = onSnapshot(query(collection(db, 'errorReports'), orderBy('at', 'desc'), limit(50)),
      (s) => setErrs(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ErrRow, 'id'>) }))), () => setErrs([]));
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const ctr = (raw: unknown): Counter => { const x = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>; return { day: typeof x.day === 'string' ? x.day : '', count: num(x.count) }; };
    const o2 = onSnapshot(doc(db, 'aiUsage', '__selfGlobal'), (s) => setSelfGlobal(s.exists() ? ctr(s.data()) : null), () => setSelfGlobal(null));
    const o3 = onSnapshot(doc(db, 'aiUsage', '__automationGlobal'), (s) => setAutoGlobal(s.exists() ? ctr(s.data()) : null), () => setAutoGlobal(null));
    return () => { o1(); o2(); o3(); };
  }, []);

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' };
  const td: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: 12, textAlign: 'left', verticalAlign: 'top' };
  const d = today();
  // Contoarele sunt pe zi: dacă ziua stocată nu e azi, afișăm 0 (fereastra s-a resetat).
  const todayCount = (c: Counter | null) => (c && c.day === d ? c.count : 0);
  const fmtAt = (v: ErrRow['at']) => { const ms = v && typeof v.toMillis === 'function' ? v.toMillis() : 0; return ms ? new Date(ms).toLocaleString('ro-RO') : '—'; };

  return (
    <div style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18, margin: 0 }}>{t('admin.health.title')}</h2>
      <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '4px 0 14px', maxWidth: 640 }}>{t('admin.health.hint')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 700 }}>{t('admin.health.selfAi')}</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{todayCount(selfGlobal)}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.health.today')}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 700 }}>{t('admin.health.autoAi')}</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{todayCount(autoGlobal)}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.health.today')}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 700 }}>{t('admin.health.errors')}</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: errs.length ? '#c0392b' : 'var(--fg-0)' }}>{errs.length}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.health.last50')}</div>
        </div>
      </div>

      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>{t('admin.health.errors')}</h3>
      {errs.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t('admin.health.noErrors')}</p>
      ) : (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--bg-0)' }}>
              <th style={td}>{t('admin.health.colWhen')}</th>
              <th style={td}>{t('admin.health.colKind')}</th>
              <th style={td}>{t('admin.health.colError')}</th>
              <th style={td}>{t('admin.health.colVersion')}</th>
            </tr></thead>
            <tbody>
              {errs.map((e) => (
                <tr key={e.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtAt(e.at)}</td>
                  <td style={td}>{e.kind || '—'}</td>
                  <td style={td}><strong>{e.name || 'Error'}</strong>{e.message ? <span style={{ color: 'var(--fg-1)' }}> — {e.message}</span> : null}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--fg-1)' }}>{e.version || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
