/**
 * Predicție comportamentală (Faza 1) — ieșirea AI pentru un SUBIECT: un contact (consumatorul clientului)
 * sau un lead (pipeline-ul nostru). Motor UNIC; aceeași schemă pentru ambele. Stocată în colecții admin-only
 * (contactPredictions/leadPredictions). PUR, un singur normaliser (coerceToPrediction) + plafoane exportate.
 * Onestitate pe date subțiri: confidence + caveats + dataGaps sunt OBLIGATORII (dataGaps = ce să capturăm în plus).
 */
export const PREDICTION_SCHEMA = 1;

export const PREDICTION_KINDS = ['contact', 'lead'] as const;
export type PredictionKind = (typeof PREDICTION_KINDS)[number];

export const CONVERSION_LIKELIHOODS = ['low', 'med', 'high'] as const;
export type ConversionLikelihood = (typeof CONVERSION_LIKELIHOODS)[number];

export const TEMPERATURES = ['hot', 'warm', 'cooling', 'cold'] as const;
export type Temperature = (typeof TEMPERATURES)[number];

export const CONFIDENCES = ['low', 'med', 'high'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const NBA_ACTIONS = ['contact', 'nurture', 'offer', 'wait', 'qualify', 'reengage'] as const;
export type NbaAction = (typeof NBA_ACTIONS)[number];

export const PREDICTION_LIMITS = {
  reasoning: 2000, caveats: 1000, detail: 300, dataGap: 200,
  nextBestActions: 3, dataGaps: 6, whenDays: 30,
} as const;

export interface NextBestAction {
  action: NbaAction;
  detail: string;
  whenDays: number; // 0..30
}

export interface Prediction {
  schema: typeof PREDICTION_SCHEMA;
  conversionLikelihood: ConversionLikelihood;
  temperature: Temperature;
  confidence: Confidence;
  reasoning: string;
  nextBestActions: NextBestAction[];
  caveats: string;
  dataGaps: string[];
}

function inEnum<T extends string>(list: readonly T[], v: unknown, fb: T): T {
  return list.includes(v as T) ? (v as T) : fb;
}

export function coerceNextBestAction(v: unknown): NextBestAction {
  const d = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  let whenDays = typeof d.whenDays === 'number' && isFinite(d.whenDays) ? Math.round(d.whenDays) : 0;
  if (whenDays < 0) whenDays = 0;
  if (whenDays > PREDICTION_LIMITS.whenDays) whenDays = PREDICTION_LIMITS.whenDays;
  return {
    action: inEnum(NBA_ACTIONS, d.action, 'contact'),
    detail: typeof d.detail === 'string' ? d.detail.slice(0, PREDICTION_LIMITS.detail) : '',
    whenDays,
  };
}

/** Unicul normaliser pentru o predicție (read path). Corupt/lipsă → defaults sigure, niciodată throw. */
export function coerceToPrediction(raw: unknown): Prediction {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    schema: PREDICTION_SCHEMA,
    conversionLikelihood: inEnum(CONVERSION_LIKELIHOODS, d.conversionLikelihood, 'low'),
    temperature: inEnum(TEMPERATURES, d.temperature, 'cold'),
    confidence: inEnum(CONFIDENCES, d.confidence, 'low'),
    reasoning: s(d.reasoning, PREDICTION_LIMITS.reasoning),
    nextBestActions: (Array.isArray(d.nextBestActions) ? d.nextBestActions : []).slice(0, PREDICTION_LIMITS.nextBestActions).map(coerceNextBestAction),
    caveats: s(d.caveats, PREDICTION_LIMITS.caveats),
    dataGaps: (Array.isArray(d.dataGaps) ? d.dataGaps : [])
      .filter((x): x is string => typeof x === 'string' && !!x.trim())
      .slice(0, PREDICTION_LIMITS.dataGaps)
      .map((x) => x.slice(0, PREDICTION_LIMITS.dataGap)),
  };
}

/** True dacă predicția are conținut real (folosit de UI pt. „generează vs re-generează"). */
export function hasPrediction(p: Prediction | null | undefined): boolean {
  return !!p && (!!p.reasoning.trim() || p.nextBestActions.length > 0);
}

/** Flatten predicție → secțiuni {label, body} pt. copy/PDF (etichetele enum vin prin t()). */
export function predictionToSections(
  t: (k: string, opts?: Record<string, unknown>) => string,
  p: Prediction,
): { label: string; body: string }[] {
  const out: { label: string; body: string }[] = [];
  out.push({
    label: t('admin.predSummary'),
    body: `${t('admin.predConversion')}: ${t('admin.predLk_' + p.conversionLikelihood)} · ${t('admin.predTemp')}: ${t('admin.predTemp_' + p.temperature)} · ${t('admin.predConfidence')}: ${t('admin.predConf_' + p.confidence)}`,
  });
  if (p.reasoning.trim()) out.push({ label: t('admin.predReasoning'), body: p.reasoning });
  if (p.nextBestActions.length) {
    out.push({
      label: t('admin.predNba'),
      body: p.nextBestActions
        .map((a, i) => `${i + 1}. ${t('admin.predAction_' + a.action)}${a.detail ? ` — ${a.detail}` : ''}${a.whenDays ? ` (${t('admin.predInDays', { n: a.whenDays })})` : ''}`)
        .join('\n'),
    });
  }
  if (p.caveats.trim()) out.push({ label: t('admin.predCaveats'), body: p.caveats });
  if (p.dataGaps.length) out.push({ label: t('admin.predDataGaps'), body: p.dataGaps.map((g, i) => `${i + 1}. ${g}`).join('\n') });
  return out;
}
