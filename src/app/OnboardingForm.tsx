import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import i18n from '../i18n';
import { useAuthStore } from '../store/authStore';
import { markOnboardingSubmitted } from '../services/clients';
import { track } from '../services/analytics';
import { reportError } from '../services/errorReporting';
import { PACKAGES } from '../config/packages';
import {
  AD_BUDGETS,
  INDUSTRIES,
  OBJECTIVES,
  ONBOARDING_DRAFT_KEY,
  coerceToOnboarding,
  coerceToOnboardingDraft,
  emptyOnboarding,
  normaliseUrl,
  validateOnboarding,
  type OnboardingData,
} from '../types/onboarding';
import AuthPanel from './AuthPanel';

const field: CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--bg-0)',
};

function Label({ text, error, children }: { text: string; error?: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>
      <span>
        {text}
        {error && <span style={{ color: '#c0392b', fontWeight: 500 }}> — {t(error)}</span>}
      </span>
      {children}
    </label>
  );
}

/** Formularul de onboarding. Draftul se salvează local la fiecare modificare (cheia
 *  dataread.onboardingDraft.v1, citită NUMAI prin coerce) și se șterge la trimitere. */
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
        /* offline / baza încă necreată — mergem pe draft */
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

  // Autosave draft local (numai după încărcare, ca să nu suprascriem cu formularul gol).
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

  const toggleObjective = (o: (typeof OBJECTIVES)[number]) => {
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
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <Label text={t('onboarding.companyName')} error={errors.companyName}>
            <input style={field} value={data.companyName} maxLength={120} onChange={(e) => set('companyName', e.target.value)} />
          </Label>
          <Label text={t('onboarding.cui')} error={errors.cui}>
            <input style={field} value={data.cui} maxLength={20} onChange={(e) => set('cui', e.target.value)} />
          </Label>
          <Label text={t('onboarding.website')} error={errors.website}>
            <input style={field} value={data.website} maxLength={200} placeholder="firma-ta.ro" onChange={(e) => set('website', e.target.value)} />
          </Label>
        </div>

        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <Label text={t('onboarding.contactName')} error={errors.contactName}>
            <input style={field} value={data.contactName} maxLength={80} onChange={(e) => set('contactName', e.target.value)} autoComplete="name" />
          </Label>
          <Label text={t('onboarding.contactEmail')} error={errors.contactEmail}>
            <input style={field} type="email" value={data.contactEmail} maxLength={120} onChange={(e) => set('contactEmail', e.target.value)} autoComplete="email" />
          </Label>
          <Label text={t('onboarding.contactPhone')} error={errors.contactPhone}>
            <input style={field} type="tel" value={data.contactPhone} maxLength={30} placeholder="07xx xxx xxx" onChange={(e) => set('contactPhone', e.target.value)} autoComplete="tel" />
          </Label>
        </div>

        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <Label text={t('onboarding.industry')} error={errors.industry}>
            <select style={field} value={data.industry} onChange={(e) => set('industry', e.target.value as OnboardingData['industry'])}>
              <option value="">{t('onboarding.industryPlaceholder')}</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>{t(`onboarding.industries.${i}`)}</option>
              ))}
            </select>
          </Label>
          {data.industry === 'other' && (
            <Label text={t('onboarding.industryOther')} error={errors.industryOther}>
              <input style={field} value={data.industryOther} maxLength={80} onChange={(e) => set('industryOther', e.target.value)} />
            </Label>
          )}
          <Label text={t('onboarding.packageInterest')} error={errors.packageInterest}>
            <select style={field} value={data.packageInterest ?? ''} onChange={(e) => set('packageInterest', (e.target.value || null) as OnboardingData['packageInterest'])}>
              <option value="">{t('onboarding.packageNone')}</option>
              {PACKAGES.map((p) => (
                <option key={p.id} value={p.id}>{t(p.nameKey)} — {p.monthlyAmount} {t('pachete.perMonth')}</option>
              ))}
            </select>
          </Label>
        </div>

        <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
          <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>
            {t('onboarding.objectives')}
            {errors.objectives && <span style={{ color: '#c0392b', fontWeight: 500 }}> — {t(errors.objectives)}</span>}
          </legend>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {OBJECTIVES.map((o) => (
              <label key={o} style={{ display: 'flex', gap: 6, fontSize: 14, alignItems: 'center' }}>
                <input type="checkbox" checked={data.objectives.includes(o)} onChange={() => toggleObjective(o)} />
                {t(`onboarding.objective.${o}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <Label text={t('onboarding.adBudget')} error={errors.adBudget}>
          <select style={field} value={data.adBudget} onChange={(e) => set('adBudget', e.target.value as OnboardingData['adBudget'])}>
            <option value="">—</option>
            {AD_BUDGETS.map((b) => (
              <option key={b} value={b}>{t(`onboarding.budget.${b}`)}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fg-1)' }}>{t('onboarding.adBudgetHint')}</span>
        </Label>

        <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
          <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>{t('onboarding.social')}</legend>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Label text="Facebook" error={errors.facebook}>
              <input style={field} value={data.facebook} maxLength={200} placeholder="facebook.com/…" onChange={(e) => set('facebook', e.target.value)} />
            </Label>
            <Label text="Instagram" error={errors.instagram}>
              <input style={field} value={data.instagram} maxLength={200} placeholder="instagram.com/…" onChange={(e) => set('instagram', e.target.value)} />
            </Label>
            <Label text="TikTok" error={errors.tiktok}>
              <input style={field} value={data.tiktok} maxLength={200} placeholder="tiktok.com/@…" onChange={(e) => set('tiktok', e.target.value)} />
            </Label>
          </div>
        </fieldset>

        <Label text={t('onboarding.description')} error={errors.description}>
          <textarea
            style={{ ...field, minHeight: 120, resize: 'vertical', fontFamily: 'inherit' }}
            value={data.description}
            maxLength={2000}
            placeholder={t('onboarding.descriptionPlaceholder')}
            onChange={(e) => set('description', e.target.value)}
          />
        </Label>

        {errors._submit && <div role="alert" style={{ color: '#c0392b', fontSize: 13 }}>{t(errors._submit)}</div>}

        <button className="btn btn-primary" type="submit" disabled={saving} style={{ justifySelf: 'start', padding: '10px 26px' }}>
          {saving ? t('onboarding.saving') : submitted ? t('onboarding.update') : t('onboarding.submit')}
        </button>
      </form>
    </main>
  );
}
