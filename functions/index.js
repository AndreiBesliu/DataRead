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

const AI_ENABLED = true; // activat 12.06.2026 — ANTHROPIC_API_KEY e în Secret Manager (v1)

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

// Schema planului de conținut (cereri kind: 'content' — spec 5.6 Content Planner).
const CONTENT_SCHEMA = {
  type: 'object',
  properties: {
    calendar: {
      type: 'string',
      description:
        'Calendar de conținut pe 30 de zile în română, cu 12-15 zile active de postare (ritm sustenabil): pe fiecare linie „Ziua N: temă — format (poză/reel/carusel/text) — canal".',
    },
    posts: {
      type: 'string',
      description:
        '8 postări complete în română, gata de publicat, numerotate și aliniate cu calendarul: textul postării + hashtag-uri + sugestie de vizual.',
    },
    ideas: {
      type: 'string',
      description: '12 idei suplimentare de conținut în română, câte una pe linie, specifice firmei și industriei.',
    },
  },
  required: ['calendar', 'posts', 'ideas'],
  additionalProperties: false,
};

// Câmpurile de livrabile completate de AI, per tip de cerere.
const KIND_FIELDS = {
  campaign: ['adTexts', 'videoScripts', 'campaignStructure'],
  content: ['calendar', 'posts', 'ideas'],
};

const OBJECTIVE_RO = { leads: 'lead-uri / cereri de ofertă', sales: 'vânzări online', awareness: 'notorietate / brand', traffic: 'trafic pe site', other: 'alt obiectiv' };

function leadContextBlock(lead) {
  const l = lead || {};
  const objectives = Array.isArray(l.objectives) ? l.objectives.map((o) => OBJECTIVE_RO[o] || o).join(', ') : '';
  return [
    '== FIRMA CLIENTULUI ==',
    `Nume: ${l.companyName || '-'}`,
    `Industrie: ${l.industry || '-'}${l.industryOther ? ` (${l.industryOther})` : ''}`,
    `Descriere și public țintă: ${l.description || '-'}`,
    `Website: ${l.website || '-'}`,
    `Social: ${[l.facebook, l.instagram, l.tiktok].filter(Boolean).join(', ') || '-'}`,
    `Obiectivele declarate ale firmei: ${objectives || '-'}`,
  ].join('\n');
}

function buildContentPrompt(lead, req) {
  const r = req || {};
  return [
    'Pregătește PLANUL DE CONȚINUT PE 30 DE ZILE pentru clientul de mai jos (social media organic).',
    '',
    leadContextBlock(lead),
    '',
    '== CEREREA ==',
    `Titlu: ${r.title || '-'}`,
    `Focusul perioadei (ofertă/produs/eveniment de împins): ${r.offer || '-'}`,
    `Obiectivul: ${OBJECTIVE_RO[r.objective] || r.objective || '-'}`,
    '',
    'Cerințe: totul în limba ROMÂNĂ, concret și gata de folosit (fără placeholder-e). Calendarul',
    'cu ritm realist pentru o firmă mică (12-15 postări/lună), variat ca formate, aliniat cu',
    'focusul și industria. Postările scrise în vocea firmei, cu hashtag-uri locale relevante.',
  ].join('\n');
}

function buildCampaignPrompt(lead, req) {
  const r = req || {};
  return [
    'Pregătește livrabilele unei campanii de marketing pentru clientul de mai jos.',
    '',
    leadContextBlock(lead),
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

// ── AI Optimization Engine (spec 5.5): analizează performanța unei campanii și recomandă ──
const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['scale', 'maintain', 'pause', 'test'], description: 'Recomandarea principală: scale (scalează), maintain (menține), pause (oprește), test (testează variante).' },
    headline: { type: 'string', description: 'O propoziție scurtă în română cu concluzia.' },
    reasoning: { type: 'string', description: '2-4 fraze în română care justifică verdictul pe baza cifrelor concrete (ROAS, CPL, CTR).' },
    actions: { type: 'string', description: '3-5 acțiuni concrete în română, câte una pe linie, numerotate.' },
  },
  required: ['verdict', 'headline', 'reasoning', 'actions'],
  additionalProperties: false,
};

const r2 = (n) => (n === null ? '—' : Math.round(n * 100) / 100);

function buildInsightPrompt(lead, camp, metrics) {
  const t = { spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0 };
  for (const m of metrics) {
    t.spend += Number(m.spend) || 0;
    t.impressions += Number(m.impressions) || 0;
    t.clicks += Number(m.clicks) || 0;
    t.leads += Number(m.leads) || 0;
    t.revenue += Number(m.revenue) || 0;
  }
  const div = (a, b) => (b > 0 ? a / b : null);
  const kpi = [
    `Cheltuit total: ${r2(t.spend)} €`,
    `Venit atribuit: ${r2(t.revenue)} €`,
    `ROAS: ${r2(div(t.revenue, t.spend))}`,
    `Lead-uri/conversii: ${t.leads}`,
    `CPL: ${r2(div(t.spend, t.leads))} €`,
    `CTR: ${div(t.clicks, t.impressions) === null ? '—' : r2(div(t.clicks, t.impressions) * 100) + '%'}`,
    `CPC: ${r2(div(t.spend, t.clicks))} €`,
    `Rata de conversie: ${div(t.leads, t.clicks) === null ? '—' : r2(div(t.leads, t.clicks) * 100) + '%'}`,
  ].join('\n');
  // Ultimele ~14 zile, cronologic, pentru trend.
  const recent = metrics.slice(-14).map((m) => `${m.date}: spend ${r2(Number(m.spend) || 0)}€, leads ${m.leads || 0}, venit ${r2(Number(m.revenue) || 0)}€`).join('\n');
  return [
    'Analizează performanța campaniei de marketing de mai jos și dă o recomandare de optimizare.',
    '',
    leadContextBlock(lead),
    '',
    '== CAMPANIA ==',
    `Nume: ${camp.name || '-'}`,
    `Platformă: ${camp.platform || '-'}`,
    `Status: ${camp.status || '-'}`,
    '',
    '== KPI (cumulat) ==',
    kpi,
    '',
    '== EVOLUȚIE ZILNICĂ (recent) ==',
    recent || '(fără zile introduse)',
    '',
    'Sarcină: pe baza cifrelor, alege un verdict (scale/maintain/pause/test), explică-l raportându-te',
    'la ROAS/CPL/CTR și la trend, și dă acțiuni concrete. Reguli generale de bun-simț: ROAS sub 1',
    '= se pierde bani (pauză sau test); ROAS sănătos și stabil = scalează gradual; CTR mic = problemă',
    'de creativ/audiență; CPL în creștere = oboseală de reclamă. Totul în limba ROMÂNĂ.',
  ].join('\n');
}

