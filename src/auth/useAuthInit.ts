import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import i18n from '../i18n';
import { useAuthStore } from '../store/authStore';
import { ensureClientDoc } from '../services/clients';

/** Sincronizează starea Firebase Auth în store, o singură dată, din rădăcina aplicației.
 *  La login se asigură (idempotent) că documentul clients/{uid} există. */
export function useAuthInit(): void {
  const setUser = useAuthStore((s) => s.setUser);
  const setIsAdmin = useAuthStore((s) => s.setIsAdmin);
  const setInitializing = useAuthStore((s) => s.setInitializing);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      setUser(
        u
          ? { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL }
          : null
      );
      setInitializing(false);
      if (u) {
        void ensureClientDoc(u.uid, {
          email: u.email,
          displayName: u.displayName,
          locale: i18n.language === 'en' ? 'en' : 'ro',
        });
        // Claim-ul `admin` din token → arată/ascunde linkul spre /admin în antet. Eșec → non-admin
        // (gardul real e oricum în AdminHome + rules, asta e doar afișare).
        u.getIdTokenResult()
          .then((tok) => setIsAdmin(tok.claims.admin === true))
          .catch(() => setIsAdmin(false));
      } else {
        setIsAdmin(false);
      }
    });
    return off;
  }, [setUser, setIsAdmin, setInitializing]);
}
