/**
 * E2E în proces pentru sistemul LP — fără credențiale, fără emulator, fără scriere în producție.
 *
 * Ce verifică: lanțul COMPLET de servire al unei pagini reale.
 *   1. Compilatoarele REALE din LP Studio (compileBlocks / compileDecor / customThemeCss) produc
 *      string-urile pe care editorul le-ar salva în Firestore.
 *   2. `functions/index.js` (serveLp/handleTrack/handleSubmit — codul EXACT deployat) compune pagina
 *      finală din acele string-uri, cu un Firestore fals în memorie (deci nicio scriere reală).
 *
 * Astfel testăm integrarea „TS compile → string stocat → JS serveLp" end-to-end, plus fix-urile de
 * audit: publicarea în mod vizual, formularul auto-activat de un bloc form, integritatea handleTrack
 * (nu scrie statistici pentru slug inexistent/nepublicat) și fallback-ul lpThemeCss pe baza temei.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fnIndex = join(root, 'functions', 'index.js');
const fnRequire = createRequire(fnIndex);

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failed++; console.error(`  ✗ ${msg}`); } };

// ── 1) Bundle compilatoarele TS reale ───────────────────────────────────────
const tmp = join(root, 'scripts', '.tmp-e2e-lp-entry.cjs');
await build({
  entryPoints: [join(root, 'scripts', '_e2e-lp-entry.ts')],
  bundle: true, platform: 'node', format: 'cjs', outfile: tmp,
  define: { 'import.meta.env': '{}' }, logLevel: 'silent', external: ['react'],
});
const C = createRequire(import.meta.url)(tmp);

// ── 2) Stub firebase-admin ÎNAINTE de a încărca index.js ─────────────────────
const admin = fnRequire('firebase-admin');
admin.initializeApp = () => ({});            // no-op: fără credențiale reale
const state = { lpDoc: null, calls: {} };
const rec = (k, v) => { (state.calls[k] = state.calls[k] || []).push(v); };
// Doc-ref fals cu identitate (_recKey/_id) ca batch-ul să poată înregistra pe colecția corectă.
function makeDoc(recKey, id, isLp) {
  return {
    _recKey: recKey, _id: id,
    async get() {
      if (isLp) return { exists: state.lpDoc !== null, data: () => state.lpDoc };
      return { exists: false, data: () => null };
    },
    collection(sub) { return makeCol(`${recKey}/${sub}`); },
    async set(data) { rec(`${recKey}:set`, { id, data }); },
    async update(data) { rec(`${recKey}:update`, { id, data }); },
  };
}
function makeCol(recKey) {
  return {
    doc(id) { return makeDoc(recKey, id, recKey === 'landingPages'); },
    add(data) { rec(`${recKey}:add`, data); return Promise.resolve({ id: 'x' }); },
  };
}
const fakeDb = {
  collection(name) { return makeCol(name); },
  batch() {
    const ops = [];
    return {
      set(ref, data) { ops.push(['set', ref, data]); return this; },
      update(ref, data) { ops.push(['update', ref, data]); return this; },
      async commit() { for (const [op, ref, data] of ops) rec(`${ref._recKey}:${op}`, { id: ref._id, data }); },
    };
  },
};
// admin.firestore e un getter pe namespace → îl înlocuim cu defineProperty (configurable).
const fakeFirestore = () => fakeDb;
fakeFirestore.FieldValue = { increment: (n) => ({ __inc: n }), serverTimestamp: () => ({ __ts: true }) };
Object.defineProperty(admin, 'firestore', { value: fakeFirestore, configurable: true, writable: true });

const fns = fnRequire(fnIndex);
const serveLp = fns.serveLp; // handler express (gen-2 onRequest) — apelabil ca (req,res)

// ── PARITATE TS↔JS: variantKey/sanitizeVariantPart/buildLpUrl trebuie să producă IDENTIC în TS (Link
// Builder scrie cheia) și JS (serveLp incrementează contorul). O divergență rupe varianta în două docs.
console.log('e2e-lp-serve: verificare în proces a serveLp + compilatoare reale\n');
console.log('P) Paritate atribuire TS↔JS (corpus adversarial)');
{
  let pf = 0;
  const parts = ['Facebook', 'Black Friday!!!', 'Lansare Iarnă ăâîșț', '  ~Promo 50%~  ', '🔥viral🔥', 'a'.repeat(80), '', 'UPPER_case', 'reel-#1', 'noi&voi', '__direct'];
  for (const p of parts) {
    if (C.sanitizeVariantPart(p) !== fns.sanitizeVariantPart(p)) { pf++; console.error(`  ✗ sanitize diverge: ${JSON.stringify(p)} → TS ${JSON.stringify(C.sanitizeVariantPart(p))} vs JS ${JSON.stringify(fns.sanitizeVariantPart(p))}`); }
  }
  const attrs = [
    { source: 'Facebook', medium: 'Video', campaign: 'Lansare', content: 'V2', term: 'x' },
    { source: 'tiktok', content: 'Reel Iarnă #1' },
    { campaign: 'Black Friday', medium: 'static' },
    {}, { source: '🔥', medium: '~~~', campaign: 'a'.repeat(50), content: 'noi&voi' },
  ];
  for (const a of attrs) {
    if (C.variantKey(a) !== fns.variantKey(a)) { pf++; console.error(`  ✗ variantKey diverge: TS ${C.variantKey(a)} vs JS ${fns.variantKey(a)}`); }
    if (C.buildLpUrl('https://dataread-e1bd6.web.app', 'pg', a) !== fns.buildLpUrl('https://dataread-e1bd6.web.app', 'pg', a)) { pf++; console.error('  ✗ buildLpUrl diverge'); }
  }
  ok(pf === 0, `paritate TS↔JS pe ${parts.length} părți + ${attrs.length} atribuiri (sanitize/variantKey/buildLpUrl)`);
}

// ── 3) Construiește o LP de test reală (mod vizual, decor pagină, font, formular) ─
const slug = 'test-verificare-lp';
const rawDesign = { ...C.defaultCustomTheme('ocean'), headingFont: 'poppins', bodyFont: 'inter' };
const lp = C.coerceToLandingPage({
  schema: 1, slug, title: 'TEST Verificare LP — constellation',
  seoDescription: 'Pagină de test pentru verificarea sistemului LP.',
  ogImage: 'https://cdn.example.com/og.png', favicon: 'https://cdn.example.com/fav.ico',
  status: 'published', lang: 'ro', editor: 'visual', html: '',
  blocks: [
    { type: 'hero', props: { heading: 'Titlu Hero de Test', subheading: 'Subtitlu de test', ctaText: 'Acțiune', ctaHref: '#' } },
    { type: 'features', props: { items: [{ title: 'Rapid', text: 'desc' }, { title: 'Sigur', text: 'desc' }] } },
    { type: 'form', props: { heading: 'Contactează-ne' } },
  ],
  // Valori realiste, exact din intervalul slider-elor (size 1..20, opacity 0.05..1) — ca ce produce studio-ul.
  // DOUĂ straturi de fundal suprapuse (feature: fundaluri decorative multiple pe pagină).
  pageDecors: [
    { effect: 'constellation', interaction: 'mouseReact', density: 60, speed: 40, size: 3, color: '', opacity: 0.55, intensity: 50 },
    { effect: 'waves', interaction: 'none', density: 40, speed: 30, size: 4, color: '', opacity: 0.4, intensity: 0 },
  ],
  design: C.coerceToCustomTheme(rawDesign),
  form: {
    enabled: false, submitLabel: 'Trimite', successMessage: 'Mersi!', createLead: true,
    fields: [{ name: 'email', label: 'Email', type: 'email', required: true }, { name: 'nume', label: 'Nume', type: 'text', required: false }],
  },
  hasForm: false,
});
// Replică logica LpEditor: un bloc `form` forțează formularul activ; html/pageDecorHtml se compilează la salvare.
const form = { ...lp.form, enabled: true };
const html = C.compileBlocks(lp.blocks, { form });
const pageDecorHtml = C.compilePageDecors(lp.pageDecors);
const servedDoc = { ...lp, html, pageDecorHtml, hasForm: true, form };

// ── Helpers de request/response ─────────────────────────────────────────────
const mkRes = () => {
  const r = { _status: 200, _headers: {}, _body: undefined, _ended: false };
  r.status = (c) => { r._status = c; return r; };
  r.set = (k, v) => { if (typeof k === 'object') Object.assign(r._headers, k); else r._headers[k] = v; return r; };
  r.send = (b) => { r._body = b; r._ended = true; return r; };
  r.json = (o) => { r._body = o; r._ended = true; return r; };
  r.end = () => { r._ended = true; return r; };
  return r;
};
const mkReq = (over) => ({ path: '/', query: {}, method: 'GET', body: {}, headers: { host: 'dataread-e1bd6.web.app', 'user-agent': 'verif/1.0', referer: '' }, ...over });
const reset = () => { state.calls = {}; };

// ── TEST A: GET /p/{slug} pentru o pagină vizuală publicată ───────────────────
console.log('\nA) GET /p/%s (pagină vizuală publicată)', slug);
state.lpDoc = servedDoc; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: `/p/${slug}` }), res);
  const b = String(res._body || '');
  ok(res._status === 200, 'status 200');
  ok(/text\/html/.test(res._headers['Content-Type'] || ''), 'Content-Type text/html');
  ok(res._headers['Cache-Control'] === 'no-store', 'Cache-Control: no-store (fără cache pe pagina dinamică)');
  ok(!!res._headers['Content-Security-Policy'], 'CSP prezent');
  ok(b.includes('<title>TEST Verificare LP'), 'titlu SEO randat');
  ok(b.includes('property="og:image"') && b.includes('cdn.example.com/og.png'), 'og:image injectat (social card)');
  ok(b.includes('name="twitter:card" content="summary_large_image"'), 'twitter card large (cu og:image)');
  ok(b.includes('rel="icon"') && b.includes('cdn.example.com/fav.ico'), 'favicon injectat');
  ok(b.includes(':root{') && b.includes('#2dd4bf'), 'CSS design pe :root + accent temă Ocean (#2dd4bf)');
  ok(b.includes('position:relative;z-index:0'), 'body stacking (canvas decor în spate fără a împacheta conținutul)');
  ok(b.includes('@import') && /Poppins/i.test(b), 'font @import (Poppins) aplicat');
  ok(b.includes('id="lpd-pg0"') && b.includes('id="lpd-pg1"') && b.includes('<canvas'), 'decor pagină injectat — DOUĂ straturi suprapuse (pg0 + pg1)');
  ok(b.includes('Titlu Hero de Test'), 'bloc hero compilat în pagină');
  ok(b.includes('data-lp-form'), 'formular randat (bloc form → auto-activat)');
  ok(b.includes('navigator.sendBeacon("/p/_track"'), 'beacon de engagement injectat');
  ok(b.includes('fetch("/p/_submit"'), 'handler formular injectat (hasForm)');
  ok((state.calls['landingPages/stats:set'] || []).length === 1, 'vizită logată (rollup stats incrementat o dată)');
  ok((state.calls['landingPages/visits:add'] || []).length === 1, 'vizită brută adăugată');
  const statsA = (state.calls['landingPages/stats:set'] || [])[0];
  ok(statsA && statsA.data.byMedium && statsA.data.byMedium.other && statsA.data.byMedium.other.__inc === 1, 'byMedium în rollup (fără utm_medium → other)');
  const varA = (state.calls['landingPages/variants:set'] || [])[0];
  ok(varA && varA.id === '__direct' && varA.data.visits.__inc === 1, 'variantă __direct (vizită fără UTM)');
  writeFileSync(join(root, 'scripts', '.tmp-lp-page.html'), b); // pentru screenshot vizual
}

// ── TEST A2: SEO negativ — fără og:image → card 'summary'; favicon non-https → omis ──
console.log('\nA2) head SEO fără og:image + favicon non-https');
state.lpDoc = { ...servedDoc, ogImage: '', favicon: 'http://insecure/f.ico' }; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: `/p/${slug}` }), res);
  const b = String(res._body || '');
  ok(!b.includes('property="og:image"'), 'fără ogImage → fără meta og:image');
  ok(b.includes('name="twitter:card" content="summary"'), 'twitter card summary (fără imagine)');
  ok(!b.includes('rel="icon"'), 'favicon non-https → omis');
}
state.lpDoc = servedDoc;

// ── TEST B: GET pe o pagină DRAFT → 404 (nu se servește) ─────────────────────
console.log('\nB) GET /p/%s când e draft → 404', slug);
state.lpDoc = { ...servedDoc, status: 'draft' }; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: `/p/${slug}` }), res);
  ok(res._status === 404, 'status 404 pentru draft');
  ok(!(state.calls['landingPages/stats:set']), 'nicio vizită logată pe draft');
}

// ── TEST C: handleTrack pe pagină publicată → scrie statistici ───────────────
console.log('\nC) POST /p/_track (slug publicat) → incrementează statistici');
state.lpDoc = servedDoc; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: '/p/_track', method: 'POST', body: { slug, scrollPct: 80, timeMs: 40000, cta: 2 } }), res);
  const sets = state.calls['landingPages/stats:set'] || [];
  const d0 = sets[0] && sets[0].data;
  ok(res._status === 204, 'status 204');
  ok(sets.length === 1, 'stats scris o dată');
  ok(d0 && d0.beacons && d0.beacons.__inc === 1, 'beacons incrementat');
  ok(d0 && d0.ctaClicks && d0.ctaClicks.__inc === 2, 'ctaClicks = 2');
  ok(d0 && d0.engaged && d0.engaged.__inc === 1, 'engaged = 1 (timeMs>15s)');
  const varC = (state.calls['landingPages/variants:set'] || [])[0];
  ok(varC && varC.data.beacons && varC.data.beacons.__inc === 1, 'engagement scris și pe variantă');
}

// ── TEST D: handleTrack pe slug INEXISTENT → integritate (nu scrie nimic) ─────
console.log('\nD) POST /p/_track (slug inexistent) → integritate: nu scrie statistici');
state.lpDoc = null; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: '/p/_track', method: 'POST', body: { slug: 'inexistent-xyz', scrollPct: 90, timeMs: 50000, cta: 1 } }), res);
  ok(res._status === 204, 'status 204');
  ok(!(state.calls['landingPages/stats:set']), 'NICIO scriere de statistici (fix audit: existență + publicat)');
}

// ── TEST E: handleTrack pe slug DRAFT → integritate (nu scrie nimic) ──────────
console.log('\nE) POST /p/_track (slug draft) → integritate: nu scrie statistici');
state.lpDoc = { ...servedDoc, status: 'draft' }; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: '/p/_track', method: 'POST', body: { slug, scrollPct: 90, timeMs: 50000, cta: 1 } }), res);
  ok(res._status === 204, 'status 204');
  ok(!(state.calls['landingPages/stats:set']), 'NICIO scriere de statistici pe draft');
}

// ── TEST F: handleSubmit valid → submission + lead + stats ───────────────────
console.log('\nF) POST /p/_submit (valori valide) → submission + lead');
state.lpDoc = servedDoc; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: '/p/_submit', method: 'POST', body: { slug, values: { email: 'test@example.com', nume: 'Ion Test' } } }), res);
  ok(res._status === 200 && res._body && res._body.ok === true, 'status 200 + {ok:true}');
  ok((state.calls['landingPages/submissions:add'] || []).length === 1, 'submission salvat');
  ok((state.calls['leads:add'] || []).length === 1, 'lead creat (createLead=true)');
  ok((state.calls['landingPages/stats:set'] || []).length === 1, 'stats submissions incrementat');
  const varF = (state.calls['landingPages/variants:set'] || [])[0];
  ok(varF && varF.data.submissions && varF.data.submissions.__inc === 1, 'conversie atribuită pe variantă');
}

// ── TEST G: handleSubmit fără câmp obligatoriu → 400 ─────────────────────────
console.log('\nG) POST /p/_submit (lipsește email obligatoriu) → 400');
state.lpDoc = servedDoc; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: '/p/_submit', method: 'POST', body: { slug, values: { nume: 'Ion' } } }), res);
  ok(res._status === 400 && res._body && res._body.ok === false, 'status 400 + {ok:false}');
  ok(!(state.calls['landingPages/submissions:add']), 'niciun submission salvat');
}

// ── TEST H: lpThemeCss fallback pe baza temei (audit) ────────────────────────
// O temă „light" parțial salvată (fără vars) NU trebuie să cadă pe dark.
console.log('\nH) GET /p/{slug} cu design parțial {base:"light"} → fallback pe tema light, nu dark');
state.lpDoc = { ...servedDoc, design: { schema: 1, base: 'light' } }; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: `/p/${slug}` }), res);
  const b = String(res._body || '');
  ok(res._status === 200, 'status 200');
  ok(b.includes('#f6f7f9'), 'bg light (#f6f7f9) din fallback-ul temei light, nu dark (#0a0f1e)');
  ok(!b.includes('radial-gradient(') || !b.includes('24px 24px'), 'fără grilă „digital" (light.digital=false)');
}

// ── TEST I: vizită cu UTM CUNOSCUT (în knownVariants) → contor pe cheia variantei + byMedium ──
console.log('\nI) GET /p/{slug}?utm_* cunoscut → variants/{key} + byMedium');
state.lpDoc = { ...servedDoc, knownVariants: { 'facebook~video~lansare~v2': true } }; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: `/p/${slug}`, query: { utm_source: 'Facebook', utm_medium: 'Video', utm_campaign: 'Lansare', utm_content: 'V2' } }), res);
  const varI = (state.calls['landingPages/variants:set'] || [])[0];
  ok(varI && varI.id === 'facebook~video~lansare~v2' && varI.data.visits.__inc === 1, 'variantă cunoscută → contor pe cheia ei');
  const statsI = (state.calls['landingPages/stats:set'] || [])[0];
  ok(statsI && statsI.data.byMedium && statsI.data.byMedium.video && statsI.data.byMedium.video.__inc === 1, 'byMedium=video în rollup');
}

// ── TEST J: vizită cu UTM NECUNOSCUT (lipsă din knownVariants) → __other (anti-bloat) ──
console.log('\nJ) GET /p/{slug}?utm_* necunoscut → __other (anti-bloat)');
state.lpDoc = { ...servedDoc, knownVariants: {} }; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: `/p/${slug}`, query: { utm_source: 'spam', utm_content: 'random-' + 'x'.repeat(30) } }), res);
  const varJ = (state.calls['landingPages/variants:set'] || [])[0];
  ok(varJ && varJ.id === '__other', 'UTM necunoscut → __other (nu creează doc per spam)');
}

// ── TEST K: lpIndexTarget (diff client pentru indexul de descoperire al portalului) ──
console.log('\nK) lpIndexTarget (diff clientUid → unde se scrie/șterge indexul LP)');
{
  const eq = (a, b) => a.deleteUnder === b.deleteUnder && a.upsertUnder === b.upsertUnder;
  ok(eq(fns.lpIndexTarget('', 'c1', true), { deleteUnder: '', upsertUnder: 'c1' }), 'atribuire nouă → upsert sub client, fără delete');
  ok(eq(fns.lpIndexTarget('c1', 'c1', true), { deleteUnder: '', upsertUnder: 'c1' }), 'neschimbat → re-upsert sub același client');
  ok(eq(fns.lpIndexTarget('c1', 'c2', true), { deleteUnder: 'c1', upsertUnder: 'c2' }), 'reatribuire → delete vechi + upsert nou');
  ok(eq(fns.lpIndexTarget('c1', '', true), { deleteUnder: 'c1', upsertUnder: '' }), 'deconectare → delete vechi, fără upsert');
  ok(eq(fns.lpIndexTarget('c1', 'c1', false), { deleteUnder: 'c1', upsertUnder: '' }), 'ștergere LP → delete sub client');
  ok(eq(fns.lpIndexTarget('', '', true), { deleteUnder: '', upsertUnder: '' }), 'fără client → nicio acțiune');
}

// ── TEST L: canMutateAdmin (RBAC owner/operator + protecția ultimului owner) ──
console.log('\nL) canMutateAdmin (autorizare + anti-blocare ultimul owner)');
{
  const cm = fns.canMutateAdmin;
  ok(cm({ action: 'approve', callerRole: 'operator', owners: ['o1'] }).code === 'not-owner', 'operatorul nu poate gestiona (not-owner)');
  ok(cm({ action: 'approve', callerRole: 'owner', targetUid: 'x', owners: ['o1'] }).ok === true, 'owner aprobă → ok');
  ok(cm({ action: 'setRole', callerRole: 'owner', targetUid: 'x', newRole: 'owner', targetCurrentRole: 'operator', owners: ['o1'] }).ok === true, 'promovare la owner → mereu ok');
  ok(cm({ action: 'revoke', callerRole: 'owner', targetUid: 'op1', targetCurrentRole: 'operator', owners: ['o1'] }).ok === true, 'revoke operator → ok');
  ok(cm({ action: 'revoke', callerRole: 'owner', targetUid: 'o1', targetCurrentRole: 'owner', owners: ['o1'] }).code === 'last-owner', 'revoke ultimul owner → last-owner');
  ok(cm({ action: 'revoke', callerRole: 'owner', targetUid: 'o1', targetCurrentRole: 'owner', owners: ['o1', 'o2'] }).ok === true, 'revoke owner cu alt owner → ok');
  ok(cm({ action: 'setRole', callerRole: 'owner', targetUid: 'o1', newRole: 'operator', targetCurrentRole: 'owner', owners: ['o1'] }).code === 'last-owner', 'demoteaza ultimul owner → last-owner');
  ok(cm({ action: 'setRole', callerRole: 'owner', targetUid: 'o1', newRole: 'operator', targetCurrentRole: 'owner', owners: ['o1', 'o2'] }).ok === true, 'demoteaza owner cu alt owner → ok');
}

// ── TEST M: performManageAdmin (tranzacția COMPLETĂ pe un Firestore în memorie). Prinde bug-uri pe
// care canMutateAdmin pur nu le vede — ex. un câmp nedeclarat în scrierea de audit (regresie actorEmail). ──
console.log('\nM) performManageAdmin (tranzacție reală: approve/setRole/revoke/audit + anti-blocare)');
{
  const FOUNDER = fns.BOOTSTRAP_ADMIN_UID || 'IMBKFBkONkOB7VVZCmqgS90JdBi2';
  // Firestore în memorie cu tranzacție + query where('field','==',val). Cheie 'coll/id' → data.
  function makeStore(seed) {
    const store = new Map(Object.entries(seed || {}));
    const key = (coll, id) => `${coll}/${id}`;
    const ref = (coll, id) => ({ _coll: coll, _id: id });
    const snap = (coll, id) => { const k = key(coll, id); const has = store.has(k); const d = store.get(k); return { exists: has, id, data: () => (has ? d : undefined) }; };
    let auto = 0;
    const tx = {
      async get(r) {
        if (r._field) { const docs = []; for (const [k, v] of store) { const slash = k.indexOf('/'); if (k.slice(0, slash) === r._coll && v && v[r._field] === r._val) docs.push({ id: k.slice(slash + 1), data: () => v }); } return { docs }; }
        return snap(r._coll, r._id);
      },
      set(r, data, opts) { const k = key(r._coll, r._id); store.set(k, opts && opts.merge ? Object.assign({}, store.get(k) || {}, data) : Object.assign({}, data)); },
      update(r, data) { const k = key(r._coll, r._id); if (!store.has(k)) throw new Error('update inexistent: ' + k); store.set(k, Object.assign({}, store.get(k), data)); },
      delete(r) { store.delete(key(r._coll, r._id)); },
    };
    const db = {
      collection(coll) { return { doc(id) { return ref(coll, id === undefined ? `auto${auto++}` : id); }, where(field, op, val) { return { _coll: coll, _field: field, _op: op, _val: val }; } }; },
      async runTransaction(fn) { return fn(tx); },
    };
    return { db, store };
  }
  const run = async (seed, caller, data) => { const { db, store } = makeStore(seed); let err = null, res = null; try { res = await fns.performManageAdmin(db, caller, data); } catch (e) { err = e; } return { store, err, res }; };
  const owner = (uid) => ({ [`admins/${uid}`]: { role: 'owner', email: `${uid}@x.ro` } });
  const operator = (uid) => ({ [`admins/${uid}`]: { role: 'operator', email: `${uid}@x.ro` } });

  // 1) Non-admin (token) → permission-denied (pre-gate, înainte de orice citire).
  ok((await run({}, { uid: 'x', admin: false }, { action: 'approve', targetUid: 'y' })).err?.message?.includes('Acces interzis'), 'non-admin token → permission-denied');
  // 2) Operator (token admin) dar rol operator în Firestore → not-owner (autorizare LIVE din Firestore).
  ok(/not-owner/.test((await run(operator('op1'), { uid: 'op1', admin: true }, { action: 'approve', targetUid: 'n' })).err?.message || ''), 'operator → not-owner (autoritate Firestore, nu token)');
  // 3) Owner aprobă o cerere → admins/{target} operator + AUDIT cu actorEmail corect (regresia găsită manual).
  {
    const seed = Object.assign(owner('o1'), { 'adminRequests/req1': { email: 'req1@x.ro', displayName: 'Req One', status: 'pending' } });
    const { err, store, res } = await run(seed, { uid: 'o1', admin: true, email: 'o1@x.ro' }, { action: 'approve', targetUid: 'req1', role: 'operator' });
    ok(!err, 'owner approve → fără eroare');
    ok(store.get('admins/req1')?.role === 'operator', 'approve → admins/req1 rol operator');
    ok(store.get('admins/req1')?.email === 'req1@x.ro', 'approve → email copiat din cerere');
    const aud = [...store.keys()].filter((k) => k.startsWith('adminAudit/')).map((k) => store.get(k));
    ok(aud.length === 1, 'approve → exact un rând de audit');
    ok(aud[0]?.actorEmail === 'o1@x.ro' && aud[0]?.actorUid === 'o1' && aud[0]?.targetEmail === 'req1@x.ro', 'audit: actorEmail/actorUid/targetEmail corecte (regresie actorEmail)');
    ok(res?.role === 'operator', 'approve → întoarce role operator');
  }
  // 4) Promovare operator → owner.
  {
    const { err, store } = await run(Object.assign(owner('o1'), operator('op1')), { uid: 'o1', admin: true, email: 'o1@x.ro' }, { action: 'setRole', targetUid: 'op1', role: 'owner' });
    ok(!err && store.get('admins/op1')?.role === 'owner', 'setRole → op1 devine owner');
  }
  // 5) Revoke ultimul owner → last-owner (blocat); doc-ul owner rămâne intact.
  {
    const { err, store } = await run(owner('o1'), { uid: 'o1', admin: true, email: 'o1@x.ro' }, { action: 'revoke', targetUid: 'o1' });
    ok(/last-owner/.test(err?.message || ''), 'revoke ultimul owner → last-owner');
    ok(store.get('admins/o1'), 'revoke blocat → doc owner rămâne');
  }
  // 6) Revoke owner cu al doilea owner prezent → șters.
  {
    const { err, store } = await run(Object.assign(owner('o1'), owner('o2')), { uid: 'o1', admin: true, email: 'o1@x.ro' }, { action: 'revoke', targetUid: 'o2' });
    ok(!err && !store.get('admins/o2'), 'revoke owner cu alt owner → șters');
  }
  // 7) Founder fără rol stocat = owner implicit + self-heal (persistă role:'owner').
  {
    const seed = { [`admins/${FOUNDER}`]: { email: 'founder@x.ro' }, 'adminRequests/req2': { email: 'req2@x.ro', displayName: 'R2' } };
    const { err, store } = await run(seed, { uid: FOUNDER, admin: true, email: 'founder@x.ro' }, { action: 'approve', targetUid: 'req2', role: 'operator' });
    ok(!err, 'founder fără rol → tratat owner (approve trece)');
    ok(store.get(`admins/${FOUNDER}`)?.role === 'owner', 'self-heal → founder primește role owner persistat');
  }
  // 8) setRole pe un uid care nu e admin → not-found.
  ok(/Nu e administrator/.test((await run(owner('o1'), { uid: 'o1', admin: true, email: 'o1@x.ro' }, { action: 'setRole', targetUid: 'ghost', role: 'owner' })).err?.message || ''), 'setRole pe ne-admin → not-found');
  // 9) Acțiune invalidă / targetUid invalid → invalid-argument.
  ok(/invalid/i.test((await run(owner('o1'), { uid: 'o1', admin: true }, { action: 'nope', targetUid: 'x' })).err?.message || ''), 'acțiune necunoscută → invalid-argument');
  ok(/invalid/i.test((await run(owner('o1'), { uid: 'o1', admin: true }, { action: 'approve', targetUid: 'bad id!' })).err?.message || ''), 'targetUid invalid → invalid-argument');
}

// ── TEST N: pasul „Oportunități" — buildChannelsPrompt + CHANNELS_SCHEMA (functions e JS netipizat,
// deci require-ul + apelul prind syntax/ReferenceError pe care build-ul nu le vede). ──
console.log('\nN) aiRecommendChannels — prompt + schema (pasul Oportunități)');
{
  const lead = { companyName: 'Presto Construct', industry: 'construction', industryOther: '', description: 'Materiale construcții și vopseluri pentru renovări', website: 'https://presto.ro', facebook: 'https://fb.com/presto', instagram: '', tiktok: '', objectives: ['leads', 'sales'], adBudget: 'b500_1000' };
  const prompt = fns.buildChannelsPrompt(lead);
  ok(typeof prompt === 'string' && prompt.includes('Presto Construct'), 'promptul conține numele firmei');
  ok(prompt.includes('construction'), 'promptul conține industria');
  ok(/500.?1000/.test(prompt), 'promptul conține bugetul lizibil');
  ok(prompt.includes('lead-uri') && prompt.includes('vânzări online'), 'promptul conține obiectivele declarate (lizibil)');
  ok(fns.buildChannelsPrompt(null).length > 0, 'buildChannelsPrompt(null) nu aruncă');
  const sc = fns.CHANNELS_SCHEMA;
  const items = sc?.properties?.channels?.items;
  ok(sc?.required?.includes('channels') && sc.additionalProperties === false, 'CHANNELS_SCHEMA: channels required + additionalProperties false');
  ok(items?.additionalProperties === false && Array.isArray(items?.required) && items.required.includes('title') && items.required.includes('impact'), 'item schema: required title/impact + additionalProperties false');
  ok(JSON.stringify(items?.properties?.impact?.enum) === JSON.stringify(['ridicat', 'mediu-ridicat', 'mediu', 'scazut']), 'impact enum corect (paritate cu TS IMPACT_LEVELS)');
  ok(JSON.stringify(items?.properties?.suggestedObjective?.enum) === JSON.stringify(['leads', 'sales', 'awareness', 'traffic']), 'suggestedObjective enum corect');
}

// ── TEST O: clientExists — gardă defense-in-depth pe oglindirile cu clientUid denormalizat
// (deliverables/lpIndex). Un client inexistent NU trebuie să producă oglindire. ──
console.log('\nO) clientExists (gardă oglindire pe clientUid)');
{
  const mkDb = (existing) => ({ collection: (c) => ({ doc: (id) => ({ async get() { return { exists: c === 'clients' && existing.has(id) }; } }) }) });
  const db = mkDb(new Set(['real-uid']));
  ok((await fns.clientExists(db, 'real-uid')) === true, 'client existent → true (oglindim)');
  ok((await fns.clientExists(db, 'fake-uid')) === false, 'client inexistent → false (NU oglindim)');
  ok((await fns.clientExists(db, '')) === false, 'uid gol → false');
  ok((await fns.clientExists(db, null)) === false, 'uid null → false');
  const errDb = { collection: () => ({ doc: () => ({ async get() { throw new Error('boom'); } }) }) };
  ok((await fns.clientExists(errDb, 'x')) === false, 'eroare la get → false (fail-closed)');
}

rmSync(tmp, { force: true });
console.log(`\nE2E-LP-SERVE: ${failed ? failed + ' verificări EȘUATE' : 'TOATE verificările au trecut'}`);
process.exit(failed ? 1 : 0);
