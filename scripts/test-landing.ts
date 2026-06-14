// Suite headless: coerce + slug + validare submission (landingPage.ts) + math rollup (lpStats.ts).
import {
  coerceToLandingPage,
  coerceToLpSubmission,
  sanitizeSlug,
  sanitizeSubmissionValues,
  LP_HTML_MAX,
  LP_FORM_FIELDS_MAX,
  type LpFormField,
} from '../src/types/landingPage';
import {
  bucketKey,
  coerceToLpStatsDay,
  lpKpis,
  sumLpStats,
  topEntries,
  type LpStatsDay,
} from '../src/analytics/lpStats';
import { coerceBlocks, coerceToLpBlock, compileBlocks, defaultBlockProps } from '../src/types/lpBlocks';
import { coerceToLpDecor, compileDecor } from '../src/types/lpDecor';
import { LP_TEMPLATES, landingPageFromTemplate } from '../src/admin/lpTemplates';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// ── coerceToLandingPage ──
check('coerce(null) → default sigur (draft, html gol, slug gol)', (() => {
  const lp = coerceToLandingPage(null);
  return lp.status === 'draft' && lp.html === '' && lp.slug === '' && lp.schema === 1 && lp.lang === 'ro';
})());
check('coerce(gunoi) nu aruncă, design valid', (() => {
  const lp = coerceToLandingPage({ status: 'turbo', design: { vars: { accent: 'nu-e-hex' } }, lang: 'fr' });
  return lp.status === 'draft' && HEX.test(lp.design.vars.accent) && lp.lang === 'ro';
})());
check('coerce: html peste limită → tăiat la LP_HTML_MAX', (() => {
  const lp = coerceToLandingPage({ html: 'x'.repeat(LP_HTML_MAX + 5000) });
  return lp.html.length === LP_HTML_MAX;
})());
check('coerce: status published păstrat', coerceToLandingPage({ status: 'published' }).status === 'published');
check('invariant hasForm === form.enabled (true)', coerceToLandingPage({ form: { enabled: true } }).hasForm === true);
check('invariant hasForm === form.enabled (hasForm ignorat fără enabled)', coerceToLandingPage({ hasForm: true, form: { enabled: false } }).hasForm === false);
check('coerce: câmpuri form plafonate la LP_FORM_FIELDS_MAX', (() => {
  const fields = Array.from({ length: 20 }, (_, i) => ({ name: `f${i}`, type: 'text' }));
  return coerceToLandingPage({ form: { enabled: true, fields } }).form.fields.length === LP_FORM_FIELDS_MAX;
})());
check('coerce: tip câmp necunoscut → text; options doar pt select', (() => {
  const lp = coerceToLandingPage({ form: { enabled: true, fields: [
    { name: 'a', type: 'magic', options: ['x'] },
    { name: 'b', type: 'select', options: ['x', 'y'] },
  ] } });
  const a = lp.form.fields[0];
  const b = lp.form.fields[1];
  return a.type === 'text' && a.options.length === 0 && b.type === 'select' && b.options.length === 2;
})());
check('coerce: câmp fără name → eliminat', coerceToLandingPage({ form: { enabled: true, fields: [{ type: 'text' }] } }).form.fields.length === 0);

// ── sanitizeSlug ──
check('slug: "Hello World!" → hello-world', sanitizeSlug('Hello World!') === 'hello-world');
check('slug: diacritice "Pagină Nouă" → pagina-noua', sanitizeSlug('Pagină Nouă') === 'pagina-noua');
check('slug: taie dash-uri marginale + duble', sanitizeSlug('--A & B--') === 'a-b');
check('slug: gol rămâne gol', sanitizeSlug('') === '' && sanitizeSlug(42) === '');
check('slug: lungime plafonată', sanitizeSlug('a'.repeat(200)).length <= 60);

