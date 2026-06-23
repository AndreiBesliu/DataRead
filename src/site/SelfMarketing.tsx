/**
 * Pagina publică „Self Marketing" — explică ce poate face clientul cu generatorul AI de strategie
 * (felia self-serve). E un explicativ + CTA către funnel-ul logat (/app/self-marketing). Tot textul prin t().
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { track } from '../services/analytics';

export default function SelfMarketing() {
  const { t } = useTranslation();
  useEffect(() => { track('self_marketing_view'); }, []);

  const steps = ['profile', 'opportunities', 'strategy', 'details', 'execution'] as const;
  const benefits = ['angles', 'data', 'fast', 'free'] as const;

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '18px 20px',
  };

  return (
    <main data-page="self-marketing" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '56px 24px' }}>
      <section style={{ maxWidth: 760, marginBottom: 40 }}>
        <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.4, color: 'var(--accent)', fontWeight: 700 }}>
          {t('selfMarketing.kicker')}
        </span>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', lineHeight: 1.1, margin: '10px 0 14px' }}>
          {t('selfMarketing.heroTitle')}
        </h1>
        <p style={{ fontSize: 18, color: 'var(--fg-1)', lineHeight: 1.6, marginBottom: 24 }}>
          {t('selfMarketing.heroBody')}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/app/self-marketing" className="btn btn-primary" style={{ padding: '11px 26px', fontSize: 15 }}>
            {t('selfMarketing.cta')}
          </Link>
          <Link to="/self-marketing/pachete" className="btn" style={{ padding: '11px 26px', fontSize: 15 }}>
            {t('selfMarketing.ctaPackages')}
          </Link>
        </div>
        <p style={{ fontSize: 13, color: 'var(--fg-1)', marginTop: 12 }}>{t('selfMarketing.trialNote')}</p>
      </section>

      <h2 style={{ fontSize: 22, margin: '0 0 16px' }}>{t('selfMarketing.howTitle')}</h2>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 44 }}>
        {steps.map((s, i) => (
          <div key={s} style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{i + 1}</div>
            <h3 style={{ fontSize: 16, margin: '6px 0 4px' }}>{t(`selfMarketing.step_${s}`)}</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-1)', margin: 0, lineHeight: 1.5 }}>{t(`selfMarketing.stepBody_${s}`)}</p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 22, margin: '0 0 16px' }}>{t('selfMarketing.whyTitle')}</h2>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 44 }}>
        {benefits.map((b) => (
          <div key={b} style={card}>
            <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>{t(`selfMarketing.benefit_${b}`)}</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-1)', margin: 0, lineHeight: 1.5 }}>{t(`selfMarketing.benefitBody_${b}`)}</p>
          </div>
        ))}
      </div>

      <div style={{ ...card, textAlign: 'center', padding: '28px 20px' }}>
        <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>{t('selfMarketing.finalTitle')}</h2>
        <p style={{ fontSize: 15, color: 'var(--fg-1)', margin: '0 0 16px' }}>{t('selfMarketing.finalBody')}</p>
        <Link to="/app/self-marketing" className="btn btn-primary" style={{ padding: '11px 26px', fontSize: 15 }}>
          {t('selfMarketing.cta')}
        </Link>
      </div>
    </main>
  );
}
