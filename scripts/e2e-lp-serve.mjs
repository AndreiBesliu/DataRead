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
// state.siteConfig: documentele cosmetice citite de serveLp (publicTheme/publicChrome) — stub-uite per test.
const state = { lpDoc: null, calls: {}, siteConfig: {} };
const rec = (k, v) => { (state.calls[k] = state.calls[k] || []).push(v); };
// Doc-ref fals cu identitate (_recKey/_id) ca batch-ul să poată înregistra pe colecția corectă.
function makeDoc(recKey, id, isLp) {
  return {
    _recKey: recKey, _id: id,
    async get() {
      if (isLp) return { exists: state.lpDoc !== null, data: () => state.lpDoc };
      if (recKey === 'siteConfig') { const d = state.siteConfig[id] || null; return { exists: d !== null, data: () => d }; }
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
fakeFirestore.FieldValue = { increment: (n) => ({ __inc: n }), serverTimestamp: () => ({ __ts: true }), delete: () => ({ __del: true }) };
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
// Nudge-uri de conversie (slice 3b): sticky CTA + exit popup, compilate la salvare (ca LpEditor).
const conversionHtml = C.compileConversion({ stickyCta: { enabled: true, text: 'Sună acum', href: '#contact' }, exitPopup: { enabled: true, heading: 'Stai!', text: 'Ofertă specială', ctaText: 'Vreau', ctaHref: '#a' } });
const servedDoc = { ...lp, html, pageDecorHtml, conversionHtml, hasForm: true, form };

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
  ok(b.includes('name="lp_hp_url"') && b.includes('left:-9999px'), 'honeypot anti-spam injectat (off-screen)');
  ok(b.includes('Sună acum') && b.includes('position:fixed'), 'sticky CTA injectat (conversionHtml)');
  ok(b.includes('id="lp-exit"') && b.includes('Stai!'), 'exit popup injectat (conversionHtml)');
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

// ── TEST S: pagini de site (kind:'site') servite la /pagina/{slug}; separare strictă de /p/. ──
console.log('\nS) pagini de site /pagina/{slug} (kind:site) + separare de /p/');
{
  state.lpDoc = { ...servedDoc, kind: 'site' }; reset();
  const r1 = mkRes(); await serveLp(mkReq({ path: `/pagina/${slug}` }), r1);
  ok(r1._status === 200 && /Titlu Hero de Test/.test(String(r1._body || '')), '/pagina servește pagina de site publicată');
  ok(/rel="canonical"[^>]*\/pagina\//.test(String(r1._body || '')), 'canonical pe /pagina/{slug}');
  const r2 = mkRes(); await serveLp(mkReq({ path: `/p/${slug}` }), r2);
  ok(r2._status === 404, 'pagina de site NU se servește pe /p/ (separare)');
  state.lpDoc = { ...servedDoc, kind: 'campaign' }; reset();
  const r3 = mkRes(); await serveLp(mkReq({ path: `/pagina/${slug}` }), r3);
  ok(r3._status === 404, 'campanie pe /pagina/ → 404');
  const r4 = mkRes(); await serveLp(mkReq({ path: `/p/${slug}` }), r4);
  ok(r4._status === 200, 'campanie pe /p/ → 200 (neschimbat)');
}
state.lpDoc = servedDoc;

// ── TEST T: chrome global (header/footer + meniu) injectat DOAR pe paginile de site (/pagina), bilingv după
// lp.lang, escapat + href intern; NEATINS pe campanii (/p/). Cache-ul de modul resetat între cazuri. ──
console.log('\nT) chrome global header/footer (kind:site) — bilingv + securitate + separare de /p/');
{
  // Paritate TS↔JS a chrome-ului default (snapshotul React == fallback-ul din functions).
  ok(JSON.stringify(C.PUBLIC_CHROME_DEFAULT) === JSON.stringify(fns.DEFAULT_SITE_CHROME), 'PUBLIC_CHROME_DEFAULT (TS) === DEFAULT_SITE_CHROME (JS)');

  // 1) Fără doc publicChrome → default copt aplicat pe pagina de site.
  fns.__resetPublicCaches(); state.siteConfig = {}; state.lpDoc = { ...servedDoc, kind: 'site', lang: 'ro' }; reset();
  {
    const r = mkRes(); await serveLp(mkReq({ path: `/pagina/${slug}` }), r);
    const b = String(r._body || '');
    ok(/<header[^>]*border-bottom/.test(b) && b.includes('>DataRead</a>'), 'fără doc → header default cu brand DataRead');
    ok(/<footer[^>]*border-top/.test(b) && b.includes('>DATAREAD</span>'), 'fără doc → footer default cu brand majuscul');
  }

  // 2) Doc publicChrome stub (etichete distincte ro/en + un href extern de respins) → cache resetat.
  fns.__resetPublicCaches();
  state.siteConfig.publicChrome = { schema: 1, chrome: {
    brandName: 'Brand Test', taglineRo: 'Slogan RO', taglineEn: 'Tagline EN',
    nav: [
      { labelRo: 'Acasă', labelEn: 'Home', href: '/' },
      { labelRo: 'Pachete', labelEn: 'Packages', href: '/pachete' },
      { labelRo: 'Rău', labelEn: 'Bad', href: 'https://evil.com/phish' },
    ],
    ctaLabelRo: 'Începe', ctaLabelEn: 'Start', ctaHref: '/start',
    footerTextRo: 'Footer RO', footerTextEn: 'Footer EN',
    footerLinks: [{ labelRo: 'Termeni', labelEn: 'Terms', href: '/legal/termeni' }],
  } };

  // 2a) RO.
  state.lpDoc = { ...servedDoc, kind: 'site', lang: 'ro' }; reset();
  {
    const r = mkRes(); await serveLp(mkReq({ path: `/pagina/${slug}` }), r);
    const b = String(r._body || '');
    ok(b.includes('>Brand Test</a>'), 'RO: brand din config în header');
    ok(b.includes('>Slogan RO</span>') && !b.includes('Tagline EN'), 'RO: slogan RO (nu EN)');
    ok(b.includes('>Pachete</a>') && b.includes('href="/pachete"'), 'RO: nav RO „Pachete" → /pachete');
    ok(b.includes('>Începe</a>'), 'RO: CTA RO „Începe"');
    ok(b.includes('Footer RO') && b.includes('>Termeni</a>'), 'RO: footer text + link RO');
    ok(!b.includes('evil.com'), 'href extern respins (anti open-redirect) — „evil.com" absent');
    ok(b.includes('>Rău</a>'), 'eticheta item-ului rău păstrată, link neutralizat (paritate cu React „/#")');
  }
  // 2b) EN — aceeași config (cache păstrat), doar lp.lang diferă → etichete EN + path-uri /en.
  state.lpDoc = { ...servedDoc, kind: 'site', lang: 'en' }; reset();
  {
    const r = mkRes(); await serveLp(mkReq({ path: `/pagina/${slug}` }), r);
    const b = String(r._body || '');
    ok(b.includes('>Packages</a>') && b.includes('href="/en/pachete"'), 'EN: nav EN „Packages" → /en/pachete (localizat)');
    ok(b.includes('>Tagline EN</span>') && !b.includes('Slogan RO'), 'EN: slogan EN (nu RO)');
    ok(b.includes('>Start</a>') && b.includes('href="/en/start"'), 'EN: CTA EN „Start" → /en/start');
    ok(b.includes('Footer EN') && b.includes('>Terms</a>') && b.includes('href="/en/legal/termeni"'), 'EN: footer EN + link localizat');
  }
  // 3) Campanie pe /p/ cu același doc chrome prezent → ZERO chrome (brandul din config absent).
  state.lpDoc = { ...servedDoc, kind: 'campaign', lang: 'ro' }; reset();
  {
    const r = mkRes(); await serveLp(mkReq({ path: `/p/${slug}` }), r);
    const b = String(r._body || '');
    ok(r._status === 200 && !b.includes('Brand Test') && !b.includes('Footer RO'), '/p/ campanie → fără chrome global (neatins)');
  }
}
fns.__resetPublicCaches(); state.siteConfig = {}; state.lpDoc = servedDoc;

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

// ── TEST F2: honeypot completat → fake-success (ok:true) FĂRĂ nicio scriere ──
console.log('\nF2) POST /p/_submit cu honeypot completat → fake-success fără scriere');
state.lpDoc = servedDoc; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: '/p/_submit', method: 'POST', body: { slug, values: { email: 'bot@spam.io', nume: 'Bot', lp_hp_url: 'http://spam' } } }), res);
  ok(res._status === 200 && res._body && res._body.ok === true, 'status 200 + {ok:true} (botul nu primește semnal)');
  ok(!(state.calls['landingPages/submissions:add']), 'NICIUN submission salvat (honeypot)');
  ok(!(state.calls['leads:add']), 'NICIUN lead creat (honeypot)');
  ok(!(state.calls['landingPages/stats:set']), 'NICIO statistică incrementată (honeypot)');
}

// ── TEST F3: redirectUrl https valid în doc → întors în răspuns ───────────────
console.log('\nF3) POST /p/_submit, form.redirectUrl https → răspuns conține redirectUrl');
state.lpDoc = { ...servedDoc, form: { ...servedDoc.form, redirectUrl: 'https://exemplu.ro/multumesc' } }; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: '/p/_submit', method: 'POST', body: { slug, values: { email: 'a@b.ro' } } }), res);
  ok(res._status === 200 && res._body && res._body.ok === true, 'status 200 + {ok:true}');
  ok(res._body.redirectUrl === 'https://exemplu.ro/multumesc', 'redirectUrl https returnat în răspuns');
  ok((state.calls['landingPages/submissions:add'] || []).length === 1, 'submission tot salvat (redirect nu blochează)');
}

// ── TEST F4: redirectUrl non-https în doc → omis din răspuns ──────────────────
console.log('\nF4) POST /p/_submit, form.redirectUrl non-https → omis din răspuns');
state.lpDoc = { ...servedDoc, form: { ...servedDoc.form, redirectUrl: 'http://insecure.ro/x' } }; reset();
{
  const res = mkRes();
  await serveLp(mkReq({ path: '/p/_submit', method: 'POST', body: { slug, values: { email: 'a@b.ro' } } }), res);
  ok(res._status === 200 && res._body && res._body.ok === true, 'status 200 + {ok:true}');
  ok(!('redirectUrl' in res._body), 'redirectUrl non-https omis (anti open-redirect)');
}
state.lpDoc = servedDoc;

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

