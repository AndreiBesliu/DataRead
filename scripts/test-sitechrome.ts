// Suite headless: chrome-ul global al site-ului (siteConfig/publicChrome) — coerce sigur (href intern,
// plafoane, default la corupt), chromeLabel (EN→RO), internalHref (anti open-redirect) + snapshot copt valid.
import {
  coerceToSiteChrome, internalHref, chromeLabel, CHROME_ITEMS_MAX, SITE_CHROME_SCHEMA, type ChromeItem,
} from '../src/types/siteChrome';
import { PUBLIC_CHROME_DEFAULT } from '../src/config/publicChrome';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}

console.log('SITE CHROME — header/footer global');

// Snapshot copt valid.
check('snapshot: schema 1', PUBLIC_CHROME_DEFAULT.schema === SITE_CHROME_SCHEMA);
check('snapshot: brand DataRead', PUBLIC_CHROME_DEFAULT.brandName === 'DataRead');
check('snapshot: nav are 4 linkuri interne', PUBLIC_CHROME_DEFAULT.nav.length === 4 && PUBLIC_CHROME_DEFAULT.nav.every((n) => n.href.startsWith('/')));
check('snapshot: CTA spre /start', PUBLIC_CHROME_DEFAULT.ctaHref === '/start');
check('snapshot: footer are linkuri', PUBLIC_CHROME_DEFAULT.footerLinks.length >= 1);

// internalHref — anti open-redirect / javascript:.
check('internalHref: „/" valid', internalHref('/') === '/');
check('internalHref: „/pachete" valid', internalHref('/pachete') === '/pachete');
check('internalHref: protocol-relative „//evil" → #', internalHref('//evil.com') === '#');
check('internalHref: „https://evil" → #', internalHref('https://evil.com') === '#');
check('internalHref: „javascript:alert(1)" → #', internalHref('javascript:alert(1)') === '#');
check('internalHref: relativ „pachete" (fără /) → #', internalHref('pachete') === '#');
check('internalHref: gol → #', internalHref('') === '#');
check('internalHref: non-string → #', internalHref(42 as unknown) === '#');
check('internalHref: prea lung (>200) → #', internalHref('/' + 'a'.repeat(250)) === '#');

// chromeLabel — EN cade pe RO.
const it: ChromeItem = { labelRo: 'Pachete', labelEn: 'Packages', href: '/pachete' };
check('chromeLabel: ro', chromeLabel(it, 'ro') === 'Pachete');
check('chromeLabel: en', chromeLabel(it, 'en') === 'Packages');
check('chromeLabel: en gol → ro', chromeLabel({ labelRo: 'Doar RO', labelEn: '', href: '/x' }, 'en') === 'Doar RO');

// coerce: null/gunoi → snapshot copt; nu aruncă.
check('coerce: null → default', coerceToSiteChrome(null).chrome.brandName === PUBLIC_CHROME_DEFAULT.brandName);
check('coerce: gunoi nu aruncă', (() => { coerceToSiteChrome(42 as unknown); coerceToSiteChrome('x' as unknown); return true; })());
check('coerce: fără cheia chrome → default', coerceToSiteChrome({ foo: 1 }).chrome.nav.length === PUBLIC_CHROME_DEFAULT.nav.length);
check('coerce: schema mereu 1', coerceToSiteChrome({ chrome: {} }).schema === SITE_CHROME_SCHEMA);

// coerce: chrome prezent dar parțial — brand gol → default; câmpuri necunoscute ignorate.
{
  const c = coerceToSiteChrome({ chrome: { brandName: '', nav: [], ctaHref: '' } }).chrome;
  check('coerce: brand gol → default brand', c.brandName === PUBLIC_CHROME_DEFAULT.brandName);
  check('coerce: nav gol păstrat (listă goală)', c.nav.length === 0);
  check('coerce: ctaHref gol păstrat gol', c.ctaHref === '');
}

// coerce: href extern în item → #; item fără nicio etichetă eliminat; plafon ≤ CHROME_ITEMS_MAX.
{
  const c = coerceToSiteChrome({ chrome: {
    brandName: 'X',
    nav: [
      { labelRo: 'Bun', labelEn: '', href: '/ok' },
      { labelRo: 'Rău', labelEn: '', href: 'https://evil.com' },
      { labelRo: '', labelEn: '', href: '/fara-eticheta' }, // eliminat
    ],
  } }).chrome;
  check('coerce: item cu href extern → href „#"', c.nav.find((n) => n.labelRo === 'Rău')?.href === '#');
  check('coerce: item fără etichetă eliminat', c.nav.length === 2);
}
{
  const many = Array.from({ length: 30 }, (_, i) => ({ labelRo: 'L' + i, labelEn: '', href: '/x' + i }));
  const c = coerceToSiteChrome({ chrome: { brandName: 'X', nav: many, footerLinks: many } }).chrome;
  check('coerce: nav plafonat la CHROME_ITEMS_MAX', c.nav.length === CHROME_ITEMS_MAX);
  check('coerce: footerLinks plafonat la CHROME_ITEMS_MAX', c.footerLinks.length === CHROME_ITEMS_MAX);
}

// coerce: etichete prea lungi capate la 60; text footer la 200; brand la 40.
{
  const c = coerceToSiteChrome({ chrome: {
    brandName: 'B'.repeat(100),
    footerTextRo: 'F'.repeat(500),
    nav: [{ labelRo: 'L'.repeat(100), labelEn: '', href: '/x' }],
  } }).chrome;
  check('coerce: brand capat la 40', c.brandName.length === 40);
  check('coerce: footerTextRo capat la 200', c.footerTextRo.length === 200);
  check('coerce: label capat la 60', c.nav[0].labelRo.length === 60);
}

console.log(`\nsite-chrome: ${failures ? failures + ' EȘUATE' : 'all checks passed'}`);
if (failures) process.exit(1);
