/**
 * Oportunități de canale recomandate de AI (callable-ul `aiRecommendChannels`) — stocate pe
 * leads/{id}.channelRecommendations = { schema:1, channels: RecommendedChannel[] }.
 * REGULĂ (CLAUDE.md): orice cale de încărcare trece prin unicul normaliser coerceToRecommendedChannels;
 * corupt/legacy/viitor → defaults sigure, niciodată throw. Paritate cu clamp-ul din functions/index.js
 * (același runtime-dual ca lpAttribution): functions normalizează la scriere, TS la citire.
 */
import { type Objective } from './onboarding';

export const RECOMMENDATION_SCHEMA = 1;

export const IMPACT_LEVELS = ['ridicat', 'mediu-ridicat', 'mediu', 'scazut'] as const;
export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

// Obiectivele pe care AI-ul le poate sugera pentru un canal — PARITATE STRICTĂ cu enum-ul
// suggestedObjective din CHANNELS_SCHEMA și cu clamp-ul din functions/index.js (exclude 'other',
// neutil pentru un canal; sursa de adevăr e schema callable-ului).
const REC_OBJECTIVES: readonly string[] = ['leads', 'sales', 'awareness', 'traffic'];

/** Rang pentru sortare (impact mai mare = mai sus). */
const IMPACT_RANK: Record<ImpactLevel, number> = { ridicat: 0, 'mediu-ridicat': 1, mediu: 2, scazut: 3 };

export interface RecommendedChannel {
  /** Numele canalului/abordării, specific firmei (ex. „Google Ads Search pe intenție locală"). */
  title: string;
  impact: ImpactLevel;
  /** Frază scurtă care justifică impactul. */
  impactReason: string;
  description: string;
  /** Obiectivul principal sugerat pentru pre-completarea unei cereri de marketing. */
  suggestedObjective: Objective | '';
  /** Propunere scurtă de ofertă/unghi de promovat pe acest canal. */
  suggestedOffer: string;
}

const MAX_CHANNELS = 8;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/** Unicul punct de intrare pentru orice listă care pretinde a fi recomandări de canale. */
export function coerceToRecommendedChannels(v: unknown): RecommendedChannel[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_CHANNELS).map((raw) => {
    const d = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    return {
      title: str(d.title, 140),
      impact: IMPACT_LEVELS.includes(d.impact as ImpactLevel) ? (d.impact as ImpactLevel) : 'mediu',
      impactReason: str(d.impactReason, 300),
      description: str(d.description, 1200),
      suggestedObjective: REC_OBJECTIVES.includes(d.suggestedObjective as string) ? (d.suggestedObjective as Objective) : '',
      suggestedOffer: str(d.suggestedOffer, 500),
    };
  });
}

/** Sortare descrescător după impact, apoi alfabetic după titlu. Nu mutează input-ul. */
export function sortByImpact(list: RecommendedChannel[]): RecommendedChannel[] {
  return [...list].sort((a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact] || a.title.localeCompare(b.title, 'ro'));
}
