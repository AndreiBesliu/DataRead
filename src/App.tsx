import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n, { storedLanguage } from './i18n';
import { resolveInitialLanguage, toLocalizedPath } from './i18n/routing';
import Landing from './site/Landing';

/** Ține limba i18n sincronizată cu path-ul la navigările client-side (regula: pe rutele publice
 *  limba derivă STRICT din path; pe /app|/admin din alegerea stocată). */
function LanguageSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const want = resolveInitialLanguage(pathname, storedLanguage());
    if (i18n.language !== want) void i18n.changeLanguage(want);
    document.documentElement.lang = want;
  }, [pathname]);
  return null;
}

function NotFound() {
  const { t, i18n: i } = useTranslation();
  const lang = i.language === 'en' ? 'en' : 'ro';
  return (
    <main data-page="not-found" style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <h1>{t('notFound.title')}</h1>
      <Link to={toLocalizedPath('/', lang)}>{t('notFound.back')}</Link>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageSync />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/en" element={<Landing />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
