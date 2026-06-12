# CLAUDE.md — DataRead

## Ce este DataRead

Platformă SaaS B2B **multi-tenant** — un „business operating system" pentru firme mici și mijlocii
din România. NU e agenție de marketing și NU e un tool singular: e o platformă extensibilă în care
se adaugă produse software în timp. Verticala 1 (monetizare MVP): **Marketing AI**. Verticala 2:
**Lansare Soft** (CRM, facturi, automatizări). Operatori: Andrei + Ionuţ.

**Limba de lucru a proiectului (conversație, documente, UI primar): ROMÂNA.**

## Principiile platformei (permanente — nu se încalcă fără decizia explicită a lui Andrei)

1. **Backend central (control center):** absolut tot trece prin el — Firebase Auth/Firestore/Storage,
   Cloud Functions (logica AI + orchestrarea API-urilor externe), Stripe billing, entitlements/
   permisiuni, panoul admin intern. Frontend-urile (site, dashboard client, admin) sunt doar fețe.
2. **Modularitate cu feature flags pe abonamente:** modulele (verticale) sunt independente;
   `src/config/packages.ts` definește per pachet `modules: ModuleId[]`; un modul nou = intrare în
   registru + colecțiile + functions-urile lui — fără refactor al nucleului.
3. **Izolare multi-tenant:** datele unui client stau DOAR sub `clients/{uid}/**`
   (+ `customers/{uid}/**` pentru Stripe); rules = owner-only; adminul intră exclusiv prin claim-ul
   `admin`; zero acces cross-tenant din client.
