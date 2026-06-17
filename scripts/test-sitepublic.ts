// Suite headless: tema publică (siteConfig/publicTheme) — coerce sigur + snapshot copt valid.
import { coerceToSitePublic, SITE_PUBLIC_SCHEMA } from '../src/types/sitePublic';
import { PUBLIC_THEME_DEFAULT } from '../src/config/publicTheme';
import { THEME_COLOR_KEYS } from '../src/theme/themes';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}

console.log('SITE PUBLIC — temă publică');

// Snapshot copt valid (toate cele 8 culori + schema).
check('snapshot: schema 1', PUBLIC_THEME_DEFAULT.schema === 1);
check('snapshot: accent = roșu banner', PUBLIC_THEME_DEFAULT.vars.accent === '#e02639');
check('snapshot: toate cele 8 culori prezente', THEME_COLOR_KEYS.every((k) => /^#[0-9a-fA-F]{6}$/.test(PUBLIC_THEME_DEFAULT.vars[k])));

// coerce: lipsă/corupt → snapshot copt (banner), nu aruncă.
check('coerce: null → snapshot copt', coerceToSitePublic(null).theme.vars.accent === PUBLIC_THEME_DEFAULT.vars.accent);
check('coerce: gunoi nu aruncă', (() => { coerceToSitePublic(42 as unknown); coerceToSitePublic('x' as unknown); return true; })());
check('coerce: schema mereu 1', coerceToSitePublic({}).schema === SITE_PUBLIC_SCHEMA);

// coerce: temă validă păstrată (culoare bună), invalidă → default-ul presetului.
check('coerce: accent valid păstrat', coerceToSitePublic({ theme: { vars: { accent: '#00ff88' } } }).theme.vars.accent === '#00ff88');
check('coerce: accent invalid → default preset', coerceToSitePublic({ theme: { vars: { accent: 'nu-e-hex' } } }).theme.vars.accent !== 'nu-e-hex');
check('coerce: bgImage non-https → gol (anti-injecție CSS)', coerceToSitePublic({ theme: { bgImage: 'http://x/y.png' } }).theme.bgImage === '');

console.log(`\nsite-public: ${failures ? failures + ' EȘUATE' : 'all checks passed'}`);
if (failures) process.exit(1);
