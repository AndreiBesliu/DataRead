// Suite headless: leagă schema OnboardingData de whitelist-urile `hasOnly([...])` din firestore.rules.
// Clasă de bug prinsă de review: un câmp nou pe OnboardingData (ex. serviceInterest) e scris MEREU de
// formular (SDK-ul serializează null ca field), dar dacă lipsește din whitelist, regula respinge TOATE
// scrierile (lead-uri publice + onboarding client) — build/typecheck NU prind asta (eșec runtime de reguli).
// Aici verificăm static: fiecare cheie din emptyOnboarding() apare în AMBELE whitelist-uri (leads + onboarding).
import { readFileSync } from 'node:fs';
import { emptyOnboarding } from '../src/types/onboarding';

let failures = 0;
function check(name: string, ok: boolean): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

const rules = readFileSync('firestore.rules', 'utf-8');

/** Conținutul primului `hasOnly( … )` care urmează după un marker `match /<col>/`. */
function whitelistAfter(marker: string): string {
  const afterMatch = rules.split(marker)[1] ?? '';
  const afterHasOnly = afterMatch.split('hasOnly(')[1] ?? '';
  return afterHasOnly.split(')')[0];
}

const leadsWl = whitelistAfter('match /leads/');
const onbWl = whitelistAfter('match /onboarding/');
const dataKeys = Object.keys(emptyOnboarding()); // toate câmpurile pe care formularele le scriu

check('whitelist leads extras', leadsWl.includes('companyName'));
check('whitelist onboarding extras', onbWl.includes('companyName'));

for (const k of dataKeys) {
  check(`leads whitelist conține '${k}'`, leadsWl.includes(`'${k}'`));
  check(`onboarding whitelist conține '${k}'`, onbWl.includes(`'${k}'`));
}

// Sanity: serviceInterest (câmpul nou) chiar e acolo (regresia exactă prinsă de review).
check("serviceInterest e în whitelist-ul leads", leadsWl.includes("'serviceInterest'"));
check("serviceInterest e în whitelist-ul onboarding", onbWl.includes("'serviceInterest'"));

if (failures) {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
console.log('firestore rules ↔ OnboardingData: all checks passed');
