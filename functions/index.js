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
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const REGION = 'europe-central2'; // trebuie să coincidă cu VITE_FIREBASE_FUNCTIONS_REGION + extensia Stripe

// Primul admin al platformei (Andrei) — singura cerere auto-aprobată, și DOAR cât timp nu există
// niciun admin. Orice alt acces la backend trece prin fluxul de cereri + aprobare.
const BOOTSTRAP_ADMIN_UID = 'IMBKFBkONkOB7VVZCmqgS90JdBi2';

// ───────────────────────── [1] Admin: admins/{uid} → claim `admin` ─────────────────────────
// Documentul admins/{uid} se creează DOAR din consolă/Admin SDK (rules: write false pentru
// client). Crearea lui acordă claim-ul; ștergerea îl revocă. Clientul își reîmprospătează
// tokenul (getIdToken(true)) ca să vadă claim-ul — AdminHome face asta o dată automat.

async function recomputeAdminClaim(uid) {
  const db = admin.firestore();
  const snap = await db.collection('admins').doc(uid).get();
  const isAdmin = snap.exists;
  const user = await admin.auth().getUser(uid);
  await admin.auth().setCustomUserClaims(uid, Object.assign({}, user.customClaims || {}, { admin: isAdmin }));
  // Oglindește rezolvarea pe cererea de acces (dacă există) — auditul fluxului de aprobare.
  await db.collection('adminRequests').doc(uid).set(
    { status: isAdmin ? 'approved' : 'revoked', resolvedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  logger.info('admin claim recomputed', { uid, admin: isAdmin });
}

exports.onAdminWrite = onDocumentWritten({ document: 'admins/{uid}', region: REGION }, async (event) => {
  try {
    await recomputeAdminClaim(event.params.uid);
  } catch (err) {
    logger.error('recomputeAdminClaim failed', { uid: event.params.uid, err: String(err) });
  }
});

// Bootstrap-ul primului admin: când UID-ul de bootstrap își înregistrează cererea (prima vizită
// pe /admin) și încă NU există niciun admin, cererea e auto-aprobată — crearea admins/{uid}
// declanșează onAdminWrite, care setează claim-ul și marchează cererea ca aprobată.
exports.onAdminRequestCreated = onDocumentCreated({ document: 'adminRequests/{uid}', region: REGION }, async (event) => {
  try {
    const uid = event.params.uid;
    if (uid !== BOOTSTRAP_ADMIN_UID) return;
    const db = admin.firestore();
    const existing = await db.collection('admins').limit(1).get();
    if (!existing.empty) return; // bootstrap-ul rulează o singură dată, pe platforma fără admini
    await db.collection('admins').doc(uid).set({
      approvedBy: 'bootstrap',
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info('bootstrap admin approved', { uid });
  } catch (err) {
    logger.error('bootstrap admin failed', { uid: event.params.uid, err: String(err) });
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

// ───────────────────────── [3] AI — Verticala 1 Marketing AI ─────────────────────────
// Callable-ul aiGenerateCampaign: citește lead-ul + cererea SERVER-SIDE, cere modelului Claude
// un pachet de livrabile (texte reclame / scripturi video / structură campanie Meta) cu ieșire
// structurată garantată de schemă, și le scrie înapoi pe cerere (source: 'ai'). Cheia trăiește
// EXCLUSIV în Secret Manager; quota lunară per operator în aiUsage/{uid}.
//
// ACTIVARE (după ce Andrei rotește cheia): 1) `firebase functions:secrets:set ANTHROPIC_API_KEY`
// 2) AI_ENABLED = true mai jos  3) `npm run deploy:functions`. Cu AI_ENABLED=false, callable-ul
// nu e exportat, deci deploy-ul nu cere secretul.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const AI_ENABLED = false; // ← flip pe true după functions:secrets:set ANTHROPIC_API_KEY

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const AI_MODEL = 'claude-opus-4-8'; // cel mai capabil model disponibil (vezi CLAUDE.md → AI)
const AI_MONTHLY_LIMIT = 200; // generări/lună per operator — generos, dar nu nelimitat

// Schema livrabilelor — output_config.format garantează JSON valid pe această formă.
const CAMPAIGN_SCHEMA = {
  type: 'object',
  properties: {
    adTexts: {
      type: 'string',
      description: '3-5 variante de texte de reclamă Meta în română, fiecare cu hook, corp și CTA, separate clar.',
    },
    videoScripts: {
      type: 'string',
      description: '2 scripturi de video scurt (15-30s, Reels/TikTok) în română, cu indicații de cadre și text pe ecran.',
    },
    campaignStructure: {
      type: 'string',
      description: 'Structura campaniei Meta în română: obiectiv, ad set-uri cu audiențe/targeting/plasamente și împărțirea bugetului.',
    },
  },
  required: ['adTexts', 'videoScripts', 'campaignStructure'],
  additionalProperties: false,
};

const OBJECTIVE_RO = { leads: 'lead-uri / cereri de ofertă', sales: 'vânzări online', awareness: 'notorietate / brand', traffic: 'trafic pe site', other: 'alt obiectiv' };

function buildCampaignPrompt(lead, req) {
  const l = lead || {};
  const r = req || {};
  const objectives = Array.isArray(l.objectives) ? l.objectives.map((o) => OBJECTIVE_RO[o] || o).join(', ') : '';
  return [
    'Pregătește livrabilele unei campanii de marketing pentru clientul de mai jos.',
    '',
    '== FIRMA CLIENTULUI ==',
    `Nume: ${l.companyName || '-'}`,
    `Industrie: ${l.industry || '-'}${l.industryOther ? ` (${l.industryOther})` : ''}`,
    `Descriere și public țintă: ${l.description || '-'}`,
    `Website: ${l.website || '-'}`,
    `Social: ${[l.facebook, l.instagram, l.tiktok].filter(Boolean).join(', ') || '-'}`,
    `Obiectivele declarate ale firmei: ${objectives || '-'}`,
    '',
    '== CEREREA DE CAMPANIE ==',
    `Titlu: ${r.title || '-'}`,
    `Oferta / produsul promovat: ${r.offer || '-'}`,
    `Buget: ${r.budget || 'nespecificat'}`,
    `Obiectivul campaniei: ${OBJECTIVE_RO[r.objective] || r.objective || '-'}`,
    '',
    'Cerințe: totul în limba ROMÂNĂ, concret și gata de folosit (fără placeholder-e), adaptat',
    'firmei și ofertei de mai sus. Textele de reclamă scurte și percutante, conforme cu politicile',
    'Meta. Structura campaniei realistă pentru bugetul dat.',
  ].join('\n');
}

/** Quota lunară per operator (tranzacție pe aiUsage/{uid}). Aruncă resource-exhausted la depășire. */
async function consumeAiQuota(uid) {
  const month = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const ref = admin.firestore().collection('aiUsage').doc(uid);
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const count = data.month === month ? data.count || 0 : 0;
    if (count >= AI_MONTHLY_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Limita lunară de generări AI a fost atinsă.');
    }
    tx.set(ref, { month, count: count + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
}

if (AI_ENABLED) {
  exports.aiGenerateCampaign = onCall(
    { region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' },
    async (request) => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Autentificare necesară.');
      if (request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Doar operatorii pot genera campanii.');
      }
      const { leadId, requestId } = request.data || {};
      if (typeof leadId !== 'string' || !leadId || typeof requestId !== 'string' || !requestId) {
        throw new HttpsError('invalid-argument', 'leadId și requestId sunt obligatorii.');
      }

      await consumeAiQuota(request.auth.uid);

      // Datele vin din Firestore, nu din client — clientul trimite doar ID-uri.
      const db = admin.firestore();
      const reqRef = db.collection('leads').doc(leadId).collection('requests').doc(requestId);
      const [leadSnap, reqSnap] = await Promise.all([db.collection('leads').doc(leadId).get(), reqRef.get()]);
      if (!leadSnap.exists) throw new HttpsError('not-found', 'Lead-ul nu există.');
      if (!reqSnap.exists) throw new HttpsError('not-found', 'Cererea nu există.');

      // Import leneș: SDK-ul se încarcă doar în containerul acestui callable.
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

      let response;
      try {
        response = await client.messages.create({
          model: AI_MODEL,
          max_tokens: 16000,
          thinking: { type: 'adaptive' },
          system:
            'Ești strategul de marketing și copywriterul senior al agenției DataRead. Scrii pentru ' +
            'firme mici și mijlocii din România: concret, persuasiv, fără jargon corporatist gol.',
          output_config: { format: { type: 'json_schema', schema: CAMPAIGN_SCHEMA } },
          messages: [{ role: 'user', content: buildCampaignPrompt(leadSnap.data(), reqSnap.data()) }],
        });
      } catch (err) {
        logger.error('anthropic call failed', { err: String(err) });
        throw new HttpsError('internal', 'Generarea AI a eșuat. Reîncearcă în câteva momente.');
      }

      if (response.stop_reason === 'refusal') {
        throw new HttpsError('failed-precondition', 'Modelul a refuzat cererea — reformulează oferta.');
      }
      const text = (response.content.find((b) => b.type === 'text') || {}).text || '';
      let out;
      try {
        out = JSON.parse(text);
      } catch (err) {
        logger.error('ai response unparsable', { stop: response.stop_reason });
        throw new HttpsError('internal', 'Răspunsul AI nu a putut fi interpretat. Reîncearcă.');
      }

      const deliverables = {
        adTexts: String(out.adTexts || '').slice(0, 8000),
        videoScripts: String(out.videoScripts || '').slice(0, 8000),
        campaignStructure: String(out.campaignStructure || '').slice(0, 8000),
      };

      // set + merge pe căi imbricate: notele scrise manual rămân neatinse.
      await reqRef.set(
        {
          deliverables,
          source: 'ai',
          status: 'open',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          aiGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
          aiGeneratedBy: request.auth.uid,
        },
        { merge: true }
      );

      logger.info('campaign generated', { leadId, requestId, by: request.auth.uid, usage: response.usage });
      return { deliverables };
    }
  );
}
