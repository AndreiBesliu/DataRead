// Suite headless: motorul de scorare a acurateței predicțiilor (src/analytics/predictionAccuracy.ts) — bucla de
// învățare (Pachet A). Verifică maparea outcome, bucket-urile de calibrare, acuratețea direcțională și monotonia.
import {
  leadOutcome, contactOutcome, isPositivePrediction, accuracyByTemperature, accuracyByLikelihood,
  directionalAccuracy, isCalibrated, type ScoredPrediction,
} from '../src/analytics/predictionAccuracy';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}`); }
}

console.log('PREDICTION ACCURACY — bucla de învățare');

// outcome mapping
check('leadOutcome: won/lost/open', leadOutcome('won') === 'won' && leadOutcome('lost') === 'lost' && leadOutcome('new') === 'open' && leadOutcome(undefined) === 'open');
check('contactOutcome: castigat→won, pierdut→lost, alt→open', contactOutcome('castigat') === 'won' && contactOutcome('pierdut') === 'lost' && contactOutcome('engaged') === 'open');

// isPositivePrediction
check('positiv: hot → da', isPositivePrediction('hot', 'low') === true);
check('positiv: cold+high → da (după likelihood)', isPositivePrediction('cold', 'high') === true);
check('negativ: cold+low → nu', isPositivePrediction('cold', 'low') === false);
check('negativ: cooling+low → nu', isPositivePrediction('cooling', 'low') === false);

// dataset: hot-uri convertesc mult, cold-uri puțin (calibrat) + câteva open (ignorate)
const scored: ScoredPrediction[] = [
  { temperature: 'hot', conversionLikelihood: 'high', outcome: 'won' },
  { temperature: 'hot', conversionLikelihood: 'high', outcome: 'won' },
  { temperature: 'hot', conversionLikelihood: 'med', outcome: 'lost' },
  { temperature: 'warm', conversionLikelihood: 'med', outcome: 'won' },
  { temperature: 'warm', conversionLikelihood: 'low', outcome: 'lost' },
  { temperature: 'cooling', conversionLikelihood: 'low', outcome: 'lost' },
  { temperature: 'cold', conversionLikelihood: 'low', outcome: 'lost' },
  { temperature: 'cold', conversionLikelihood: 'low', outcome: 'open' }, // ignorat (nedecis)
];

const byTemp = accuracyByTemperature(scored);
const hot = byTemp.find((b) => b.bucket === 'hot')!;
const cold = byTemp.find((b) => b.bucket === 'cold')!;
check('byTemperature: hot decided=3, won=2, rate≈0.667', hot.decided === 3 && hot.won === 2 && Math.abs((hot.convRate ?? 0) - 2 / 3) < 1e-9);
check('byTemperature: cold decided=1, won=0, rate=0 (open ignorat)', cold.decided === 1 && cold.won === 0 && cold.convRate === 0);
check('byTemperature: 4 bucket-uri în ordine hot..cold', byTemp.length === 4 && byTemp[0].bucket === 'hot' && byTemp[3].bucket === 'cold');

const byLk = accuracyByLikelihood(scored);
check('byLikelihood: 3 bucket-uri (low/med/high)', byLk.length === 3 && byLk[0].bucket === 'low' && byLk[2].bucket === 'high');
check('byLikelihood: high decided=2 won=2', (byLk.find((b) => b.bucket === 'high')!).decided === 2);

// direcțională: pozitivi (hot/warm sau high/med): 5 deciși → won pe 1,2,4 = hit; 3 (lost dar pozitiv) miss; 5(warm low=negativ? warm→pozitiv) ...
const dir = directionalAccuracy(scored);
check('direcțional: decided = 7 (open exclus)', dir.decided === 7);
check('direcțional: rate în [0,1]', dir.rate !== null && dir.rate >= 0 && dir.rate <= 1);

// calibrare: setul de mai sus are hot(0.667) ≥ warm(0.5) ≥ cooling(0) ≥ cold(0) → calibrat
check('isCalibrated: monoton descrescător → true', isCalibrated(byTemp) === true);
// set ne-calibrat: cold convertește mai mult decât hot
const bad = isCalibrated(accuracyByTemperature([
  { temperature: 'hot', conversionLikelihood: 'high', outcome: 'lost' },
  { temperature: 'cold', conversionLikelihood: 'low', outcome: 'won' },
]));
check('isCalibrated: hot<cold → false', bad === false);
check('isCalibrated: fără date → false', isCalibrated(accuracyByTemperature([])) === false);

console.log(`\nprediction accuracy: ${failures ? failures + ' EȘUATE' : 'all checks passed'}`);
if (failures) process.exit(1);
