import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pathLanguage, toLocalizedPath } from '../i18n/routing';
import { track } from '../services/analytics';

/** Iconurile serviciilor din banner (chart / target / funnel / rachetă) — SVG inline roșu. */
function ServiceIcon({ kind }: { kind: 1 | 2 | 3 | 4 }) {
  const common = { width: 34, height: 34, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--accent)', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (kind === 1) {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 15v2M11 11v6M15 13v4M7 11l4-4 3 3 4-5" />
      </svg>
    );
  }
  if (kind === 2) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    );
  }
  if (kind === 3) {
    return (
      <svg {...common}>
        <path d="M4 4h16l-6 8v6l-4 2v-8L4 4z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 16c4-3 6-7 6-12-5 0-9 2-12 6M12 16l-4-4M12 16l1 5 3-3-1-3M8 12l-5 1 3-3 3 .5" />
      <circle cx="13.5" cy="8.5" r="1.4" />
    </svg>
  );
}

/** Iconurile benzii de încredere din banner — albastru/roșu, mici. */
function TrustIcon({ kind }: { kind: 1 | 2 | 3 | 4 }) {
  const stroke = kind % 2 === 0 ? 'var(--accent)' : 'var(--blue, #2e7fff)';
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (kind === 1) return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-8M21 19H3" /></svg>;
  if (kind === 2) return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>;
  if (kind === 3) return <svg {...common}><path d="M4 19l5-6 4 3 7-9M21 19H3" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" /></svg>;
}

export default function Landing() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const p = (s: string) => toLocalizedPath(s, pathLanguage(pathname));

  useEffect(() => {
    track('landing_view');
  }, []);

  return (
    <main data-page="landing">
      {/* Hero — headline-ul pe 3 rânduri din banner (alb / ROȘU / alb) + motive diagonale. */}
      <section className="hero">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '84px 24px 64px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(30px, 5.4vw, 52px)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.15 }}>
            {t('landing.heroLine1')}
            <br />
            <span style={{ color: 'var(--accent)' }}>{t('landing.heroLine2')}</span>
            <br />
            {t('landing.heroLine3')}
          </h1>
          <div style={{ width: 64, height: 3, background: 'var(--accent)', margin: '0 auto 18px', borderRadius: 2 }} />
          <p style={{ fontSize: 19, color: 'var(--fg-1)', maxWidth: 640, margin: '0 auto 30px' }}>{t('landing.heroSubtitle')}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={p('/pachete')} className="btn btn-primary" style={{ fontSize: 15, padding: '13px 26px' }}>
              {t('landing.heroCta')}
            </Link>
            <Link to={p('/start')} className="btn btn-blue" style={{ fontSize: 15, padding: '13px 26px' }}>
              {t('landing.heroSecondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* Banda de încredere din banner: DATE REALE · STRATEGII INTELIGENTE · … */}
      <section className="trust-strip">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '14px 24px', display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
          {([1, 2, 3, 4] as const).map((i) => (
            <span key={i} className="trust-item">
              <TrustIcon kind={i} />
              {t(`landing.trust${i}`)}
            </span>
          ))}
        </div>
      </section>

      {/* Serviciile din banner — 4 carduri cu iconuri roșii. */}
      <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '52px 24px 8px' }}>
        <h2 className="section-title" style={{ fontSize: 28 }}>{t('landing.whatTitle')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 28 }}>
          {([1, 2, 3, 4] as const).map((i) => (
            <div key={i} className="card" style={{ textAlign: 'center' }}>
              <ServiceIcon kind={i} />
              <h3 style={{ margin: '10px 0 6px', fontSize: 16, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t(`landing.what${i}Title`)}</h3>
              <p style={{ color: 'var(--fg-1)', margin: 0, fontSize: 14 }}>{t(`landing.what${i}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cum funcționează. */}
      <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '52px 24px 8px' }}>
        <h2 className="section-title" style={{ fontSize: 28 }}>{t('landing.howTitle')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 28 }}>
          {([1, 2, 3] as const).map((i) => (
            <div key={i} className="card">
              <h3 style={{ marginTop: 0, fontSize: 17, color: 'var(--blue, #2e7fff)' }}>{t(`landing.how${i}Title`)}</h3>
              <p style={{ color: 'var(--fg-1)', margin: 0, fontSize: 14 }}>{t(`landing.how${i}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final — „Să creștem împreună" (badge-ul din banner). */}
      <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '48px 24px 56px', textAlign: 'center' }}>
        <h2 className="section-title" style={{ fontSize: 26 }}>{t('landing.ctaTitle')}</h2>
        <p style={{ color: 'var(--fg-1)', margin: '18px 0 22px' }}>{t('landing.ctaBody')}</p>
        <Link to={p('/start')} className="btn btn-primary" style={{ fontSize: 15, padding: '13px 28px' }}>
          {t('landing.ctaButton')}
        </Link>
      </section>
    </main>
  );
}
