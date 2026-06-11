/**
 * Layerul de billing — vorbește cu extensia Firebase „Run Payments with Stripe"
 * (firestore-stripe-payments). Portat din CNCVS, FĂRĂ trial.
 *
 * Extensia gestionează documentele:
 *   customers/{uid}                          (mirror client Stripe)
 *   customers/{uid}/checkout_sessions/{id}   (noi creăm; extensia completează `url`)
 *   customers/{uid}/subscriptions/{id}       (extensia scrie; status/price)
 *
 * Totul e defensiv: fără extensie instalată, query-urile întorc gol și platforma rulează cu
 * CTA „Contactează-ne" (integrările externe nu sunt dependențe critice — principiul 4).
 */
import {
  addDoc,
  collection,
  collectionGroup,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { resolvePackageByPriceId, type PackageId } from '../config/packages';

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

/** Unde sincronizează extensia produsele + prețurile (default 'products'). */
const PRODUCTS_COLLECTION = env.VITE_STRIPE_PRODUCTS_COLLECTION || 'products';

/** Callable-ul de portal al extensiei (numele default al instanței). */
const PORTAL_FN_NAME = env.VITE_STRIPE_PORTAL_FN || 'ext-firestore-stripe-payments-createPortalLink';

export interface LivePrice {
  amount: number;
  currency: string;
  interval?: string;
}

/**
 * Prețurile live sincronizate de extensie la `{products}/{id}/prices/{priceId}` —
 * map priceId → { amount (unități majore), currency }. Gol la orice eșec (offline, extensie
 * neinstalată), iar UI-ul cade pe sumele statice din config/packages.ts.
 */
export async function fetchLivePrices(): Promise<Record<string, LivePrice>> {
  const out: Record<string, LivePrice> = {};
  const add = (id: string, d: Record<string, unknown> | undefined) => {
    if (!d || d.active === false) return;
    if (d.type === 'one_time') return; // pachetele sunt doar abonamente
    const cents = typeof d.unit_amount === 'number' ? d.unit_amount : null;
    if (cents == null) return;
    const interval = (d.interval as string | undefined) ?? (d.recurring as { interval?: string } | undefined)?.interval;
    out[id] = { amount: cents / 100, currency: (d.currency as string) || 'eur', interval };
  };
  // Preferat: UN singur collectionGroup peste toate documentele `prices` — prinde și prețurile
  // cu părinte-fantomă (extensia poate lăsa așa ceva când au venit doar evenimente price.*).
  try {
    const cg = await getDocs(collectionGroup(db, 'prices'));
    cg.forEach((pr) => add(pr.id, pr.data() as Record<string, unknown>));
    return out;
  } catch (e) {
    console.warn('collectionGroup(prices) indisponibil — fallback per-produs:', (e as Error).message);
  }
  // Fallback: iterăm produsele listabile (ratează prețurile cu părinte-fantomă).
  try {
    const products = await getDocs(query(collection(db, PRODUCTS_COLLECTION), where('active', '==', true)));
    await Promise.all(
      products.docs.map(async (p) => {
        try {
          const prices = await getDocs(collection(p.ref, 'prices'));
          prices.forEach((pr) => add(pr.id, pr.data() as Record<string, unknown>));
        } catch {
          /* prețurile unui produs ilizibile — sărim */
        }
      })
    );
  } catch (e) {
    console.warn('Nu am putut citi prețurile live (folosim config-ul static):', (e as Error).message);
  }
  return out;
}

export interface ActiveSubscription {
  packageId: PackageId | null;
  status: string; // 'active' | 'trialing' | 'past_due' | …
  priceId: string | null;
  currentPeriodEnd: number | null; // ms
  cancelAtPeriodEnd: boolean;
}

/**
 * Ascultă subscripția activă Stripe a clientului. Întoarce funcția de dezabonare.
 * `onError` lasă apelantul să PĂSTREZE entitlement-ul din cache (un plătitor nu e
 * retrogradat la `none` doar pentru că suntem offline).
 */
export function watchSubscription(
  uid: string,
  cb: (sub: ActiveSubscription | null) => void,
  onError?: () => void
): () => void {
  try {
    const q = query(collection(db, 'customers', uid, 'subscriptions'), where('status', 'in', ['active', 'trialing']));
    return onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          cb(null);
          return;
        }
        // Dacă există mai multe, alegem pachetul cel mai mare.
        const rank: Record<string, number> = { start: 1, growth: 2, premium: 3 };
        let best: ActiveSubscription | null = null;
        snap.forEach((d) => {
          const data = d.data();
          const priceId: string | null = data.price?.id ?? data.items?.[0]?.price?.id ?? null;
          const pkg = resolvePackageByPriceId(priceId);
          // `current_period_end` poate fi Timestamp sau unix-seconds, în funcție de versiunea
          // extensiei — tratăm ambele (un .toMillis() pe număr ar arunca și am pierde subscripția).
          const pe = data.current_period_end as { toMillis?: () => number } | number | undefined;
          const currentPeriodEnd =
            pe && typeof (pe as { toMillis?: () => number }).toMillis === 'function'
              ? (pe as { toMillis: () => number }).toMillis()
              : typeof pe === 'number'
                ? pe * 1000
                : null;
          const candidate: ActiveSubscription = {
            packageId: pkg?.id ?? null,
            status: data.status ?? 'active',
            priceId,
            currentPeriodEnd,
            cancelAtPeriodEnd: !!data.cancel_at_period_end,
          };
          if (!best || (rank[candidate.packageId ?? ''] ?? 0) > (rank[best.packageId ?? ''] ?? 0)) {
            best = candidate;
          }
        });
        cb(best);
      },
      (err) => {
        console.warn('Subscription listener error (păstrăm cache-ul):', err.message);
        if (onError) onError();
        else cb(null);
      }
    );
  } catch (e) {
    console.warn('Nu am putut atașa listenerul de subscripție:', e);
    cb(null);
    return () => {};
  }
}

/**
 * Pornește o sesiune Stripe Checkout pentru un preț și întoarce URL-ul de redirect.
 * Scriem un doc în checkout_sessions, iar extensia îl completează cu `url`.
 */
export async function createCheckoutSession(uid: string, priceId: string): Promise<string> {
  const origin = window.location.origin;
  const ref = await addDoc(collection(db, 'customers', uid, 'checkout_sessions'), {
    price: priceId,
    mode: 'subscription',
    allow_promotion_codes: true,
    success_url: `${origin}/app?checkout=success`,
    cancel_url: `${origin}/pachete?checkout=cancel`,
  });

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error('Checkout timed out — este extensia Stripe instalată și configurată?'));
    }, 30000);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (!data) return;
      if (data.error) {
        clearTimeout(timeout);
        unsub();
        reject(new Error(data.error.message ?? 'Stripe nu a putut porni checkout-ul.'));
      }
      if (data.url) {
        clearTimeout(timeout);
        unsub();
        resolve(data.url as string);
      }
    });
  });
}

/** Deschide portalul de client Stripe (gestionare/anulare abonament). Întoarce URL-ul. */
export async function createPortalLink(): Promise<string> {
  const fn = httpsCallable<{ returnUrl: string }, { url: string }>(functions, PORTAL_FN_NAME);
  const { data } = await fn({ returnUrl: `${window.location.origin}/app` });
  return data.url;
}