// ── TEST Q: „Self Marketing" — buildStrategyPrompt + STRATEGY_SCHEMA + coerceSelfProfileServer
// (functions e JS netipizat → require-ul + apelul prind syntax/ReferenceError pe care build-ul nu-i vede). ──
console.log('\nQ) selfGenerateStrategy — prompt + schema + coerce profil server-side');
{
  const profile = { companyName: 'Presto Construct', industry: 'construction', industryOther: '', productsServices: 'Materiale construcții și vopseluri', audience: 'Proprietari case Cluj', area: 'Cluj-Napoca', competitors: 'Dedeman', budget: '500-1000 €/lună', goals: 'Mai multe cereri de ofertă' };
  const prompt = fns.buildStrategyPrompt(profile);
  ok(typeof prompt === 'string' && prompt.includes('Presto Construct'), 'promptul conține numele firmei');
  ok(prompt.includes('Materiale construcții') && prompt.includes('Proprietari case Cluj'), 'promptul conține oferta + publicul');
  ok(prompt.includes('Cluj-Napoca') && prompt.includes('500-1000'), 'promptul conține zona + bugetul');
  ok(/MAI MULTE|direcții/.test(prompt), 'promptul cere mai multe direcții');
  ok(fns.buildStrategyPrompt(null).length > 0, 'buildStrategyPrompt(null) nu aruncă');
  // coerce server: hard-cap pe câmpuri (anti-flood) + tipuri greșite → string gol.
  const coerced = fns.coerceSelfProfileServer({ companyName: 'x'.repeat(500), goals: 42, audience: ['nope'], industry: 'magic' });
  ok(coerced.companyName.length === 120, 'coerce server: companyName plafonat la 120');
  ok(coerced.goals === '' && coerced.audience === '', 'coerce server: tipuri ne-string → ""');
  ok(coerced.industry === '', 'coerce server: industry în afara allowlist → "" (paritate cu TS INDUSTRIES)');
  ok(fns.coerceSelfProfileServer({ industry: 'horeca' }).industry === 'horeca', 'coerce server: industry valid păstrat');
  // schema parity
  const sc = fns.STRATEGY_SCHEMA;
  const items = sc?.properties?.directions?.items;
  ok(sc?.required?.includes('overview') && sc.required.includes('directions') && sc.additionalProperties === false, 'STRATEGY_SCHEMA: overview+directions required + additionalProperties false');
  ok(items?.additionalProperties === false && Array.isArray(items?.required), 'item direcție: additionalProperties false + required listă');
  ok(['title', 'positioningAngle', 'targetSegment', 'channelMix', 'keyMessages', 'campaignIdeas', 'kpis'].every((k) => items.required.includes(k)), 'item direcție: toate cele 7 câmpuri required (paritate cu TS)');
  // Pasul Detalii: buildDetailsPrompt + DETAILS_SCHEMA + paritate DETAILS_LIMITS.
  const dprompt = fns.buildDetailsPrompt(profile, { title: 'Achiziție plătită locală', positioningAngle: 'rapid', targetSegment: 'IMM', channelMix: 'Meta+Google', keyMessages: 'x' });
  ok(typeof dprompt === 'string' && dprompt.includes('Achiziție plătită locală') && dprompt.includes('Presto Construct'), 'buildDetailsPrompt conține direcția + firma');
  ok(fns.buildDetailsPrompt(null, null).length > 0, 'buildDetailsPrompt(null,null) nu aruncă');
  const ds = fns.DETAILS_SCHEMA;
  ok(ds && ds.additionalProperties === false && ['budgetSplit', 'audienceDetail', 'messaging', 'funnel', 'campaignBrief', 'timeline'].every((k) => ds.required.includes(k)), 'DETAILS_SCHEMA: cele 6 câmpuri required + additionalProperties false');
  ok(JSON.stringify(C.DETAILS_LIMITS) === JSON.stringify(fns.DETAILS_LIMITS), 'DETAILS_LIMITS identic TS↔JS');
  // Pasul Oportunități (S2): buildOpportunitiesPrompt + OPPORTUNITIES_SCHEMA + paritate OPPORTUNITY_LIMITS.
  const oprompt = fns.buildOpportunitiesPrompt(profile);
  ok(typeof oprompt === 'string' && oprompt.includes('Presto Construct') && /10 OPORTUNIT/i.test(oprompt), 'buildOpportunitiesPrompt: firma + cere 10 oportunități');
  ok(fns.buildOpportunitiesPrompt(null).length > 0, 'buildOpportunitiesPrompt(null) nu aruncă');
  const os = fns.OPPORTUNITIES_SCHEMA;
  const oit = os?.properties?.items?.items;
  ok(os?.required?.includes('items') && os.additionalProperties === false, 'OPPORTUNITIES_SCHEMA: items required + additionalProperties false');
  ok(oit?.additionalProperties === false && ['title', 'channel', 'impact', 'why', 'description', 'firstStep'].every((k) => oit.required.includes(k)), 'item oportunitate: 6 câmpuri required + additionalProperties false');
  ok(JSON.stringify(oit?.properties?.impact?.enum) === JSON.stringify(['high', 'medium', 'low']), 'OPPORTUNITIES_SCHEMA: impact enum high/medium/low');
  ok(JSON.stringify(C.OPPORTUNITY_LIMITS) === JSON.stringify(fns.OPPORTUNITY_LIMITS), 'OPPORTUNITY_LIMITS identic TS↔JS');
  // Pasul Execuție (S3): buildExecutionPrompt + EXECUTION_SCHEMA + paritate EXECUTION_LIMITS.
  const eprompt = fns.buildExecutionPrompt(profile, { title: 'Achiziție plătită locală', positioningAngle: 'rapid', targetSegment: 'IMM', channelMix: 'Meta+Google' });
  ok(typeof eprompt === 'string' && eprompt.includes('Presto Construct') && eprompt.includes('Achiziție plătită locală') && /30 de zile/i.test(eprompt), 'buildExecutionPrompt: firma + direcția + 30 de zile');
  ok(fns.buildExecutionPrompt(null, null).length > 0, 'buildExecutionPrompt(null,null) nu aruncă');
  const es = fns.EXECUTION_SCHEMA;
  const ew = es?.properties?.weeks?.items;
  ok(es?.additionalProperties === false && ['summary', 'weeks', 'abTests', 'optimization'].every((k) => es.required.includes(k)), 'EXECUTION_SCHEMA: summary/weeks/abTests/optimization required + additionalProperties false');
  ok(ew?.additionalProperties === false && ['title', 'focus', 'actions', 'kpi'].every((k) => ew.required.includes(k)), 'item săptămână: title/focus/actions/kpi required');
  ok(JSON.stringify(C.EXECUTION_LIMITS) === JSON.stringify(fns.EXECUTION_LIMITS), 'EXECUTION_LIMITS identic TS↔JS');
}

// ── Paritate TS↔JS pe constantele Self Marketing (limits/allowlist/quota): orice drift = silent data loss. ──
console.log('\nQ2) paritate constante Self Marketing TS↔JS');
{
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ok(eq(C.SELF_PROFILE_LIMITS, fns.SELF_PROFILE_LIMITS), 'SELF_PROFILE_LIMITS identic TS↔JS');
  ok(eq(C.STRATEGY_DIRECTION_LIMITS, fns.STRATEGY_DIRECTION_LIMITS), 'STRATEGY_DIRECTION_LIMITS identic TS↔JS');
  ok(eq(C.INDUSTRIES, fns.SELF_INDUSTRIES), 'INDUSTRIES (TS) === SELF_INDUSTRIES (JS allowlist)');
  ok(C.SELF_FREE_TOTAL === fns.SELF_FREE_TOTAL && C.SELF_DAILY_CAP === fns.SELF_DAILY_CAP, 'SELF_FREE_TOTAL/SELF_DAILY_CAP identice TS↔JS');
  // Config fair-share: coerce + selectorul de coș trebuie să fie IDENTICE TS↔JS (altfel plafoanele/poolurile diverg).
  ok(eq(C.SELF_MKT_CONFIG_DEFAULT, fns.SELF_MKT_CONFIG_DEFAULT), 'SELF_MKT_CONFIG_DEFAULT identic TS↔JS');
  for (const raw of [null, {}, { entitledDailyCap: -5, trialDailyCap: 999999999, requireEmailVerified: false }, { trialDailyCap: 33.7 }, 'gunoi', { requireEmailVerified: 'x' }]) {
    ok(eq(C.coerceToSelfMarketingConfig(raw), fns.coerceSelfMarketingConfigServer(raw)), `coerce config Self Marketing identic TS↔JS: ${JSON.stringify(raw)}`);
  }
  for (const cfg of [C.SELF_MKT_CONFIG_DEFAULT, { entitledDailyCap: 10, trialDailyCap: 3 }]) {
    ok(eq(C.selfPoolFor(true, cfg), fns.selfPoolFor(true, cfg)) && eq(C.selfPoolFor(false, cfg), fns.selfPoolFor(false, cfg)), 'selfPoolFor identic TS↔JS (entitled + trial)');
  }
  ok(C.SELF_POOL_ENTITLED_DOC === fns.SELF_POOL_ENTITLED_DOC && C.SELF_POOL_TRIAL_DOC === fns.SELF_POOL_TRIAL_DOC, 'docId-uri coșuri identice TS↔JS');
}

// ── selfGlobalPoolFor: CITEȘTE clients/{uid}.entitlement și clasifică pe `active` (recalculat), NU pe `status` brut.
// Acoperă bug-ul prins de review: un abonament expirat (status:'active' dar active:false) NU trebuie să cadă pe coșul
// rezervat plătitorilor; un `trialing` valid (active:true) trebuie să cadă pe coșul entitled. ──
console.log('\nR2) selfGlobalPoolFor (clasificare coș după entitlement.active)');
{
  const cfg = fns.SELF_MKT_CONFIG_DEFAULT;
  const mkDb = (ent) => ({ collection: () => ({ doc: () => ({ async get() { return { exists: ent !== null, data: () => (ent === null ? {} : { entitlement: ent }) }; } }) }) });
  const docOf = async (ent) => (await fns.selfGlobalPoolFor(mkDb(ent), 'u', cfg)).docId;
  ok(await docOf({ active: true, status: 'active' }) === fns.SELF_POOL_ENTITLED_DOC, 'activ (active:true) → coș entitled');
  ok(await docOf({ active: false, status: 'active' }) === fns.SELF_POOL_TRIAL_DOC, 'expirat (status:active dar active:false) → coș trial (NU înfometează plătitorii)');
  ok(await docOf({ active: true, status: 'trialing' }) === fns.SELF_POOL_ENTITLED_DOC, 'trialing valid (active:true) → coș entitled');
  ok(await docOf(null) === fns.SELF_POOL_TRIAL_DOC, 'fără entitlement → coș trial');
  ok(await docOf({ status: 'active' }) === fns.SELF_POOL_TRIAL_DOC, 'active lipsă → coș trial (fail-safe)');
  const errDb = { collection: () => ({ doc: () => ({ async get() { throw new Error('boom'); } }) }) };
  ok((await fns.selfGlobalPoolFor(errDb, 'u', cfg)).docId === fns.SELF_POOL_TRIAL_DOC, 'eroare la citire → coș trial (fail-closed pe cost)');
}

