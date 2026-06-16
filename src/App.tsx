import { useEffect, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n, { storedLanguage } from './i18n';
import { resolveInitialLanguage, toLocalizedPath } from './i18n/routing';
import { useAuthInit } from './auth/useAuthInit';
import { PUBLIC_ROUTES, type PublicRoute } from './site/publicRoutes';
import SiteLayout from './site/SiteLayout';
import Landing from './site/Landing';
import Packages from './site/Packages';
import StartPage from './site/StartPage';
import Contact from './site/Contact';
import Legal from './site/Legal';
import AppHome from './app/AppHome';
import OnboardingForm from './app/OnboardingForm';
import HelpHome from './app/HelpHome';
import AdminHome from './admin/AdminHome';

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

// Componenta fiecărui slug public (sursa rutelor: site/publicRoutes.ts).
const PAGE_FOR_SLUG: Record<string, ReactElement> = {
  '/': <Landing />,
  '/pachete': <Packages />,
  '/start': <StartPage />,
  '/contact': <Contact />,
  '/legal/termeni': <Legal kind="termeni" />,
  '/legal/confidentialitate': <Legal kind="confidentialitate" />,
};

function publicElement(route: PublicRoute): ReactElement {
  return <SiteLayout route={route}>{PAGE_FOR_SLUG[route.slug]}</SiteLayout>;
}

function AppShell() {
  useAuthInit();
  return (
    <Routes>
      {PUBLIC_ROUTES.map((r) => (
        <Route key={r.slug} path={r.slug} element={publicElement(r)} />
      ))}
      {PUBLIC_ROUTES.map((r) => (
        <Route key={`en:${r.slug}`} path={toLocalizedPath(r.slug, 'en')} element={publicElement(r)} />
      ))}
      <Route path="/app" element={<AppHome />} />
      <Route path="/app/onboarding" element={<OnboardingForm />} />
      <Route path="/app/ghid" element={<HelpHome />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageSync />
      <AppShell />
    </BrowserRouter>
  );
}
