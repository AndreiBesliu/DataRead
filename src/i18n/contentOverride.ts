/**
 * Aplicarea override-urilor de CONȚINUT (Felia B) peste dicționarele i18next.
 *
 * De ce peste STORE-ul i18next și nu printr-un `tx()` propriu pe fiecare pagină: cheile sunt cerute și
 * din bucle (`t(\`landing.what${i}Title\`)`), din `<Seo>` (titlu/descriere) și din configuri
 * (`publicRoutes`) — un hook per-pagină ar rata exact acele locuri și ar cere rescrierea a ~80 de
 * apeluri. `addResourceBundle(deep, overwrite)` le prinde pe toate, fără să atingem nicio pagină.
 *
 * Siguranță: se aplică DOAR cheile din registrul `ALL_EDITABLE_KEYS`. Un override pentru orice
 * altceva (cheie scoasă din registru, doc modificat manual) e ignorat — registrul e autoritatea.
 */
import type { i18n as I18nInstance } from 'i18next';
import {
  CONTENT_LANGS,
  NO_APPLIED_CONTENT,
  coerceToPageContent,
  planContentApply,
  type AppliedContent,
  type PageContent,
} from '../types/pageContent';
import { ALL_EDITABLE_KEYS } from '../config/editablePageContent';
import ro from './locales/ro';
import en from './locales/en';

/** Ce am aplicat deja în store — necesar ca o cheie ȘTEARSĂ din documentul publicat să poată fi
 *  readusă la textul implicit (i18next doar fuzionează; nu există „removeResource"). */
let appliedState: AppliedContent = NO_APPLIED_CONTENT;

/** Doar pentru teste / context de preview: uită ce s-a aplicat. */
export function resetAppliedContent(): void {
  appliedState = NO_APPLIED_CONTENT;
}

/**
 * Adu store-ul i18next la conținutul `pc`. Întoarce numărul de chei SCRISE (0 = nimic de schimbat).
 *
 * Nu e o simplă suprapunere: `planContentApply` calculează și restaurările (cheie fără override →
 * textul din locale), deci „revino la implicit" se vede imediat, fără deploy. Când documentul publicat
 * coincide cu ce e deja aplicat — cazul normal după fiecare deploy — nu se cheamă deloc
 * `addResourceBundle`, deci nu apare niciun re-render și niciun flash.
 */
export function applyContentOverrides(
  i18n: I18nInstance,
  pc: PageContent,
  allowed: readonly string[] = ALL_EDITABLE_KEYS
): number {
  const plan = planContentApply(pc, appliedState, allowed, defaultText);
  for (const lang of CONTENT_LANGS) {
    const bundle = plan.bundles[lang];
    if (!bundle) continue;
    // deep=true → fuzionează în ramura existentă (nu șterge cheile surori); overwrite=true → bate textul default.
    i18n.addResourceBundle(lang, 'translation', bundle, true, true);
  }
  appliedState = plan.applied;
  return plan.writes;
}

/** Normalizează ORICE (snapshot copt sau doc Firestore brut) și aplică — unica poartă de intrare. */
export function applyRawContentOverrides(i18n: I18nInstance, raw: unknown): number {
  return applyContentOverrides(i18n, coerceToPageContent(raw));
}

/** Caută o cheie punctată într-un dicționar imbricat. Non-string (ramură/lipsă) → null. */
function lookupDotted(dict: unknown, key: string): string | null {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : null;
}

/**
 * Textul IMPLICIT al unei chei, citit din modulele de locale — NU din store-ul i18next.
 * Crucial: `applyContentOverrides` mută store-ul, deci `t(key)` ar întoarce override-ul; editorul din
 * /admin trebuie să arate implicitul REAL lângă override. EN lipsă → cade pe RO (ca `fallbackLng`).
 */
export function defaultText(lang: string, key: string): string {
  const primary = lang === 'en' ? en : ro;
  return lookupDotted(primary, key) ?? lookupDotted(ro, key) ?? '';
}
