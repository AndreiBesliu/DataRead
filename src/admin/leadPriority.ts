/**
 * Prioritizarea inbox-ului de lead-uri (#10) — scor DETERMINIST 0-100 care răspunde „pe cine sun primul azi".
 * CONSUMĂ semnalul AI deja calculat (predicția: temperatură + șansă de conversie din leadPredictions) și-l combină
 * cu recența, statusul și follow-up-ul scadent. Pur (fără AI nou, fără cost, instant, explicabil) → testabil headless.
 */
import type { LeadStatus } from '../types/lead';
import type { Temperature, ConversionLikelihood } from '../types/prediction';

export interface LeadPriorityInput {
  status: LeadStatus;
  createdAtMs: number;
  nextFollowUpMs?: number | null;
  temperature?: Temperature | null;
  conversionLikelihood?: ConversionLikelihood | null;
}

export type PriorityTier = 'high' | 'medium' | 'low';
export interface LeadPriorityResult {
  score: number;
  tier: PriorityTier;
  /** Factorul dominant (cheie i18n admin.priority.r_*). */
  reasonKey: string;
}

const TEMP_PTS: Record<Temperature, number> = { hot: 40, warm: 24, cooling: 12, cold: 4 };
const LK_PTS: Record<ConversionLikelihood, number> = { high: 26, med: 13, low: 4 };
const DAY_MS = 86400000;

/** Scorul de prioritate al unui lead la momentul `nowMs`. Lead-urile câștigate/pierdute coboară la zero. */
export function leadPriority(input: LeadPriorityInput, nowMs: number): LeadPriorityResult {
  if (input.status === 'won') return { score: 0, tier: 'low', reasonKey: 'won' };
  if (input.status === 'lost') return { score: 0, tier: 'low', reasonKey: 'lost' };

  let score = 0;
  const reasons: Array<{ k: string; w: number }> = [];

  if (input.temperature) {
    score += TEMP_PTS[input.temperature];
    if (input.temperature === 'hot') reasons.push({ k: 'hot', w: 40 });
  }
  if (input.conversionLikelihood) {
    score += LK_PTS[input.conversionLikelihood];
    if (input.conversionLikelihood === 'high') reasons.push({ k: 'high', w: 26 });
  }
  if (input.nextFollowUpMs != null && input.nextFollowUpMs <= nowMs) {
    score += 30;
    reasons.push({ k: 'followUpDue', w: 38 });
  }
  if (input.status === 'new') {
    score += 18;
    reasons.push({ k: 'new', w: 18 });
  } else if (input.status === 'contacted') {
    score += 6;
  }
  // Vechime: un lead NEtratat de mult e overdue → bump (plafonat).
  const ageDays = Math.max(0, Math.floor((nowMs - (input.createdAtMs || nowMs)) / DAY_MS));
  if (input.status === 'new' && ageDays >= 2) {
    score += Math.min(15, ageDays * 2);
    reasons.push({ k: 'untouched', w: 16 + ageDays });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier: PriorityTier = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  reasons.sort((a, b) => b.w - a.w);
  const reasonKey = reasons[0] ? reasons[0].k : (input.temperature || 'low');
  return { score, tier, reasonKey };
}

export const PRIORITY_TIER_COLORS: Record<PriorityTier, string> = { high: '#e0454f', medium: '#d98e0b', low: '#8a93a6' };
