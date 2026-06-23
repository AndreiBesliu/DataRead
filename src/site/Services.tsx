import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pathLanguage, toLocalizedPath } from '../i18n/routing';
import { track } from '../services/analytics';
import { SERVICES, serviceBulletKeys, type ServiceDef } from '../config/services';

/** Pagina publică „Servicii" — catalogul celor 7 servicii din infografie. Fiecare card are un CTA:
 *  produsul live (self → /self-marketing) sau o cerere etichetată cu serviciul (/start?service=<id>),
 *  care intră în /admin ca lead cu tag de serviciu. Text 100% i18n; prerenderizată (rută publică). */
export default function Services() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const p = (s: string) => toLocalizedPath(s, pathLanguage(pathname));

  useEffect(() => {
    track('services_view');
  }, []);

  const ctaFor = (s: ServiceDef): { to: string; label: string } =>
    s.cta === 'self'
      ? { to: p('/self-marketing'), label: t('services.ctaTry') }
      : { to: `${p('/start')}?service=${s.id}`, label: t('services.ctaLead') };

  return (
    <main data-page="services">
      {/* Hero — kicker + titlu + intro + pastilele de valoare din infografie. */}
      <section className="hero">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '72px 24px 48px', textAlign: 'center' }}>
          <div style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: 13, marginBottom: 10 }}>
            {t('services.kicker')}
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 46px)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.15 }}>
            {t('services.heroTitle')}
          </h1>
          <div style={{ width: 64, height: 3, background: 'var(--accent)', margin: '0 auto 18px', borderRadius: 2 }} />
          <p style={{ fontSize: 18, color: 'var(--fg-1)', maxWidth: 660, margin: '0 auto 26px' }}>{t('services.heroBody')}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {([1, 2, 3, 4] as const).map((i) => (
              <span
                key={i}
                style={{ fontSize: 13, fontWeight: 700, color: '#dbe4f5', border: '1px solid var(--border)', borderRadius: 999, padding: '6px 14px' }}
              >
                {t(`services.pill${i}`)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Grila celor 7 servicii. */}
      <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '44px 24px 8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          {SERVICES.map((s) => {
            const cta = ctaFor(s);
            return (
              <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <span aria-hidden style={{ fontSize: 30, lineHeight: 1 }}>{s.emoji}</span>
                  <h2 style={{ margin: 0, fontSize: 19 }}>{t(`services.${s.id}.name`)}</h2>
                  {s.cta === 'self' && (
                    <span
                      style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--accent-contrast, #fff)', background: 'var(--accent)', borderRadius: 999, padding: '3px 9px' }}
                    >
                      {t('services.liveBadge')}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--fg-1)', margin: '0 0 12px', fontSize: 14 }}>{t(`services.${s.id}.tagline`)}</p>
                <ul style={{ margin: '0 0 16px', paddingLeft: 18, color: 'var(--fg-0)', fontSize: 14, lineHeight: 1.7, flex: 1 }}>
                  {serviceBulletKeys(s).map((k) => (
                    <li key={k}>{t(k)}</li>
                  ))}
                </ul>
                <Link
                  to={cta.to}
                  className={s.cta === 'self' ? 'btn btn-primary' : 'btn btn-blue'}
                  style={{ fontSize: 14, padding: '10px 18px', textAlign: 'center', alignSelf: 'flex-start' }}
                  onClick={() => track('service_cta', { service: s.id, kind: s.cta })}
                >
                  {cta.label}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA final — „Să creștem împreună". */}
      <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '48px 24px 56px', textAlign: 'center' }}>
        <h2 className="section-title" style={{ fontSize: 26 }}>{t('services.finalTitle')}</h2>
        <p style={{ color: 'var(--fg-1)', margin: '18px 0 22px' }}>{t('services.finalBody')}</p>
        <Link to={p('/start')} className="btn btn-primary" style={{ fontSize: 15, padding: '13px 28px' }}>
          {t('services.finalCta')}
        </Link>
      </section>
    </main>
  );
}
