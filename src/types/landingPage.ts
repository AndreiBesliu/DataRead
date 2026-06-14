/**
 * Landing Page (LP Studio) — landingPages/{slug}, schema 1. Operatorii construiesc în /admin pagini
 * publice de campanie: un document HTML self-contained (cod + <style> inline) + un design refolosit
 * din CustomTheme (src/theme/themes.ts), servit la /p/{slug} de o Cloud Function care loghează
 * traficul. ID-ul documentului = slug (unicitate prin construcție; servirea = get direct, rapid).
 * Coerce unic (CLAUDE.md): orice date corupte/legacy → defaults sigure, niciodată throw. Un status
 * corupt devine 'draft' — o pagină nu ajunge NICIODATĂ public din greșeală.
 */
import { coerceToCustomTheme, type CustomTheme } from '../theme/themes';
import { coerceBlocks, type LpBlock } from './lpBlocks';
import { coerceToLpDecor, type LpDecor } from './lpDecor';

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

export const LP_STATUSES = ['draft', 'published'] as const;
export type LpStatus = (typeof LP_STATUSES)[number];

export const LP_FIELD_TYPES = ['text', 'email', 'tel', 'textarea', 'select', 'checkbox'] as const;
export type LpFieldType = (typeof LP_FIELD_TYPES)[number];

export interface LpFormField {
  name: string; // [a-z0-9_], <= 40 — cheia sub care valoarea ajunge în submission
  label: string; // <= 80
  type: LpFieldType;
  required: boolean;
  options: string[]; // doar pentru 'select'
}

export interface LpFormConfig {
  enabled: boolean;
  fields: LpFormField[];
  submitLabel: string; // <= 40
  successMessage: string; // <= 300
  createLead: boolean; // și creează un lead în pipeline la submit?
  notifyEmail: string; // <= 120 (opțional, notificare ops)
}

export interface LandingPage {
  schema: typeof LANDING_PAGE_SCHEMA;
  slug: string; // = ID-ul documentului
  title: string;
  seoDescription: string;
  status: LpStatus;
  lang: 'ro' | 'en'; // doar pentru <html lang> + limba de generare AI
  /** Modul de autorare: 'code' (textarea/AI) sau 'visual' (builder pe blocuri). */
  editor: LpEditorMode;
  /** Blocurile (mod visual) — se compilează în `html` la salvare; serveLp servește tot `html`. */
  blocks: LpBlock[];
  html: string; // pagina self-contained (cod, <= LP_HTML_MAX)
  design: CustomTheme; // refolosit din motorul de teme
  /** Decor de fundal pe toată pagina (config) + markup-ul compilat (injectat de serveLp). */
  pageDecor: LpDecor;
  pageDecorHtml: string;
  hasForm: boolean; // oglindă a form.enabled (invariant)
  form: LpFormConfig;
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
  const type = LP_FIELD_TYPES.includes(d.type as LpFieldType) ? (d.type as LpFieldType) : 'text';
  const options =
    type === 'select' && Array.isArray(d.options)
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
    createLead: bool(d.createLead),
    notifyEmail: str(d.notifyEmail, 120),
  };
}

export function emptyLandingPage(createdBy = ''): LandingPage {
  return {
    schema: LANDING_PAGE_SCHEMA,
    slug: '',
    title: '',
    seoDescription: '',
    status: 'draft',
    lang: 'ro',
    editor: 'code',
    blocks: [],
    html: '',
    design: coerceToCustomTheme(null),
    pageDecor: coerceToLpDecor(null),
    pageDecorHtml: '',
    hasForm: false,
    form: coerceForm({}),
    clientUid: '',
    leadId: '',
    createdBy: str(createdBy, 128),
  };
}

/** Unicul punct de intrare pentru orice date care pretind a fi o Landing Page. */
export function coerceToLandingPage(data: unknown): LandingPage {
  if (typeof data !== 'object' || data === null) return emptyLandingPage();
  const d = data as Record<string, unknown>;
  const form = coerceForm(d.form);
  return {
    schema: LANDING_PAGE_SCHEMA,
    slug: sanitizeSlug(d.slug),
    title: str(d.title, LP_TITLE_MAX),
    seoDescription: str(d.seoDescription, LP_DESC_MAX),
    status: LP_STATUSES.includes(d.status as LpStatus) ? (d.status as LpStatus) : 'draft',
    lang: d.lang === 'en' ? 'en' : 'ro',
    editor: d.editor === 'visual' ? 'visual' : 'code',
    blocks: coerceBlocks(d.blocks),
    html: str(d.html, LP_HTML_MAX),
    design: coerceToCustomTheme(d.design),
    pageDecor: coerceToLpDecor(d.pageDecor),
    pageDecorHtml: str(d.pageDecorHtml, LP_HTML_MAX),
    hasForm: form.enabled, // invariant: hasForm === form.enabled
    form,
    clientUid: str(d.clientUid, 128),
    leadId: str(d.leadId, 128),
    createdBy: str(d.createdBy, 128),
  };
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
