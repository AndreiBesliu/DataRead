/**
 * Limba pe rutele PUBLICE derivă STRICT din path (regulă pentru prerender: o valoare stocată
 * 'en' nu are voie să răstoarne o pagină ro prerenderizată după hidratare). Rutele de aplicație
 * (/app, /admin — neprerenderizate) folosesc alegerea stocată, cu fallback ro.
 * Funcții pure — testate headless în scripts/test-i18n-routing.ts.
 */

export type LanguageCode = 'ro' | 'en';

export const DEFAULT_LANGUAGE: LanguageCode = 'ro';

/** /app și /admin (cu sub-rute) sunt zone de aplicație, nu pagini publice. */
export function isAppPath(pathname: string): boolean {
  return (
    pathname === '/app' || pathname.startsWith('/app/') ||
    pathname === '/admin' || pathname.startsWith('/admin/')
  );
}

/** Limba unei rute publice: /en sau /en/* → en; orice altceva → ro. */
export function pathLanguage(pathname: string): LanguageCode {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ro';
}

/** Limba inițială la boot: public = din path; app/admin = din storage (doar valori valide), altfel ro. */
export function resolveInitialLanguage(pathname: string, stored: string | null): LanguageCode {
  if (!isAppPath(pathname)) return pathLanguage(pathname);
  return stored === 'en' || stored === 'ro' ? stored : DEFAULT_LANGUAGE;
}

/** '/pachete' + en → '/en/pachete'; '/' + en → '/en'; ro lasă slug-ul neatins. */
export function toLocalizedPath(slug: string, lang: LanguageCode): string {
  const clean = slug.startsWith('/') ? slug : `/${slug}`;
  if (lang === 'en') return clean === '/' ? '/en' : `/en${clean}`;
  return clean;
}

/** Inversul lui toLocalizedPath: scoate prefixul /en. */
export function stripLangPrefix(pathname: string): string {
  if (pathname === '/en') return '/';
  if (pathname.startsWith('/en/')) return pathname.slice(3);
  return pathname;
}
