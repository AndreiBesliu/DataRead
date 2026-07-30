/**
 * Tema publică pe paginile prerandate — HIBRID, fără flash / fără hydration drift:
 *  - `usePublicTheme()` pornește SINCRON din snapshot-ul commit-uit (`PUBLIC_THEME_DEFAULT`) → primul render
 *    client == HTML-ul prerandat (zero mismatch). După mount, se abonează la `siteConfig/publicTheme`
 *    (Firestore) și suprascrie → schimbări live, self-serve, fără redeploy.
 *  - `<PublicThemeStyle>` injectează în <head> CSS-ul temei (`@import` fonturi + font-family) idempotent,
 *    cu cleanup la unmount (ca Seo.tsx) → fonturile se aplică, iar la ieșirea din site (/app|/admin) se curăță.
 *  Variabilele de culoare + fundalul se pun INLINE pe wrapper-ul .theme-banner (SiteLayout), ca să bată
 *  valorile din clasă (ancestor mai apropiat) — vezi SiteLayout.
 */
import { useEffect, useState } from 'react';
import { customThemeCss, type CustomTheme } from '../theme/themes';
import { PUBLIC_THEME_DEFAULT } from '../config/publicTheme';
import { coerceToSitePublic } from '../types/sitePublic';
import { coerceToPageThemes, pageKeyForSlug } from '../types/pageThemes';
import { getSiteConfigOnce } from './siteConfigOnce';

const STYLE_ID = 'public-theme-css';

/** Tema publică curentă. Init = snapshot copt (sincron, == prerender → fără hydration drift); la mount,
 *  citește o dată tema publicată din Firestore (getDoc, nu listener — un listener persistent ar ține
 *  conexiunea deschisă și ar bloca `networkidle` la prerender). Sub automatizare (Playwright: prerender/
 *  boot) NU citim deloc → folosim snapshot-ul copt (deci prerender-ul e determinist + fără timeout). */
export function usePublicTheme(): CustomTheme {
  const [theme, setTheme] = useState<CustomTheme>(PUBLIC_THEME_DEFAULT);
  useEffect(() => {
    let cancelled = false;
    getSiteConfigOnce('publicTheme')
      .then((raw) => { if (!cancelled) setTheme(coerceToSitePublic(raw).theme); })
      .catch(() => {/* offline / interzis → rămâne snapshot-ul copt */});
    return () => { cancelled = true; };
  }, []);
  return theme;
}

/** Felia A: tema unei PAGINI publice = override-ul ei (siteConfig/pageThemes.themes[pageKey]) dacă există, altfel
 *  tema globală (publicTheme). Init = snapshot copt (sincron, == prerender → fără hydration drift); după mount
 *  citește AMBELE docuri o dată (getDoc, webdriver-guard ca prerender-ul să rămână determinist). Override-ul
 *  se aplică post-mount (ca tema globală azi) — scurt flash global→pagină doar pe paginile cu override. */
export function usePagePublicTheme(slug: string): CustomTheme {
  const [theme, setTheme] = useState<CustomTheme>(PUBLIC_THEME_DEFAULT);
  useEffect(() => {
    let cancelled = false;
    const key = pageKeyForSlug(slug);
    // Datele nu se schimbă cu slug-ul — doar CARE override se alege. `getSiteConfigOnce` e memoizat pe
    // sesiune, deci navigarea între pagini re-alege din cache, fără `getDoc`-uri noi.
    Promise.all([getSiteConfigOnce('publicTheme'), getSiteConfigOnce('pageThemes')])
      .then(([gRaw, pRaw]) => {
        if (cancelled) return;
        const global = coerceToSitePublic(gRaw).theme;
        const pt = coerceToPageThemes(pRaw);
        const override = key ? pt.themes[key] : undefined;
        setTheme(override || global);
      })
      .catch(() => {/* offline / interzis → rămâne snapshot-ul copt */});
    return () => { cancelled = true; };
  }, [slug]);
  return theme;
}

/** Injectează în <head> CSS-ul temei (fonturi @import + font-family + vars/bg pe :root — vars redundante,
 *  autoritatea o au cele inline de pe wrapper). Idempotent + cleanup, ca prerender→hidratare să nu dubleze. */
export function PublicThemeStyle({ theme }: { theme: CustomTheme }) {
  useEffect(() => {
    let el = document.head.querySelector<HTMLStyleElement>(`style#${STYLE_ID}`);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      el.setAttribute('data-public-theme', '1');
      document.head.appendChild(el);
    }
    el.textContent = customThemeCss(theme);
    return () => {
      document.head.querySelector(`style#${STYLE_ID}`)?.remove();
    };
  }, [theme]);
  return null;
}
