/**
 * Sursa unică a rutelor publice — consumată de router (App.tsx), de prerender
 * (scripts/prerender.mjs) și de sitemap. Slug-urile sunt fără prefix de limbă;
 * varianta en trăiește la /en<slug> (vezi src/i18n/routing.ts).
 */
import { SERVICE_IDS } from '../config/services';

export interface PublicRoute {
  /** Slug-ul ro, cu / inițial (ex. '/pachete'). */
  slug: string;
  /** Cheia i18n pentru <title>. */
  titleKey: string;
  /** Cheia i18n pentru meta description. */
  descriptionKey: string;
  /** Paginile noindex (ex. legal-draft) nu intră în sitemap. */
  noindex?: boolean;
}

export const PUBLIC_ROUTES: PublicRoute[] = [
  { slug: '/', titleKey: 'seo.homeTitle', descriptionKey: 'seo.homeDescription' },
  { slug: '/pachete', titleKey: 'seo.packagesTitle', descriptionKey: 'seo.packagesDescription' },
  { slug: '/servicii', titleKey: 'seo.servicesTitle', descriptionKey: 'seo.servicesDescription' },
  // Pagini de detaliu per-serviciu (/servicii/<id>) — slug concret per serviciu → prerenderizate + în sitemap;
  // SEO din services.<id>.metaTitle/metaDesc (SiteLayout). Pagina = ServiceDetail (App.tsx publicElement).
  ...SERVICE_IDS.map((id) => ({
    slug: `/servicii/${id}`,
    titleKey: `services.${id}.metaTitle`,
    descriptionKey: `services.${id}.metaDesc`,
  })),
  { slug: '/self-marketing', titleKey: 'seo.selfMarketingTitle', descriptionKey: 'seo.selfMarketingDescription' },
  { slug: '/self-marketing/pachete', titleKey: 'seo.selfPackagesTitle', descriptionKey: 'seo.selfPackagesDescription' },
  { slug: '/start', titleKey: 'seo.startTitle', descriptionKey: 'seo.startDescription' },
  { slug: '/contact', titleKey: 'seo.contactTitle', descriptionKey: 'seo.contactDescription' },
  { slug: '/legal/termeni', titleKey: 'seo.termsTitle', descriptionKey: 'seo.termsDescription', noindex: true },
  { slug: '/legal/confidentialitate', titleKey: 'seo.privacyTitle', descriptionKey: 'seo.privacyDescription', noindex: true },
];
