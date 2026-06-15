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
  status: 'published', lang: 'ro', editor: 'visual', html: '',
  blocks: [
    { type: 'hero', props: { heading: 'Titlu Hero de Test', subheading: 'Subtitlu de test', ctaText: 'Acțiune', ctaHref: '#' } },
    { type: 'features', props: { items: [{ title: 'Rapid', text: 'desc' }, { title: 'Sigur', text: 'desc' }] } },
    { type: 'form', props: { heading: 'Contactează-ne' } },
  ],
  // Valori realiste, exact din intervalul slider-elor (size 1..20, opacity 0.05..1) — ca ce produce studio-ul.
  pageDecor: { effect: 'constellation', interaction: 'mouseReact', density: 60, speed: 40, size: 3, color: '', opacity: 0.55, intensity: 50 },
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
const pageDecorHtml = C.compileDecor(lp.pageDecor, 'pg', 'page');
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
  ok(b.includes(':root{') && b.includes('#2dd4bf'), 'CSS design pe :root + accent temă Ocean (#2dd4bf)');
  ok(b.includes('position:relative;z-index:0'), 'body stacking (canvas decor în spate fără a împacheta conținutul)');
  ok(b.includes('@import') && /Poppins/i.test(b), 'font @import (Poppins) aplicat');
  ok(b.includes('id="lpd-pg"') && b.includes('<canvas'), 'decor pagină injectat (canvas constellation)');
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

rmSync(tmp, { force: true });
console.log(`\nE2E-LP-SERVE: ${failed ? failed + ' verificări EȘUATE' : 'TOATE verificările au trecut'}`);
process.exit(failed ? 1 : 0);
