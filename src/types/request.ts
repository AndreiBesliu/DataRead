/**
 * Cererea de marketing (Verticala 1) — leads/{leadId}/requests/{reqId}, schema 2.
 * Două TIPURI de cereri (spec Ionuţ 5.1–5.6):
 *   'campaign' — campanie de reclame: variante de ad (structurate) / scripturi video / structură Meta (proză)
 *   'content'  — plan de conținut 30 de zile: calendar (zile structurate) / postări / idei
 *
 * Felia 5a: livrabilele-listă au devenit SCHEME TIPATE (array-uri de obiecte) — editare granulară +
 * pregătire pentru A/B pe variantă și publicare. Proza rămâne proză (campaignStructure, notes).
 * Coerce: corupt / format vechi (string) → liste goale, fără throw (clean break, fără migrare).
 */
import { OBJECTIVES, type Objective } from './onboarding';

export const REQUEST_SCHEMA = 2;

export const REQUEST_KINDS = ['campaign', 'content'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_STATUSES = ['open', 'done'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

// Stadiul de conștientizare al publicului (vocabularul din buildCampaignPrompt).
export const AWARENESS_STAGES = ['rece', 'cald', 'fierbinte'] as const;
export type AwarenessStage = (typeof AWARENESS_STAGES)[number];

// Formate de conținut pe calendar.
export const CONTENT_FORMATS = ['poza', 'reel', 'carusel', 'text', 'story', 'video'] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export interface AdVariant {
  hook: string;
  body: string;
  cta: string;
  angle: string;
  stage: AwarenessStage;
}
export interface VideoScript {
  concept: string;
  script: string;
}
export interface CalendarDay {
  day: string;
  theme: string;
  format: ContentFormat | '';
  channel: string;
}
export interface ContentPost {
  text: string;
  hashtags: string;
  visual: string;
}

export interface RequestDeliverables {
  /** [campaign] Variante de reclame Meta (structurate). */
  adVariants: AdVariant[];
  /** [campaign] Scripturi video / creatives. */
  videoScripts: VideoScript[];
  /** [campaign] Structura campaniei Meta (proză). */
  campaignStructure: string;
  /** [content] Calendarul de conținut pe 30 de zile (zile structurate). */
  calendar: CalendarDay[];
  /** [content] Postări complete, gata de publicat. */
  posts: ContentPost[];
  /** [content] Idei de conținut suplimentare. */
  ideas: string[];
  /** Note interne libere (ambele tipuri) — NU se oglindesc la client. */
  notes: string;
}

// Plafoane (sursă unică). Liste = nr. maxim de itemi; sub-câmpuri = lungime max.
export const DELIVERABLE_LIST_MAX = { adVariants: 8, videoScripts: 6, calendar: 31, posts: 12, ideas: 20 } as const;
export const AD_VARIANT_LIMITS = { hook: 200, body: 1500, cta: 120, angle: 140 } as const;
export const VIDEO_SCRIPT_LIMITS = { concept: 140, script: 2000 } as const;
export const CALENDAR_DAY_LIMITS = { day: 40, theme: 200, channel: 60 } as const;
export const CONTENT_POST_LIMITS = { text: 1500, hashtags: 300, visual: 300 } as const;
export const IDEA_MAX = 200;
export const NOTES_MAX = 8000;
export const PROSE_MAX = 8000; // campaignStructure

// ── Descriptori de câmp (metadata data-driven pt. editor + afișare + export) ──
export type DeliverableSubField = {
  key: string;
  labelKey: string;
  long?: boolean; // textarea vs input
  enum?: readonly string[];
  enumLabelPrefix?: string; // ex. 'admin.reqStage_' → t('admin.reqStage_rece')
};
export type DeliverableField =
  | { key: keyof RequestDeliverables; labelKey: string; type: 'prose' }
  | { key: keyof RequestDeliverables; labelKey: string; type: 'strlist' }
  | { key: keyof RequestDeliverables; labelKey: string; type: 'objlist'; itemFields: DeliverableSubField[] };

const CAMPAIGN_FIELDS: DeliverableField[] = [
  {
    key: 'adVariants', labelKey: 'admin.reqAdTexts', type: 'objlist', itemFields: [
      { key: 'hook', labelKey: 'admin.reqAvHook' },
      { key: 'body', labelKey: 'admin.reqAvBody', long: true },
      { key: 'cta', labelKey: 'admin.reqAvCta' },
      { key: 'angle', labelKey: 'admin.reqAvAngle' },
      { key: 'stage', labelKey: 'admin.reqAvStage', enum: AWARENESS_STAGES, enumLabelPrefix: 'admin.reqStage_' },
    ],
  },
  {
    key: 'videoScripts', labelKey: 'admin.reqVideoScripts', type: 'objlist', itemFields: [
      { key: 'concept', labelKey: 'admin.reqVsConcept' },
      { key: 'script', labelKey: 'admin.reqVsScript', long: true },
    ],
  },
  { key: 'campaignStructure', labelKey: 'admin.reqCampaignStructure', type: 'prose' },
  { key: 'notes', labelKey: 'admin.reqNotes', type: 'prose' },
];

const CONTENT_FIELDS: DeliverableField[] = [
  {
    key: 'calendar', labelKey: 'admin.reqCalendar', type: 'objlist', itemFields: [
      { key: 'day', labelKey: 'admin.reqCalDay' },
      { key: 'theme', labelKey: 'admin.reqCalTheme', long: true },
      { key: 'format', labelKey: 'admin.reqCalFormat', enum: CONTENT_FORMATS, enumLabelPrefix: 'admin.reqFormat_' },
      { key: 'channel', labelKey: 'admin.reqCalChannel' },
    ],
  },
  {
    key: 'posts', labelKey: 'admin.reqPosts', type: 'objlist', itemFields: [
      { key: 'text', labelKey: 'admin.reqPostText', long: true },
      { key: 'hashtags', labelKey: 'admin.reqPostHashtags' },
      { key: 'visual', labelKey: 'admin.reqPostVisual' },
    ],
  },
  { key: 'ideas', labelKey: 'admin.reqIdeas', type: 'strlist' },
  { key: 'notes', labelKey: 'admin.reqNotes', type: 'prose' },
];

/** Câmpurile de livrabile (cu metadata) pentru un tip de cerere. */
export function deliverableFieldsFor(kind: RequestKind): DeliverableField[] {
  return kind === 'content' ? CONTENT_FIELDS : CAMPAIGN_FIELDS;
}

export interface MarketingRequest {
  schema: typeof REQUEST_SCHEMA;
  kind: RequestKind;
  title: string;
  /** Oferta / produsul promovat (campaign) sau focusul lunii (content). */
  offer: string;
  /** Bugetul campaniei — text liber în v1 (ex. „500 € / lună"). */
  budget: string;
  objective: Objective | '';
  status: RequestStatus;
  /** Cine a produs livrabilele — 'ai' după o generare. */
  source: 'manual' | 'ai';
  deliverables: RequestDeliverables;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function coerceAdVariant(v: unknown): AdVariant {
  const x = obj(v);
  return {
    hook: str(x.hook, AD_VARIANT_LIMITS.hook),
    body: str(x.body, AD_VARIANT_LIMITS.body),
    cta: str(x.cta, AD_VARIANT_LIMITS.cta),
    angle: str(x.angle, AD_VARIANT_LIMITS.angle),
    stage: AWARENESS_STAGES.includes(x.stage as AwarenessStage) ? (x.stage as AwarenessStage) : 'rece',
  };
}
function coerceVideoScript(v: unknown): VideoScript {
  const x = obj(v);
  return { concept: str(x.concept, VIDEO_SCRIPT_LIMITS.concept), script: str(x.script, VIDEO_SCRIPT_LIMITS.script) };
}
function coerceCalendarDay(v: unknown): CalendarDay {
  const x = obj(v);
  return {
    day: str(x.day, CALENDAR_DAY_LIMITS.day),
    theme: str(x.theme, CALENDAR_DAY_LIMITS.theme),
    format: CONTENT_FORMATS.includes(x.format as ContentFormat) ? (x.format as ContentFormat) : '',
    channel: str(x.channel, CALENDAR_DAY_LIMITS.channel),
  };
}
function coerceContentPost(v: unknown): ContentPost {
  const x = obj(v);
  return {
    text: str(x.text, CONTENT_POST_LIMITS.text),
    hashtags: str(x.hashtags, CONTENT_POST_LIMITS.hashtags),
    visual: str(x.visual, CONTENT_POST_LIMITS.visual),
  };
}

export function emptyDeliverables(): RequestDeliverables {
  return { adVariants: [], videoScripts: [], campaignStructure: '', calendar: [], posts: [], ideas: [], notes: '' };
}

export function emptyRequest(): MarketingRequest {
  return {
    schema: REQUEST_SCHEMA,
    kind: 'campaign',
    title: '',
    offer: '',
    budget: '',
    objective: '',
    status: 'open',
    source: 'manual',
    deliverables: emptyDeliverables(),
  };
}

/** Normaliser unic pt. orice date care pretind a fi livrabile (array-uri tipate; vechiul string → liste goale). */
export function coerceToDeliverables(raw: unknown): RequestDeliverables {
  const del = obj(raw);
  return {
    adVariants: arr(del.adVariants).slice(0, DELIVERABLE_LIST_MAX.adVariants).map(coerceAdVariant),
    videoScripts: arr(del.videoScripts).slice(0, DELIVERABLE_LIST_MAX.videoScripts).map(coerceVideoScript),
    campaignStructure: str(del.campaignStructure, PROSE_MAX),
    calendar: arr(del.calendar).slice(0, DELIVERABLE_LIST_MAX.calendar).map(coerceCalendarDay),
    posts: arr(del.posts).slice(0, DELIVERABLE_LIST_MAX.posts).map(coerceContentPost),
    ideas: arr(del.ideas).filter((i) => typeof i === 'string' && i.trim()).slice(0, DELIVERABLE_LIST_MAX.ideas).map((i) => (i as string).slice(0, IDEA_MAX)),
    notes: str(del.notes, NOTES_MAX),
  };
}

/** Unicul punct de intrare pentru orice date care pretind a fi o cerere de marketing.
 *  Cererile vechi (fără kind) devin 'campaign'; livrabile vechi (string) → liste goale. */
export function coerceToMarketingRequest(data: unknown): MarketingRequest {
  if (typeof data !== 'object' || data === null) return emptyRequest();
  const d = data as Record<string, unknown>;
  return {
    schema: REQUEST_SCHEMA,
    kind: REQUEST_KINDS.includes(d.kind as RequestKind) ? (d.kind as RequestKind) : 'campaign',
    title: str(d.title, 120),
    offer: str(d.offer, 500),
    budget: str(d.budget, 80),
    objective: OBJECTIVES.includes(d.objective as Objective) ? (d.objective as Objective) : '',
    status: REQUEST_STATUSES.includes(d.status as RequestStatus) ? (d.status as RequestStatus) : 'open',
    source: d.source === 'ai' ? 'ai' : 'manual',
    deliverables: coerceToDeliverables(d.deliverables),
  };
}

/** True dacă livrabilele au vreun conținut (orice listă ne-goală sau proză ne-goală). */
export function hasDeliverableContent(del: RequestDeliverables): boolean {
  return (
    del.adVariants.length > 0 || del.videoScripts.length > 0 || del.calendar.length > 0 ||
    del.posts.length > 0 || del.ideas.length > 0 ||
    !!del.campaignStructure.trim() || !!del.notes.trim()
  );
}

// ── Flatten livrabile → secțiuni {label, body} pt. copy / PDF (reutilizat în admin ȘI portal). ──
function subFieldValue(t: (k: string) => string, sf: DeliverableSubField, item: Record<string, unknown>): string {
  const raw = item[sf.key];
  if (typeof raw !== 'string' || !raw) return '';
  return sf.enum ? t((sf.enumLabelPrefix || '') + raw) : raw;
}
function objItemToText(t: (k: string) => string, itemFields: DeliverableSubField[], item: unknown): string {
  const x = obj(item);
  return itemFields
    .map((sf) => {
      const val = subFieldValue(t, sf, x);
      return val ? `${t(sf.labelKey)}: ${val}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** Compune secțiunile text dintr-un set de livrabile (pt. composePrintHtml / copy-to-clipboard).
 *  Implicit EXCLUDE `notes` (notă internă) — pune includeNotes:true pentru pachetul intern. */
export function deliverablesToSections(
  t: (k: string) => string,
  kind: RequestKind,
  del: RequestDeliverables,
  opts?: { includeNotes?: boolean },
): { label: string; body: string }[] {
  const includeNotes = !!(opts && opts.includeNotes);
  const out: { label: string; body: string }[] = [];
  for (const field of deliverableFieldsFor(kind)) {
    if (field.key === 'notes' && !includeNotes) continue;
    const label = t(field.labelKey);
    if (field.type === 'prose') {
      const v = (del[field.key] as string) || '';
      if (v.trim()) out.push({ label, body: v });
    } else if (field.type === 'strlist') {
      const items = (del[field.key] as string[]).filter((s) => s && s.trim());
      if (items.length) out.push({ label, body: items.map((s, i) => `${i + 1}. ${s}`).join('\n') });
    } else {
      const parts = (del[field.key] as unknown[])
        .map((it) => objItemToText(t, field.itemFields, it))
        .filter((s) => s.trim());
      if (parts.length) out.push({ label, body: parts.map((s, i) => `#${i + 1}\n${s}`).join('\n\n') });
    }
  }
  return out;
}
