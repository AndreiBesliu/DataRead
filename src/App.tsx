import { lazy, Suspense, useEffect, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n, { storedLanguage } from './i18n';
import { resolveInitialLanguage, toLocalizedPath } from './i18n/routing';
import { useAuthInit } from './auth/useAuthInit';
import { PUBLIC_ROUTES, type PublicRoute } from './site/publicRoutes';
import SiteLayout from './site/SiteLayout';
// Paginile PUBLICE rămân import STATIC (sunt prerenderizate → HTML determinist, fără flash de Suspense).
import Landing from './site/Landing';
import Packages from './site/Packages';
import StartPage from './site/StartPage';
import SelfMarketing from './site/SelfMarketing';
import SelfMarketingPackages from './site/SelfMarketingPackages';
import Contact from './site/Contact';
import Legal from './site/Legal';
// Rutele auth-gated (NU sunt prerenderizate) = lazy → ies din bundle-ul principal, se încarcă la cerere.
const AppHome = lazy(() => import('./app/AppHome'));
const OnboardingForm = lazy(() => import('./app/OnboardingForm'));
const SelfMarketingFunnel = lazy(() => import('./app/SelfMarketingFunnel'));
const HelpHome = lazy(() => import('./app/HelpHome'));
const AdminHome = lazy(() => import('./admin/AdminHome'));

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
  '/self-marketing': <SelfMarketing />,
  '/self-marketing/pachete': <SelfMarketingPackages />,
  '/start': <StartPage />,
  '/contact': <Contact />,
  '/legal/termeni': <Legal kind="termeni" />,
  '/legal/confidentialitate': <Legal kind="confidentialitate" />,
};

function publicElement(route: PublicRoute): ReactElement {
  return <SiteLayout route={route}>{PAGE_FOR_SLUG[route.slug]}</SiteLayout>;
}

function RouteFallback() {
  return <main data-page="route-loading" style={{ padding: 64, textAlign: 'center', color: 'var(--fg-1)' }}>…</main>;
}

function AppShell() {
  useAuthInit();
  // Suspense învelește TOT, dar doar rutele lazy (auth-gated) suspendă; cele publice (statice) randează imediat
  // ⇒ HTML-ul prerenderizat rămâne neschimbat.
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {PUBLIC_ROUTES.map((r) => (
        <Route key={r.slug} path={r.slug} element={publicElement(r)} />
      ))}
      {PUBLIC_ROUTES.map((r) => (
        <Route key={`en:${r.slug}`} path={toLocalizedPath(r.slug, 'en')} element={publicElement(r)} />
      ))}
      <Route path="/app" element={<AppHome />} />
      <Route path="/app/onboarding" element={<OnboardingForm />} />
      <Route path="/app/self-marketing" element={<SelfMarketingFunnel />} />
      <Route path="/app/ghid" element={<HelpHome />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
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
