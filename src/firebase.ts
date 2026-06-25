import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, initializeAuth, inMemoryPersistence, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

/**
 * Inițializarea Firebase. Config-ul vine din VITE_FIREBASE_* (.env.local / .env.example),
 * inlined la build de Vite.
 *
 * Notă: config-ul Firebase Web SDK NU e secret — ajunge în bundle prin design. Controlul de
 * acces e impus de Security Rules + App Check, nu de ascunderea acestor valori.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);

// „Context de preview" = iframe-ul de previzualizare live din /admin (URL cu `?preview=1`, întotdeauna
// încadrat — window.top ≠ window.self). E același ORIGIN ca /admin, deci ar partaja sesiunea Firebase Auth
// (browserLocalPersistence = IndexedDB partajat). CAUZA bug-ului „publici → te scoate la login": o A DOUA
// instanță Auth pornește în iframe la fiecare remount (reloadPreview bumpează key), face un
// initializeCurrentUser()/reload() pe sesiunea PARTAJATĂ și o poate ȘTERGE, iar ștergerea se sincronizează
// în tab-ul părinte /admin → operatorul ajunge delogat. Remediu (închide TOATE mecanismele, indiferent de
// enforcement-ul App Check): în contextul de preview dăm Auth o persistență IN-MEMORY proprie (izolată — NU
// citește/șterge sesiunea operatorului) ȘI sărim App Check (a doua instanță reCAPTCHA contează degeaba).
const isPreviewContext =
  typeof window !== 'undefined' &&
  (new URLSearchParams(window.location.search).get('preview') === '1' || window.self !== window.top);

// App Check (reCAPTCHA v3) — inițializat ÎNAINTE de auth/firestore/functions, ca SDK-ul să atașeze
// token-ul App Check de la PRIMA cerere. Altfel listener-ele Firestore pornesc la boot înainte de
// inițializarea App Check și pleacă fără token (→ 0% verified pe Firestore, deși Auth, care apelează la
// login mai târziu, e 100%). Inert până se setează VITE_RECAPTCHA_V3_KEY. `navigator.webdriver` = true sub
// automatizare (Playwright: prerender + boot-smoke) → sărim init-ul, altfel reCAPTCHA aruncă headless
// „placeholder must be empty". În iframe-ul de preview (isPreviewContext) NU inițializăm App Check (a doua
// instanță pe același domeniu). Utilizatorii reali top-level (webdriver=false, ne-încadrați) primesc App Check normal.
const appCheckKey = import.meta.env.VITE_RECAPTCHA_V3_KEY as string | undefined;
if (appCheckKey && typeof window !== 'undefined' && !navigator.webdriver && !isPreviewContext) {
  try {
    if (import.meta.env.DEV) {
      // Lasă originul de dev să treacă App Check (tokenul de debug se înregistrează în consolă).
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(appCheckKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn('App Check init failed:', e);
  }
}

// În contextul de preview, Auth folosește persistență IN-MEMORY (izolată de sesiunea operatorului din
// tab-ul /admin) → iframe-ul NU poate citi/șterge sesiunea partajată. Top-level = getAuth normal
// (browserLocalPersistence, setată mai jos). initializeAuth trebuie apelat ÎNAINTE de orice getAuth pe app.
export const auth = isPreviewContext
  ? initializeAuth(firebaseApp, { persistence: inMemoryPersistence })
  : getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// Cloud Functions (callables + extensia Stripe). TREBUIE să coincidă cu regiunea în care sunt
// deployate functions-urile/extensia — un callable invocat pe regiunea greșită eșuează cu
// "internal". Configurabil prin VITE_FIREBASE_FUNCTIONS_REGION; default-ul proiectului:
// europe-central2.
const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'europe-central2';
export const functions = getFunctions(firebaseApp, functionsRegion);

// Utilizatorul rămâne logat între lansări — DOAR în contextul top-level. În iframe-ul de preview Auth e
// deja in-memory (izolat); a seta browserLocalPersistence acolo ar reataca sesiunea partajată a operatorului.
if (!isPreviewContext) {
  setPersistence(auth, browserLocalPersistence).catch((e) => {
    console.warn('Auth persistence setup failed:', e);
  });
}