if (AI_ENABLED) {
  exports.aiAnalyzeCampaign = onCall(
    { region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' },
    async (request) => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Autentificare necesară.');
      if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Doar operatorii pot analiza campanii.');
      const { campaignId } = request.data || {};
      if (typeof campaignId !== 'string' || !campaignId) throw new HttpsError('invalid-argument', 'campaignId e obligatoriu.');

      const db = admin.firestore();
      const campRef = db.collection('campaigns').doc(campaignId);
      const campSnap = await campRef.get();
      if (!campSnap.exists) throw new HttpsError('not-found', 'Campania nu există.');
      const camp = campSnap.data() || {};
      const totals = camp.totals || {};
      if (!(Number(totals.spend) > 0)) {
        throw new HttpsError('failed-precondition', 'Adaugă întâi date de cheltuială ca să poată fi analizată campania.');
      }

      await consumeAiQuota(request.auth.uid);

      const metricsSnap = await campRef.collection('metrics').orderBy('date', 'asc').limit(60).get();
      const metrics = metricsSnap.docs.map((d) => d.data());
      const leadSnap = camp.leadId ? await db.collection('leads').doc(camp.leadId).get() : null;

      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

      let response;
      try {
        response = await client.messages.create({
          model: AI_MODEL,
          max_tokens: 8000,
          thinking: { type: 'adaptive' },
          system:
            'Ești analistul de performanță și strategul de media-buying al agenției DataRead. Judeci ' +
            'campaniile pe cifre (ROAS, CPL, CTR), nu pe impresii, și dai recomandări acționabile.',
          output_config: { format: { type: 'json_schema', schema: INSIGHT_SCHEMA } },
          messages: [{ role: 'user', content: buildInsightPrompt(leadSnap && leadSnap.exists ? leadSnap.data() : {}, camp, metrics) }],
        });
      } catch (err) {
        logger.error('anthropic analyze failed', { err: String(err) });
        throw new HttpsError('internal', 'Analiza AI a eșuat. Reîncearcă în câteva momente.');
      }

      if (response.stop_reason === 'refusal') throw new HttpsError('failed-precondition', 'Modelul a refuzat analiza.');
      const text = (response.content.find((b) => b.type === 'text') || {}).text || '';
      let out;
      try {
        out = JSON.parse(text);
      } catch (err) {
        throw new HttpsError('internal', 'Răspunsul AI nu a putut fi interpretat. Reîncearcă.');
      }

      const insight = {
        verdict: ['scale', 'maintain', 'pause', 'test'].includes(out.verdict) ? out.verdict : 'maintain',
        headline: String(out.headline || '').slice(0, 4000),
        reasoning: String(out.reasoning || '').slice(0, 4000),
        actions: String(out.actions || '').slice(0, 4000),
      };
      await campRef.set(
        { aiInsight: insight, aiInsightAt: admin.firestore.FieldValue.serverTimestamp(), aiInsightBy: request.auth.uid },
        { merge: true }
      );

      logger.info('campaign analyzed', { campaignId, verdict: insight.verdict, by: request.auth.uid, usage: response.usage });
      return { insight };
    }
  );

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

      // Tipul cererii decide schema + promptul ('content' = plan 30 zile, altfel campanie ads).
      const reqData = reqSnap.data() || {};
      const kind = reqData.kind === 'content' ? 'content' : 'campaign';
      const schema = kind === 'content' ? CONTENT_SCHEMA : CAMPAIGN_SCHEMA;
      const prompt = kind === 'content' ? buildContentPrompt(leadSnap.data(), reqData) : buildCampaignPrompt(leadSnap.data(), reqData);

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
          output_config: { format: { type: 'json_schema', schema } },
          messages: [{ role: 'user', content: prompt }],
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

      const deliverables = {};
      for (const k of KIND_FIELDS[kind]) deliverables[k] = String(out[k] || '').slice(0, 8000);

      // Plasa de siguranță: înainte să suprascriem, starea curentă (dacă are conținut) devine o
      // versiune în istoric — o regenerare nu pierde niciodată munca anterioară (AI sau manuală).
      const prevDel = (typeof reqData.deliverables === 'object' && reqData.deliverables) || {};
      const hasPrev = KIND_FIELDS[kind].some((k) => typeof prevDel[k] === 'string' && prevDel[k].trim());
      if (hasPrev) {
        await reqRef.collection('versions').add({
          deliverables: prevDel,
          kind,
          source: reqData.source === 'ai' ? 'ai' : 'manual',
          reason: 'pre-ai-regenerate',
          snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
          snapshotBy: request.auth.uid,
        });
      }

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

      logger.info('campaign generated', { leadId, requestId, kind, by: request.auth.uid, usage: response.usage });
      return { deliverables };
    }
  );
}