// ── TEST R: quota/refund Self Marketing (tranzacții pe Firestore în memorie nested). Acoperă calea
// client-facing AI riscantă (paid Opus) pe care testele pure NU o ating — lecția actorEmail. ──
console.log('\nR) consumeSelfQuota / consumeGlobalSelfQuota / refundSelfQuota (tranzacțional)');
{
  const TODAY = new Date().toISOString().slice(0, 10);
  const QPATH = 'clients/u1/selfMarketing/quota';
  // Firestore în memorie cu căi nested (clients/{uid}/selfMarketing/quota) + runTransaction.
  function makeSelfStore(seed) {
    const store = new Map(Object.entries(seed || {}));
    function colRef(path) { return { doc(id) { return docRef(`${path}/${id}`); } }; }
    function docRef(path) { return { _path: path, collection(sub) { return colRef(`${path}/${sub}`); } }; }
    const tx = {
      async get(r) { const has = store.has(r._path); return { exists: has, data: () => store.get(r._path) }; },
      set(r, data, opts) { store.set(r._path, opts && opts.merge ? Object.assign({}, store.get(r._path) || {}, data) : Object.assign({}, data)); },
    };
    const db = { collection(c) { return colRef(c); }, async runTransaction(fn) { return fn(tx); } };
    return { db, store };
  }
  const grab = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

  // consumeSelfQuota — cont nou: incrementează total + dayCount pe ziua curentă.
  {
    const { db, store } = makeSelfStore();
    await fns.consumeSelfQuota('u1', db);
    const q = store.get(QPATH);
    ok(q && q.total === 1 && q.dayCount === 1 && q.day === TODAY, 'consumeSelfQuota: cont nou → total/dayCount = 1, ziua curentă');
  }
  // Plafon lifetime: total la maxim → resource-exhausted (lifetime), fără să mai scrie.
  {
    const { db } = makeSelfStore({ [QPATH]: { total: fns.SELF_FREE_TOTAL, day: '2020-01-01', dayCount: 0 } });
    const e = await grab(() => fns.consumeSelfQuota('u1', db));
    ok(e && /toate explorările gratuite/.test(e.message || ''), 'consumeSelfQuota: lifetime atins → resource-exhausted');
  }
  // Plafon zilnic: dayCount la maxim pe ziua curentă → resource-exhausted (azi).
  {
    const { db } = makeSelfStore({ [QPATH]: { total: 0, day: TODAY, dayCount: fns.SELF_DAILY_CAP } });
    const e = await grab(() => fns.consumeSelfQuota('u1', db));
    ok(e && /ziua de azi/.test(e.message || ''), 'consumeSelfQuota: plafon zilnic atins → resource-exhausted (azi)');
  }
  // Rollover de zi: dayCount vechi pe altă zi se resetează (lifetime nu).
  {
    const { db, store } = makeSelfStore({ [QPATH]: { total: 1, day: '2020-01-01', dayCount: fns.SELF_DAILY_CAP } });
    await fns.consumeSelfQuota('u1', db);
    const q = store.get(QPATH);
    ok(q.total === 2 && q.dayCount === 1 && q.day === TODAY, 'consumeSelfQuota: zi nouă → dayCount resetat, total crește');
  }
  // Plafon GLOBAL fair-share: coșul TRIAL atins → resource-exhausted; cont nou → count=1; iar coșul ENTITLED
  // e SEPARAT (un trial epuizat NU blochează un client plătitor — fix-ul de DoS din auditul de cost).
  {
    const cfg = fns.SELF_MKT_CONFIG_DEFAULT;
    const trialPool = fns.selfPoolFor(false, cfg);
    const entitledPool = fns.selfPoolFor(true, cfg);
    const TPATH = `aiUsage/${trialPool.docId}`;
    const EPATH = `aiUsage/${entitledPool.docId}`;
    ok(trialPool.docId !== entitledPool.docId, 'fair-share: coșuri distincte (trial ≠ entitled)');
    const { db } = makeSelfStore({ [TPATH]: { day: TODAY, count: trialPool.cap } });
    const e = await grab(() => fns.consumeGlobalSelfQuota(db, trialPool));
    ok(e && /platformei a fost atinsă/.test(e.message || ''), 'consumeGlobalSelfQuota: coș trial atins → resource-exhausted');
    const { db: db2, store: s2 } = makeSelfStore();
    await fns.consumeGlobalSelfQuota(db2, trialPool);
    ok(s2.get(TPATH).count === 1, 'consumeGlobalSelfQuota: ziua nouă (trial) → count = 1');
    // Coșul trial plin, dar plătitorul consumă din coșul lui rezervat → trece.
    const { db: db3, store: s3 } = makeSelfStore({ [TPATH]: { day: TODAY, count: trialPool.cap } });
    await fns.consumeGlobalSelfQuota(db3, entitledPool);
    ok(s3.get(EPATH).count === 1 && s3.get(TPATH).count === trialPool.cap, 'fair-share: trial plin → plătitorul (coș entitled) trece');
  }
  // refundSelfQuota: decrementează total+dayCount, niciodată sub 0; doc inexistent = no-op fără throw.
  {
    const { db, store } = makeSelfStore({ [QPATH]: { total: 3, dayCount: 1, day: TODAY } });
    await fns.refundSelfQuota('u1', db);
    const q = store.get(QPATH);
    ok(q.total === 2 && q.dayCount === 0, 'refundSelfQuota: decrement total+dayCount');
    const { db: db0, store: s0 } = makeSelfStore({ [QPATH]: { total: 0, dayCount: 0, day: TODAY } });
    await fns.refundSelfQuota('u1', db0);
    ok(s0.get(QPATH).total === 0 && s0.get(QPATH).dayCount === 0, 'refundSelfQuota: nu coboară sub 0');
    const { db: dbN, store: sN } = makeSelfStore();
    const eN = await grab(() => fns.refundSelfQuota('u1', dbN));
    ok(eN === null && !sN.has(QPATH), 'refundSelfQuota: doc inexistent → no-op fără throw');
  }
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

// ── TEST U: conector Meta (ingestie automată) — mapare pură, crypto token, fereastră, runMetaPull cu store
// în memorie + fetch fals. Acoperă calea care va scrie metrici reale (source:'meta') — dormant la deploy. ──
console.log('\nU) conector Meta — mapare + crypto + fereastră + runMetaPull (ingestie)');
{
  // Mapare Insights → DailyMetric
  const row = { date_start: '2026-06-18', spend: '12.50', impressions: '1000', clicks: '40', inline_link_clicks: '35', actions: [{ action_type: 'lead', value: '3' }, { action_type: 'other', value: '9' }], action_values: [{ action_type: 'purchase', value: '150.00' }] };
  const m = fns.mapMetaInsight(row);
  ok(m.date === '2026-06-18' && m.spend === 12.5 && m.impressions === 1000 && m.clicks === 40, 'mapMetaInsight: spend/impr/clicks');
  ok(m.leads === 3 && m.revenue === 150 && m.source === 'meta', 'mapMetaInsight: leads (action lead) + revenue (purchase) + source');
  ok(fns.mapMetaInsight({ spend: '5' }).date === '' , 'mapMetaInsight: fără date_start → date gol (rând sărit)');
  const resp = fns.mapMetaInsightsResponse({ data: [row, { spend: '1' }, { date_start: '2026-06-19', spend: '7' }] });
  ok(resp.length === 2 && resp[1].date === '2026-06-19', 'mapMetaInsightsResponse: sare rândurile fără dată validă');
  // URL Graph API
  const url = fns.buildMetaInsightsUrl('23842', '2026-06-12', '2026-06-18', 'TOK');
  ok(/\/23842\/insights\?/.test(url) && /time_increment=1/.test(url) && /access_token=TOK/.test(url), 'buildMetaInsightsUrl: nod + time_increment=1 + token');
  // Fereastră glisantă
  const w = fns.insightsWindow('2026-06-18', 7);
  ok(w.until === '2026-06-18' && w.since === '2026-06-12', 'insightsWindow: 7 zile inclusiv ziua curentă');
  ok(fns.insightsWindow('2026-06-18', 1).since === '2026-06-18', 'insightsWindow: 1 zi → since==until');
  // Crypto token
  const KEY = 'cheie-test-master-pentru-token';
  const enc = fns.encryptToken('SECRET-TOKEN-123', KEY);
  ok(enc.startsWith('v1.') && enc !== 'SECRET-TOKEN-123', 'encryptToken: format v1, nu plaintext');
  ok(fns.decryptToken(enc, KEY) === 'SECRET-TOKEN-123', 'decryptToken: round-trip cu cheia corectă');
  let tamperThrew = false; try { fns.decryptToken(enc.slice(0, -4) + 'AAAA', KEY); } catch { tamperThrew = true; }
  ok(tamperThrew, 'decryptToken: payload modificat → aruncă (GCM auth)');
  let wrongKeyThrew = false; try { fns.decryptToken(enc, 'alta-cheie'); } catch { wrongKeyThrew = true; }
  ok(wrongKeyThrew, 'decryptToken: cheie greșită → aruncă');

  // runMetaPull cu store în memorie + fetch fals
  function makeAdsStore(seed) {
    const store = new Map(Object.entries(seed || {}));
    function docRef(path) {
      return {
        _path: path,
        collection(sub) { return colRef(`${path}/${sub}`); },
        async get() { const has = store.has(path); return { exists: has, id: path.split('/').pop(), data: () => store.get(path), ref: docRef(path) }; },
        async set(data, opts) { store.set(path, opts && opts.merge ? Object.assign({}, store.get(path) || {}, data) : Object.assign({}, data)); },
        async update(data) { store.set(path, Object.assign({}, store.get(path) || {}, data)); },
        async delete() { store.delete(path); },
        get ref() { return docRef(path); },
      };
    }
    function childDocs(path, field, val) {
      const docs = [];
      for (const [k, v] of store) {
        if (k.startsWith(path + '/')) {
          const rest = k.slice(path.length + 1);
          if (!rest.includes('/') && (field === undefined || (v && v[field] === val))) docs.push({ id: rest, data: () => v, ref: docRef(k) });
        }
      }
      return { docs, empty: docs.length === 0 };
    }
    function colRef(path) {
      return {
        doc(id) { return docRef(`${path}/${id}`); },
        where(field, op, val) { return { async get() { return childDocs(path, field, val); } }; },
        async get() { return childDocs(path); },
      };
    }
    const db = {
      collection(c) { return colRef(c); },
      batch() { const ops = []; return { set(ref, data, opts) { ops.push([ref, data, opts]); }, async commit() { for (const [ref, data, opts] of ops) await ref.set(data, opts); } }; },
    };
    return { db, store };
  }
  const mkRes2 = (ok2, status, json) => ({ ok: ok2, status, json: async () => json });
  const insights = { data: [{ date_start: '2026-06-18', spend: '20', impressions: '500', clicks: '25', actions: [{ action_type: 'lead', value: '4' }], action_values: [{ action_type: 'purchase', value: '300' }] }] };

  // u1 conectat (fetch ok); c2 fără externalId (sărit); c3 google (nu e iterat). u2 → 401 (needs_reconnect).
  const seed = {
    'campaigns/c1': { platform: 'meta', externalId: '111', clientUid: 'u1', totals: { spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0 } },
    'campaigns/c2': { platform: 'meta', externalId: '', clientUid: 'u1' },
    'campaigns/c3': { platform: 'google', externalId: '999', clientUid: 'u1' },
    'campaigns/c4': { platform: 'meta', externalId: '444', clientUid: 'u2' },
    'campaigns/c5': { platform: 'meta', externalId: '555', clientUid: 'u3' }, // u3 fără credențială → sărit
    'clients/u1/platformCredentials/meta': { status: 'active', tokenEnc: fns.encryptToken('TOK-U1', KEY) },
    'clients/u2/platformCredentials/meta': { status: 'active', tokenEnc: fns.encryptToken('TOK-U2', KEY) },
  };
  const { db, store } = makeAdsStore(seed);
  const fetchImpl = (u) => mkRes2(/access_token=TOK-U1/.test(u), /access_token=TOK-U1/.test(u) ? 200 : 401, insights);
  const summary = await fns.runMetaPull(db, { fetchImpl, encKey: KEY, today: '2026-06-18', windowDays: 7 });
  ok(summary.processed === 1, 'runMetaPull: o campanie procesată (c1)');
  ok(summary.skipped === 2, 'runMetaPull: 2 sărite (c2 fără externalId + c5 fără credențială)');
  ok(summary.reconnect === 1, 'runMetaPull: c4/u2 → 401 → needs_reconnect');
  const wrote = store.get('campaigns/c1/metrics/2026-06-18');
  ok(wrote && wrote.source === 'meta' && wrote.spend === 20 && wrote.leads === 4 && wrote.revenue === 300, 'runMetaPull: metrică scrisă (source:meta, valori corecte)');
  ok(store.get('campaigns/c1').totals && store.get('campaigns/c1').totals.spend === 20, 'runMetaPull: totals recalculate pe campanie');
  ok(store.get('clients/u2/platformCredentials/meta').status === 'needs_reconnect', 'runMetaPull: credențiala u2 marcată needs_reconnect');
  ok(!store.get('campaigns/c3/metrics/2026-06-18'), 'runMetaPull: campania google neatinsă (filtru platform)');

  // ── ingestEnabled:false → conexiune pe PAUZĂ (token păstrat, dar jobul NU trage) ──
  {
    const seedP = {
      'campaigns/p1': { platform: 'meta', externalId: '777', clientUid: 'u9', totals: {} },
      'clients/u9/platformCredentials/meta': { status: 'active', ingestEnabled: false, tokenEnc: fns.encryptToken('TOK-U9', KEY) },
    };
    const { db: dbP, store: storeP } = makeAdsStore(seedP);
    const sumP = await fns.runMetaPull(dbP, { fetchImpl: () => mkRes2(true, 200, insights), encKey: KEY, today: '2026-06-18', windowDays: 7 });
    ok(sumP.processed === 0 && sumP.skipped === 1, 'runConnectorPull: ingestEnabled:false → campanie sărită (pe pauză)');
    ok(!storeP.get('campaigns/p1/metrics/2026-06-18'), 'runConnectorPull: pe pauză → nicio metrică scrisă');
    ok(storeP.get('clients/u9/platformCredentials/meta').status === 'active', 'runConnectorPull: pe pauză → status rămâne active (nu needs_reconnect)');
  }

  // ── Google Ads: mapare (cost_micros/1e6!) + query + runConnectorPull generic ──
  const gRow = { segments: { date: '2026-06-18' }, metrics: { costMicros: '12500000', impressions: '900', clicks: '30', conversions: 2, conversionsValue: 220 } };
  const gm = fns.mapGoogleAdsRow(gRow);
  ok(gm.spend === 12.5 && gm.impressions === 900 && gm.leads === 2 && gm.revenue === 220 && gm.source === 'google', 'mapGoogleAdsRow: cost_micros/1e6 + conversions/value');
  ok(fns.mapGoogleAdsRow({ segments: { date: '2026-06-19' }, metrics: { cost_micros: '5000000' } }).spend === 5, 'mapGoogleAdsRow: acceptă și snake_case cost_micros');
  ok(fns.mapGoogleAdsResponse([{ results: [gRow] }, { results: [{ segments: { date: '2026-06-19' }, metrics: { costMicros: '1000000' } }] }]).length === 2, 'mapGoogleAdsResponse: searchStream array de batch-uri');
  ok(/campaign\.id = 4567/.test(fns.buildGoogleAdsQuery('  4567 ', '2026-06-12', '2026-06-18')) && /BETWEEN '2026-06-12' AND '2026-06-18'/.test(fns.buildGoogleAdsQuery('4567', '2026-06-12', '2026-06-18')), 'buildGoogleAdsQuery: id + interval');
  ok(/campaign\.id = 0 /.test(fns.buildGoogleAdsQuery('x); DROP', 'a', 'b')), 'buildGoogleAdsQuery: input ne-numeric → 0 (anti-injecție)');
  {
    const seedG = { 'campaigns/g1': { platform: 'google', externalId: '4567', clientUid: 'u1', totals: {} }, 'clients/u1/platformCredentials/google': { status: 'active', tokenEnc: fns.encryptToken('REFRESH', KEY) } };
    const { db: dbG, store: storeG } = makeAdsStore(seedG);
    const frG = async () => ({ ok: true, status: 200, metrics: fns.mapGoogleAdsResponse([{ results: [gRow] }]) });
    const sumG = await fns.runConnectorPull(dbG, { platform: 'google', fetchRows: frG, encKey: KEY, today: '2026-06-18', windowDays: 7 });
    const wG = storeG.get('campaigns/g1/metrics/2026-06-18');
    ok(sumG.processed === 1 && wG && wG.source === 'google' && wG.spend === 12.5, 'runConnectorPull(google): metrică scrisă cu source:google');
  }

  // ── TikTok: mapare (stat_time_day → date) + runConnectorPull (401 → needs_reconnect) ──
  const tRow = { dimensions: { campaign_id: '99', stat_time_day: '2026-06-18 00:00:00' }, metrics: { spend: '8.5', impressions: '400', clicks: '15', conversion: '1', total_complete_payment_value: '95' } };
  const tm = fns.mapTikTokRow(tRow);
  ok(tm.date === '2026-06-18' && tm.spend === 8.5 && tm.leads === 1 && tm.revenue === 95 && tm.source === 'tiktok', 'mapTikTokRow: stat_time_day→date + conversion→leads + payment→revenue');
  ok(fns.mapTikTokResponse({ data: { list: [tRow] } }).length === 1 && fns.mapTikTokResponse({}).length === 0, 'mapTikTokResponse: data.list / gol');
  {
    const seedT = { 'campaigns/t1': { platform: 'tiktok', externalId: '99', clientUid: 'u1', totals: {} }, 'clients/u1/platformCredentials/tiktok': { status: 'active', tokenEnc: fns.encryptToken('TT', KEY) } };
    const { db: dbT, store: storeT } = makeAdsStore(seedT);
    const frT = async () => ({ ok: false, status: 401, metrics: [] });
    const sumT = await fns.runConnectorPull(dbT, { platform: 'tiktok', fetchRows: frT, encKey: KEY, today: '2026-06-18' });
    ok(sumT.reconnect === 1 && storeT.get('clients/u1/platformCredentials/tiktok').status === 'needs_reconnect', 'runConnectorPull(tiktok): 401 → needs_reconnect');
  }
}

// ── TEST V: clientSafeDeliverables — filtrul comun al oglinzilor (livrabile + istoric versiuni). Notele
// interne + câmpurile necunoscute/goale NU trebuie să ajungă în subarborele clientului. ──
console.log('\nV) clientSafeDeliverables (filtru oglindă livrabile + versiuni)');
{
  const safe = fns.clientSafeDeliverables({ adTexts: 'reclame', notes: 'NOTĂ INTERNĂ', internalScore: 9, ideas: '   ', campaignStructure: 'structura' });
  ok(safe.adTexts === 'reclame' && safe.campaignStructure === 'structura', 'păstrează câmpurile client-safe');
  ok(!('notes' in safe) && !('internalScore' in safe), 'elimină notele interne + câmpurile necunoscute');
  ok(!('ideas' in safe), 'elimină câmpurile goale (whitespace)');
  ok(Object.keys(fns.clientSafeDeliverables(null)).length === 0 && Object.keys(fns.clientSafeDeliverables('x')).length === 0, 'null/gunoi → {} (fără throw)');
}

// ── TEST W: A/B testing „pe sloturi" — helpers puri + serveLp (split/sticky/cookie/abStats) + submit atribuit. ──
console.log('\nW) A/B testing — helpers + serveLp split/sticky + abStats');
{
  // Helpers puri (paritate cu logica de selecție)
  ok(JSON.stringify(fns.parseAbCookie('lpab_ab-test=hero:b,cta:a; other=x', 'ab-test')) === JSON.stringify({ hero: 'b', cta: 'a' }), 'parseAbCookie: extrage perechile slug-ului');
  ok(Object.keys(fns.parseAbCookie('lpab_other=hero:b', 'ab-test')).length === 0, 'parseAbCookie: ignoră alt slug');
  const arms2 = [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }];
  ok(fns.abWeightedPick(arms2, 0.0) === 'a' && fns.abWeightedPick(arms2, 0.99) === 'b', 'abWeightedPick: ponderi egale → împărțire pe rnd');
  ok(fns.abWeightedPick([{ id: 'a', weight: 9 }, { id: 'b', weight: 1 }], 0.5) === 'a', 'abWeightedPick: pondere mare → favorizat');
  ok(fns.applyArms('X<!--LP_EXP:hero-->Y', { hero: { a: '<h1>A</h1>' } }, { hero: 'a' }) === 'X<h1>A</h1>Y', 'applyArms: înlocuiește placeholderul cu arma aleasă');
  ok(fns.applyArms('X<!--LP_EXP:ghost-->Y', {}, {}) === 'XY', 'applyArms: slot orfan → gol');
  ok(fns.serializeAbCookie('ab-test', { hero: 'b' }).indexOf('lpab_ab-test=hero%3Ab') === 0 && /Path=\/p/.test(fns.serializeAbCookie('ab-test', { hero: 'b' })), 'serializeAbCookie: nume+path corecte');
  // pickAbAssignment cu rng injectat (determinist)
  const abLpRaw = { experiments: [{ id: 'hero', status: 'running', winnerArm: '', arms: [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }] }] };
  ok(fns.pickAbAssignment(abLpRaw, {}, { rng: () => 0.99 }).assign.hero === 'b', 'pickAbAssignment: split random (rng 0.99 → b)');
  ok(fns.pickAbAssignment(abLpRaw, { hero: 'a' }, { rng: () => 0.99 }).assign.hero === 'a', 'pickAbAssignment: cookie valid → sticky (nu re-randomizează)');
  ok(fns.pickAbAssignment(abLpRaw, {}, { isBot: true }).assign.hero === 'a' && Object.keys(fns.pickAbAssignment(abLpRaw, {}, { isBot: true }).count).length === 0, 'pickAbAssignment: bot → control fără contor');
  ok(fns.pickAbAssignment({ experiments: [{ id: 'hero', status: 'running', winnerArm: 'b', arms: [{ id: 'a' }, { id: 'b' }] }] }, {}, {}).assign.hero === 'b', 'pickAbAssignment: winner promovat → 100% winner');
  ok(Object.keys(fns.pickAbAssignment({ experiments: [{ id: 'hero', status: 'running', winnerArm: 'b', arms: [{ id: 'a' }, { id: 'b' }] }] }, {}, {}).count).length === 0, 'pickAbAssignment: winner promovat → fără contor/cookie');

  // serveLp integrare: construim o LP cu experiment real (compilat ca în editor)
  const abLp = C.coerceToLandingPage({
    schema: 1, slug: 'ab-test', title: 'AB', status: 'published', lang: 'ro', editor: 'visual',
    blocks: [{ id: 's', type: 'experiment', props: { expId: 'hero' } }],
    experiments: [{ id: 'hero', name: 'Hero', status: 'running', minSample: 200, winnerArm: '', arms: [
      { id: 'a', label: 'A', weight: 50, blocks: [{ id: 'h1', type: 'hero', props: { heading: 'VARIANTA-A' } }] },
      { id: 'b', label: 'B', weight: 50, blocks: [{ id: 'h2', type: 'hero', props: { heading: 'VARIANTA-B' } }] },
    ] }],
  });
  const abAssets = C.recompileLpAssets(abLp);
  const abDoc = { ...abLp, html: abAssets.html, armsHtml: abAssets.armsHtml, pageDecorHtml: '', conversionHtml: '', hasForm: false, form: { ...abLp.form, enabled: false } };

  // 1) Vizită fără cookie → servește o variantă (A sau B), setează cookie pe ea, loghează vizita ab pe ea.
  state.lpDoc = abDoc; reset();
  let servedArm = '';
  {
    const r = mkRes(); await serveLp(mkReq({ path: '/p/ab-test' }), r);
    const b = String(r._body || '');
    const a = b.includes('VARIANTA-A'), bb = b.includes('VARIANTA-B');
    ok((a || bb) && !(a && bb), 'serveLp A/B: exact O variantă servită (placeholder înlocuit)');
    servedArm = a ? 'a' : 'b';
    const cookie = r._headers['Set-Cookie'] || '';
    ok(cookie.indexOf('lpab_ab-test=hero%3A' + servedArm) === 0, 'serveLp A/B: Set-Cookie sticky pe varianta servită');
    const abSet = (state.calls['landingPages/abStats:set'] || [])[0];
    ok(abSet && abSet.id === 'hero__' + servedArm && abSet.data.visits.__inc === 1, 'serveLp A/B: vizită ab contorizată pe varianta servită');
    ok(!b.includes('<!--LP_EXP:'), 'serveLp A/B: niciun placeholder rezidual');
  }
  // 2) A doua vizită CU cookie → aceeași variantă (sticky).
  reset();
  {
    const r = mkRes(); await serveLp(mkReq({ path: '/p/ab-test', headers: { host: 'dataread-e1bd6.web.app', cookie: 'lpab_ab-test=hero:' + servedArm } }), r);
    const b = String(r._body || '');
    ok(b.includes(servedArm === 'a' ? 'VARIANTA-A' : 'VARIANTA-B'), 'serveLp A/B: cookie → aceeași variantă (sticky)');
  }
  // 3) Bot → control (arma A), fără cookie, fără contor.
  reset();
  {
    const r = mkRes(); await serveLp(mkReq({ path: '/p/ab-test', headers: { host: 'x', 'user-agent': 'Googlebot/2.1' } }), r);
    ok(String(r._body || '').includes('VARIANTA-A'), 'serveLp A/B: bot → control (A)');
    ok(!(r._headers['Set-Cookie']), 'serveLp A/B: bot → fără Set-Cookie');
    ok(!(state.calls['landingPages/abStats:set']), 'serveLp A/B: bot → fără contor ab');
  }
  // 4) winnerArm promovat → 100% pe winner, fără cookie.
  state.lpDoc = { ...abDoc, experiments: [{ ...abDoc.experiments[0], winnerArm: 'b' }] }; reset();
  {
    const r = mkRes(); await serveLp(mkReq({ path: '/p/ab-test' }), r);
    ok(String(r._body || '').includes('VARIANTA-B') && !(r._headers['Set-Cookie']), 'serveLp A/B: winner promovat → 100% B fără cookie');
  }
  // 5) Submit cu cookie → conversie atribuită variantei.
  state.lpDoc = { ...abDoc, hasForm: true, form: { enabled: true, fields: [{ name: 'email', label: 'Email', type: 'email', required: true, options: [], step: 0 }], submitLabel: 'Trimite', successMessage: '', redirectUrl: '', createLead: false, notifyEmail: '', multiStep: false } };
  reset();
  {
    const r = mkRes(); await serveLp(mkReq({ path: '/p/_submit', method: 'POST', headers: { cookie: 'lpab_ab-test=hero:b' }, body: { slug: 'ab-test', values: { email: 'a@b.ro' } } }), r);
    ok(r._status === 200 && r._body && r._body.ok === true, 'serveLp A/B submit: 200 ok');
    const abSet = (state.calls['landingPages/abStats:set'] || []).find((x) => x.id === 'hero__b');
    ok(abSet && abSet.data.submissions.__inc === 1, 'serveLp A/B submit: conversie atribuită variantei din cookie (b)');
  }
  // 6) Submit FĂRĂ cookie → __unattributed (nu pierdem conversia, nu o atribuim fals).
  reset();
  {
    const r = mkRes(); await serveLp(mkReq({ path: '/p/_submit', method: 'POST', body: { slug: 'ab-test', values: { email: 'c@d.ro' } } }), r);
    const abSet = (state.calls['landingPages/abStats:set'] || []).find((x) => x.id === 'hero____unattributed');
    ok(abSet && abSet.data.submissions.__inc === 1, 'serveLp A/B submit: fără cookie → __unattributed');
  }
  state.lpDoc = servedDoc;
}

