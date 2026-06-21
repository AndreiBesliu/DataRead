/**
 * „Sănătate" — control center read-only de cost/erori + setarea limitelor AI Self Marketing.
 *
 * Observabilitate (citire): consumul AI de azi pe cele DOUĂ coșuri fair-share (trial vs entitled) + automatizări,
 * și ultimele rapoarte de crash din aplicație. Setări (scriere admin): plafoanele fair-share + gate-ul email-verificat
 * (appConfig/selfMarketing) — complementul de cost al plafonului maxInstances. Coșul TRIAL mărginește costul de abuz
 * independent de clienții plătitori; coșul ENTITLED le e rezervat lor (abuzul trial nu-i mai poate înfometa).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import {
  coerceToSelfMarketingConfig,
  SELF_MKT_CONFIG_DEFAULT,
  SELF_POOL_ENTITLED_DOC,
  SELF_POOL_TRIAL_DOC,
  type SelfMarketingConfig,
} from '../types/selfMarketingConfig';

interface ErrRow { id: string; name?: string; message?: string; kind?: string; version?: string; at?: { toMillis?: () => number } }
interface Counter { day: string; count: number }

const today = () => new Date().toISOString().slice(0, 10);

export default function HealthPanel() {
  const { t } = useTranslation();
  const [errs, setErrs] = useState<ErrRow[]>([]);
  const [trial, setTrial] = useState<Counter | null>(null);
  const [entitled, setEntitled] = useState<Counter | null>(null);
  const [autoGlobal, setAutoGlobal] = useState<Counter | null>(null);
  const [cfg, setCfg] = useState<SelfMarketingConfig>(SELF_MKT_CONFIG_DEFAULT);
  const [form, setForm] = useState<SelfMarketingConfig>(SELF_MKT_CONFIG_DEFAULT);
  const [saveState, setSaveState] = useState<'idle' | 'busy' | 'saved' | 'err'>('idle');
  const [migrate, setMigrate] = useState<{ state: 'idle' | 'busy' | 'done' | 'err'; msg: string }>({ state: 'idle', msg: '' });
  // „Murdar" = admin a editat formularul fără să salveze încă → un snapshot remote NU trebuie să-i piardă editarea
  // (ex. al doilea admin salvează concurent). Ref (nu state) ca să fie citit în handler-ul de snapshot fără re-bind.
  const dirty = useRef(false);

  useEffect(() => {
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const ctr = (raw: unknown): Counter => { const x = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>; return { day: typeof x.day === 'string' ? x.day : '', count: num(x.count) }; };
    const o1 = onSnapshot(query(collection(db, 'errorReports'), orderBy('at', 'desc'), limit(50)),
      (s) => setErrs(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ErrRow, 'id'>) }))), () => setErrs([]));
    const o2 = onSnapshot(doc(db, 'aiUsage', SELF_POOL_TRIAL_DOC), (s) => setTrial(s.exists() ? ctr(s.data()) : null), () => setTrial(null));
    const o3 = onSnapshot(doc(db, 'aiUsage', SELF_POOL_ENTITLED_DOC), (s) => setEntitled(s.exists() ? ctr(s.data()) : null), () => setEntitled(null));
    const o4 = onSnapshot(doc(db, 'aiUsage', '__automationGlobal'), (s) => setAutoGlobal(s.exists() ? ctr(s.data()) : null), () => setAutoGlobal(null));
    const o5 = onSnapshot(doc(db, 'appConfig', 'selfMarketing'), (s) => {
      const c = coerceToSelfMarketingConfig(s.exists() ? s.data() : null);
      setCfg(c); // contoarele afișează plafonul curent (sursa de adevăr), indiferent de editări
      if (!dirty.current) setForm(c); // sincronizăm formularul DOAR dacă admin nu are editări nesalvate
    }, () => { setCfg(SELF_MKT_CONFIG_DEFAULT); });
    return () => { o1(); o2(); o3(); o4(); o5(); };
  }, []);

  // Editare formular: marchează „murdar" (snapshot-urile nu mai suprascriu) + resetează un mesaj de salvare vechi.
  const editForm = (patch: Partial<SelfMarketingConfig>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...patch }));
    setSaveState((st) => (st === 'saved' || st === 'err' ? 'idle' : st));
  };

  const save = async () => {
    setSaveState('busy');
    try {
      const c = coerceToSelfMarketingConfig(form); // clamp înainte de scriere → trece de reguli
      await setDoc(doc(db, 'appConfig', 'selfMarketing'), { ...c, updatedAt: serverTimestamp() }, { merge: true });
      dirty.current = false; // salvat → snapshot-ul poate resincroniza din nou
      setForm(c);
      setSaveState('saved');
    } catch {
      setSaveState('err');
    }
  };

  // Migrare unică de securitate: mută analiza AI internă de pe campaigns/{id} (citibilă de client) în
  // colecția admin-only campaignInsights + curăță câmpurile scurse din datele istorice. Idempotentă.
  const runMigration = async () => {
    setMigrate({ state: 'busy', msg: '' });
    try {
      const fn = httpsCallable<Record<string, never>, { migrated: number; scrubbed: number }>(functions, 'migrateCampaignInsights');
      const res = await fn({});
      setMigrate({ state: 'done', msg: t('admin.health.migrateDone', { migrated: res.data?.migrated ?? 0, scrubbed: res.data?.scrubbed ?? 0 }) });
    } catch {
      setMigrate({ state: 'err', msg: t('admin.health.migrateErr') });
    }
  };

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' };
  const td: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: 12, textAlign: 'left', verticalAlign: 'top' };
  const label: CSSProperties = { display: 'block', fontSize: 12, color: 'var(--fg-1)', fontWeight: 700, marginBottom: 4 };
  const input: CSSProperties = { width: 120, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const d = today();
  const todayCount = (c: Counter | null) => (c && c.day === d ? c.count : 0);
  const fmtAt = (v: ErrRow['at']) => { const ms = v && typeof v.toMillis === 'function' ? v.toMillis() : 0; return ms ? new Date(ms).toLocaleString('ro-RO') : '—'; };
  const num = (v: string, fallback: number) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; };

  return (
    <div style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18, margin: 0 }}>{t('admin.health.title')}</h2>
      <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '4px 0 14px', maxWidth: 680 }}>{t('admin.health.hint')}</p>

      {/* ── Setări: limite AI Self Marketing (fair-share + gate email) ── */}
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{t('admin.health.limitsTitle')}</div>
        <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '0 0 12px', maxWidth: 680 }}>{t('admin.health.limitsHint')}</p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <span style={label}>{t('admin.health.trialCap')}</span>
            <input type="number" min={0} max={100000} style={input} value={form.trialDailyCap}
              onChange={(e) => editForm({ trialDailyCap: num(e.target.value, form.trialDailyCap) })} />
          </div>
          <div>
            <span style={label}>{t('admin.health.entitledCap')}</span>
            <input type="number" min={0} max={100000} style={input} value={form.entitledDailyCap}
              onChange={(e) => editForm({ entitledDailyCap: num(e.target.value, form.entitledDailyCap) })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={form.requireEmailVerified}
              onChange={(e) => editForm({ requireEmailVerified: e.target.checked })} />
            {t('admin.health.requireEmailVerified')}
          </label>
          <button className="btn btn-primary" disabled={saveState === 'busy'} onClick={() => void save()}>
            {saveState === 'busy' ? t('admin.health.saving') : t('admin.health.save')}
          </button>
          {saveState === 'saved' && <span style={{ fontSize: 12, color: '#1e7e34' }}>{t('admin.health.saved')}</span>}
          {saveState === 'err' && <span style={{ fontSize: 12, color: '#c0392b' }}>{t('admin.health.saveErr')}</span>}
        </div>
      </div>

      {/* ── Mentenanță: migrări unice de date ── */}
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{t('admin.health.maintTitle')}</div>
        <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '0 0 12px', maxWidth: 680 }}>{t('admin.health.migrateHint')}</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" disabled={migrate.state === 'busy'} onClick={() => void runMigration()}>
            {migrate.state === 'busy' ? t('admin.health.migrateBusy') : t('admin.health.migrateBtn')}
          </button>
          {migrate.state === 'done' && <span style={{ fontSize: 12, color: '#1e7e34' }}>{migrate.msg}</span>}
          {migrate.state === 'err' && <span style={{ fontSize: 12, color: '#c0392b' }}>{migrate.msg}</span>}
        </div>
      </div>

      {/* ── Observabilitate: consum azi + erori ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 700 }}>{t('admin.health.trialAi')}</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{todayCount(trial)} <span style={{ fontSize: 14, color: 'var(--fg-1)', fontWeight: 400 }}>/ {cfg.trialDailyCap}</span></div>
          <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t('admin.health.today')}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 700 }}>{t('admin.health.entitledAi')}</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{todayCount(entitled)} <span style={{ fontSize: 14, color: 'var(--fg-1)', fontWeight: 400 }}>/ {cfg.entitledDailyCap}</span></div>
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
