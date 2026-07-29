import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ro from './locales/ro';
import en from './locales/en';
import { DEFAULT_LANGUAGE, resolveInitialLanguage } from './routing';
import { applyContentOverrides } from './contentOverride';
import { coerceToPageContent } from '../types/pageContent';
import { PAGE_CONTENT_DEFAULT } from '../config/pageContentSnapshot';

/** Limbile din comutator. O limbă nouă = modul de locale + intrare aici. */
export const SUPPORTED_LANGUAGES = [
  { code: 'ro', label: 'Română' },
  { code: 'en', label: 'English' },
] as const;

export const LANGUAGE_STORAGE_KEY = 'dataread_lang';

export function storedLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Persistă alegerea explicită a utilizatorului (comutatorul de limbă, /app). */
export function persistLanguage(code: string): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    /* private mode */
  }
}

// Limba inițială: pe rutele publice STRICT din path (prerender-safe); pe /app|/admin din storage.
// Fără detector de browser — produsul e ro-primar și determinist.
const initialLng =
  typeof window !== 'undefined'
    ? resolveInitialLanguage(window.location.pathname, storedLanguage())
    : DEFAULT_LANGUAGE;

void i18n.use(initReactI18next).init({
  resources: {
    ro: { translation: ro },
    en: { translation: en },
  },
  lng: initialLng,
  fallbackLng: 'ro',
  supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
  nonExplicitSupportedLngs: true, // 'ro-RO' / 'en-US' → 'ro' / 'en'
  interpolation: { escapeValue: false }, // React escapă deja
  returnNull: false,
  // Felia B: `addResourceBundle` post-mount (override-urile publicate după ultimul build) trebuie să
  // RE-RANDEZE componentele montate. Fără 'added', react-i18next ascultă doar schimbarea de limbă.
  react: { bindI18nStore: 'added' },
});

// Felia B — override-urile de conținut COAPTE (snapshot commit-uit) se aplică SINCRON, înainte de primul
// render: HTML-ul prerandat == primul render client ⇒ zero flash pe textele deja publicate la build.
// Ce s-a publicat între timp vine post-mount, din Firestore (`useLiveContentOverrides`, SiteLayout).
// try/catch: asta rulează la IMPORT, primul modul din main.tsx. O excepție aici ar omorî tot boot-ul
// ȘI build-ul (prerender.mjs pică la orice `pageerror`) — textele nu merită niciodată atâta.
try {
  applyContentOverrides(i18n, coerceToPageContent(PAGE_CONTENT_DEFAULT));
} catch (e) {
  console.warn('Override-urile de conținut coapte nu s-au putut aplica:', e);
}

export default i18n;
