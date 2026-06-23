import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { coerceToPageThemes } from '../types/pageThemes';
import type { CustomTheme } from '../theme/themes';

/** Tema portalului client /app (siteConfig/pageThemes.app), dacă operatorul i-a setat un override (Felia A).
 *  Aplicată pe TOATE paginile /app/* prin AppThemeLayout, ca paginile imbricate (onboarding, self-marketing,
 *  ghid) să fie consistente cu /app. Best-effort getDoc cu gardă webdriver (boot-smoke rămâne determinist).
 *  null → aspectul default actual neschimbat. */
export function useAppPageTheme(): CustomTheme | null {
  const [theme, setTheme] = useState<CustomTheme | null>(null);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    let cancelled = false;
    getDoc(doc(db, 'siteConfig', 'pageThemes'))
      .then((snap) => {
        if (!cancelled) setTheme(coerceToPageThemes(snap.exists() ? snap.data() : null).themes.app || null);
      })
      .catch(() => {
        /* offline / interzis → aspect default */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return theme;
}
