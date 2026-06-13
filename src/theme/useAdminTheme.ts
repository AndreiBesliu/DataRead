import { useCallback, useState } from 'react';
import { ADMIN_THEMES, DEFAULT_ADMIN_THEME } from './themes';

const KEY = 'dataread_admin_theme';

/** Tema aleasă de operator pentru backend — persistată local (per dispozitiv). */
export function useAdminTheme(): readonly [string, (id: string) => void] {
  const [id, setId] = useState<string>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v && ADMIN_THEMES.some((th) => th.id === v) ? v : DEFAULT_ADMIN_THEME;
    } catch {
      return DEFAULT_ADMIN_THEME;
    }
  });
  const set = useCallback((v: string) => {
    setId(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* private mode */
    }
  }, []);
  return [id, set] as const;
}
