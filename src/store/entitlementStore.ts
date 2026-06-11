import { create } from 'zustand';
import { billingConfigured, type ModuleId, type PackageId } from '../config/packages';
import { resolveEntitlement, type EntitlementStatus } from './entitlementLogic';
import { watchSubscription, type ActiveSubscription } from '../services/billing';
import { auth } from '../firebase';

/**
 * Starea de entitlement a clientului logat — portată din CNCVS, FĂRĂ trial.
 * Cache offline per-uid: ultimul abonament cunoscut e păstrat local, iar resolveEntitlement
 * îl re-evaluează contra ceasului — un plătitor rămâne activ offline până la finalul perioadei,
 * apoi se blochează (needsResync) până confirmă o resincronizare.
 */
const ENT_CACHE_PREFIX = 'dataread_ent_';

interface EntCache {
  subscription: ActiveSubscription | null;
  savedAt: number;
}

function loadEntCache(uid: string): EntCache | null {
  try {
    const raw = localStorage.getItem(ENT_CACHE_PREFIX + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as EntCache;
  } catch {
    return null; // JSON stricat / private mode — pornim fără cache, nu crăpăm (boot-smoke)
  }
}

function saveEntCache(uid: string, subscription: ActiveSubscription | null): void {
  try {
    localStorage.setItem(ENT_CACHE_PREFIX + uid, JSON.stringify({ subscription, savedAt: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}

// Self-heal pentru ID token: claim-ul `ent` e setat server-side (onSubscriptionWrite), dar
// ajunge în tokenul clientului doar la refresh. Când subscripția e activă dar tokenul curent
// nu are `ent.active`, forțăm UN refresh ca rules să permită scrierile fără să așteptăm TTL-ul.
const _tokenRefreshed = new Set<string>();
async function ensureClaimToken(uid: string): Promise<void> {
  if (_tokenRefreshed.has(uid)) return;
  _tokenRefreshed.add(uid);
  try {
    const res = await auth.currentUser?.getIdTokenResult();
    const ent = (res?.claims as { ent?: { active?: boolean } } | undefined)?.ent;
    if (!ent?.active) await auth.currentUser?.getIdToken(true);
  } catch {
    /* offline — resync-ul manual rămâne fallback */
  }
}

interface EntitlementState {
  ready: boolean;
  status: EntitlementStatus; // none | active | expired
  packageId: PackageId | null;
  modules: ModuleId[];
  subscription: ActiveSubscription | null;
  billingReady: boolean;
  needsResync: boolean;
  offline: boolean;

  _uid: string | null;
  _unsubSub: (() => void) | null;

  init: (uid: string) => void;
  reset: () => void;
  recompute: () => void;
  resync: () => Promise<void>;
  /** Modulul e activ pe abonamentul curent? (feature flag — principiul 2) */
  hasModule: (m: ModuleId) => boolean;
}

export const useEntitlementStore = create<EntitlementState>((set, get) => ({
  ready: false,
  status: 'none',
  packageId: null,
  modules: [],
  subscription: null,
  billingReady: billingConfigured(),
  needsResync: false,
  offline: false,

  _uid: null,
  _unsubSub: null,

  init: (uid) => {
    if (get()._uid === uid && get()._unsubSub) return; // deja atașat pentru acest cont
    get()._unsubSub?.();

    // 1) Hidratare din cache — răspuns corect imediat, chiar fără rețea.
    const cached = loadEntCache(uid);
    set({ _uid: uid, ready: false, offline: false, subscription: cached?.subscription ?? null });
    get().recompute();
    if (cached) set({ ready: true });

    // 2) Listener live. Pe update real → cache; pe eroare (offline/permisiuni) → PĂSTRĂM
    //    cache-ul (un plătitor nu cade la none), doar marcăm offline.
    const unsub = watchSubscription(
      uid,
      (sub) => {
        if (get()._uid !== uid) return;
        set({ subscription: sub, offline: false });
        get().recompute();
        saveEntCache(uid, sub);
        if (sub && (sub.status === 'active' || sub.status === 'trialing')) void ensureClaimToken(uid);
      },
      () => {
        if (get()._uid !== uid) return;
        set({ offline: true });
        get().recompute();
      }
    );
    set({ _unsubSub: unsub, ready: true });
  },

  reset: () => {
    get()._unsubSub?.();
    _tokenRefreshed.clear(); // self-heal-ul poate rula din nou după un sign-in proaspăt
    set({
      ready: true,
      status: 'none',
      packageId: null,
      modules: [],
      subscription: null,
      needsResync: false,
      offline: false,
      _uid: null,
      _unsubSub: null,
    });
    // Cache-ul per-uid rămâne intenționat — sign-in rapid/offline data viitoare.
  },

  recompute: () => {
    const { subscription, _uid } = get();
    const r = resolveEntitlement({
      uid: _uid,
      subscription: subscription
        ? {
            status: subscription.status,
            packageId: subscription.packageId,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
    });
    set({ status: r.status, packageId: r.packageId, modules: r.modules, needsResync: r.needsResync });
  },

  resync: async () => {
    const uid = get()._uid;
    if (!uid) return;
    // Refresh forțat de token: claim-ul `ent` proaspăt (ex. reînnoire petrecută offline).
    try {
      await auth.currentUser?.getIdToken(true);
    } catch {
      /* offline */
    }
    get()._unsubSub?.();
    set({ _unsubSub: null });
    get().init(uid);
  },

  hasModule: (m) => get().modules.includes(m),
}));

// Granițele de entitlement (finalul perioadei plătite) se evaluează contra ceasului doar la
// evenimente + init. Într-o sesiune lungă momentul ar putea trece neobservat — recompute
// periodic + la focus. Ieftin, idempotent, no-op când nu e nimeni logat.
if (typeof window !== 'undefined') {
  const reevaluate = () => {
    const st = useEntitlementStore.getState();
    if (st._uid) st.recompute();
  };
  setInterval(reevaluate, 60_000);
  window.addEventListener('focus', reevaluate);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reevaluate();
  });
}