// ── TEST X: motor de automatizare (Felia 0) — paritate JS cu nucleul pur TS (functions/index.js real). ──
console.log('\nX) motor automatizare — coerce + operatori + condiții + trigger/scope + idempotență + anti-buclă');
{
  ok(fns.AUTOMATION_ENABLED === true, 'automation: motor activat (AUTOMATION_ENABLED=true, Felia 2)');
  const a0 = fns.coerceToAutomation(null);
  ok(a0.schema === 1 && a0.enabled === false && a0.trigger.type === 'manual', 'automation: coerce(null) → schema 1 + OFF + trigger manual');
  const a1 = fns.coerceToAutomation({
    id: 'r1', name: 'Alertă', enabled: true, scope: 'agency',
    trigger: { type: 'campaign.metric_threshold', config: { threshold: 500 } },
    conditions: [{ field: 'metric.spend', op: 'gt', value: 500 }, { field: 'metric.leads', op: 'eq', value: 0 }, { field: 'x', op: 'zzz', value: 1 }],
    actions: [{ type: 'notify.operator', config: { text: 'Verifică' } }, { type: 'bogus', config: {} }],
  });
  ok(a1.actions.length === 1 && a1.conditions[2].op === 'eq', 'automation: coerce elimină acțiune invalidă + op invalid→eq');
  ok(fns.automationApplyOperator('in', 'contacted', 'new,contacted,won') === true, 'automation: op „in" pe listă');
  ok(fns.automationApplyOperator('gt', 'abc', 5) === false, 'automation: op „gt" pe non-numeric → false');
  // Regulă curată (fără condiția-gunoi din a1) pentru verificările de evaluare/plan/select.
  const aR = fns.coerceToAutomation({
    id: 'r2', enabled: true, scope: 'agency', trigger: { type: 'campaign.metric_threshold' },
    conditions: [{ field: 'metric.spend', op: 'gt', value: 500 }, { field: 'metric.leads', op: 'eq', value: 0 }],
    actions: [{ type: 'notify.operator', config: { text: 'Verifică' } }],
  });
  const ctx = { 'metric.spend': 700, 'metric.leads': 0 };
  ok(fns.evaluateConditions(aR.conditions, ctx) === true, 'automation: condiții AND îndeplinite');
  ok(fns.evaluateConditions(aR.conditions, { 'metric.spend': 100, 'metric.leads': 0 }) === false, 'automation: o condiție falsă → false');
  const hit = { trigger: 'campaign.metric_threshold', targetId: 'C1', clientUid: 'u1', ctx };
  ok((fns.planActions(aR, hit) || []).length === 1, 'automation: planActions → acțiuni la potrivire');
  ok(fns.planActions(aR, { ...hit, origin: 'automation' }) === null, 'automation: anti-buclă (origin=automation → null)');
  const aClient = fns.coerceToAutomation({ id: 'rc', enabled: true, scope: 'client', clientUid: 'u2', trigger: { type: 'campaign.metric_threshold' }, actions: [{ type: 'notify.operator', config: {} }] });
  ok(fns.matchesTrigger(aClient, hit) === false, 'automation: regulă client pe alt tenant → fără potrivire (izolare)');
  ok(fns.matchesTrigger(aClient, { ...hit, clientUid: 'u2' }) === true, 'automation: regulă client pe tenantul ei → potrivire');
  const k = fns.buildIdempotencyKey('r1', { trigger: 'lead.status_changed', targetId: 'L1', stateHash: 'won' });
  ok(/^[A-Za-z0-9_.-]+$/.test(k), 'automation: cheie idempotență validă ca doc id');
  ok(fns.selectMatching([aR, aClient], hit).length === 1, 'automation: selectMatching → doar regula agency potrivită');
  // Poarta AI (Felia 2b): AI activ + (bypass SAU entitlement client activ).
  ok(fns.automationAiAllowed({ aiBypassEntitlement: false }, { aiEnabled: true, entitlementActive: true }) === true, 'automation AI gate: entitlement activ → permis');
  ok(fns.automationAiAllowed({ aiBypassEntitlement: false }, { aiEnabled: true, entitlementActive: false }) === false, 'automation AI gate: fără entitlement → blocat');
  ok(fns.automationAiAllowed({ aiBypassEntitlement: true }, { aiEnabled: true, entitlementActive: false }) === true, 'automation AI gate: bypass admin → permis fără entitlement');
  ok(fns.automationAiAllowed({ aiBypassEntitlement: true }, { aiEnabled: false, entitlementActive: true }) === false, 'automation AI gate: AI dezactivat → blocat (chiar și cu bypass)');
}

