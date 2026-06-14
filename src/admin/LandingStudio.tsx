/**
 * LP Studio — tab în /admin. Listează Landing Pages (landingPages, doc ID = slug) și comută în
 * editor (LpEditor) pentru creare/editare. Stare locală (fără rută URL). Telemetria/analytics se
 * adaugă în P5; agentul AI în P3.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { coerceToLandingPage, type LandingPage } from '../types/landingPage';
import LpEditor from './LpEditor';
import LpTemplatePicker from './LpTemplatePicker';

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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'landingPages'), (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, data: coerceToLandingPage(d.data()), updatedAtMs: tsToMs(d.data().updatedAt) }));
      next.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      setRows(next);
    });
    return unsub;
  }, []);

  const existingSlugs = useMemo(() => rows.map((r) => r.id), [rows]);

  const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 14, textAlign: 'left' };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btnPrimary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' };

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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>{t('admin.lpStudio.title')}</h2>
        <button onClick={() => setPicking(true)} style={{ ...btnPrimary, marginLeft: 'auto' }}>
          + {t('admin.lpStudio.new')}
        </button>
      </div>

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
