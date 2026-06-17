/**
 * Snapshot COMMIT-UIT al temei publice — sursa SINCRONĂ folosită la render + prerender, ca paginile să
 * apară temate FĂRĂ flash și fără hydration drift (server == primul render client). La runtime, SiteLayout
 * suprascrie din `siteConfig/publicTheme` (Firestore) → schimbări live, self-serve. Acest fișier se
 * re-coace din Firestore la deploy (vezi scripts/pull-public-theme.mjs). Init = culorile actuale ale
 * bannerului (.theme-banner) → zero schimbare vizuală până când un admin publică o temă.
 */
import type { CustomTheme } from '../theme/themes';

export const PUBLIC_THEME_DEFAULT: CustomTheme = {
  schema: 1,
  base: 'midnight',
  label: 'Site',
  vars: {
    'bg-0': '#0a1228',
    'bg-1': '#101c3a',
    'fg-0': '#ffffff',
    'fg-1': '#9fb0d0',
    border: '#21335e',
    accent: '#e02639',
    'accent-dark': '#b81d2e',
    'accent-contrast': '#ffffff',
  },
  digital: false,
  bgImage: '',
  animation: 'none',
  headingFont: '',
  bodyFont: '',
};
