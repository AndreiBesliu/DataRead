import { create } from 'zustand';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  getAdditionalUserInfo,
  deleteUser,
  signOut as fbSignOut,
  type AuthError,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '../firebase';
import i18n from '../i18n';
import { track } from '../services/analytics';
import { ensureClientDoc } from '../services/clients';

/** La autentificare: creează/completează documentul de client + evenimentul de funnel.
 *  `consented` = acceptarea afirmativă a termenilor (checkbox-ul de signup). */
function onAuthed(cred: UserCredential, method: 'password' | 'google', consented: boolean): void {
  const isNew = getAdditionalUserInfo(cred)?.isNewUser ?? false;
  void ensureClientDoc(
    cred.user.uid,
    {
      email: cred.user.email,
      displayName: cred.user.displayName,
      locale: i18n.language === 'en' ? 'en' : 'ro',
    },
    { tosAccepted: consented }
  );
  track(isNew ? 'sign_up' : 'login', { method });
}

export interface Profile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthState {
  user: Profile | null;
  initializing: boolean;
  busy: boolean;
  /** Chei i18n — componentele randează t(error)/t(info) (regula: zero text hardcodat). */
  error: string | null;
  info: string | null;

  setUser: (u: Profile | null) => void;
  setInitializing: (b: boolean) => void;
  clearMessages: () => void;

  /** `consented` obligatoriu true ca să CREEZE cont nou via Google; altfel contul nou e anulat. */
  signInGoogle: (consented?: boolean) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

function friendlyErrorKey(e: unknown): string {
  const code = (e as AuthError)?.code ?? '';
  switch (code) {
    case 'auth/invalid-email': return 'auth.errors.invalidEmail';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'auth.errors.badCredentials';
    case 'auth/email-already-in-use': return 'auth.errors.emailInUse';
    case 'auth/weak-password': return 'auth.errors.weakPassword';
    case 'auth/popup-closed-by-user': return 'auth.errors.popupClosed';
    case 'auth/popup-blocked': return 'auth.errors.popupBlocked';
    case 'auth/operation-not-allowed': return 'auth.errors.notEnabled';
    case 'auth/too-many-requests': return 'auth.errors.tooMany';
    case 'auth/network-request-failed': return 'auth.errors.network';
    default: return 'auth.errors.generic';
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  busy: false,
  error: null,
  info: null,

  setUser: (u) => set({ user: u }),
  setInitializing: (b) => set({ initializing: b }),
  clearMessages: () => set({ error: null, info: null }),

  signInGoogle: async (consented) => {
    set({ busy: true, error: null, info: null });
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const isNew = getAdditionalUserInfo(cred)?.isNewUser ?? false;
      // Fără consimțământ afirmativ nu se creează SILENȚIOS cont nou (ex. user nou apăsând
      // Google din tabul de autentificare). Contul abia creat e anulat.
      if (isNew && !consented) {
        try {
          await deleteUser(cred.user);
        } catch {
          await fbSignOut(auth);
        }
        set({ error: 'auth.errors.needTerms' });
        return;
      }
      onAuthed(cred, 'google', !!consented);
    } catch (e) {
      set({ error: friendlyErrorKey(e) });
    } finally {
      set({ busy: false });
    }
  },

  signInEmail: async (email, password) => {
    set({ busy: true, error: null, info: null });
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      onAuthed(cred, 'password', false);
    } catch (e) {
      set({ error: friendlyErrorKey(e) });
    } finally {
      set({ busy: false });
    }
  },

  signUpEmail: async (email, password, displayName) => {
    set({ busy: true, error: null, info: null });
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName });
        set({
          user: {
            uid: cred.user.uid,
            displayName,
            email: cred.user.email,
            photoURL: cred.user.photoURL,
          },
        });
      }
      onAuthed(cred, 'password', true); // formularul de signup cere checkbox-ul de termeni
    } catch (e) {
      set({ error: friendlyErrorKey(e) });
    } finally {
      set({ busy: false });
    }
  },

  resetPassword: async (email) => {
    set({ busy: true, error: null, info: null });
    try {
      await sendPasswordResetEmail(auth, email.trim());
      set({ info: 'auth.resetSent' });
    } catch (e) {
      set({ error: friendlyErrorKey(e) });
    } finally {
      set({ busy: false });
    }
  },

  signOutUser: async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Sign out failed', e);
    }
  },
}));
