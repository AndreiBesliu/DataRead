/**
 * Cititor MEMOIZAT-pe-sesiune al documentelor `siteConfig/*` (temă / chrome / teme-pagină / conținut).
 *
 * De ce există: fiecare din aceste documente e cosmetic + PUBLIC-read și se schimbă rar (o publicare din
 * admin), dar hook-urile îl citeau la FIECARE montare — `usePagePublicTheme(slug)` avea dependența `[slug]`,
 * deci naviga → 2 `getDoc` noi de fiecare dată; chrome încă unul; Felia B a mai adăugat unul. Un vizitator
 * care vede 5 pagini plătea ~15 citiri pentru date identice. Aici colapsăm la CEL MULT o citire per document
 * pe toată sesiunea (indiferent câte pagini vizitează), memoizând PROMISIUNEA (nu doar rezultatul) — apeluri
 * concurente din mai multe hook-uri partajează același zbor.
 *
 * Sub automatizare (`navigator.webdriver`: prerender/boot) întoarce `null` FĂRĂ să atingă Firestore →
 * build-ul rămâne determinist, iar apelantul cade pe snapshotul copt (== prerender, fără hydration drift).
 * Best-effort: orice eșec (offline/interzis) → `null` memoizat (apelantul folosește snapshotul copt), fără
 * să blocheze paginile. Contract: NICIODATĂ nu aruncă.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type SiteConfigDocId = 'publicTheme' | 'publicChrome' | 'pageThemes' | 'pageContent';

const cache = new Map<SiteConfigDocId, Promise<unknown>>();

/** Citește (o singură dată pe sesiune) datele brute ale unui doc `siteConfig`. `null` = folosește snapshotul
 *  copt (automatizare, offline, doc inexistent). Datele brute trec prin `coerceTo*` la apelant, ca peste tot. */
export function getSiteConfigOnce(docId: SiteConfigDocId): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return Promise.resolve(null);
  const hit = cache.get(docId);
  if (hit) return hit;
  const p = getDoc(doc(db, 'siteConfig', docId))
    .then((snap) => (snap.exists() ? snap.data() : null))
    .catch(() => null); // eșecul e memoizat deliberat: nu re-lovim Firestore la fiecare navigare
  cache.set(docId, p);
  return p;
}

/** Uită tot ce s-a citit — DOAR pentru teste (memoizarea pe sesiune e intenționată în producție). */
export function resetSiteConfigCache(): void {
  cache.clear();
}
