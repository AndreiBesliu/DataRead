import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pathLanguage, toLocalizedPath } from '../i18n/routing';
import { track } from '../services/analytics';
import { PACKAGES, UPSELLS, type PackageDef } from '../config/packages';

/** Cardul unui pachet. CTA: cu priceId setat → fluxul de cont/checkout (/app?pkg=…);
 *  fără priceId (pre-Stripe) → „Contactează-ne". */
function PackageCard({ pkg }: { pkg: PackageDef }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const lang = pathLanguage(pathname);
  const name = t(pkg.nameKey);

  return (
    <div
      data-testid="package-card"
      style={{
        background: 'var(--bg-1)',
        border: pkg.highlighted ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '24px 22px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {pkg.highlighted && (
        <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '3px 12px', whiteSpace: 'nowrap' }}>
          {t('pachete.highlight')}
        </span>
      )}
      <h3 style={{ margin: '0 0 4px', fontSize: 20 }}>
        {pkg.emoji} {name}
      </h3>
      <div style={{ fontSize: 32, fontWeight: 800, margin: '4px 0' }}>
        {pkg.monthlyAmount}
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)' }}> {t('pachete.perMonth')}</span>
      </div>
      <p style={{ color: 'var(--fg-1)', fontSize: 14, minHeight: 42 }}>{t(pkg.taglineKey)}</p>

      <div style={{ fontSize: 14, flex: 1 }}>
        <strong>{pkg.inheritsNameKey ? t('pachete.everythingIn', { name: t(pkg.inheritsNameKey) }) : t('pachete.includes')}</strong>
        <ul style={{ paddingLeft: 0, listStyle: 'none', margin: '10px 0' }}>
          {pkg.featureKeys.map((k) => (
            <li key={k} style={{ margin: '6px 0' }}>✓ {t(k)}</li>
          ))}
        </ul>
        {pkg.excludedKeys.length > 0 && (
          <>
            <strong style={{ color: 'var(--fg-1)' }}>{t('pachete.excludes')}</strong>
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: '10px 0', color: 'var(--fg-1)' }}>
              {pkg.excludedKeys.map((k) => (
                <li key={k} style={{ margin: '6px 0' }}>✗ {t(k)}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Site fără login (decizie 11.06): CTA-ul duce la formularul public /start cu pachetul
          preselectat. Când revine self-serve-ul Stripe, ramura cu priceId → /app?pkg= se reactivează. */}
      <Link to={`${toLocalizedPath('/start', lang)}?pkg=${pkg.id}`} className="btn btn-primary" style={{ textAlign: 'center', marginTop: 12 }} onClick={() => track('package_cta', { pkg: pkg.id })}>
        {t('pachete.choose', { name })}
      </Link>
    </div>
  );
}

export default function Packages() {
  const { t } = useTranslation();
  useEffect(() => { track('packages_view'); }, []);

  return (
    <main data-page="packages" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ textAlign: 'center', fontSize: 36, marginBottom: 6 }}>{t('pachete.title')}</h1>
      <p style={{ textAlign: 'center', color: 'var(--fg-1)', marginBottom: 36 }}>{t('pachete.subtitle')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'stretch' }}>
        {PACKAGES.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} />
        ))}
      </div>

      <section style={{ marginTop: 48 }}>
        <h2 style={{ textAlign: 'center', fontSize: 26, marginBottom: 4 }}>{t('pachete.upsellsTitle')}</h2>
        <p style={{ textAlign: 'center', color: 'var(--fg-1)', marginBottom: 20 }}>{t('pachete.upsellsSubtitle')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {UPSELLS.map((u) => (
            <div key={u.id} data-testid="upsell-card" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 14px' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {u.emoji} {t(u.nameKey)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t(u.descriptionKey)}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
