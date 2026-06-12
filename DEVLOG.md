# DEVLOG — DataRead

## 🏗 Project Infrastructure (Permanent)

- **Tip:** platformă SaaS B2B multi-tenant („business operating system" pentru IMM-uri din RO);
  verticala 1 = Marketing AI (monetizare MVP), verticala 2 = Lansare Soft (CRM/facturi/automatizări).
- **Stack:** React 18 + TypeScript + Vite 6 + Zustand 5 + Firebase (Auth/Firestore/Functions/Hosting),
  Stripe prin extensia `invertase/firestore-stripe-payments`, i18n ro-primar + en (paritate de tipuri).
- **Infra:** Firebase `dataread-e1bd6` (europe-central2) · live https://dataread-e1bd6.web.app ·
  GitHub https://github.com/AndreiBesliu/DataRead · local `C:\Users\besli\Desktop\MyWork\Apps\DataRead`.
- **Regulile de lucru și arhitectura:** în CLAUDE.md (auto-încărcat; NU aici).

## 📜 Workflow Rules (Permanent)

Vezi CLAUDE.md — sync workflow (test→build→deploy→DEVLOG→commit→push), formatul Session Log
(Task Started/Completed cu atribuirea modelului AI), i18n prin t(), scheme versionate cu un singur
normaliser, secretele niciodată în chat/repo.

## 🚀 Active Roadmap & Backlog

### Sesiunea 1 — scaffold + felia verticală (în lucru)
- [x] Faza 0: repo + documente (CLAUDE.md, DEVLOG, kickoff actualizat)
- [x] Faza 1: schelet buildabil + harness portat (teste, CI, boot-smoke, error reporting, i18n)
- [x] Faza 2: site public prerenderizat (landing, pachete, contact, legal-draft)
- [x] Faza 3: auth + cont client (dashboard cu secțiunile pregătite)
- [x] Faza 4: formular onboarding cu draft autosave
- [x] Faza 5: fundația admin (/admin, claim, listă clienți + onboarding-uri)
- [x] Faza 6: Stripe (billing, entitlements fără trial, functions) — codul complet; pașii de
      consolă (Blaze, extensie, webhook, produse) = sarcinile lui Andrei din STRIPE_SETUP.md
- [x] Faza 7: verificare end-to-end + sync final (E2E-ul de plată rămâne după pașii Stripe ai lui Andrei)

### Sesiunea 1b — restructurare fără login + design banner (în lucru)
- [x] Formular public `/start` (fără cont) → colecția `leads`; CTA-urile pachetelor → /start?pkg=
- [x] Login scos de pe site; `/app` dormant (revine cu self-serve-ul Stripe)
- [x] Flux de acces backend: `/admin` → cerere `adminRequests/{uid}` → aprobare de admin existent;
      bootstrap auto-aprobat pentru UID-ul lui Andrei (prima cerere, zero admini)
- [x] Design-ul bannerului preluat pe site-ul public (temă `.theme-banner`: navy/roșu/albastru,
      hero 3 rânduri, trust strip, 4 servicii cu iconuri, diagonale + dot grid); backend netematizat
- [x] Firestore creat la europe-central2 + rules deployate
- [x] Functions deployate la europe-central2 (onAdminWrite, onAdminRequestCreated/bootstrap,
      onSubscriptionWrite) — Node 22 gen-2; au mers la al 3-lea retry (propagarea Eventarc la
      primul deploy gen-2 e normală)

### Felia 2 — Verticala 1 Marketing AI (sesiunea următoare)
- [ ] Cerere de marketing (ofertă + buget + obiectiv, din dashboard client sau /admin) →
      callable `aiGenerateCampaign` → texte reclame + creatives (copy + video script) + structură
      campanie Meta, salvate sub client, vizibile în ambele dashboards; quota `aiUsage`;
      secretul `ANTHROPIC_API_KEY` setat de Andrei (cheia veche din chat se rotește!).

### Backlog (gardul de scope — se parchează fără discuție)
- Meta Ads API / Google Ads API (auto-publishing — Faza 3 din spec), tracking pixel, optimizare automată
- Modul Lansare Soft: CRM, facturi, risk scoring, AI collections (Faza 4 din spec)
- Email tranzacțional (Resend), texte legale reale, App Check, slug-uri en traduse
- Domeniul dataread.ro + originea absolută în sitemap
- Cercetare e-Factura (ANAF) pentru B2B România — înainte de plăți live
- Cifrele finale de listă (provizoriu 149/399/999 €)

## ✅ Completed Features

- **2026-06-11 — Kickoff complet:** spec-ul lui Ionuţ + pachetele documentate în `docs/`,
  PROJECT_KICKOFF.md (contract de scope v1), decizii: stack Firebase, felia v1 = site + formular +
  Stripe fix-price fără trial, brand = DataRead, viziunea de platformă multi-tenant cu backend
  central + feature flags pe abonamente.

## 📋 Session Log

### 2026-06-11 — Sesiunea 1 (scaffold + felia verticală)

**20:13 - Task Started**
> Model: Claude Fable 5
> Prompt: „vreau să încep un proiect nou în DataRead" + spec Ionuţ + pachete + viziunea de platformă
> Plan: planul aprobat în plan mode (Faza 0 → Faza 7): scaffold portat din CNCVS, site public
> prerenderizat, auth + onboarding, fundația admin, Stripe test mode. Infra existentă:
> `dataread-e1bd6` + repo GitHub create de Andrei.

**20:14 - Task Completed — Faza 0**
> Model: Claude Fable 5
> Changes: git init (branch `main`) + remote origin; .gitignore; CLAUDE.md (reguli + principiile
> platformei + fapte infra); DEVLOG.md (acest fișier); PROJECT_KICKOFF.md actualizat cu poziționarea
> de platformă multi-tenant.

**20:25 - Task Completed — Faza 1 (schelet + harness)**
> Model: Claude Fable 5
> Changes: Vite+React+TS+Zustand schelet (base '/', build identity __APP_VERSION__/__BUILD_HASH__);
> i18n ro-primar cu paritate `en: typeof ro` + rutare de limbă strict din path (routing.ts pur);
> ErrorBoundary cu „Resetează datele aplicației" (prefix dataread) + chunk-reload guard;
> errorReporting consent-gated → Firestore errorReports (rules create-only validate);
> analytics GDPR opt-in cu buffer; firebase.ts (region europe-central2, App Check inert);
> harness: run-tests.mjs (esbuild headless) + test-i18n-routing (20 checks), boot-smoke.mjs
> (4 profile: curat, JSON stricat, /en, 404), CI GitHub Actions; firebase.json (trailingSlash
> false, cache headers), firestore.rules (errorReports), .env.example/.ci/.local.
> Verificat: typecheck+build+test+test:boot toate verzi. DEPLOYED: https://dataread-e1bd6.web.app
> Blocat pe Andrei: API-ul Firestore (un click pe link) — baza se creează apoi prin CLI la
> europe-central2; rules se deployează atunci.

**20:42 - Task Completed — Faza 2 (site public + prerender)**
> Model: Claude Fable 5
> Changes: packages.ts (sursa unică: 3 pachete 149/399/999 € + 5 upsell-uri + modules feature-flags);
> locales complete ro/en (landing, pachete, contact, legal, cookies, SEO); SiteLayout (nav, comutator
> limbă path-based, footer, banner consimțământ GDPR); Seo.tsx (title/description/canonical/hreflang/og
> fără helmet); pagini: Landing, Packages (CTA „Contactează-ne" pre-Stripe), Contact, Legal (DRAFT
> banner + noindex); prerender.mjs (10 pagini statice ro+en + sitemap.xml cu hreflang; shell-ul curat
> → app.html = destinația rewrite-ului SPA); robots.txt (Disallow /app /admin); test-packages.ts
> (70+ checks incl. paritatea cheilor i18n); boot-smoke extins (5 profile, incl. „/en/pachete în
> engleză cu stored ro").
> Verificat: build+test (2 suites)+prerender+test:boot toate verzi; HTML-ul static conține prețuri +
> hreflang fără JS. DEPLOYED: https://dataread-e1bd6.web.app

**21:02 - Task Completed — Fazele 3+4 (auth + cont client + onboarding)**
> Model: Claude Fable 5
> Changes: authStore portat din CNCVS fără Electron (erori = chei i18n; cont nou Google fără
> consimțământ → rollback); useAuthInit (sincronizare + ensureClientDoc idempotent cu ștampila ToS);
> AuthPanel (taburi login/cont nou, checkbox termeni obligatoriu, ?pkg= persistat prin sessionStorage);
> AppHome (carduri Onboarding/Abonament + secțiunile Verticalei 1 „în curând": cereri/rezultate/AI
> insights); ClientProfile schema 1 + coerceToClientProfile; OnboardingData schema 1 + coerce +
> validateOnboarding pură (chei i18n) + normaliseUrl; OnboardingForm (draft autosave
> dataread.onboardingDraft.v1 citit NUMAI prin coerce, submit → clients/{uid}/onboarding/main +
> onboardingStatus mirror); firestore.rules: izolare multi-tenant clients/{uid}/** owner-only,
> entitlement protejat de affectedKeys guard, onboarding cu whitelist + plafoane; 2 suite noi
> (normalisers 18 checks, onboarding-validate 21 checks); boot-smoke profil nou „/app cu draft +
> ent corupte → auth panel".
> Verificat: build + 4 suites + prerender + test:boot (6 profile) toate verzi.
> DEPLOYED: https://dataread-e1bd6.web.app
> Blocat pe Andrei (testarea manuală a fluxului): providerii Auth (Email/Password + Google) de
> activat în consolă + API-ul Firestore (rules încă nedeployate — baza nu există).

**21:25 - Task Completed — Fazele 5+6 (fundația admin + Stripe)**
> Model: Claude Fable 5
> Changes: functions/index.js (backend central pe secțiuni: [1] onAdminWrite admins/{uid}→claim
> `admin`; [2] onSubscriptionWrite→claim `ent`+mirror clients/{uid}.entitlement, AMBELE cu
> region europe-central2 explicit — fix-ul bug-ului CNCVS; [3] secțiunea AI rezervată cu șablonul
> defineSecret pentru felia 2); firestore.rules: isAdmin(), admins/{uid} write-never, adminii
> citesc clients/** + blocurile extensiei Stripe (customers/checkout_sessions/subscriptions/
> payments, products public, collectionGroup prices); AdminHome (/admin: gate pe claim cu un
> token-refresh automat, ecran „denied" care afișează UID-ul pt. bootstrap, tabel clienți live +
> detaliu onboarding); billing.ts portat fără trial (fetchLivePrices, watchSubscription cu rank
> start/growth/premium, createCheckoutSession→/app?checkout=success, createPortalLink);
> entitlementLogic (none|active|expired, PERIOD_END_GRACE_MS, preț nemapat→start conservator,
> module ca feature flags) + entitlementStore (cache offline dataread_ent_, ensureClaimToken,
> recompute la focus/60s); AppHome: card abonament complet („Se confirmă plata…", reînnoire/
> încheiere, portal, checkout, resync); STRIPE_SETUP.md rescris pt. DataRead (ordinea corectă:
> extensie→webhook→produse); dump-prices.mjs (prices:check); test-entitlement.ts (10 checks).
> Verificat: build + 5 suites + prerender + test:boot toate verzi.
> DEPLOYED (hosting): https://dataread-e1bd6.web.app
> Nedeployate încă (blocate pe Andrei): firestore.rules + functions — cer API-ul Firestore
> activat, respectiv planul Blaze.

**21:32 - Task Completed — Faza 7 (verificare finală) — SESIUNEA 1 ÎNCHEIATĂ**
> Model: Claude Fable 5
> Verificat pe LIVE (https://dataread-e1bd6.web.app): /pachete servește HTML prerenderizat
> românesc cu prețurile 149/999 + hreflang (fără JS); /en/pachete în engleză; robots.txt cu
> Disallow /app; sitemap.xml cu 6 URL-uri; /app servit prin shell-ul SPA (app.html). Local:
> build + 5 suites (89 checks) + prerender (10 pagini) + boot-smoke (6 profile) — toate verzi.
> Sesiunea 1 = scaffold complet + felia verticală construită cap-coadă. Pașii rămași sunt în
> mâna lui Andrei (vezi STRIPE_SETUP.md + lista de mai jos), apoi E2E-ul de plată cu cardul de
> test închide felia.

### 2026-06-11 — Sesiunea 1b (redirecționare: fără login + design banner)

**22:05 - Task Started**
> Model: Claude Fable 5
> Prompt: Andrei — (1) site-ul NU are login, doar backend-ul; logarea pe /admin declanșează o
> cerere înregistrată în backend, care trebuie aprobată; (2) preia design-ul bannerului oficial
> pentru site-ul live (backend-ul: decizie ulterioară); Stripe + cheia AI rămân pe placeholders.
> Context primit: API Firestore + Blaze + provideri Auth activate; UID-ul lui Andrei pentru admin.

**22:30 - Task Completed — restructurare + design (cod)**
> Model: Claude Fable 5
> Changes: formular public /start (refolosește OnboardingFields extras + validarea pură; draft
> dataread.leadDraft.v1 prin coerce) → colecția `leads` (rules: create anonim validat strict,
> read/update doar admin); login scos din SiteLayout; CTA pachete → /start?pkg=; /app dormant.
> Flux acces backend: RequestAccess auto-înregistrează adminRequests/{uid} (rules: create o
> singură dată pe propriul uid); /admin pentru admini = Cereri de acces (aprobă→admins/{uid},
> respinge) + Lead-uri (tabel live + detaliu) + Clienți; functions: onAdminRequestCreated cu
> BOOTSTRAP_ADMIN_UID (auto-aprobare doar la zero admini) + mirror status approved/revoked în
> recomputeAdminClaim; runtime Node 22 (Node 20 deprecat din 04.2026).
> Design banner: temă .theme-banner scoped pe site-ul public (navy #0a1228, roșu #e02639,
> albastru #2e7fff, glow, diagonale + dot grid CSS pur — prerender-safe); hero pe 3 rânduri din
> banner + tagline „Date. Strategie. Creștere."; trust strip; 4 servicii cu iconuri SVG roșii;
> copy actualizat ro+en. Backend rămâne pe tema deschisă (decizie ulterioară).
> Verificat: build + 5 suites + prerender (12 pagini) + boot-smoke (8 profile, incl. /start cu
> draft corupt) verzi; screenshots Playwright pe bundle-ul de producție — design fidel bannerului.
> Infra: Firestore creat la europe-central2 ✓, rules deployate ✓, hosting live ✓.

**22:48 - Task Completed — deploy functions + verificare live — SESIUNEA 1b ÎNCHEIATĂ**
> Model: Claude Fable 5
> Changes: functions deployate la europe-central2 (Node 22 gen-2): onAdminWrite,
> onAdminRequestCreated (bootstrap-ul lui Andrei), onSubscriptionWrite. Verificat live:
> /start servește formularul prerenderizat, landing-ul are hero-ul din banner, sitemap 8 URL-uri.
> Capturi de design trimise lui Andrei. FLUXUL COMPLET ACUM LIVE: vizitator → /start → lead în
> Firestore → vizibil în /admin; prima logare a lui Andrei pe /admin se auto-aprobă (bootstrap).

**23:05 - Task Completed — fix bootstrap admin (race la primul deploy)**
> Model: Claude Fable 5
> Bug raportat de Andrei: „Reverifică accesul" nu-i dădea acces. Cauza (confirmată în logurile
> functions): cererea lui adminRequests/{uid} fusese creată ÎNAINTE ca functions să devină active
> (fereastra dintre deploy-ul hosting și cel de functions, întârziat de propagarea Eventarc) —
> onDocumentCreated nu rulează retroactiv. Fix: (1) cererea veche ștearsă cu firestore:delete →
> recrearea declanșează bootstrap-ul; (2) RequestAccess e acum self-healing: „Reverifică" re-asigură
> și documentul de cerere (recreează dacă lipsește), iar după înregistrare rulează automat două
> reverificări (la 4s și 10s) — bootstrap-ul nu mai cere nicio acțiune manuală. Deploy hosting ✓.

**23:20 - CONFIRMAT de Andrei: a intrat în backend** ✓
> Bootstrap-ul consumat — Andrei e primul admin (claim activ). Fluxul de acces e de-acum:
> cerere pe /admin → aprobare/respingere din panou, de către un admin existent.
> SESIUNEA 1b închisă integral. Următoarea sesiune: felia 2 — Verticala 1 Marketing AI.
