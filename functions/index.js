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

// ── Portal client: oglindește livrabilele client-safe (FĂRĂ note interne) în subarborele ──
// clientului. Trigger pe orice scriere de cerere (manual / AI / restaurare). Folosește diff-ul
// before/after pe clientUid ca să gestioneze create/update/delete/relink/unlink fără cod special.
const CLIENT_SAFE_DELIVERABLES = ['adTexts', 'videoScripts', 'campaignStructure', 'calendar', 'posts', 'ideas'];

exports.onRequestWrite = onDocumentWritten({ document: 'leads/{leadId}/requests/{reqId}', region: REGION }, async (event) => {
  try {
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    const reqId = event.params.reqId;
    const beforeUid = before && typeof before.clientUid === 'string' ? before.clientUid : '';
    const afterUid = after && typeof after.clientUid === 'string' ? after.clientUid : '';

    const del = (after && typeof after.deliverables === 'object' && after.deliverables) || {};
    const safe = {};
    for (const k of CLIENT_SAFE_DELIVERABLES) {
      if (typeof del[k] === 'string' && del[k].trim()) safe[k] = del[k];
    }
    const hasContent = Object.keys(safe).length > 0;
    const db = admin.firestore();

    // Șterge oglinda veche dacă: s-a deconectat, s-a schimbat clientul, s-a golit conținutul, sau cererea a fost ștearsă.
    if (beforeUid && (beforeUid !== afterUid || !hasContent || !after)) {
      await db.collection('clients').doc(beforeUid).collection('deliverables').doc(reqId).delete().catch(() => {});
    }
    // Scrie/actualizează oglinda client-safe (notele interne NU sunt incluse).
    if (afterUid && hasContent) {
      await db.collection('clients').doc(afterUid).collection('deliverables').doc(reqId).set({
        kind: after.kind === 'content' ? 'content' : 'campaign',
        title: typeof after.title === 'string' ? after.title : '',
        deliverables: safe,
        leadId: event.params.leadId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    logger.error('onRequestWrite mirror failed', { reqId: event.params.reqId, err: String(err) });
  }
});

// ───────────────────────── [3] AI — Verticala 1 Marketing AI ─────────────────────────
// Callable-ul aiGenerateCampaign: citește lead-ul + cererea SERVER-SIDE, cere modelului Claude
// un pachet de livrabile (texte reclame / scripturi video / structură campanie Meta) cu ieșire
// structurată garantată de schemă, și le scrie înapoi pe cerere (source: 'ai'). Cheia trăiește
// EXCLUSIV în Secret Manager; quota lunară per operator în aiUsage/{uid}.
//
// ACTIVARE (după ce Andrei rotește cheia): 1) `firebase functions:secrets:set ANTHROPIC_API_KEY`
// 2) AI_ENABLED = true mai jos  3) `npm run deploy:functions`. Cu AI_ENABLED=false, callable-ul
// nu e exportat, deci deploy-ul nu cere secretul.
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
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

// ── Raport lunar de performanță pentru client (din toate campaniile lui) ──
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Rezumat în română pentru client: ce s-a făcut luna aceasta și rezultatul general, 2-4 fraze, ton clar fără jargon.' },
    highlights: { type: 'string', description: 'Puncte cheie în română, câte unul pe linie, cu cifre concrete (ROAS, lead-uri, cheltuit).' },
    recommendations: { type: 'string', description: 'Recomandări pentru luna următoare în română, câte una pe linie.' },
  },
  required: ['summary', 'highlights', 'recommendations'],
  additionalProperties: false,
};

function campKpiLine(camp) {
  const t = camp.totals || {};
  const div = (a, b) => (b > 0 ? a / b : null);
  const roas = div(Number(t.revenue) || 0, Number(t.spend) || 0);
  const cpl = div(Number(t.spend) || 0, Number(t.leads) || 0);
  return `- ${camp.name || '(fără nume)'} [${camp.platform || '-'}, ${camp.status || '-'}]: cheltuit ${r2(Number(t.spend) || 0)}€, venit ${r2(Number(t.revenue) || 0)}€, ROAS ${r2(roas)}, lead-uri ${Number(t.leads) || 0}, CPL ${r2(cpl)}€`;
}

function buildClientReportPrompt(lead, camps) {
  const o = { spend: 0, revenue: 0, leads: 0 };
  for (const c of camps) {
    const t = c.totals || {};
    o.spend += Number(t.spend) || 0;
    o.revenue += Number(t.revenue) || 0;
    o.leads += Number(t.leads) || 0;
  }
  const div = (a, b) => (b > 0 ? a / b : null);
  return [
    'Scrie un RAPORT LUNAR DE PERFORMANȚĂ pentru clientul de mai jos — text pe care agenția i-l',
    'trimite direct clientului.',
    '',
    leadContextBlock(lead),
    '',
    '== CAMPANIILE CLIENTULUI ==',
    camps.map(campKpiLine).join('\n') || '(fără campanii)',
    '',
    '== TOTAL ==',
    `Cheltuit: ${r2(o.spend)}€ · Venit: ${r2(o.revenue)}€ · ROAS general: ${r2(div(o.revenue, o.spend))} · Lead-uri: ${o.leads}`,
    '',
    'Cerințe: limba ROMÂNĂ, ton profesionist dar prietenos, adresat clientului (nu intern). Folosește',
    'cifrele reale. Rezumatul = imaginea de ansamblu; highlights = realizările cu cifre; recomandările',
    '= ce propunem pentru luna viitoare. Fără promisiuni nerealiste.',
  ].join('\n');
}

if (AI_ENABLED) {
  exports.aiClientReport = onCall(
    { region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' },
    async (request) => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Autentificare necesară.');
      if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Doar operatorii pot genera rapoarte.');
      const { leadId } = request.data || {};
      if (typeof leadId !== 'string' || !leadId) throw new HttpsError('invalid-argument', 'leadId e obligatoriu.');

      const db = admin.firestore();
      const leadSnap = await db.collection('leads').doc(leadId).get();
      if (!leadSnap.exists) throw new HttpsError('not-found', 'Clientul nu există.');
      const campsSnap = await db.collection('campaigns').where('leadId', '==', leadId).get();
      const camps = campsSnap.docs.map((d) => d.data());
      if (camps.length === 0) throw new HttpsError('failed-precondition', 'Clientul nu are campanii de raportat.');

      await consumeAiQuota(request.auth.uid);

      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

      let response;
      try {
        response = await client.messages.create({
          model: AI_MODEL,
          max_tokens: 10000,
          thinking: { type: 'adaptive' },
          system:
            'Ești account managerul agenției DataRead. Scrii rapoarte de performanță clare și oneste ' +
            'pentru clienții firmelor mici și mijlocii din România.',
          output_config: { format: { type: 'json_schema', schema: REPORT_SCHEMA } },
          messages: [{ role: 'user', content: buildClientReportPrompt(leadSnap.data(), camps) }],
        });
      } catch (err) {
        logger.error('anthropic report failed', { err: String(err) });
        throw new HttpsError('internal', 'Generarea raportului a eșuat. Reîncearcă.');
      }

      if (response.stop_reason === 'refusal') throw new HttpsError('failed-precondition', 'Modelul a refuzat raportul.');
      const text = (response.content.find((b) => b.type === 'text') || {}).text || '';
      let out;
      try {
        out = JSON.parse(text);
      } catch (err) {
        throw new HttpsError('internal', 'Răspunsul AI nu a putut fi interpretat. Reîncearcă.');
      }

      const report = {
        summary: String(out.summary || '').slice(0, 6000),
        highlights: String(out.highlights || '').slice(0, 6000),
        recommendations: String(out.recommendations || '').slice(0, 6000),
      };
      const reportAt = admin.firestore.FieldValue.serverTimestamp();
      await db.collection('leads').doc(leadId).set(
        { marketingReport: report, marketingReportAt: reportAt, marketingReportBy: request.auth.uid },
        { merge: true }
      );
      // Mirror în subarborele clientului (dacă lead-ul e conectat la un cont) — clientul îl
      // citește din portal fără să atingă documentul de lead (notele interne rămân izolate).
      const clientUid = (leadSnap.data() || {}).clientUid;
      if (typeof clientUid === 'string' && clientUid) {
        await db.collection('clients').doc(clientUid).set({ marketingReport: report, marketingReportAt: reportAt }, { merge: true });
      }

      logger.info('client report generated', { leadId, campaigns: camps.length, by: request.auth.uid, usage: response.usage });
      return { report };
    }
  );

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

  // ── Agentul AI din LP Studio: generează/editează codul unei Landing Page (felia LP P3) ──
  // Spre deosebire de aiGenerateCampaign, NU scrie în Firestore — întoarce {html} la editor, iar
  // operatorul revizuiește și salvează. Quota = același bucket lunar aiUsage.
  const LP_PAGE_SCHEMA = {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description:
          'Pagină HTML COMPLETĂ și self-contained (un singur document cu <style> inline; fără ' +
          'fișiere externe). Pentru culori folosește EXCLUSIV variabilele CSS injectate de server: ' +
          'var(--bg-0) (fundal), var(--bg-1) (suprafețe/carduri), var(--fg-0) (text principal), ' +
          'var(--fg-1) (text secundar), var(--border), var(--accent), var(--accent-dark), ' +
          'var(--accent-contrast) (text pe accent). Marchează butoanele CTA cu atributul data-cta. ' +
          'Dacă pagina are formular, folosește <form data-lp-form> cu input-uri cu atribut name. ' +
          'NU include niciun <script> de tracking (îl adaugă serverul). Imagini doar prin URL https. ' +
          'Conținut persuasiv, concret, în limba cerută, fără jargon corporatist gol.',
      },
    },
    required: ['html'],
    additionalProperties: false,
  };

  const LP_SYSTEM =
    'Ești designerul și copywriterul senior de landing pages al agenției DataRead. Construiești ' +
    'pagini de campanie pentru firme mici și mijlocii din România — moderne, rapide, orientate pe ' +
    'conversie. Scrii HTML curat, semantic, responsive (mobile-first), cu CSS inline în <style>.';

  const lpStr = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

  function buildLpGeneratePrompt(brief) {
    const lang = brief.lang === 'en' ? 'engleză' : 'română';
    const lines = [
      `Construiește o landing page completă, în limba ${lang}.`,
      `Ofertă / produs / serviciu promovat: ${lpStr(brief.offer, 1000) || '(nespecificat)'}`,
      brief.audience ? `Public țintă: ${lpStr(brief.audience, 1000)}` : '',
      brief.goal ? `Obiectivul paginii: ${lpStr(brief.goal, 200)}` : '',
      brief.tone ? `Ton: ${lpStr(brief.tone, 200)}` : '',
      brief.includeForm
        ? 'Include un formular de contact <form data-lp-form> cu câmpuri relevante (nume, email, telefon) și un buton de trimitere clar.'
        : 'Fără formular pe pagină (CTA-urile duc la acțiune, marcate cu data-cta).',
      'Structură bogată: hero cu titlu + subtitlu + CTA principal, secțiuni de beneficii, ' +
        'dovadă socială / testimoniale, eventual FAQ, și un CTA final. Folosește variabilele de temă.',
    ];
    return lines.filter(Boolean).join('\n');
  }

  function buildLpEditPrompt(html, instruction, lang) {
    const langName = lang === 'en' ? 'engleză' : 'română';
    return (
      `Aceasta este pagina HTML curentă a unei landing page (limba ${langName}):\n\n` +
      '```html\n' + lpStr(html, 200000) + '\n```\n\n' +
      `Aplică următoarea instrucțiune: ${lpStr(instruction, 2000)}\n\n` +
      'Întoarce pagina HTML COMPLETĂ, modificată. Păstrează tot ce nu vizează instrucțiunea. ' +
      'Respectă aceleași reguli tehnice (self-contained, variabilele de temă --accent etc., ' +
      'data-cta pe CTA-uri, fără <script> de tracking, imagini doar https).'
    );
  }

  async function runLpModel(prompt) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    let response;
    try {
      response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 32000,
        thinking: { type: 'adaptive' },
        system: LP_SYSTEM,
        output_config: { format: { type: 'json_schema', schema: LP_PAGE_SCHEMA } },
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err) {
      logger.error('anthropic LP call failed', { err: String(err) });
      throw new HttpsError('internal', 'Generarea AI a eșuat. Reîncearcă în câteva momente.');
    }
    if (response.stop_reason === 'refusal') {
      throw new HttpsError('failed-precondition', 'Modelul a refuzat cererea — reformulează.');
    }
    const text = (response.content.find((b) => b.type === 'text') || {}).text || '';
    let out;
    try {
      out = JSON.parse(text);
    } catch (err) {
      logger.error('LP ai response unparsable', { stop: response.stop_reason });
      throw new HttpsError('internal', 'Răspunsul AI nu a putut fi interpretat. Reîncearcă.');
    }
    return { html: String(out.html || '').slice(0, 200000), usage: response.usage };
  }

  exports.aiGenerateLandingPage = onCall(
    { region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' },
    async (request) => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Autentificare necesară.');
      if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Doar operatorii.');
      const brief = (request.data && request.data.brief) || {};
      if (typeof brief.offer !== 'string' || !brief.offer.trim()) {
        throw new HttpsError('invalid-argument', 'Oferta este obligatorie pentru generare.');
      }
      await consumeAiQuota(request.auth.uid);
      const { html, usage } = await runLpModel(buildLpGeneratePrompt(brief));
      logger.info('LP generated', { by: request.auth.uid, usage });
      return { html };
    }
  );

  exports.aiEditLandingPage = onCall(
    { region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' },
    async (request) => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Autentificare necesară.');
      if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Doar operatorii.');
      const { html, instruction, lang } = request.data || {};
      if (typeof html !== 'string' || !html.trim()) {
        throw new HttpsError('invalid-argument', 'Nu există cod de editat.');
      }
      if (typeof instruction !== 'string' || !instruction.trim()) {
        throw new HttpsError('invalid-argument', 'Instrucțiunea este obligatorie.');
      }
      await consumeAiQuota(request.auth.uid);
      const res = await runLpModel(buildLpEditPrompt(html, instruction, lang));
      logger.info('LP edited', { by: request.auth.uid, usage: res.usage });
      return { html: res.html };
    }
  );
}

