/**
 * Câmpurile profilului de firmă pentru „Self Marketing" — prezentațional (ca OnboardingFields). Grupate pe
 * secțiuni: Firma / Ofertă / Piață / Obiective. Erorile = chei i18n (selfMarketing.errors.*). Tot textul prin t().
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { INDUSTRIES } from '../types/onboarding';
import { type SelfCompanyProfile } from '../types/selfMarketing';

const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--bg-0)', color: 'var(--fg-0)' };
const labelStyle: CSSProperties = { display: 'grid', gap: 5, fontSize: 13, fontWeight: 600 };

export default function SelfProfileFields({
  data,
  errors,
  set,
}: {
  data: SelfCompanyProfile;
  errors: Record<string, string>;
  set: <K extends keyof SelfCompanyProfile>(k: K, v: SelfCompanyProfile[K]) => void;
}) {
  const { t } = useTranslation();

  const err = (field: string) => (errors[field] ? <span style={{ color: '#c0392b', fontSize: 12, fontWeight: 400 }}>{t(errors[field])}</span> : null);
  const section: CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', background: 'var(--bg-1)', display: 'grid', gap: 12 };
  const heading: CSSProperties = { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--accent)', margin: 0 };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Firma */}
      <div style={section}>
        <h3 style={heading}>{t('selfMarketing.secFirma')}</h3>
        <label style={labelStyle}>
          {t('selfMarketing.fCompany')} {err('companyName')}
          <input style={input} value={data.companyName} maxLength={120} onChange={(e) => set('companyName', e.target.value)} placeholder={t('selfMarketing.fCompanyPh')} />
        </label>
        <label style={labelStyle}>
          {t('selfMarketing.fIndustry')} {err('industry')}
          <select style={input} value={data.industry} onChange={(e) => set('industry', e.target.value as SelfCompanyProfile['industry'])}>
            <option value="">{t('selfMarketing.fIndustryPick')}</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{t(`onboarding.industries.${ind}`)}</option>
            ))}
          </select>
        </label>
        {data.industry === 'other' && (
          <label style={labelStyle}>
            {t('selfMarketing.fIndustryOther')} {err('industryOther')}
            <input style={input} value={data.industryOther} maxLength={80} onChange={(e) => set('industryOther', e.target.value)} />
          </label>
        )}
      </div>

      {/* Ofertă */}
      <div style={section}>
        <h3 style={heading}>{t('selfMarketing.secOferta')}</h3>
        <label style={labelStyle}>
          {t('selfMarketing.fProducts')} {err('productsServices')}
          <textarea style={{ ...input, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} value={data.productsServices} maxLength={2000} onChange={(e) => set('productsServices', e.target.value)} placeholder={t('selfMarketing.fProductsPh')} />
        </label>
      </div>

      {/* Piață */}
      <div style={section}>
        <h3 style={heading}>{t('selfMarketing.secPiata')}</h3>
        <label style={labelStyle}>
          {t('selfMarketing.fAudience')} {err('audience')}
          <textarea style={{ ...input, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }} value={data.audience} maxLength={1000} onChange={(e) => set('audience', e.target.value)} placeholder={t('selfMarketing.fAudiencePh')} />
        </label>
        <label style={labelStyle}>
          {t('selfMarketing.fArea')}
          <input style={input} value={data.area} maxLength={200} onChange={(e) => set('area', e.target.value)} placeholder={t('selfMarketing.fAreaPh')} />
        </label>
        <label style={labelStyle}>
          {t('selfMarketing.fCompetitors')}
          <textarea style={{ ...input, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} value={data.competitors} maxLength={1000} onChange={(e) => set('competitors', e.target.value)} placeholder={t('selfMarketing.fCompetitorsPh')} />
        </label>
      </div>

      {/* Obiective */}
      <div style={section}>
        <h3 style={heading}>{t('selfMarketing.secObiective')}</h3>
        <label style={labelStyle}>
          {t('selfMarketing.fBudget')}
          <input style={input} value={data.budget} maxLength={200} onChange={(e) => set('budget', e.target.value)} placeholder={t('selfMarketing.fBudgetPh')} />
        </label>
        <label style={labelStyle}>
          {t('selfMarketing.fGoals')} {err('goals')}
          <textarea style={{ ...input, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }} value={data.goals} maxLength={2000} onChange={(e) => set('goals', e.target.value)} placeholder={t('selfMarketing.fGoalsPh')} />
        </label>
      </div>
    </div>
  );
}
