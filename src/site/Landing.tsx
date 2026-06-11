import { useEffect, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pathLanguage, toLocalizedPath } from '../i18n/routing';
import { track } from '../services/analytics';

const cardStyle: CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '22px 20px',
};

export default function Landing() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const p = (s: string) => toLocalizedPath(s, pathLanguage(pathname));

  useEffect(() => {
    track('landing_view');
  }, []);

  return (
    <main data-page="landing">
      {/* Hero */}
      <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '72px 24px 56px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 44, margin: '0 0 14px' }}>{t('landing.heroTitle')}</h1>
        <p style={{ fontSize: 19, color: 'var(--fg-1)', maxWidth: 640, margin: '0 auto 28px' }}>{t('landing.heroSubtitle')}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={p('/pachete')} className="btn btn-primary" style={{ fontSize: 16, padding: '12px 24px' }}>
            {t('landing.heroCta')}
          </Link>
          <Link to={p('/contact')} className="btn" style={{ fontSize: 16, padding: '12px 24px' }}>
            {t('landing.heroSecondary')}
          </Link>
        </div>
      </section>

      {/* Cum funcționează */}
      <section style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '48px 24px' }}>
          <h2 style={{ textAlign: 'center', fontSize: 30, marginTop: 0 }}>{t('landing.howTitle')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 24 }}>
            {([1, 2, 3] as const).map((i) => (
              <div key={i} style={{ ...cardStyle, background: 'var(--bg-0)' }}>
                <h3 style={{ marginTop: 0, fontSize: 18 }}>{t(`landing.how${i}Title`)}</h3>
                <p style={{ color: 'var(--fg-1)', margin: 0 }}>{t(`landing.how${i}Body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ce primești */}
      <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '48px 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 30, marginTop: 0 }}>{t('landing.whatTitle')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 24 }}>
          {([1, 2, 3, 4] as const).map((i) => (
            <div key={i} style={cardStyle}>
              <h3 style={{ marginTop: 0, fontSize: 18 }}>{t(`landing.what${i}Title`)}</h3>
              <p style={{ color: 'var(--fg-1)', margin: 0 }}>{t(`landing.what${i}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '24px 24px 56px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, marginBottom: 8 }}>{t('landing.ctaTitle')}</h2>
        <p style={{ color: 'var(--fg-1)', marginBottom: 20 }}>{t('landing.ctaBody')}</p>
        <Link to={p('/pachete')} className="btn btn-primary" style={{ fontSize: 16, padding: '12px 24px' }}>
          {t('landing.ctaButton')}
        </Link>
      </section>
    </main>
  );
}
