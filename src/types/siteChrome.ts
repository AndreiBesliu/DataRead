/**
 * Chrome-ul global al site-ului NOSTRU (siteConfig/publicChrome) — header/topbar + footer, proiectate o
 * singură dată în /admin („Site") și aplicate pe TOATE paginile noastre: paginile React (SiteLayout) +
 * paginile de site `kind:'site'` (serveLp /pagina/{slug}). NU se aplică pe LP-urile de campanie (/p/).
 * Etichete LITERALE per-limbă (ro+en) — fără i18n în functions; serveLp alege limba după lp.lang; EN cade pe RO.
 * REGULĂ (CLAUDE.md): orice cale de încărcare trece prin coerceToSiteChrome — corupt/legacy → defaults sigure.
 */
import { PUBLIC_CHROME_DEFAULT } from '../config/publicChrome';

export const SITE_CHROME_SCHEMA = 1;
export const CHROME_ITEMS_MAX = 12;

// Evidențierea opțională a unui item de meniu (CTA) + animația — customizabile din /admin (ChromeEditor).
// 'none' = link simplu (comportamentul de dinainte). Aplicate IDENTIC în SiteLayout (React) și serveLp (functions).
export const CHROME_EMPHASES = ['none', 'solid', 'outline', 'glow', 'gradient'] as const;
export type ChromeEmphasis = (typeof CHROME_EMPHASES)[number];
export const CHROME_ANIMS = ['none', 'pulse', 'shine', 'bounce', 'flash'] as const;
export type ChromeAnim = (typeof CHROME_ANIMS)[number];

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export interface ChromeItem {
  labelRo: string;
  labelEn: string;
  href: string; // INTERNAL-ONLY (începe cu '/', fără '//' sau schemă) — anti open-redirect/js: în serveLp
  /** Stil de evidențiere (implicit 'none' = link simplu). */
  emphasis?: ChromeEmphasis;
  /** Animație (implicit 'none'). */
  anim?: ChromeAnim;
  /** Culoare accent opțională (hex #rrggbb); gol → var(--accent). */
  color?: string;
}

function emphasisOf(v: unknown): ChromeEmphasis {
  return CHROME_EMPHASES.includes(v as ChromeEmphasis) ? (v as ChromeEmphasis) : 'none';
}
function animOf(v: unknown): ChromeAnim {
  return CHROME_ANIMS.includes(v as ChromeAnim) ? (v as ChromeAnim) : 'none';
}
function hexOf(v: unknown): string {
  return typeof v === 'string' && HEX6.test(v) ? v : '';
}

/** Clasele CSS pentru evidențiere + animație (gol = link simplu). Folosit de SiteLayout + ChromeEditor (preview). */
export function chromeItemClass(it: ChromeItem): string {
  const e = it.emphasis && it.emphasis !== 'none' ? `navcta navcta-${it.emphasis}` : '';
  const a = it.anim && it.anim !== 'none' ? `navanim-${it.anim}` : '';
  return [e, a].filter(Boolean).join(' ');
}

export interface SiteChrome {
  schema: typeof SITE_CHROME_SCHEMA;
  brandName: string;
  taglineRo: string;
  taglineEn: string;
  nav: ChromeItem[];
  ctaLabelRo: string;
  ctaLabelEn: string;
  ctaHref: string;
  footerTextRo: string;
  footerTextEn: string;
  footerLinks: ChromeItem[];
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/** Path intern sigur: începe cu '/' dar nu '//' (protocol-relative); altfel '#'. Fără javascript:/http(s):. */
export function internalHref(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '/' || (/^\/[^/]/.test(s) && s.length <= 200) ? s : '#';
}

function coerceItems(v: unknown): ChromeItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((raw) => {
      const d = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      return {
        labelRo: str(d.labelRo, 60),
        labelEn: str(d.labelEn, 60),
        href: internalHref(d.href),
        emphasis: emphasisOf(d.emphasis),
        anim: animOf(d.anim),
        color: hexOf(d.color),
      };
    })
    .filter((it) => it.labelRo || it.labelEn) // un item fără nicio etichetă nu are sens
    .slice(0, CHROME_ITEMS_MAX);
}

/** Eticheta unui item pentru limba dată (EN cade pe RO dacă e gol). */
export function chromeLabel(it: ChromeItem, lang: 'ro' | 'en'): string {
  return (lang === 'en' ? it.labelEn || it.labelRo : it.labelRo) || '';
}

/** Unicul normaliser pentru documentul siteConfig/publicChrome. Lipsă/corupt → snapshot-ul copt (default). */
export function coerceToSiteChrome(raw: unknown): { schema: typeof SITE_CHROME_SCHEMA; chrome: SiteChrome } {
  const d = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  if (!('chrome' in d) || typeof d.chrome !== 'object' || d.chrome === null) {
    return { schema: SITE_CHROME_SCHEMA, chrome: PUBLIC_CHROME_DEFAULT };
  }
  const c = d.chrome as Record<string, unknown>;
  const def = PUBLIC_CHROME_DEFAULT;
  return {
    schema: SITE_CHROME_SCHEMA,
    chrome: {
      schema: SITE_CHROME_SCHEMA,
      brandName: str(c.brandName, 40) || def.brandName,
      taglineRo: str(c.taglineRo, 120),
      taglineEn: str(c.taglineEn, 120),
      nav: coerceItems(c.nav),
      ctaLabelRo: str(c.ctaLabelRo, 40),
      ctaLabelEn: str(c.ctaLabelEn, 40),
      ctaHref: c.ctaHref == null || c.ctaHref === '' ? '' : internalHref(c.ctaHref),
      footerTextRo: str(c.footerTextRo, 200),
      footerTextEn: str(c.footerTextEn, 200),
      footerLinks: coerceItems(c.footerLinks),
    },
  };
}
