/**
 * Manager de proiecte LP (modal) — CRUD pe colecția `lpProjects`. Un proiect = nume + culoare (badge)
 * + opțional un client implicit. LP-urile se atribuie unui proiect prin `LandingPage.projectId`.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { coerceToLpProject, LP_PROJECT_COLORS, LP_PROJECT_NAME_MAX, type LpProject } from '../types/lpProject';

interface Row { id: string; data: LpProject }

export default function LpProjectManager({ clients, onClose }: { clients: { id: string; label: string }[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(LP_PROJECT_COLORS[0]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'lpProjects'), (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, data: coerceToLpProject(d.data()) })).sort((a, b) => a.data.name.localeCompare(b.data.name)));
    });
    return unsub;
  }, []);

  async function add() {
    const name = newName.trim().slice(0, LP_PROJECT_NAME_MAX);
    if (!name) return;
    await addDoc(collection(db, 'lpProjects'), { schema: 1, name, color: newColor, clientUid: '', createdAt: serverTimestamp() });
    setNewName('');
  }
  const update = (id: string, patch: Partial<LpProject>) => updateDoc(doc(db, 'lpProjects', id), patch).catch(() => {});
  async function remove(id: string, name: string) {
    if (!window.confirm(t('admin.lpStudio.prConfirmDelete', { name }))) return;
    await deleteDoc(doc(db, 'lpProjects', id)).catch(() => {});
  }

  const inp: CSSProperties = { padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-0)', color: 'var(--fg-0)', fontSize: 14 };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btnPrimary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' };
  const swatch = (c: string, active: boolean, onClick: () => void) => (
    <button key={c} onClick={onClick} title={c} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: active ? '2px solid var(--fg-0)' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, width: 'min(560px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>{t('admin.lpStudio.prTitle')}</h2>
          <button onClick={onClose} style={{ ...btn, marginLeft: 'auto' }}>{t('admin.lpStudio.back')}</button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <input style={{ ...inp, flex: '1 1 180px' }} value={newName} placeholder={t('admin.lpStudio.prNamePh')} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          <div style={{ display: 'flex', gap: 6 }}>{LP_PROJECT_COLORS.map((c) => swatch(c, c === newColor, () => setNewColor(c)))}</div>
          <button onClick={add} disabled={!newName.trim()} style={{ ...btnPrimary, opacity: newName.trim() ? 1 : 0.6 }}>+ {t('admin.lpStudio.prAdd')}</button>
        </div>

        {rows.length === 0 ? (
          <p style={{ color: 'var(--fg-1)', fontSize: 13 }}>{t('admin.lpStudio.prEmpty')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <input style={{ ...inp, flex: '1 1 140px' }} defaultValue={r.data.name} onBlur={(e) => { const v = e.target.value.trim().slice(0, LP_PROJECT_NAME_MAX); if (v && v !== r.data.name) update(r.id, { name: v }); else if (!v) e.target.value = r.data.name; }} />
                <div style={{ display: 'flex', gap: 5 }}>{LP_PROJECT_COLORS.map((c) => swatch(c, c === r.data.color, () => update(r.id, { color: c })))}</div>
                <select style={{ ...inp, flex: '1 1 140px' }} value={r.data.clientUid} onChange={(e) => update(r.id, { clientUid: e.target.value })}>
                  <option value="">{t('admin.lpStudio.prNoClient')}</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <button onClick={() => remove(r.id, r.data.name)} style={{ ...btn, padding: '4px 10px', color: '#c0392b' }}>{t('admin.lpStudio.delete')}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
