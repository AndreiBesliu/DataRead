/**
 * DataRead — backend central (Cloud Functions).
 *
 * Secțiuni (principiul: un singur nucleu, module independente):
 *   [1] Admin claims      — admins/{uid} → custom claim `admin` (panoul /admin)
 *   [2] Entitlements      — customers/{uid}/subscriptions (extensia Stripe) → claim `ent`
 *                           + mirror în clients/{uid}.entitlement
 *   [3] AI (felia 2)      — REZERVAT: callables Verticala 1 (aiGenerateCampaign, …)
 *
 * Runtime: Node 20, Gen-2. REGIUNEA e trecută EXPLICIT pe fiecare trigger (lecția CNCVS:
 * fără ea, deploy-ul merge tăcut în us-central1 și callables-urile pică cu "internal").
 * Deploy:  firebase deploy --only functions   (cere planul Blaze)
 */
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const REGION = 'europe-central2'; // trebuie să coincidă cu VITE_FIREBASE_FUNCTIONS_REGION + extensia Stripe

// ───────────────────────── [1] Admin: admins/{uid} → claim `admin` ─────────────────────────
// Documentul admins/{uid} se creează DOAR din consolă/Admin SDK (rules: write false pentru
// client). Crearea lui acordă claim-ul; ștergerea îl revocă. Clientul își reîmprospătează
// tokenul (getIdToken(true)) ca să vadă claim-ul — AdminHome face asta o dată automat.

async function recomputeAdminClaim(uid) {
  const snap = await admin.firestore().collection('admins').doc(uid).get();
  const isAdmin = snap.exists;
  const user = await admin.auth().getUser(uid);
  await admin.auth().setCustomUserClaims(uid, Object.assign({}, user.customClaims || {}, { admin: isAdmin }));
  logger.info('admin claim recomputed', { uid, admin: isAdmin });
}

exports.onAdminWrite = onDocumentWritten({ document: 'admins/{uid}', region: REGION }, async (event) => {
  try {
    await recomputeAdminClaim(event.params.uid);
  } catch (err) {
    logger.error('recomputeAdminClaim failed', { uid: event.params.uid, err: String(err) });
  }
});

// ──────────── [2] Entitlements: customers/{uid}/subscriptions → claim `ent` + mirror ────────────
// Extensia firestore-stripe-payments scrie subscripțiile; la orice schimbare recalculăm
// entitlement-ul și: (1) setăm claim-ul `ent` (citit de Firestore Rules + client) și
// (2) îl oglindim în clients/{uid}.entitlement pentru citiri în timp real (dashboard + /admin).
// FĂRĂ trial în DataRead — statusurile relevante sunt doar cele ale abonamentului plătit.

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

/** Stripe `current_period_end` poate fi Timestamp Firestore sau număr unix-seconds. → ms. */
function periodEndMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number') return v * 1000;
  return 0;
}

async function recomputeEntitlement(uid) {
  const db = admin.firestore();
  const subs = await db.collection('customers').doc(uid).collection('subscriptions').get();

  // Subscripția activă cu perioada cea mai lungă (în caz de duplicate).
  let best = null;
  subs.forEach((d) => {
    const s = d.data() || {};
    if (!ACTIVE_STATUSES.has(s.status)) return;
    const cand = {
      status: s.status,
      periodEnd: periodEndMs(s.current_period_end),
      priceId: (s.price && s.price.id) || (s.items && s.items[0] && s.items[0].price && s.items[0].price.id) || null,
      cancelAtPeriodEnd: !!s.cancel_at_period_end,
    };
    if (!best || cand.periodEnd > best.periodEnd) best = cand;
  });

  const now = Date.now();
  const ent = best
    ? { active: best.periodEnd > now, status: best.status, periodEnd: best.periodEnd, priceId: best.priceId }
    : { active: false, status: 'none', periodEnd: 0, priceId: null };

  // 1) Custom claim (merge — nu suprascrie alte claims, ex. `admin`). Claims max ~1000 bytes.
  const user = await admin.auth().getUser(uid);
  await admin.auth().setCustomUserClaims(uid, Object.assign({}, user.customClaims || {}, { ent }));

  // 2) Mirror în timp real pe documentul de client (dashboard + /admin + audit).
  await db.collection('clients').doc(uid).set(
    { entitlement: Object.assign({}, ent, { updatedAt: admin.firestore.FieldValue.serverTimestamp() }) },
    { merge: true }
  );

  logger.info('entitlement recomputed', { uid, active: ent.active, status: ent.status, periodEnd: ent.periodEnd });
}

exports.onSubscriptionWrite = onDocumentWritten(
  { document: 'customers/{uid}/subscriptions/{subId}', region: REGION },
  async (event) => {
    try {
      await recomputeEntitlement(event.params.uid);
    } catch (err) {
      logger.error('recomputeEntitlement failed', { uid: event.params.uid, err: String(err) });
    }
  }
);

// ───────────────────────── [3] AI — Verticala 1 (felia 2, REZERVAT) ─────────────────────────
// Aici intră callables-urile AI, FĂRĂ restructurare:
//   const { onCall, HttpsError } = require('firebase-functions/v2/https');
//   const { defineSecret } = require('firebase-functions/params');
//   const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');   // setat de Andrei, Secret Manager
//   exports.aiGenerateCampaign = onCall({ region: REGION, secrets: [ANTHROPIC_API_KEY] }, …)
// Reguli: cheia NU atinge niciodată clientul; quota per utilizator în aiUsage/{uid};
// endpoint-urile din spec (/ai/generate, /campaign/generate) devin callables.
