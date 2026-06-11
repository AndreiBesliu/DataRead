import { track, cookieConsent } from './analytics';

/**
 * Colectorul de erori. Orice eroare prinsă merge în consolă; cu consimțământ acordat este și
 * (1) numărată în GA după nume și (2) depusă ca raport de crash în Firestore (`errorReports`),
 * ca un crash de pe mașina unui client să fie diagnosticabil din consolă fără să-i cerem DevTools.
 * CONFIDENȚIALITATE: rapoartele conțin numele/mesajul/capul de stack al erorii + identitatea
 * build-ului — niciodată date de client, conținut sau identificatori de cont — și doar după
 * același opt-in explicit care guvernează analytics. Rules fac colecția create-only cu validare.
 */
export function reportError(err: unknown, ctx?: Record<string, string | undefined>): void {
  const e = err instanceof Error ? err : new Error(String(err));
  // eslint-disable-next-line no-console
  console.error('[DataRead error]', e, ctx ?? {});
  try {
    track('app_error', { name: e.name || 'Error' });
  } catch {
    /* analytics e opțional/opt-in */
  }
  void sendCrashReport(e, ctx);
}

// Un raport per eroare distinctă per sesiune, puține per sesiune în total — un crash în buclă de
// render sau o rețea instabilă nu pot spama colecția.
const reported = new Set<string>();
let sent = 0;
const MAX_REPORTS_PER_SESSION = 5;

async function sendCrashReport(e: Error, ctx?: Record<string, string | undefined>): Promise<void> {
  try {
    if (!import.meta.env.PROD) return; // crash-urile din dev sunt vizibile local
    if (cookieConsent() !== 'granted') return; // același opt-in GDPR ca analytics
    const key = `${e.name}|${e.message}`.slice(0, 200);
    if (reported.has(key) || sent >= MAX_REPORTS_PER_SESSION) return;
    reported.add(key);
    sent++;
    // Import leneș: raportarea de erori rămâne dependency-light și nu afectează ordinea de boot.
    const [{ db }, { addDoc, collection, serverTimestamp }] = await Promise.all([
      import('../firebase'),
      import('firebase/firestore'),
    ]);
    await addDoc(collection(db, 'errorReports'), {
      name: (e.name || 'Error').slice(0, 80),
      message: (e.message || '').slice(0, 300),
      stack: (e.stack || '').split('\n').slice(0, 4).join('\n').slice(0, 600),
      kind: (ctx?.kind ?? (ctx?.componentStack ? 'react' : 'unknown')).slice(0, 40),
      version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
      build: typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'local',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
      lang: typeof navigator !== 'undefined' ? (navigator.language || '').slice(0, 20) : '',
      at: serverTimestamp(),
    });
  } catch {
    /* raportarea e best-effort — nu are voie să arunce dintr-o cale de eroare */
  }
}

let installed = false;
/** Prinde o singură dată, app-wide, erorile și promise rejection-urile altfel nehandle-uite. */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message, { kind: 'window.error' }));
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason, { kind: 'unhandledrejection' }));
}
