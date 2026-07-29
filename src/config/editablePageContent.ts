/**
 * REGISTRUL cheilor i18n editabile din /admin (Felia B) — sursa unică pentru „ce text poate schimba
 * operatorul, pe ce pagină". Registrul e AUTORITATEA: un override rămas în `siteConfig/pageContent`
 * pentru o cheie care nu mai e aici NU se mai aplică (vezi `pickKnownKeys`).
 *
 * Criteriu de includere: text pur de marketing/pagină. NU intră aici — și nu trebuie adăugate —
 * mesajele de eroare/stare, etichetele de formular legate de schemă, sau orice text din care
 * derivă logică (prețuri, priceId-uri Stripe, id-uri de serviciu, obiective). Acelea rămân în cod.
 *
 * Date pure (fără React/Firebase). Grupurile dau doar structura editorului.
 */
import type { PageKey } from '../types/pageThemes';
import { PACKAGES, UPSELLS } from './packages';
import { SERVICE_IDS } from './services';

export interface EditableKey {
  /** Cheia i18n exactă (aceeași pe care o cere `t()`). */
  key: string;
  /** Text lung → textarea în editor. */
  multiline?: boolean;
}

export interface EditableGroup {
  /** Cheia i18n a titlului de grup (`admin.site.content.g_*`). */
  titleKey: string;
  keys: EditableKey[];
}

const seo = (titleK: string, descK: string): EditableGroup => ({
  titleKey: 'admin.site.content.g_seo',
  keys: [{ key: titleK }, { key: descK, multiline: true }],
});

