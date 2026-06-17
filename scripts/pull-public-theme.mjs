// Coace tema publică în snapshot-ul commit-uit (src/config/publicTheme.ts), ca paginile prerandate să
// apară temate fără flash. Citește siteConfig/publicTheme via Firestore REST (doc PUBLIC-read → fără
// credențiale) și rescrie literalul. Best-effort: la ORICE eroare (offline / doc inexistent / parse)
// lasă fișierul neschimbat și iese 0 — nu sparge build-ul/CI. Rulat manual în sync, înainte de build:site.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PROJECT = (() => {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf-8').match(/^VITE_FIREBASE_PROJECT_ID=(.+)$/m);
    if (m) return m[1].trim();
  }
  return 'dataread-e1bd6';
})();
const OUT = 'src/config/publicTheme.ts';
const URL = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/siteConfig/publicTheme`;

// Firestore REST „typed value" → JS simplu.
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
    console.log(`pull-public-theme: doc indisponibil (HTTP ${res.status}) — snapshot neschimbat.`);
    process.exit(0);
  }
  const doc = await res.json();
  const data = fromFields(doc.fields || {});
  const theme = data.theme;
  if (!theme || typeof theme !== 'object' || !theme.vars) {
    console.log('pull-public-theme: doc fără temă validă — snapshot neschimbat.');
    process.exit(0);
  }
  const header = readFileSync(OUT, 'utf-8').split('export const PUBLIC_THEME_DEFAULT')[0];
  const body = `export const PUBLIC_THEME_DEFAULT: CustomTheme = ${JSON.stringify(theme, null, 2)};\n`;
  writeFileSync(OUT, header + body, 'utf-8');
  console.log('pull-public-theme: snapshot copt din Firestore ✓');
} catch (e) {
  console.log('pull-public-theme: eroare la fetch/parse — snapshot neschimbat. ' + String(e).slice(0, 120));
  process.exit(0);
}
