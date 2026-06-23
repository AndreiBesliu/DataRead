/**
 * Audit SEO on-page (modul „Automatizare SEO", felia 1) — rezultatul callable-ului `seoAudit` (functions).
 * Funcția: ia un URL public, extrage semnale on-page REALE (titlu/meta/headings/imagini/linkuri…), le punctează
 * DETERMINIST (probleme + scor 0-100) și cere AI recomandări prioritizate GROUNDED pe semnalele extrase.
 *
 * Acest fișier = DOAR tipuri + normaliser, consumate de UI-ul /admin care citește audit-urile persistate
 * (seoAudits). Extragerea + scorul trăiesc în functions (au nevoie de fetch) și sunt testate prin e2e (JS).
 * Un singur normaliser (coerceToSeoAudit) pe toate căile de citire — corupt/legacy → defaults sigure.
 */

export const SEO_AUDIT_SCHEMA = 1;

export const SEO_SEVERITIES = ['critical', 'warning', 'good'] as const;
export type SeoSeverity = (typeof SEO_SEVERITIES)[number];

export const SEO_AREAS = ['title', 'meta', 'headings', 'content', 'images', 'links', 'technical', 'keyword'] as const;
export type SeoArea = (typeof SEO_AREAS)[number];

export const SEO_PRIORITIES = ['high', 'medium', 'low'] as const;
export type SeoPriority = (typeof SEO_PRIORITIES)[number];

export const SEO_LIMITS = { issues: 40, recommendations: 12, text: 600, summary: 2000 } as const;

/** Semnalele on-page extrase din pagină (date factuale, sursa grounding-ului pentru AI). */
export interface SeoSignals {
  finalUrl: string;
  statusCode: number;
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  h1Count: number;
  h1Text: string;
  h2Count: number;
  h3Count: number;
  imgCount: number;
  imgMissingAlt: number;
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  hasViewport: boolean;
  lang: string;
  /** Densitatea cuvântului-cheie (procent din cuvinte), dacă a fost dat un keyword. */
  keywordInTitle: boolean;
  keywordInH1: boolean;
  keywordInMeta: boolean;
  keywordDensity: number;
}

export interface SeoIssue {
  severity: SeoSeverity;
  area: SeoArea;
  message: string;
}

export interface SeoRecommendation {
  priority: SeoPriority;
  title: string;
  detail: string;
}

export interface SeoAudit {
  schema: typeof SEO_AUDIT_SCHEMA;
  url: string;
  keyword: string;
  score: number; // 0-100
  signals: SeoSignals | null;
  issues: SeoIssue[];
  recommendations: SeoRecommendation[];
  summary: string;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
function bool(v: unknown): boolean {
  return v === true;
}

function coerceSignals(raw: unknown): SeoSignals | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  return {
    finalUrl: str(d.finalUrl, 500),
    statusCode: num(d.statusCode),
    title: str(d.title, 600),
    titleLength: num(d.titleLength),
    metaDescription: str(d.metaDescription, 1000),
    metaDescriptionLength: num(d.metaDescriptionLength),
    h1Count: num(d.h1Count),
    h1Text: str(d.h1Text, 600),
    h2Count: num(d.h2Count),
    h3Count: num(d.h3Count),
    imgCount: num(d.imgCount),
    imgMissingAlt: num(d.imgMissingAlt),
    wordCount: num(d.wordCount),
    internalLinks: num(d.internalLinks),
    externalLinks: num(d.externalLinks),
    canonical: str(d.canonical, 500),
    ogTitle: str(d.ogTitle, 600),
    ogDescription: str(d.ogDescription, 1000),
    ogImage: str(d.ogImage, 500),
    hasViewport: bool(d.hasViewport),
    lang: str(d.lang, 20),
    keywordInTitle: bool(d.keywordInTitle),
    keywordInH1: bool(d.keywordInH1),
    keywordInMeta: bool(d.keywordInMeta),
    keywordDensity: num(d.keywordDensity),
  };
}

/** Unicul normaliser. Corupt/legacy/viitor → defaults sigure, niciodată throw. */
export function coerceToSeoAudit(raw: unknown): SeoAudit {
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const issues = Array.isArray(d.issues) ? d.issues : [];
  const recs = Array.isArray(d.recommendations) ? d.recommendations : [];
  return {
    schema: SEO_AUDIT_SCHEMA,
    url: str(d.url, 500),
    keyword: str(d.keyword, 120),
    score: Math.max(0, Math.min(100, Math.round(num(d.score)))),
    signals: coerceSignals(d.signals),
    issues: issues.slice(0, SEO_LIMITS.issues).map((i) => {
      const x = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
      return {
        severity: SEO_SEVERITIES.includes(x.severity as SeoSeverity) ? (x.severity as SeoSeverity) : 'warning',
        area: SEO_AREAS.includes(x.area as SeoArea) ? (x.area as SeoArea) : 'technical',
        message: str(x.message, SEO_LIMITS.text),
      };
    }),
    recommendations: recs.slice(0, SEO_LIMITS.recommendations).map((r) => {
      const x = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      return {
        priority: SEO_PRIORITIES.includes(x.priority as SeoPriority) ? (x.priority as SeoPriority) : 'medium',
        title: str(x.title, 200),
        detail: str(x.detail, SEO_LIMITS.text),
      };
    }),
    summary: str(d.summary, SEO_LIMITS.summary),
  };
}

/** Nota literală (A–F) din scor — pentru badge-ul din UI. */
export function seoGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export const SEO_GRADE_COLORS: Record<string, string> = {
  A: '#1f9d57', B: '#3fa66a', C: '#d98e0b', D: '#e0722b', F: '#e0454f',
};
