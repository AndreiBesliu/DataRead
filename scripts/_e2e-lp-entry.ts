// Punct de intrare bundle-uit (esbuild → CJS) pentru E2E: re-exportă compilatoarele REALE folosite
// de LP Studio, ca harness-ul de verificare să producă EXACT string-urile pe care le-ar salva editorul.
export { coerceToLandingPage, compilePageDecors, recompileLpAssets } from '../src/types/landingPage';
export { compileBlocks, compileConversion } from '../src/types/lpBlocks';
export { compileDecor, coerceToLpDecor } from '../src/types/lpDecor';
export { customThemeCss, defaultCustomTheme, coerceToCustomTheme } from '../src/theme/themes';
export { sanitizeVariantPart, variantKey, buildLpUrl } from '../src/types/lpAttribution';
// Pentru testul de paritate TS↔JS al constantelor Self Marketing (limits/allowlist/quota).
export { SELF_PROFILE_LIMITS, STRATEGY_DIRECTION_LIMITS, DETAILS_LIMITS, OPPORTUNITY_LIMITS, EXECUTION_LIMITS, SELF_FREE_TOTAL, SELF_DAILY_CAP } from '../src/types/selfMarketing';
// Paritate TS↔JS pt. configul fair-share Self Marketing (coerce + selectorul de coș).
export { coerceToSelfMarketingConfig, selfPoolFor, SELF_MKT_CONFIG_DEFAULT, SELF_POOL_ENTITLED_DOC, SELF_POOL_TRIAL_DOC } from '../src/types/selfMarketingConfig';
export { INDUSTRIES } from '../src/types/onboarding';
// Paritate TS↔JS pt. livrabilele structurate (felia 5a): coerce TS vs clampDeliverables JS.
export { coerceToDeliverables, coerceToMarketingRequest } from '../src/types/request';
// Pentru paritatea TS↔JS a chrome-ului default (PUBLIC_CHROME_DEFAULT == DEFAULT_SITE_CHROME din functions).
export { PUBLIC_CHROME_DEFAULT } from '../src/config/publicChrome';
