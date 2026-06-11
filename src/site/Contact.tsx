import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pathLanguage, toLocalizedPath } from '../i18n/routing';
import { CONTACT_EMAIL } from '../config/site';

export default function Contact() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const p = (s: string) => toLocalizedPath(s, pathLanguage(pathname));

  return (
    <main data-page="contact" style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 36, marginBottom: 10 }}>{t('contact.title')}</h1>
      <p style={{ color: 'var(--fg-1)', fontSize: 17, marginBottom: 28 }}>{t('contact.body')}</p>
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '26px 22px', display: 'inline-block' }}>
        <div style={{ fontSize: 14, color: 'var(--fg-1)', marginBottom: 6 }}>{t('contact.emailLabel')}</div>
        <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: 20, fontWeight: 700 }}>
          {CONTACT_EMAIL}
        </a>
      </div>
      <div style={{ marginTop: 28 }}>
        <Link to={p('/pachete')} className="btn">
          {t('contact.ctaPackages')}
        </Link>
      </div>
    </main>
  );
}
