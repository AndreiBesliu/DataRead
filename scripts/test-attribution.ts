// Teste pentru motorul PUR de atribuire per-link (src/types/lpAttribution.ts). Paritatea cu portul JS
// din functions/index.js e verificată separat în scripts/e2e-lp-serve.mjs (cross-runtime).
import {
  sanitizeVariantPart,
  variantKey,
  buildLpUrl,
  cleanAttr,
  hasAttr,
  coerceToLpLink,
  coerceToLpVariant,
  variantConvRate,
  LP_VARIANT_DIRECT,
  LP_VARIANT_OTHER,
} from '../src/types/lpAttribution';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}

// ── sanitizeVariantPart ──
check('sanitize: minuscule + spații → cratimă', sanitizeVariantPart('Black Friday') === 'black-friday');
check('sanitize: diacritice RO → ASCII', sanitizeVariantPart('Lansare Iarnă ăâîșț') === 'lansare-iarna-aaist');
check('sanitize: simboluri colapsate + trim', sanitizeVariantPart('  ~Promo!!! 50%~  ') === 'promo-50');
check('sanitize: gol → "-"', sanitizeVariantPart('') === '-' && sanitizeVariantPart(null) === '-' && sanitizeVariantPart(undefined) === '-');
check('sanitize: doar simboluri/emoji → "-"', sanitizeVariantPart('🔥🔥') === '-' && sanitizeVariantPart('!!!') === '-');
check('sanitize: tăiat la 40 caractere', sanitizeVariantPart('a'.repeat(80)).length === 40);
check('sanitize: fără ~ în rezultat (separatorul de cheie)', !sanitizeVariantPart('a~b~c').includes('~') && sanitizeVariantPart('a~b~c') === 'a-b-c');

// ── variantKey ──
check('variantKey: format source~medium~campaign~content', variantKey({ source: 'Facebook', medium: 'Video', campaign: 'Lansare', content: 'V2' }) === 'facebook~video~lansare~v2');
check('variantKey: term EXCLUS din cheie', variantKey({ source: 'a', medium: 'b', campaign: 'c', content: 'd', term: 'IGNORAT' }) === 'a~b~c~d');
check('variantKey: dimensiuni lipsă → "-"', variantKey({ source: 'tiktok' }) === 'tiktok~-~-~-');
check('variantKey: idempotent pe atribuire deja curățată', variantKey(cleanAttr({ source: 'TikTok', content: 'Reel #1' })) === variantKey({ source: 'TikTok', content: 'Reel #1' }));
check('variantKey: gol total → "-~-~-~-"', variantKey({}) === '-~-~-~-');
check('variantKey: nu produce bucketele rezervate', variantKey({ source: '__direct' }) !== LP_VARIANT_DIRECT && variantKey({ source: '__other' }).indexOf('_') === -1);

// ── hasAttr ──
check('hasAttr: false dacă toate goale', hasAttr(cleanAttr({})) === false);
check('hasAttr: true dacă o dimensiune reală', hasAttr(cleanAttr({ medium: 'static' })) === true);
check('hasAttr: term singur NU contează', hasAttr(cleanAttr({ term: 'cuvant' })) === false);

// ── buildLpUrl ──
check('buildLpUrl: doar parametri ne-goi + sanitizați', buildLpUrl('https://x.ro', 'promo', { source: 'Facebook', medium: 'Video', campaign: 'Lansare Iarnă', content: '', term: '' }) === 'https://x.ro/p/promo?utm_source=facebook&utm_medium=video&utm_campaign=lansare-iarna');
check('buildLpUrl: fără UTM → URL de bază', buildLpUrl('https://x.ro/', 'promo', {}) === 'https://x.ro/p/promo');
check('buildLpUrl: include utm_term când există', buildLpUrl('https://x.ro', 's', { term: 'kw' }).includes('utm_term=kw'));

// ── coerce ──
check('coerceToLpLink: normalizează + calculează variantKey', (() => {
  const l = coerceToLpLink({ label: 'Promo FB video', source: 'Facebook', medium: 'Video', campaign: 'Lansare', content: 'V2', term: '', url: 'https://x' });
  return l.schema === 1 && l.source === 'facebook' && l.variantKey === 'facebook~video~lansare~v2';
})());
check('coerceToLpVariant: numere clamp-uite, key păstrat', (() => {
  const v = coerceToLpVariant('facebook~video~lansare~v2', { source: 'facebook', visits: 10, submissions: 2, ctaClicks: -5, beacons: 'x' });
  return v.key === 'facebook~video~lansare~v2' && v.visits === 10 && v.submissions === 2 && v.ctaClicks === 0 && v.beacons === 0;
})());
check('variantConvRate: submissions/visits sau null', (() => {
  const v = coerceToLpVariant('k', { visits: 100, submissions: 5 });
  const z = coerceToLpVariant('z', { visits: 0, submissions: 0 });
  return v && variantConvRate(v) === 0.05 && variantConvRate(z) === null;
})());

console.log(failures === 0 ? '\nlp attribution: all checks passed' : `\nlp attribution: ${failures} FAILED`);
if (failures > 0) process.exit(1);
