/**
 * Email — nucleu PUR de randare (Verticala 2, comunicare CRM, felia 1). Compune mesajul pe care extensia Firebase
 * „Trigger Email" (firestore-send-email) îl trimite: subiect + html (escapat) + text, cu footer de dezabonare (GDPR).
 * Pur + testat; PORTAT 1:1 în functions/index.js (renderEmail), cu paritate verificată e2e. NU trimite nimic — doar
 * compune. Trimiterea efectivă e gate-uită (EMAIL_ENABLED) + necesită extensia instalată (vezi CLAUDE.md).
 */
export const EMAIL_SUBJECT_MAX = 200;
export const EMAIL_BODY_MAX = 5000;
export const EMAIL_BRAND_MAX = 80;

/** Escape HTML pentru corpul de email (text liber al operatorului) — anti-injecție în clientul de mail. */
export function escapeEmailHtml(s: string): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export interface EmailRenderInput {
  subject: string;
  body: string;          // text simplu (newline → <br> în html)
  unsubscribeUrl: string; // https; gol = fără footer de dezabonare
  brand: string;
  lang: 'ro' | 'en';
}
export interface RenderedEmail { subject: string; html: string; text: string; }

/** Randează un email din subiect + corp text simplu. Conținut curat (un singur container, fără imagini/CSS agresiv)
 *  + footer de dezabonare = prietenos cu filtrele anti-spam. URL-ul de dezabonare e https-only (altfel omis). */
export function renderEmail(input: EmailRenderInput): RenderedEmail {
  const subject = String(input.subject || '').slice(0, EMAIL_SUBJECT_MAX);
  const rawBody = String(input.body || '').slice(0, EMAIL_BODY_MAX);
  const brand = String(input.brand || 'DataRead').slice(0, EMAIL_BRAND_MAX);
  const lang = input.lang === 'en' ? 'en' : 'ro';
  const unsub = typeof input.unsubscribeUrl === 'string' && /^https:\/\/[^\s"')]+$/i.test(input.unsubscribeUrl) ? input.unsubscribeUrl : '';
  const unsubLabel = lang === 'en' ? 'Unsubscribe' : 'Dezabonare';
  const bodyHtml = escapeEmailHtml(rawBody).replace(/\n/g, '<br>');
  const footerHtml = unsub
    ? `<hr style="border:none;border-top:1px solid #e2e6eb;margin:24px 0"><p style="font-size:12px;color:#6b7280">${escapeEmailHtml(brand)} &middot; <a href="${escapeEmailHtml(unsub)}" style="color:#6b7280">${unsubLabel}</a></p>`
    : '';
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#16202c;max-width:600px;margin:0 auto;padding:20px">${bodyHtml}${footerHtml}</div>`;
  const text = rawBody + (unsub ? `\n\n— ${brand}\n${unsubLabel}: ${unsub}` : '');
  return { subject, html, text };
}

/** Normalizează un draft de email primit de la operator (subiect + corp) — plafoane, fără throw. */
export function coerceEmailDraft(v: unknown): { subject: string; body: string } {
  const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  return {
    subject: (typeof d.subject === 'string' ? d.subject : '').slice(0, EMAIL_SUBJECT_MAX),
    body: (typeof d.body === 'string' ? d.body : '').slice(0, EMAIL_BODY_MAX),
  };
}
