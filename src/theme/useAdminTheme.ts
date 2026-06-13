import { useCallback, useState } from 'react';
import {
  ADMIN_THEMES,
  CUSTOM_THEME_ID,
  DEFAULT_ADMIN_THEME,
  coerceToCustomTheme,
  defaultCustomTheme,
  type CustomTheme,
} from './themes';

const KEY = 'dataread_admin_theme';
const CUSTOM_KEY = 'dataread_admin_theme_custom';

function isValidId(v: string | null): v is string {
  return !!v && (v === CUSTOM_THEME_ID || ADMIN_THEMES.some((th) => th.id === v));
}

export interface AdminThemeState {
  /** Id-ul temei active: un preset sau `custom`. */
  themeId: string;
  setThemeId: (id: string) => void;
  /** Tema personalizată (folosită când themeId === 'custom'). */
  custom: CustomTheme;
  setCustom: (c: CustomTheme) => void;
}

/** Tema aleasă de operator pentru backend — persistată local (per dispozitiv). */
export function useAdminTheme(): AdminThemeState {
  const [themeId, setThemeIdState] = useState<string>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return isValidId(v) ? v : DEFAULT_ADMIN_THEME;
    } catch {
      return DEFAULT_ADMIN_THEME;
    }
  });

  const [custom, setCustomState] = useState<CustomTheme>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      return raw ? coerceToCustomTheme(JSON.parse(raw)) : defaultCustomTheme();
    } catch {
      return defaultCustomTheme();
    }
  });

  const setThemeId = useCallback((v: string) => {
    const id = isValidId(v) ? v : DEFAULT_ADMIN_THEME;
    setThemeIdState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* private mode */
    }
  }, []);

  const setCustom = useCallback((c: CustomTheme) => {
    const cc = coerceToCustomTheme(c);
    setCustomState(cc);
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(cc));
    } catch {
      /* private mode */
    }
  }, []);

  return { themeId, setThemeId, custom, setCustom };
}