// ───────── [4] Landing Pages — servire publică + monitorizare trafic ─────────
// serveLp (HTTP, legat prin rewrite-ul Hosting /p/** → această funcție) e „nexus-ul de trafic și
// date": rezolvă slug → LP publicat, LOGHEAZĂ fiecare vizită server-side (rollup zilnic + doc brut),
// randează pagina SSR (SEO din doc + design injectat ca variabile CSS + CSP). NU se cache-uiește
// (no-store) ca fiecare hit să se logheze. Ramurile /p/_track și /p/_submit se adaugă în P5.

const LP_SOURCE_WHITELIST = ['google', 'meta', 'facebook', 'instagram', 'tiktok', 'youtube', 'email', 'bing', 'linkedin', 'twitter', 'x', 'direct', 'referral', 'organic'];
const LP_CSP =
  "default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https:; script-src 'unsafe-inline'; " +
  "font-src https: data:; frame-src https:; media-src https:; connect-src 'self'; form-action 'self'; " +
  "frame-ancestors 'none'; base-uri 'none'";
const LP_HEX = /^#[0-9a-fA-F]{6}$/;
const LP_SAFE_IMG = /^https:\/\/[^\s"')]+$/i;

function lpBucket(key) {
  const k = (typeof key === 'string' ? key : '').toLowerCase().slice(0, 60);
  if (!k) return 'other';
  return LP_SOURCE_WHITELIST.includes(k) ? k : 'other';
}

function lpDevice(ua) {
  const s = (ua || '').toLowerCase();
  if (/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless/.test(s)) return 'bot';
  if (/ipad|tablet|playbook|silk/.test(s)) return 'tablet';
  if (/mobi|android|iphone|ipod|phone/.test(s)) return 'mobile';
  return 'desktop';
}

function lpEscape(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Fonturi (port al LP_FONTS din themes.ts) — pentru aplicarea tipografiei pe pagina servită.
const LP_FONTS_MAP = {
  inter: { q: 'Inter:wght@400;600;800', stack: "'Inter',sans-serif" },
  poppins: { q: 'Poppins:wght@400;600;800', stack: "'Poppins',sans-serif" },
  montserrat: { q: 'Montserrat:wght@400;600;800', stack: "'Montserrat',sans-serif" },
  playfair: { q: 'Playfair+Display:wght@400;700;900', stack: "'Playfair Display',serif" },
  merriweather: { q: 'Merriweather:wght@400;700', stack: "'Merriweather',serif" },
  lora: { q: 'Lora:wght@400;600;700', stack: "'Lora',serif" },
  spacegrotesk: { q: 'Space+Grotesk:wght@400;600;700', stack: "'Space Grotesk',sans-serif" },
  dmsans: { q: 'DM+Sans:wght@400;600;700', stack: "'DM Sans',sans-serif" },
  oswald: { q: 'Oswald:wght@400;600;700', stack: "'Oswald',sans-serif" },
};

// Preset-uri admin (port al ADMIN_THEMES din src/theme/themes.ts) — pentru fallback pe baza temei.
const LP_ADMIN_THEMES = {
  midnight: { digital: true, vars: { 'bg-0': '#0a0f1e', 'bg-1': '#121a30', 'fg-0': '#e8eefc', 'fg-1': '#8a9ac0', border: '#243154', accent: '#38bdf8', 'accent-dark': '#0ea5e9', 'accent-contrast': '#03121f' } },
  carbon: { digital: true, vars: { 'bg-0': '#0c0c10', 'bg-1': '#17171f', 'fg-0': '#f1f1f5', 'fg-1': '#9a9ab0', border: '#2a2a36', accent: '#a855f7', 'accent-dark': '#9333ea', 'accent-contrast': '#150022' } },
  matrix: { digital: true, vars: { 'bg-0': '#06120c', 'bg-1': '#0c1f15', 'fg-0': '#d6ffe6', 'fg-1': '#6fae87', border: '#16402a', accent: '#22c55e', 'accent-dark': '#16a34a', 'accent-contrast': '#02160a' } },
  ocean: { digital: true, vars: { 'bg-0': '#071a2b', 'bg-1': '#0d2840', 'fg-0': '#e3f2ff', 'fg-1': '#86a8c4', border: '#1b4566', accent: '#2dd4bf', 'accent-dark': '#14b8a6', 'accent-contrast': '#022019' } },
  light: { digital: false, vars: { 'bg-0': '#f6f7f9', 'bg-1': '#ffffff', 'fg-0': '#16202c', 'fg-1': '#4b5563', border: '#e2e6eb', accent: '#2563eb', 'accent-dark': '#1d4ed8', 'accent-contrast': '#ffffff' } },
};

// Port JS al customThemeCss (src/theme/themes.ts) — defensiv (orice valoare invalidă → fallback pe baza temei).
function lpThemeCss(design) {
  const d = design && typeof design === 'object' ? design : {};
  const rv = d.vars && typeof d.vars === 'object' ? d.vars : {};
  // Fallback-ul respectă tema de bază (design.base): o pagină „light" parțial salvată nu trebuie să cadă pe dark.
  const baseTheme = LP_ADMIN_THEMES[d.base] || LP_ADMIN_THEMES.midnight;
  const fb = baseTheme.vars;
  const v = {};
  for (const k of Object.keys(fb)) v[k] = typeof rv[k] === 'string' && LP_HEX.test(rv[k]) ? rv[k] : fb[k];
  const digital = typeof d.digital === 'boolean' ? d.digital : baseTheme.digital;
  const bgImage = typeof d.bgImage === 'string' && LP_SAFE_IMG.test(d.bgImage) ? d.bgImage : '';
  const images = [], sizes = [], positions = [], repeats = [], attachments = [];
  if (digital) {
    images.push(`radial-gradient(${v.border} 1px, transparent 1px)`);
    sizes.push('24px 24px'); positions.push('0 0'); repeats.push('repeat'); attachments.push('scroll');
  }
  if (bgImage) {
    const n = parseInt(v['bg-0'].slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    images.push(`linear-gradient(rgba(${r},${g},${b},0.80), rgba(${r},${g},${b},0.52))`);
    sizes.push('auto'); positions.push('0 0'); repeats.push('repeat'); attachments.push('fixed');
    images.push(`url("${bgImage}")`);
    sizes.push('cover'); positions.push('center'); repeats.push('no-repeat'); attachments.push('fixed');
  }
  const varStr = Object.keys(v).map((k) => `--${k}:${v[k]}`).join(';');
  let bg = `background-color:${v['bg-0']}`;
  if (images.length) {
    bg += `;background-image:${images.join(', ')};background-size:${sizes.join(', ')};background-position:${positions.join(', ')};background-repeat:${repeats.join(', ')};background-attachment:${attachments.join(', ')}`;
  }
  const hf = LP_FONTS_MAP[d.headingFont];
  const bf = LP_FONTS_MAP[d.bodyFont];
  const fams = [];
  if (hf) fams.push(hf.q);
  if (bf && (!hf || bf.q !== hf.q)) fams.push(bf.q);
  const imports = fams.map((q) => `@import url('https://fonts.googleapis.com/css2?family=${q}&display=swap');`).join('');
  const SYS_STACK = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  const bodyFam = `font-family:${bf ? bf.stack : SYS_STACK};`;
  const headRule = hf ? `h1,h2,h3,h4,h5,h6{font-family:${hf.stack}}` : '';
  return `${imports}:root{${varStr}}body{margin:0;min-height:100vh;position:relative;z-index:0;color:${v['fg-0']};${bodyFam}${bg}}${headRule}`;
}

function lpNotFound() {
  return '<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Pagină negăsită</title><style>body{font-family:system-ui,sans-serif;background:#0a0f1e;color:#e8eefc;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center}h1{font-size:64px;margin:0}</style></head><body><div><h1>404</h1><p>Pagina nu există sau nu este publicată.</p></div></body></html>';
}

async function logLpVisit(db, slug, req) {
  const q = req.query || {};
  const source = lpBucket(q.utm_source);
  const ref = (req.headers['referer'] || req.headers['referrer'] || '').toString();
  let refHost = ref ? 'other' : 'direct';
  try {
    if (ref) refHost = lpBucket(new URL(ref).hostname.replace(/^www\./, ''));
  } catch (e) { /* referer invalid */ }
  const ua = (req.headers['user-agent'] || '').toString().slice(0, 300);
  const device = lpDevice(ua);
  const country = (req.headers['x-country-code'] || req.headers['x-appengine-country'] || 'XX').toString().slice(0, 4).toUpperCase();
  const day = new Date().toISOString().slice(0, 10);
  const inc = admin.firestore.FieldValue.increment(1);
  const base = db.collection('landingPages').doc(slug);
  // Rollup zilnic (awaited — agregatul nu se pierde). set+merge cu obiecte imbricate = increment sigur.
  await base.collection('stats').doc(day).set(
    {
      schema: 1, date: day, visits: inc,
      byDevice: { [device]: inc },
      bySource: { [source]: inc },
      byReferrerHost: { [refHost]: inc },
      byCountry: { [country]: inc },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  // Vizita brută (fire-and-forget).
  base.collection('visits').add({
    schema: 1,
    at: admin.firestore.FieldValue.serverTimestamp(),
    referrer: ref.slice(0, 300),
    utm: {
      source: String(q.utm_source || '').slice(0, 200),
      medium: String(q.utm_medium || '').slice(0, 200),
      campaign: String(q.utm_campaign || '').slice(0, 200),
    },
    ua, device, country,
  }).catch(() => {});
}

function composeLpPage(slug, lp, req) {
  const lang = lp.lang === 'en' ? 'en' : 'ro';
  const title = lpEscape((lp.title || '').slice(0, 140) || slug);
  const desc = lpEscape((lp.seoDescription || '').slice(0, 320));
  // Host-ul vine din header (controlabil de client) → îl validăm la un hostname plauzibil și îl escapăm,
  // ca să nu injecteze atribute/markup în <link>/<meta>. Fallback la domeniul canonic dacă e suspect.
  const rawHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
  const host = /^[a-zA-Z0-9.:-]+$/.test(rawHost) ? rawHost : 'dataread-e1bd6.web.app';
  const canonical = `https://${lpEscape(host)}/p/${slug}`;
  const css = lpThemeCss(lp.design);
  const body = typeof lp.html === 'string' ? lp.html : '';
  // Decorul de fundal al paginii — compilat la salvare în client, injectat aici (motorul nu trăiește în functions).
  const pageDecor = typeof lp.pageDecorHtml === 'string' ? lp.pageDecorHtml : '';
  return (
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${title}</title>` +
    (desc ? `<meta name="description" content="${desc}">` : '') +
    `<link rel="canonical" href="${canonical}">` +
    '<meta property="og:type" content="website">' +
    `<meta property="og:title" content="${title}">` +
    (desc ? `<meta property="og:description" content="${desc}">` : '') +
    `<meta property="og:url" content="${canonical}">` +
    `<style>${css}</style></head><body>${pageDecor}${body}${lpScripts(slug, lp)}</body></html>`
  );
}

// Șir JS sigur de inserat într-un <script> inline (escapează `<` ca să nu rupă </script>).
function jsString(s) {
  return JSON.stringify(String(s == null ? '' : s)).replace(/</g, '\\u003c');
}

// Scripturile injectate în pagină: beacon de engagement (mereu) + handler de formular (dacă există).
function lpScripts(slug, lp) {
  const beacon =
    '<script>(function(){var s=' + jsString(slug) + ';var m=0,t0=Date.now(),c=0,sent=false;' +
    'function p(){var h=document.documentElement;var sc=h.scrollTop||document.body.scrollTop||0;' +
    'var mx=(h.scrollHeight-h.clientHeight)||1;return Math.min(100,Math.round(sc/mx*100));}' +
    'window.addEventListener("scroll",function(){var x=p();if(x>m)m=x;},{passive:true});' +
    'document.addEventListener("click",function(e){var el=e.target.closest&&e.target.closest("[data-cta]");if(el)c++;});' +
    'function send(){if(sent)return;sent=true;try{navigator.sendBeacon("/p/_track",new Blob([JSON.stringify({slug:s,scrollPct:m,timeMs:Date.now()-t0,cta:c})],{type:"application/json"}));}catch(e){}}' +
    'document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")send();});' +
    'window.addEventListener("pagehide",send);})();</script>';
  if (!lp.hasForm) return beacon;
  const okMsg = (lp.form && lp.form.successMessage) || 'Mulțumim! Te contactăm în curând.';
  const form =
    '<script>(function(){var f=document.querySelector("form[data-lp-form]");if(!f)return;var s=' + jsString(slug) + ';' +
    'var OK=' + jsString(okMsg) + ';var ERR="A apărut o eroare. Reîncearcă.";' +
    'f.addEventListener("submit",function(e){e.preventDefault();var fd=new FormData(f);var v={};fd.forEach(function(val,k){v[k]=String(val).slice(0,2000);});' +
    'var u=new URLSearchParams(location.search);' +
    'fetch("/p/_submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug:s,values:v,referrer:document.referrer,utm:{source:u.get("utm_source")||"",medium:u.get("utm_medium")||"",campaign:u.get("utm_campaign")||""}})})' +
    '.then(function(r){return r.json();}).then(function(d){if(d&&d.ok){f.innerHTML="<p style=\\"padding:24px;text-align:center;color:var(--fg-0)\\">"+OK+"</p>";}else{alert(ERR);}}).catch(function(){alert(ERR);});});})();</script>';
  return beacon + form;
}

function lpClampNum(v, max) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
}

// Port JS al sanitizeSubmissionValues (src/types/landingPage.ts).
function sanitizeLpValues(raw, fields) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const values = {};
  const missing = [];
  for (const f of (Array.isArray(fields) ? fields : []).slice(0, 12)) {
    if (!f || typeof f.name !== 'string') continue;
    const v = src[f.name];
    const val = typeof v === 'string' ? v.trim().slice(0, 2000) : '';
    if (val) values[f.name] = val;
    if (f.required && !val) missing.push(f.name);
  }
  return { values, missing };
}

// Mapează euristic valorile formularului pe forma unui lead din pipeline.
function mapSubmissionToLead(values, fields, slug, lang) {
  const find = (re) => {
    for (const f of fields) if (re.test(f.name) && values[f.name]) return values[f.name];
    return '';
  };
  const desc = fields
    .filter((f) => values[f.name])
    .map((f) => `${f.label || f.name}: ${values[f.name]}`)
    .join('\n')
    .slice(0, 2000);
  return {
    schema: 1,
    companyName: find(/company|firma|companie/).slice(0, 120),
    cui: '', website: '',
    contactName: find(/name|nume/).slice(0, 80),
    contactEmail: find(/email|mail/).slice(0, 120),
    contactPhone: find(/phone|tel|telefon/).slice(0, 30),
    industry: '', industryOther: '', objectives: [], adBudget: '',
    facebook: '', instagram: '', tiktok: '',
    description: desc,
    packageInterest: null,
    locale: lang === 'en' ? 'en' : 'ro',
    status: 'new',
    source: `lp:${slug}`.slice(0, 80),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function handleTrack(req, res) {
  const body = req.body || {};
  const slug = typeof body.slug === 'string' ? body.slug.toLowerCase() : '';
  if (!/^[a-z0-9-]+$/.test(slug)) {
    res.status(204).end();
    return;
  }
  const scrollPct = lpClampNum(body.scrollPct, 100);
  const timeMs = lpClampNum(body.timeMs, 3600000);
  const cta = lpClampNum(body.cta, 50);
  const engaged = timeMs > 15000 || scrollPct > 50 ? 1 : 0;
  const day = new Date().toISOString().slice(0, 10);
  const inc = admin.firestore.FieldValue.increment;
  try {
    const base = admin.firestore().collection('landingPages').doc(slug);
    // Integritate: scriem statistici DOAR pentru o pagină existentă și publicată — altfel un POST direct
    // ar putea polua/umfla statistici pentru slug-uri arbitrare sau inexistente.
    const snap = await base.get();
    const lp = snap.exists ? snap.data() : null;
    if (!lp || lp.status !== 'published') {
      res.status(204).end();
      return;
    }
    await base.collection('stats').doc(day).set(
      {
        schema: 1, date: day,
        beacons: inc(1),
        scrollDepthSum: inc(scrollPct),
        timeOnPageSum: inc(timeMs),
        engaged: inc(engaged),
        ctaClicks: inc(cta),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    logger.warn('lp track failed', { slug, e: String(e) });
  }
  res.status(204).end();
}

async function handleSubmit(req, res) {
  const body = req.body || {};
  const slug = typeof body.slug === 'string' ? body.slug.toLowerCase() : '';
  if (!/^[a-z0-9-]+$/.test(slug)) {
    res.status(400).json({ ok: false });
    return;
  }
  try {
    const db = admin.firestore();
    const snap = await db.collection('landingPages').doc(slug).get();
    const lp = snap.exists ? snap.data() : null;
    if (!lp || lp.status !== 'published' || !lp.hasForm) {
      res.status(400).json({ ok: false });
      return;
    }
    const fields = (lp.form && Array.isArray(lp.form.fields)) ? lp.form.fields : [];
    const { values, missing } = sanitizeLpValues(body.values, fields);
    if (missing.length || Object.keys(values).length === 0) {
      res.status(400).json({ ok: false });
      return;
    }
    const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
    const base = db.collection('landingPages').doc(slug);
    await base.collection('submissions').add({
      schema: 1, values, status: 'new',
      utm: { source: String(utm.source || '').slice(0, 200), medium: String(utm.medium || '').slice(0, 200), campaign: String(utm.campaign || '').slice(0, 200), term: '', content: '' },
      referrer: String(body.referrer || '').slice(0, 300),
      ua: String(req.headers['user-agent'] || '').slice(0, 300),
      geoCountry: (req.headers['x-country-code'] || req.headers['x-appengine-country'] || 'XX').toString().slice(0, 4).toUpperCase(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const day = new Date().toISOString().slice(0, 10);
    await base.collection('stats').doc(day).set(
      { schema: 1, date: day, submissions: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    if (lp.form && lp.form.createLead === true) {
      await db.collection('leads').add(mapSubmissionToLead(values, fields, slug, lp.lang));
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    logger.error('lp submit failed', { slug, e: String(e) });
    res.status(500).json({ ok: false });
  }
}

exports.serveLp = onRequest({ region: REGION, memory: '256MiB', invoker: 'public' }, async (req, res) => {
  try {
    const path = req.path || '';
    if (path === '/p/_track') return await handleTrack(req, res);
    if (path === '/p/_submit') return await handleSubmit(req, res);
    const match = path.match(/^\/p\/([^/]+)\/?$/);
    const slug = match ? decodeURIComponent(match[1]).toLowerCase() : '';
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      res.status(404).set('Content-Type', 'text/html; charset=utf-8').set('X-Robots-Tag', 'noindex').send(lpNotFound());
      return;
    }
    const db = admin.firestore();
    const snap = await db.collection('landingPages').doc(slug).get();
    const lp = snap.exists ? snap.data() : null;
    if (!lp || lp.status !== 'published') {
      res.status(404).set('Content-Type', 'text/html; charset=utf-8').set('X-Robots-Tag', 'noindex').send(lpNotFound());
      return;
    }
    await logLpVisit(db, slug, req).catch((e) => logger.warn('lp visit log failed', { slug, e: String(e) }));
    res
      .status(200)
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'no-store')
      .set('Content-Security-Policy', LP_CSP)
      .send(composeLpPage(slug, lp, req));
  } catch (err) {
    logger.error('serveLp failed', { err: String(err) });
    res.status(500).set('Content-Type', 'text/html; charset=utf-8').send(lpNotFound());
  }
});
