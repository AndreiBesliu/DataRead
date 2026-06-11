import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { persistLanguage } from '../i18n';
import { pathLanguage, stripLangPrefix, toLocalizedPath, type LanguageCode } from '../i18n/routing';
import { cookieConsent, setCookieConsent } from '../services/analytics';
import Seo from './Seo';
import type { PublicRoute } from './publicRoutes';

/** Cadrul paginilor publice, pe tema bannerului (.theme-banner — navy/roșu/albastru).
 *  Site-ul public NU are login (decizie 11.06): intrarea clienților e formularul /start;
 *  doar /admin (backend) are autentificare. Limba derivă din path — comutatorul navighează
 *  la slug-ul echivalent în cealaltă limbă (și persistă alegerea pentru zonele de app). */
export default function SiteLayout({ route, children }: { route: PublicRoute; children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const lang = pathLanguage(pathname);
  const slug = stripLangPrefix(pathname);
  const otherLang: LanguageCode = lang === 'ro' ? 'en' : 'ro';
  const p = (s: string) => toLocalizedPath(s, lang);

  const [consent, setConsent] = useState(cookieConsent());
  const decide = (v: 'granted' | 'denied') => {
    setCookieConsent(v);
    setConsent(v);
  };

  return (
    <div className="theme-banner" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Seo titleKey={route.titleKey} descriptionKey={route.descriptionKey} noindex={route.noindex} />

      <header style={{ borderBottom: '1px solid var(--border)', background: 'rgba(10, 18, 40, 0.92)' }}>
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Link to={p('/')} className="wordmark" style={{ fontSize: 22, textDecoration: 'none' }}>
            {t('app.name')}
          </Link>
          <span style={{ fontSize: 11, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700 }}>
            {t('app.tagline')}
          </span>
          <nav style={{ display: 'flex', gap: 16, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <Link to={p('/pachete')} style={{ color: '#dbe4f5' }}>{t('nav.packages')}</Link>
            <Link to={p('/contact')} style={{ color: '#dbe4f5' }}>{t('nav.contact')}</Link>
            <Link
              to={toLocalizedPath(slug, otherLang)}
              onClick={() => persistLanguage(otherLang)}
              aria-label={otherLang === 'en' ? 'English' : 'Română'}
              style={{ fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', color: 'var(--fg-1)' }}
            >
              {otherLang.toUpperCase()}
            </Link>
            <Link to={p('/start')} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 13 }}>
              {t('landing.heroSecondary')}
            </Link>
          </nav>
        </div>
      </header>

      <div style={{ flex: 1 }}>{children}</div>

      <footer style={{ borderTop: '1px solid var(--border)', background: 'rgba(16, 28, 58, 0.6)', marginTop: 48 }}>
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '20px 24px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, color: 'var(--fg-1)' }}>
          <span>{t('footer.rights')}</span>
          <Link to={p('/legal/termeni')} style={{ color: 'var(--fg-1)' }}>{t('footer.terms')}</Link>
          <Link to={p('/legal/confidentialitate')} style={{ color: 'var(--fg-1)' }}>{t('footer.privacy')}</Link>
          <span style={{ marginLeft: 'auto', color: '#dbe4f5', fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>DATAREAD.RO</span>
        </div>
      </footer>

      {consent === null && (
        <div role="dialog" aria-live="polite" style={{ position: 'fixed', bottom: 16, left: 16, right: 16, maxWidth: 560, margin: '0 auto', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 6px 24px rgba(0,0,0,0.45)', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', zIndex: 50 }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--fg-1)', minWidth: 220 }}>{t('cookies.message')}</span>
          <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => decide('granted')}>{t('cookies.accept')}</button>
          <button className="btn" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => decide('denied')}>{t('cookies.decline')}</button>
        </div>
      )}
    </div>
  );
}
