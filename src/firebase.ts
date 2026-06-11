import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
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
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// Cloud Functions (callables + extensia Stripe). TREBUIE să coincidă cu regiunea în care sunt
// deployate functions-urile/extensia — un callable invocat pe regiunea greșită eșuează cu
// "internal". Configurabil prin VITE_FIREBASE_FUNCTIONS_REGION; default-ul proiectului:
// europe-central2.
const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'europe-central2';
export const functions = getFunctions(firebaseApp, functionsRegion);

// Utilizatorul rămâne logat între lansări.
setPersistence(auth, browserLocalPersistence).catch((e) => {
  console.warn('Auth persistence setup failed:', e);
});

// App Check (opțional): atestă cererile prin reCAPTCHA v3. Inert până se setează
// VITE_RECAPTCHA_V3_KEY, deci dev/build-urile neconfigurate nu sunt afectate. Când Andrei adaugă
// cheia, se activează și enforcement-ul din consolă pentru functions/Firestore.
const appCheckKey = import.meta.env.VITE_RECAPTCHA_V3_KEY as string | undefined;
if (appCheckKey && typeof window !== 'undefined') {
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
