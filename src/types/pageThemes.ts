/**
 * Teme PER-PAGINĂ (Felia A) — override de aspect pe fiecare pagină a noastră, peste tema publică globală.
 * Locație: siteConfig/pageThemes (UN doc, map `themes[pageKey] = CustomTheme`). Read public, write admin.
 * Lipsă override → pagina folosește tema globală (publicTheme) — sau, pentru /app, aspectul default actual.
 * PUR (fără Firebase/React), un singur normaliser (coerceToPageThemes) pe toate căile de citire.
 */
import { coerceToCustomTheme, type CustomTheme } from '../theme/themes';

export const PAGE_THEMES_SCHEMA = 1;

/** Cheile de pagină — corespund rutelor + listei din SiteAdminPanel (PLATFORM_PAGES). */
export const PAGE_KEYS = ['home', 'pachete', 'servicii', 'self', 'start', 'contact', 'termeni', 'confid', 'app'] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

/** slug (path, fără prefix de limbă) → cheia de pagină. Slug-urile necunoscute → undefined (fără override). */
export const PAGE_KEY_BY_SLUG: Record<string, PageKey> = {
  '/': 'home',
  '/pachete': 'pachete',
  '/servicii': 'servicii',
  '/self-marketing': 'self',
  '/start': 'start',
  '/contact': 'contact',
  '/legal/termeni': 'termeni',
  '/legal/confidentialitate': 'confid',
  '/app': 'app',
};

export interface PageThemes {
  schema: typeof PAGE_THEMES_SCHEMA;
  themes: Partial<Record<PageKey, CustomTheme>>;
}

/** Unicul normaliser. Include DOAR cheile prezente efectiv în date (ca o pagină fără override să NU primească
 *  o temă default) — fiecare prin coerceToCustomTheme. Corupt/lipsă → { themes: {} }, niciodată throw. */
export function coerceToPageThemes(raw: unknown): PageThemes {
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const src = d.themes && typeof d.themes === 'object' ? (d.themes as Record<string, unknown>) : {};
  const themes: Partial<Record<PageKey, CustomTheme>> = {};
  for (const k of PAGE_KEYS) {
    const v = src[k];
    if (v && typeof v === 'object') themes[k] = coerceToCustomTheme(v);
  }
  return { schema: PAGE_THEMES_SCHEMA, themes };
}

/** Tema unei pagini dacă are override, altfel null (apelantul cade pe tema globală / default). */
export function pageThemeFor(pt: PageThemes, key: PageKey | undefined): CustomTheme | null {
  return key && pt.themes[key] ? (pt.themes[key] as CustomTheme) : null;
}

/** Cheia de pagină pentru un slug (helper pt. SiteLayout). */
export function pageKeyForSlug(slug: string): PageKey | undefined {
  return PAGE_KEY_BY_SLUG[slug];
}
