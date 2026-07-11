// Suite headless: bucla de învățare pt. verdicte (insight-accuracy) — src/analytics/insightAccuracy.ts.
import { insightAccuracy, verdictAligned, INSIGHT_ROAS_FLOOR } from '../src/analytics/insightAccuracy';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

console.log('INSIGHT-ACCURACY — alinierea verdictelor cu ROAS');

// verdictAligned — polaritate per verdict.
check('scale: ROAS urcat/stabil → aliniat', verdictAligned('scale', 2, 3) === true && verdictAligned('scale', 2, 2) === true);
check('scale: ROAS coborât → nealiniat', verdictAligned('scale', 3, 2) === false);
check('scale: ROAS lipsă → null', verdictAligned('scale', null, 2) === null && verdictAligned('scale', 2, null) === null);
check('maintain: stabil (±10%) → aliniat', verdictAligned('maintain', 2, 2.1) === true);
check('maintain: instabil → nealiniat', verdictAligned('maintain', 2, 3) === false);
check('pause: ROAS sub prag → justificat (aliniat)', verdictAligned('pause', INSIGHT_ROAS_FLOOR - 0.5, 0) === true);
check('pause: ROAS peste prag → nejustificat', verdictAligned('pause', 2, 2) === false);
check('pause: roasAt lipsă → null', verdictAligned('pause', null, 1) === null);
check('test: neutru → null', verdictAligned('test', 1, 5) === null);

// insightAccuracy — agregare.
const rows = [
  { verdict: 'scale', roasAt: 2, roasNow: 3 }, // aliniat
  { verdict: 'scale', roasAt: 3, roasNow: 2 }, // nealiniat
  { verdict: 'pause', roasAt: 0.5, roasNow: 0.5 }, // aliniat (justificat)
  { verdict: 'pause', roasAt: 2, roasNow: 2 }, // nealiniat
  { verdict: 'test', roasAt: 1, roasNow: 1.5 }, // neutru (nescored)
  { verdict: 'garbage', roasAt: 1, roasNow: 1 }, // verdict invalid → sărit
];
const ia = insightAccuracy(rows);
check('total = 5 (garbage exclus)', ia.total === 5);
check('scored = 4 (test neutru nescored)', ia.scored === 4);
check('aligned = 2 (1 scale + 1 pause)', ia.aligned === 2);
check('alignedRate = 0.5', ia.alignedRate === 0.5);
{
  const scale = ia.byVerdict.find((v) => v.verdict === 'scale')!;
  const pause = ia.byVerdict.find((v) => v.verdict === 'pause')!;
  const test = ia.byVerdict.find((v) => v.verdict === 'test')!;
  check('scale: n=2 scored=2 aligned=1 avgDelta=0', scale.n === 2 && scale.scored === 2 && scale.aligned === 1 && scale.avgDeltaRoas === 0);
  check('pause: n=2 scored=2 aligned=1', pause.n === 2 && pause.scored === 2 && pause.aligned === 1);
  check('test: n=1 scored=0 avgDelta=0.5', test.n === 1 && test.scored === 0 && test.avgDeltaRoas === 0.5);
}
check('insightAccuracy: gol → total 0, alignedRate null', (() => { const e = insightAccuracy([]); return e.total === 0 && e.alignedRate === null; })());
check('insightAccuracy: ROAS negativ/NaN → null (nescored dacă e nevoie)', (() => {
  const r = insightAccuracy([{ verdict: 'scale', roasAt: NaN, roasNow: 3 }]);
  return r.total === 1 && r.scored === 0;
})());

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('insight-accuracy: all checks passed');
