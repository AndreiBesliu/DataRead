import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pathLanguage, toLocalizedPath } from '../i18n/routing';
import { track } from '../services/analytics';
import { getService, serviceBulletKeys, type ServiceId } from '../config/services';
import { LinkButton } from '../ui/Button';

/** Pagina de detaliu a unui serviciu (/servicii/:id) — problemă + ce livrăm + FAQ + CTA contextual.
 *  Rută PUBLICĂ prerenderizată (slug concret per serviciu în publicRoutes); SEO din SiteLayout (services.<id>.meta*).
 *  Text 100% i18n. CTA: produs live (self → /self-marketing) sau cerere etichetată (/start?service=<id>). */
export default function ServiceDetail({ id }: { id: ServiceId }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const lang = pathLanguage(pathname);
  const p = (s: string) => toLocalizedPath(s, lang);
  const s = getService(id);

  useEffect(() => {
    track('service_detail_view', { service: id });
  }, [id]);

  const cta = s.cta === 'self'
    ? { to: p('/self-marketing'), label: t('services.ctaTry') }
    : { to: `${p('/start')}?service=${id}`, label: t('services.ctaLead') };

  const card: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '22px 20px' };

  return (
    <main data-page="service-detail">
      {/* Hero */}
      <section className="hero">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '56px 24px 40px' }}>
          <Link to={p('/servicii')} style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 600 }}>← {t('services.detail.back')}</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '16px 0 8px', flexWrap: 'wrap' }}>
            <span aria-hidden style={{ fontSize: 40, lineHeight: 1 }}>{s.emoji}</span>
            <h1 style={{ margin: 0, fontSize: 'clamp(26px, 4.6vw, 40px)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t(`services.${id}.name`)}</h1>
            {s.cta === 'self' && (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-contrast, #fff)', background: 'var(--accent)', borderRadius: 999, padding: '4px 11px' }}>{t('services.liveBadge')}</span>
            )}
          </div>
          <div style={{ width: 64, height: 3, background: 'var(--accent)', margin: '6px 0 18px', borderRadius: 2 }} />
          <p style={{ fontSize: 19, color: 'var(--fg-0)', maxWidth: 680, margin: '0 0 8px', fontWeight: 600 }}>{t(`services.${id}.tagline`)}</p>
          <p style={{ fontSize: 16, color: 'var(--fg-1)', maxWidth: 680, margin: '0 0 26px' }}>{t(`services.${id}.intro`)}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <LinkButton variant="primary" to={cta.to} style={{ fontSize: 15, padding: '13px 26px' }} onClick={() => track('service_cta', { service: id, kind: s.cta, from: 'detail' })}>
              {cta.label}
            </LinkButton>
            <LinkButton variant="secondary" to={p('/servicii')} style={{ fontSize: 15, padding: '13px 22px' }}>
              {t('services.detail.allServices')}
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Provocarea + Ce livrăm */}
      <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '8px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          <div style={card}>
            <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>{t('services.detail.problemTitle')}</h2>
            <p style={{ color: 'var(--fg-1)', margin: 0, fontSize: 15, lineHeight: 1.7 }}>{t(`services.${id}.problem`)}</p>
          </div>
          <div style={card}>
            <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>{t('services.detail.deliverTitle')}</h2>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', color: 'var(--fg-0)', fontSize: 15, lineHeight: 1.9 }}>
              {serviceBulletKeys(s).map((k) => (
                <li key={k} style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--accent)' }}>✓</span>{t(k)}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '44px 24px 8px' }}>
        <h2 className="section-title" style={{ textAlign: 'left' }}>{t('services.detail.faqTitle')}</h2>
        <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
          {([1, 2, 3] as const).map((i) => (
            <div key={i} style={card}>
              <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>{t(`services.${id}.faq${i}q`)}</h3>
              <p style={{ color: 'var(--fg-1)', margin: 0, fontSize: 14, lineHeight: 1.7 }}>{t(`services.${id}.faq${i}a`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '40px 24px 56px', textAlign: 'center' }}>
        <h2 className="section-title">{t('services.finalTitle')}</h2>
        <p style={{ color: 'var(--fg-1)', margin: '18px 0 22px' }}>{t('services.finalBody')}</p>
        <LinkButton variant="primary" to={cta.to} style={{ fontSize: 15, padding: '13px 28px' }} onClick={() => track('service_cta', { service: id, kind: s.cta, from: 'detail-final' })}>
          {cta.label}
        </LinkButton>
      </section>
    </main>
  );
}
