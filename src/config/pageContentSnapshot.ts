/**
 * Snapshot COMMIT-UIT al override-urilor de conținut (Felia B) — regenerat de
 * `scripts/pull-page-content.mjs` din `siteConfig/pageContent`, manual în sync ÎNAINTE de `build:site`.
 *
 * De ce există: prerenderul NU citește Firestore (guard `navigator.webdriver`, ca build-ul să rămână
 * determinist). Fără snapshot, HTML-ul static ar conține mereu textele din i18n, iar override-ul ar
 * apărea abia post-mount → FLASH la fiecare încărcare + crawlerele n-ar vedea niciodată textul real.
 * Cu snapshot: prerender == primul render client == textul publicat. Ce s-a publicat DUPĂ ultimul
 * build se aplică tot post-mount (flash doar pe acele chei, până la următorul deploy).
 *
 * Exact tiparul hibrid de la temă (`publicTheme.ts`) și chrome (`publicChrome.ts`).
 * NU edita manual — rulează `node scripts/pull-page-content.mjs`.
 */
import type { PageContent } from '../types/pageContent';

export const PAGE_CONTENT_DEFAULT: PageContent = {
  "schema": 1,
  "content": {
    "ro": {},
    "en": {}
  }
};