// ── TEST Y: dispatch motor (Felia 2, notify-only) — store în memorie, notificare scrisă + dedupe prin runs.create(). ──
console.log('\nY) dispatch automatizare — onMetric → notify.operator + dedupe (runs.create)');
{
  function makeAutoStore(seed) {
    const store = new Map(Object.entries(seed || {}));
    function docRef(path) {
      return {
        async get() { const has = store.has(path); return { exists: has, id: path.split('/').pop(), data: () => store.get(path) }; },
        async set(data, opts) { store.set(path, opts && opts.merge ? Object.assign({}, store.get(path) || {}, data) : Object.assign({}, data)); },
        async create(data) { if (store.has(path)) { const e = new Error('exists'); e.code = 6; throw e; } store.set(path, Object.assign({}, data)); },
        collection(sub) { return colRef(`${path}/${sub}`); },
      };
    }
    function colRef(path) {
      return {
        doc(id) { return docRef(`${path}/${id}`); },
        where(field, op, val) {
          return { async get() {
            const docs = [];
            for (const [k, v] of store) {
              if (k.startsWith(path + '/')) { const rest = k.slice(path.length + 1); if (!rest.includes('/') && v && v[field] === val) docs.push({ id: rest, data: () => v }); }
            }
            return { docs, empty: docs.length === 0 };
          } };
        },
      };
    }
    return { db: { collection: (c) => colRef(c) }, store };
  }
  const seed = {
    'automations/r1': { enabled: true, scope: 'agency', name: 'Spend mare', trigger: { type: 'campaign.metric_threshold', config: {} }, conditions: [{ field: 'metric.spend', op: 'gt', value: 500 }, { field: 'metric.leads', op: 'eq', value: 0 }], actions: [{ type: 'notify.operator', config: { text: 'Spend mare fără lead-uri' } }], runCount: 0 },
    'automations/r2': { enabled: false, scope: 'agency', name: 'Oprită', trigger: { type: 'campaign.metric_threshold', config: {} }, conditions: [], actions: [{ type: 'notify.operator', config: {} }], runCount: 0 },
    'automations/r3': { enabled: true, scope: 'agency', name: 'Alt trigger', trigger: { type: 'lead.created', config: {} }, conditions: [], actions: [{ type: 'notify.operator', config: {} }], runCount: 0 },
  };
  const { db: adb, store: astore } = makeAutoStore(seed);
  const event = { trigger: 'campaign.metric_threshold', targetId: 'C1', clientUid: 'u1', ctx: { 'metric.spend': 700, 'metric.leads': 0 }, stateHash: '2026-06-18:700:0:0' };
  const r1 = await fns.dispatchAutomationEvent(adb, event, { nowMs: 111 });
  ok(r1.matched === 1 && r1.executed === 1, 'dispatch: o regulă potrivită executată (r1; r2 oprită, r3 alt trigger sărite)');
  const nk = () => [...astore.keys()].filter((k) => k.startsWith('notifications/'));
  ok(nk().length === 1, 'dispatch: o notificare scrisă');
  ok(astore.get(nk()[0]).text === 'Spend mare fără lead-uri' && astore.get(nk()[0]).source === 'automation', 'dispatch: notificarea are textul + source automation');
  ok(astore.get('automations/r1').runCount === 1, 'dispatch: runCount incrementat');
  const r2 = await fns.dispatchAutomationEvent(adb, event, { nowMs: 222 });
  ok(r2.executed === 0 && r2.skipped === 1, 'dispatch: a doua rulare, aceeași stare → dedupe (skipped, runs.create eșuează)');
  ok(nk().length === 1, 'dispatch: fără notificare dublă (anti livrare-dublă)');
  const r3 = await fns.dispatchAutomationEvent(adb, { trigger: 'campaign.metric_threshold', targetId: 'C2', clientUid: 'u1', ctx: { 'metric.spend': 100, 'metric.leads': 0 }, stateHash: 'low' }, { nowMs: 333 });
  ok(r3.executed === 0, 'dispatch: condiție neîndeplinită (spend<500) → nicio acțiune');

  // ── Felia 3: lead.set_status (cu marcaj anti-buclă) + task.create + gardă origin. ──
  const seedL = {
    'automations/s1': { enabled: true, scope: 'agency', name: 'Auto contactare', trigger: { type: 'lead.created', config: {} }, conditions: [{ field: 'lead.status', op: 'eq', value: 'new' }], actions: [{ type: 'lead.set_status', config: { status: 'contacted' } }, { type: 'task.create', config: { title: 'Sună lead-ul nou' } }], runCount: 0 },
  };
  const { db: ldb, store: lstore } = makeAutoStore(seedL);
  const evL = { trigger: 'lead.created', targetId: 'L9', clientUid: '', ctx: { 'lead.status': 'new' }, stateHash: 'created' };
  const rr = await fns.dispatchAutomationEvent(ldb, evL, { nowMs: 500 });
  ok(rr.executed === 1, 'F3: regulă lead.created executată');
  ok(lstore.get('leads/L9') && lstore.get('leads/L9').status === 'contacted', 'F3: lead.set_status → status=contacted');
  ok(lstore.get('leads/L9').automationStamp === 500, 'F3: marcaj automationStamp pus (anti-buclă)');
  const tks = [...lstore.keys()].filter((k) => k.startsWith('tasks/'));
  ok(tks.length === 1 && lstore.get(tks[0]).title === 'Sună lead-ul nou' && lstore.get(tks[0]).status === 'open', 'F3: task.create → task open');
  const rrLoop = await fns.dispatchAutomationEvent(ldb, { ...evL, targetId: 'L10', origin: 'automation' }, { nowMs: 600 });
  ok(rrLoop.matched === 0 && rrLoop.executed === 0, 'F3: origin=automation → nicio regulă (anti-buclă)');
  const seedB = { 'automations/s2': { enabled: true, scope: 'agency', name: 'Bad', trigger: { type: 'lead.created', config: {} }, conditions: [], actions: [{ type: 'lead.set_status', config: { status: 'zzz' } }], runCount: 0 } };
  const { db: bdb, store: bstore } = makeAutoStore(seedB);
  await fns.dispatchAutomationEvent(bdb, { trigger: 'lead.created', targetId: 'L11', clientUid: '', ctx: {}, stateHash: 'created' }, { nowMs: 700 });
  ok(!bstore.get('leads/L11'), 'F3: status invalid (zzz) → lead neatins (skipped)');

  // ── Felia 5a: regulă client-scope → notify+task scrise sub clients/{uid}/** (izolare tenant), nu în top-level. ──
  const seedC = {
    'automations/c1': { enabled: true, scope: 'client', clientUid: 'u7', name: 'Regulă client', trigger: { type: 'lead.created', config: {} }, conditions: [], actions: [{ type: 'notify.operator', config: { text: 'Salut' } }, { type: 'task.create', config: { title: 'Verifică lead-ul' } }], runCount: 0 },
  };
  const { db: cdb, store: cstore } = makeAutoStore(seedC);
  await fns.dispatchAutomationEvent(cdb, { trigger: 'lead.created', targetId: 'L20', clientUid: 'u7', ctx: {}, stateHash: 'created' }, { nowMs: 800 });
  ok([...cstore.keys()].filter((k) => k.startsWith('clients/u7/notifications/')).length === 1, 'F5a: notificare scrisă sub clients/{uid}/notifications');
  ok([...cstore.keys()].filter((k) => k.startsWith('clients/u7/tasks/')).length === 1, 'F5a: task scris sub clients/{uid}/tasks');
  ok(![...cstore.keys()].some((k) => k.startsWith('notifications/') || k.startsWith('tasks/')), 'F5a: nimic în top-level (izolare multi-tenant)');
  // tenant greșit → regula client nu se potrivește
  const { db: cdb2, store: cstore2 } = makeAutoStore(seedC);
  await fns.dispatchAutomationEvent(cdb2, { trigger: 'lead.created', targetId: 'L21', clientUid: 'u8', ctx: {}, stateHash: 'created' }, { nowMs: 900 });
  ok([...cstore2.keys()].filter((k) => k.startsWith('clients/')).length === 0, 'F5a: regulă client pe alt tenant (u8) → nimic scris');

  // ── E1: backstop orar — max 5 rulări per (regulă, țintă)/oră, chiar cu stateHash diferit (anti-oscilație). ──
  const seedR = {
    'automations/rl': { enabled: true, scope: 'agency', name: 'Oscilant', trigger: { type: 'campaign.insight', config: {} }, conditions: [], actions: [{ type: 'notify.operator', config: {} }], runCount: 0 },
  };
  const { db: rdb, store: rstore } = makeAutoStore(seedR);
  let lim = 0; let exe = 0;
  for (let i = 0; i < 7; i++) {
    const r = await fns.dispatchAutomationEvent(rdb, { trigger: 'campaign.insight', targetId: 'CX', clientUid: 'u1', ctx: {}, stateHash: `v${i}` }, { nowMs: 1000 + i });
    exe += r.executed; lim += r.limited;
  }
  ok(exe === 5 && lim === 2, 'E1: backstop orar → 5 rulări executate, 2 limitate (din 7 stări diferite)');
  ok((rstore.get('automations/rl/rate/CX') || {}).count === 5, 'E1: contorul orar al țintei = 5');
}

