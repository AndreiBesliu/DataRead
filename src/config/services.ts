/**
 * Sursa unică a CATALOGULUI de servicii (cele 7 din infografia DataRead) — consumată de pagina
 * publică /servicii, de tag-ul de serviciu pe lead-uri (?service=) și de scripts/test-services.ts.
 *
 * Două feluri de servicii:
 *  - `self`  → produs LIVE self-serve (CTA duce la /self-marketing): azi doar 'self'.
 *  - `lead`  → cerere etichetată cu serviciul (CTA duce la /start?service=<id>) care intră în /admin.
 *
 * Tot textul vizibil stă în i18n (regula t()): services.<id>.name / .tagline / .b1..bN.
 */

export const SERVICE_IDS = ['audit', 'saas', 'automation', 'web', 'self', 'seo', 'sms'] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export interface ServiceDef {
  id: ServiceId;
  /** Emoji-ul cardului (place-holder vizual; iconuri SVG dedicate = îmbunătățire ulterioară). */
  emoji: string;
  /** Numărul de bullet-uri (cheile sunt services.<id>.b1 .. b<bulletCount>). */
  bulletCount: number;
  /** Destinația CTA: 'self' = produs live (/self-marketing), 'lead' = cerere etichetată (/start?service=id). */
  cta: 'lead' | 'self';
}

// Ordinea = ordinea din infografie.
export const SERVICES: ServiceDef[] = [
  { id: 'audit', emoji: '🎯', bulletCount: 4, cta: 'lead' },
  { id: 'saas', emoji: '☁️', bulletCount: 4, cta: 'lead' },
  { id: 'automation', emoji: '⚙️', bulletCount: 4, cta: 'lead' },
  { id: 'web', emoji: '🖥️', bulletCount: 5, cta: 'lead' },
  { id: 'self', emoji: '📣', bulletCount: 5, cta: 'self' },
  { id: 'seo', emoji: '📈', bulletCount: 5, cta: 'lead' },
  { id: 'sms', emoji: '✉️', bulletCount: 4, cta: 'lead' },
];

export function isValidServiceId(v: unknown): v is ServiceId {
  return typeof v === 'string' && (SERVICE_IDS as readonly string[]).includes(v);
}

export function getService(id: ServiceId): ServiceDef {
  return SERVICES.find((s) => s.id === id) ?? SERVICES[0];
}

/** Cheile i18n ale bullet-urilor unui serviciu (services.<id>.b1 .. bN). */
export function serviceBulletKeys(s: ServiceDef): string[] {
  return Array.from({ length: s.bulletCount }, (_, i) => `services.${s.id}.b${i + 1}`);
}

export function serviceNameKey(id: ServiceId): string {
  return `services.${id}.name`;
}
