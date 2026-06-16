/**
 * „Self Marketing" — funnel-ul self-serve al clientului logat: Profil firmă → Oportunități → Strategie →
 * Detalii → Execuție. Felia 1: Profil + Strategie funcționale; restul „în curând". Clientul completează
 * profilul, apasă „Salvează + generează" → callable selfGenerateStrategy (primul AI accesibil clienților,
 * protejat de quotă de trial) → strategia (mai multe direcții) apare prin onSnapshot. Tot textul prin t().
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import i18n from '../i18n';
import { useAuthStore } from '../store/authStore';
import {
  SELF_PROFILE_DRAFT_KEY,
  coerceToSelfCompanyProfile,
  coerceToSelfProfileDraft,
  coerceToSelfStrategy,
  coerceToSelfQuota,
  emptySelfProfile,
  selfFreeRemaining,
  validateSelfProfile,
  type SelfCompanyProfile,
  type SelfStrategy,
  type SelfQuota,
} from '../types/selfMarketing';
import SelfStepper, { type SelfStep } from './SelfStepper';
import SelfProfileFields from './SelfProfileFields';
import AuthPanel from './AuthPanel';

const STEPS: SelfStep[] = [
  { key: 'profile', labelKey: 'selfMarketing.step_profile', available: true },
  { key: 'opportunities', labelKey: 'selfMarketing.step_opportunities', available: false },
  { key: 'strategy', labelKey: 'selfMarketing.step_strategy', available: true },
  { key: 'details', labelKey: 'selfMarketing.step_details', available: false },
  { key: 'execution', labelKey: 'selfMarketing.step_execution', available: false },
];
const STEP_PROFILE = 0;
const STEP_STRATEGY = 2;

export default function SelfMarketingFunnel() {
  const { t } = useTranslation();
  const { user, initializing } = useAuthStore();
  const [step, setStep] = useState(STEP_PROFILE);
  const [data, setData] = useState<SelfCompanyProfile>(emptySelfProfile());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [strategy, setStrategy] = useState<SelfStrategy | null>(null);
  const [quota, setQuota] = useState<SelfQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; key: string } | null>(null);
  const justSaved = useRef(false);

  // Încărcare profil (Firestore bate draftul local) + abonare la strategie & quotă.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      let initial: SelfCompanyProfile | null = null;
      try {
        const snap = await getDoc(doc(db, 'clients', user.uid, 'selfMarketing', 'profile'));
        if (snap.exists()) initial = coerceToSelfCompanyProfile(snap.data());
      } catch {
        /* offline — mergem pe draft */
      }
      if (!initial) {
        let raw: string | null = null;
        try {
          raw = localStorage.getItem(SELF_PROFILE_DRAFT_KEY);
        } catch {
          /* private mode */
        }
        initial = coerceToSelfProfileDraft(raw);
      }
      if (!cancelled) {
        if (initial) setData(initial);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const offS = onSnapshot(
      doc(db, 'clients', user.uid, 'selfMarketing', 'strategy'),
      (snap) => setStrategy(snap.exists() ? coerceToSelfStrategy(snap.data()) : null),
      () => setStrategy(null)
    );
    const offQ = onSnapshot(
      doc(db, 'clients', user.uid, 'selfMarketing', 'quota'),
      (snap) => setQuota(snap.exists() ? coerceToSelfQuota(snap.data()) : null),
      () => setQuota(null)
    );
    return () => {
      offS();
      offQ();
    };
  }, [user]);

  // Autosave draft local (după încărcare, ca să nu suprascriem cu gol).
  useEffect(() => {
    if (!loaded || justSaved.current) return;
    try {
      localStorage.setItem(SELF_PROFILE_DRAFT_KEY, JSON.stringify(data));
    } catch {
      /* private mode */
    }
  }, [data, loaded]);

  const remaining = useMemo(() => selfFreeRemaining(quota), [quota]);

  if (initializing) {
    return <main data-page="self-loading" style={{ padding: 64, textAlign: 'center', color: 'var(--fg-1)' }}>…</main>;
  }
  if (!user) return <AuthPanel />;

  const set = <K extends keyof SelfCompanyProfile>(k: K, v: SelfCompanyProfile[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    setErrors((e) => {
      if (!(k in e)) return e;
      const { [k]: _drop, ...rest } = e;
      return rest;
    });
  };

  const generate = async () => {
    const v = validateSelfProfile(data);
    setErrors(v.errors);
    if (!v.ok) {
      setStep(STEP_PROFILE);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await setDoc(
        doc(db, 'clients', user.uid, 'selfMarketing', 'profile'),
        { ...data, schema: 1, locale: i18n.language === 'en' ? 'en' : 'ro', updatedAt: serverTimestamp() },
        { merge: true }
      );
      justSaved.current = true;
      try {
        localStorage.removeItem(SELF_PROFILE_DRAFT_KEY);
      } catch {
        /* private mode */
      }
      const fn = httpsCallable<{ profile: SelfCompanyProfile }, { strategy?: unknown }>(functions, 'selfGenerateStrategy');
      await fn({ profile: data });
      setStep(STEP_STRATEGY); // strategia vine live prin onSnapshot
      setMsg({ kind: 'ok', key: 'selfMarketing.genDone' });
    } catch (e) {
      const code = String((e as { code?: string }).code ?? '');
      const key = code.endsWith('resource-exhausted')
        ? 'selfMarketing.genQuota'
        : code.endsWith('unauthenticated')
          ? 'selfMarketing.genAuth'
          : code.endsWith('invalid-argument')
            ? 'selfMarketing.genInvalid'
            : code.endsWith('not-found') || code.endsWith('internal')
              ? 'selfMarketing.genNotReady'
              : 'selfMarketing.genError';
      console.warn('selfGenerateStrategy failed:', e);
      setMsg({ kind: 'err', key });
    } finally {
      setBusy(false);
    }
  };

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px' };
  const field: CSSProperties = { display: 'grid', gap: 3, marginTop: 8 };

  return (
    <main data-page="self-marketing-funnel" style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px' }}>
      <Link to="/app" style={{ fontSize: 13 }}>← {t('selfMarketing.backApp')}</Link>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', margin: '8px 0 4px' }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>{t('selfMarketing.funnelTitle')}</h1>
        <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t('selfMarketing.remaining', { count: remaining })}</span>
      </div>
      <p style={{ color: 'var(--fg-1)', fontSize: 14, margin: '0 0 16px' }}>{t('selfMarketing.funnelIntro')}</p>

      <SelfStepper steps={STEPS} current={step} onSelect={setStep} />

      {msg && (
        <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ fontSize: 13, marginBottom: 12, color: msg.kind === 'err' ? '#c0392b' : '#1e7e34', background: msg.kind === 'err' ? '#fdf0ef' : '#e8f5ec', border: `1px solid ${msg.kind === 'err' ? '#f0c4c0' : '#b5dcc0'}`, borderRadius: 8, padding: '8px 12px' }}>
          {t(msg.key)}
        </div>
      )}

      {/* Pas 1 — Profil firmă */}
      {step === STEP_PROFILE && (
        <div>
          <SelfProfileFields data={data} errors={errors} set={set} />
          <button className="btn btn-primary" disabled={busy || remaining <= 0} onClick={() => void generate()} style={{ marginTop: 16, padding: '11px 26px', fontSize: 15 }}>
            {busy ? t('selfMarketing.generating') : t('selfMarketing.generate')}
          </button>
          {remaining <= 0 && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 8 }}>{t('selfMarketing.genQuota')}</p>}
        </div>
      )}

      {/* Pas 3 — Strategie */}
      {step === STEP_STRATEGY && (
        <div>
          {!strategy || strategy.directions.length === 0 ? (
            <p style={{ color: 'var(--fg-1)' }}>{t('selfMarketing.strategyEmpty')}</p>
          ) : (
            <>
              {strategy.overview && (
                <div style={{ ...card, marginBottom: 14 }}>
                  <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>{t('selfMarketing.overviewTitle')}</h2>
                  <p style={{ fontSize: 14, color: 'var(--fg-0)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{strategy.overview}</p>
                </div>
              )}
              <div style={{ display: 'grid', gap: 12 }}>
                {strategy.directions.map((dir, i) => (
                  <div key={i} style={card}>
                    <h3 style={{ fontSize: 16, margin: 0, color: 'var(--accent)' }}>{i + 1}. {dir.title || '—'}</h3>
                    {dir.positioningAngle && <div style={field}><strong style={{ fontSize: 12 }}>{t('selfMarketing.dPositioning')}</strong><span style={{ fontSize: 13, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{dir.positioningAngle}</span></div>}
                    {dir.targetSegment && <div style={field}><strong style={{ fontSize: 12 }}>{t('selfMarketing.dSegment')}</strong><span style={{ fontSize: 13, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{dir.targetSegment}</span></div>}
                    {dir.channelMix && <div style={field}><strong style={{ fontSize: 12 }}>{t('selfMarketing.dChannels')}</strong><span style={{ fontSize: 13, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{dir.channelMix}</span></div>}
                    {dir.keyMessages && <div style={field}><strong style={{ fontSize: 12 }}>{t('selfMarketing.dMessages')}</strong><span style={{ fontSize: 13, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{dir.keyMessages}</span></div>}
                    {dir.campaignIdeas && <div style={field}><strong style={{ fontSize: 12 }}>{t('selfMarketing.dIdeas')}</strong><span style={{ fontSize: 13, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{dir.campaignIdeas}</span></div>}
                    {dir.kpis && <div style={field}><strong style={{ fontSize: 12 }}>{t('selfMarketing.dKpis')}</strong><span style={{ fontSize: 13, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{dir.kpis}</span></div>}
                  </div>
                ))}
              </div>
            </>
          )}
          <button className="btn" onClick={() => setStep(STEP_PROFILE)} style={{ marginTop: 16, padding: '9px 20px', fontSize: 14 }}>
            {t('selfMarketing.editProfile')}
          </button>
        </div>
      )}

      {/* Pașii 2 / 4 / 5 — în curând */}
      {(step === 1 || step === 3 || step === 4) && (
        <div style={{ ...card, textAlign: 'center', color: 'var(--fg-1)' }}>
          <p style={{ margin: 0 }}>{t('selfMarketing.stepSoon')}</p>
        </div>
      )}
    </main>
  );
}
