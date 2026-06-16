/**
 * Pagina de pachete pentru Self Marketing — DISTINCTĂ de pachetele de agenție (/pachete). Model self-serve
 * pe credite (o explorare AI = 1 credit), inspirat de competitor. Prețurile/creditele sunt PROVIZORII (Andrei
 * le definește) — plățile sunt momentan dezactivate, deci CTA-ul duce la trialul gratuit. Tot textul prin t().
 */
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pathLanguage, toLocalizedPath } from '../i18n/routing';

interface SelfPack {
  id: 'starter' | 'business' | 'professional';
  price: string; // LEI (provizoriu)
  credits: number;
  highlighted: boolean;
  features: string[]; // chei i18n
}

const PACKS: SelfPack[] = [
  { id: 'starter', price: '19', credits: 10, highlighted: false, features: ['feat_strategies', 'feat_channels', 'feat_export'] },
  { id: 'business', price: '79', credits: 50, highlighted: true, features: ['feat_strategies', 'feat_channels', 'feat_details', 'feat_export', 'feat_history'] },
  { id: 'professional', price: '249', credits: 200, highlighted: false, features: ['feat_strategies', 'feat_channels', 'feat_details', 'feat_export', 'feat_history', 'feat_priority'] },
];

export default function SelfMarketingPackages() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const lang = pathLanguage(pathname);

  return (
    <main data-page="self-packages" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '48px 24px' }}>
      <Link to={toLocalizedPath('/self-marketing', lang)} style={{ fontSize: 13, color: '#dbe4f5' }}>← {t('selfPackages.back')}</Link>
      <h1 style={{ textAlign: 'center', fontSize: 36, margin: '10px 0 6px' }}>{t('selfPackages.title')}</h1>
      <p style={{ textAlign: 'center', color: 'var(--fg-1)', marginBottom: 8 }}>{t('selfPackages.subtitle')}</p>
      <p style={{ textAlign: 'center', color: 'var(--fg-1)', fontSize: 13, marginBottom: 28 }}>{t('selfPackages.oneCredit')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, alignItems: 'stretch' }}>
        {PACKS.map((pk) => (
          <div
            key={pk.id}
            data-testid="self-pack-card"
            style={{
              background: 'var(--bg-1)',
              border: pk.highlighted ? '2px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '24px 22px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {pk.highlighted && (
              <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '3px 12px', whiteSpace: 'nowrap' }}>
                {t('selfPackages.highlight')}
              </span>
            )}
            <h3 style={{ margin: '0 0 4px', fontSize: 20 }}>{t(`selfPackages.${pk.id}_name`)}</h3>
            <div style={{ fontSize: 32, fontWeight: 800, margin: '4px 0' }}>
              {pk.price} <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)' }}>{t('selfPackages.currency')}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
              +{pk.credits} {t('selfPackages.credits')}
            </div>
            <p style={{ color: 'var(--fg-1)', fontSize: 14, minHeight: 42, marginTop: 8 }}>{t(`selfPackages.${pk.id}_tagline`)}</p>

            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: '10px 0', flex: 1, fontSize: 14 }}>
              {pk.features.map((k) => (
                <li key={k} style={{ margin: '6px 0' }}>✓ {t(`selfPackages.${k}`)}</li>
              ))}
            </ul>

            <Link to="/app/self-marketing" className="btn btn-primary" style={{ textAlign: 'center', marginTop: 12 }}>
              {t('selfPackages.choose')}
            </Link>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700 }}>🎁 {t('selfPackages.freeTitle')}</p>
        <p style={{ margin: 0, color: 'var(--fg-1)', fontSize: 14 }}>{t('selfPackages.freeBody')}</p>
      </div>

      <p style={{ marginTop: 16, textAlign: 'center', color: 'var(--fg-1)', fontSize: 13 }}>{t('selfPackages.paymentsOff')}</p>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Link to="/app/self-marketing" className="btn btn-primary" style={{ padding: '11px 26px', fontSize: 15 }}>
          {t('selfPackages.cta')}
        </Link>
      </div>
    </main>
  );
}
