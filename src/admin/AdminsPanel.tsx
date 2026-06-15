/**
 * Tab „Administratori" — management RBAC al accesului la /admin. TOATE mutațiile (approve/reject/revoke/
 * setRole) trec prin callable-ul owner-only `manageAdmin` (autoritate Firestore, last-owner, audit).
 * Clientul nu mai scrie direct în admins/adminRequests (reguli: write false).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import type { AdminRole } from '../types/adminRole';

// Trebuie să coincidă cu BOOTSTRAP_ADMIN_UID din functions/index.js (founder-ul = owner implicit).
export const BOOTSTRAP_ADMIN_UID = 'IMBKFBkONkOB7VVZCmqgS90JdBi2';

interface ReqRow { uid: string; email: string; displayName: string; requestedAt: unknown }
interface AdminRow { uid: string; role: AdminRole; email: string; displayName: string; approvedBy: string; approvedAt: unknown }
interface AuditRow { id: string; action: string; actorEmail: string; targetEmail: string; targetUid: string; role: string | null; at: unknown }

function tsStr(v: unknown): string {
  const t = v as { toDate?: () => Date } | null;
  try { return t && typeof t.toDate === 'function' ? t.toDate().toLocaleString('ro-RO') : '—'; } catch { return '—'; }
}
function roleOf(uid: string, role: unknown): AdminRole {
  if (role === 'owner' || role === 'operator') return role;
  return uid === BOOTSTRAP_ADMIN_UID ? 'owner' : 'operator';
}

export default function AdminsPanel({ myUid, isOwner }: { myUid: string; isOwner: boolean }) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<ReqRow[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [busy, setBusy] = useState<string>(''); // uid în curs de procesare
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    const offReq = onSnapshot(query(collection(db, 'adminRequests'), where('status', '==', 'pending')), (snap) => {
      setRequests(snap.docs.map((d) => { const x = d.data(); return { uid: d.id, email: String(x.email || ''), displayName: String(x.displayName || ''), requestedAt: x.requestedAt }; }));
    }, () => setRequests([]));
    const offAdm = onSnapshot(collection(db, 'admins'), (snap) => {
      const rows = snap.docs.map((d) => { const x = d.data(); return { uid: d.id, role: roleOf(d.id, x.role), email: String(x.email || ''), displayName: String(x.displayName || ''), approvedBy: String(x.approvedBy || ''), approvedAt: x.approvedAt }; });
      rows.sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === 'owner' ? -1 : 1));
      setAdmins(rows);
    }, () => setAdmins([]));
    const offAud = onSnapshot(query(collection(db, 'adminAudit'), orderBy('at', 'desc'), limit(50)), (snap) => {
      setAudit(snap.docs.map((d) => { const x = d.data(); return { id: d.id, action: String(x.action || ''), actorEmail: String(x.actorEmail || ''), targetEmail: String(x.targetEmail || ''), targetUid: String(x.targetUid || ''), role: x.role ? String(x.role) : null, at: x.at }; }));
    }, () => setAudit([]));
    return () => { offReq(); offAdm(); offAud(); };
  }, []);

  const ownerCount = useMemo(() => admins.filter((a) => a.role === 'owner').length, [admins]);

  async function act(action: string, targetUid: string, role?: AdminRole) {
    setErr('');
    setBusy(targetUid);
    try {
      const fn = httpsCallable<{ action: string; targetUid: string; role?: AdminRole }, { ok: boolean }>(functions, 'manageAdmin');
      await fn({ action, targetUid, role });
    } catch (e) {
      const code = (e as { code?: string; message?: string });
      const msg = String(code.message || '');
      setErr(msg.includes('last-owner') ? t('admin.errLastOwner') : msg.includes('not-owner') || msg.includes('permission') ? t('admin.errNotOwner') : t('admin.errGeneric'));
    } finally {
      setBusy('');
    }
  }

  const box: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto', marginBottom: 24 };
  const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 14, textAlign: 'left' };
  const th: CSSProperties = { ...td, background: 'var(--bg-0)', fontWeight: 700 };
  const btn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btnPrimary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' };
  const roleBadge = (r: AdminRole) => <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: r === 'owner' ? '#a855f7' : '#64748b', borderRadius: 6, padding: '1px 8px' }}>{t(r === 'owner' ? 'admin.roleOwner' : 'admin.roleOperator')}</span>;

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>{t('admin.adminsTitle')}</h2>
      {!isOwner ? <p style={{ color: 'var(--fg-1)', fontSize: 13, marginTop: 0 }}>{t('admin.ownerOnlyNote')}</p> : null}
      {err ? <p style={{ color: '#c0392b', fontSize: 13 }}>{err}</p> : null}

      {/* Cereri de acces în așteptare (acțiuni doar pentru owner). */}
      <h3 style={{ fontSize: 15, margin: '14px 0 8px' }}>{t('admin.requestsTitle')} ({requests.length})</h3>
      {requests.length === 0 ? (
        <p style={{ color: 'var(--fg-1)', fontSize: 13 }}>{t('admin.requestsEmpty')}</p>
      ) : (
        <div style={box}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>{t('admin.colEmail')}</th><th style={th}>{t('admin.colName')}</th><th style={th}>{t('admin.requestedAt')}</th><th style={th}></th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.uid}>
                  <td style={td}>{r.email || r.uid}</td>
                  <td style={td}>{r.displayName || '—'}</td>
                  <td style={{ ...td, color: 'var(--fg-1)', fontSize: 12 }}>{tsStr(r.requestedAt)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {isOwner ? (
                      <>
                        <button disabled={busy === r.uid} style={{ ...btnPrimary, marginRight: 6 }} onClick={() => act('approve', r.uid, 'operator')}>{t('admin.approve')}</button>
                        <button disabled={busy === r.uid} style={{ ...btn, color: '#c0392b' }} onClick={() => act('reject', r.uid)}>{t('admin.reject')}</button>
                      </>
                    ) : <span style={{ color: 'var(--fg-1)', fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Administratori activi. */}
      <h3 style={{ fontSize: 15, margin: '14px 0 8px' }}>{t('admin.adminsListTitle')} ({admins.length})</h3>
      <div style={box}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>{t('admin.colEmail')}</th><th style={th}>{t('admin.colRole')}</th><th style={th}>{t('admin.colApprovedAt')}</th><th style={th}></th></tr></thead>
          <tbody>
            {admins.map((a) => {
              const lastOwner = a.role === 'owner' && ownerCount <= 1;
              return (
                <tr key={a.uid}>
                  <td style={td}>{a.email || a.uid}{a.uid === myUid ? <span style={{ color: 'var(--fg-1)', fontSize: 11 }}> ({t('admin.you')})</span> : null}</td>
                  <td style={td}>{roleBadge(a.role)}</td>
                  <td style={{ ...td, color: 'var(--fg-1)', fontSize: 12 }}>{tsStr(a.approvedAt)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {isOwner ? (
                      <>
                        {a.role === 'operator'
                          ? <button disabled={busy === a.uid} style={{ ...btn, marginRight: 6 }} onClick={() => act('setRole', a.uid, 'owner')}>{t('admin.makeOwner')}</button>
                          : <button disabled={busy === a.uid || lastOwner} style={{ ...btn, marginRight: 6, opacity: lastOwner ? 0.5 : 1 }} title={lastOwner ? t('admin.errLastOwner') : ''} onClick={() => act('setRole', a.uid, 'operator')}>{t('admin.makeOperator')}</button>}
                        <button disabled={busy === a.uid || lastOwner} style={{ ...btn, color: '#c0392b', opacity: lastOwner ? 0.5 : 1 }} title={lastOwner ? t('admin.errLastOwner') : ''}
                          onClick={() => { if (window.confirm(t('admin.revokeConfirm', { name: a.email || a.uid }))) act('revoke', a.uid); }}>{t('admin.revoke')}</button>
                      </>
                    ) : <span style={{ color: 'var(--fg-1)', fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Jurnal de audit. */}
      <h3 style={{ fontSize: 15, margin: '14px 0 8px' }}>{t('admin.auditTitle')}</h3>
      {audit.length === 0 ? (
        <p style={{ color: 'var(--fg-1)', fontSize: 13 }}>{t('admin.auditEmpty')}</p>
      ) : (
        <div style={box}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>{t('admin.colWhen')}</th><th style={th}>{t('admin.colActor')}</th><th style={th}>{t('admin.colAction')}</th><th style={th}>{t('admin.colTarget')}</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td style={{ ...td, color: 'var(--fg-1)', fontSize: 12, whiteSpace: 'nowrap' }}>{tsStr(a.at)}</td>
                  <td style={td}>{a.actorEmail || '—'}</td>
                  <td style={td}>{t(`admin.act_${a.action}`, a.action)}{a.role ? ` → ${t(a.role === 'owner' ? 'admin.roleOwner' : 'admin.roleOperator')}` : ''}</td>
                  <td style={td}>{a.targetEmail || a.targetUid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
