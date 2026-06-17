/**
 * Configurarea publică a site-ului (siteConfig/publicTheme) — administrată din /admin → panoul „Site".
 * Deocamdată: tema publică (CustomTheme: culori/fonturi/imagine). Extensibil (decor, pagini, alte opțiuni
 * de stilizare/content vin în feliile următoare). REGULĂ (CLAUDE.md): orice cale de încărcare trece prin
 * coerceToSitePublic — corupt/legacy → defaults sigure (tema bannerului), niciodată throw.
 */
import { coerceToCustomTheme, type CustomTheme } from '../theme/themes';
import { PUBLIC_THEME_DEFAULT } from '../config/publicTheme';

export const SITE_PUBLIC_SCHEMA = 1;

export interface SitePublic {
  schema: typeof SITE_PUBLIC_SCHEMA;
  theme: CustomTheme;
}

/** Unicul normaliser pentru documentul siteConfig/publicTheme. Lipsă/corupt → tema default (banner). */
export function coerceToSitePublic(raw: unknown): SitePublic {
  const d = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    schema: SITE_PUBLIC_SCHEMA,
    // Dacă nu există încă o temă publicată, păstrăm snapshot-ul commit-uit (banner) ca să nu se schimbe nimic.
    theme: 'theme' in d ? coerceToCustomTheme(d.theme) : PUBLIC_THEME_DEFAULT,
  };
}
