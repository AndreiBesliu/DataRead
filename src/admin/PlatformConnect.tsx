/**
 * Buton de conectare a contului de reclame al unui CLIENT la o platformă (Meta în v1) — pentru ingestia
 * automată. Citește statusul din `clients/{uid}/platformCredentials/meta` (admin-read) și pornește OAuth-ul
 * admin-gated (`initiateMetaOAuth`) → redirect către Meta → `metaOAuthCallback` stochează credențiala criptat.
 * „Deconectează" șterge credențiala (`disconnectPlatform`). Token-ul NU se atinge niciodată client-side.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';

type Status = 'loading' | 'none' | 'active' | 'needs_reconnect' | 'revoked';

export default function PlatformConnect({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('loading');
  const [accountName, setAccountName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const snap = await getDoc(doc(db, 'clients', uid, 'platformCredentials', 'meta'));
      if (!snap.exists()) { setStatus('none'); return; }
      const d = snap.data() as Record<string, unknown>;
      const s = d.status;
      setStatus(s === 'active' || s === 'needs_reconnect' || s === 'revoked' ? s : 'none');
      setAccountName((typeof d.accountName === 'string' && d.accountName) ? d.accountName : (typeof d.accountId === 'string' ? d.accountId : ''));
    } catch {
      setStatus('none');
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [uid]);

  const connect = async () => {
    setBusy(true); setErr('');
    try {
      const fn = httpsCallable<{ clientUid: string }, { authUrl?: string }>(functions, 'initiateMetaOAuth');
      const res = await fn({ clientUid: uid });
      const url = res.data?.authUrl;
      if (url) window.location.href = url; // redirect full-page către Meta; revine pe /api/meta/callback → /admin
      else { setErr(t('admin.connectors.err')); setBusy(false); }
    } catch (e) {
      console.warn('initiateMetaOAuth failed:', e);
      setErr(t('admin.connectors.err'));
      setBusy(false);
    }
  };
  const disconnect = async () => {
    if (!window.confirm(t('admin.connectors.disconnectConfirm'))) return;
    setBusy(true); setErr('');
    try {
      await httpsCallable(functions, 'disconnectPlatform')({ clientUid: uid, platform: 'meta' });
      await load();
    } catch (e) {
      console.warn('disconnectPlatform failed:', e);
      setErr(t('admin.connectors.err'));
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') return null;

  const wrap: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, padding: '8px 0' };
  const badge = (bg: string, txt: string) => <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: bg, borderRadius: 5, padding: '2px 8px' }}>{txt}</span>;

  return (
    <div style={wrap}>
      <span style={{ fontWeight: 700 }}>Meta Ads</span>
      {status === 'active' ? badge('#1877f2', t('admin.connectors.connected')) : null}
      {status === 'needs_reconnect' ? badge('#c0392b', t('admin.connectors.needsReconnect')) : null}
      {status === 'revoked' ? badge('#6b7280', t('admin.connectors.revoked')) : null}
      {accountName ? <span style={{ color: 'var(--fg-1)' }}>{accountName}</span> : null}

      {status === 'none' ? (
        <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busy} onClick={() => void connect()}>
          {busy ? '…' : t('admin.connectors.connectMeta')}
        </button>
      ) : (
        <>
          <button className="btn" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busy} onClick={() => void connect()}>
            {t('admin.connectors.reconnect')}
          </button>
          <button className="btn" style={{ padding: '5px 12px', fontSize: 12, color: '#c0392b' }} disabled={busy} onClick={() => void disconnect()}>
            {t('admin.connectors.disconnect')}
          </button>
        </>
      )}
      {err ? <span role="alert" style={{ color: '#c0392b', fontSize: 12 }}>{err}</span> : null}
    </div>
  );
}
