/**
 * „Self Marketing" — funnel-ul self-serve al clientului logat: Profil firmă → Oportunități → Strategie →
 * Detalii → Execuție. Profil + Strategie + Detalii funcționale (Oportunități/Execuție „în curând"). Clientul
 * completează profilul → selfGenerateStrategy (strategie cu mai multe direcții) → alege o direcție și o
 * aprofundează cu selfGenerateDetails. Export PDF/copy pe strategie & detalii. Tot textul prin t().
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
  SELF_DAILY_CAP,
  coerceToSelfCompanyProfile,
  coerceToSelfProfileDraft,
  coerceToSelfStrategy,
  coerceToSelfDetails,
  coerceToSelfQuota,
  emptySelfProfile,
  selfFreeRemaining,
  validateSelfProfile,
  type SelfCompanyProfile,
  type SelfStrategy,
  type SelfDetails,
  type SelfQuota,
} from '../types/selfMarketing';
import { composePrintHtml, printHtmlDoc, printTitle } from '../utils/printDoc';
import SelfStepper, { type SelfStep } from './SelfStepper';
import SelfProfileFields from './SelfProfileFields';
import AuthPanel from './AuthPanel';

const STEPS: SelfStep[] = [
  { key: 'profile', labelKey: 'selfMarketing.step_profile', available: true },
  { key: 'opportunities', labelKey: 'selfMarketing.step_opportunities', available: false },
  { key: 'strategy', labelKey: 'selfMarketing.step_strategy', available: true },
  { key: 'details', labelKey: 'selfMarketing.step_details', available: true },
  { key: 'execution', labelKey: 'selfMarketing.step_execution', available: false },
];
const STEP_PROFILE = 0;
const STEP_STRATEGY = 2;
const STEP_DETAILS = 3;

export default function SelfMarketingFunnel() {
  const { t } = useTranslation();
  const { user, initializing } = useAuthStore();
  const [step, setStep] = useState(STEP_PROFILE);
  const [data, setData] = useState<SelfCompanyProfile>(emptySelfProfile());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [strategy, setStrategy] = useState<SelfStrategy | null>(null);
  const [details, setDetails] = useState<SelfDetails | null>(null);
  const [quota, setQuota] = useState<SelfQuota | null>(null);
  const [selectedDir, setSelectedDir] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; key: string } | null>(null);
  const justSaved = useRef(false);

  // Încărcare profil (Firestore bate draftul local) + abonare la strategie/detalii/quotă.
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
    const base = (id: string) => doc(db, 'clients', user.uid, 'selfMarketing', id);
    const offS = onSnapshot(base('strategy'), (snap) => setStrategy(snap.exists() ? coerceToSelfStrategy(snap.data()) : null), () => setStrategy(null));
    const offD = onSnapshot(base('details'), (snap) => setDetails(snap.exists() ? coerceToSelfDetails(snap.data()) : null), () => setDetails(null));
    const offQ = onSnapshot(base('quota'), (snap) => setQuota(snap.exists() ? coerceToSelfQuota(snap.data()) : null), () => setQuota(null));
    return () => { offS(); offD(); offQ(); };
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

  const today = new Date().toISOString().slice(0, 10);
  const lifetimeLeft = useMemo(() => selfFreeRemaining(quota), [quota]);
  const dailyLeft = useMemo(() => {
    const used = quota && quota.day === today ? quota.dayCount : 0;
    return Math.max(0, SELF_DAILY_CAP - used);
  }, [quota, today]);
  const canGenerate = lifetimeLeft > 0 && dailyLeft > 0;

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

  // Mapează codul de eroare al callable-ului pe o cheie i18n.
  const errKey = (e: unknown): string => {
    const code = String((e as { code?: string }).code ?? '');
    if (code.endsWith('resource-exhausted')) return 'selfMarketing.genQuota';
    if (code.endsWith('unauthenticated')) return 'selfMarketing.genAuth';
    if (code.endsWith('invalid-argument')) return 'selfMarketing.genInvalid';
    if (code.endsWith('failed-precondition')) return 'selfMarketing.genNeedStrategy';
    if (code.endsWith('not-found') || code.endsWith('internal')) return 'selfMarketing.genNotReady';
    return 'selfMarketing.genError';
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
      console.warn('selfGenerateStrategy failed:', e);
      setMsg({ kind: 'err', key: errKey(e) });
    } finally {
      setBusy(false);
    }
  };

  const generateDetails = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const fn = httpsCallable<{ directionIndex: number }, { details?: unknown }>(functions, 'selfGenerateDetails');
      await fn({ directionIndex: selectedDir });
      setMsg({ kind: 'ok', key: 'selfMarketing.detailsDone' });
    } catch (e) {
      console.warn('selfGenerateDetails failed:', e);
      setMsg({ kind: 'err', key: errKey(e) });
    } finally {
      setBusy(false);
    }
  };

  // ── Export (copy + PDF) — reutilizează printDoc.ts (text AI escapat acolo). ──
  const strategySections = (s: SelfStrategy) => [
    { label: t('selfMarketing.overviewTitle'), body: s.overview },
    ...s.directions.flatMap((d, i) => [{
      label: `${i + 1}. ${d.title}`,
      body: [
        `${t('selfMarketing.dPositioning')}: ${d.positioningAngle}`,
        `${t('selfMarketing.dSegment')}: ${d.targetSegment}`,
        `${t('selfMarketing.dChannels')}: ${d.channelMix}`,
        `${t('selfMarketing.dMessages')}: ${d.keyMessages}`,
        `${t('selfMarketing.dIdeas')}: ${d.campaignIdeas}`,
        `${t('selfMarketing.dKpis')}: ${d.kpis}`,
      ].join('\n'),
    }]),
  ];
  const detailsSections = (d: SelfDetails) => [
    { label: t('selfMarketing.dBudget'), body: d.budgetSplit },
    { label: t('selfMarketing.dAudienceDetail'), body: d.audienceDetail },
    { label: t('selfMarketing.dMessaging'), body: d.messaging },
    { label: t('selfMarketing.dFunnel'), body: d.funnel },
    { label: t('selfMarketing.dBrief'), body: d.campaignBrief },
    { label: t('selfMarketing.dTimeline'), body: d.timeline },
  ];
  const sectionsToText = (secs: { label: string; body: string }[]) =>
    secs.filter((s) => s.body && s.body.trim()).map((s) => `## ${s.label}\n${s.body}`).join('\n\n');
  const copy = async (secs: { label: string; body: string }[]) => {
    try {
      await navigator.clipboard.writeText(sectionsToText(secs));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ kind: 'err', key: 'selfMarketing.copyFail' });
    }
  };
  const exportPdf = (title: string, secs: { label: string; body: string }[]) => {
    printHtmlDoc(composePrintHtml({
      title: printTitle([t('selfMarketing.funnelTitle'), data.companyName, title]),
      meta: [data.companyName].filter(Boolean) as string[],
      sections: secs,
    }));
  };

  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px' };
  const field: CSSProperties = { display: 'grid', gap: 3, marginTop: 8 };
  const detailField = (label: string, body: string) =>
    body ? <div style={field}><strong style={{ fontSize: 12 }}>{label}</strong><span style={{ fontSize: 13, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{body}</span></div> : null;
  const exportBar = (title: string, secs: { label: string; body: string }[]) => (
    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
      <button className="btn" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => void copy(secs)}>{copied ? t('selfMarketing.copied') : t('selfMarketing.copy')}</button>
      <button className="btn" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => exportPdf(title, secs)}>📄 {t('selfMarketing.exportPdf')}</button>
    </div>
  );

  // Bloc quotă: trial lifetime epuizat → CTA spre pachete; doar plafonul zilnic atins → „revino mâine".
  const quotaBlock = () => {
    if (lifetimeLeft <= 0) {
      return (
        <div style={{ ...card, marginTop: 12, textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px', color: 'var(--fg-0)' }}>{t('selfMarketing.quotaLifetime')}</p>
          <Link to="/self-marketing/pachete" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 14 }}>{t('selfMarketing.buyCredits')}</Link>
        </div>
      );
    }
    if (dailyLeft <= 0) return <p style={{ color: '#b25e09', fontSize: 13, marginTop: 8 }}>{t('selfMarketing.quotaDaily')}</p>;
    return null;
  };

  return (
    <main data-page="self-marketing-funnel" style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px' }}>
      <Link to="/app" style={{ fontSize: 13 }}>← {t('selfMarketing.backApp')}</Link>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', margin: '8px 0 4px' }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>{t('selfMarketing.funnelTitle')}</h1>
        <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t('selfMarketing.remaining', { count: lifetimeLeft })}</span>
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
          <button className="btn btn-primary" disabled={busy || !canGenerate} onClick={() => void generate()} style={{ marginTop: 16, padding: '11px 26px', fontSize: 15 }}>
            {busy ? t('selfMarketing.generating') : t('selfMarketing.generate')}
          </button>
          {quotaBlock()}
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
                    {detailField(t('selfMarketing.dPositioning'), dir.positioningAngle)}
                    {detailField(t('selfMarketing.dSegment'), dir.targetSegment)}
                    {detailField(t('selfMarketing.dChannels'), dir.channelMix)}
                    {detailField(t('selfMarketing.dMessages'), dir.keyMessages)}
                    {detailField(t('selfMarketing.dIdeas'), dir.campaignIdeas)}
                    {detailField(t('selfMarketing.dKpis'), dir.kpis)}
                    <div style={{ marginTop: 10 }}>
                      <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 13 }} onClick={() => { setSelectedDir(i); setStep(STEP_DETAILS); }}>
                        {t('selfMarketing.deepen')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {exportBar(t('selfMarketing.step_strategy'), strategySections(strategy))}
            </>
          )}
          <button className="btn" onClick={() => setStep(STEP_PROFILE)} style={{ marginTop: 16, padding: '9px 20px', fontSize: 14 }}>
            {t('selfMarketing.editProfile')}
          </button>
        </div>
      )}

      {/* Pas 4 — Detalii (aprofundează o direcție din strategie) */}
      {step === STEP_DETAILS && (
        <div>
          {!strategy || strategy.directions.length === 0 ? (
            <p style={{ color: 'var(--fg-1)' }}>{t('selfMarketing.detailsNeedStrategy')}</p>
          ) : (
            <>
              <p style={{ color: 'var(--fg-1)', fontSize: 14, margin: '0 0 10px' }}>{t('selfMarketing.detailsIntro')}</p>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, maxWidth: 520 }}>
                {t('selfMarketing.detailsPick')}
                <select value={selectedDir} onChange={(e) => setSelectedDir(Number(e.target.value))} style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--bg-0)', color: 'var(--fg-0)' }}>
                  {strategy.directions.map((dir, i) => <option key={i} value={i}>{i + 1}. {dir.title || '—'}</option>)}
                </select>
              </label>
              <button className="btn btn-primary" disabled={busy || !canGenerate} onClick={() => void generateDetails()} style={{ marginTop: 12, padding: '10px 22px', fontSize: 14 }}>
                {busy ? t('selfMarketing.detailsGenerating') : t('selfMarketing.detailsGenerate')}
              </button>
              {quotaBlock()}

              {details ? (
                <div style={{ ...card, marginTop: 16 }}>
                  <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{t('selfMarketing.detailsFor')} <span style={{ color: 'var(--accent)' }}>{details.directionTitle}</span></h2>
                  {detailField(t('selfMarketing.dBudget'), details.budgetSplit)}
                  {detailField(t('selfMarketing.dAudienceDetail'), details.audienceDetail)}
                  {detailField(t('selfMarketing.dMessaging'), details.messaging)}
                  {detailField(t('selfMarketing.dFunnel'), details.funnel)}
                  {detailField(t('selfMarketing.dBrief'), details.campaignBrief)}
                  {detailField(t('selfMarketing.dTimeline'), details.timeline)}
                  {exportBar(t('selfMarketing.step_details'), detailsSections(details))}
                </div>
              ) : (
                <p style={{ color: 'var(--fg-1)', fontSize: 13, marginTop: 14 }}>{t('selfMarketing.detailsEmpty')}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Pașii 2 / 5 — în curând */}
      {(step === 1 || step === 4) && (
        <div style={{ ...card, textAlign: 'center', color: 'var(--fg-1)' }}>
          <p style={{ margin: 0 }}>{t('selfMarketing.stepSoon')}</p>
        </div>
      )}
    </main>
  );
}