// ── TEST INV: performIssueInvoice (numerotare facturi atomică, fără goluri, idempotentă) + helperi puri. ──
// Cerință legală RO: numere secvențiale per serie, fără goluri, ale emitentului (contor GLOBAL pe serie). Tranzacția
// reală pe Firestore în memorie acoperă calea pe care testele pure nu o ating (citire factură + contor + config).
console.log('\nINV) performIssueInvoice — numerotare atomică per serie');
{
  function makeInvStore(seed) {
    const store = new Map(Object.entries(seed || {}));
    const colRef = (path) => ({ doc: (id) => docRef(`${path}/${id}`) });
    const docRef = (path) => ({ _path: path, collection: (sub) => colRef(`${path}/${sub}`),
      // set/get directe (în afara tranzacției) — pt. writeInvoiceNotification + citirea locale-ului clientului.
      async set(data, opts) { store.set(path, opts && opts.merge ? Object.assign({}, store.get(path) || {}, data) : Object.assign({}, data)); },
      async get() { return { exists: store.has(path), data: () => store.get(path) }; } });
    let wrote = false; // gardă: oglindește regula Firestore „toate citirile înainte de orice scriere" (prinde un refactor greșit)
    const tx = {
      async get(r) { if (wrote) throw new Error('READ_AFTER_WRITE'); const has = store.has(r._path); return { exists: has, data: () => store.get(r._path) }; },
      set(r, data, opts) { wrote = true; store.set(r._path, opts && opts.merge ? Object.assign({}, store.get(r._path) || {}, data) : Object.assign({}, data)); },
    };
    return { db: { collection: (c) => colRef(c), async runTransaction(fn) { wrote = false; return fn(tx); } }, store };
  }
  const grab = async (fn) => { try { return { res: await fn(), err: null }; } catch (e) { return { res: null, err: e }; } };

  // helperi puri
  ok(fns.invoiceCounterKey('A/B 2026!') === 'A_B_2026_', 'invoiceCounterKey: sanitizează caractere nesigure');
  ok(fns.invoiceCounterKey('') === '_', 'invoiceCounterKey: gol → "_"');
  ok(fns.nextInvoiceNumber(false, undefined, 0) === 1, 'nextInvoiceNumber: serie nouă fără start → 1');
  ok(fns.nextInvoiceNumber(false, undefined, 248) === 248, 'nextInvoiceNumber: serie nouă, start=248 → 248');
  ok(fns.nextInvoiceNumber(true, 7, 248) === 7, 'nextInvoiceNumber: contor existent → next contor (ignoră start)');
  // Contor corupt (exists dar next non-întreg) → ABORTĂ (NU presupune 1, care ar duplica numere legale).
  ok((await grab(async () => fns.nextInvoiceNumber(true, 'x', 0))).err?.message?.includes('CORRUPT_COUNTER'), 'nextInvoiceNumber: contor corupt → aruncă CORRUPT_COUNTER (nu fallback 1)');
  ok((await grab(async () => fns.nextInvoiceNumber(true, 0, 0))).err, 'nextInvoiceNumber: contor next=0 → aruncă (nu e întreg pozitiv)');

  // 1) prima factură DR, fără contor/config → număr 1, status sent, contor next 2
  {
    const { db, store } = makeInvStore({ 'clients/u1/invoices/i1': { series: 'DR', number: '', status: 'draft', kind: 'factura' } });
    const { res } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'i1' }));
    ok(res && res.number === '1' && res.series === 'DR' && res.already === false, 'emitere: prima factură DR → număr 1');
    ok(store.get('clients/u1/invoices/i1').number === '1' && store.get('clients/u1/invoices/i1').status === 'sent', 'emitere: factura primește număr + status sent');
    ok((store.get('invoiceCounters/DR') || {}).next === 2, 'emitere: contorul DR → next 2');
  }
  // 2) a doua factură DR (contor la 2) → număr 2, fără goluri
  {
    const { db, store } = makeInvStore({ 'clients/u1/invoices/i2': { series: 'DR', number: '', status: 'draft', kind: 'factura' }, 'invoiceCounters/DR': { series: 'DR', next: 2 } });
    const { res } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'i2' }));
    ok(res.number === '2' && store.get('invoiceCounters/DR').next === 3, 'emitere: a doua factură DR → număr 2 (fără goluri)');
  }
  // 3) idempotent: deja numerotată → același număr, contor neatins
  {
    const { db, store } = makeInvStore({ 'clients/u1/invoices/i3': { series: 'DR', number: '5', status: 'sent' }, 'invoiceCounters/DR': { series: 'DR', next: 9 } });
    const { res } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'i3' }));
    ok(res.number === '5' && res.already === true && store.get('invoiceCounters/DR').next === 9, 'idempotent: deja numerotată → același număr, contor neatins');
  }
  // 4) serie nouă seed din config.startNumber
  {
    const { db, store } = makeInvStore({ 'clients/u1/invoices/i4': { series: 'AA', number: '', status: 'draft', kind: 'factura' }, 'appConfig/invoiceSeller': { startNumber: 248 } });
    const { res } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'i4' }));
    ok(res.number === '248' && store.get('invoiceCounters/AA').next === 249, 'emitere: serie nouă AA seed din startNumber=248');
  }
  // 5) serie lipsă → failed-precondition NO_SERIES
  {
    const { db } = makeInvStore({ 'clients/u1/invoices/i5': { series: '', number: '', status: 'draft', kind: 'factura' } });
    const { err } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'i5' }));
    ok(err && /NO_SERIES/.test(err.message || ''), 'serie lipsă → failed-precondition NO_SERIES');
  }
  // 6) factură inexistentă → not-found
  {
    const { db } = makeInvStore({});
    const { err } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'zzz' }));
    ok(err && /nu există/.test(err.message || ''), 'factură inexistentă → not-found');
  }
  // 7) serii independente: AA pornește la 1, DR neatins
  {
    const { db, store } = makeInvStore({ 'clients/u1/invoices/iA': { series: 'AA', number: '', status: 'draft', kind: 'factura' }, 'invoiceCounters/DR': { series: 'DR', next: 50 } });
    const { res } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'iA' }));
    ok(res.number === '1' && store.get('invoiceCounters/DR').next === 50, 'serii independente: AA → 1, contorul DR neatins');
  }
  // 8) contor corupt (există dar fără `next` valid) → ABORTĂ (nu reseta la 1 → ar duplica numere legale)
  {
    const { db, store } = makeInvStore({ 'clients/u1/invoices/i8': { series: 'DR', number: '', status: 'draft', kind: 'factura' }, 'invoiceCounters/DR': { series: 'DR' } });
    const { err } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'i8' }));
    ok(err && /CORRUPT_COUNTER/.test(err.message || ''), 'contor corupt → failed-precondition CORRUPT_COUNTER');
    ok(store.get('clients/u1/invoices/i8').number === '', 'contor corupt → factura rămâne nenumerotată (fără scriere)');
  }
  // 9) serie cu caractere nesigure (s-ar coliziona pe contor) → BAD_SERIES
  {
    const { db } = makeInvStore({ 'clients/u1/invoices/i9': { series: 'A/B', number: '', status: 'draft', kind: 'factura' } });
    const { err } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'i9' }));
    ok(err && /BAD_SERIES/.test(err.message || ''), 'serie cu caractere nesigure → failed-precondition BAD_SERIES (anti-coliziune contor)');
  }
  // 10) performIssueInvoice întoarce `kind` (pt. textul notificării)
  {
    const { db } = makeInvStore({ 'clients/u1/invoices/iK': { series: 'DR', number: '', status: 'draft', kind: 'factura' } });
    const { res } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'iK' }));
    ok(res.kind === 'factura', 'performIssueInvoice întoarce kind (factura)');
  }
  // 11) invoiceNotifText (pur, localizat) + writeInvoiceNotification (feed client)
  ok(fns.invoiceNotifText('factura', 'DR 5', 'ro') === 'Factura DR 5 a fost emisă.', 'notifText: factură RO');
  ok(fns.invoiceNotifText('proforma', 'PRO 1', 'en') === 'Proforma PRO 1 has been issued.', 'notifText: proformă EN');
  ok(fns.invoiceNotifText('factura', '', 'ro') === 'Factura a fost emisă.', 'notifText: fără număr → fără spațiu dublu');
  {
    const { db, store } = makeInvStore({});
    await fns.writeInvoiceNotification(db, 'u1', 'i1', { series: 'DR', number: '5', kind: 'factura' }, 'ro');
    const n = store.get('clients/u1/notifications/invoice-i1');
    ok(n && n.source === 'invoice' && n.text === 'Factura DR 5 a fost emisă.' && n.read === false && typeof n.createdAt === 'number', 'notificare factură scrisă în feed (text RO + createdAt millis)');
  }
  // 12) proformă → NU consumă secvența fiscală (PROFORMA_NO_ISSUE)
  {
    const { db } = makeInvStore({ 'clients/u1/invoices/p1': { series: 'PF', number: '', status: 'draft', kind: 'proforma' } });
    const { err } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'p1' }));
    ok(err && /PROFORMA_NO_ISSUE/.test(err.message || ''), 'proformă → PROFORMA_NO_ISSUE (nu consumă numere de factură)');
  }
  // 13) STORNARE validă: original emis → storno primește număr + originalul e marcat stornedBy (anti dublă-stornare)
  {
    const ORIG_ITEMS = [{ description: 'Serviciu', qty: 2, unitPrice: 100 }];
    const ST_ITEMS = [{ description: 'Serviciu', qty: -2, unitPrice: 100 }]; // negarea exactă
    const { db, store } = makeInvStore({
      'clients/u1/invoices/orig': { series: 'DR', number: '7', status: 'sent', kind: 'factura', items: ORIG_ITEMS, vatRate: 19, currency: 'RON' },
      'clients/u1/invoices/st': { series: 'DR', number: '', status: 'draft', kind: 'factura', items: ST_ITEMS, vatRate: 19, currency: 'RON', stornoOf: { series: 'DR', number: '7', id: 'orig' } },
      'invoiceCounters/DR': { series: 'DR', next: 8 },
    });
    const { res } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'st' }));
    ok(res && res.number === '8', 'storno valid → primește numărul următor (8)');
    ok(store.get('clients/u1/invoices/orig').stornoedBy === '8', 'originalul e marcat stornedBy=8');
    // a doua stornare a aceluiași original → ALREADY_STORNOED
    store.set('clients/u1/invoices/st2', { series: 'DR', number: '', status: 'draft', kind: 'factura', stornoOf: { series: 'DR', number: '7', id: 'orig' } });
    const { err } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'st2' }));
    ok(err && /ALREADY_STORNOED/.test(err.message || ''), 'a doua stornare a aceluiași original → ALREADY_STORNOED');
  }
  // 14) storno fără id / original inexistent / original neemis / storno-de-storno → respinse
  {
    const seed = {
      'clients/u1/invoices/sNoId': { series: 'DR', number: '', status: 'draft', kind: 'factura', stornoOf: { series: 'DR', number: '7', id: '' } },
      'clients/u1/invoices/sGhost': { series: 'DR', number: '', status: 'draft', kind: 'factura', stornoOf: { series: 'DR', number: '7', id: 'ghost' } },
      'clients/u1/invoices/draftOrig': { series: 'DR', number: '', status: 'draft', kind: 'factura' },
      'clients/u1/invoices/sOfDraft': { series: 'DR', number: '', status: 'draft', kind: 'factura', stornoOf: { series: 'DR', number: '', id: 'draftOrig' } },
      'clients/u1/invoices/realStorno': { series: 'DR', number: '9', status: 'sent', kind: 'factura', stornoOf: { series: 'DR', number: '7', id: 'orig' } },
      'clients/u1/invoices/sOfStorno': { series: 'DR', number: '', status: 'draft', kind: 'factura', stornoOf: { series: 'DR', number: '9', id: 'realStorno' } },
    };
    const e1 = (await grab(() => fns.performIssueInvoice(makeInvStore(seed).db, { clientUid: 'u1', invoiceId: 'sNoId' }))).err;
    ok(e1 && /STORNO_NO_ORIGINAL/.test(e1.message || ''), 'storno fără id original → STORNO_NO_ORIGINAL');
    const e2 = (await grab(() => fns.performIssueInvoice(makeInvStore(seed).db, { clientUid: 'u1', invoiceId: 'sGhost' }))).err;
    ok(e2 && /STORNO_ORIGINAL_NOT_FOUND/.test(e2.message || ''), 'storno cu original inexistent → STORNO_ORIGINAL_NOT_FOUND');
    const e3 = (await grab(() => fns.performIssueInvoice(makeInvStore(seed).db, { clientUid: 'u1', invoiceId: 'sOfDraft' }))).err;
    ok(e3 && /STORNO_ORIGINAL_NOT_ISSUED/.test(e3.message || ''), 'storno al unui original neemis → STORNO_ORIGINAL_NOT_ISSUED');
    const e4 = (await grab(() => fns.performIssueInvoice(makeInvStore(seed).db, { clientUid: 'u1', invoiceId: 'sOfStorno' }))).err;
    ok(e4 && /STORNO_OF_STORNO/.test(e4.message || ''), 'storno al unei stornări → STORNO_OF_STORNO');
  }
  // 15) stornoMatchesOriginal (pur) + STORNO_MISMATCH (reversare exactă = invariant server)
  {
    const orig = { items: [{ description: 'A', qty: 2, unitPrice: 100 }, { description: 'B', qty: 1, unitPrice: 50 }], vatRate: 19, currency: 'RON', seller: { name: 'Ag' }, buyer: { name: 'Cl' } };
    const good = { items: [{ description: 'A', qty: -2, unitPrice: 100 }, { description: 'B', qty: -1, unitPrice: 50 }], vatRate: 19, currency: 'RON', seller: { name: 'Ag' }, buyer: { name: 'Cl' } };
    ok(fns.stornoMatchesOriginal(good, orig) === true, 'stornoMatchesOriginal: negare exactă → true');
    ok(fns.stornoMatchesOriginal({ ...good, items: [{ description: 'A', qty: -1, unitPrice: 100 }, { description: 'B', qty: -1, unitPrice: 50 }] }, orig) === false, 'mismatch: cantitate parțială → false');
    ok(fns.stornoMatchesOriginal({ ...good, buyer: { name: 'Altcineva' } }, orig) === false, 'mismatch: alt cumpărător → false');
    ok(fns.stornoMatchesOriginal({ ...good, items: [{ description: 'A', qty: -2, unitPrice: 999 }, { description: 'B', qty: -1, unitPrice: 50 }] }, orig) === false, 'mismatch: alt preț → false');
    ok(fns.stornoMatchesOriginal({ ...good, items: [{ description: 'A', qty: -2, unitPrice: 100 }] }, orig) === false, 'mismatch: număr diferit de linii → false');
    // performIssueInvoice respinge un storno cu sume necorespunzătoare
    const { db } = makeInvStore({
      'clients/u1/invoices/o2': { series: 'DR', number: '7', status: 'sent', kind: 'factura', items: orig.items, vatRate: 19, currency: 'RON', seller: orig.seller, buyer: orig.buyer },
      'clients/u1/invoices/sBad': { series: 'DR', number: '', status: 'draft', kind: 'factura', items: [{ description: 'A', qty: -1, unitPrice: 100 }, { description: 'B', qty: -1, unitPrice: 50 }], vatRate: 19, currency: 'RON', seller: orig.seller, buyer: orig.buyer, stornoOf: { series: 'DR', number: '7', id: 'o2' } },
      'invoiceCounters/DR': { series: 'DR', next: 8 },
    });
    const { err } = await grab(() => fns.performIssueInvoice(db, { clientUid: 'u1', invoiceId: 'sBad' }));
    ok(err && /STORNO_MISMATCH/.test(err.message || ''), 'performIssueInvoice: storno cu sume diferite → STORNO_MISMATCH');
  }
}

