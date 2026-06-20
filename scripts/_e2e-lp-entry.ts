// Punct de intrare bundle-uit (esbuild → CJS) pentru E2E: re-exportă compilatoarele REALE folosite
// de LP Studio, ca harness-ul de verificare să producă EXACT string-urile pe care le-ar salva editorul.
export { coerceToLandingPage, compilePageDecors, recompileLpAssets } from '../src/types/landingPage';
export { compileBlocks, compileConversion } from '../src/types/lpBlocks';
export { compileDecor, coerceToLpDecor } from '../src/types/lpDecor';
export { customThemeCss, defaultCustomTheme, coerceToCustomTheme } from '../src/theme/themes';
export { sanitizeVariantPart, variantKey, buildLpUrl } from '../src/types/lpAttribution';
// Pentru testul de paritate TS↔JS al constantelor Self Marketing (limits/allowlist/quota).
export { SELF_PROFILE_LIMITS, STRATEGY_DIRECTION_LIMITS, DETAILS_LIMITS, SELF_FREE_TOTAL, SELF_DAILY_CAP } from '../src/types/selfMarketing';
export { INDUSTRIES } from '../src/types/onboarding';
// Pentru paritatea TS↔JS a chrome-ului default (PUBLIC_CHROME_DEFAULT == DEFAULT_SITE_CHROME din functions).
export { PUBLIC_CHROME_DEFAULT } from '../src/config/publicChrome';
