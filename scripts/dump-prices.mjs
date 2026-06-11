/**
 * Verificatorul de sincronizare a prețurilor Stripe — „chiar s-au sincronizat în Firestore?"
 *
 *   npm run prices:check
 *
 * Extensia „Run Payments with Stripe" oglindește produsele/prețurile active în Firestore
 * (DOAR prin webhook-uri de DUPĂ instalare — nu face backfill). Scriptul citește collectionGroup-ul
 * public `prices` și raportează, pentru fiecare price ID configurat în aplicație, dacă există
 * un doc sincronizat. Nu cere autentificare.
 *
 * Config-ul (cheile web Firebase — nu sunt secrete — și VITE_STRIPE_PRICE_*) se citește din
 * .env.local.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collectionGroup, getDocs } from 'firebase/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readEnv() {
  try {
    const txt = readFileSync(join(root, '.env.local'), 'utf8');
    const out = {};
    for (const line of txt.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}
const env = readEnv();

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (env.VITE_FIREBASE_PROJECT_ID ? `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com` : undefined),
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Lipsește config-ul Firebase — setează VITE_FIREBASE_* în .env.local.');
  process.exit(1);
}

// Cele 3 price ID-uri pe care le așteaptă aplicația (din .env.local).
const expected = {
  START: env.VITE_STRIPE_PRICE_START || '',
  GROWTH: env.VITE_STRIPE_PRICE_GROWTH || '',
  PREMIUM: env.VITE_STRIPE_PRICE_PREMIUM || '',
};

const db = getFirestore(initializeApp(firebaseConfig));

try {
  const snap = await getDocs(collectionGroup(db, 'prices'));
  const live = new Map();
  snap.forEach((d) => live.set(d.id, d.data()));

  console.log(`\nProiect: ${firebaseConfig.projectId}`);
  console.log(`Documente de preț sincronizate în Firestore: ${snap.size}\n`);
  snap.forEach((d) => {
    const x = d.data();
    const interval = x.interval ?? x.recurring?.interval ?? '(one-time)';
    const amt = typeof x.unit_amount === 'number' ? (x.unit_amount / 100).toFixed(2) : '?';
    console.log(`  ${d.id}\n    product=${d.ref.parent.parent?.id}  active=${x.active}  interval=${interval}  amount=${amt} ${x.currency}`);
  });

  console.log(`\nPrice ID-urile configurate în aplicație:`);
  let missing = 0;
  for (const [name, id] of Object.entries(expected)) {
    if (!id) {
      missing++;
      console.log(`  ${name.padEnd(8)} (gol)  →  ❌ nesetat în .env.local`);
      continue;
    }
    const docData = live.get(id);
    const ok = docData && docData.active !== false;
    if (!ok) missing++;
    const detail = docData ? (docData.active === false ? 'prezent dar INACTIV' : 'OK (sincronizat + activ)') : 'LIPSEȘTE din Firestore';
    console.log(`  ${name.padEnd(8)} ${id}  →  ${ok ? '✅' : '❌'} ${detail}`);
  }
  console.log(
    missing === 0
      ? `\nToate cele 3 prețuri sunt sincronizate. 🎉`
      : `\n${missing}/3 prețuri neutilizabile. Creează-le/activează-le în Stripe, asigură-te că webhook-ul\n` +
        `extensiei e configurat (re-salvează prețul în dashboard ca să resincronizezi), apoi pune\n` +
        `ID-urile reale în .env.local (VITE_STRIPE_PRICE_*). Re-rulează: npm run prices:check`
  );
  if (missing > 0) process.exitCode = 1;
} catch (e) {
  console.error('Citirea a eșuat:', e.message);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
