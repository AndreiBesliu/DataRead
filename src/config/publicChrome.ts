/**
 * Snapshot COMMIT-UIT al chrome-ului public (header/footer + meniu) — sursa SINCRONĂ la render + prerender,
 * ca paginile să apară cu header/footer FĂRĂ flash / fără hydration drift. La runtime, SiteLayout suprascrie
 * din `siteConfig/publicChrome` (Firestore); serveLp (kind:'site') îl citește la servire. Se re-coace la deploy
 * (scripts/pull-public-chrome.mjs). Init = chrome-ul actual al site-ului → zero schimbare vizuală până la prima publicare.
 */
import type { SiteChrome } from '../types/siteChrome';

export const PUBLIC_CHROME_DEFAULT: SiteChrome = {
  schema: 1,
  brandName: 'DataRead',
  taglineRo: 'Date. Strategie. Creștere.',
  taglineEn: 'Data. Strategy. Growth.',
  nav: [
    { labelRo: 'Pachete', labelEn: 'Packages', href: '/pachete' },
    { labelRo: 'Self Marketing', labelEn: 'Self Marketing', href: '/self-marketing' },
    { labelRo: 'Contact', labelEn: 'Contact', href: '/contact' },
  ],
  ctaLabelRo: 'Începe acum',
  ctaLabelEn: 'Get started',
  ctaHref: '/start',
  footerTextRo: '© DataRead. Toate drepturile rezervate.',
  footerTextEn: '© DataRead. All rights reserved.',
  footerLinks: [
    { labelRo: 'Termeni și condiții', labelEn: 'Terms and conditions', href: '/legal/termeni' },
    { labelRo: 'Confidențialitate', labelEn: 'Privacy', href: '/legal/confidentialitate' },
    { labelRo: 'Cont client', labelEn: 'Client login', href: '/app' },
  ],
};
