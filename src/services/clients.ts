import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { CLIENT_SCHEMA, coerceToClientProfile, type ClientProfile } from '../types/client';

/** Creează documentul clients/{uid} dacă lipsește (idempotent). `tosAccepted` ștampilează
 *  acordul cu termenii — venit din checkbox-ul de la crearea contului. */
export async function ensureClientDoc(
  uid: string,
  info: { email: string | null; displayName: string | null; locale?: 'ro' | 'en' },
  opts?: { tosAccepted?: boolean }
): Promise<void> {
  try {
    const ref = doc(db, 'clients', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        schema: CLIENT_SCHEMA,
        email: info.email,
        displayName: info.displayName,
        locale: info.locale ?? 'ro',
        onboardingStatus: 'none',
        createdAt: serverTimestamp(),
        tosAcceptedAt: opts?.tosAccepted ? serverTimestamp() : null,
      });
      return;
    }
    // Cont creat de fluxul de auth-init înainte ca fluxul de signup să apuce să ștampileze ToS.
    if (opts?.tosAccepted && snap.data()?.tosAcceptedAt == null) {
      await updateDoc(ref, { tosAcceptedAt: serverTimestamp() });
    }
  } catch (e) {
    // Firestore indisponibil (ex. baza încă necreată) — contul de auth merge înainte; documentul
    // se creează la următorul login. Nu blocăm UI-ul.
    console.warn('ensureClientDoc failed:', e);
  }
}

/** Abonare în timp real la profilul clientului — TOT ce iese trece prin coerce. */
export function watchClientProfile(uid: string, cb: (p: ClientProfile | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'clients', uid),
    (snap) => cb(coerceToClientProfile(snap.data())),
    (err) => {
      console.warn('watchClientProfile error:', err);
      cb(null);
    }
  );
}

/** Marchează onboarding-ul trimis pe documentul de profil (mirror pentru liste/admin). */
export async function markOnboardingSubmitted(uid: string): Promise<void> {
  await updateDoc(doc(db, 'clients', uid), { onboardingStatus: 'submitted' });
}
