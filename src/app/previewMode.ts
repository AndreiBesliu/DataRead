/** „Modul preview" = pagina e încărcată în iframe-ul de previzualizare din /admin (URL cu `?preview=1`).
 *  În acest mod:
 *   - `/app` NU mai cere autentificare → afișează un shell tematizat (vezi tema, nu ecranul de login);
 *   - side-effect-urile Firebase Auth (ensureClientDoc / refresh token / claim admin) sunt SĂRITE, ca
 *     iframe-ul (același origin, deci aceeași sesiune) să NU atingă/deranjeze sesiunea operatorului din /admin.
 *  E pur cosmetic: nu citește datele niciunui client, doar randează aspectul. */
export function isPreviewSearch(search: string | undefined): boolean {
  try {
    return new URLSearchParams(search || '').get('preview') === '1';
  } catch {
    return false;
  }
}

/** Variantă fără router (pentru cod care rulează în afara componentelor React, ex. useAuthInit). */
export function isPreviewNow(): boolean {
  return typeof window !== 'undefined' && isPreviewSearch(window.location.search);
}
