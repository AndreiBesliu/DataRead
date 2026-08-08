/**
 * Motor de RETENȚIE — plafonează cât timp păstrăm datele care se acumulează singure.
 *
 * De ce: până acum DataRead nu ștergea NIMIC. `errorReports`, `abuseGuard`, `predictionLog` și
 * `campaignInsightLog` cresc la infinit — și e deopotrivă cost Firestore ȘI minimizare de date (GDPR:
 * datele nu se păstrează „cât o fi", ci cât e necesar scopului).
 *
 * PUR (fără Firebase, fără Date.now() în corp — ceasul se injectează). Regulile sunt DATE, iar bucla care
 * șterge trăiește în `functions/index.js` (port JS, paritate testată în e2e). Interogarea folosește o
 * inegalitate pe UN SINGUR câmp ⇒ fără index compus.
 *
 * ⚠️ REGULA DE AUR, copiată din PrestoConstruct și verificată de suită: **datele financiare și cele de
 * business nu se șterg NICIODATĂ automat.** Facturile au obligații legale de păstrare (ani), iar lead-urile
 * și submisiile sunt datele CLIENTULUI — dispariția lor pe baza unui default tehnic ar fi pierdere de date,
 * nu igienă. Orice colecție din `PROTECTED_COLLECTIONS` e refuzată de `validateRetentionRules`.
 */

export const RETENTION_SCHEMA = 1;

/** Cum e stocat câmpul de timp al colecției. Determină forma pragului de comparație. */
export type RetentionFieldKind =
  | 'timestamp' // Firestore Timestamp (serverTimestamp) → prag = Timestamp
  | 'dayString'; // 'YYYY-MM-DD' → prag = string (ISO se compară lexicografic corect)

export interface RetentionRule {
  /** Colecție de nivel superior. Subcolecțiile ar cere `collectionGroup` + index declarat — altă felie. */
  collection: string;
  field: string;
  kind: RetentionFieldKind;
  days: number;
  /** De ce păstrăm exact atât — ca să nu se schimbe cifra fără motiv. */
  why: string;
}

/**
 * Colecții care NU pot intra NICIODATĂ într-o regulă de retenție.
 * Două familii: (a) financiar/legal — obligații de păstrare; (b) datele de business ale clientului.
 */
export const PROTECTED_COLLECTIONS: readonly string[] = [
  'invoices', 'invoiceCounters', 'appConfig', 'settings', 'siteConfig',
  'clients', 'leads', 'campaigns', 'landingPages', 'admins', 'adminAudit',
  'contacts', 'submissions', 'customers', 'products',
];

/**
 * Regulile active. Doar TELEMETRIE — lucruri pe care le producem noi despre sistem, nu date de client.
 * `visits`/`submissions` sunt subcolecții ALE CLIENTULUI și lipsesc deliberat (vezi antetul).
 */
export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    collection: 'abuseGuard', field: 'day', kind: 'dayString', days: 3,
    why: 'Contor zilnic de rate-limit. După ziua curentă nu mai are nicio utilitate; ținem 3 zile ca marjă de fus orar/investigație.',
  },
  {
    collection: 'errorReports', field: 'at', kind: 'timestamp', days: 90,
    why: 'Rapoarte de crash. 90 de zile acoperă un ciclu de regresie; mai vechi = zgomot.',
  },
  {
    collection: 'predictionLog', field: 'at', kind: 'timestamp', days: 365,
    why: 'Bucla de învățare: reconcilierea se face la ≥14 zile, iar acuratețea se măsoară pe un an.',
  },
  {
    collection: 'campaignInsightLog', field: 'at', kind: 'timestamp', days: 365,
    why: 'Idem — delta ROAS pentru acuratețea verdictelor, măsurată anual.',
  },
];

/** O zi în milisecunde. */
export const DAY_MS = 86_400_000;

/** Pragul unei reguli: tot ce e STRICT mai vechi se poate șterge. */
export function retentionCutoffMs(rule: RetentionRule, nowMs: number): number {
  return nowMs - rule.days * DAY_MS;
}

/** 'YYYY-MM-DD' pentru un moment dat (UTC — ca `new Date().toISOString().slice(0,10)` din functions). */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Pragul în forma pe care o cere câmpul: milisecunde pentru Timestamp, string pentru zi. */
export function retentionCutoffValue(rule: RetentionRule, nowMs: number): number | string {
  const cut = retentionCutoffMs(rule, nowMs);
  return rule.kind === 'dayString' ? dayKey(cut) : cut;
}

/**
 * Decizia, pură: se șterge documentul ăsta? `value` e exact ce e stocat în câmp (ms pentru Timestamp,
 * string pentru zi). Valoare lipsă/coruptă → **NU se șterge** (fail-safe: nu ștergem ce nu înțelegem).
 */
export function shouldDelete(rule: RetentionRule, value: unknown, nowMs: number): boolean {
  if (rule.kind === 'dayString') {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value < (retentionCutoffValue(rule, nowMs) as string)
      : false;
  }
  return typeof value === 'number' && Number.isFinite(value)
    ? value < (retentionCutoffValue(rule, nowMs) as number)
    : false;
}

/** Validează setul de reguli. Întoarce lista de erori (goală = valid). Rulată în suită, nu la runtime. */
export function validateRetentionRules(rules: readonly RetentionRule[]): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const r of rules) {
    if (PROTECTED_COLLECTIONS.includes(r.collection)) {
      errs.push(`colecție PROTEJATĂ în reguli: ${r.collection}`);
    }
    if (seen.has(r.collection)) errs.push(`regulă duplicată: ${r.collection}`);
    seen.add(r.collection);
    if (!Number.isInteger(r.days) || r.days < 1 || r.days > 3650) errs.push(`zile invalide (${r.days}) pentru ${r.collection}`);
    if (!r.field) errs.push(`câmp lipsă pentru ${r.collection}`);
    if (!r.why || r.why.length < 20) errs.push(`motivație insuficientă pentru ${r.collection}`);
  }
  return errs;
}
