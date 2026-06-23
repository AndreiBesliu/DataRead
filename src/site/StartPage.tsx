import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import i18n from '../i18n';
import { track } from '../services/analytics';
import { reportError } from '../services/errorReporting';
import { isValidPackageId } from '../config/packages';
import { isValidServiceId } from '../config/services';
import {
  coerceToOnboardingDraft,
  emptyOnboarding,
  normaliseUrl,
  validateOnboarding,
  type Objective,
  type OnboardingData,
} from '../types/onboarding';
import OnboardingFields from '../forms/OnboardingFields';

/** Cheia draftului local al formularului public (separată de cea din contul de client). */
export const LEAD_DRAFT_KEY = 'dataread.leadDraft.v1';

/** Formularul public de start — intrarea clienților, FĂRĂ cont (site-ul nu are login).
 *  Trimite în colecția `leads`; operatorii o văd în /admin. Draft local la fiecare modificare,
 *  citit NUMAI prin coerce (invariantul normaliserului). */
export default function StartPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [data, setData] = useState<OnboardingData>(() => {
    let initial: OnboardingData | null = null;
    try {
      initial = coerceToOnboardingDraft(localStorage.getItem(LEAD_DRAFT_KEY));
    } catch {
      /* private mode */
    }
    return initial ?? emptyOnboarding();
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Funnel: vizualizarea paginii + prima interacțiune cu formularul (form_start o singură dată).
  const formStarted = useRef(false);
  useEffect(() => { track('start_view'); }, []);
  const markFormStart = () => {
    if (!formStarted.current) { formStarted.current = true; track('form_start'); }
  };

  // ?pkg= de pe pagina de pachete preselectează pachetul de interes.
  useEffect(() => {
    const pkg = params.get('pkg');
    if (isValidPackageId(pkg)) setData((d) => ({ ...d, packageInterest: pkg }));
  }, [params]);

  // ?service= din pagina /servicii etichetează lead-ul cu serviciul cerut.
  useEffect(() => {
    const svc = params.get('service');
    if (isValidServiceId(svc)) setData((d) => ({ ...d, serviceInterest: svc }));
  }, [params]);

  // Autosave draft local.
  useEffect(() => {
    if (submitted) return;
    try {
      localStorage.setItem(LEAD_DRAFT_KEY, JSON.stringify(data));
    } catch {
      /* private mode */
    }
  }, [data, submitted]);

  const set = <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => {
    markFormStart();
    setData((d) => ({ ...d, [k]: v }));
    setErrors((e) => {
      if (!(k in e)) return e;
      const { [k]: _drop, ...rest } = e;
      return rest;
    });
  };

  const toggleObjective = (o: Objective) => {
    markFormStart();
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
      await addDoc(collection(db, 'leads'), {
        ...clean,
        locale: i18n.language === 'en' ? 'en' : 'ro',
        status: 'new',
        createdAt: serverTimestamp(),
      });
      try {
        localStorage.removeItem(LEAD_DRAFT_KEY);
      } catch {
        /* private mode */
      }
      setSubmitted(true);
      track('lead_submitted', { pkg: clean.packageInterest ?? 'none', service: clean.serviceInterest ?? 'none' });
      window.scrollTo({ top: 0 });
    } catch (err) {
      reportError(err, { kind: 'lead-submit' });
      setErrors({ _submit: 'start.error' });
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <main data-page="start" style={{ maxWidth: 640, margin: '0 auto', padding: '72px 24px', textAlign: 'center' }}>
        <h1 className="section-title" style={{ fontSize: 30 }}>{t('start.submitted')}</h1>
        <p style={{ color: 'var(--fg-1)', fontSize: 17, margin: '20px 0 26px' }}>{t('start.submittedBody')}</p>
        <button
          className="btn btn-blue"
          onClick={() => {
            setSubmitted(false);
            setData(emptyOnboarding());
          }}
        >
          {t('start.submitAnother')}
        </button>
      </main>
    );
  }

  return (
    <main data-page="start" style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>
      <h1 className="section-title" style={{ fontSize: 30 }}>{t('start.title')}</h1>
      <p style={{ color: 'var(--fg-1)', textAlign: 'center', margin: '18px 0 16px' }}>{t('start.intro')}</p>
      {data.serviceInterest && (
        <p style={{ textAlign: 'center', margin: '0 0 22px' }}>
          <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color: '#dbe4f5', border: '1px solid var(--border)', borderRadius: 999, padding: '6px 14px' }}>
            {t('start.serviceInterest', { name: t(`services.${data.serviceInterest}.name`) })}
          </span>
        </p>
      )}

      <form onSubmit={submit} className="card" style={{ display: 'grid', gap: 14 }}>
        <OnboardingFields data={data} errors={errors} set={set} toggleObjective={toggleObjective} />
        {errors._submit && <div role="alert" style={{ color: '#e05666', fontSize: 13 }}>{t(errors._submit)}</div>}
        <button className="btn btn-primary" type="submit" disabled={saving} style={{ justifySelf: 'center', padding: '12px 32px', fontSize: 15 }}>
          {saving ? t('start.saving') : t('start.submit')}
        </button>
      </form>
    </main>
  );
}
