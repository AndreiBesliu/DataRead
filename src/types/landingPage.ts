/**
 * Landing Page (LP Studio) — landingPages/{slug}, schema 1. Operatorii construiesc în /admin pagini
 * publice de campanie: un document HTML self-contained (cod + <style> inline) + un design refolosit
 * din CustomTheme (src/theme/themes.ts), servit la /p/{slug} de o Cloud Function care loghează
 * traficul. ID-ul documentului = slug (unicitate prin construcție; servirea = get direct, rapid).
 * Coerce unic (CLAUDE.md): orice date corupte/legacy → defaults sigure, niciodată throw. Un status
 * corupt devine 'draft' — o pagină nu ajunge NICIODATĂ public din greșeală.
 */
import { coerceToCustomTheme, type CustomTheme } from '../theme/themes';
import { coerceBlocks, compileBlocks, compileConversion, type LpBlock } from './lpBlocks';
import { coerceToLpDecor, compileDecor, type LpDecor } from './lpDecor';
import { coerceKnownVariants } from './lpAttribution';

export const LP_EDITORS = ['code', 'visual'] as const;
export type LpEditorMode = (typeof LP_EDITORS)[number];

export const LANDING_PAGE_SCHEMA = 1;
export const LP_HTML_MAX = 200_000; // ~200 KB, mult sub limita Firestore de 1 MiB
export const LP_TITLE_MAX = 140;
export const LP_DESC_MAX = 320;
export const LP_SLUG_MAX = 60;
export const LP_FORM_FIELDS_MAX = 12;
export const LP_FIELD_OPTIONS_MAX = 20;
export const LP_VALUE_MAX = 2000;
export const LP_PAGE_DECORS_MAX = 5; // straturi de fundal decorativ suprapuse pe pagină

export const LP_STATUSES = ['draft', 'published'] as const;
export type LpStatus = (typeof LP_STATUSES)[number];

/** Tipul paginii: 'campaign' = LP de campanie (servit la /p/{slug}, design propriu); 'site' = pagină de
 *  site (CMS LP Studio, servită la /pagina/{slug}, temată cu tema publică). Default = campaign (legacy). */
export const LP_KINDS = ['campaign', 'site'] as const;
export type LpKind = (typeof LP_KINDS)[number];

