/**
 * Cererea de marketing (Verticala 1) — leads/{leadId}/requests/{reqId}, schema 1.
 * Două TIPURI de cereri (spec Ionuţ 5.1–5.6):
 *   'campaign' — campanie de reclame: texte ads / scripturi video / structură Meta
 *   'content'  — plan de conținut 30 de zile: calendar / postări gata de publicat / idei
 * Semi-manual sau generat de callable-ul `aiGenerateCampaign` (care alege schema și promptul
 * după kind) — ACELEAȘI câmpuri, fără refactor. Coerce: corupt → defaults, fără throw.
 */
import { OBJECTIVES, type Objective } from './onboarding';

export const REQUEST_SCHEMA = 1;

export const REQUEST_KINDS = ['campaign', 'content'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_STATUSES = ['open', 'done'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface RequestDeliverables {
  /** [campaign] Texte de reclame (Meta ads copy). */
  adTexts: string;
  /** [campaign] Scripturi video / creatives. */
  videoScripts: string;
  /** [campaign] Structura campaniei Meta. */
  campaignStructure: string;
  /** [content] Calendarul de conținut pe 30 de zile. */
  calendar: string;
  /** [content] Postări complete, gata de publicat. */
  posts: string;
  /** [content] Idei de conținut suplimentare. */
  ideas: string;
  /** Note libere (ambele tipuri). */
  notes: string;
}

export const DELIVERABLE_MAX = 8000;

const CAMPAIGN_FIELDS = [
  { key: 'adTexts', labelKey: 'admin.reqAdTexts' },
  { key: 'videoScripts', labelKey: 'admin.reqVideoScripts' },
  { key: 'campaignStructure', labelKey: 'admin.reqCampaignStructure' },
  { key: 'notes', labelKey: 'admin.reqNotes' },
] as const satisfies ReadonlyArray<{ key: keyof RequestDeliverables; labelKey: string }>;

const CONTENT_FIELDS = [
  { key: 'calendar', labelKey: 'admin.reqCalendar' },
  { key: 'posts', labelKey: 'admin.reqPosts' },
  { key: 'ideas', labelKey: 'admin.reqIdeas' },
  { key: 'notes', labelKey: 'admin.reqNotes' },
] as const satisfies ReadonlyArray<{ key: keyof RequestDeliverables; labelKey: string }>;

/** Câmpurile de livrabile afișate/copiate pentru un tip de cerere. */
export function deliverableFieldsFor(kind: RequestKind): ReadonlyArray<{ key: keyof RequestDeliverables; labelKey: string }> {
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
    deliverables: { adTexts: '', videoScripts: '', campaignStructure: '', calendar: '', posts: '', ideas: '', notes: '' },
  };
}

/** Unicul punct de intrare pentru orice date care pretind a fi o cerere de marketing.
 *  Cererile vechi (fără kind) devin 'campaign'. */
export function coerceToMarketingRequest(data: unknown): MarketingRequest {
  if (typeof data !== 'object' || data === null) return emptyRequest();
  const d = data as Record<string, unknown>;
  const del = (typeof d.deliverables === 'object' && d.deliverables !== null ? d.deliverables : {}) as Record<string, unknown>;
  return {
    schema: REQUEST_SCHEMA,
    kind: REQUEST_KINDS.includes(d.kind as RequestKind) ? (d.kind as RequestKind) : 'campaign',
    title: str(d.title, 120),
    offer: str(d.offer, 500),
    budget: str(d.budget, 80),
    objective: OBJECTIVES.includes(d.objective as Objective) ? (d.objective as Objective) : '',
    status: REQUEST_STATUSES.includes(d.status as RequestStatus) ? (d.status as RequestStatus) : 'open',
    source: d.source === 'ai' ? 'ai' : 'manual',
    deliverables: {
      adTexts: str(del.adTexts, DELIVERABLE_MAX),
      videoScripts: str(del.videoScripts, DELIVERABLE_MAX),
      campaignStructure: str(del.campaignStructure, DELIVERABLE_MAX),
      calendar: str(del.calendar, DELIVERABLE_MAX),
      posts: str(del.posts, DELIVERABLE_MAX),
      ideas: str(del.ideas, DELIVERABLE_MAX),
      notes: str(del.notes, DELIVERABLE_MAX),
    },
  };
}