// ── submissions ──
check('sanitizeSubmissionValues: aruncă chei necunoscute, plafonează, semnalează required', (() => {
  const fields: LpFormField[] = [
    { name: 'email', label: 'Email', type: 'email', required: true, options: [] },
    { name: 'msg', label: 'Mesaj', type: 'textarea', required: false, options: [] },
  ];
  const r = sanitizeSubmissionValues({ email: '', msg: 'salut', hacker: 'drop' }, fields);
  return r.values.msg === 'salut' && !('hacker' in r.values) && r.missingRequired.length === 1 && r.missingRequired[0] === 'email';
})());
check('coerceToLpSubmission: doar valori string, plafonate', (() => {
  const s = coerceToLpSubmission({ values: { a: 'x'.repeat(5000), b: 99 }, referrer: 'https://r' });
  return s.values.a.length === 2000 && !('b' in s.values) && s.status === 'new' && s.schema === 1;
})());

// ── lpStats (math rollup) ──
const day = (over: Partial<LpStatsDay>): LpStatsDay => coerceToLpStatsDay({ date: '2026-06-13', ...over })!;
check('coerceToLpStatsDay: dată invalidă → null', coerceToLpStatsDay({ date: 'azi' }) === null);
check('coerceToLpStatsDay: dată validă → obiect', coerceToLpStatsDay({ date: '2026-06-13', visits: 5 })?.visits === 5);
check('sumLpStats: adună vizite + hărți', (() => {
  const t = sumLpStats([
    day({ visits: 10, bySource: { google: 6, meta: 4 } }),
    day({ visits: 5, bySource: { google: 2, other: 3 } }),
  ]);
  return t.visits === 15 && t.bySource.google === 8 && t.bySource.meta === 4 && t.bySource.other === 3;
})());
check('lpKpis: convRate = submissions/visits', (() => {
  const k = lpKpis(sumLpStats([day({ visits: 100, submissions: 5 })]));
  return k.convRate === 0.05;
})());
check('lpKpis: numitor 0 → null (nu NaN)', (() => {
  const k = lpKpis(sumLpStats([day({ visits: 0, submissions: 0, beacons: 0 })]));
  return k.convRate === null && k.avgScrollPct === null && k.avgTimeSec === null;
})());
check('lpKpis: avgTimeSec = timeOnPageSum/beacons/1000', (() => {
  const k = lpKpis(sumLpStats([day({ beacons: 2, timeOnPageSum: 30000 })]));
  return k.avgTimeSec === 15;
})());
check('topEntries: sortează descrescător + limitează', (() => {
  const top = topEntries({ a: 1, b: 9, c: 5 }, 2);
  return top.length === 2 && top[0][0] === 'b' && top[1][0] === 'c';
})());
check('bucketKey: whitelist păstrat, restul → other', (() => {
  const wl = ['google', 'meta'];
  return bucketKey('GOOGLE', wl) === 'google' && bucketKey('shady', wl) === 'other' && bucketKey('', wl) === 'other';
})());

// ── blocuri builder vizual (lpBlocks) ──
const form = { enabled: true, fields: [{ name: 'email', label: 'Email', type: 'email' as const, required: true, options: [] }], submitLabel: 'Trimite', successMessage: '', createLead: false, notifyEmail: '' };
check('coerceToLpBlock: tip necunoscut → null', coerceToLpBlock({ type: 'banana' }) === null);
check('coerceToLpBlock: valid → păstrat cu id', (() => {
  const b = coerceToLpBlock({ type: 'hero', props: { heading: 'Salut' } }, 3);
  return b !== null && b.type === 'hero' && b.id === 'b3' && b.props.heading === 'Salut';
})());
check('coerceBlocks: filtrează invalide', coerceBlocks([{ type: 'hero' }, 'gunoi', { type: 'x' }, { type: 'spacer' }]).length === 2);
check('compileBlocks: gol → string gol', compileBlocks([], { form }) === '');
check('compileBlocks: hero → h1 + text + data-cta', (() => {
  const html = compileBlocks([{ id: '1', type: 'hero', props: { heading: 'Oferta', ctaText: 'Cumpără', ctaHref: '#' } }], { form });
  return html.includes('<h1') && html.includes('Oferta') && html.includes('data-cta') && html.includes('var(--accent)');
})());
check('compileBlocks: image cu URL ne-https → omis', compileBlocks([{ id: '1', type: 'image', props: { url: 'http://x/y.png' } }], { form }) === '');
check('compileBlocks: image https → <img>', compileBlocks([{ id: '1', type: 'image', props: { url: 'https://x/y.png', alt: 'a' } }], { form }).includes('<img'));
check('compileBlocks: form → <form data-lp-form> cu câmpul din config', (() => {
  const html = compileBlocks([{ id: '1', type: 'form', props: {} }], { form });
  return html.includes('data-lp-form') && html.includes('name="email"');
})());
check('compileBlocks: escapează HTML din text (anti-rupere)', !compileBlocks([{ id: '1', type: 'heading', props: { text: '<script>x' } }], { form }).includes('<script>x'));
check('defaultBlockProps: features are 3 items', (defaultBlockProps('features').items as unknown[]).length === 3);

