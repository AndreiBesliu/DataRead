// Suite headless: Fundația stratificată (functions/prompts/personas.js) — structura blocurilor
// `system` + plasarea cache_control, fără apel Anthropic real. Verifică invarianții de caching:
// prefix stabil înaintea suffix-ului volatil, L1 byte-identic, L2 per-verticală, prag 4096, ≤4 breakpoints.
// Modul pur CommonJS (zero deps firebase) → esbuild îl bundle-uiește direct în run-tests.mjs.
import {
  buildSystemBlocks,
  buildL1Text,
  buildL2Text,
  normIndustry,
  PERSONAS,
  // @ts-ignore — modul JS din functions, fără declarații de tip (scripts nu sunt sub tsc)
} from '../functions/prompts/personas.js';

let failures = 0;
function check(name: string, ok: boolean) {
  if (ok) { console.log('  ok  ', name); }
  else { failures++; console.error('  FAIL', name); }
}

const ccBlocks = (blocks: any[]) => blocks.filter((b) => b && b.cache_control);
const cachedPrefix = (blocks: any[]) => JSON.stringify(ccBlocks(blocks));

console.log('test-personas: Fundația stratificată + cache_control');

// 1) Pragul Opus 4.8: L1 trebuie să depășească 4096 tokeni ca să se memoreze. Estimarea pesimistă
//    (chars/4 ≈ tokeni) trebuie să rămână ≥ 4096 → length ≥ 16384.
const l1 = buildL1Text();
check('buildL1Text e string ne-gol', typeof l1 === 'string' && l1.length > 0);
check(`L1 ≥ 16384 caractere (clear 4096 tokeni la chars/4) — actual ${l1.length}`, l1.length >= 16384);
check('L1 conține toate cele 4 roluri (persona)', Object.values(PERSONAS).every((r) => l1.includes(r as string)));

// 2) Structura blocurilor cu verticală cunoscută (horeca): L1(cc) + L2(cc) + directivă(fără cc).
const wH = buildSystemBlocks({ persona: PERSONAS.analyst, industry: 'horeca' });
check('blocuri = array', Array.isArray(wH));
check('toate blocurile sunt {type:text, text:string}', wH.every((b: any) => b && b.type === 'text' && typeof b.text === 'string'));
check('cu verticală → exact 3 blocuri', wH.length === 3);
check('bloc 0 (L1) are cache_control ephemeral', wH[0].cache_control && wH[0].cache_control.type === 'ephemeral');
check('bloc 1 (L2) are cache_control ephemeral', wH[1].cache_control && wH[1].cache_control.type === 'ephemeral');
check('ultimul bloc (directivă) NU are cache_control (suffix volatil)', !wH[wH.length - 1].cache_control);
check('L2 conține numele verticalei (horeca)', wH[1].text.toLowerCase().includes('horeca'));
check('directiva conține rolul activ (analist)', wH[2].text.includes(PERSONAS.analyst));

// 3) Limita API: ≤ 4 breakpoints, ≥ 1.
const ccH = ccBlocks(wH);
check('≤ 4 breakpoints cache_control', ccH.length <= 4);
check('≥ 1 breakpoint cache_control', ccH.length >= 1);

// 4) Ordinea prefix-stabil: toate blocurile cache-uite vin ÎNAINTEA celor necache-uite.
const lastCc = wH.map((b: any) => !!b.cache_control).lastIndexOf(true);
const firstNonCc = wH.map((b: any) => !!b.cache_control).indexOf(false);
check('blocurile cache-uite preced pe cele necache-uite', firstNonCc === -1 || lastCc < firstNonCc);

// 5) Fără verticală mapabilă (other/necunoscut/undefined): L1(cc) + directivă, fără L2.
for (const ind of ['other', 'xyz', '', undefined]) {
  const w = buildSystemBlocks({ persona: PERSONAS.strategist, industry: ind as any });
  check(`industry=${JSON.stringify(ind)} → 2 blocuri (fără L2)`, w.length === 2);
  check(`industry=${JSON.stringify(ind)} → bloc 0 (L1) cache-uit`, !!w[0].cache_control);
  check(`industry=${JSON.stringify(ind)} → ultimul bloc necache-uit`, !w[1].cache_control);
}

// 6) INVARIANT DE VOLATILITATE: prefixul cache-uit NU depinde de persona (altfel fragmentare per-callable).
const sameIndDiffPersona =
  cachedPrefix(buildSystemBlocks({ persona: PERSONAS.strategist, industry: 'horeca' })) ===
  cachedPrefix(buildSystemBlocks({ persona: PERSONAS.analyst, industry: 'horeca' }));
check('prefix cache-uit identic pentru aceeași verticală, persona diferită', sameIndDiffPersona);

// 7) L1 (bloc 0) byte-identic între verticale diferite → o singură intrare universală partajată.
check('L1 identic între verticale diferite',
  buildSystemBlocks({ persona: PERSONAS.strategist, industry: 'horeca' })[0].text ===
  buildSystemBlocks({ persona: PERSONAS.strategist, industry: 'retail' })[0].text);

// 8) normIndustry — mapare + sinonime + necunoscute.
check('normIndustry retail→retail', normIndustry('retail') === 'retail');
check('normIndustry Retail (case)→retail', normIndustry('Retail') === 'retail');
check('normIndustry ecommerce (sinonim)→retail', normIndustry('ecommerce') === 'retail');
check('normIndustry restaurant (sinonim)→horeca', normIndustry('restaurant') === 'horeca');
check('normIndustry other→null', normIndustry('other') === null);
check('normIndustry necunoscut→null', normIndustry('zzz') === null);
check('normIndustry gol→null', normIndustry('') === null);
check('normIndustry undefined→null', normIndustry(undefined as any) === null);

// 9) buildL2Text — toate cele 8 verticale au benchmark; 'other' → null; conține unitățile.
const VERTICALS = ['retail', 'horeca', 'services', 'construction', 'beauty', 'auto', 'medical', 'education'];
check('toate cele 8 verticale au L2 ne-null', VERTICALS.every((v) => typeof buildL2Text(v) === 'string'));
check('buildL2Text(other) === null', buildL2Text('other') === null);
const l2r = buildL2Text('retail') || '';
check('L2 retail conține CTR + € (unități benchmark)', l2r.includes('CTR') && l2r.includes('€'));

// 10) buildSystemBlocks() fără argumente → default strategist, fără L2.
const wD = buildSystemBlocks();
check('fără argumente → 2 blocuri', wD.length === 2);
check('fără argumente → directiva conține strategist (default)', wD[1].text.includes(PERSONAS.strategist));

if (failures) {
  console.error(`\ntest-personas: ${failures} eșec(uri)`);
  process.exit(1);
} else {
  console.log('\ntest-personas: toate verificările au trecut');
}
