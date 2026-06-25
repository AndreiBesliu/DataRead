/**
 * Dovadă socială pentru site-ul public (#14). Sursa unică pentru componenta SocialProof.
 *
 * ONESTITATE: NU punem testimoniale inventate pe un site B2B live (ar induce în eroare prospecții reali).
 * `SOCIAL_PROOF_TESTIMONIALS` e GOL până ni le dă Andrei (citate reale + acord). Componenta randează secțiunea
 * de testimoniale DOAR dacă lista e ne-goală. `SOCIAL_PROOF_STATS` conține DOAR fapte adevărate despre platformă
 * (nu „X clienți"/„Y% creștere" fabricate) — capabilități reale, traducerea etichetei prin i18n.
 */

export interface SocialStat {
  /** Valoarea afișată mare (cifră scurtă sau etichetă — ex. '7', 'AI', 'RO·EN'). */
  value: string;
  /** Cheia i18n a etichetei de sub valoare. */
  labelKey: string;
}

export interface Testimonial {
  /** Citatul (text real, dat de Andrei). Plain text. */
  quote: string;
  author: string;
  role: string;
}

// Fapte ADEVĂRATE despre platformă (verificabile în cod) — nu cifre de vanitate fabricate.
export const SOCIAL_PROOF_STATS: SocialStat[] = [
  { value: '7', labelKey: 'socialProof.s_services' },
  { value: 'AI', labelKey: 'socialProof.s_ai' },
  { value: 'RO·EN', labelKey: 'socialProof.s_langs' },
];

// GOL intenționat — Andrei adaugă citate REALE cu acordul clienților. Componenta le arată doar când există.
export const SOCIAL_PROOF_TESTIMONIALS: Testimonial[] = [];
