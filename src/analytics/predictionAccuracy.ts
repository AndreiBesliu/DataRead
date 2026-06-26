/**
 * Motor PUR de SCORARE a acurateței predicțiilor — inima buclei de învățare (Pachet A din auditul analytics/AI).
 * Compară predicții ISTORICE (snapshot la momentul T: temperature + conversionLikelihood) cu REZULTATUL real de mai
 * târziu (lead won/lost, contact câștigat/pierdut). Fără asta, „confidence" raportat de model n-are sens empiric.
 * Fără dependențe, fără I/O, fără throw — testat headless (scripts/test-prediction-accuracy.ts).
 *
 * Definiții:
 *  - RealizedOutcome: 'won' | 'lost' | 'open' (open = încă nedecis → NU intră în acuratețe).
 *  - „pozitiv prezis" = temperature hot/warm SAU conversionLikelihood high/med; altfel „negativ prezis".
 *  - hit direcțional = (pozitiv prezis ȘI won) SAU (negativ prezis ȘI lost).
 */
import { CONVERSION_LIKELIHOODS, TEMPERATURES, type ConversionLikelihood, type Temperature } from '../types/prediction';

export type RealizedOutcome = 'won' | 'lost' | 'open';

export interface ScoredPrediction {
  temperature: Temperature;
  conversionLikelihood: ConversionLikelihood;
  outcome: RealizedOutcome;
}

export interface BucketStat {
  bucket: string;
  decided: number; // won + lost (open ignorat)
  won: number;
  convRate: number | null; // won / decided; null dacă decided === 0
}

/** Status de lead (pipeline) → rezultat. won/lost decid; new/contacted = încă deschis. */
export function leadOutcome(status: string | undefined | null): RealizedOutcome {
  return status === 'won' ? 'won' : status === 'lost' ? 'lost' : 'open';
}

/** Lifecycle de contact (consumatorul clientului) → rezultat. „castigat" decide pozitiv, „pierdut" negativ. */
export function contactOutcome(lifecycle: string | undefined | null): RealizedOutcome {
  if (lifecycle === 'castigat' || lifecycle === 'client' || lifecycle === 'won') return 'won';
  if (lifecycle === 'pierdut' || lifecycle === 'lost') return 'lost';
  return 'open';
}

/** Predicția numără drept „pozitivă" (se aștepta conversie)? */
export function isPositivePrediction(temperature: Temperature, likelihood: ConversionLikelihood): boolean {
  return temperature === 'hot' || temperature === 'warm' || likelihood === 'high' || likelihood === 'med';
}

function statsFor(scored: ScoredPrediction[], keyOf: (s: ScoredPrediction) => string, buckets: readonly string[]): BucketStat[] {
  return buckets.map((bucket) => {
    const inB = scored.filter((s) => keyOf(s) === bucket && s.outcome !== 'open');
    const won = inB.filter((s) => s.outcome === 'won').length;
    const decided = inB.length;
    return { bucket, decided, won, convRate: decided > 0 ? won / decided : null };
  });
}

/** Rata reală de conversie pe fiecare temperatură prezisă (curba de calibrare). */
export function accuracyByTemperature(scored: ScoredPrediction[]): BucketStat[] {
  return statsFor(scored, (s) => s.temperature, TEMPERATURES);
}

/** Rata reală de conversie pe fiecare nivel de probabilitate prezis. */
export function accuracyByLikelihood(scored: ScoredPrediction[]): BucketStat[] {
  return statsFor(scored, (s) => s.conversionLikelihood, CONVERSION_LIKELIHOODS);
}

/** Acuratețe direcțională globală: din predicțiile DECISE, câte au nimerit direcția (pozitiv→won / negativ→lost). */
export function directionalAccuracy(scored: ScoredPrediction[]): { decided: number; hits: number; rate: number | null } {
  const decided = scored.filter((s) => s.outcome !== 'open');
  const hits = decided.filter((s) => {
    const pos = isPositivePrediction(s.temperature, s.conversionLikelihood);
    return (pos && s.outcome === 'won') || (!pos && s.outcome === 'lost');
  }).length;
  return { decided: decided.length, hits, rate: decided.length > 0 ? hits / decided.length : null };
}

/** Calibrare „temperatura înseamnă ceva": rata de conversie scade monoton hot ≥ warm ≥ cooling ≥ cold
 *  (printre bucket-urile cu date). Tolerant la null (bucket fără decizii e sărit). */
export function isCalibrated(byTemp: BucketStat[]): boolean {
  const order = TEMPERATURES; // hot..cold = descrescător așteptat
  const rates = order
    .map((b) => byTemp.find((x) => x.bucket === b))
    .filter((x): x is BucketStat => !!x && x.convRate !== null)
    .map((x) => x.convRate as number);
  if (rates.length < 2) return false;
  for (let i = 1; i < rates.length; i++) if (rates[i] > rates[i - 1] + 1e-9) return false;
  return true;
}
