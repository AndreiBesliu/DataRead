import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PACKAGES } from '../config/packages';
import { AD_BUDGETS, INDUSTRIES, OBJECTIVES, type OnboardingData, type Objective } from '../types/onboarding';

/** Câmpurile formularului de onboarding/lead — componentă PURĂ de prezentare, refolosită de
 *  pagina publică /start (→ leads) și de formularul din contul de client (dormant până revine
 *  self-serve). Toată logica (draft, validare, submit) rămâne în părinți. */

const field: CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--bg-0)',
};

function Label({ text, error, children }: { text: string; error?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>
      <span>
        {text}
        {error && <span style={{ color: '#e05666', fontWeight: 500 }}> — {t(error)}</span>}
      </span>
      {children}
    </label>
  );
}

export interface OnboardingFieldsProps {
  data: OnboardingData;
  errors: Record<string, string>;
  set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
  toggleObjective: (o: Objective) => void;
  /** Pe /start (lead): doar nucleul e vizibil; restul intră într-un grup „Detalii opționale" colapsat (mai puțină fricțiune). */
  leadMode?: boolean;
}

export default function OnboardingFields({ data, errors, set, toggleObjective, leadMode }: OnboardingFieldsProps) {
  const { t } = useTranslation();
  const [showOptional, setShowOptional] = useState(false);
  // Dacă un câmp opțional are eroare (ex. URL invalid), deschide automat grupul ca utilizatorul s-o vadă.
  const optionalHasError = ['cui', 'website', 'industry', 'industryOther', 'adBudget', 'facebook', 'instagram', 'tiktok', 'description'].some((k) => errors[k]);
  const optionalOpen = !leadMode || showOptional || optionalHasError;

  const core = (
    <>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Label text={t('onboarding.companyName')} error={errors.companyName}>
          <input style={field} value={data.companyName} maxLength={120} onChange={(e) => set('companyName', e.target.value)} />
        </Label>
        <Label text={t('onboarding.contactName')} error={errors.contactName}>
          <input style={field} value={data.contactName} maxLength={80} onChange={(e) => set('contactName', e.target.value)} autoComplete="name" />
        </Label>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Label text={leadMode ? t('onboarding.contactEmailLead') : t('onboarding.contactEmail')} error={errors.contactEmail}>
          <input style={field} type="email" value={data.contactEmail} maxLength={120} onChange={(e) => set('contactEmail', e.target.value)} autoComplete="email" />
        </Label>
        <Label text={leadMode ? t('onboarding.contactPhoneLead') : t('onboarding.contactPhone')} error={errors.contactPhone}>
          <input style={field} type="tel" value={data.contactPhone} maxLength={30} placeholder="07xx xxx xxx" onChange={(e) => set('contactPhone', e.target.value)} autoComplete="tel" />
        </Label>
      </div>

      <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
        <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>
          {t('onboarding.objectives')}
          {errors.objectives && <span style={{ color: '#e05666', fontWeight: 500 }}> — {t(errors.objectives)}</span>}
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
    </>
  );

  const optional = (
    <>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Label text={t('onboarding.cui')} error={errors.cui}>
          <input style={field} value={data.cui} maxLength={20} onChange={(e) => set('cui', e.target.value)} />
        </Label>
        <Label text={t('onboarding.website')} error={errors.website}>
          <input style={field} value={data.website} maxLength={200} placeholder="firma-ta.ro" onChange={(e) => set('website', e.target.value)} />
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
    </>
  );

  if (!leadMode) return (<>{core}{optional}</>);
  return (
    <>
      {core}
      {!optionalOpen && (
        <button type="button" onClick={() => setShowOptional(true)} style={{ justifySelf: 'start', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--fg-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + {t('onboarding.optionalDetails')}
        </button>
      )}
      {optionalOpen && (
        <div style={{ display: 'grid', gap: 14, borderTop: '1px dashed var(--border)', paddingTop: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{t('onboarding.optionalHint')}</span>
          {optional}
        </div>
      )}
    </>
  );
}