export const LP_FIELD_TYPES = ['text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'radio', 'checkbox'] as const;
export type LpFieldType = (typeof LP_FIELD_TYPES)[number];

/** Numele câmpului-capcană (honeypot) anti-spam. Injectat ascuns off-screen în formular; orice valoare
 *  completată = bot. NU e un câmp configurat (sanitizeSubmissionValues îl ignoră oricum la stocare).
 *  Sursă unică TS↔JS (functions are propria const identică, comentată). */
export const LP_HP_FIELD = 'lp_hp_url';

export interface LpFormField {
  name: string; // [a-z0-9_], <= 40 — cheia sub care valoarea ajunge în submission
  label: string; // <= 80
  type: LpFieldType;
  required: boolean;
  options: string[]; // doar pentru 'select'
}

/** Nudge-uri de conversie la nivel de pagină (slice 3b). Compilate în `conversionHtml` (compileConversion)
 *  și injectate de serveLp — la fel ca pageDecorHtml. href stocat brut; validat (safeHref) la compilare. */
export interface LpStickyCta {
  enabled: boolean;
  text: string; // <= 80
  href: string; // <= LP_URL_MAX
}
export interface LpExitPopup {
  enabled: boolean;
  heading: string; // <= 120
  text: string; // <= 400
  ctaText: string; // <= 60
  ctaHref: string; // <= LP_URL_MAX
}
export interface LpConversion {
  stickyCta: LpStickyCta;
  exitPopup: LpExitPopup;
}

export interface LpFormConfig {
  enabled: boolean;
  fields: LpFormField[];
  submitLabel: string; // <= 40
  successMessage: string; // <= 300
  /** După trimitere, redirect către această pagină (https) — gol = rămâne pe LP cu mesajul de succes. */
  redirectUrl: string; // <= LP_URL_MAX, https-only
  createLead: boolean; // și creează un lead în pipeline la submit?
  notifyEmail: string; // <= 120 (opțional, notificare ops)
}

export interface LandingPage {
  schema: typeof LANDING_PAGE_SCHEMA;
  /** Campanie (/p/{slug}) sau pagină de site (/pagina/{slug}, temă publică). */
  kind: LpKind;
  slug: string; // = ID-ul documentului
  title: string;
  seoDescription: string;
  /** Imaginea de share (og:image / twitter:image) — URL https; gol = fără card cu imagine. */
  ogImage: string;
  /** Favicon-ul paginii — URL https; gol = fără. */
  favicon: string;
  status: LpStatus;
  lang: 'ro' | 'en'; // doar pentru <html lang> + limba de generare AI
  /** Modul de autorare: 'code' (textarea/AI) sau 'visual' (builder pe blocuri). */
  editor: LpEditorMode;
  /** Blocurile (mod visual) — se compilează în `html` la salvare; serveLp servește tot `html`. */
  blocks: LpBlock[];
  html: string; // pagina self-contained (cod, <= LP_HTML_MAX)
  design: CustomTheme; // refolosit din motorul de teme
  /** Straturi de decor de fundal pe toată pagina (suprapuse, în ordine) + markup-ul compilat al TUTUROR
   *  (concatenat, injectat de serveLp). Legacy `pageDecor` single → migrat la `[pageDecor]` de coerce. */
  pageDecors: LpDecor[];
  pageDecorHtml: string;
  hasForm: boolean; // oglindă a form.enabled (invariant)
  form: LpFormConfig;
  /** Nudge-uri de conversie (sticky CTA + exit popup) + markup-ul compilat (injectat de serveLp). */
  conversion: LpConversion;
  conversionHtml: string;
  /** Allowlist de variante de link cunoscute (scris de Link Builder) — serveLp atribuie trafic DOAR
   *  acestor chei (anti-bloat); restul → __other / __direct. */
  knownVariants: Record<string, true>;
  projectId: string; // organizare: referă lpProjects/{id} — '' dacă neîncadrat
  clientUid: string; // asociere opțională (portal client) — '' dacă nu
  leadId: string; // asociere opțională (pipeline) — '' dacă nu
  createdBy: string; // uid-ul operatorului
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
function bool(v: unknown): boolean {
  return v === true;
}

/** „Hello World!" / „Pagina Mea" → „hello-world" / „pagina-mea". Diacriticele → ASCII. */
export function sanitizeSlug(v: unknown): string {
  if (typeof v !== 'string') return '';
  const ascii = v.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, LP_SLUG_MAX)
    .replace(/-+$/, '');
}

function coerceField(v: unknown): LpFormField | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  const name =
    typeof d.name === 'string'
      ? d.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
      : '';
  if (!name) return null;
  // Numele honeypot e rezervat: un câmp real cu acest nume ar coincide cu capcana anti-spam și ar face ca
  // ORICE trimitere legitimă să fie tratată ca bot (fake-success, fără scriere) — pierdere silențioasă de lead-uri.
  if (name === LP_HP_FIELD) return null;
  const type = LP_FIELD_TYPES.includes(d.type as LpFieldType) ? (d.type as LpFieldType) : 'text';
  // 'select' și 'radio' au liste de opțiuni (același model); restul tipurilor → fără opțiuni.
  const options =
    (type === 'select' || type === 'radio') && Array.isArray(d.options)
      ? d.options.filter((o): o is string => typeof o === 'string').map((o) => o.slice(0, 60)).slice(0, LP_FIELD_OPTIONS_MAX)
      : [];
  return { name, label: str(d.label, 80), type, required: bool(d.required), options };
}

function coerceForm(v: unknown): LpFormConfig {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const fields = (Array.isArray(d.fields) ? d.fields : [])
    .map(coerceField)
    .filter((f): f is LpFormField => f !== null)
    .slice(0, LP_FORM_FIELDS_MAX);
  return {
    enabled: bool(d.enabled),
    fields,
    submitLabel: str(d.submitLabel, 40),
    successMessage: str(d.successMessage, 300),
    redirectUrl: coerceHttpsUrl(d.redirectUrl),
    createLead: bool(d.createLead),
    notifyEmail: str(d.notifyEmail, 120),
  };
}

export function emptyConversion(): LpConversion {
  return {
    stickyCta: { enabled: false, text: '', href: '' },
    exitPopup: { enabled: false, heading: '', text: '', ctaText: '', ctaHref: '' },
  };
}