// ── TEST MIG: performMigrateCampaignInsights — relocare + scrub al scurgerii aiInsight (constatare audit Felia B). ──
// Mută analiza AI internă de pe campaigns/{id} (citibil de client) în campaignInsights/{id} (admin-only) și ȘTERGE
// câmpurile scurse. Câmpurile scrise TREBUIE să fie cele citite de onMetricWrite/onCampaignAutomation (verdict +
// denormalizări clientUid/platform/leadId) — testul prinde un typo de nume de câmp (JS fără typecheck).
console.log('\nMIG) performMigrateCampaignInsights — relocare + scrub leak aiInsight');
{
  function makeMigStore(seed) {
    const store = new Map(Object.entries(seed || {}));
    const applyUpdate = (path, data) => {
      const cur = Object.assign({}, store.get(path) || {});
      for (const [k, v] of Object.entries(data)) { if (v && v.__del) delete cur[k]; else cur[k] = v; }
      store.set(path, cur);
    };
    const docRef = (path) => ({
      _path: path,
      async get() { return { exists: store.has(path), id: path.split('/').pop(), data: () => store.get(path), ref: docRef(path) }; },
      async set(data, opts) { store.set(path, opts && opts.merge ? Object.assign({}, store.get(path) || {}, data) : Object.assign({}, data)); },
      async update(data) { applyUpdate(path, data); },
      collection: (sub) => colRef(`${path}/${sub}`),
    });
    function colRef(path) {
      return {
        doc: (id) => docRef(`${path}/${id}`),
        async get() {
          const docs = [];
          for (const [k, v] of store) {
            if (k.startsWith(path + '/')) { const rest = k.slice(path.length + 1); if (!rest.includes('/')) docs.push({ id: rest, data: () => v, ref: docRef(k) }); }
          }
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      };
    }
    return { db: { collection: (c) => colRef(c) }, store };
  }
  const { db, store } = makeMigStore({
    'campaigns/c1': { name: 'Camp 1', leadId: 'L1', clientUid: 'u1', platform: 'meta', totals: {}, aiInsight: { verdict: 'scale', headline: 'Merge bine', reasoning: 'ROAS mare', actions: 'Crește bugetul' }, aiInsightAt: { __ts: true }, aiInsightBy: 'operator9' },
    'campaigns/c2': { name: 'Camp 2', leadId: 'L2', clientUid: 'u2', platform: 'google', totals: {} }, // fără insight → sărit
    'campaigns/c1/metrics/2026-06-20': { spend: 100 }, // subdoc → trebuie IGNORAT de get() pe colecția campaigns
  });
  const res = await fns.performMigrateCampaignInsights(db);
  ok(res.migrated === 1 && res.scrubbed === 1, 'MIG: o campanie migrată + curățată (cea fără insight sărită)');
  const ins = store.get('campaignInsights/c1');
  ok(ins && ins.verdict === 'scale' && ins.headline === 'Merge bine' && ins.reasoning === 'ROAS mare' && ins.actions === 'Crește bugetul', 'MIG: campaignInsights are verdict/headline/reasoning/actions');
  ok(ins && ins.clientUid === 'u1' && ins.platform === 'meta' && ins.leadId === 'L1' && ins.by === 'operator9', 'MIG: denormalizări clientUid/platform/leadId/by prezente (consumate de triggere)');
  const c1 = store.get('campaigns/c1');
  ok(c1 && !('aiInsight' in c1) && !('aiInsightAt' in c1) && !('aiInsightBy' in c1), 'MIG: câmpurile scurse ȘTERSE de pe campaigns/{id} (leak închis)');
  ok(c1 && c1.name === 'Camp 1' && c1.clientUid === 'u1', 'MIG: restul câmpurilor campaniei rămân neatinse');
  ok(!store.has('campaignInsights/c2'), 'MIG: campania fără insight nu produce doc campaignInsights');
  const res2 = await fns.performMigrateCampaignInsights(db);
  ok(res2.migrated === 0 && res2.scrubbed === 0, 'MIG: re-rulare după curățare → no-op (idempotentă)');
}

rmSync(tmp, { force: true });
console.log(`\nE2E-LP-SERVE: ${failed ? failed + ' verificări EȘUATE' : 'TOATE verificările au trecut'}`);
process.exit(failed ? 1 : 0);
