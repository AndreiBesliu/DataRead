import { isSupported, getAnalytics, logEvent, type Analytics } from 'firebase/analytics';
import { firebaseApp } from '../firebase';

/**
 * Analytics de funnel peste Firebase Analytics (GA4) — OPT-IN per GDPR. GA4 setează cookie-uri,
 * deci nimic nu se inițializează și niciun eveniment nu pleacă până nu acceptă explicit utilizatorul
 * (bannerul de consimțământ). Până la o alegere, evenimentele se BUFFER-uiesc (primul `landing_view`
 * nu se pierde dacă acceptă imediat după); la Accept se golesc, la Decline se aruncă și GA nu
 * pornește niciodată. Evenimentele NU conțin date personale.
 */
type Evt = { name: string; params?: Record<string, string | number | boolean> };

const CONSENT_KEY = 'dataread_cookie_consent';
const MAX_PENDING = 50;

let analytics: Analytics | null = null;
let started = false;
const pending: Evt[] = [];

export function cookieConsent(): 'granted' | 'denied' | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(value: 'granted' | 'denied'): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* ignore */
  }
  if (value === 'granted') void initAnalytics();
  else pending.length = 0; // refuzat: aruncă bufferul, GA nu pornește
}

export async function initAnalytics(): Promise<void> {
  if (started) return;
  if (cookieConsent() !== 'granted') return; // așteaptă opt-in explicit (GA folosește cookie-uri)
  started = true;
  try {
    if (await isSupported()) {
      analytics = getAnalytics(firebaseApp);
      for (const e of pending) {
        try {
          logEvent(analytics, e.name, e.params);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* analytics e best-effort */
  } finally {
    pending.length = 0;
  }
}

export function track(name: string, params?: Record<string, string | number | boolean>): void {
  try {
    if (analytics) {
      logEvent(analytics, name, params);
    } else if (cookieConsent() !== 'denied' && pending.length < MAX_PENDING) {
      pending.push({ name, params }); // buffer până decide utilizatorul (golit la Accept)
    }
  } catch {
    /* telemetria nu are voie să strice aplicația */
  }
}