/** Normaliser unic pentru nudge-urile de conversie. href-urile rămân brute (validate la compilare prin safeHref). */
export function coerceConversion(v: unknown): LpConversion {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const sc = (typeof d.stickyCta === 'object' && d.stickyCta !== null ? d.stickyCta : {}) as Record<string, unknown>;
  const ep = (typeof d.exitPopup === 'object' && d.exitPopup !== null ? d.exitPopup : {}) as Record<string, unknown>;
  return {
    stickyCta: { enabled: bool(sc.enabled), text: str(sc.text, 80), href: str(sc.href, LP_URL_MAX) },
    exitPopup: {
      enabled: bool(ep.enabled),
      heading: str(ep.heading, 120),
      text: str(ep.text, 400),
      ctaText: str(ep.ctaText, 60),
      ctaHref: str(ep.ctaHref, LP_URL_MAX),
    },
  };
}

export const LP_URL_MAX = 500;
const SAFE_HTTPS = /^https:\/\/[^\s"')]+$/i;
/** URL https sigur (og:image / favicon) sau '' — același criteriu ca SAFE_IMG_URL din themes + clamp.
 *  Port JS în serveLp (`LP_SAFE_IMG`) validează identic la servire (runtime-dual). */
function coerceHttpsUrl(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return SAFE_HTTPS.test(s) ? s.slice(0, LP_URL_MAX) : '';
}

export function emptyLandingPage(createdBy = ''): LandingPage {
  return {
    schema: LANDING_PAGE_SCHEMA,
    kind: 'campaign',
    slug: '',
    title: '',
    seoDescription: '',
    ogImage: '',
    favicon: '',
    status: 'draft',
    lang: 'ro',
    editor: 'code',
    blocks: [],
    html: '',
    design: coerceToCustomTheme(null),
    pageDecors: [],
    pageDecorHtml: '',
    hasForm: false,
    form: coerceForm({}),
    conversion: emptyConversion(),
    conversionHtml: '',
    knownVariants: {},
    projectId: '',
    clientUid: '',
    leadId: '',
    createdBy: str(createdBy, 128),
  };
}

/** Straturile de decor de pagină — normaliser unic. Acceptă forma nouă (`pageDecors` array) sau
 *  migrează forma legacy (`pageDecor` single, dacă effect ≠ 'none' → un strat). Plafon LP_PAGE_DECORS_MAX. */
function coercePageDecors(d: Record<string, unknown>): LpDecor[] {
  if (Array.isArray(d.pageDecors)) {
    return d.pageDecors.slice(0, LP_PAGE_DECORS_MAX).map((x) => coerceToLpDecor(x));
  }
  if (d.pageDecor != null) {
    const one = coerceToLpDecor(d.pageDecor);
    return one.effect !== 'none' ? [one] : [];
  }
  return [];
}

/** Compilează TOATE straturile de decor de pagină într-un singur markup (id unic per strat: pg0, pg1…).
 *  Straturile 'none' produc '' (compileDecor) → contribuie nimic. Sursă unică (recompile + preview). */
export function compilePageDecors(pageDecors: LpDecor[]): string {
  return pageDecors.map((d, i) => compileDecor(d, 'pg' + i, 'page')).join('');
}

/** Unicul punct de intrare pentru orice date care pretind a fi o Landing Page. */
export function coerceToLandingPage(data: unknown): LandingPage {
  if (typeof data !== 'object' || data === null) return emptyLandingPage();
  const d = data as Record<string, unknown>;
  const form = coerceForm(d.form);
  return {
    schema: LANDING_PAGE_SCHEMA,
    kind: LP_KINDS.includes(d.kind as LpKind) ? (d.kind as LpKind) : 'campaign',
    slug: sanitizeSlug(d.slug),
    title: str(d.title, LP_TITLE_MAX),
    seoDescription: str(d.seoDescription, LP_DESC_MAX),
    ogImage: coerceHttpsUrl(d.ogImage),
    favicon: coerceHttpsUrl(d.favicon),
    status: LP_STATUSES.includes(d.status as LpStatus) ? (d.status as LpStatus) : 'draft',
    lang: d.lang === 'en' ? 'en' : 'ro',
    editor: d.editor === 'visual' ? 'visual' : 'code',
    blocks: coerceBlocks(d.blocks),
    html: str(d.html, LP_HTML_MAX),
    design: coerceToCustomTheme(d.design),
    pageDecors: coercePageDecors(d),
    pageDecorHtml: str(d.pageDecorHtml, LP_HTML_MAX),
    hasForm: form.enabled, // invariant: hasForm === form.enabled
    form,
    conversion: coerceConversion(d.conversion),
    conversionHtml: str(d.conversionHtml, LP_HTML_MAX),
    knownVariants: coerceKnownVariants(d.knownVariants),
    projectId: str(d.projectId, 128),
    clientUid: str(d.clientUid, 128),
    leadId: str(d.leadId, 128),
    createdBy: str(d.createdBy, 128),
  };
}

/** Mărimea în OCTEȚI UTF-8 a unui string — aceeași semantică cu `String.size()` din regulile Firestore
 *  (care validează html.size() <= LP_HTML_MAX). `.length` (unități UTF-16) ar subestima conținutul cu
 *  diacritice/emoji, lăsând o pagină respinsă de reguli să treacă de gardă. Sursă unică pt. editor + recompilare. */
export function htmlByteSize(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Formularul efectiv: un bloc `form` forțează form.enabled — altfel s-ar livra public un formular fără
 *  handler (serveLp injectează submit-ul doar când hasForm). Sursă unică pt. editor + recompilare. */
export function effectiveLpForm(lp: LandingPage): LpFormConfig {
  const enabled = lp.form.enabled || lp.blocks.some((b) => b.type === 'form');
  return { ...lp.form, enabled };
}

/** Recompilează asset-urile SERVITE din modelul curent: `html` (blocuri compilate în mod vizual; html-ul
 *  brut în mod cod) + `pageDecorHtml` (decor pagină) + formular efectiv. Sursă unică pentru salvarea din
 *  editor ȘI pentru „recompilează toate" (paginile vechi prind logica nouă de compilare fără re-salvare). */
export function recompileLpAssets(lp: LandingPage): { html: string; pageDecorHtml: string; conversionHtml: string; form: LpFormConfig; hasForm: boolean } {
  const form = effectiveLpForm(lp);
  const html = lp.editor === 'visual' ? compileBlocks(lp.blocks, { form }) : lp.html;
  const pageDecorHtml = compilePageDecors(lp.pageDecors);
  const conversionHtml = compileConversion(lp.conversion);
  return { html, pageDecorHtml, conversionHtml, form, hasForm: form.enabled };
}

// ── Submissions (landingPages/{slug}/submissions/{id}) ──

export const LP_SUBMISSION_SCHEMA = 1;

export interface LpUtm {
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
}

export interface LpSubmission {
  schema: typeof LP_SUBMISSION_SCHEMA;
  values: Record<string, string>;
  status: 'new';
  utm: LpUtm;
  referrer: string;
  ua: string; // îmbogățit server-side
  geoCountry: string; // îmbogățit server-side
}

export function coerceToLpUtm(v: unknown): LpUtm {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  return {
    source: str(d.source, 200),
    medium: str(d.medium, 200),
    campaign: str(d.campaign, 200),
    term: str(d.term, 200),
    content: str(d.content, 200),
  };
}

export function coerceToLpSubmission(v: unknown): LpSubmission {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const rawValues = (typeof d.values === 'object' && d.values !== null ? d.values : {}) as Record<string, unknown>;
  const values: Record<string, string> = {};
  for (const [k, val] of Object.entries(rawValues)) {
    if (typeof val === 'string' && val) values[String(k).slice(0, 40)] = val.slice(0, LP_VALUE_MAX);
  }
  return {
    schema: LP_SUBMISSION_SCHEMA,
    values,
    status: 'new',
    utm: coerceToLpUtm(d.utm),
    referrer: str(d.referrer, 300),
    ua: str(d.ua, 300),
    geoCountry: str(d.geoCountry, 8),
  };
}

export interface SubmissionValidation {
  values: Record<string, string>; // doar câmpurile cunoscute, cu valoare, plafonate
  missingRequired: string[]; // câmpuri required fără valoare
}

/** Pur — folosit de functions/submitLpForm (validare server-side) și testat headless. Aruncă
 *  cheile necunoscute, plafonează lungimile, semnalează câmpurile required goale. */
export function sanitizeSubmissionValues(raw: unknown, fields: LpFormField[]): SubmissionValidation {
  const src = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const values: Record<string, string> = {};
  const missingRequired: string[] = [];
  for (const f of fields.slice(0, LP_FORM_FIELDS_MAX)) {
    const v = src[f.name];
    const val = typeof v === 'string' ? v.trim().slice(0, LP_VALUE_MAX) : '';
    if (val) values[f.name] = val;
    if (f.required && !val) missingRequired.push(f.name);
  }
  return { values, missingRequired };
}
