/**
 * Felia B — override-urile de CONȚINUT publicate DUPĂ ultimul build, aduse la runtime.
 *
 * Tipar identic cu `usePublicTheme`/`usePublicChrome`: snapshot copt aplicat sincron la init-ul i18n
 * (deci primul render == HTML-ul prerandat, fără flash) + o singură citire `getDoc` post-mount care
 * suprascrie. Sub automatizare (`navigator.webdriver`: prerender/boot) NU citim — build-ul rămâne
 * determinist, iar textele coapte vin din snapshot.
 *
 * Se cheamă O SINGURĂ DATĂ pe sesiune (singleton la nivel de modul), nu la fiecare navigare —
 * altfel fiecare pagină publică ar mai costa o citire Firestore.
 */
import { useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import i18n from '../i18n';
import { applyRawContentOverrides } from '../i18n/contentOverride';

let started = false;

/** Citește `siteConfig/pageContent` o dată și aplică override-urile. Best-effort: orice eșec = textele coapte. */
export function ensureLiveContentOverrides(): void {
  if (started) return;
  if (typeof navigator !== 'undefined' && navigator.webdriver) return;
  started = true;
  getDoc(doc(db, 'siteConfig', 'pageContent'))
    .then((snap) => {
      // `bindI18nStore: 'added'` (src/i18n/index.ts) face componentele montate să se re-randeze aici.
      applyRawContentOverrides(i18n, snap.exists() ? snap.data() : null);
    })
    .catch(() => {
      /* offline / interzis → rămân textele coapte (i18n + snapshot) */
    });
}

/** Montat în SiteLayout (paginile publice) — zona în care conținutul editabil chiar se vede. */
export function useLiveContentOverrides(): void {
  useEffect(() => {
    ensureLiveContentOverrides();
  }, []);
}
