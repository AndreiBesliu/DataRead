// Coace chrome-ul global (header/footer + meniu) în snapshot-ul commit-uit (src/config/publicChrome.ts), ca
// paginile prerandate să apară cu header/footer fără flash. Citește siteConfig/publicChrome via Firestore REST
// (doc PUBLIC-read → fără credențiale) și rescrie literalul. Best-effort: la ORICE eroare (offline / doc
// inexistent / parse) lasă fișierul neschimbat și iese 0 — nu sparge build-ul/CI. Rulat manual în sync, înainte de build:site.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PROJECT = (() => {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf-8').match(/^VITE_FIREBASE_PROJECT_ID=(.+)$/m);
    if (m) return m[1].trim();
  }
  return 'dataread-e1bd6';
})();
const OUT = 'src/config/publicChrome.ts';
const URL = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/siteConfig/publicChrome`;

// Firestore REST „typed value" → JS simplu (recursiv pe map/array, ca nav/footerLinks să se decodeze corect).
function fromValue(v) {
  if (v == null) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  return undefined;
}
function fromFields(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields)) o[k] = fromValue(v);
  return o;
}

try {
  const res = await fetch(URL);
  if (!res.ok) {
    console.log(`pull-public-chrome: doc indisponibil (HTTP ${res.status}) — snapshot neschimbat.`);
    process.exit(0);
  }
  const doc = await res.json();
  const data = fromFields(doc.fields || {});
  const chrome = data.chrome;
  if (!chrome || typeof chrome !== 'object' || (!chrome.brandName && !Array.isArray(chrome.nav))) {
    console.log('pull-public-chrome: doc fără chrome valid — snapshot neschimbat.');
    process.exit(0);
  }
  const header = readFileSync(OUT, 'utf-8').split('export const PUBLIC_CHROME_DEFAULT')[0];
  const body = `export const PUBLIC_CHROME_DEFAULT: SiteChrome = ${JSON.stringify(chrome, null, 2)};\n`;
  writeFileSync(OUT, header + body, 'utf-8');
  console.log('pull-public-chrome: snapshot copt din Firestore ✓');
} catch (e) {
  console.log('pull-public-chrome: eroare la fetch/parse — snapshot neschimbat. ' + String(e).slice(0, 120));
  process.exit(0);
}