// ── decor (lpDecor) ──
check('coerceToLpDecor: gunoi → none + clamp', (() => {
  const d = coerceToLpDecor({ effect: 'lasers', density: 999, opacity: 5, color: 'rgb(0,0,0)' });
  return d.effect === 'none' && d.density === 100 && d.opacity === 1 && d.color === '';
})());
check('coerceToLpDecor: valori valide păstrate', (() => {
  const d = coerceToLpDecor({ effect: 'constellation', interaction: 'mouseReact', color: '#abcdef' });
  return d.effect === 'constellation' && d.interaction === 'mouseReact' && d.color === '#abcdef';
})());
check('compileDecor: none → gol', compileDecor(coerceToLpDecor({ effect: 'none' }), 'x', 'page') === '');
check('coerceToLpDecor: intensity clamp + mouseAttract valid', (() => {
  const d = coerceToLpDecor({ effect: 'dots', interaction: 'mouseAttract', intensity: 999 });
  const e = coerceToLpDecor({ intensity: -5 });
  return d.interaction === 'mouseAttract' && d.intensity === 100 && e.intensity === 0;
})());
check('compileDecor: intensity + mouseAttract ajung în config', (() => {
  const h = compileDecor(coerceToLpDecor({ effect: 'dots', interaction: 'mouseAttract', intensity: 80 }), 'a', 'block');
  return h.includes('"intensity":80') && h.includes('"interaction":"mouseAttract"');
})());
check('coerceToLpDecor: custom + reacție de particule → interaction normalizat la none', (() => {
  return coerceToLpDecor({ effect: 'custom', interaction: 'mouseReact' }).interaction === 'none'
    && coerceToLpDecor({ effect: 'custom', interaction: 'mouseParallax' }).interaction === 'mouseParallax'
    && coerceToLpDecor({ effect: 'dots', interaction: 'mouseAttract' }).interaction === 'mouseAttract';
})());
check('compileDecor: dots → canvas + script + id', (() => {
  const h = compileDecor(coerceToLpDecor({ effect: 'dots' }), 'pg', 'page');
  return h.includes('<canvas') && h.includes('lpd-pg') && h.includes('<script>') && h.includes('prefers-reduced-motion');
})());
check('compileDecor: mode page → fixed z-index:-1; block → absolute', (() => {
  const pg = compileDecor(coerceToLpDecor({ effect: 'grid' }), 'a', 'page');
  const bk = compileDecor(coerceToLpDecor({ effect: 'grid' }), 'b', 'block');
  return pg.includes('position:fixed') && pg.includes('z-index:-1') && bk.includes('position:absolute');
})());
check('compileBlocks: bloc decor → section + canvas', (() => {
  const h = compileBlocks([{ id: '1', type: 'decor', props: { decor: { effect: 'shapes' }, heading: 'Salut' } }], { form });
  return h.includes('<section') && h.includes('<canvas') && h.includes('Salut');
})());
check('compileDecor: efecte noi (waves/bubbles/rings) → canvas + script', (() => {
  return ['waves', 'bubbles', 'rings'].every((ef) => {
    const h = compileDecor(coerceToLpDecor({ effect: ef }), 'e', 'block');
    return h.includes('<canvas') && h.includes('<script>');
  });
})());
check('coerceToLpDecor: custom + elements coerce (formă necunoscută → circle, clamp x)', (() => {
  const d = coerceToLpDecor({ effect: 'custom', elements: [{ shape: 'blob', x: 999, size: 9999 }] });
  return d.effect === 'custom' && d.elements.length === 1 && d.elements[0].shape === 'circle' && d.elements[0].x === 100 && d.elements[0].size === 400;
})());
check('compileDecor: custom fără elemente → gol', compileDecor(coerceToLpDecor({ effect: 'custom', elements: [] }), 'c', 'block') === '');
check('compileDecor: custom cu elemente → divuri poziționate + keyframes', (() => {
  const h = compileDecor(coerceToLpDecor({ effect: 'custom', elements: [{ shape: 'star', x: 20, y: 30, anim: 'float' }] }), 'c', 'page');
  return h.includes('left:20%') && h.includes('lpf-float') && h.includes('@keyframes lpf-float') && h.includes('clip-path');
})());
check('compileBlocks: bgDecor pe orice bloc → învelit cu canvas în spate + conținut z-index 1', (() => {
  const h = compileBlocks([{ id: '1', type: 'text', props: { text: 'Salut', bgDecor: { effect: 'dots' } } }], { form });
  return h.includes('<canvas') && h.includes('z-index:1') && h.includes('Salut');
})());
check('compileBlocks: bgDecor none → fără înveliș (neschimbat)', (() => {
  const plain = compileBlocks([{ id: '1', type: 'text', props: { text: 'Salut' } }], { form });
  return !plain.includes('<canvas') && plain.includes('Salut');
})());
check('compileBlocks: blocul decor NU primește bgDecor dublu', (() => {
  const h = compileBlocks([{ id: '1', type: 'decor', props: { decor: { effect: 'grid' }, bgDecor: { effect: 'dots' } } }], { form });
  return (h.match(/<canvas/g) || []).length === 1;
})());
check('compileBlocks: bgDecor custom cu elemente goale → fără înveliș', (() => {
  const h = compileBlocks([{ id: '9', type: 'hero', props: { heading: 'Salut', bgDecor: { effect: 'custom', elements: [] } } }], { form });
  return !h.includes('lpd-') && h.includes('Salut');
})());
check('compileBlocks: bgDecor păstrează data-cta (beacon-ul de CTA funcționează)', (() => {
  const h = compileBlocks([{ id: '1', type: 'hero', props: { heading: 'H', ctaText: 'Click', ctaHref: '#', bgDecor: { effect: 'dots' } } }], { form });
  return h.includes('data-cta') && h.includes('<canvas');
})());
check('compileBlocks: bgDecor păstrează formularul (data-lp-form)', (() => {
  const h = compileBlocks([{ id: '1', type: 'form', props: { bgDecor: { effect: 'grid' } } }], { form });
  return h.includes('data-lp-form') && h.includes('<canvas');
})());

// ── galerie de șabloane ──
check('LP_TEMPLATES: ≥6 șabloane, fiecare compilează în html ne-gol (mod visual)', (() => {
  if (LP_TEMPLATES.length < 6) return false;
  return LP_TEMPLATES.every((tpl) => {
    const lp = landingPageFromTemplate(tpl, 'admin');
    if (lp.editor !== 'visual' || lp.blocks.length === 0) return false;
    return compileBlocks(lp.blocks, { form: lp.form }).length > 100;
  });
})());
check('LP_TEMPLATES: id-uri unice', new Set(LP_TEMPLATES.map((t) => t.id)).size === LP_TEMPLATES.length);

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('landing pages: all checks passed');