4. **Integrările externe sunt opționale, nu dependențe critice:** platforma buildează, rulează și
   se deployează complet fără Stripe/Meta/AI configurate (CTA „Contactează-ne", status `none`).
5. **AI logic rulează DOAR în backend** (Cloud Functions; secrete exclusiv în Secret Manager;
   clientul nu atinge niciodată chei sau modele).
6. **Feature-urile vin de la Andrei/Ionuţ** — nu se inventează funcționalități.

## Fapte stabile (infra)

- Proiect Firebase: **`dataread-e1bd6`** (număr 1035643370280); regiunea pentru TOT
  (functions, extensii, Firestore): **europe-central2**.
- URL live: https://dataread-e1bd6.web.app (domeniul dataread.ro — de cumpărat, ne-blocant).
- GitHub: https://github.com/AndreiBesliu/DataRead (branch `main`).
- Cale locală: `C:\Users\besli\Desktop\MyWork\Apps\DataRead`. Cont CLI: besliandrei@gmail.com.
- Stripe: test mode; extensia `invertase/firestore-stripe-payments` (setup: STRIPE_SETUP.md).
- Documente: `PROJECT_KICKOFF.md` (contractul de scope v1),
  `docs/SPEC-arhitectura-Ionut-2026-06-10.md` (viziunea), `docs/PACHETE-SI-PRETURI.md` (oferta).

## Reguli de lucru (hard)

- **Sync workflow:** după FIECARE task încheiat: `npm test` verde → build → deploy → intrare în
  DEVLOG → commit → push. Fără să ceri confirmare.
- **DEVLOG.md** (append-only): Task Started / Task Completed în Session Log, cu atribuirea
  modelului AI. Regulile NU se îngroapă în DEVLOG — stau aici.
- **i18n:** TOT textul user-facing trece prin `t()`. ro = limba primară (sursa); en în paritate de
  tipuri (`en: typeof ro` în `src/i18n/locales/en.ts`). Niciun string hardcodat în componente.
- **Persistență:** orice dată persistată (localStorage, Firestore) poartă `schema: N` și se încarcă
  printr-UN SINGUR normaliser (`coerceTo*`) — pe TOATE căile de încărcare, inclusiv drafturi.
- **Prefix localStorage:** `dataread` — „Reset app data" din ErrorBoundary șterge după acest prefix.
- **Secrete:** NICIODATĂ în chat/repo. Config client → `.env.local` (negit-uit); secrete server
  (`sk_…`, `whsec_…`, `ANTHROPIC_API_KEY`) → Secret Manager / config extensie, puse de Andrei.
  Codul referă doar numele.
- **Pachete:** sursa unică `src/config/packages.ts` (prețuri, priceIds, module, chei i18n).
  Prețuri provizorii 149/399/999 € până confirmă Andrei + Ionuţ cifrele finale.
- **Multi-file features:** încep în plan mode; alegerile vin înapoi ca meniuri scurte de opțiuni.
- **Dependențe:** fără bump-uri majore (React 18, i18next 23, Vite 6 — setul dovedit pe CNCVS).
- Înainte de commit: `npm run typecheck` + `npm test` verzi.

## Comenzi

- `npm run dev` — dev server (port 5173)
- `npm run build` — typecheck + bundle · `npm run prerender` — HTML static pt. rutele publice ·
  `npm run build:site` — ambele
- `npm test` — suites headless (`scripts/test-*.ts`) · `npm run test:boot` — boot-smoke Playwright
  vs profile otrăvite
- `npm run deploy` — build:site + `firebase deploy --only hosting,firestore:rules` ·
  `npm run deploy:functions`
- `npm run prices:check` — verifică prețurile Stripe sincronizate în Firestore

## Arhitectură (hartă scurtă)

- **Site-ul public NU are login (decizie Andrei, 11.06.2026):** intrarea clienților e formularul
  public `/start` (fără cont) → colecția `leads` (create anonim, validat strict; citit doar de
  admini). Doar `/admin` (backend-ul) are autentificare. Zona `/app` (cont client + checkout
  Stripe) rămâne în cod, DORMANTĂ și nelegată din site, până revine self-serve-ul.
- **Acces backend prin cereri aprobate:** o logare pe `/admin` fără claim înregistrează automat
  `adminRequests/{uid}` (pending); un admin existent aprobă din `/admin` (creează `admins/{uid}` →
  trigger → claim). Bootstrap: UID-ul lui Andrei (`IMBKFBkONkOB7VVZCmqgS90JdBi2`, constantă în
  functions) e auto-aprobat la prima cerere, DOAR cât timp nu există niciun admin.
- **Design:** tema bannerului oficial (navy #0a1228, roșu #e02639, albastru electric #2e7fff,
  diagonale + dot grid) e scoped pe clasa `.theme-banner` = DOAR site-ul public. Backend-ul
  (/app, /admin) rămâne pe tema deschisă default — design de decis mai târziu.
- Un singur SPA Vite + React + TS + Zustand: rute publice prerenderizate (`/`, `/pachete`,
  `/start`, `/contact`, `/legal/*`; en sub `/en/*`) + `/app` (dormant, noindex) + `/admin`.
- Limba pe rutele publice derivă STRICT din path (`src/i18n/routing.ts`) — nu din localStorage
  (regulă pentru prerender).
- Entitlements: extensia Stripe scrie `customers/{uid}/subscriptions` → functions
  `onSubscriptionWrite` → custom claim `ent` + mirror `clients/{uid}.entitlement`. FĂRĂ trial.
  Statusuri: `none | active | expired`.
- `functions/index.js`: secțiuni separate — admin (claims + bootstrap) / entitlement / (viitor) AI.
  Runtime **Node 22** gen-2; trigger-ele primesc EXPLICIT `{ region: 'europe-central2' }`.
- **Verticala 1 Marketing AI — IMPLEMENTATĂ, în așteptarea cheii:** callable-ul
  `aiGenerateCampaign` (functions/index.js, secțiunea [3]) e complet: admin-only, quota lunară în
  `aiUsage/{uid}` (200/lună), citește lead-ul + cererea server-side, model `claude-opus-4-8` cu
  adaptive thinking + ieșire structurată (`output_config.format`, schema CAMPAIGN_SCHEMA), scrie
  livrabilele pe `leads/{id}/requests/{reqId}` (source: 'ai', notele manuale rămân). Butonul
  „Generează cu AI" din /admin e live și arată „neactivat" cât timp callable-ul nu e deployat.
  **ACTIVARE (3 pași, după rotirea cheii):** 1) Andrei: `firebase functions:secrets:set
  ANTHROPIC_API_KEY` 2) în functions/index.js: `AI_ENABLED = true` 3) `npm run deploy:functions`.
  Cu AI_ENABLED=false callable-ul nu se exportă, deci deploy-urile nu cer secretul.

## Capcane cunoscute

- `base: '/'` în vite.config.ts — NU `'./'` (rupe asseturile pe rutele prerenderizate imbricate).
- Tripleta de regiuni (extensie = `VITE_FIREBASE_FUNCTIONS_REGION` = functions) trebuie să
  coincidă, altfel callables eșuează cu „internal" opac.
- Produsele Stripe create ÎNAINTE de webhook nu se sincronizează în Firestore — re-salvează-le.
- Paginile publice se randează determinist (fără `Date.now()`/random în render) — `createRoot`
  înlocuiește HTML-ul prerenderizat și trebuie să fie identic.
- Node local e 25, dar functions + CI rulează Node 20 (pinned prin `engines` și workflow).