/** Paginile cu conținut editabil. `app` (portalul autentificat) lipsește deliberat — nu e pagină de marketing. */
export const EDITABLE_CONTENT: Partial<Record<PageKey, EditableGroup[]>> = {
  home: [
    seo('seo.homeTitle', 'seo.homeDescription'),
    {
      titleKey: 'admin.site.content.g_hero',
      keys: [
        { key: 'landing.heroLine1' },
        { key: 'landing.heroLine2' },
        { key: 'landing.heroLine3' },
        { key: 'landing.heroSubtitle', multiline: true },
        { key: 'landing.heroCta' },
        { key: 'landing.heroSecondary' },
        { key: 'landing.heroSelf', multiline: true },
      ],
    },
    {
      titleKey: 'admin.site.content.g_trust',
      keys: [{ key: 'landing.trust1' }, { key: 'landing.trust2' }, { key: 'landing.trust3' }, { key: 'landing.trust4' }],
    },
    {
      titleKey: 'admin.site.content.g_what',
      keys: [
        { key: 'landing.whatTitle' },
        { key: 'landing.what1Title' }, { key: 'landing.what1Body', multiline: true },
        { key: 'landing.what2Title' }, { key: 'landing.what2Body', multiline: true },
        { key: 'landing.what3Title' }, { key: 'landing.what3Body', multiline: true },
        { key: 'landing.what4Title' }, { key: 'landing.what4Body', multiline: true },
      ],
    },
    {
      titleKey: 'admin.site.content.g_how',
      keys: [
        { key: 'landing.howTitle' },
        { key: 'landing.how1Title' }, { key: 'landing.how1Body', multiline: true },
        { key: 'landing.how2Title' }, { key: 'landing.how2Body', multiline: true },
        { key: 'landing.how3Title' }, { key: 'landing.how3Body', multiline: true },
      ],
    },
    {
      titleKey: 'admin.site.content.g_cta',
      keys: [{ key: 'landing.ctaTitle' }, { key: 'landing.ctaBody', multiline: true }, { key: 'landing.ctaButton' }],
    },
  ],

  pachete: [
    seo('seo.packagesTitle', 'seo.packagesDescription'),
    {
      titleKey: 'admin.site.content.g_head',
      keys: [{ key: 'pachete.title' }, { key: 'pachete.subtitle', multiline: true }],
    },
    // Numele/beneficiile pachetelor se DERIVĂ din `config/packages.ts` (sursa unică): un bullet nou
    // acolo devine automat editabil aici, fără să atingem registrul. Prețul și `priceId` rămân în cod.
    {
      titleKey: 'admin.site.content.g_names',
      keys: PACKAGES.flatMap((p) => [{ key: p.nameKey }, { key: p.taglineKey, multiline: true }]),
    },
    {
      titleKey: 'admin.site.content.g_features',
      keys: PACKAGES.flatMap((p) => p.featureKeys.map((k) => ({ key: k }))),
    },
    {
      titleKey: 'admin.site.content.g_excludes',
      keys: PACKAGES.flatMap((p) => p.excludedKeys.map((k) => ({ key: k }))),
    },
    {
      titleKey: 'admin.site.content.g_labels',
      keys: [
        { key: 'pachete.perMonth' },
        { key: 'pachete.choose' },
        { key: 'pachete.includes' },
        { key: 'pachete.excludes' },
        { key: 'pachete.everythingIn' },
        { key: 'pachete.highlight' },
      ],
    },
    {
      titleKey: 'admin.site.content.g_upsell',
      keys: [
        { key: 'pachete.upsellsTitle' },
        { key: 'pachete.upsellsSubtitle', multiline: true },
        ...UPSELLS.flatMap((u) => [{ key: u.nameKey }, { key: u.descriptionKey, multiline: true }]),
      ],
    },
  ],

  servicii: [
    seo('seo.servicesTitle', 'seo.servicesDescription'),
    {
      titleKey: 'admin.site.content.g_hero',
      keys: [
        { key: 'services.kicker' },
        { key: 'services.heroTitle' },
        { key: 'services.heroBody', multiline: true },
        { key: 'services.pill1' }, { key: 'services.pill2' }, { key: 'services.pill3' }, { key: 'services.pill4' },
      ],
    },
    {
      titleKey: 'admin.site.content.g_labels',
      keys: [{ key: 'services.ctaLead' }, { key: 'services.ctaTry' }, { key: 'services.liveBadge' }, { key: 'services.detail.more' }],
    },
    // Catalogul de servicii — derivat din `SERVICE_IDS`. Doar numele + sloganul din listă; textele
    // paginilor de detaliu (/servicii/:id: intro/problemă/FAQ) sunt o felie separată.
    {
      titleKey: 'admin.site.content.g_catalog',
      keys: SERVICE_IDS.flatMap((id) => [
        { key: `services.${id}.name` },
        { key: `services.${id}.tagline`, multiline: true },
      ]),
    },
    {
      titleKey: 'admin.site.content.g_cta',
      keys: [{ key: 'services.finalTitle' }, { key: 'services.finalBody', multiline: true }, { key: 'services.finalCta' }],
    },
  ],

  self: [
    seo('seo.selfMarketingTitle', 'seo.selfMarketingDescription'),
    {
      titleKey: 'admin.site.content.g_hero',
      keys: [
        { key: 'selfMarketing.kicker' },
        { key: 'selfMarketing.heroTitle' },
        { key: 'selfMarketing.heroBody', multiline: true },
        { key: 'selfMarketing.cta' },
        { key: 'selfMarketing.ctaPackages' },
        { key: 'selfMarketing.trialNote', multiline: true },
      ],
    },
    {
      titleKey: 'admin.site.content.g_steps',
      keys: [
        { key: 'selfMarketing.howTitle' },
        { key: 'selfMarketing.step_profile' }, { key: 'selfMarketing.stepBody_profile', multiline: true },
        { key: 'selfMarketing.step_opportunities' }, { key: 'selfMarketing.stepBody_opportunities', multiline: true },
        { key: 'selfMarketing.step_strategy' }, { key: 'selfMarketing.stepBody_strategy', multiline: true },
        { key: 'selfMarketing.step_details' }, { key: 'selfMarketing.stepBody_details', multiline: true },
        { key: 'selfMarketing.step_execution' }, { key: 'selfMarketing.stepBody_execution', multiline: true },
      ],
    },
    {
      titleKey: 'admin.site.content.g_why',
      keys: [
        { key: 'selfMarketing.whyTitle' },
        { key: 'selfMarketing.benefit_angles' }, { key: 'selfMarketing.benefitBody_angles', multiline: true },
        { key: 'selfMarketing.benefit_data' }, { key: 'selfMarketing.benefitBody_data', multiline: true },
        { key: 'selfMarketing.benefit_fast' }, { key: 'selfMarketing.benefitBody_fast', multiline: true },
        { key: 'selfMarketing.benefit_free' }, { key: 'selfMarketing.benefitBody_free', multiline: true },
      ],
    },
    {
      titleKey: 'admin.site.content.g_cta',
      keys: [{ key: 'selfMarketing.finalTitle' }, { key: 'selfMarketing.finalBody', multiline: true }],
    },
  ],

  start: [
    seo('seo.startTitle', 'seo.startDescription'),
    {
      titleKey: 'admin.site.content.g_page',
      keys: [
        { key: 'start.title' },
        { key: 'start.intro', multiline: true },
        { key: 'start.serviceInterest' },
        { key: 'start.submit' },
        { key: 'start.submitted' },
        { key: 'start.submittedBody', multiline: true },
        { key: 'start.submitAnother' },
      ],
    },
  ],

  contact: [
    seo('seo.contactTitle', 'seo.contactDescription'),
    {
      titleKey: 'admin.site.content.g_page',
      keys: [
        { key: 'contact.title' },
        { key: 'contact.body', multiline: true },
        { key: 'contact.emailLabel' },
        { key: 'contact.ctaStart' },
        { key: 'contact.ctaPackages' },
      ],
    },
  ],

  termeni: [
    seo('seo.termsTitle', 'seo.termsDescription'),
    {
      titleKey: 'admin.site.content.g_page',
      keys: [
        { key: 'legal.termsTitle' },
        { key: 'legal.termsBody', multiline: true },
        { key: 'legal.draftBanner', multiline: true },
      ],
    },
  ],

  confid: [
    seo('seo.privacyTitle', 'seo.privacyDescription'),
    {
      titleKey: 'admin.site.content.g_page',
      keys: [
        { key: 'legal.privacyTitle' },
        { key: 'legal.privacyBody', multiline: true },
        { key: 'legal.draftBanner', multiline: true },
      ],
    },
  ],
};

/** Paginile care AU conținut editabil, în ordinea din registru. */
export const CONTENT_PAGE_KEYS = Object.keys(EDITABLE_CONTENT) as PageKey[];

/** Cheile editabile ale unei pagini (plate, în ordinea grupurilor). */
export function editableKeysForPage(page: PageKey): string[] {
  return (EDITABLE_CONTENT[page] || []).flatMap((g) => g.keys.map((k) => k.key));
}

/** REUNIUNEA tuturor cheilor editabile, deduplicate (`legal.draftBanner` apare pe două pagini).
 *  Asta e allowlist-ul aplicat la runtime — nimic din afara lui nu poate suprascrie un text. */
export const ALL_EDITABLE_KEYS: string[] = Array.from(
  new Set(CONTENT_PAGE_KEYS.flatMap((p) => editableKeysForPage(p)))
);
