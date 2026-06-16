/**
 * Constante de site (date, nu traduceri).
 * CONTACT_EMAIL: provizoriu adresa lui Andrei — de înlocuit cu adresa de domeniu
 * (ex. contact@dataread.ro) după cumpărarea domeniului. (Backlog în DEVLOG.)
 */
export const CONTACT_EMAIL = 'besliandrei@gmail.com';

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

/** Originea publică a site-ului — canonical/hreflang/sitemap. Domeniul oficial e dataread.ro (live);
 *  web.app rămâne doar fallback de hosting. Se poate suprascrie cu VITE_SITE_ORIGIN la build. */
export const SITE_ORIGIN = env.VITE_SITE_ORIGIN || 'https://dataread.ro';
