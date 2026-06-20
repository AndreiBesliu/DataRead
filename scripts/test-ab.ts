// Suite headless: motorul de verdict A/B (src/analytics/lpABWinner.ts) — corectitudine statistică (z-test pe
// două proporții), praguri de sample, niciun fals-pozitiv din zgomot.
import { abArmKpi, pickAbWinner, twoProportionPValue, AB_ALPHA, type AbArmStat } from '../src/analytics/lpABWinner';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}

console.log('A/B WINNER — verdict statistic');

// abArmKpi
check('abArmKpi: convRate = submissions/visits', abArmKpi({ id: 'a', label: '', visits: 200, submissions: 10 }).convRate === 0.05);
check('abArmKpi: visits 0 → convRate 0 (fără NaN)', abArmKpi({ id: 'a', label: '', visits: 0, submissions: 0 }).convRate === 0);
check('abArmKpi: valori negative → 0 (coerce)', abArmKpi({ id: 'a', label: '', visits: -5 as number, submissions: -2 as number }).visits === 0);

// twoProportionPValue
check('pValue: diferență mare → p mic (<0.05)', (twoProportionPValue(80, 1000, 30, 1000) ?? 1) < 0.05);
check('pValue: proporții egale → p mare (>0.5)', (twoProportionPValue(50, 1000, 50, 1000) ?? 0) > 0.5);
check('pValue: n=0 → null', twoProportionPValue(0, 0, 1, 10) === null);
check('AB_ALPHA = 0.05', AB_ALPHA === 0.05);

// pickAbWinner — sub 2 arme
check('pick: <2 arme → insufficient', pickAbWinner([{ id: 'a', label: 'A', visits: 500, submissions: 50 }], { minSamplePerArm: 200 }).status === 'insufficient');

// pick — arm sub prag de sample → insufficient (colectare)
{
  const v = pickAbWinner([
    { id: 'a', label: 'A', visits: 100, submissions: 5 },
    { id: 'b', label: 'B', visits: 1000, submissions: 80 },
  ], { minSamplePerArm: 200 });
  check('pick: un arm sub minSample → insufficient', v.status === 'insufficient' && v.winnerId === null);
  check('pick: leaderId = top după rată chiar la insufficient', v.leaderId === 'b');
}

// pick — câștigător clar (sample mare, diferență mare, semnificativ)
{
  const v = pickAbWinner([
    { id: 'a', label: 'Control', visits: 1000, submissions: 30 },
    { id: 'b', label: 'Variantă', visits: 1000, submissions: 80 },
  ], { minSamplePerArm: 200 });
  check('pick: diferență semnificativă → winner', v.status === 'winner' && v.winnerId === 'b');
  check('pick: pValue raportat la winner', v.pValue !== null && v.pValue < AB_ALPHA);
  check('pick: arms sortate desc după convRate', v.arms[0].id === 'b' && v.arms[1].id === 'a');
}

// pick — diferență neconcludentă (sample mare dar fără semnificație) → no-difference, NU winner
{
  const v = pickAbWinner([
    { id: 'a', label: 'A', visits: 1000, submissions: 50 },
    { id: 'b', label: 'B', visits: 1000, submissions: 52 },
  ], { minSamplePerArm: 200 });
  check('pick: diferență mică → no-difference (anti fals-pozitiv)', v.status === 'no-difference' && v.winnerId === null);
}

// pick — anti fals-pozitiv pe sample MIC chiar cu „uplift" uriaș (1 vs 2 conversii la 30 vizite)
{
  const v = pickAbWinner([
    { id: 'a', label: 'A', visits: 30, submissions: 1 },
    { id: 'b', label: 'B', visits: 30, submissions: 2 },
  ], { minSamplePerArm: 30 });
  check('pick: sample mic + uplift aparent → NU winner (no-difference/insufficient)', v.status !== 'winner');
}

console.log(`\nA/B winner: ${failures ? failures + ' EȘUATE' : 'all checks passed'}`);
if (failures) process.exit(1);
