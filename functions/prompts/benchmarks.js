// =============================================================================
// L2 — Benchmark-uri orientative per VERTICALĂ (Stratul 2 al Fundației stratificate).
// Folosit de functions/prompts/personas.js → buildL2Text(industry) → bloc cache-uit
// per-verticală, partajat între clienții aceleiași industrii.
//
// !!! VALORI DE PORNIRE, plauzibile pentru piața RO, NEVALIDATE. De înlocuit cu medii
//     reale din conturile DataRead. Modelul e instruit (în L2) să le trateze ca ancore
//     orientative, nu adevăr absolut, și să spună când o valoare e peste/sub/în normă.
//
// Cheile = SELF_INDUSTRIES din functions/index.js (fără 'other'). Paritate de taxonomie:
//   retail · horeca · services · construction · beauty · auto · medical · education
// Unități: ctr/cvr = procent (%), cpl = €/lead, roas = multiplicator (x).
//   roas:null acolo unde de regulă NU există tranzacție online directă (servicii/lead-gen),
//   ca să semnaleze analistului să judece pe CPL/CVR, nu pe ROAS inexistent.
// CommonJS (functions e Node22 plain-JS) — zero dependențe, 100% static (cache-safe).
// =============================================================================

const BENCHMARKS_RO = {
  retail: {
    meta: { ctr: 1.1, cpl: 7, roas: 3.5, cvr: 1.8 },
    google: { ctr: 3.0, cpl: 8, roas: 4.5, cvr: 2.5 }, // Search + PMax pe feed curat
    tiktok: { ctr: 1.4, cpl: 6, roas: 2.2, cvr: 1.2 },
  },
  horeca: {
    meta: { ctr: 1.3, cpl: 5, roas: null, cvr: 4.0 }, // rezervări/comenzi, nu ROAS direct
    google: { ctr: 3.5, cpl: 7, roas: null, cvr: 6.0 },
    tiktok: { ctr: 1.8, cpl: 4.5, roas: null, cvr: 2.5 }, // food = vizual, performează pe TikTok
  },
  services: {
    meta: { ctr: 0.9, cpl: 9, roas: null, cvr: 6.0 }, // lead-uri/programări
    google: { ctr: 4.5, cpl: 11, roas: null, cvr: 9.0 }, // intenție mare, lead cald
    tiktok: { ctr: 1.2, cpl: 10, roas: null, cvr: 3.0 },
  },
  construction: {
    meta: { ctr: 0.8, cpl: 14, roas: null, cvr: 4.0 }, // proiecte de valoare mare, lead scump
    google: { ctr: 4.0, cpl: 18, roas: null, cvr: 7.0 },
    tiktok: { ctr: 0.7, cpl: 20, roas: null, cvr: 2.0 },
  },
  beauty: {
    meta: { ctr: 1.4, cpl: 5.5, roas: null, cvr: 5.0 }, // vizual + before/after
    google: { ctr: 3.0, cpl: 8, roas: null, cvr: 6.0 },
    tiktok: { ctr: 2.0, cpl: 4, roas: null, cvr: 3.5 }, // cel mai bun raport cost/atenție
  },
  auto: {
    meta: { ctr: 0.9, cpl: 11, roas: null, cvr: 3.5 }, // service + vânzări
    google: { ctr: 4.0, cpl: 13, roas: null, cvr: 7.0 }, // „service auto lângă mine"
    tiktok: { ctr: 1.0, cpl: 12, roas: null, cvr: 2.0 },
  },
  medical: {
    meta: { ctr: 0.8, cpl: 12, roas: null, cvr: 4.5 }, // clinici, lead sensibil
    google: { ctr: 4.5, cpl: 14, roas: null, cvr: 8.0 }, // intenție mare (nevoie imediată)
    tiktok: { ctr: 0.9, cpl: 15, roas: null, cvr: 2.0 },
  },
  education: {
    meta: { ctr: 1.0, cpl: 8, roas: null, cvr: 3.5 }, // cursuri/abonamente
    google: { ctr: 3.5, cpl: 10, roas: null, cvr: 5.0 },
    tiktok: { ctr: 1.3, cpl: 7, roas: null, cvr: 2.5 },
  },
};

// Ghidaj scurt pe verticală — însoțește benchmark-ul numeric în blocul L2.
const VERTICAL_NOTES_RO = {
  retail:
    'Optimizezi pe ROAS și AOV. ROAS-prag de profit = 1 / marjă brută (ex. marjă 30% → prag ~3.3x). ' +
    'Feed curat = condiție pentru PMax/Advantage+ Shopping. Retargeting pe coș abandonat = cel mai ieftin venit.',
  horeca:
    'Vizual + sezonalitate (sărbători, terase vara, evenimente). Reels/TikTok performează la food. ' +
    'Obiectiv des = trafic în local + rezervări; atribuirea e parțială → folosește coduri/oferte cu termen.',
  services:
    'Google Search + Google Business Profile + recenzii sunt prioritatea 1, înaintea Meta. ' +
    'Măsori în programări/lead-uri calde, nu ROAS. Viteza de sunat lead-ul (sub 5 min) decide rata de închidere.',
  construction:
    'Lead-uri puține, dar de valoare mare → optimizezi pe CALITATE lead, nu pe volum/CPL brut. ' +
    'Search pe intenție + portofoliu vizual (proiecte realizate) ca dovadă. Cicluri de decizie lungi.',
  beauty:
    'Conținut vizual (before/after, demo) + dovadă socială puternică. TikTok/Reels + Instagram domină. ' +
    'Rezervări online + remindere (SMS/WhatsApp) reduc no-show-urile. Recenzii = aproape obligatorii.',
  auto:
    'Search domină pentru service/reparații („lângă mine", urgență). Pentru vânzări, retargeting + ofertă clară. ' +
    'Google Business Profile + recenzii esențiale. Lead cald → sunat rapid.',
  medical:
    'Search pe intenție (nevoie imediată) + reputație/recenzii. Atenție la politicile de publicitate pe sănătate. ' +
    'Programări online + remindere. Optimizezi pe calitatea lead-ului și pe rata de prezentare la consultație.',
  education:
    'Cicluri de decizie medii → nurturing pe email + retargeting. Dovadă (rezultate, testimoniale) bate promisiunea. ' +
    'Sezonalitate puternică (septembrie „back to school", ianuarie „resetare"). Lead magnet (lecție demo) funcționează.',
};

module.exports = { BENCHMARKS_RO, VERTICAL_NOTES_RO };
