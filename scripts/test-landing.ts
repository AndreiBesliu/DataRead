// Suite headless: coerce + slug + validare submission (landingPage.ts) + math rollup (lpStats.ts).
import {
  coerceToLandingPage,
  coerceToLpSubmission,
  compilePageDecors,
  effectiveLpForm,
  htmlByteSize,
  recompileLpAssets,
  sanitizeSlug,
  sanitizeSubmissionValues,
  LP_HTML_MAX,
  LP_FORM_FIELDS_MAX,
  LP_PAGE_DECORS_MAX,
  type LpFormField,
} from '../src/types/landingPage';
import { coerceToPreviewScreens, defaultScreens, LP_PREVIEW_SCREENS_MAX, LP_PV_W_MAX, withIds } from '../src/types/lpPreviewScreens';
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
import { coerceToLpProject, LP_PROJECT_COLORS } from '../src/types/lpProject';
import { coerceToLpLeadState } from '../src/types/lpLeadState';
import { csvCell, toCsv } from '../src/utils/csv';
import { coerceToRecommendedChannels, sortByImpact } from '../src/types/recommendation';
import { composePrintHtml, escapeHtml } from '../src/utils/printDoc';
import { buildSuggestions } from '../src/admin/suggestions';
import ro from '../src/i18n/locales/ro';
import { OPERATOR_HELP, CLIENT_HELP } from '../src/help/helpContent';

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
  return lp.status === 'draft' && lp.html === '' && lp.slug === '' && lp.schema === 1 && lp.lang === 'ro' && lp.projectId === '' && Object.keys(lp.knownVariants).length === 0;
})());
check('coerce: projectId păstrat (organizare)', coerceToLandingPage({ projectId: 'proj123' }).projectId === 'proj123');
check('csvCell: neutralizează injecția de formule (=,+,-,@) + escapează ghilimele', (() => {
  return csvCell('=SUM(A1)') === '"\'=SUM(A1)"' && csvCell('+1') === '"\'+1"' && csvCell('@x') === '"\'@x"'
    && csvCell('ok') === '"ok"' && csvCell('a"b') === '"a""b"' && toCsv([['=x', 'b']]) === '"\'=x","b"';
})());
check('coerceToLpLeadState: status valid păstrat, invalid → nou, note/slug clamp', (() => {
  const a = coerceToLpLeadState({ status: 'castigat', note: 'x'.repeat(2000), slug: 'promo' });
  const b = coerceToLpLeadState({ status: 'turbo' });
  return a.schema === 1 && a.status === 'castigat' && a.note.length === 1000 && a.slug === 'promo' && b.status === 'nou' && b.note === '';
})());
check('coerceToLpProject: nume + culoare validă; fallback culoare', (() => {
  const a = coerceToLpProject({ name: 'Campanie Iarnă', color: '#22c55e', clientUid: 'u1' });
  const b = coerceToLpProject({ name: 'X', color: 'nu-e-hex' });
  return a.schema === 1 && a.name === 'Campanie Iarnă' && a.color === '#22c55e' && a.clientUid === 'u1' && b.color === LP_PROJECT_COLORS[0];
})());
// ── recomandarea de canale (pasul Oportunități) ──
check('coerceToRecommendedChannels: null/gunoi → []', coerceToRecommendedChannels(null).length === 0 && coerceToRecommendedChannels('x').length === 0 && coerceToRecommendedChannels(42).length === 0);
check('coerceToRecommendedChannels: impact/objective invalid → default; clamp titlu', (() => {
  const c = coerceToRecommendedChannels([{ title: 'a'.repeat(300), impact: 'turbo', impactReason: 'x', description: 'd', suggestedObjective: 'nope', suggestedOffer: 'o' }])[0];
  return c.title.length === 140 && c.impact === 'mediu' && c.suggestedObjective === '';
})());
check('coerceToRecommendedChannels: valori valide păstrate', (() => {
  const c = coerceToRecommendedChannels([{ title: 'Google Ads', impact: 'ridicat', impactReason: 'intenție', description: 'd', suggestedObjective: 'leads', suggestedOffer: 'reducere' }])[0];
  return c.impact === 'ridicat' && c.suggestedObjective === 'leads' && c.title === 'Google Ads';
})());
check('coerceToRecommendedChannels: suggestedObjective "other" → "" (paritate cu enum-ul schemei callable)', coerceToRecommendedChannels([{ title: 'x', suggestedObjective: 'other' }])[0].suggestedObjective === '');
check('coerceToRecommendedChannels: plafon 8 carduri', coerceToRecommendedChannels(Array.from({ length: 20 }, () => ({ title: 'x', impact: 'mediu' }))).length === 8);
check('sortByImpact: ordine ridicat→scazut, nu mutează input', (() => {
  const input = coerceToRecommendedChannels([{ title: 'B', impact: 'scazut' }, { title: 'A', impact: 'ridicat' }, { title: 'C', impact: 'mediu' }]);
  const sorted = sortByImpact(input);
  return sorted.map((x) => x.impact).join(',') === 'ridicat,mediu,scazut' && input[0].impact === 'scazut';
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
check('compileDecor: motor canvas conține scalare responsivă (scl/W/REF)', (() => {
  const h = compileDecor(coerceToLpDecor({ effect: 'constellation' }), 'e', 'page');
  return h.includes('function scl()') && h.includes('W/REF') && /D=120\*scl\(\)/.test(h);
})());
check('compileDecor: custom scalează elementele (var --lpf-s + script de scalare)', (() => {
  const h = compileDecor(coerceToLpDecor({ effect: 'custom', elements: [{ shape: 'circle', x: 50, y: 50 }] }), 'c', 'block');
  return h.includes('scale(var(--lpf-s,1))') && h.includes('setProperty("--lpf-s"');
})());
check('htmlByteSize: octeți UTF-8 (diacritice/emoji > .length), nu unități UTF-16', (() => {
  return htmlByteSize('abc') === 3 && htmlByteSize('ăâîșț') === 10 && htmlByteSize('a') === 1 && 'ăâîșț'.length === 5;
})());
check('effectiveLpForm: bloc form forțează form.enabled (formular „mort" → activat)', (() => {
  const lp = coerceToLandingPage({ editor: 'visual', blocks: [{ type: 'form' }], form: { enabled: false, fields: [{ name: 'email', label: 'Email', type: 'email' }] } });
  return effectiveLpForm(lp).enabled === true && lp.form.enabled === false;
})());
check('recompileLpAssets: vizual → html din blocuri + pageDecorHtml; respectă formularul efectiv', (() => {
  const lp = coerceToLandingPage({ editor: 'visual', html: 'STALE', blocks: [{ type: 'hero', props: { heading: 'Salut' } }, { type: 'form' }], pageDecor: { effect: 'dots' }, form: { enabled: false, fields: [{ name: 'email', label: 'Email', type: 'email' }] } });
  const a = recompileLpAssets(lp);
  return a.html.includes('Salut') && a.html.includes('data-lp-form') && !a.html.includes('STALE') && a.pageDecorHtml.includes('lpd-pg') && a.hasForm === true;
})());
check('recompileLpAssets: mod cod → html-ul brut rămâne neatins', (() => {
  const lp = coerceToLandingPage({ editor: 'code', html: '<h1>Manual</h1>', pageDecor: { effect: 'none' } });
  const a = recompileLpAssets(lp);
  return a.html === '<h1>Manual</h1>' && a.pageDecorHtml === '';
})());
// ── fundaluri decorative multiple pe pagină (straturi) ──
check('coerce: migrare legacy pageDecor single (non-none) → pageDecors[1]', (() => {
  const lp = coerceToLandingPage({ pageDecor: { effect: 'waves' } });
  return Array.isArray(lp.pageDecors) && lp.pageDecors.length === 1 && lp.pageDecors[0].effect === 'waves';
})());
check('coerce: legacy pageDecor none → pageDecors []', coerceToLandingPage({ pageDecor: { effect: 'none' } }).pageDecors.length === 0);
check('coerce: pageDecors array păstrat + plafon LP_PAGE_DECORS_MAX', (() => {
  const many = Array.from({ length: 9 }, () => ({ effect: 'dots' }));
  const lp = coerceToLandingPage({ pageDecors: many });
  return lp.pageDecors.length === LP_PAGE_DECORS_MAX && lp.pageDecors.every((d) => d.effect === 'dots');
})());
check('compilePageDecors: 2 straturi → id-uri pg0 + pg1 distincte', (() => {
  const html = compilePageDecors(coerceToLandingPage({ pageDecors: [{ effect: 'dots' }, { effect: 'waves' }] }).pageDecors);
  return html.includes('lpd-pg0') && html.includes('lpd-pg1');
})());
check('compilePageDecors: stratul none nu contribuie', (() => {
  const html = compilePageDecors(coerceToLandingPage({ pageDecors: [{ effect: 'none' }, { effect: 'dots' }] }).pageDecors);
  return html.includes('lpd-pg1') && !html.includes('lpd-pg0');
})());

// ── ecrane de previzualizare (preferință de workspace) ──
check('coerceToPreviewScreens: non-array → default', coerceToPreviewScreens(null).length === defaultScreens().length && coerceToPreviewScreens('x').length > 0);
check('coerceToPreviewScreens: clamp lățime + cap număr + id pozițional', (() => {
  const screens = coerceToPreviewScreens(Array.from({ length: 12 }, () => ({ width: 99999, height: 700 })));
  return screens.length === LP_PREVIEW_SCREENS_MAX && screens[0].width === LP_PV_W_MAX && screens[0].id === 'scr0' && screens[1].id === 'scr1';
})());
check('coerceToPreviewScreens: listă goală → default (nu rămâne gol)', coerceToPreviewScreens([]).length === defaultScreens().length);
check('withIds: label ne-string → "", reindexează', (() => {
  const s = withIds([{ label: 42 as unknown as string, width: 400, height: 800 }]);
  return s[0].label === '' && s[0].width === 400 && s[0].id === 'scr0';
})());

// ── export PDF (print-to-PDF din browser) ──
check('escapeHtml: neutralizează < > & "', escapeHtml('<b>"x"&y</b>') === '&lt;b&gt;&quot;x&quot;&amp;y&lt;/b&gt;');
check('composePrintHtml: conține titlul + secțiunile non-goale, sare cele goale', (() => {
  const html = composePrintHtml({ title: 'Raport TEST', meta: ['Client: Acme'], sections: [{ label: 'Rezumat', body: 'Mers bine' }, { label: 'Gol', body: '   ' }] });
  return html.includes('<title>Raport TEST</title>') && html.includes('Rezumat') && html.includes('Mers bine') && html.includes('Client: Acme') && !html.includes('>Gol<');
})());
check('composePrintHtml: body cu HTML e ESCAPAT (anti injecție în documentul de print)', (() => {
  const html = composePrintHtml({ title: 'T', sections: [{ label: 'S', body: '<script>alert(1)</script>' }] });
  return html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !html.includes('<script>alert(1)');
})());

// ── sugestii proactive operator (buildSuggestions, pur) ──
{
  const NOW = 1_700_000_000_000;
  const day = 86_400_000;
  const lead = (over: Record<string, unknown>) => ({ id: 'l1', companyName: 'Acme', status: 'new', createdAtMs: NOW, reportAtMs: 0, clientUid: '', ...over }) as Parameters<typeof buildSuggestions>[0]['leads'][number];
  const camp = (over: Record<string, unknown>) => ({ id: 'c1', name: 'Camp', leadId: 'l1', clientName: 'Acme', verdict: '', headline: '', ...over }) as Parameters<typeof buildSuggestions>[0]['campaigns'][number];

  check('buildSuggestions: input gol → []', buildSuggestions({ leads: [], campaigns: [], nowMs: NOW }).length === 0);
  check('sugestii: lead new vechi → leadUntouched high', (() => {
    const s = buildSuggestions({ leads: [lead({ createdAtMs: NOW - 5 * day })], campaigns: [], nowMs: NOW });
    return s.length === 1 && s[0].kind === 'leadUntouched' && s[0].severity === 'high';
  })());
  check('sugestii: lead new proaspăt → none', buildSuggestions({ leads: [lead({ createdAtMs: NOW })], campaigns: [], nowMs: NOW }).length === 0);
  check('sugestii: lead contacted vechi → leadStale medium', (() => {
    const s = buildSuggestions({ leads: [lead({ status: 'contacted', createdAtMs: NOW - 20 * day })], campaigns: [], nowMs: NOW });
    return s.some((x) => x.kind === 'leadStale' && x.severity === 'medium');
  })());
  check('sugestii: campanie verdict pause → campaignAction high (detail conține headline)', (() => {
    const s = buildSuggestions({ leads: [lead({ status: 'won', reportAtMs: NOW })], campaigns: [camp({ verdict: 'pause', headline: 'CPL prea mare' })], nowMs: NOW });
    return s.some((x) => x.kind === 'campaignAction' && x.severity === 'high' && x.detail.includes('CPL prea mare'));
  })());
  check('sugestii: campanie verdict maintain → fără campaignAction', (() => {
    const s = buildSuggestions({ leads: [lead({ status: 'won', reportAtMs: NOW })], campaigns: [camp({ verdict: 'maintain' })], nowMs: NOW });
    return !s.some((x) => x.kind === 'campaignAction');
  })());
  check('sugestii: lead cu campanie fără raport luna curentă → reportMissing', (() => {
    const s = buildSuggestions({ leads: [lead({ status: 'won', reportAtMs: NOW - 60 * day })], campaigns: [camp({})], nowMs: NOW });
    return s.some((x) => x.kind === 'reportMissing');
  })());
  check('sugestii: lead cu raport luna curentă → fără reportMissing', (() => {
    const s = buildSuggestions({ leads: [lead({ status: 'won', reportAtMs: NOW })], campaigns: [camp({})], nowMs: NOW });
    return !s.some((x) => x.kind === 'reportMissing');
  })());
  check('sugestii: sortare după severitate (high prima)', buildSuggestions({ leads: [lead({ createdAtMs: NOW - 5 * day })], campaigns: [camp({ verdict: 'test' })], nowMs: NOW })[0].severity === 'high');
}

// ── Ghid/Documentație: acoperirea cheilor i18n din helpContent (altfel s-ar randa cheia brută) ──
check('help: toate cheile din helpContent (titlu+subtitluri) există în ro', (() => {
  const resolve = (key: string): unknown => key.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), ro);
  const keys: string[] = [];
  for (const s of [...OPERATOR_HELP, ...CLIENT_HELP]) { keys.push(s.titleKey); for (const it of s.items) { keys.push(it.titleKey); if (it.bodyKey) keys.push(it.bodyKey); } }
  const missing = keys.filter((k) => typeof resolve(k) !== 'string' || !(resolve(k) as string).trim());
  if (missing.length) console.error('   chei lipsă:', missing.join(', '));
  return missing.length === 0;
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
