import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import i18n from '../i18n';
import { useAuthStore } from '../store/authStore';
import { markOnboardingSubmitted } from '../services/clients';
import { track } from '../services/analytics';
import { reportError } from '../services/errorReporting';
import {
  ONBOARDING_DRAFT_KEY,
  coerceToOnboarding,
  coerceToOnboardingDraft,
  emptyOnboarding,
  normaliseUrl,
  validateOnboarding,
  type Objective,
  type OnboardingData,
} from '../types/onboarding';
import OnboardingFields from '../forms/OnboardingFields';
import AuthPanel from './AuthPanel';

/** Onboarding-ul din CONTUL de client (clients/{uid}/onboarding/main). NOTĂ: site-ul public nu
 *  are login (decizie 11.06) — intrarea clienților e formularul public /start (→ leads); pagina
 *  asta rămâne funcțională pentru momentul în care conturile self-serve revin (Stripe). */
export default function OnboardingForm() {
  const { t } = useTranslation();
  const { user, initializing } = useAuthStore();
  const [data, setData] = useState<OnboardingData>(emptyOnboarding());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [fromDraft, setFromDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const justSubmitted = useRef(false);

  // Încărcare: documentul din Firestore (dacă există) bate draftul local.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      let initial: OnboardingData | null = null;
      try {
        const snap = await getDoc(doc(db, 'clients', user.uid, 'onboarding', 'main'));
        if (snap.exists()) {
          initial = coerceToOnboarding(snap.data());
          if (!cancelled) setSubmitted(true);
        }
      } catch {
        /* offline — mergem pe draft */
      }
      if (!initial) {
        let raw: string | null = null;
        try {
          raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
        } catch {
          /* private mode */
        }
        const draft = coerceToOnboardingDraft(raw);
        if (draft) {
          initial = draft;
          if (!cancelled) setFromDraft(true);
        }
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

  // Autosave draft local (doar după încărcare, ca să nu suprascriem cu formularul gol).
  useEffect(() => {
    if (!loaded || justSubmitted.current) return;
    try {
      localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(data));
    } catch {
      /* private mode */
    }
  }, [data, loaded]);

  if (initializing) {
    return <main data-page="app-loading" style={{ padding: 64, textAlign: 'center', color: 'var(--fg-1)' }}>…</main>;
  }
  if (!user) return <AuthPanel />;

  const set = <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    setErrors((e) => {
      if (!(k in e)) return e;
      const { [k]: _drop, ...rest } = e;
      return rest;
    });
  };

  const toggleObjective = (o: Objective) => {
    setData((d) => ({
      ...d,
      objectives: d.objectives.includes(o) ? d.objectives.filter((x) => x !== o) : [...d.objectives, o],
    }));
    setErrors((e) => {
      const { objectives: _drop, ...rest } = e;
      return rest;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean: OnboardingData = {
      ...data,
      website: normaliseUrl(data.website),
      facebook: normaliseUrl(data.facebook),
      instagram: normaliseUrl(data.instagram),
      tiktok: normaliseUrl(data.tiktok),
    };
    const v = validateOnboarding(clean);
    setErrors(v.errors);
    if (!v.ok) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'clients', user.uid, 'onboarding', 'main'),
        {
          ...clean,
          locale: i18n.language === 'en' ? 'en' : 'ro',
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await markOnboardingSubmitted(user.uid);
      justSubmitted.current = true;
      try {
        localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch {
        /* private mode */
      }
      setData(clean);
      setSubmitted(true);
      setFromDraft(false);
      track('onboarding_submitted');
    } catch (err) {
      reportError(err, { kind: 'onboarding-submit' });
      setErrors({ _submit: 'auth.errors.generic' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main data-page="onboarding" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <Link to="/app" style={{ fontSize: 13 }}>← {t('onboarding.back')}</Link>
      <h1 style={{ fontSize: 26, margin: '10px 0 4px' }}>{t('onboarding.title')}</h1>
      <p style={{ color: 'var(--fg-1)', marginBottom: 8 }}>{t('onboarding.intro')}</p>
      {submitted && (
        <div role="status" style={{ background: '#e8f5ec', border: '1px solid #b5dcc0', borderRadius: 8, padding: '10px 14px', fontSize: 14, marginBottom: 8 }}>
          <strong>{t('onboarding.submitted')}</strong> {t('onboarding.submittedBody')}
        </div>
      )}
      {!submitted && fromDraft && (
        <div role="status" style={{ background: '#eef4ff', border: '1px solid #c4d6f5', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 8 }}>
          {t('onboarding.draftRestored')}
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 12 }}>
        <OnboardingFields data={data} errors={errors} set={set} toggleObjective={toggleObjective} />
        {errors._submit && <div role="alert" style={{ color: '#c0392b', fontSize: 13 }}>{t(errors._submit)}</div>}
        <button className="btn btn-primary" type="submit" disabled={saving} style={{ justifySelf: 'start', padding: '10px 26px' }}>
          {saving ? t('onboarding.saving') : submitted ? t('onboarding.update') : t('onboarding.submit')}
        </button>
      </form>
    </main>
  );
}
