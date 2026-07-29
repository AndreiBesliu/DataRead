// Coace override-urile de CONȚINUT (Felia B) în snapshot-ul commit-uit (src/config/pageContentSnapshot.ts),
// ca paginile prerandate să conțină textul PUBLICAT — fără flash la încărcare și vizibil pentru crawlere.
// Citește siteConfig/pageContent via Firestore REST (doc PUBLIC-read → fără credențiale) și rescrie literalul.
// Best-effort: la ORICE eroare (offline / doc inexistent / parse) lasă fișierul neschimbat și iese 0 —
// nu sparge build-ul/CI. Rulat manual în sync, înainte de build:site. Oglindește pull-public-chrome.mjs.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PROJECT = (() => {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf-8').match(/^VITE_FIREBASE_PROJECT_ID=(.+)$/m);
    if (m) return m[1].trim();
  }
  return 'dataread-e1bd6';
})();
const OUT = 'src/config/pageContentSnapshot.ts';
const URL = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/siteConfig/pageContent`;

// Plafoane OGLINDĂ cu src/types/pageContent.ts — snapshotul intră în bundle, deci nu-l lăsăm să crească.
const MAX_CONTENT_KEYS = 300;
const MAX_CONTENT_VALUE_LEN = 4000;
const LANGS = ['ro', 'en'];
const KEY_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*){0,4}$/;

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

async function main() {
  const res = await fetch(URL);
  if (!res.ok) {
    // 404 = nimic publicat încă → snapshot gol e răspunsul CORECT, nu o eroare.
    console.log(`pull-page-content: doc indisponibil (HTTP ${res.status}) — snapshot neschimbat.`);
    return;
  }
  const data = fromFields((await res.json()).fields || {});
  const src = data.content && typeof data.content === 'object' ? data.content : null;
  if (!src) {
    console.log('pull-page-content: doc fără `content` — snapshot neschimbat.');
    return;
  }
  const content = {};
  let total = 0;
  for (const lang of LANGS) {
    content[lang] = {};
    const bag = src[lang] && typeof src[lang] === 'object' ? src[lang] : {};
    let n = 0;
    for (const [k, v] of Object.entries(bag)) {
      if (n >= MAX_CONTENT_KEYS) break;
      if (!KEY_RE.test(k) || typeof v !== 'string' || v.trim() === '') continue;
      content[lang][k] = v.slice(0, MAX_CONTENT_VALUE_LEN);
      n++;
      total++;
    }
  }
  const header = readFileSync(OUT, 'utf-8').split('export const PAGE_CONTENT_DEFAULT')[0];
  const body = `export const PAGE_CONTENT_DEFAULT: PageContent = ${JSON.stringify({ schema: 1, content }, null, 2)};\n`;
  writeFileSync(OUT, header + body, 'utf-8');
  console.log(`pull-page-content: snapshot copt din Firestore ✓ (${total} texte)`);
}

// Best-effort: ORICE eșec lasă fișierul neschimbat și iese 0. Fără `process.exit()` — pe Windows, ieșirea
// forțată imediat după un `fetch` lovește o așerțiune libuv (UV_HANDLE_CLOSING) și ar rupe lanțul din `deploy`.
try {
  await main();
} catch (e) {
  console.log('pull-page-content: eroare la fetch/parse — snapshot neschimbat. ' + String(e).slice(0, 120));
}
