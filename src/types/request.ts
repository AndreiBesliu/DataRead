/**
 * Cererea de marketing (Verticala 1) — leads/{leadId}/requests/{reqId}, schema 1.
 * Semi-manual în v1 (Faza 1 din spec: „AI manual / semi-auto"): adminul creează cererea
 * (ofertă + buget + obiectiv) și scrie livrabilele de mână. În felia 2, callable-ul
 * `aiGenerateCampaign` completează ACELEAȘI câmpuri de livrabile (source: 'ai') — modelul
 * de date nu se schimbă. Coerce-urile respectă invariantul: corupt → defaults, fără throw.
 */
import { OBJECTIVES, type Objective } from './onboarding';

export const REQUEST_SCHEMA = 1;

export const REQUEST_STATUSES = ['open', 'done'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface RequestDeliverables {
  /** Texte de reclame (Meta ads copy). */
  adTexts: string;
  /** Scripturi video / creatives. */
  videoScripts: string;
  /** Structura campaniei Meta (campanie / ad set-uri / audiențe / bugete). */
  campaignStructure: string;
  /** Note libere. */
  notes: string;
}

export const DELIVERABLE_FIELDS = [
  { key: 'adTexts', labelKey: 'admin.reqAdTexts' },
  { key: 'videoScripts', labelKey: 'admin.reqVideoScripts' },
  { key: 'campaignStructure', labelKey: 'admin.reqCampaignStructure' },
  { key: 'notes', labelKey: 'admin.reqNotes' },
] as const satisfies ReadonlyArray<{ key: keyof RequestDeliverables; labelKey: string }>;

export const DELIVERABLE_MAX = 8000;

export interface MarketingRequest {
  schema: typeof REQUEST_SCHEMA;
  title: string;
  /** Oferta / produsul promovat. */
  offer: string;
  /** Bugetul campaniei — text liber în v1 (ex. „500 € / lună"). */
  budget: string;
  objective: Objective | '';
  status: RequestStatus;
  /** Cine a produs livrabilele — 'ai' apare abia în felia 2. */
  source: 'manual' | 'ai';
  deliverables: RequestDeliverables;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

export function emptyRequest(): MarketingRequest {
  return {
    schema: REQUEST_SCHEMA,
    title: '',
    offer: '',
    budget: '',
    objective: '',
    status: 'open',
    source: 'manual',
    deliverables: { adTexts: '', videoScripts: '', campaignStructure: '', notes: '' },
  };
}

/** Unicul punct de intrare pentru orice date care pretind a fi o cerere de marketing. */
export function coerceToMarketingRequest(data: unknown): MarketingRequest {
  if (typeof data !== 'object' || data === null) return emptyRequest();
  const d = data as Record<string, unknown>;
  const del = (typeof d.deliverables === 'object' && d.deliverables !== null ? d.deliverables : {}) as Record<string, unknown>;
  return {
    schema: REQUEST_SCHEMA,
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
      notes: str(del.notes, DELIVERABLE_MAX),
    },
  };
}
