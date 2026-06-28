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

**23:45 - Task Completed — pipeline de lead-uri în /admin** („continuă cu ce poți dezvolta acum")
> Model: Claude Fable 5
> Changes: status de pipeline pe fiecare lead (Nou → Contactat → Câștigat/Pierdut) cu select
> inline + statusUpdatedAt; filtre cu contoare (Toate/pe status) + badge „X noi" + evidențierea
> rândurilor noi; note interne per lead (textarea în detaliu, plafonate 4000, notesUpdatedAt);
> export CSV al listei filtrate (BOM + separator ';' pentru Excel RO, headerele prin t());
> types/lead.ts (coerceLeadStatus/coerceLeadNotes) + 5 checks noi în test-normalisers.
> Rules: deja acoperit (update pe leads = doar admin). Verificat: build + 5 suites + prerender +
> boot-smoke verzi. DEPLOYED: https://dataread-e1bd6.web.app/admin
> Verificarea vizuală a panoului rămâne la Andrei (singura sesiune cu claim de admin).

**23:58 - Task Completed — identitate la share: favicon + Open Graph**
> Model: Claude Fable 5
> Changes: favicon.svg (monograma DR — roșu pe navy cu inel albastru); og.png 1200×630 generat
> pe tema bannerului (wordmark + „Date. Strategie. Creștere." + headline + DATAREAD.RO);
> Seo.tsx emite og:image/og:site_name/twitter:card pe toate paginile (intră și în HTML-ul
> prerenderizat); theme-color #0a1228. Linkurile share-uite pe WhatsApp/Facebook/LinkedIn arată
> acum cardul de brand. Verificat live: og.png 200, og:image prezent în HTML-ul static.
> DEPLOYED: https://dataread-e1bd6.web.app

**00:20 - Task Completed — Verticala 1 semi-manual: Cereri de marketing în /admin**
> Model: Claude Fable 5
> Changes: leads/{id}/requests/{reqId} schema 1 (titlu, ofertă ≤500, buget liber ≤80, obiectiv
> din enum, status open/done, source manual|ai) cu livrabilele din spec-ul lui Ionuţ: texte
> reclame / scripturi video-creatives / structură campanie Meta / note (≤8000 fiecare);
> types/request.ts cu coerceToMarketingRequest (5 checks noi); LeadRequests.tsx în detaliul
> lead-ului: creare cerere, editor livrabile, status pill, ștergere cu confirmare, buton
> „Generează cu AI — în curând" (dezactivat; aiGenerateCampaign din felia 2 va completa
> ACELEAȘI câmpuri, fără refactor); rules: subcolecția requests = admin-only.
> Verificat: build + 5 suites (99 checks) + prerender + boot-smoke verzi.
> DEPLOYED (hosting + rules). Fluxul Fazei 1 e complet: lead → contactare (status+note) →
> cerere de marketing → livrabile → Livrat.

**00:55 - Task Completed — Felia 2: integrarea AI completă, în spatele comutatorului**
> Model: Claude Fable 5
> Răspuns la întrebarea lui Andrei („de ce nu putem folosi cheia dată în chat?"): explicat că e
> doar igienă (cheia din chat = expusă permanent, rotirea = 1 min), iar la observația lui corectă
> că „dezvoltarea nu e specifică ANTHROPIC_API_KEY" — construită TOATĂ integrarea acum:
> Changes: functions/index.js secțiunea [3] completă: callable `aiGenerateCampaign` (admin-only,
> validare leadId/requestId, quota lunară 200/op în aiUsage/{uid} prin tranzacție, citește lead +
> cerere SERVER-side, model claude-opus-4-8 cu adaptive thinking + system prompt de copywriter RO
> + ieșire structurată json_schema {adTexts, videoScripts, campaignStructure}, handling refusal/
> parse-fail, scrie livrabilele cu merge — notele manuale rămân, source:'ai', aiGeneratedAt/By;
> timeoutSeconds 300). TOTUL în spatele `AI_ENABLED=false` — neexportat, deci deploy-urile nu cer
> secretul. @anthropic-ai/sdk ^0.104.1 instalat în functions. Client: butonul „Generează cu AI"
> LIVE în LeadRequests (confirm la suprascriere, busy state, rezultatul intră direct în editor,
> mapare erori: not-found/internal→„neactivat încă", resource-exhausted→quota, altfel generic).
> ACTIVARE = 3 pași în CLAUDE.md: secrets:set → AI_ENABLED=true → deploy:functions.
> Verificat: build + 5 suites + prerender + boot-smoke verzi; functions/index.js se încarcă OK cu
> comutatorul stins. DEPLOYED (hosting). Functions NU redeployate (suprafața exportată neschimbată).

**01:15 - Task Completed — VERTICALA 1 MARKETING AI ACTIVATA** (decizia lui Andrei: mergem cu cheia data)
> Model: Claude Fable 5
> Changes: ANTHROPIC_API_KEY setat in Secret Manager (v1, prin fisier temporar sters imediat);
> smoke-test cheie+model reusit (claude-opus-4-8 a raspuns, 32 in / 11 out tokens);
> AI_ENABLED=true; deploy functions: aiGenerateCampaign CREAT la europe-central2 cu accesul la
> secret acordat automat service account-ului. Fluxul complet e LIVE: /admin -> lead -> cerere ->
> Generaza cu AI -> livrabile in editor. Rotirea cheii ramane in backlog (recomandata inainte de
> volum; pasii in CLAUDE.md). Verificarea finala (apasarea butonului) = Andrei, singurul admin.

**09:55 - Task Completed — control center /admin (statistici, cautare, stergere, copy livrabile)**
> Model: Claude Fable 5
> Context: primul lead de test inregistrat de Andrei prin formularul public (pipeline confirmat
> vizual); directiva: "haide sa continuam sa dezvoltam".
> Changes: rand de statistici operationale sub header (total lead-uri, noi/contactate/castigate,
> rata de conversie castigate/decise, generarile AI ale operatorului pe luna curenta — citite din
> aiUsage cu regula noua read-only pentru admini); cautare client-side in lead-uri (firma/contact/
> email/telefon, filtrele de status se aplica pe setul cautat); stergere lead cu confirmare care
> curata intai subcolectia requests (Firestore nu face cascade); butoane Copiaza pe fiecare
> livrabil + "Copiaza tot" formatat pentru livrarea catre client (titlu+oferta+sectiuni, fara
> notele interne), cu feedback Copiat 2s.
> Verificat: build + 5 suites + prerender + boot-smoke verzi. DEPLOYED (hosting + rules).
> Verificarea vizuala in /admin = Andrei (refresh).

**10:10 - MILESTONE CONFIRMAT de Andrei (screenshot): VERTICALA 1 FUNCTIONEAZA END-TO-END**
> Fluxul complet in productie: formular public -> lead (Firma test, HoReCa) -> cerere de
> marketing -> Genereaza cu AI -> texte reclame + scripturi video (cu timing pe cadre) +
> structura campanie Meta (a interpretat corect bugetul mic si a recomandat Instant Forms),
> totul in romana, adaptat firmei -> Salvat + Copiaza tot. Control center-ul (stats, cautare,
> stergere, copy) vizibil si functional in screenshot. Primul ciclu complet al platformei.

**10:40 - Task Completed — Content Planner: cereri de tip "plan de continut 30 zile" cu AI**
> Model: Claude Fable 5
> Motivatie: pachetul Start (tierul de intrare) vinde exact continut lunar (6-10 postari, 12 idei,
> plan, calendar) — pana acum AI-ul genera doar partea de reclame (Growth+). Spec Ionut 5.6.
> Changes: MarketingRequest.kind = campaign|content (coerce: cererile vechi raman campaign);
> deliverables extinse cu calendar/posts/ideas; deliverableFieldsFor(kind) = sursa unica a
> campurilor pe tip (editor, copy-all, AI-merge, save generic); selector de tip in formularul de
> creare + chip de tip pe rand (mov pentru continut); functions: CONTENT_SCHEMA + buildContentPrompt
> (calendar 30 zile cu 12-15 zile active, 8 postari complete cu hashtag-uri si sugestii de vizual,
> 12 idei) — acelasi callable aiGenerateCampaign alege schema+promptul dupa kind, KIND_FIELDS
> mapeaza campurile scrise; leadContextBlock extras comun. 6 checks noi in normalisers (kind +
> campuri content + paritatea cheilor de label pe ambele tipuri).
> Verificat: build + 5 suites + prerender + boot-smoke + functions load — toate verzi.
> DEPLOYED: functions (callable actualizat) + hosting. Testarea generarii de continut = Andrei.

**15:50 - Task Completed — istoric versiuni livrabile (snapshot automat + restaurare)**
> Model: Claude Fable 5
> Motivatie: regenerarea AI suprascria ireversibil livrabilele — plasa de siguranta a muncii.
> Changes: subcolectia leads/{id}/requests/{reqId}/versions (rules: admin read/create/delete,
> update interzis — snapshot-uri imutabile); functions: inainte de fiecare suprascriere AI,
> starea curenta cu continut devine versiune (deliverables complete + kind + source + reason
> pre-ai-regenerate + snapshotBy); UI in editorul cererii: "Istoric versiuni" pliabil (incarcare
> lazy, ultimele 20), fiecare versiune cu data + sursa AI/Manual + Copiaza (pachetul formatat al
> versiunii) + Restaureaza — restaurarea salveaza INTAI starea curenta ca versiune (pre-restore),
> apoi inlocuieste campurile tipului curent; notele raman mereu neatinse; deleteLead curata acum
> si subcolectiile versions (Firestore nu face cascade).
> Verificat: build + 5 suites + prerender + boot-smoke + functions load — verzi.
> DEPLOYED: functions + rules + hosting.

**2026-06-13 - Task Completed — Marketing Center (analytics campanii multi-platforma)**
> Model: Claude Fable 5
> Directiva Andrei: sistem in backend pentru monitorizarea campaniilor (ROAS + analytics complex),
> Meta SI alte platforme, intr-un panou dedicat "Marketing Center".
> Arhitectura (acelasi pattern ca AI/Stripe — construim tot, integrarea externa e optionala):
> motor KPI pur src/analytics/kpi.ts (ROAS/CPL/CTR/CPC/CPM/conversie, totaluri denormalizate,
> coerce campanie+metrica, platform-agnostic) + suita test-analytics (24 checks). Model:
> campaigns/{id} top-level (leadId + clientName + totals rollup) + metrics/{YYYY-MM-DD} (upsert pe
> data = idempotent, pregatit pentru conectori API; camp source manual|meta|google|tiktok).
> Panou Marketing Center = tab nou in /admin (Lead-uri | Marketing Center): KPI agregat pe
> campaniile filtrate, filtre platforma/status/cautare, creare campanie cu selector de client,
> drill-down per campanie (KPI cards + sparkline SVG pur + tabel zile cu intrare/editare/stergere
> manuala + CSV + ROAS pe zi), status inline, stergere campanie. Intrarea MANUALA a datelor e
> sursa de azi; conectorii Meta/Google Ads scriu in acelasi model — docs/CONNECTORS-ADS-API.md
> (pasii Andrei: Meta Business verification ~saptamani, tokenuri in Secret Manager).
> Rules: campaigns + metrics admin-only; deleteLead curata si campaniile clientului.
> Verificat: build + 6 suites + prerender + boot-smoke verzi. DEPLOYED: hosting + rules.

**2026-06-13 - Task Completed — AI Optimization Engine (analiza AI per campanie, spec 5.5)**
> Model: Claude Fable 5
> Inchide bucla analytics+AI: AI-ul citeste cifrele reale ale campaniei si recomanda actiuni.
> Changes: callable aiAnalyzeCampaign (admin-only, quota aiUsage partajata, citeste campania +
> ultimele 60 zile de metrici SERVER-side, refuza daca spend=0, model claude-opus-4-8 adaptive +
> INSIGHT_SCHEMA structurat {verdict scale|maintain|pause|test, headline, reasoning, actions},
> prompt cu KPI cumulat + trend zilnic + reguli de bun-simt media-buying) → scrie campaign.aiInsight;
> coerceToInsight + 4 checks in test-analytics; UI in CampaignDetail: buton "Analiza AI" + card cu
> verdict colorat (verde/albastru/rosu/amber), headline, rationament, actiuni, data; insight-ul
> persista pe campanie si reapare via onSnapshot. Mapare erori: failed-precondition->nu sunt date,
> not-found/internal->neactivat.
> Verificat: build + 6 suites + prerender + boot-smoke + functions load verzi.
> DEPLOYED: functions (aiAnalyzeCampaign creat) + hosting.

**2026-06-13 - Task Completed — Raport pe client (agregare + raport lunar AI)**
> Model: Claude Fable 5
> Livrabilul lunar pe care agentia il prezinta clientului — aduna tot modulul de marketing.
> Changes: view toggle "Pe campanie | Pe client" in Marketing Center; gruparea campaniilor pe
> client cu KPI agregat (addTotals -> kpisFromTotals); ClientReportPanel cu lista campaniilor +
> ROAS, buton raport, card cu rezumat/realizari/recomandari + copy; callable aiClientReport
> (admin-only, quota, citeste lead + toate campaniile clientului server-side, REPORT_SCHEMA
> structurat, ton pentru client) scris pe leads/{id}.marketingReport (Admin SDK ocoleste rules);
> coerceToReport + 3 checks. Rapoartele persista pe lead si se incarca la redeschidere.
> Verificat: build + 6 suites + prerender + boot-smoke + functions load verzi.
> DEPLOYED: functions (aiClientReport creat) + hosting.
> NOTA: modulul Soft Marketing din spec e acum COMPLET (5.1-5.6 + Analytics + Optimization +
> Raport); ramane doar Ads Management API (Faza 3, blocat pe verificarea Meta Business).

**2026-06-13 - Task Completed — design digital + configurator de teme pentru admin**
> Model: Claude Fable 5
> Directiva Andrei: design mai digital/tehnologic + configurator de teme pentru admin.
> Changes: src/theme/themes.ts (5 preset-uri ca seturi de variabile CSS — Midnight/Carbon/Matrix/
> Ocean dark "digital" cu grid de puncte pe fundal, + Light; toate folosesc variabilele deja
> consumate de componente, deci reskin instant fara a atinge UI-ul); useAdminTheme (persista in
> localStorage dataread_admin_theme, valideaza); selector de tema in header-ul /admin; wrapper
> themeStyle() peste view-ul de admin; default = Midnight (dark digital). test-themes (9 checks:
> integritate registru, hex valid, fallback). Portalul client /app ramane pe default deocamdata.
> Verificat: build + 7 suites + prerender + boot-smoke verzi. DEPLOYED: hosting.

**2026-06-13 - Task Completed — fix contrast controale pe teme + directie viitoare**
> Model: Claude Fable 5
> Andrei: unele texte nu se vad bine pe unele teme. Cauza: input/select/textarea aveau text
> inchis pe fundal inchis (culoarea nu era legata de tema). Fix global: clasa .admin-scope pe
> wrapperul de admin + reguli CSS (input/select/textarea/option/a -> var(--fg-0)/var(--accent),
> placeholder var(--fg-1)). Verificat vizual (screenshot standalone Midnight+Matrix): text lizibil.
> DEPLOYED: hosting.
> DIRECTIE VIITOARE notata (memorie + backlog): sistem de creare Landing Pages, refolosit pt
> customizarea temelor admin. Landing Pages = pt CLIENTI, continut diferit punctual; tema admin =
> DOAR culori/imagini background/animatii decor/design, FARA alterare layout/structura.

**2026-06-13 - Task Completed — livrabile client-safe în portal (pasul 2, fără note interne)**
> Model: Claude Fable 5
> Clientul își vede livrabilele (texte reclame, scripturi video, structură campanie, calendar/
> postări/idei) în /app, dar notele interne ale agenției NU se scurg niciodată.
> Changes: trigger nou onRequestWrite (mereu activ, NU în blocul AI) pe leads/{id}/requests/{reqId}
> care oglindește DOAR câmpurile din CLIENT_SAFE_DELIVERABLES (adTexts/videoScripts/
> campaignStructure/calendar/posts/ideas — `notes` exclus explicit) în clients/{uid}/deliverables/
> {reqId}, folosind diff-ul before/after pe clientUid (gestionează create/update/delete/relink/
> unlink, șterge oglinda când lipsește conținut sau se schimbă clientul). clientUid denormalizat pe
> cereri: AdminHome.linkClient/unlinkClient parcurge cererile setând/golind clientUid; LeadRequests
> primește clientUid și îl pune pe cererile noi. firestore.rules: clients/{uid}/deliverables read
> owner|admin, write false (doar Admin SDK). AppHome.MarketingPortal: secțiune nouă „Livrabilele
> tale" (onSnapshot pe deliverables, ordonat updatedAt desc, filtrează notes din randare).
> i18n appHome.portalDeliverables (ro/en).
> Verificat: build + 7 suites + prerender (12 pagini) + boot-smoke + functions load verzi.
> DEPLOYED: functions (onRequestWrite creat) + firestore:rules + hosting.
> NOTA: portalul de client are acum cele 3 fețe cerute — performanță + raport + livrabile.

**2026-06-13 - Task Completed — creator de teme admin extins (culori/imagine/animații)**
> Model: Claude Fable 5
> Directiva Andrei: peste configuratorul cu preset-uri, un creator de temă personalizată — DOAR
> design (culori, imagine de fundal, animație de decor), NU layout/structură.
> Changes: themes.ts — CustomTheme (schema 1) + coerceToCustomTheme (normaliser unic: gunoi →
> temă validă, respinge bgImage nesigur pt CSS url(), animație necunoscută → none) + customThemeStyle
> (compune fundalul în straturi: grilă + văl de lizibilitate gradient 0.80→0.52 peste imagine +
> culoare) + themeAnimClass + THEME_COLOR_KEYS/THEME_ANIMATIONS. useAdminTheme rescris: gestionează
> și tema custom (localStorage dataread_admin_theme_custom, încărcat prin coerce) + acceptă id-ul
> 'custom'. ThemeEditor.tsx nou (modal: nume, „pornește de la" preset, 8 color pickers cu hex,
> URL imagine, toggle grilă, select animație, reset, live preview — wrapperul folosește
> customThemeStyle deci se vede instant). AdminHome: opțiune „Personalizată" în picker + buton
> „Editează tema" + strat decorativ fix .admin-fx (z-index 0, sub <main> la z-index 1). styles.css:
> keyframes drift/pulse/sheen (folosesc var(--accent), pointer-events none) + swatch color input +
> guard prefers-reduced-motion. i18n admin.themeEditor (ro/en). test-themes +12 checks (coerce,
> securitate bgImage, customThemeStyle straturi).
> Verificat: build + 7 suites (21 checks teme) + prerender + boot-smoke verzi; randare vizuală
> confirmată (Playwright headless, imagine servită pe http): conținut lizibil deasupra imaginii +
> aurora, panou editor cu contrast bun. DEPLOYED: hosting.
> NOTĂ: aceasta e fundația pentru viitorul sistem Landing Pages (același motor de design, dar pt
> clienți cu conținut variabil).

**2026-06-13 - Task Started — Landing Pages Studio (felia LP v1)**
> Model: Claude Fable 5
> Plan aprobat (C:\Users\besli\.claude\plans\dapper-kindling-crown.md): IDE în /admin (editor cod +
> preview live + agent AI) → pagini servite la /p/{slug} de o Cloud Function = „nexus pentru trafic
> și date" (logging server-side prioritar), formular opțional per LP, design refolosit din CustomTheme.
> 6 faze: P1 date+rules, P2 Studio, P3 AI, P4 servire+SSR, P5 tracking+submissions+dashboard, P6 sync.

**2026-06-13 - Task Completed — LP P1: date + rules + coerce + teste**
> Model: Claude Fable 5
> Changes: src/types/landingPage.ts (LandingPage schema 1, doc ID = slug; coerceToLandingPage unic
> — status corupt → 'draft' = niciodată public din greșeală; html plafonat 200KB; design delegat la
> coerceToCustomTheme; invariant hasForm===form.enabled; sanitizeSlug cu diacritice→ASCII via
> \p{Diacritic}; LpFormConfig/LpFormField; coerceToLpSubmission + sanitizeSubmissionValues pur —
> aruncă chei necunoscute, plafonează, semnalează required). src/analytics/lpStats.ts (PUR ca kpi.ts:
> LpStatsDay rollup zilnic, coerceToLpStatsDay, sumLpStats, lpKpis convRate/ctaRate/engagement/
> avgScroll/avgTime cu numitor 0 → null, topEntries, bucketKey whitelist→'other' anti-bloat).
> firestore.rules: bloc landingPages/{slug} (read public DOAR dacă published; create/update validat
> admin; delete separat; submissions create:false = doar submitLpForm; visits/stats write:false =
> doar functions). scripts/test-landing.ts (24 checks: coerce, slug, submission, math rollup).
> Verificat: build (typecheck) + 8/8 suites verzi. DEPLOYED: firestore:rules.

**2026-06-13 - Task Completed — LP P2: Studio (editor cod + preview live + design + CRUD)**
> Model: Claude Fable 5
> Changes: tab nou „Landing Pages" în /admin (AdminView 'landing' + VIEW_LABEL_KEY). LandingStudio.tsx
> (listă landingPages din onSnapshot, sortată client-side după updatedAt; creare/editare/ștergere).
> LpEditor.tsx — „IDE"-ul: bară meta (titlu, slug editabil doar la creare = doc ID, limbă, save,
> publish/unpublish, URL live + copy), tab Cod (textarea monospace cu tab=2 spații) | Design
> (ThemeControls), preview live într-un <iframe sandbox FĂRĂ allow-same-origin> (debounced 400ms,
> srcDoc = customThemeCss(design) + html-ul operatorului). Salvare: setDoc la creare (doc ID = slug,
> re-verifică unicitatea), updateDoc la editare; gardă slug gol/duplicat + publicare pagină goală.
> Refactor design DRY: extras ThemeControls.tsx (refolosit de ThemeEditor + LP design panel,
> withName/withAnimation opționale); themes.ts — extras customThemeBg (sursă unică) + adăugat
> customThemeCss (design ca text CSS: variabile pe :root, fundal pe body — pt. preview + viitorul SSR).
> i18n admin.lpStudio.* + navLanding (ro+en). +2 checks customThemeCss în test-themes.
> Verificat: build + 8/8 suites + prerender + boot-smoke verzi; randare vizuală confirmată (Playwright:
> HTML de operator + design injectat = pagină coerentă, accent custom pe CTA, carduri/grilă tematice).
> DEPLOYED: hosting. (Servirea reală la /p/{slug} vine în P4; agentul AI în P3.)

**2026-06-13 - Task Completed — LP P3: agentul AI în Studio (generate + edit)**
> Model: Claude Fable 5
> Changes: functions/index.js (în blocul AI_ENABLED) — aiGenerateLandingPage({brief: offer/audience/
> goal/tone/includeForm/lang}) și aiEditLandingPage({html,instruction,lang}), admin-only, quota
> aiUsage, model claude-opus-4-8 + adaptive thinking + output structurat LP_PAGE_SCHEMA ({html}),
> max_tokens 32000, runLpModel helper comun. Spre deosebire de aiGenerateCampaign, NU scriu în
> Firestore — întorc {html} la editor (operatorul revizuiește + salvează). System prompt = designer/
> copywriter LP pt IMM RO; promptul cere pagină self-contained cu variabilele de temă (--accent etc.),
> data-cta pe CTA, <form data-lp-form> opțional, fără <script> tracking, imagini https.
> LpAiPanel.tsx (tab 🤖 AI în LpEditor): mod Generează (brief) | Modifică (instrucțiune pe codul
> curent); rezultatul → setHtml + comută pe tabul Cod; mapare erori (resource-exhausted→quota etc.);
> confirmare la suprascriere. i18n admin.lpStudio.ai* (ro+en).
> Verificat: functions load + build + 8/8 suites + prerender + boot-smoke verzi.
> DEPLOYED: functions (aiGenerateLandingPage + aiEditLandingPage create la europe-central2) + hosting.

**2026-06-13 - Task Completed — LP P4: serveLp (servire publică + SSR SEO + logging trafic)**
> Model: Claude Fable 5
> Changes: functions/index.js secțiunea [4] — serveLp (onRequest, europe-central2, mereu activă, NU
> în blocul AI): rezolvă /p/{slug} → LP publicat (404 brand-uit + X-Robots-Tag noindex dacă lipsește/
> draft); LOGHEAZĂ vizita server-side — rollup zilnic stats/{YYYY-MM-DD} (visits/byDevice/bySource/
> byReferrerHost/byCountry prin FieldValue.increment cu set+merge pe obiecte imbricate, AWAITED) +
> doc brut visits/{auto} (fire-and-forget). Compune pagina SSR: <head> cu title/description/canonical/
> og din doc (SEO real), CSS-ul design-ului injectat (lpThemeCss = port JS al customThemeCss),
> Cache-Control no-store (ca fiecare hit să se logheze), CSP restrictivă (default-src none; script-src
> doar inline; connect/form doar self; frame-src/img/media/font https — containment XSS pt operatori).
> Helperi: lpBucket (whitelist surse/referrers → 'other', anti-bloat), lpDevice (UA→mobile/desktop/
> tablet/bot), lpEscape. firebase.json: rewrite /p/** → serveLp (gen-2, europe-central2, pinTag)
> ÎNAINTE de catch-all-ul ** → /app.html.
> Verificat: functions load + build + prerender + boot-smoke verzi; LIVE: https://dataread-e1bd6.web.app/p/
> {slug-inexistent} → 404 serveLp (rewrite + funcția + citirea Firestore execută corect). DEPLOYED:
> functions:serveLp (creată) + hosting. (Randarea unei pagini PUBLICATE + incrementul de vizite se
> confirmă la prima LP creată din /admin; compunerea CSS = identică cu cea verificată vizual în P2.)
> NOTĂ: /p/_track și /p/_submit (beacon + formular) vin în P5.

**2026-06-13 - Task Completed — LP P5: beacon + submissions + dashboard analytics**
> Model: Claude Fable 5
> Changes: serveLp injectează acum în pagină 2 scripturi inline (jsString escapat): beacon de
> engagement (scroll max + timp + click-uri pe [data-cta] → navigator.sendBeacon('/p/_track') la
> visibilitychange/pagehide) și, dacă hasForm, handler de formular (<form data-lp-form> → fetch
> '/p/_submit', afișează successMessage). Ramuri noi în serveLp: handleTrack (increment stats —
> beacons/scrollDepthSum/timeOnPageSum/engaged/ctaClicks, clamp) și handleSubmit (validează LP
> publicat+hasForm, sanitizeLpValues după form.fields, scrie submissions/{auto} via Admin SDK,
> increment stats.submissions, opțional creează lead în pipeline prin mapSubmissionToLead euristic,
> source 'lp:{slug}'). LpFormConfig.tsx (tab Formular: on/off, câmpuri label/name/tip/required/
> opțiuni, submitLabel, successMessage, createLead). LpAnalytics.tsx (tab Analytics, doar pt LP
> salvate: citește rollup-urile stats + submissions, range 7/30/90, KPI cards vizite/conversii/
> conv%/CTA%/engagement/timp/scroll prin lpStats, sparkline vizite, breakdown surse/referrers/țări/
> dispozitive via topEntries, tabel trimiteri + export CSV). i18n admin.lpStudio.* (form + analytics,
> ro+en). CSP permite sendBeacon/fetch doar către 'self'.
> Verificat: functions load + build + 8/8 suites + prerender + boot-smoke verzi.
> DEPLOYED: functions:serveLp (actualizat) + hosting. **Felia LP v1 e funcțional COMPLETĂ.**

**2026-06-14 - Task Completed — LP builder vizual (blocuri → compilare în html)**
> Model: Claude Fable 5
> Andrei: builder vizual (drag&drop, fără cod) peste IDE-ul de cod. Decizie cheie: builder-ul lucrează
> pe BLOCURI care se compilează în ACELAȘI `html` servit de serveLp ⇒ servirea + regulile NESCHIMBATE.
> Changes: src/types/lpBlocks.ts (LpBlock + coerce + compileBlocks PUR; set bogat: hero/heading/text/
> image/button/features/testimonial/faq/form/spacer; folosesc variabilele de temă; escape anti-rupere;
> URL imagine https-only). LandingPage extins cu editor:'code'|'visual' + blocks[] (coerce; rules OK —
> nu folosesc hasOnly). LpVisualBuilder.tsx (paletă, listă cu drag&drop reorder + ↑↓ + ștergere,
> editor de proprietăți per bloc, sub-editor pt liste features/faq). LpEditor: mod cod↔vizual —
> primul tab devine „Blocuri", AI ascuns în vizual; preview + payload.html se compilează din blocuri
> (effectiveHtml); alegere mod la creare + „Comută pe cod" (eject one-way: blocks→html). i18n
> admin.lpStudio.* (bt_*/bf_* + builder, ro+en). +11 checks în test-landing (coerce/compile/escape).
> Verificat: build + 8/8 suites + prerender + boot-smoke verzi; randare vizuală confirmată (Playwright:
> pagină multi-bloc — hero+features+testimonial+faq+form — pe tema Ocean cu accent custom). DEPLOYED:
> hosting (serveLp NESCHIMBAT — servește tot `html`). **Andrei poate construi LP-uri 100% din UI.**

**2026-06-14 - Task Completed — Elemente & animații decorative interactive (LP)**
> Model: Claude Fable 5
> Andrei: elemente decorative (puncte/linii/cerculețe/forme) în blocuri sau pe fundal, care se mișcă
> la interacțiunea userului. Decizie cheie: motorul de animație trăiește DOAR în TS (`compileDecor`
> produce <canvas>+<script> inline self-contained); paginile servite primesc string-ul compilat ⇒
> serveLp nu cunoaște motorul (fără port JS). Changes: src/types/lpDecor.ts (LpDecor + coerce +
> compileDecor — motor canvas pur: 4 efecte dots/constellation/shapes/grid × 4 interacțiuni none/
> mouseReact/mouseParallax/scrollParallax; culoarea = --accent la runtime; prefers-reduced-motion →
> static; densitate plafonată; mode page=fixed z-index:-1 / block=absolute). LandingPage + pageDecor
> + pageDecorHtml (compilat la salvare). lpBlocks: bloc nou `decor` (config + overlay text → section
> cu canvas). LpDecorControls.tsx (efect/interacțiune/densitate/viteză/mărime/opacitate/culoare +
> mini-preview live iframe). Wire: tab Design „Fundal decorativ" (pageDecor) + bloc decor în builder
> (caz special). customThemeCss + lpThemeCss: body position:relative;z-index:0 (stacking ⇒ canvasul
> z-index:-1 stă în spatele conținutului). serveLp.composeLpPage injectează pageDecorHtml după <body>.
> i18n decor*/bt_decor (ro+en). +6 checks în test-landing.
> Verificat: build + 8/8 suites + prerender + boot-smoke; randare vizuală (Playwright, fără page
> errors): cele 4 efecte + fundal de pagină (constelație) în spatele conținutului lizibil. DEPLOYED:
> functions:serveLp + hosting. Amânat: editor de plasare liberă element-cu-element; decor ca fundal
> la orice bloc existent; WebGL/3D.

**2026-06-14 - Task Completed — decor: efecte noi + varietate de forme**
> Model: Claude Fable 5
> Extins motorul `compileDecor` (src/types/lpDecor.ts) cu 3 efecte noi — valuri (linii sinusoidale
> animate), bule (cercuri care urcă), inele pulsatorii (cercuri concentrice care se dilată din centru/
> mouse) — și paleta `shapes` cu diamant/stea/inel/hexagon (acum 7 forme). Total: 7 efecte × 4
> interacțiuni. i18n decorEffect_waves/bubbles/rings (ro+en) + check nou în test-landing.
> Servirea NESCHIMBATĂ (decorul compilează în stringuri stocate; serveLp servește precompilat) ⇒
> deploy doar hosting. Verificat: build + 8/8 suites + prerender + boot-smoke; randare vizuală
> (Playwright, fără page errors) pe tema Carbon. DEPLOYED: hosting.

**2026-06-14 - Task Completed — editor de plasare liberă decor (effect 'custom')**
> Model: Claude Fable 5
> Pasul „freeform" amânat: așezi individual forme pe o pânză, prin drag, fiecare cu animația ei.
> Changes: lpDecor.ts — effect nou 'custom' + model LpElement (shape/x%/y%/size/rotation/color/
> opacity/anim) + coerceElements + `elementStyle` (sursă unică camelCase, folosită ȘI de editor în
> React ȘI serializată la compile) + `compileCustomDecor` (DOM pozitionat: 3 niveluri ca să nu se
> bată transformările — poziționare/animație/rotație; keyframes float/pulse/spin/drift sub
> prefers-reduced-motion: no-preference; parallax mouse/scroll prin strat translatat). 9 forme
> (punct/cerc/inel/pătrat/triunghi/romb/stea/hexagon/linie). LpFreeformEditor.tsx (modal: pânză cu
> drag pe procente, paletă forme, panou proprietăți per element, ștergere, interacțiune scenă).
> LpDecorControls: 'custom' → buton „Editează elementele (N)" deschide editorul + mini-preview.
> i18n decorEffect_custom/ff_*/sh_*/ffAnim_* (ro+en). +3 checks în test-landing.
> Servirea NESCHIMBATĂ (custom compilează în stringuri stocate; serveLp servește precompilat) ⇒
> deploy doar hosting. Verificat: build + 8/8 suites + prerender + boot-smoke; randare vizuală
> (Playwright, fără page errors) — forme la pozițiile lor, culori accent+custom, overlay lizibil.
> DEPLOYED: hosting.

**2026-06-14 - Task Completed — tipografie în sistemul de design (fonturi LP)**
> Model: Claude Fable 5
> Ultimul pilon de design lipsă: fonturi. CustomTheme += headingFont/bodyFont (id din LP_FONTS — 10
> fonturi Google curate: Inter/Poppins/Montserrat/Playfair/Merriweather/Lora/Space Grotesk/DM Sans/
> Oswald + System; '' = system, non-breaking). customThemeCss (TS) + lpThemeCss (port JS în functions)
> emit `@import` Google Fonts (înaintea regulilor) + aplică font-family pe body (bodyFont) și h1-h6
> (headingFont). ThemeControls: prop nou `withFonts` (LP design = da; editorul de temă admin = nu,
> fiindcă inline-style nu poate @import). CSP-ul LP permitea deja style-src/font-src https. i18n
> headingFont/bodyFont (ro+en). +3 checks în test-themes.
> Verificat: build + 8/8 suites + prerender + boot-smoke; randare vizuală (Playwright cu rețea):
> titluri Playfair Display + corp Inter, fără page errors. DEPLOYED: serveLp (lpThemeCss) + hosting.
> NOTĂ: sistemul de design e acum complet — culori, fundal, fonturi, animații, decor (parametric +
> plasare liberă).

**2026-06-14 - Task Completed — decor pe orice bloc + font default + hardening (review ultracode)**
> Model: Claude Fable 5
> Andrei: decor pe ORICE bloc, nu doar bloc dedicat / fundal pagină. Changes: lpBlocks.compileBlocks
> învelește orice bloc (≠ 'decor') cu `props.bgDecor` real → strat de decor în spate (z-index 0) +
> conținut deasupra (z-index 1); blocurile fără bgDecor rămân neschimbate. LpVisualBuilder: panou
> „Fundal decorativ (bloc)" (LpDecorControls pe props.bgDecor) la fiecare bloc non-decor. Fix prins
> vizual: paginile LP cădeau pe serif-ul UA — acum body are mereu un sans (implicit System) în
> customThemeCss + lpThemeCss. i18n blockBgDecor (ro+en).
> **Review adversarial (Workflow ultracode, 10 agenți, 6 dimensiuni + verificare + critic):** 0 buguri
> confirmate pe corectitudine (invariantele țin: blocuri ne-decorate neschimbate, fără decor dublu,
> data-cta/data-lp-form supraviețuiesc învelirii, canvasul fix de pagină z-index:-1 nu e ocluzat).
> Criticul de completitudine a semnalat riscuri de SCALĂ → reparate înainte de ship: (1) gardă de
> mărime la salvare — refuz cu mesaj clar în loc de truncare tăcută a html-ului peste 200KB;
> (2) bgDecor/decor trec acum prin coerceToLpDecor la LOAD în coerceToLpBlock (regula single-coerce);
> (3) motorul de decor pune rAF pe pauză când e offscreen (IntersectionObserver) — fără zeci de bucle
> rAF simultane pe pagini lungi; (4) teste noi (custom gol → fără înveliș; data-cta + data-lp-form).
> Verificat: build + 8/8 suites (8 checks noi) + prerender + boot-smoke; randare vizuală fără page
> errors (decor în spatele conținutului lizibil, heading sans). DEPLOYED: serveLp + hosting.

**2026-06-14 - Task Completed — decor: preview în panoul LP + mai multe reacții (mouseAttract + intensitate)**
> Model: Claude Fable 5
> Andrei: (1) previzualizarea decorului să fie în panoul mare de previzualizare al LP; (2) mai multe
> opțiuni de customizare a reacțiilor. Changes: (1) am scos mini-preview-ul din LpDecorControls
> (state/useEffect/iframe/import compileDecor) — decorul se vede în panoul din dreapta; am adăugat
> draft.pageDecor la dependențele preview-ului din LpEditor ca fundalul de pagină să se actualizeze
> live. (2) interacțiune nouă `mouseAttract` (atrage particulele spre cursor, pe lângă mouseReact =
> respinge) + câmp `intensity` (0-100, scalează forța mouse + amploarea parallax) în motorul canvas
> (var k, R=max(30,120*k), dir attract=-1) și în parallax-ul DOM (custom). Slider „Intensitate
> reacție" în LpDecorControls + în editorul de plasare liberă. i18n decorInter_mouseAttract/
> decor_intensity (ro+en).
> **Review adversarial (Workflow ultracode, 5 agenți, 3 dimensiuni + verificare):** 1 bug medium
> confirmat și REPARAT — la custom (DOM), o reacție de particule (mouseReact/mouseAttract) rămasă de
> la alt efect desincroniza select-ul filtrat din editorul freeform; normalizat la 'none' atât la
> schimbarea efectului (LpDecorControls) cât și în coerceToLpDecor (regula single-coerce). +3 checks.
> Verificat: build + 8/8 suites + prerender + boot-smoke; smoke headless al motoarelor (mouseAttract/
> mouseReact/intensity/parallax) fără page errors. DEPLOYED: hosting (serveLp neatins — decor precompilat).

**2026-06-14 - Task Completed — panou de previzualizare LP mare, responsive, cu fundal distinct**
> Model: Claude Fable 5
> Andrei: panoul de preview mult mai mare + customizabil (LP-urile fiind responsive, conținutul ține
> cont de mărimea boxului) + fundal diferit de restul admin-ului. Changes: LpPreviewPane.tsx nou —
> lățimi de dispozitiv (Mobil 390 / Tabletă 820 / Desktop plin) ca să testezi responsive-ul (iframe-ul
> ia lățimea aleasă → conținutul se reașază), redimensionabil pe verticală (resize), înălțime mare
> implicit (640). styles.css `.lp-preview-surface` = fundal-canvas în damă (transparency grid),
> distinct de tema admin-ului. LpEditor: preview-ul folosește LpPreviewPane; layout rebalansat
> (controale ≤440px, preview flex 2 → mult mai lat). i18n pv_mobile/tablet/desktop/full/resizeHint.
> Verificat: build + 8/8 suites + prerender + boot-smoke; randare vizuală (Playwright): suprafață în
> damă cu LP încadrat la 390px, grila de beneficii se stivuiește pe o coloană (responsive real).
> DEPLOYED: hosting (schimbare pur UI; serveLp neatins).

**2026-06-14 - Task Completed — galerie de șabloane LP (6 modele gata făcute)**
> Model: Claude Fable 5
> La „Pagină nouă" alegi acum un șablon gata (blocuri + design + decor + formular) sau pagină goală.
> Changes: src/admin/lpTemplates.ts (tip LpTemplate + landingPageFromTemplate — totul prin
> coerceToLandingPage la aplicare; 6 șabloane RO: Conferință business, Lansare produs e-commerce,
> Consultanță B2B, Webinar gratuit, App download, Clinică/programare — fiecare cu temă+fonturi+decor
> distincte). LpTemplatePicker.tsx (modal cu carduri + mini-preview live în iframe scalat). LandingStudio:
> „Pagină nouă" deschide selectorul. i18n tpl_title/blank/blankHint (ro+en). +2 checks (toate compilează,
> id-uri unice).
> **Conținut generat cu Workflow ultracode (12 agenți: autor + critic per categorie, în paralel)** —
> fiecare șablon autorat și apoi rafinat de un editor critic; embed determinist în registru.
> Verificat: build + 8/8 suites + prerender + boot-smoke; toate cele 6 șabloane randate headless FĂRĂ
> page errors (8/9/8/6/9/9 blocuri), confirmate vizual (conferință dark + clinică light). DEPLOYED:
> hosting (serveLp neatins). **LP Studio e complet ca produs: șabloane → builder/cod/AI → design+decor
> → preview responsive → publicare → analytics.**

**2026-06-14 - Task Completed — verificare LP (audit + fix-uri + E2E în proces) + deploy**
> Model: Claude Fable 5
> Andrei: „vreau să ne asigurăm că ce s-a făcut pentru LPs funcționează corect". Audit multi-agent
> (ultracode) → 5 constatări, toate remediate:
> - **HIGH** publicarea în mod vizual/șablon era blocată: garda verifica `draft.html` (gol în vizual),
>   acum `payload.html` (= blocuri compilate). [LpEditor.tsx]
> - **MEDIUM** formular „mort": un bloc `form` se livra fără handler dacă form.enabled=false. Acum
>   `formCfg` forțează enabled când există un bloc form (effectiveHtml + payload) + gardă în compileBlock. [LpEditor.tsx, lpBlocks.ts]
> - **MEDIUM** integritate handleTrack: scria statistici pentru ORICE slug valid ca regex. Acum citește
>   doc-ul și scrie DOAR dacă există + e publicat. [functions/index.js]
> - **LOW** SSR: host-ul (din header, controlabil) intra neescapat în canonical/og:url. Acum validat
>   la hostname + `lpEscape`. [functions/index.js]
> - **LOW** lpThemeCss (port JS): fallback-ul ignora `design.base` (cădea mereu pe dark). Acum tabel de
>   preset-uri portat → fallback pe tema de bază + flag digital. [functions/index.js]
> Verificat: 8/8 suites + build + prerender + boot-smoke. **E2E în proces** nou (scripts/e2e-lp-serve.mjs,
> `npm run test:e2e-lp`): drive-uiește serveLp/handleTrack/handleSubmit REAL (functions/index.js) cu un
> Firestore fals în memorie + compilatoarele REALE (compileBlocks/compileDecor/customThemeCss) → 38
> verificări: randare pagină vizuală (SEO, design Ocean+fonturi, decor canvas în spate, blocuri, formular
> auto-activat, beacon+handler), draft→404, track increment vs. integritate (slug inexistent/draft = 0
> scrieri), submit valid→submission+lead, submit incomplet→400, fallback temă light. Dovadă vizuală:
> screenshot constellation randat corect (puncte+linii subtile în spatele conținutului). Verificare LIVE
> pe producție (negative paths pe serveLp deployat): /p/{inexistent}→404+noindex, /p/_track→204,
> /p/_submit→400. DEPLOYED: functions (serveLp + cele 3 fix-uri) + hosting (LpEditor/lpBlocks) + rules.
> Notă: scriere de LP de test direct în producție nu e posibilă fără credențiale Admin SDK (ADC/SA
> neconfigurate); E2E în proces acoperă exact același cod + intrări, plus negative paths live.

**2026-06-14 - Task Completed — decor responsiv (se scalează cu lățimea containerului)**
> Model: Claude Fable 5
> Andrei: „dimensiunea elementelor rămâne constantă, nimic nu se scalează" — decorul avea dimensiuni
> în px ficși, deci pe mobil/desktop arăta disproporționat (conținutul se reașază responsive, decorul nu).
> Fix în lpDecor.ts (motorul trăiește doar în TS → doar hosting, serveLp neatins; paginile vechi prind
> scalarea la re-salvare/recompilare):
> - **Canvas** (decorEngine): `scl()=clamp(0.5..1.25, W/REF=1100)` aplicat pe raza particulelor, grid
>   (dot+wobble), waves amp, constellation D/MR; recalculat la resize (build rulează deja la resize).
> - **Custom (freeform)**: elementele primesc `scale(var(--lpf-s,1))`; un scaleScript setează `--lpf-s`
>   = clamp(0.5..1.25, lățime container/1100) la init + resize (independent de parallax-ul pe layer).
> **Review adversarial (Workflow ultracode, 9 agenți, 3 lentile + verificare)** → 4 constatări reale,
> toate remediate înainte de deploy: (MEDIUM) reduced-motion + resize golea canvas-ul (sz() curăță, dar
> draw() nu se mai apela) → listener resize→draw în reduced-motion; (LOW) lineWidth nescalat → 
> `lineWidth=max(1,scl())`; (LOW) wobble grid fix 3px → `*SCg`; (LOW) gap grid scalat alimenta bucla →
> ~3× puncte/cadru pe mobil (regresie perf introdusă de mine) → gap revenit la lățime-independent,
> doar raza punctelor scalează. Verificat: 8/8 suites (+2 checks scalare) + E2E în proces + build +
> screenshot multi-lățime (390/640/900) cu pătrat de referință fix → decorul scalează vizibil, referința
> constantă. DEPLOYED: hosting.

**2026-06-14 - Task Completed — buton „Recompilează toate" în LP Studio + sursă unică de compilare**
> Model: Claude Fable 5
> Andrei: „da, sună bine" (la oferta de buton „recompilează toate paginile" ca paginile vechi să prindă
> scalarea decorului fără re-salvare manuală). Changes:
> - **landingPage.ts**: helperi puri noi `effectiveLpForm` (bloc form → form.enabled), `recompileLpAssets`
>   (html din blocuri în vizual / brut în cod + pageDecorHtml + formular efectiv) și `htmlByteSize`
>   (octeți UTF-8 = ce validează regulile). Sursă UNICĂ de compilare.
> - **LpEditor.tsx**: refactor să folosească recompileLpAssets (preview, payload, eject-to-code) +
>   gardă de mărime pe `htmlByteSize` în loc de `.length`. Fără schimbare de comportament (verificat).
> - **LandingStudio.tsx**: buton „↻ Recompilează toate" — tranzacție per pagină (re-citire proaspătă →
>   recompilare → scriere), sare paginile prea mari (octeți), scrie doar ce s-a schimbat, raportează
>   contoare (actualizate/neschimbate/sărite/eșuate). i18n ro+en (recompile*).
> **Review adversarial (Workflow ultracode, 6 agenți)** → 2 constatări reale (LOW), remediate înainte de
> deploy: (1) lost-update race (folosea snapshot-ul vechi) → tranzacție cu re-citire proaspătă; (2) garda
> de mărime pe `.length` (UTF-16) diverge de regula Firestore `.size()` (UTF-8) → `htmlByteSize` în ambele
> locuri, deci paginile grele sunt raportate corect ca „sărite", nu „eșuate". Verificat: 8/8 suites
> (+5 checks noi) + E2E în proces + build + prerender + boot-smoke. DEPLOYED: hosting.

**2026-06-14 - Hotfix — /admin + paginile publice dădeau „Page Not Found" (deploy fără prerender)**
> Model: Claude Fable 5
> Cauză: la ultimele 2 deploy-uri de hosting am rulat `npm run build` (care golește `dist/` — emptyOutDir)
> FĂRĂ `npm run prerender`, deci `dist/app.html` (ținta rewrite-ului catch-all `** → /app.html`) + paginile
> prerenderizate (/pachete, /start, /contact, /legal/*, /en/*) lipseau din build. Rezultat: orice rută SPA
> (/admin, /app) + sub-paginile publice → 404 Firebase. Fix: `npm run build:site` (build+prerender) +
> boot-smoke + re-deploy hosting. Verificat live: /admin, /app, /, /pachete, /start → HTTP 200.
> **Lecție:** deploy de hosting DOAR cu `npm run build:site` (sau `npm run deploy`), niciodată `build` simplu.

**2026-06-15 - Task Completed — overview de performanță în lista LP Studio (nexus de trafic)**
> Model: Claude Fable 5
> „continua" → lista de Landing Pages devine un mic dashboard: per pagină **Vizite / Lead-uri /
> Conversie (7 zile)** + sumar total în header. Citește rollup-urile zilnice (limit 7/pagină, în
> paralel cu Promise.all), agregare prin motorul PUR `lpStats.ts` (deja testat). Read-only, fără
> schimbări de functions/reguli (stats = admin read). i18n ro+en (col*/ov*).
> **Review adversarial (Workflow ultracode, 6 agenți)** → 4 constatări reale, toate remediate înainte
> de deploy: (MEDIUM) `slugKey` era sensibil la ORDINE (rows sortat după updatedAt) → o editare
> reordona lista și refăcea toate citirile; **+amplificare O(N²) la „recompilează toate"** → cheie
> sortată `[...slugs].sort().join('|')`; (LOW) header arăta „0/0" în timpul încărcării vs rândurile
> „—" → flag `metricsLoaded`; (LOW) totalul sub-număra tăcut dacă o citire eșua → flag `metricsPartial`
> + indicator „date parțiale". Verificat: 8/8 suites + build:site (app.html prezent) + boot-smoke.
> DEPLOYED: hosting.

**2026-06-15 - Task Completed — analytics de atribuire per-link (UTM) pentru LP**
> Model: Claude Fable 5
> Andrei: linkul LP se postează pe multe platforme + assets video/statice cu versiuni diferite, codificate
> prin UTM; vrem trafic + conversii + engagement PER variantă. Plan aprobat (plan mode). Implementat P0–P3:
> - **Cheie partajată** `src/types/lpAttribution.ts` (PUR: sanitizeVariantPart/variantKey/buildLpUrl/coerce/
>   LP_MEDIA/LP_PLATFORMS) + **port JS** în functions/index.js (exportat) — paritate TS↔JS testată cross-runtime
>   în e2e-lp-serve.mjs (corpus adversarial: diacritice/emoji/over-length).
> - **Anti-bloat fără citire:** `knownVariants:{[key]:true}` pe LP (scris de Link Builder); serveLp citește deja
>   doc-ul → variantă cunoscută = contor dedicat, UTM necunoscut → `__other`, fără UTM → `__direct`. Plafon 200.
> - **functions:** logLpVisit(lp)+batch {stats(+byMedium) + variants/{target}}; handleTrack batch {stats +
>   engagement variantă}; handleSubmit batch {stats + submissions variantă} (variantKey SERVER-side din UTM);
>   beacon trimite UTM, formular adaugă content/term. LP_SOURCE_WHITELIST extins (pinterest/snapchat/…).
> - **model:** `byMedium` în lpStats (axă de timp); `landingPages/{slug}/variants/{key}` (contoare) +
>   `links/{id}` (linkuri salvate). Reguli: variants read-only, links admin-rw (hasOnly + format variantKey),
>   knownVariants bound ≤200.
> - **UI:** tab „Linkuri" (LpLinkBuilder — compune URL etichetat, copiază, salvează în links+knownVariants,
>   listă cu performanță per link); LpAnalytics: card „Tip asset" (byMedium) + tabel „Variante observate"
>   (platformă/medium/campanie/versiune × vizite/conversii/rată/engagement). i18n ro+en.
> **Review adversarial (Workflow ultracode, 11 agenți, 3 lentile)** → 8 constatări, remediate cele relevante:
> (MEDIUM) knownCount stale pe sesiune → LpLinkBuilder abonat live la doc-ul LP; (LOW) eroare salvare raw →
> mesaj tradus; (LOW) reguli links fără hasOnly/format → adăugate; (LOW) whitelist surse nu acoperea platformele
> din builder → extins; (LOW) antet „Vizite" fragil → cheie i18n dedicată. Acceptate (documentat): boții în
> visits (design „înregistrăm tot trafic"); validarea per-cheie a knownVariants (limită reguli Firestore —
> acoperit de plafon + coerce la citire). Verificat: 9/9 suites + e2e (paritate+variant+byMedium+allowlist) +
> build:site (app.html) + boot-smoke. DEPLOYED: functions + hosting + rules.

**2026-06-15 - Task Completed — analytics LP (sortare/CSV/A-B) + organizare pe proiect & client**
> Model: Claude Fable 5
> Andrei: „ia-le în ordine" (urmările de analytics) + organizare LP pe proiect/client (cu acces viitor al
> clientului la date). Plan aprobat (Proiect+Client; colecție gestionată).
> - **Analytics (LpAnalytics):** tabel variante SORTABIL (header click), **export CSV** variante,
>   **comparație A/B/n** (agregare după versiune/asset/platformă/campanie, clasare după conversie, câștigător ★).
> - **Organizare:** colecție gestionată `lpProjects` (nume+culoare+client implicit) — `src/types/lpProject.ts`,
>   `LpProjectManager` (CRUD modal); `LandingPage.projectId` + atribuire client (`clientUid`) din bara meta a
>   editorului; în listă: filtre (chips proiect + dropdown client) + coloană Proiect/Client (badge). Pregătit
>   pentru accesul VIITOR al clientului (clientUid pe LP; scoping „mai târziu").
> - reguli: `lpProjects` admin-rw (hasOnly + validare); `LandingPage.projectId/clientUid` permise.
> **Review adversarial (Workflow ultracode, 16 agenți)** → 13 constatări; remediate cele relevante: (MEDIUM)
> A/B marca un câștigător chiar la 0 conversii → gate pe conv>0; (MEDIUM) select-ul de comparație dispărea când
> dimensiunea avea <2 grupuri → secțiunea/selectul rămân, mesaj „prea puține grupuri"; (LOW-securitate) doc-ul
> LP publicat era citibil public (expunea clientUid/leadId/projectId) → read DOAR isAdmin (publicul primește
> pagina prin serveLp/Admin SDK); proiect șters → filtru resetat + LP tratat ca „fără proiect"; clients
> onSnapshot plafonat (500); reguli lpProjects validează clientUid; tabel/comparație etichetate „(total, toate
> timpurile)". Verificat: 9/9 suites + e2e + build:site (app.html) + boot-smoke. DEPLOYED: hosting + rules.

**2026-06-15 - Task Completed — acces client la datele LP în portal (/app, scoped per client)**
> Model: Claude Fable 5
> Andrei: clienții vor folosi portalul și pentru a-și monitoriza propriii clienți (lead-urile), nu doar
> succesul campaniilor. Plan aprobat (plan mode). Abordare HIBRID (scoped reads + index descoperire),
> NU mirror programat (mai ieftin, unlink instant, fără Cloud Scheduler):
> - **reguli (firestore.rules):** clientul logat citește `landingPages/{slug}/stats|variants|submissions`
>   DOAR dacă `get(parinte).clientUid == auth.uid` (gardă auth!=null, ca la campaigns/metrics). Doc-ul
>   landingPages + `visits` rămân admin-only. `clients/{uid}/lpIndex` read scoped. Unlink = instant.
> - **functions:** `onLandingPageWrite` (diff clientUid prin `lpIndexTarget` pur, clonă onRequestWrite)
>   oglindește `clients/{uid}/lpIndex/{slug}` (DOAR slug/title/publicUrl/status) — descoperire fără a
>   expune doc-ul intern. + `backfillLpIndex` (callable admin, one-shot pt. LP-uri deja atribuite).
> - **portal (AppHome `LandingPagesPortal`):** citește lpIndex → per LP stats/variants/submissions
>   (scoped) → KPI (vizite/conversii/rată/engagement) + defalcare sursă/asset + tabel performanță pe
>   versiuni + **tabel lead-uri capturate** (clienții clientului). Reutilizează lpStats/lpAttribution pure.
> - buton „↺ Sincronizează portalul" în LP Studio (cheamă backfillLpIndex). i18n appHome.lp* + sync* ro+en.
> **Review adversarial (Workflow ultracode, 9 agenți, lentilă strictă de securitate)** → 6 constatări;
> remediate: (MEDIUM) lipsă backfill → callable + buton; (LOW) variante fetch-uite dar nerandate + import
> nefolosit → tabel performanță pe versiuni; (LOW) submissions expun ua/referrer/geoCountry → ACCEPTAT
> (lead-uri proprii ale clientului) + comentariu de politică clarificat (visits rămâne intern). Securitate
> confirmată: fără cale cross-tenant, doc-ul LP + visits rămân admin-only. Verificat: 9/9 suites + e2e
> (incl. lpIndexTarget) + build:site (app.html) + boot-smoke. DEPLOYED: functions + hosting + rules.
> **Notă business (non-cod):** acordurile cu clienții trebuie să acopere prelucrarea datelor lead-urilor.

**2026-06-15 - Task Completed — management lead-uri de către client (mini-CRM pe lead-urile LP)**
> Model: Claude Fable 5
> Andrei: „management lead-uri". Clientul gestionează în portal lead-urile capturate de LP-urile lui:
> status pe pipeline + notă + filtrare/numărare + export CSV. SEPARAT de pipeline-ul agenției.
> - **model:** `clients/{uid}/lpLeadState/{submissionId}` (deținut+scris de client) = {status,note,slug,
>   updatedAt}. `src/types/lpLeadState.ts` (statusuri nou/contactat/calificat/câștigat/pierdut + culori +
>   coerce). Pipeline = Nou→Contactat→Calificat→Câștigat/Pierdut.
> - **reguli:** `clients/{uid}/lpLeadState` owner-rw (hasOnly + enum + size + `updatedAt==request.time`),
>   delete owner. Primul subarbore client-WRITABLE după onboarding.
> - **portal (LandingPagesPortal):** status `<select>` + notă (onBlur) editabile pe fiecare lead; chips de
>   filtru + contoare pe status (peste toate LP-urile); export CSV per LP. Un singur listener lpLeadState.
> **Review adversarial (Workflow ultracode, 8 agenți, lentilă securitate scriere)** → 6 constatări;
> remediate: (MEDIUM) lost-update race în saveLeadState (scria docul plin din state vechi) → ref
> `leadStateRef` + scriere optimistă; (MEDIUM) injecție de formule în CSV din valori controlate de
> atacator → util nou `src/utils/csv.ts` (`csvCell`/`toCsv` prefixează =,+,-,@) aplicat la TOATE
> exporturile cu date de utilizator (portal + LpAnalytics submissions/variante); (LOW) `updatedAt`
> nevalidat → `==request.time`; (LOW) export ignora filtrul → exportă setul vizibil. Acceptate (low,
> defense-in-depth): verificarea proprietății submissionId (subarbore propriu, orfani invizibili), input
> notă necontrolat. Fără cross-tenant. Verificat: 9/9 suites (+csvCell+lpLeadState) + e2e + build:site
> (app.html) + boot-smoke. DEPLOYED: hosting + rules (fără functions).

**2026-06-15 - Task Completed — sistem management administratori (RBAC owner/operator + audit)**
> Model: Claude Opus 4.8 (1M context)
> Andrei: „vreau un sistem de management pentru administratori, pentru cei care au acces la panoul admin".
> Roluri owner+operator + jurnal de audit. Owner-ul gestionează adminii; operatorul face munca zilnică.
> - **functions:** `recomputeAdminClaim` setează acum claim `{admin, role}` (`deriveAdminRole`: rolul stocat
>   câștigă; founder=owner implicit cât timp rolul nu e setat). `canMutateAdmin` PUR+exportat (owner-only +
>   anti-blocare ultimul owner). `manageAdmin` (onCall owner-only) delegă către nucleul testabil
>   `performManageAdmin(db, caller, data)`: autorizează apelantul DIN FIRESTORE (rol live, nu token vechi
>   ~1h), tranzacție cu TOATE citirile înainte de scrieri, owners = query(role==owner) ∪ {founder dacă
>   există}, self-heal founder (role:'owner' la prima acțiune — fără backdoor permanent), execută approve/
>   reject/revoke/setRole + audit append-only, atomic.
> - **reguli:** `admins` + `adminRequests` (update/delete) + `adminAudit` toate `write:false` — orice mutație
>   trece DOAR prin callable (Admin SDK). Închide gaura: înainte ORICE admin putea șterge/edita `admins/{uid}`
>   din client (scotea owner-ul, pe sine, sau ultimul admin → blocare totală).
> - **UI:** tab nou „Administratori" în /admin (`AdminsPanel`): cereri în așteptare (mutate din tabul Leads) +
>   listă admini cu rol/revoke/schimbă-rol (owner-only, dezactivate pe ultimul owner) + feed audit (50).
>   `src/types/adminRole.ts` (roluri/coerce). i18n `admin.*` ro+en paritate.
> **Review:** Workflow-ul adversarial automat a eșuat de DOUĂ ori pe limite de rată Anthropic (agenți morți
> cu 0 tool-uri — deci „0 constatări" = irelevant, NU cod curat). Pasul MANUAL de securitate a prins un BUG
> REAL: scrierea de audit folosea `actorEmail` (identificator nedeclarat — numele corect era `callerEmail`)
> → ReferenceError în tranzacție → FIECARE apel `manageAdmin` ar fi eșuat cu „internal". Niciun test nu-l
> prindea (tranzacția nu era acoperită — doar funcția pură). Remediat + protejat cu regresie: am extras
> `performManageAdmin` testabil și am adăugat TEST M în e2e (Firestore în memorie cu runTransaction+where:
> approve/setRole/revoke/last-owner/operator-denied/self-heal founder/audit corect — 17 verificări). Review-ul
> adversarial complet se poate re-rula când limitele se ridică.
> Verificat: 9/9 suites + e2e (TEST L pur + TEST M tranzacțional) + build:site (app.html prezent) + boot-smoke.
> DEPLOYED: functions (manageAdmin nou) + hosting + rules.

**2026-06-15 - Task Completed — pas „Oportunități": aiRecommendChannels (recomandare canale AI cu scor de impact)**
> Model: Claude Opus 4.8 (1M context)
> Andrei a analizat un competitor (AI Marketing Explorer / STRATEGY LAB, self-serve + credite — analiză în
> `docs/ANALIZA-COMPETITOR-...md`). Decizie roadmap: pivotul self-serve (client-gen + credite + trial +
> checkout + sold) se amână post-MVP/lansare; ACUM câștiguri rapide pe modelul de agenție. PRIMUL = pasul
> „Oportunități" al competitorului, dar pentru OPERATOR (admin-only, ca restul generării AI).
> - **functions:** `aiRecommendChannels(leadId)` (onCall admin-only, oglindă `aiGenerateCampaign`) → citește
>   lead-ul, model `claude-opus-4-8` cu `CHANNELS_SCHEMA` (structured output: 4-6 canale cu titlu/impact/
>   motiv/descriere/obiectiv/ofertă), scrie `leads/{id}.channelRecommendations` (merge). `buildChannelsPrompt`
>   pur+exportat. **Fără modificări de reguli** (lead admin-only).
> - **UI:** `OpportunityBoard` (montat în rândul de lead din AdminHome): board de carduri sortabile după
>   impact + regenerare + **„Creează cerere"** care pre-completează o cerere de marketing din oportunitate
>   (kind=campanie) → apare automat în LeadRequests. `src/types/recommendation.ts` (coerce + sortByImpact +
>   IMPACT_LEVELS). i18n `admin.opp*` ro+en paritate.
> **Review adversarial (Workflow ultracode, 17 agenți, 3 lentile + verificare per finding)** → 6 reale, 4
> parțiale, 4 fals-pozitive. Remediate: (HIGH) paritate obiective TS↔JS↔schema (`OBJ`/`OBJECTIVES`/enum
> divergeau pe „other") → clamp-ul JS se DERIVĂ acum din `CHANNELS_SCHEMA` (anti-drift) + coerce TS restrâns
> la cele 4 valori ale schemei (+ test „other"→""); (MEDIUM) `consumeAiQuota` rula înainte de verificarea
> existenței lead-ului (drenaj de quota) → reordonat ca la `aiClientReport`; (MEDIUM) maparea bugetului
> `t()` pe cheie nevalidată → gardă `AD_BUDGETS.includes`; (LOW) callback-ul de eroare reseta channels dar
> nu adBudget. Amânat (task separat, pre-existent): `onRequestWrite` nu validează că `clientUid` există
> înainte de mirror (defense-in-depth, afectează și campaigns/LP). Acceptate (by design): izolare per-echipă
> (single-team), buget free-text pe cerere, câmpuri metadata pe MarketingRequest.
> Verificat: 9/9 suites (+6 teste recomandare) + e2e (TEST N) + build:site (app.html) + boot-smoke.
> DEPLOYED: functions (aiRecommendChannels nou) + hosting.

**2026-06-15 - Task Completed — LP Studio: previzualizare multi-ecran + fundaluri decorative multiple**
> Model: Claude Opus 4.8 (1M context)
> Andrei (2 cereri vizuale în LP Studio). DOAR pe client (serveLp servea deja string-ul precompilat).
> - **Previzualizare multi-ecran:** `LpPreviewPane` rescris — mai multe iframe-uri de dimensiuni diferite
>   afișate SIMULTAN, toate cu același srcDoc live; presete dispozitiv + dimensiune custom W×H + șterge +
>   resetează. Setul salvat per-browser în localStorage (`src/types/lpPreviewScreens.ts`: coerce/clamp/
>   load/save). Revine la redeschidere.
> - **Fundaluri decorative multiple:** `LandingPage.pageDecor` (single) → `pageDecors: LpDecor[]` (straturi
>   suprapuse, cap 5); coerce cu MIGRARE legacy (pageDecor single non-none → [strat]); `compilePageDecors`
>   concatenează straturile (id unic pg0,pg1…); `LpDecorLayers` (add/remove/reorder peste LpDecorControls)
>   în tab-ul Design. serveLp NESCHIMBAT (primește pageDecorHtml concatenat). i18n pv_*/decor_layer* ro+en.
> **Review adversarial (Workflow ultracode, 19 agenți; verify-ul a picat pe limita de sesiune → triaj
> MANUAL).** Din 16 findings: remediate — (HIGH) garda de mărime la salvare verifica doar html, NU și
> pageDecorHtml → acum `html + pageDecorHtml ≤ LP_HTML_MAX` (5 straturi nu pot împinge pagina servită peste
> plafon); (LOW) gardă NaN pe input-urile custom W×H; (LOW) curățat 3 chei i18n nefolosite (pv_full,
> pv_resizeHint, decor_preview). Respins motivat — (HIGH) „React key={i} la reorder resetează starea":
> FALS-POZITIV în practică (singura stare locală e modalul fullscreen LpFreeformEditor `position:fixed
> inset:0 z60` care ACOPERĂ butoanele ▲▼ → reorder imposibil cât e deschis; închis, controalele sunt 100%
> controlate de `value`). Acceptate by-design: straturi 'none' păstrate (slot adăugat de user), clamp tăcut
> la coerce (pattern existent). Verificat: 9/9 suites (+9 teste noi) + e2e (serveLp 2 straturi pg0+pg1) +
> build:site (app.html) + boot-smoke. DEPLOYED: hosting + rules (fără functions).

**2026-06-15 - Task Completed — hardening onRequestWrite/onLandingPageWrite: validează clientUid există înainte de mirror**
> Model: Claude Opus 4.8 (1M context)
> Defense-in-depth (principiul #3, izolare multi-tenant) găsit la review-ul feature-ului Oportunități.
> Trigger-ele care oglindesc pe baza unui `clientUid` DENORMALIZAT scriau sub `clients/{uid}/**` fără să
> verifice că acel cont client există → un clientUid greșit (typo/import) ar fi creat date orfane sub un UID
> care poate deveni cont real. Helper nou `clientExists(db, uid)` (fail-closed la eroare); gardează UPSERT-ul
> în `onRequestWrite` (deliverables), `onLandingPageWrite` (lpIndex) și bucla din `backfillLpIndex` (skip +
> logger.warn dacă lipsește clientul). Ștergerile NU se gardează (idempotente, cleanup). Campaniile NU au
> mirror (clientul le citește direct, scoped prin reguli) — nimic de gardat acolo. Test e2e TEST O
> (clientExists: existent→true, inexistent/gol/null→false, eroare→false fail-closed). Verificat: 9/9 suites
> + e2e (TEST O) + boot-smoke. DEPLOYED: functions (fără hosting/reguli).

**2026-06-16 - Task Completed — Export PDF (raport lunar + livrabile), admin + portal client**
> Model: Claude Opus 4.8 (1M context)
> Câștig rapid din analiza competitorului (task #49). Azi raportul/livrabilele se puteau doar copia în
> clipboard, iar portalul clientului n-avea export. Decizie (AskUserQuestion): **print-to-PDF din browser**
> (ZERO dependență nouă — regula CLAUDE.md) + conținut = raport + livrabile, în admin ȘI portal client.
> - **util nou `src/utils/printDoc.ts`** (pur + 1 side-effect): `escapeHtml`, `composePrintHtml` (document
>   HTML A4 brandat, fundal alb, print CSS; sare secțiunile goale; ESCAPEAZĂ tot textul), `printHtmlDoc`
>   (iframe ascuns → `print()`, anti popup-blocker), `printTitle`. Pure = testabile headless; `document` e
>   atins DOAR în side-effect (SSR/test-safe).
> - **wiring (4 locuri):** buton „📄 PDF" pe raport (`MarketingCenter` ClientReportPanel) + pe livrabile
>   (`LeadRequests`, lângă Copy all), și „📄 Descarcă PDF" pe raportul + cardurile de livrabile din portalul
>   client (`AppHome` MarketingPortal). i18n `admin.pdfBtn` + `appHome.pdfBtn` (ro+en).
> **Review:** MANUAL (review-urile automate se loveau de limita de sesiune). Punctul de securitate (injecție
> în documentul de print din text liber AI/operator) e acoperit de teste: `escapeHtml` + `composePrintHtml`
> escapează `<script>`/HTML. Verificat: 9/9 suites (+escape/compose) + e2e + build:site (app.html) + boot-smoke.
> DEPLOYED: hosting + rules (fără functions).

**2026-06-16 - Task Completed — tab „Sugestii" proactiv pentru operator + fix nav Administratori**
> Model: Claude Opus 4.8 (1M context)
> Câștig rapid din analiza competitorului (#50). Strat care suprafațează „următorul pas" din date DEJA
> generate — NU generează AI. Decizii (AskUserQuestion): tab dedicat „Sugestii" + 3 semnale.
> - **agregator PUR `src/admin/suggestions.ts`** (`buildSuggestions({leads,campaigns,nowMs})`, testat):
>   lead 'new' netratat ≥2 zile → leadUntouched (high); 'contacted' ≥14 zile → leadStale; campanie cu
>   `aiInsight.verdict` pause/test/scale → campaignAction (pause=high); lead cu campanii fără raport luna
>   curentă (monthKey UTC) → reportMissing. Sortare după severitate.
> - **`SuggestionsPanel`**: listeneri pe `leads` (limit 200, orderBy createdAt) + `campaigns` (limit 300),
>   normalizează snapshot-urile, randează lista cu badge severitate + „Deschide" → `onNavigate(view)`.
> - **AdminHome**: tab nou „Sugestii". **FIX**: nav array omitea `'admins'` (tabul Administratori era
>   inaccesibil de la livrarea RBAC) — adăugat acum. i18n `admin.navSuggestions`+`sug*` (ro+en).
> **Review adversarial (1 agent, limitele resetate).** Remediat: (MEDIUM) listeneri fără `limit()` → limit
> 200/300 (ca pattern-ul AdminHome); (NIT) monthKey format `YYYY-M` → `YYYY-MM` (padded, intern+simetric).
> Acceptat: `Date.now()` în useMemo (recompune la schimbarea datelor — ok pt. panou advisory). Restul
> confirmat corect (nav, paritate i18n, logică pură, edge-cases). Verificat: 9/9 suites (+9 buildSuggestions)
> + e2e + build:site (app.html) + boot-smoke. DEPLOYED: hosting + rules.

**2026-06-16 - Task Completed (schelet) — Secțiune Ghid/Documentație (titluri + subtitluri), operator + client**
> Model: Claude Opus 4.8 (1M context)
> Andrei: secțiune de documentație care explică platforma + funcțiile. Decizie: SCHELET acum (titluri +
> subtitluri, per modul), completat incremental pe parcurs (proza completă + polish spre lansare; evită
> rescrierea ×2 ro/en a feature-urilor încă volatile). Ambele audiențe.
> - **`src/help/helpContent.ts`** (date pure): `OPERATOR_HELP` (8 module) + `CLIENT_HELP` (5 module), doar
>   chei i18n (titlu + subtitluri); câmp viitor `bodyKey` pentru conținut. **`src/help/HelpView.tsx`**
>   (prezentațional, refolosit): randează titluri + subtitluri + placeholder „în curând".
> - **/admin**: tab nou „Ghid" (HelpView + OPERATOR_HELP). **/app**: rută `/app/ghid` (`HelpHome` + CLIENT_HELP)
>   + link „Ghid" în header. i18n `help.*` + `admin.navHelp` (ro+en, ~60 chei).
> - **Test**: acoperirea cheilor — fiecare cheie din helpContent rezolvă în `ro` (prinde cheile lipsă care
>   altfel s-ar randa brut); paritatea en e impusă compile-time (`en: typeof ro`).
> Review manual (schelet prezentațional, risc mic; riscul real = chei i18n lipsă, acoperit de test).
> Verificat: 9/9 suites (+acoperire chei) + build:site (app.html) + boot-smoke. DEPLOYED: hosting + rules.
> RĂMÂNE DESCHIS pentru completarea incrementală a conținutului (bodyKey per secțiune).

**2026-06-16 - Task Completed — polish + verificare (după feature-urile zilei)**
> Model: Claude Opus 4.8 (1M context)
> Trecere de polish/verificare pe ce s-a livrat azi. Fix: bara de taburi din `/admin` are acum 6 taburi
> (Lead-uri/Sugestii/Marketing/Landing/Administratori/Ghid) → `flexWrap: 'wrap'` ca să nu se reverse pe
> orizontală pe ecrane înguste. Verificare live în browser blocată de conflict de port (serverul de dev
> CNCVS ocupă 5173; nu l-am oprit) + părțile /admin și /app sunt auth-gated (fără credențiale local) — deci
> verificarea s-a bazat pe suita automată: 9/9 suites + e2e + build:site (app.html) + boot-smoke (toate
> verzi). QA-ul live al părților autentificate rămâne pentru Andrei (checklist furnizat). DEPLOYED: hosting + rules.

**2026-06-16 - Task Completed — LP Studio slice 1: 7 blocuri noi în builder**
> Model: Claude Opus 4.8 (1M context)
> Prima felie din dezvoltarea LP Studio (Andrei a ales 4 direcții; le luăm pe rând). 7 tipuri noi de bloc
> în builder-ul vizual: **pricing, stats, logos, gallery (grid|carusel CSS), accordion (`<details>`),
> countdown, video (YouTube/Vimeo)**. Pattern data-driven: `LP_BLOCK_TYPES` + `defaultBlockProps` +
> `compileBlock` (lpBlocks.ts) + `BLOCK_FIELDS` (LpVisualBuilder, renderField generic) + i18n `bt_*`/`bf_*` + teste.
> - **Securitate (paginile se servesc public):** tot textul prin `esc()`/`escAttr()`; imagini `SAFE_URL`
>   (https-only); CTA `safeHref`; **video** = `ytVimeoEmbed` extrage DOAR id din charset restrâns →
>   src ALLOWLIST (youtube-nocookie/vimeo), provider necunoscut → omis; **countdown** = `<script>` inline
>   cu INTEGER embed (`var t=<ms>`) + `JSON.stringify` pe id/text (anti `</script>` breakout, dublă protecție).
> - **Fără modificări de functions:** CSP serveLp deja are `frame-src https:` (iframe video) + `script-src
>   'unsafe-inline'` (countdown), deci slice = DOAR client.
> **Review adversarial (1 agent):** ZERO vulnerabilități reale (countdown breakout apărat corect; ytVimeoEmbed
> sigur; escaping consecvent); doar NIT a11y. Verificat: 9/9 suites (+9 teste de blocuri) + e2e + build:site
> (app.html) + boot-smoke. DEPLOYED: hosting + rules. Următoarele felii LP: #58 SEO/social, #59 conversie/
> formulare, #60 A/B testing.

**2026-06-16 - Task Completed — LP Studio slice 2: SEO & social sharing (og:image/Twitter/favicon)**
> Model: Claude Opus 4.8 (1M context)
> Slice 2 din dezvoltarea LP Studio. `composeLpPage` (serveLp) emitea deja title/description/og:title/
> og:description/og:url + canonical; am adăugat **og:image + twitter:card(+title/description/image) + favicon**
> → card vizual frumos la share (FB/WhatsApp/LinkedIn). Plus fix gap: `seoDescription` n-avea input în editor.
> - **landingPage.ts**: câmpuri `ogImage`/`favicon` (≤500) + coerce `SAFE_HTTPS` (https-only → altfel '').
> - **serveLp**: injectează meta-urile DOAR pentru URL-uri https (`LP_SAFE_IMG`) + escapate (`lpEscape`);
>   twitter:card = summary_large_image dacă există og:image, altfel summary. Fără modificări CSP (img-src https: deja ok).
> - **LpEditor**: rând SEO (seoDescription + ogImage + favicon) + payload. **firestore.rules**: validare
>   optional-if-present pe ogImage/favicon (anti-bloat). i18n ro+en.
> **Securitate (head public, URL-uri user):** dublă protecție — https-only la coerce ȘI la serve + escaping
> în atribut; tested. Review: manual (suprafață mică, oglindă a pattern-ului og:* deja în prod). Verificat:
> 9/9 suites (+coerce) + e2e (og:image/twitter/favicon prezent + caz negativ non-https omis) + build:site
> (app.html) + boot-smoke. DEPLOYED: functions + hosting + rules. QA: testează cardul cu opengraph.xyz.

**2026-06-16 - Task Completed — LP Studio slice 3a: formulare avansate (honeypot + redirect + câmpuri noi)**
> Model: Claude Opus 4.8 (1M context)
> Prima sub-felie din #59 (conversie & formulare). Trei lucruri care ating același flux `form`→`/p/_submit`:
> - **Honeypot anti-spam**: `compileBlock` (cazul form) injectează un input ascuns off-screen `name="lp_hp_url"`
>   (`left:-9999px`, `tabindex=-1`, `aria-hidden`, `autocomplete=off`). `handleSubmit`: dacă e completat → bot →
>   **fake-success** `200 {ok:true}` FĂRĂ nicio scriere (submission/lead/stats/variants sărite). Const partajat
>   `LP_HP_FIELD='lp_hp_url'` (TS+JS). Gardă: `coerceField` ELIMINĂ un câmp real numit `lp_hp_url` (altfel ar
>   coincide cu capcana și ar înghiți TOATE trimiterile legitime — pierdere silențioasă de lead-uri).
> - **Redirect după trimitere**: `LpFormConfig.redirectUrl` (≤500, https-only la coerce `SAFE_HTTPS`). `handleSubmit`
>   întoarce `{ok:true, redirectUrl}` doar dacă trece `LP_SAFE_IMG` (https); scriptul de form navighează
>   `location.href` după ~1.2s (cu re-check https client-side). Sursa = doc, niciodată body-ul clientului.
> - **Tipuri noi de câmp**: `number`, `date`, `radio`. radio capătă `options` (ca select) → grup `<fieldset>` de
>   radio; number/date = `<input type=...>`. UI: dropdown + input opțiuni pt radio + input redirectUrl + notă honeypot.
> **Securitate (review adversarial 1 agent):** redirect doar https pe ambele capete (server+client) — `javascript:`/
>   `data:`/`http:`/protocol-relative/whitespace toate cad pe `^https://`; escaping pe radio (name/value/label);
>   paritate TS↔JS (LP_HP_FIELD identic, SAFE_HTTPS≡LP_SAFE_IMG). Finding MEDIUM (coliziune nume honeypot) → fixat
>   în coerceField + test regresie. Open-redirect spre orice https = by-design (redirect spre pagina clientului).
> Fără modificări `firestore.rules` (`form` e map admin-only, nevalidat granular). Verificat: 9/9 suites (+7 teste
> pure noi: câmpuri/radio-options/redirect coerce/honeypot markup/nume rezervat) + e2e (honeypot fără scriere,
> redirectUrl https returnat, non-https omis) + build + build:site (app.html) + boot-smoke. DEPLOYED: functions +
> hosting. #59 rămâne deschis pt. 3b (sticky CTA + exit-popup). QA Andrei: formular cu redirect → submit → pagina
> de mulțumire; câmp date/radio randate; trimitere normală tot creează lead.

**2026-06-16 - Task Completed — „Self Marketing" Slice 1: generator AI de strategie self-serve (client-facing)**
> Model: Claude Opus 4.8 (1M context)
> Andrei a studiat competitorul AI Marketing Explorer și a cerut un sistem prin care AI-ul propune clienților o
> strategie de marketing amplă, cu mai multe unghiuri/direcții, pe baza datelor lor. Felia 1 e o verticală completă:
> tab public „Self Marketing" (lângă Pachete/Contact) → pagină explicativă → login client → funnel ghidat în pași
> (Profil firmă → Oportunități → Strategie → Detalii → Execuție), cu Profil + Strategie funcționale, restul „în curând".
> **DECIZIA-CHEIE:** primul callable AI accesibil clienților NON-ADMIN (`selfGenerateStrategy`) — până acum tot AI-ul
> era operator-only (pivotul self-serve era amânat). Deschis CONTROLAT (monetizarea pe credite rămâne amânată; doar trial gratuit).
> - **functions/index.js**: `selfGenerateStrategy` (auth obligatoriu, fără admin-gate) → strategie cu 3-4 direcții
>   (overview + per direcție: poziționare/segment/canale/mesaje/idei/KPI), `STRATEGY_SCHEMA` + `buildStrategyPrompt` +
>   `coerceSelfProfileServer` (pure, exportate, paritate cu TS). Quotă de trial per-client `consumeSelfQuota`
>   (5 lifetime + 2/zi, doc `clients/{uid}/selfMarketing/quota`, SEPARAT de aiUsage operatori).
> - **src/types/selfMarketing.ts** (NOU): `SelfCompanyProfile` + `SelfStrategy` + `SelfQuota` + coerce + `validateSelfProfile` (pur).
> - **Frontend**: `src/site/SelfMarketing.tsx` (explicativ) + nav + publicRoutes + prerender; `src/app/SelfMarketingFunnel.tsx`
>   + `SelfStepper.tsx` + `SelfProfileFields.tsx` (Firma/Ofertă/Piață/Obiective + draft autosave). i18n ro+en complet.
> - **firestore.rules**: `clients/{uid}/selfMarketing/{docId}` — client scrie doar `profile` (whitelist + plafoane pe TOATE
>   câmpurile + schema + updatedAt); `strategy`/`quota` server-only, client-read; izolare pe uid.
> **Review adversarial (workflow 3 lentile: cost/abuz, injecție/izolare, auth/reguli/paritate):** 0 CRITICAL. Remediate:
> HIGH (account-farming fără plafon) → adăugat **plafon GLOBAL/zi** `SELF_GLOBAL_DAILY_CAP=80` (backstop absolut de cost,
> nerestituit); MEDIUM (quotă nerestituită la eșec model) → `refundSelfQuota` pe refuz/neparsabil/eroare API (global rămâne
> backstop); MEDIUM (plafoane reguli incomplete) → completat caps pe toate cele 8 câmpuri + industry/locale; LOW (paritate
> industry allowlist + industry='other' cere industryOther) → aliniat server cu TS; NIT injecție → notă „secțiunile sunt date".
> Recomandare hardening viitor (în DEVLOG): App Check (VITE_RECAPTCHA_V3_KEY + enforceAppCheck) + email-verified gate.
> Verificat: 10/10 suites (+test-self-marketing) + e2e TEST Q (prompt/schema/coerce/allowlist) + build (paritate i18n) +
> build:site (/self-marketing ×{ro,en} + app.html) + boot. DEPLOYED: functions + hosting + rules; live 200 pe /self-marketing
> (ro+en), /app/self-marketing, /admin. QA Andrei: tab → explicativ → login → completez profil → strategie cu direcții.
> Felii următoare: 2 Oportunități (reuse aiRecommendChannels), 3 Detalii, 4 Execuție (PDF+istoric), 5 Credite. Workstream B
> separat: LP Studio → design pagini publice.

**2026-06-16 - Task Completed — Login/logout în antetul public + pagină de pachete Self Marketing**
> Model: Claude Opus 4.8 (1M context)
> Cerere Andrei (dataread.ro e live): (1) login/logout pe orice pagină publică, (2) acces la /admin doar pentru
> admini, (3) o pagină de pachete DIFERITĂ pentru Self Marketing, accesibilă din pagina Self Marketing.
> - **Auth în antet** (`SiteLayout`): controale conștiente de sesiune — delogat → „Autentificare" (→ /app, unde e
>   AuthPanel); logat → „Cont" (→ /app) + „Ieși" (signOutUser) + „Admin" (→ /admin) DOAR dacă e admin. Claim-ul
>   `admin` e rezolvat acum în `useAuthInit` (`getIdTokenResult`) și ținut în `authStore` (`isAdmin`). Gardul real
>   de acces rămâne în AdminHome + rules (non-adminii primesc ecranul de cerere acces); linkul e doar afișare.
> - **Pachete Self Marketing** (`src/site/SelfMarketingPackages.tsx`, rută `/self-marketing/pachete`): model self-serve
>   pe CREDITE (o explorare AI = 1 credit), DISTINCT de pachetele de agenție (/pachete). 3 pachete (Starter/Business/
>   Professional) cu prețuri+credite PROVIZORII (mirror competitor: 19/79/249 LEI, +10/50/200) — Andrei le rafinează.
>   Plățile sunt dezactivate → CTA „Începe gratuit" → trialul (`/app/self-marketing`) + notă explicită. Linkul „Vezi
>   pachetele" din pagina Self Marketing duce acum aici (nu la /pachete agenție). Prerandat ro+en.
> i18n ro+en (nav.account/admin/login/logout, seo.selfPackages*, bloc selfPackages). Verificat: 10/10 suites + build
> (paritate i18n) + build:site (16 pagini, /self-marketing/pachete ×{ro,en} + app.html) + boot. DEPLOYED: hosting;
> live 200 pe /self-marketing/pachete (ro+en), antet cu „Autentificare". Felie viitoare: prețuri/servicii finale +
> activare credite (Slice 5 monetizare).

**2026-06-16 - Task Completed — Sprint din audit: conversie Self Marketing + plasă de siguranță cod + pas Detalii**
> Model: Claude Opus 4.8 (1M context)
> După un audit pe 5 dimensiuni (workflow), Andrei a ales 4 seturi. Set 1 (securitate+canonical) e livrat separat.
> Aici Set 2 (conversie) + Set 3 (cod) + Set 4 (Detalii):
> - **Conversie (#6/#7/#9):** Self Marketing acum vizibil — CTA în hero Landing + card în portal /app (era îngropat
>   într-un nav item, zero link în /app). Export pe strategie & detalii: butoane „Copiază tot" + „📄 PDF" (reuse
>   `printDoc.ts`, text AI escapat). Quotă fără fundătură: la trial epuizat (lifetime) → CTA spre /self-marketing/
>   pachete; plafonul zilnic distins de cel lifetime („revino mâine" vs „ia credite").
> - **Cod (#10/#5/#11/#13):** helper partajat `runAiJson()` + `assertAuth`/`assertAdmin` (anti-drift pe apelul
>   model/refuz/parse) — aplicat pe `selfGenerateStrategy` + `aiRecommendChannels` (restul 4 callable-uri AI rămân
>   de convertit într-o felie dedicată). Quota self (`consumeSelfQuota`/`consumeGlobalSelfQuota`/`refundSelfQuota`)
>   acceptă `db` injectabil → testate tranzacțional pe Firestore în memorie (TEST R: lifetime/daily/global/refund).
>   Paritate TS↔JS pe constante (TEST Q2: limits/allowlist/quota) — drift = test roșu. CI rulează acum `test:e2e-lp`.
> - **Detalii (#8):** callable `selfGenerateDetails({directionIndex})` (client-facing, quotă self, refund) →
>   aprofundează o direcție aleasă din strategie (buget/public/mesaje/funnel/brief/calendar) cu `DETAILS_SCHEMA`;
>   tipuri `SelfDetails`+coerce; pas „Detalii" funcțional în funnel (selector direcție + generare + export). Pașii
>   Oportunități/Execuție rămân „în curând".
> **Review adversarial (functions):** CLEAN — paritate runAiJson, refund corect (per-client restituit la orice eșec,
> global rămâne backstop), selfGenerateDetails fără bypass quotă/index, fără referințe moarte. Verificat: 10/10 suites
> (+coerce detalii) + e2e (TEST Q2 paritate, TEST R quota, Detalii prompt/schema) + build (paritate i18n ro/en) +
> build:site (16 pagini) + boot. DEPLOYED: functions + hosting (Set 1 a livrat deja rules + canonical).
> **Rămâne (necesită Andrei/GCP):** App Check (VITE_RECAPTCHA_V3_KEY + enforceAppCheck) + email-verified gate, buget
> GCP + maxInstances pe funcții + alert pe erori AI, Firestore PITR/backup, rotație ANTHROPIC_API_KEY; plus conversia
> celor 4 callable-uri AI rămase la runAiJson + viewer errorReports + split bundle firebase/admin (felii viitoare).

**2026-06-16 - Task Completed — Workstream B1: tema publică (LP Studio) pe site + panou „Site" în /admin**
> Model: Claude Opus 4.8 (1M context)
> Andrei: sistemul de design LP Studio să controleze designul paginilor publice, dintr-un panou „Site" în /admin
> (extensibil — urmează CMS de pagini). Paginile publice sunt PRERANDATE → aplicare HIBRIDĂ aleasă (snapshot copt +
> runtime), ca să nu existe flash/hydration drift.
> - **Aplicare**: `src/config/publicTheme.ts` = snapshot commit-uit (init = culorile bannerului → zero schimbare
>   vizuală). `usePublicTheme()` pornește SINCRON din snapshot (== prerender) + citește o dată tema publicată din
>   `siteConfig/publicTheme` (getDoc, NU listener — un listener persistent bloca `networkidle` la prerender; plus
>   guard `navigator.webdriver` → fără rețea sub Playwright). `SiteLayout` pune `customThemeStyle(theme)` INLINE pe
>   `.theme-banner` (bate variabilele din clasă) + `<PublicThemeStyle>` injectează în <head> CSS-ul de fonturi
>   (`customThemeCss`, idempotent + cleanup la unmount → zona /app|/admin neafectată). Stilizarea structurală a
>   bannerului rămâne. Verificat: CSS-ul temei e COPT în HTML-ul prerandat (fără flash).
> - **Date/reguli**: `src/types/sitePublic.ts` (`coerceToSitePublic`); `siteConfig/publicTheme` = public-read
>   (cosmetic) + admin-write validat (whitelist + schema + theme map + updatedAt). 
> - **Admin**: tab nou „Site" → `SiteAdminPanel` = `ThemeControls` (culori/fonturi/imagine) + preview live + „Salvează
>   & publică" → scrie Firestore. Placeholder „Pagini (LP Studio)" pentru B2.
> - **Coacere**: `scripts/pull-public-theme.mjs` citește tema via Firestore REST (public) și rescrie snapshot-ul;
>   best-effort (eroare → snapshot neschimbat); rulat manual înainte de deploy ca prima vizită să fie fără flash.
> - **Scope B1**: culori + fonturi + imagine de fundal (CSS, prerender-safe). **Decorul animat (canvas) e amânat la
>   B2**: `compileDecor` emite `<script>` care nu rulează prin innerHTML în SPA — decorul merge nativ pe paginile
>   servite de `serveLp` (CMS-ul de pagini din B2).
> Verificat: 11/11 suites (+test-sitepublic) + e2e + build (paritate i18n ro/en) + build:site (16 pagini, temă coaptă,
> zero pageerror) + boot. DEPLOYED: rules + hosting; live 200 pe / //self-marketing //admin, CSS temă servit.
> **B2 (următor)**: CMS de pagini pe LP Studio (creare/editare/ștergere + organizare meniu/SEO/vizibilitate, servite
> cu SSR prin serveLp + tema publică + decor).

**2026-06-16 - Task Completed — Workstream B2a: pagini de site pe LP Studio (CMS)**
> Model: Claude Opus 4.8 (1M context)
> Andrei: să poată crea/edita/șterge pagini de site cu LP Studio, servite SSR+SEO, temate cu tema publică (B1).
> Arhitectură: **reutilizăm `landingPages` cu `kind:'site'`** (zero colecție nouă) — refolosește serveLp/
> composeLpPage/lpThemeCss/LpEditor/reguli/analytics. URL `/pagina/{slug}`; o limbă per pagină.
> - **Tipuri**: `LandingPage.kind: 'campaign'|'site'` (default campaign) + `LP_KINDS` + coerce. **LpEditor payload
>   include acum `kind`** (altfel paginile de site s-ar salva ca 'campaign' și ar da 404 pe /pagina — gard critic).
> - **Servire** (`functions/index.js`): serveLp acceptă `/p/{slug}` (campanii) ȘI `/pagina/{slug}` (site). Separare
>   strictă: /pagina servește DOAR `kind:'site'` publicate; /p servește restul (campanii + legacy fără kind); kind
>   greșit → 404. Paginile de site primesc **tema publică** (`getPublicThemeDesign` citește `siteConfig/publicTheme`,
>   cache modul ~60s) ca `design`, deci sunt consistente cu site-ul; decorul per-pagină merge nativ (SSR). canonical
>   pe `/pagina/{slug}` (param `pathPrefix` în composeLpPage). `firebase.json`: rewrite nou `/pagina/** → serveLp`
>   (FĂRĂ pinTag — două rewrite-uri cu pinTag pe același Run service dau „Failed to replace Run service"; vezi memoria).
> - **Reguli**: `landingPages` validează opțional `kind in ['campaign','site']`.
> - **Admin**: `LandingStudio` are prop `kind` (filtrează lista/metrici/recompile pe acel tip, slug-unicitate rămâne
>   GLOBALĂ, URL /pagina pt. site, ascunde filtrele proiect/client). Panoul „Site" → secțiunea Pagini randează
>   `<LandingStudio kind="site" />` (CRUD complet cu LP Studio). 
> Verificat: 11/11 suites (+coerce kind) + e2e TEST S (/pagina servește site+separare, /p neschimbat) + build
> (paritate i18n) + build:site (16 pagini) + boot. DEPLOYED: functions + hosting + rules; live: /pagina/__nope__ →
> serveLp 404, /admin //self-marketing 200. Notă: în LpEditor tab-ul Design rămâne vizibil pt. site dar e ignorat la
> servire (tema publică primează) — ascunderea lui = polish ulterior.
> **B2b (următor)**: organizare în meniu (siteConfig/siteNav + snapshot hibrid + nav data-driven) + sitemap dinamic.

**2026-06-19 - Task Started — Workstream B2b: header/footer global + meniu data-driven**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „pornim b2b" — header/topbar + footer proiectate O SINGURĂ DATĂ în /admin, aplicate AUTOMAT pe TOATE
> paginile NOASTRE (paginile React + kind:'site' /pagina/), cu meniu data-driven. CRITIC: LP-urile de campanie
> (kind:'campaign', /p/) sunt pentru CLIENȚI — ZERO chrome global, ZERO temă publică. Editor = câmpuri structurate.

**2026-06-19 - Task Completed — Workstream B2b: header/footer global + meniu data-driven**
> Model: Claude Opus 4.8 (1M context)
> Chrome global (header/topbar + footer + meniu) proiectat o singură dată în panoul „Site" și aplicat automat pe
> tot site-ul NOSTRU; LP-urile de campanie (/p/) rămân neatinse (ale clienților). Tipar hibrid din B1 (snapshot
> copt + getDoc runtime + guard webdriver), etichete LITERALE per-limbă (ro+en; EN cade pe RO) — fără i18n în functions.
> - **Date/tipuri** (`src/types/siteChrome.ts` NOU): `SiteChrome` (brand, tagline ro/en, nav[], CTA, footer text
>   ro/en, footerLinks[]) + `coerceToSiteChrome` (default sigur, plafoane: ≤12 itemi, label 60/text 200/brand 40,
>   `internalHref` anti open-redirect — `/x` da, `//`/`http`/`javascript:` → '#') + `chromeLabel` (en||ro). Snapshot
>   copt `src/config/publicChrome.ts` (NOU) = chrome-ul actual → render sincron == prerender, fără flash.
> - **React** (`src/site/PublicChrome.tsx` NOU + `SiteLayout.tsx`): `usePublicChrome()` (clonă usePublicTheme).
>   Header/footer DATA-DRIVEN din chrome (brand/tagline/nav/CTA/footer); controalele FUNCȚIONALE rămân React
>   (comutator EN, login/Cont/Admin/Ieși, banner cookies).
> - **serveLp** (`functions/index.js`, DOAR kind:'site'): `getPublicChromeDesign(db)` (cache modul ~60s) +
>   `composeSiteChrome(chrome, lang)` → `{headerHtml, footerHtml}` SIGURE (lpEscape pe etichete, `chromeInternalHref`
>   + `localizePath` port al toLocalizedPath → prefix `/en`). `composeLpPage` primește param `chrome` (null pt.
>   campanii → NEATINS); injectează `${pageDecor}${header}${body}${footer}${scripts}`. `DEFAULT_SITE_CHROME` =
>   fallback când doc-ul lipsește (paritate TS↔JS testată e2e). serveLp: `chrome = isSite ? (getPublicChromeDesign||DEFAULT) : null`.
> - **Reguli**: `siteConfig/{docId}` generalizat la `docId in ['publicTheme','publicChrome']` (theme is map /
>   chrome is map per doc). Read public, write admin.
> - **Admin** (`src/admin/ChromeEditor.tsx` NOU + `SiteAdminPanel.tsx`): secțiune „Header & Footer" cu câmpuri
>   structurate (brand/tagline; listă nav cu add/remove/reordonare + label ro/en + href; CTA; footer text + linkuri)
>   + preview header/footer pe `customThemeStyle(theme)` comutabil RO/EN + „Salvează & publică" → `siteConfig/publicChrome`.
>   Script `scripts/pull-public-chrome.mjs` (NOU) coace snapshotul la deploy. i18n `admin.site.chrome.*` ro+en.
> Verificat: 12/12 suites (+ `test-sitechrome.ts`: coerce/internalHref/chromeLabel/plafoane) + e2e TEST T (chrome pe
> /pagina bilingv ro/en, href extern respins, paritate default TS↔JS, /p/ neatins) + build (paritate i18n) +
> build:site (16 pagini, fără flash) + boot. DEPLOYED: functions(serveLp) + hosting + rules; live: dataread.ro/
> servește header/footer din chrome (wordmark DataRead + footer). **B2c (amânat)**: sitemap dinamic /pagina; bilingv
> complet pe paginile de site; ascundere tab Design în LpEditor pt. kind:'site'.

**2026-06-19 - Task Started — Ingestie automată date campanii multi-platformă (Felia 0 + conector Meta)**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „există vreo metodă prin care putem centraliza datele unei campanii pe mai multe platforme și să
> înregistrăm datele automat din acele platforme?" → analiză multi-agent (cod + API-uri Meta/Google/TikTok +
> sinteză + critic) → Andrei a ales „Felia 0 + pregătesc conectorul Meta".

**2026-06-19 - Task Completed — Felia 0 (ingestie) + conector Meta dormant**
> Model: Claude Opus 4.8 (1M context)
> Centralizarea pe mai multe platforme era DEJA gata (campaigns/{id}.platform + metrics/{YYYY-MM-DD} cu source +
> motor KPI agnostic). Aici: fundația de ingestie automată (Felia 0, live) + primul conector (Meta, cod scris dar
> DORMANT până la verificările Meta ale lui Andrei).
> **Felia 0 (live):**
> - `clientUid` denormalizat pe campanie (`CampaignDef.clientUid`, `coerceToCampaign`) — leagă campania de cont
>   pentru reguli multi-tenant + jobul de ingestie. Scris la create (din lead) + trigger nou **`onLeadWrite`**
>   (propagă clientUid pe campaniile lead-ului la conectare/reconectare/deconectare). REPARĂ mismatch-ul real:
>   regulile cereau `campaigns.clientUid` dar nu se scria niciodată.
> - **Import CSV** în Marketing Center (`src/utils/metricsCsv.ts` — parser pur tolerant: alias-uri antet ro/en,
>   delimitator `;`/`,`, numere ro/en, upsert pe dată, dată invalidă sărită; testat). Operatorul exportă din Ads
>   Manager → încarcă. Plafon valoric `MAX_METRIC_VALUE` în `coerceToDailyMetric` (anti intrare absurdă).
> - Schema credențiale `clients/{uid}/platformCredentials/{platform}` (`src/types/platformCredentials.ts`) +
>   reguli: **read admin-only, write false** (token-ul NU ajunge la client; scris doar de Admin SDK).
> **Conector Meta (cod scris, DORMANT — `CONNECTORS_ENABLED=false` → nu e exportat → deploy NU cere secretele Meta;
> tipar „integrare opțională" ca AI_ENABLED):**
> - PUR + testat: `functions/connectors/meta.js` (mapMetaInsight/mapMetaInsightsResponse/buildMetaInsightsUrl —
>   lead din action_types lead, revenue din purchase), `functions/lib/tokenCrypto.js` (AES-256-GCM, cheie ca param),
>   `runMetaPull` (nucleu de ingestie injectabil: db+fetch+cheie; upsert source:'meta', needs_reconnect pe 401,
>   per-tenant izolat), `insightsWindow` (fereastră glisantă).
> - DORMANT (gated): `initiateMetaOAuth`/`metaOAuthCallback`/`disconnectPlatform` (admin-gated, state TTL anti-CSRF,
>   token criptat) + `pullMetaInsights` (`onSchedule` 05:00 Europe/Bucharest). Activare: secrete META_APP_ID/SECRET +
>   TOKEN_ENC_KEY → flag true → deploy. Pași în `docs/CONNECTORS-ADS-API.md`.
> Verificat: 13/13 suites (+ `test-connectors.ts`: CSV ro/en, credențiale, clientUid, plafoane) + e2e TEST U
> (mapare Meta, crypto round-trip/tamper, runMetaPull cu store+fetch fals: upsert source:meta, needs_reconnect,
> skip, filtru platform) + build + build:site (16 pagini) + boot. DEPLOYED: functions (onLeadWrite nou + restul) +
> hosting + rules. **PENDING Andrei (calea critică, săptămâni):** Meta Business Verification + App Review (ads_read)
> + secrete + flip flag. **Felia 2 (viitor):** Google Ads; trigger incremental totals; backfill istoric; UI conectare.

**2026-06-19 - Task Completed — Conectori Google Ads + TikTok (dormant) + motor generic de ingestie**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „nu pot să particip la pasul următor încă, așa că fă tu ce poți singur" (Andrei nu poate face verificările
> Meta acum). Am dus mai departe ce se poate face + verifica fără dependențe externe: am completat ingestia
> multi-platformă cu Google Ads + TikTok și am unificat orchestrarea.
> - **Motor generic** `runConnectorPull(db, {platform, fetchRows, encKey, ...})` în `functions/index.js` — UN
>   singur nucleu pentru toate platformele (upsert source:platform idempotent, recalcul totals, needs_reconnect pe
>   400/401/403, izolare per tenant). `runMetaPull` devine wrapper subțire (back-compat, e2e TEST U neschimbat).
> - **Google Ads** (`functions/connectors/google.js`): `mapGoogleAdsRow` (CAPCANĂ: **cost_micros/1e6**),
>   `mapGoogleAdsResponse` (searchStream = array de batch-uri), `buildGoogleAdsQuery` (GAQL, campaign.id sanitizat
>   anti-injecție). **TikTok** (`functions/connectors/tiktok.js`): `mapTikTokRow` (stat_time_day→date, conversion→
>   leads, payment→revenue), `mapTikTokResponse`, `buildTikTokReportUrl`.
> - **Flag PER PLATFORMĂ** (`META_ENABLED`/`GOOGLE_ENABLED`/`TIKTOK_ENABLED`, toate false) — fiecare platformă se
>   activează independent, fără să ceară secretele celorlalte la deploy. OAuth + scheduler per platformă (dormant):
>   initiate*OAuth / *OAuthCallback / pull*Insights; `disconnectPlatform` comună; helpers OAuth partajați (state TTL anti-CSRF).
> Verificat: 13/13 suites + e2e TEST U EXTINS (mapGoogleAdsRow cost_micros/1e6, snake/camelCase, searchStream;
> buildGoogleAdsQuery anti-injecție; mapTikTokRow; runConnectorPull google→source:google + tiktok 401→needs_reconnect)
> + build + build:site (16 pagini) + boot. DEPLOYED: functions (toate dormante → fără secrete). docs/CONNECTORS-ADS-API.md
> actualizat (pași activare per platformă). **PENDING Andrei (la fel):** verificările per platformă + secrete + flip flag.

**2026-06-19 - Task Completed — Defalcare KPI pe platformă (vizualizare multi-platformă)**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „continuă cu ce poți singur" — am livrat plata vizibilă a centralizării multi-platformă, folosind datele
> pe care operatorii le au DEJA (manual + CSV), fără dependență de conectori.
> - `kpisByPlatform(items)` PUR în `src/analytics/kpi.ts` (grupează campaniile pe platformă → KPI per platformă,
>   ordinea PLATFORMS, agnostic de sursă) + teste în `scripts/test-analytics.ts`.
> - `PlatformBreakdown` în Marketing Center: tabel Meta/Google/TikTok side-by-side (campanii/spend/revenue/ROAS/
>   leads/CPL), în view-ul pe client (imaginea cross-platformă a unui client) ȘI sub agregatul global. Ascuns când
>   e o singură platformă (agregatul deja o arată).
> Verificat: 13/13 suites (+ byPlatform) + build (paritate i18n) + build:site (16 pagini) + boot. DEPLOYED: hosting + rules.

**2026-06-19 - Task Completed — Export consolidat multi-platformă (CSV + PDF)**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „continuă cu ce poți singur". Defalcarea pe platformă devine deliverable: butoane CSV (valori brute,
> utilizabile în Excel) + PDF (o linie/platformă, brandat) pe `PlatformBreakdown`, în view-ul pe client (cu numele
> clientului în titlu/fișier) ȘI sub agregatul global. Refolosește `toCsv` (anti formula-injection) +
> `composePrintHtml`/`printHtmlDoc` existente. Verificat: 13/13 suites + build + build:site (16 pagini) + boot.
> DEPLOYED: hosting + rules.

**2026-06-19 - Task Completed — Istoric versiuni livrabile în portalul client (read-only) [#51]**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „continuă cu punctul 2" → task din backlog independent de Andrei. Backendul de versiuni
> (`leads/{id}/requests/{reqId}/versions`) exista deja (snapshot la regenerare); clientul nu-l vedea.
> - **Oglindă client-safe** (același tipar ca livrabilele): trigger nou `onRequestVersionCreated`
>   (onDocumentCreated) oglindește DOAR câmpurile CLIENT_SAFE_DELIVERABLES din fiecare versiune sub
>   `clients/{uid}/deliverables/{reqId}/versions/{vid}` — versiunile brute conțin starea anterioară COMPLETĂ
>   (inclusiv note interne), deci NU se citesc direct. clientUid vine din cererea-părinte.
> - **Anti-drift:** filtrul client-safe extras în `clientSafeDeliverables` (folosit ȘI de onRequestWrite ȘI de
>   noul trigger). **Privacy pe reatribuire:** `deleteVersionsMirror` șterge subcolecția de versiuni când
>   onRequestWrite șterge oglinda de livrabil (subcolecțiile nu cad automat la ștergerea doc-ului).
> - **Reguli:** `clients/{uid}/deliverables/{reqId}/versions/{vid}` read owner+admin, write false (Admin SDK).
> - **UI:** expander „Istoric versiuni" per livrabil în portalul `/app` (`VersionHistory`, încărcare leneșă
>   getDocs ordonat după snapshotAt desc, read-only). i18n `appHome.versions*` ro+en.
> Verificat: 13/13 suites + e2e TEST V (clientSafeDeliverables: păstrează safe, elimină note interne/goale/gunoi)
> + build + build:site (16 pagini) + boot. DEPLOYED: functions (onRequestVersionCreated nou) + hosting + rules.

**2026-06-19 - Task Completed — LP conversie slice 3b: Sticky CTA + Exit-intent popup [#59 parțial]**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „59" → din #59 (conversie & formulare avansate) am livrat cele două nudge-uri la nivel de pagină
> (câmpuri/redirect/anti-spam erau deja în slice 3a). Multi-step form rămâne pasul următor al #59.
> - **Model + compilator** (`src/types/landingPage.ts` + `lpBlocks.ts`): `LpConversion` (stickyCta + exitPopup)
>   + `coerceConversion` (plafoane, href brut) + `compileConversion` PUR → markup self-contained (sticky bar fixă
>   `position:fixed` + modal exit-intent `#lp-exit` + script). Text ESCAPAT, href validat (`safeHref`), scriptul NU
>   interpolează date de utilizator. Compilat în `conversionHtml` (ca pageDecorHtml), injectat de serveLp în body.
> - **safeHref extins:** acum permite ancore pe pagină (`#sectiune`) — sigure (fragment), necesare pentru CTA-uri
>   „scroll la formular". Înainte orice `#xxx` ≠ `#` cădea pe `#` (beneficiază TOATE blocurile).
> - **Editor:** tab nou „🎯 Conversie" (`LpConversionPanel`, câmpuri structurate) + preview live include conversionHtml
>   + gardă de mărime include conversionHtml. **Reguli:** `conversionHtml` opțional, plafonat (anti-bloat).
> - i18n `admin.lpStudio.conv*` ro+en.
> Verificat: 13/13 suites (test-landing: coerce + compileConversion: escape/safeHref/anchor/popup/disabled) + e2e
> TEST A extins (serveLp injectează sticky + exit popup) + build + build:site (16 pagini) + boot. DEPLOYED:
> functions (serveLp) + hosting + rules. **RĂMAS în #59:** multi-step form (câmpuri pe pași + navigare next/back).

**2026-06-19 - Task Completed — LP multi-step form → #59 ÎNCHIS COMPLET**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „continua 59" → ultima piesă din #59 (conversie & formulare avansate): formular pe pași.
> - **Model:** `LpFormField.step` (0-based, clamp 0..LP_FORM_STEPS_MAX-1) + `LpFormConfig.multiStep` + coerce.
> - **Compilator** (`lpBlocks.ts`): blocul `form` grupează câmpurile pe `step` (doar pașii cu ≥1 câmp); sub 2
>   grupuri → formular plat (fallback). Render pe pași (`data-lp-step`, display none/block) + rând nav
>   Înapoi/Înainte/Trimite + indicator „Pasul X din N" + script inline de navigare cu **validare per pas**
>   (`checkValidity`/`reportValidity` pe câmpurile pasului curent înainte de avans). `compileBlocks` primește
>   acum `lang` (etichete nav ro/en); submit-ul rămâne unul singur (toate câmpurile în DOM, ascunse) → handler-ul
>   serveLp neschimbat.
> - **Editor** (`LpFormConfig.tsx`): toggle „Formular pe pași" + selector „Pas" per câmp (când e activ). i18n ro+en.
> Verificat: 13/13 suites (coerce step/multiStep + compileBlocks: 2 pași/nav/script/ro+en/fallback plat) + e2e +
> build + build:site (16 pagini) + boot. DEPLOYED: hosting. **#59 COMPLET** (câmpuri+redirect+anti-spam 3a · sticky
> CTA+exit popup 3b · multi-step acum). Notă: navigarea pe pași nu rulează în preview-ul sandbox (scripturi
> dezactivate) — se vede pasul 1; funcționează pe pagina servită.

**2026-06-19 - Task în lucru — A/B testing LP, felia 1+2 (model + motor câștigător) [#60]**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „ok, 60" → A/B testing pe LP. Design printr-un workflow (hartă cod + 3 abordări + sinteză + critic
> adversarial); ales „A/B pe sloturi" (un bloc `experiment` ocupă o poziție; pagina are placeholdere
> `<!--LP_EXP:id-->`; serveLp substituie varianta aleasă). Critica a impus: z-test (nu doar uplift), prag pe
> conversii, plafon armsHtml în reguli, cookie HMAC Node-only, motor câștigător în fișier separat.
> **Felia 1 (model/compile/coerce, pur):** `LpExperiment`/`LpExpArm` + tip bloc `experiment` (emite placeholder
> ne-injectabil, expId sanitizat [a-z0-9-]) + coerce (dedup id-uri, clamp weight 1..100/minSample≥30/nr.
> experimente≤3/arme≤4, <2 arme→status off, winnerArm validat, armsHtml păstrează doar perechi existente).
> `recompileLpAssets` emite `armsHtml[exp][arm]` (fiecare arm.blocks prin ACELAȘI compileBlocks) + `html` cu
> placeholdere; `lpServedByteSize` (garda 200KB = html+toate armele+decor+conversie). LpEditor persistă
> experiments/armsHtml + folosește noua gardă. Reguli: experiments listă≤3 + armsHtml map (byte-sum rămâne în editor).
> **Felia 2 (motor câștigător, pur, `src/analytics/lpABWinner.ts` — fișier separat, NU atinge lpStats.ts):**
> `pickAbWinner` cu **z-test pe două proporții** (CDF normal via erf, fără deps) la α=0.05 + prag minSample vizite →
> verdict insufficient/no-difference/winner; `leaderId` doar pt. afișaj (nu acționabil → anti-peeking).
> Verificat: 14/14 suites (+ `test-ab.ts`: z-test, fals-pozitiv pe sample mic respins; + exp coerce/compile/size în
> test-landing) + e2e + build + build:site (16 pagini) + boot. DEPLOYED: hosting + rules (zero efect runtime — fără
> UI încă, experiments rămâne []). **RĂMAS #60:** Felia 3 (serveLp split + sticky cookie HMAC + abStats) · Felia 4
> (reguli abStats scoped) · Felia 5 (UI: editor experimente + panou rezultate).

**2026-06-19 - Task în lucru — A/B testing LP, felia 3+4 (serveLp split + abStats + reguli) [#60]**
> Model: Claude Opus 4.8 (1M context)
> Runtime-ul A/B în serveLp (functions/index.js, JS pur testat în e2e). Decizie: FĂRĂ HMAC în v1 (ar lega serveLp
> de secretul LP_AB_SECRET, indisponibil → ar bloca deploy-ul); cookie-ul validează arm-ul ∈ armele reale; tamper =
> mutarea propriei conversii între arme valide = neglijabil. HMAC = hardening ulterior.
> - Helpers puri: `parseAbCookie`/`abWeightedPick`/`pickAbAssignment`/`applyArms`/`serializeAbCookie`. Selecție per
>   slot: winner promovat→100% (fără cookie/contor); off/stopped→control; running→sticky-cookie sau split ponderat;
>   boții→control fără contor (nu poluează eșantionul). O singură dată/request → consistență vizită↔contor.
> - serveLp: cookie sticky `lpab_{slug}` (Path=/p, SameSite=Lax, Secure), `applyArms` înlocuiește placeholderele,
>   contor vizite în `landingPages/{slug}/abStats/{expId__armId}` (în batch-ul existent). handleSubmit atribuie
>   conversia variantei din cookie (∈ arme) sau `__unattributed`. NON-REGRESIE: LP fără experimente → assign gol →
>   zero cookie/contor, applyArms no-op → output identic.
> - Reguli: `abStats/{key}` read scoped (admin || get(parent).clientUid==uid) + write false (ca stats/variants).
> Verificat: 14/14 suites + e2e TEST W (helpers + serveLp split/sticky/bot/winner/submit-atribuit/__unattributed,
> 24 verificări) + build + build:site + boot. DEPLOYED: functions(serveLp) + rules. **RĂMAS #60:** Felia 5 — UI
> (editor experimente: slot+arme+clonă+weight+status; panou rezultate cu `pickAbWinner` + „Promovează câștigătorul").

**2026-06-19 - Task Completed — A/B testing LP, felia 5 (UI) → #60 ÎNCHIS COMPLET**
> Model: Claude Opus 4.8 (1M context)
> UI-ul de A/B, ultima felie din #60.
> - **Editor** (`LpExperimentsPanel`, tab nou „🧪 A/B" în LpEditor): definește experimente (nume/status/minSample/
>   expId) + variante (etichetă/pondere + „Editează conținut" = builder-ul de blocuri REUTILIZAT per variantă;
>   „Adaugă variantă" clonează controlul) + „Adaugă slot în pagină" (inserează blocul `experiment` în vizual sau
>   placeholderul în cod). Blocul `experiment` are câmp expId în builder.
> - **Rezultate** (`LpAbResults`, în LpAnalytics): citește experimentele de pe doc + `abStats`, calculează verdictul
>   cu `pickAbWinner` (z-test); tabel variante (vizite/conversii/rată) + ⭐ câștigător + verdict + p-value.
>   „Promovează câștigătorul" (DOAR la verdict statistic — anti-peeking) scrie `winnerArm`+`status:stopped` →
>   serveLp servește 100%. Hint anti-peeking la sample insuficient.
> - i18n `admin.lpStudio.ab*`/`bt_experiment`/`bf_expId` ro+en.
> Verificat: 14/14 suites + e2e + build (paritate i18n) + build:site (16 pagini) + boot. DEPLOYED: hosting.
> **#60 COMPLET:** model+coerce (f1) · motor câștigător z-test (f2) · serveLp split+sticky+abStats (f3) · reguli (f4)
> · UI editor+rezultate (f5). Backlog A/B v2: HMAC pe cookie (LP_AB_SECRET); backfill; auto-promovare programată.

**2026-06-19 - Task Completed — Conector Meta ACTIVAT (ingestie automată live)**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „ajută-mă cu Meta" → Andrei a creat app-ul Meta (App ID 1015855461036302, Facebook Login for Business)
> + a pus secretele în Secret Manager (META_APP_ID, META_APP_SECRET, TOKEN_ENC_KEY). Eu am activat:
> - `firebase.json`: rewrite `/api/meta/callback` → funcția `metaOAuthCallback` (gen-2, europe-central2), înainte de catch-all.
> - `functions/index.js`: `META_ENABLED = true` → exportate `initiateMetaOAuth`/`metaOAuthCallback`/`disconnectPlatform`/
>   `pullMetaInsights` (toate create la deploy; secretele s-au legat OK). serveLp/restul neschimbate.
> - **UI conectare** (`PlatformConnect`): buton „Conectează Meta" per client în Marketing Center (view pe client, când
>   lead-ul are clientUid) → `initiateMetaOAuth` → redirect Meta → callback stochează credențiala criptată; status
>   (conectat/reconectare/revocat) + reconectează/deconectează. i18n `admin.connectors.*` ro+en.
> Verificat: 14/14 suites + e2e (index.js încarcă cu flag on) + build (paritate i18n) + build:site + boot. DEPLOYED:
> functions (4 funcții Meta noi) + hosting (rewrite + UI) + rules. LIVE: `https://dataread.ro/api/meta/callback` → 400
> „parametri lipsă" (rewrite→funcție OK, nu 404). **RĂMAS pe Andrei (Meta dashboard):** confirmă Valid OAuth Redirect
> URIs = `https://dataread.ro/api/meta/callback` + App Domains `dataread.ro` (pași 2–3) → apoi testează conectarea pe
> contul propriu (development mode, fără App Review). Pentru clienți reali: Tech Provider + verificare (App Review ads_read).

**2026-06-20 - Task Completed — Toggle „Ingestie automată" per conexiune (pauză fără deconectare)**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „cred că cel mai bine ar fi să avem un toggle, care activează fluxul de date dinspre Meta." (preferat în
> locul unui buton „Trage acum"). Implementat un comutator PER CONEXIUNE care pornește/oprește fluxul de date FĂRĂ a
> deconecta (token-ul criptat rămâne, doar jobul zilnic e pus pe pauză):
> - `src/types/platformCredentials.ts`: câmp nou `ingestEnabled: boolean` (coerce default `true` — conexiunile vechi
>   rămân active). Token-ul NU e în tip (server-only).
> - `functions/index.js`: gate-ul din `runConnectorPull` sare conexiunea dacă `ingestEnabled === false` (alături de
>   lipsă/inactivă/fără token) → contorizată ca „skipped", status NEatins (nu needs_reconnect). `metaOAuthCallback`
>   scrie `ingestEnabled: true` la conectare. Callable nou admin-gated **`setPlatformIngest`** ({clientUid, platform,
>   enabled}) → merge pe `clients/{uid}/platformCredentials/{platform}`.
> - `src/admin/PlatformConnect.tsx`: comutator (pill verde PORNIT / gri OPRIT) lângă reconectează/deconectează,
>   optimist (revine la eroare). i18n `admin.connectors.ingestLabel/on/off` ro+en.
> Răspuns la a doua întrebare a lui Andrei („putem crea o campanie cap-coadă doar din admin, fără să intru în Meta?"):
> NU acum — conectorul e read-only (`ads_read`, doar ingestie). Crearea de campanii = fază viitoare separată
> (`ads_management` + builder de campanie + App Review pe alt scope). Notat în backlog.
> Verificat: 14/14 suites (+2 coerce ingestEnabled) + e2e (+3 aserțiuni „pe pauză → 0 procesate, fără metrică, status
> rămâne active") + build (paritate i18n) + build:site + boot — toate verzi. DEPLOYED: functions (`setPlatformIngest`
> creat + runConnectorPull/metaOAuthCallback actualizate) + hosting (UI toggle) + rules.

**2026-06-20 - Task Completed — Motor de automatizare, Felia 0 (fundație pură, dormantă, deploy-safe)**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „vreau să începem automatizarea" → la întrebarea de scope, Andrei: „toate". Decizie: NU 4 lucruri separate,
> ci UN motor `declanșatoare → condiții → acțiuni` pe care cele 4 verticale (workflows marketing / optimizare campanii /
> creare campanii / CRM) se montează ca module (principiul de modularitate + feature flags). Design fundamentat printr-un
> workflow multi-agent pe codul real (faza Understand a terminat: 4 hărți de hooks; fazele Design/Judge/Critique au fost
> blocate de o limită de sesiune → am făcut sinteza inline, cu garanțiile pe care le-ar fi cerut critica adversarială).
> **Felia 0 livrată (pură, dormantă):**
> - `src/types/automation.ts`: model `Automation` (schema:1) + enum-uri (9 declanșatoare, 8 operatori, 10 acțiuni cu
>   subset v1 sigur + acțiuni AI marcate) + `coerceToAutomation` unic (clamp/default/plafoane; `enabled` default OFF).
> - `src/automation/automationEngine.ts`: nucleu PUR — `applyOperator`/`evaluateConditions`(AND)/`matchesTrigger`(+izolare
>   scope client)/`buildIdempotencyKey`(anti-dublură)/`planActions`(anti-buclă pe `origin`)/`selectMatching`.
> - Port JS 1:1 în `functions/index.js` (dormant, `AUTOMATION_ENABLED=false`; doar funcții pure exportate, ZERO
>   triggere/endpoint-uri noi) + paritate TS↔JS testată e2e (TEST X, 13 aserțiuni).
> - `firestore.rules`: `automations/{id}` + `automations/{id}/runs/{runId}` — read admin SAU client-owner (scope:'client'),
>   write:false (mutații doar prin callable-uri în feliile următoare; runs = audit scris de motor).
> - Garanții băgate din start (anti fals-pozitiv adversarial): anti-buclă (origin + idempotency key + backstop runs/oră),
>   at-least-once dedupe (runs/{key} tranzacțional), cost AI mărginit de cotă, multi-tenant pe clientUid, deploy-safe (flag).
> Verificat: 15/15 suites (test-automation, 37 checks) + e2e TEST X + build (typecheck noile fișiere). DEPLOYED: doar
> firestore.rules (singura schimbare LIVE; functions = pure helpers dormante, deploy amânat la Felia 1 când cablez triggerele).
> **Felii următoare:** F1 optimizare pe datele conectori (onMetricWrite → praguri/insight → notificare + recomandare AI,
> flip flag); F2 builder UI (`AutomationsPanel`); F3 workflows lead; F4 email/SMS; F5 CRM client-scope; F6 publicare campanii.

**2026-06-20 - Task Completed — Motor de automatizare, Felia 1 (management reguli: callable-uri + builder UI)**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „continuă" → Felia 1 din planul de automatizare. Dependență logică rezolvată: regulile trebuie să poată fi
> CREATE înainte ca motorul să aibă ce executa, deci întâi management-ul.
> - `functions/index.js`: 3 callable-uri admin-gated (fără secrete, se exportă mereu — flag-ul gate-ază DOAR execuția
>   motorului, nu construirea regulilor): `saveAutomation` (coerce server-side + refuză acțiunile neimplementate încă —
>   email/sms/publish/webhook nu sunt în `AUTOMATION_ACTIONS_V1` — + cere clientUid la scope client; păstrează
>   createdBy/runCount/lastRunAt la editare), `deleteAutomation` (curăță și subcolecția `runs`, plafonat), `setAutomationEnabled`.
> - `src/admin/AutomationsPanel.tsx`: builder „dacă … atunci …" — nume + declanșator + scope(+clientUid) + condiții (field/op/
>   value, datalist sugestii) + acțiuni (tip din V1 + config minimal per tip: mesaj/status/titlu) + comutator activă; listă
>   cu toggle PORNITĂ/OPRITĂ + editează/șterge + #condiții/#acțiuni/#rulări. Mutații prin callable (automations e write:false).
> - `AdminHome.tsx`: tab nou „Automatizări" între Marketing și Landing — adăugat în AMBELE locuri (union + array nav, ca să
>   nu repet bug-ul „tab lipsă din nav"). i18n `admin.navAutomation` + `admin.automation.*` (trig/ops/act/cfg) ro+en paritate.
> Motorul rămâne dormant (`AUTOMATION_ENABLED=false`); regulile create acum vor începe să ruleze la flip-ul din Felia 2.
> Verificat: 15/15 suites + e2e (TEST X paritate) + build (typecheck panou + paritate i18n) + build:site + boot — toate verzi.
> DEPLOYED: functions (saveAutomation/deleteAutomation/setAutomationEnabled create) + hosting (tab) + rules.
> **Felia 2 (următoarea):** trigger `onMetricWrite` → eveniment campaign.metric_threshold/insight → executeAction
> (notify.operator + report.generate/campaign.recommend cu cotă) + dedupe `runs/{key}` + flip `AUTOMATION_ENABLED=true`.

**2026-06-20 - Task Completed — Motor de automatizare, Felia 2 (motor LIVE, notify-only)**
> Model: Claude Opus 4.8 (1M context)
> Prompt: „continuă" + decizie Andrei „Notify-only acum" (la întrebarea de scope a Feliei 2). Pornit motorul de
> execuție pe backend, cu acțiuni FĂRĂ cost extern (notify.operator); acțiunile cu AI (raport/recomandare auto) rămân
> pentru o felie viitoare, cu plafon, după confirmarea lui Andrei.
> - `functions/index.js`: `AUTOMATION_ENABLED=true`. `dispatchAutomationEvent(db,event,{nowMs})` — interoghează regulile
>   pornite (`where('enabled','==',true)`), filtrează prin nucleul pur `selectMatching` (trigger+scope+condiții+anti-buclă),
>   apoi pentru fiecare potrivire creează `automations/{id}/runs/{key}` cu **`.create()`** (eșuează dacă există ⇒ DEDUPE
>   at-least-once + anti-buclă) și execută acțiunile. `executeAutomationAction`: implementează DOAR `notify.operator`
>   (scrie `notifications/{key}__aN`); restul → `skipped` (felii viitoare). runCount/lastRunAt incrementate.
> - Triggere LIVE (gate-uite de flag): `onMetricWrite` (campaigns/{id}/metrics/{date} → eveniment
>   `campaign.metric_threshold` cu ctx: metric.spend/leads/cpl/roas/ctr + campaign.platform/aiInsight.verdict; stateHash =
>   data+valori ⇒ re-pull idempotent nu re-notifică) + `onCampaignAutomation` (campaigns/{id} → `campaign.insight` DOAR
>   când verdictul aiInsight se schimbă, ca recalculul de totals să nu declanșeze constant). Ambele fail-closed (nu aruncă).
> - `firestore.rules`: `notifications/{id}` read admin-only, write:false (scrise de motor). UI: secțiune „Notificări recente"
>   în `AutomationsPanel` (listener pe `notifications`, limit 20). i18n `admin.automation.notifTitle/notifEmpty` ro+en.
> Verificat: 15/15 suites + e2e TEST X (paritate, flag=true) + TEST Y (dispatch: notificare scrisă + dedupe prin
> runs.create + condiție neîndeplinită → nimic) + build + build:site + boot — toate verzi. DEPLOYED: functions
> (onMetricWrite + onCampaignAutomation create + dispatch) + hosting (UI notificări) + rules (notifications).
> **Cum se folosește:** /admin → Automatizări → Regulă nouă (ex. trigger „Prag metrică campanie", condiții
> metric.spend > 500 ȘI metric.leads = 0, acțiune „Notifică operatorul") → Activă. La următoarea scriere de metrică
> (manual/conector Meta) care îndeplinește condițiile → apare o notificare. **Felii rămase:** F3 workflows lead lifecycle
> (lead.* + executor set_status/task); F2b acțiuni AI cu plafon (report.generate/campaign.recommend); F4 email/SMS;
> F5 CRM client-scope; F6 publicare campanii.

**2026-06-20 - Task Completed — Motor de automatizare, Felia 2b (acțiuni AI guvernate: entitlement + bypass + plafon din Admin)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: automatizările AI sunt setate de agenție; disponibile DOAR clienților cu abonament/credite AI; vreau un
> BYPASS (checkmark) + plafonul AI să-l pot seta din Admin. Implementat guvernarea acțiunilor AI din automatizări:
> - `functions/index.js`: extras nucleele reutilizabile `performCampaignInsight`/`performClientReport` (anti-drift) din
>   callable-urile aiAnalyzeCampaign/aiClientReport (acum deleagă; cota per-operator se consumă prin callback DUPĂ validare,
>   înainte de model). Executorul motorului rulează acum `campaign.recommend`/`report.generate` cu: **poartă** pură
>   `automationAiAllowed(config,{aiEnabled,entitlementActive})` = AI activ ȘI (bypass admin SAU client cu entitlement activ);
>   **plafon** `consumeAutomationAiQuota(db,cap)` (tranzacție pe `aiUsage/__automationGlobal`, cap configurabil); rezultatul →
>   notificare (verdict/raport). Triggerele onMetricWrite/onCampaignAutomation primesc secrets:[ANTHROPIC_API_KEY] (când AI_ENABLED).
> - Config `appConfig/automation` (`src/types/automationConfig.ts`: aiDailyCap default 50, aiBypassEntitlement) — coerce unic +
>   reguli (read+write admin, validat) + UI card în AutomationsPanel (input plafon + checkbox bypass + salvează). Motorul îl
>   citește prin Admin SDK (`readAutomationConfig`, default sigur dacă lipsește).
> - i18n `admin.automation.cfg*` ro+en. Notă: `auto-pause` campanie tot indisponibil (ads_read, nu ads_management).
> Verificat: 15/15 suites (test-automation +6 config) + e2e TEST X (poarta AI +4) + TEST Y + build (typecheck + paritate i18n)
> + build:site + boot — toate verzi. DEPLOYED: functions (cores refactorizate + executori AI + triggere cu secret) + hosting
> (config UI) + rules (appConfig). **Cum funcționează:** o regulă cu acțiune „Recomandare AI"/„Generează raport" rulează doar
> dacă clientul campaniei are entitlement activ SAU e bifat bypass-ul, în limita plafonului zilnic setat din Admin.
> **Următor (ordinea cerută de Andrei):** F3 workflows lead lifecycle → apoi DOCUMENTAREA GHIDULUI (separat operator/admin vs
> client) ÎNAINTE de alte lucruri; F4 (email/SMS) amânat.

**2026-06-20 - Task Completed — Motor de automatizare, Felia 3 (workflows pe lead-uri)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „continuă cum am zis" → F3 din ordinea stabilită (workflows lead lifecycle).
> - `functions/index.js`: executori noi — `lead.set_status` (scrie status + marcaj `automationStamp`; valid doar pt.
>   declanșatoare pe lead; status ∈ new/contacted/won/lost) + `task.create` (scrie `tasks/{id}`). Triggere LIVE:
>   `onLeadAutomation` (leads/{id} → `lead.created` la create / `lead.status_changed` la schimbarea statusului) cu
>   **GARDĂ ANTI-BUCLĂ**: dacă scrierea vine de la motor (`automationStamp` schimbat) → origin='automation' ⇒ planActions
>   întoarce null (regulile NU reacționează la propriile scrieri). Scaner zilnic `automationDailyScan` (06:00 Europe/
>   Bucharest) → `lead.inactive` pentru lead-uri new/contacted cu `updatedAt` vechi (ctx `lead.daysSinceUpdate`; stateHash=
>   updatedAt ⇒ o dată per perioadă de inactivitate); reguli+config încărcate O DATĂ (eficiență). `dispatchAutomationEvent`
>   acceptă acum opts.automations/config pre-încărcate.
> - `firestore.rules`: `tasks/{id}` read admin, create false (doar motorul), update/delete admin (operatorii închid task-uri).
> - UI `AutomationsPanel`: secțiune „Task-uri deschise" (listener tasks status=open) cu „Gata" (→ status done). i18n
>   `admin.automation.tasksTitle/taskDone` ro+en.
> Verificat: 15/15 suites + e2e TEST Y (+6 F3: set_status scrie status+stamp, task.create, anti-buclă origin, status invalid
>   skipped) + build + build:site + boot — toate verzi. DEPLOYED: functions (onLeadAutomation + automationDailyScan create +
>   executori) + hosting (tasks UI) + rules (tasks). **Motorul acoperă acum toate declanșatoarele planificate** (lead.*,
>   campaign.*, schedule.*) + acțiuni notify/set_status/task/AI. **Următor (ordinea Andrei): DOCUMENTARE GHID — separat
>   operator/admin vs client.** F4 (email/SMS) amânat.

**2026-06-20 - Task Completed — Ghid documentat (conținut real, separat operator/admin vs client)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „documentează ghidul; vreau ghid separat pentru operatori și admini față de ghidul clienților."
> Separarea exista deja (OPERATOR_HELP în /admin tab „Ghid" + CLIENT_HELP în /app „/app/ghid"), dar corpurile erau goale
> („în curând"). Completat CONȚINUTUL real:
> - `src/help/helpContent.ts`: `sec()` adaugă acum `bodyKey` per item; **două secțiuni noi de operator**: `opConnectors`
>   (4) + `opAutomation` (6) — funcțiile recente, nedocumentate. Ghidul operatorului = 10 secțiuni; al clientului = 5.
> - i18n `help.*` ro (sursă) + en (paritate): corp explicativ (1-2 fraze, scanabil) pentru TOATE item-urile — operator
>   (lead-uri, sugestii, cereri, oportunități, marketing, conectori, automatizări, LP, administratori, PDF) + client (cont,
>   performanță, raport, livrabile, LP). Ghidul operatorului acoperă acum și conectorii Meta + tot motorul de automatizare.
> `HelpView` randa deja `bodyKey` (placeholder dacă lipsea) → fără schimbare de UI. Testul de acoperire verifică acum și
> corpurile (toate cheile bodyKey există în ro); paritatea en e impusă de typecheck (en: typeof ro).
> Verificat: 15/15 suites (help: toate cheile există) + build (paritate i18n) + build:site + boot — toate verzi.
> DEPLOYED: hosting (doar conținut UI/i18n; fără functions/rules). Notă: e separarea cerută — un ghid pentru echipă, unul
> pentru clienți, fiecare la fața lui (/admin vs /app).

**2026-06-20 - Task Completed — Automatizări client-scope, Felia 5a (operator face / client vede)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: F5 = automatizări client-scope, „toate 3" (operator-face/client-vede + client self-serve + CRM clasic).
> Le construiesc pe sub-felii în ordinea fezabilității; **F5a** = fundația (motorul suportă deja scope=client).
> - `functions/index.js`: ieșirile motorului sunt rutate pe domeniu — `automationOutCol()`: regulile de AGENȚIE scriu în
>   top-level `notifications`/`tasks` (audiență = operatorii), cele de CLIENT scriu sub `clients/{clientUid}/notifications`
>   + `clients/{clientUid}/tasks` (audiență = clientul, izolat multi-tenant). notify.operator + task.create folosesc helper-ul.
> - `firestore.rules`: `clients/{uid}/notifications` (read owner+admin, write false) + `clients/{uid}/tasks` (read owner+admin,
>   create/delete false, update owner/admin DOAR `status`∈open/done — clientul marchează rezolvat).
> - `src/admin/AutomationsPanel.tsx`: la scope=client, **dropdown de clienți** (din lead-urile cu clientUid) în loc de UID brut.
> - `src/app/AppHome.tsx`: secțiune nouă `ClientAutomationFeed` în portal — clientul își vede notificările + task-urile
>   (deschise, cu „Gata") generate de regulile rulate pe contul lui. i18n `appHome.auto*` + `admin.automation.clientPick` ro+en.
> Verificat: 15/15 suites + e2e TEST Y (+4 F5a: notify+task sub clients/{uid}, nimic în top-level, tenant greșit → nimic) +
> build + build:site + boot — toate verzi. DEPLOYED: functions (rutare ieșiri) + hosting (dropdown + portal feed) + rules.
> **Următor: F5b** (client self-serve — builder de automatizări în /app pe mini-CRM-ul lui, gated de abonament) → **F5c**
> (CRM clasic facturi/memento — necesită întâi modelul de date Vertical 2). F4 (email/SMS) amânat.

**2026-06-20 - Task Completed — Ghiduri actualizate la scope (Self Marketing + agenție vs client)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „ține cont că și ghidurile trebuie să reflecte asta" (clarificarea de scope: automatizările = unealta NOASTRĂ;
> Self Marketing = self-serve clientului, ca marketingexplorer.ro). Ghidul clientului nici nu menționa Self Marketing (live!)
> nici „Notificări & memento-uri" (F5a). Reparat:
> - `helpContent.ts`: ghid CLIENT += `clSelf` (5: ce e / profil / strategie & sugestii / aprofundare / export & explorări) +
>   `clAlerts` (2: ce vezi / task-uri). Ghid OPERATOR: `opAutomation` 6→7 (+ „Domeniu: agenție vs client" — explică explicit
>   că automatizările sunt unealta agenției, clientul nu le construiește, iar rezultatele regulilor pe-un-client apar în portalul lui).
> - i18n `help.clSelf*`/`help.clAlerts*`/`help.opAutomation_7*` ro+en (titlu+subtitlu+corp).
> Verificat: 15/15 suites (acoperire chei: toate corpurile noi există) + build (paritate i18n) + build:site + boot. DEPLOYED:
> hosting (UI/i18n). NB pt. viitor: la fiecare felie Self Marketing (Oportunități/Execuție/...) se actualizează și ghidul clientului.

**2026-06-20 - Task Completed — Self Marketing S2: pasul „Oportunități" (paritate cu AI Marketing Explorer)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: Self Marketing trebuie să facă exact ce face marketingexplorer.ro. Gap principal = pasul „Oportunități"
> (era „în curând"). Livrat S2 (defining feature al competitorului: ~10 idei prioritizate pe impact):
> - `functions/index.js`: callable nou `selfGenerateOpportunities` (clonă a selfGenerateStrategy — auth + App Check +
>   self-quota per-client + plafon global + refund la eșec) → `OPPORTUNITIES_SCHEMA` (items: title/channel/impact
>   high|medium|low/why/description/firstStep) + `buildOpportunitiesPrompt` (cere EXACT 10, prioritizate pe impact);
>   clamp + sortare pe impact, scrie `clients/{uid}/selfMarketing/opportunities`. Reguli: cade pe matcher-ul existent
>   `selfMarketing/{docId}` (client-read, write false) — fără schimbare de reguli.
> - `src/types/selfMarketing.ts`: `SelfOpportunity`/`SelfOpportunities` + `coerceToSelfOpportunities` (impact invalid→
>   medium, sortare pe impact, cap 10) + OPPORTUNITY_LIMITS (paritate cu JS).
> - `src/app/SelfMarketingFunnel.tsx`: pasul 2 „Oportunități" devine FUNCȚIONAL — generare + listă cu badge de impact +
>   canal/de ce/ce presupune/primul pas + export copy/PDF. (Doar pasul 5 „Execuție" rămâne „în curând".)
> - Ghidul CLIENTULUI: `clSelf` 5→6 (adăugat „Oportunități (idei prioritizate)" în flux). i18n `selfMarketing.opp*`/
>   `impact_*`/`o*` + `help.clSelf_*` ro+en.
> Verificat: 15/15 suites (test-self-marketing +5 coerce oportunități) + e2e TEST Q (+6 prompt/schema/paritate OPPORTUNITY_LIMITS;
>   re-export adăugat în _e2e-lp-entry.ts) + build (paritate i18n) + build:site + boot. DEPLOYED: functions
>   (selfGenerateOpportunities create) + hosting. **Self Marketing acum:** Profil→Oportunități→Strategie→Detalii (+export);
>   rămas pt. paritate: S3 Execuție (plan 30 zile), S4 bibliotecă multi-firmă, S5 credite cumpărabile.

**2026-06-20 - Task Completed — Self Marketing S3: pasul „Execuție" (plan 30 zile) — funnel COMPLET**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „continuă" → S3, ultimul pas „în curând" din funnel.
> - `functions/index.js`: callable `selfGenerateExecution({directionIndex})` (clonă selfGenerateDetails: citește profil +
>   direcția din strategie server-side; self-quota + global + refund) → `EXECUTION_SCHEMA` (summary + 4 săptămâni
>   title/focus/actions/kpi + abTests + optimization) + `buildExecutionPrompt`; scrie `clients/{uid}/selfMarketing/execution`.
> - `src/types/selfMarketing.ts`: `SelfExecution`/`SelfExecutionWeek` + `coerceToSelfExecution` (cap 6 săptămâni, plafoane)
>   + EXECUTION_LIMITS (paritate JS).
> - `src/app/SelfMarketingFunnel.tsx`: pasul 5 „Execuție" FUNCȚIONAL (selector direcție + generare + plan: rezumat +
>   carduri săptămânale + A/B + optimizare + export). **Eliminat ultimul „în curând" — toți cei 5 pași sunt LIVE.**
> - Ghid CLIENT `clSelf` 6→7 (adăugat „Execuție (plan pe 30 de zile)"). i18n `selfMarketing.exec*` + `help.clSelf_*` ro+en.
> Verificat: 15/15 suites (+4 coerce execuție) + e2e TEST Q (+4 prompt/schema/paritate EXECUTION_LIMITS; re-export adăugat) +
> build (paritate i18n) + build:site + boot. DEPLOYED: functions (selfGenerateExecution create) + hosting.
> **Self Marketing = paritate funcțională cu AI Marketing Explorer pe flux:** Profil→Oportunități→Strategie→Detalii→Execuție,
> cu export PDF/copy peste tot. Rămas (non-flux): S4 bibliotecă multi-firmă, S5 credite cumpărabile (Stripe).

**2026-06-20 - Task Completed — B1: Link Builder pe campanie (legare link LP ↔ campanie)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: direcții noi B+E+D, „continuă" → B1 (din #55, planificat de mult). Primul pas al feature-ului
> „campaign-aware Link Builder + termen de valabilitate" — legarea linkurilor LP de campaniile reale din Marketing Center.
> - `src/admin/LpLinkBuilder.tsx`: dropdown nou „Campanie" cu campaniile din Marketing Center (filtrate la clientUid-ul
>   LP-ului dacă e legat; altfel toate). Alegerea unei campanii fixează `campaignId` pe link + pre-completează UTM-ul
>   `campaign` cu numele sanitizat (`sanitizeVariantPart`); „— campanie liberă —" revine la text liber. Linkurile legate
>   primesc un marcaj 📊 în tabel.
> - `firestore.rules`: `links/{id}` hasOnly += `campaignId` (opțional, string ≤128).
> - i18n `admin.lpStudio.lbCampaignFree`/`lbCampaignLinked` ro+en.
> Verificat: 15/15 suites + build (typecheck + paritate i18n) + build:site + boot. DEPLOYED: hosting + rules (fără functions).
> **Rămas din #55 (B2):** termen de valabilitate pe campanie → `serveLp` comută pe pagină „ofertă expirată" + tracking
> diferențiat (atinge serveLp + schema campaniei — felie separată). Apoi E1 (backstop orar automatizări) → E2 (split bundle).

**2026-06-20 - Task Completed — E1: backstop orar la motorul de automatizare (anti-runaway)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: B+E+D, „ok" → E1. Constanta `AUTOMATION_MAX_RUNS_PER_TARGET_HOUR` (=5) exista dar NU era aplicată;
> dedupe-ul (`runs/{key}.create`) prinde re-rulările cu ACEEAȘI stare, dar nu o regulă care oscilează (stateHash diferit
> de fiecare dată — ex. verdict AI care se schimbă) → putea rula nelimitat pe aceeași țintă. Acum:
> - `functions/index.js` (`dispatchAutomationEvent`): backstop orar pe (regulă, țintă) — UN doc `automations/{id}/rate/{targetId}`
>   cu fereastră fixă (count + windowStart; reset când a trecut ora). Sub plafon → rulează + incrementează; la plafon →
>   sare (`limited`). Fără bloat per-bucket (un doc per țintă, nu per oră). Întoarce și `limited` în sumar.
> - `firestore.rules`: `automations/{id}/rate/{rid}` read admin, write false (doar motorul).
> Verificat: 15/15 suites + e2e TEST Y (+2 E1: din 7 stări diferite pe aceeași țintă → 5 rulate, 2 limitate; contor=5) +
> build + build:site + boot. DEPLOYED: functions (dispatch) + rules. Motorul are acum TOATE garanțiile: dedupe + anti-buclă
> (origin) + cap AI + **backstop orar**. **Următor: E2 (split bundle) → apoi D (verticală — aștept modulul) / B2.**

**2026-06-20 - Task Completed — E2: split bundle (lazy-load rute auth-gated)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: B+E+D, „continuă" → E2. Chunk-ul principal `index` era 450KB (gzip 127KB) — încărca tot codul de
> admin/LP Studio/Self Marketing chiar și pe paginile publice.
> - `src/App.tsx`: rutele auth-gated (NEprerenderizate) `AdminHome`/`AppHome`/`OnboardingForm`/`SelfMarketingFunnel`/
>   `HelpHome` trecute pe `React.lazy` + un singur `<Suspense>` peste `<Routes>`. Paginile PUBLICE rămân import STATIC
>   (sunt prerenderizate → HTML determinist, fără flash de Suspense la hidratare).
> Rezultat: `index` **450KB→172KB** (gzip 127→59KB); `AdminHome` (262KB) se încarcă DOAR pe /admin; AppHome/SelfMarketing/
>   Onboarding/Help = chunk-uri separate la cerere. Paginile publice nu mai trag codul de admin/studio.
> Verificat: build (typecheck + chunk split) + build:site (16 pagini prerender ALL PASS, HTML neschimbat) + boot (vizitează
> /app lazy → AuthPanel OK) + 15/15 suites. DEPLOYED: hosting (doar frontend; fără functions/rules).
> NOTĂ (capcană): lazy DOAR pe rutele neprerenderizate — paginile prerenderizate rămân statice ca să nu apară flash de
> Suspense la hidratare (HTML-ul prerendat trebuie să fie identic cu primul render client). RĂMAS (E, opțional): chunk-ul
> `firebase` (692KB) e tot pe calea critică (auth init); lazy-firebase = mai invaziv, lăsat pt. mai târziu.

**2026-06-20 - Task Completed — D (Verticala 2): Facturi & Proforme (prima felie)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: B+E+D, a ales D = Facturi/Proforme — PRIMA felie a Verticalei 2 „Lansare Soft" (modul `crm`).
> Felie verticală completă, pe arhitectura modulară (fără refactor de nucleu):
> - `src/types/invoice.ts`: model `Invoice` (schema:1: kind proforma|factura, serie/număr, date, monedă, seller/buyer
>   {name,cui,regCom,address,iban}, items[], vatRate, status draft|sent|paid|cancelled) + `coerceToInvoice` (clamp/default)
>   + `invoiceTotals` PUR (rotunjire 2 zecimale per linie, apoi TVA pe subtotal) + plafoane.
> - `src/utils/invoiceDoc.ts`: `composeInvoiceHtml` PUR + escapat (reutilizează escapeHtml/printHtmlDoc din printDoc) →
>   document A4 brandat; `printInvoice` (print-to-PDF). e-Factura ANAF = fază ulterioară.
> - `firestore.rules`: `clients/{uid}/invoices/{id}` read owner+admin (clientul își va vedea facturile), write admin
>   (validat: kind/status în set, vatRate 0-100, items listă ≤50, seller/buyer map, currency).
> - `src/admin/InvoicesPanel.tsx` + tab „Facturi" în AdminHome (între Automatizări și Landing): alegi client → listă
>   documente + creează/editează (părți, linii cu totaluri live, TVA, status) + tipărește PDF. i18n `admin.invoices.*` ro+en.
> - Test `scripts/test-invoice.ts` (coerce + totaluri exacte 25.56/4.86/30.42 + escaping HTML anti-injecție).
> Verificat: 16/16 suites + build (typecheck + paritate i18n) + build:site + boot. DEPLOYED: hosting + rules (fără functions).
> **Verticala 2 a pornit.** Felii viitoare: numerotare automată serie/număr; persistă datele furnizorului (config); status
> plătit↔încasări; expunere facturi în portalul clientului; eventual e-Factura.

**2026-06-20 - Task Completed — Facturi felia 2: date furnizor salvate (config) + pre-completare**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „continuă" → felia 2 a modulului Facturi. Operatorul nu mai retastează furnizorul la fiecare document.
> - `src/types/invoice.ts`: `InvoiceConfig` (seller + defaultSeries/defaultVatRate/defaultCurrency) + `coerceToInvoiceConfig`.
> - `firestore.rules`: `appConfig/{docId}` extins să accepte și `invoiceSeller` (seller map, defaultVatRate 0-100,
>   defaultSeries/defaultCurrency string) pe lângă `automation`. Read+write admin.
> - `src/admin/InvoicesPanel.tsx`: secțiune „Setări furnizor" (pliabilă) — editezi datele agenției + default-uri o singură
>   dată; `startNew` pre-completează seller/serie/TVA/monedă din config. i18n `admin.invoices.sellerSettings/sellerHint` ro+en.
> - Test `test-invoice.ts` += coerceToInvoiceConfig (default/păstrare/clamp).
> Verificat: 16/16 suites + build (typecheck + paritate i18n) + build:site + boot. DEPLOYED: hosting + rules.
> RĂMAS pe Facturi: numerotare automată serie/număr (counter, gapless — fază cu grijă); status plătit↔încasări; facturi în
> portalul clientului; e-Factura ANAF.

**2026-06-20 - Task Completed — „Cel mai eficient drum": funnel conversie self-serve→agenție + plafon cost AI**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „care e cel mai eficient drum" → „da". Recomandare: monetizează ce există + 2 plase ieftine, nu funcții noi.
> Livrat pașii 1+2 (cod); pasul 3 (backup/billing) = consolă GCP, rămâne pe Andrei (pași dați separat).
> - **(1) Funnel conversie:** callable `requestSelfAudit` (auth + App Check, NU AI) — clientul logat din Self Marketing cere
>   un audit → creează/actualizează `leads/self-{uid}` (Admin SDK; source='self-discovery' + clientUid, profil pre-completat
>   din selfMarketing/profile + email; idempotent, nu re-resetează statusul operatorului). UI: CTA „Cere audit gratuit" în
>   pașii Strategie + Execuție din `SelfMarketingFunnel` (state idle/busy/sent). Admin: badge „🔎 Self" pe lead-urile din
>   self-discovery în tabelul de lead-uri. → transformă Self Marketing (azi cost pur, fără cale de conversie) în PIPELINE
>   cald, refolosind lead-urile + triggerul `lead.created` (automatizările pot reacționa). Fără Stripe, fără tabele noi.
>   i18n `selfMarketing.audit*` + `admin.leadSelfDiscovery` ro+en.
> - **(2) Plafon cost AI:** `setGlobalOptions({ maxInstances: 10 })` la încărcarea functions/index.js — plasă de cost pe
>   TOATE funcțiile gen-2 (mai ales callable-urile Opus); non-breaking. (Confirmat absent înainte de analiza multi-agent.)
> Verificat: 16/16 suites + e2e + build (typecheck + paritate i18n) + build:site + boot. DEPLOYED: functions (requestSelfAudit
>   create + maxInstances pe toate) + hosting + rules. **RĂMAS pe Andrei (consolă GCP, ~5-30 min):** (3a) backup zilnic
>   Firestore + PITR; (3b) o alertă de buget GCP. Pași dați în chat.

**2026-06-20 - Task Completed — Ghid mai detaliat (corpuri structurate „ce e / cum folosești / de reținut")**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „vreau ca ghidul să fie mai detaliat". Am rescris TOATE corpurile (bodyKey) din ghid — operator (10
> module) + client (7 module) — din 1-2 fraze în explicații structurate pe 3 linii: **Ce e / Cum folosești / De reținut**
> (HelpView randează `pre-wrap`, deci \n dau structură vizuală). Conținut fundamentat pe funcțiile reale, cu pași concreți,
> gotcha-uri și note (ex. token criptat server-only, anti-buclă, read-only Meta, notele interne invizibile clientului,
> CTA-ul de audit din Self Marketing). i18n `help.*` ro (sursă) + en (paritate; EN fără apostrofuri ca să nu spargă
> string-urile single-quote). Structura cheilor neschimbată (titlu+subtitlu+corp) → fără refactor UI.
> Verificat: 16/16 suites (acoperire chei: toate corpurile există în ro) + build (paritate i18n en:typeof ro) + build:site
> + boot. DEPLOYED: hosting (doar conținut UI/i18n).

**2026-06-20 - Task Completed — Tab „Sănătate" în /admin (observabilitate read-only: consum AI + erori)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „ok, acum nu pot să mă ocup eu, continuă cu ce poți tu" (nu poate face pașii din consola GCP —
> backup Firestore + alerta de buget). Am construit complementul ÎN-aplicație al plafonului `maxInstances`: un tab
> „Sănătate" în `/admin` (`src/admin/HealthPanel.tsx`), pur read-only, care arată: (1) consumul AI de AZI prin
> backstop-urile globale (`aiUsage/__selfGlobal` Self Marketing + `aiUsage/__automationGlobal` Automatizări — contoare
> pe zi, afișează 0 dacă fereastra s-a resetat) și (2) ultimele 50 de erori raportate din aplicație
> (`errorReports`, onSnapshot orderBy at desc). Operatorul vede dintr-o privire dacă plafoanele se apropie sau dacă
> apar crash-uri, fără să intre în consola Firebase.
> - **Reguli:** `errorReports` trecut de la `read:false` la `allow read: if isAdmin()` (datele = name/message/stack/
>   kind/version/build/userAgent/lang/at — FĂRĂ PII de client; create rămâne whitelist, update/delete false).
>   `aiUsage` era deja `read: if isAdmin()`.
> - Wire: tab `health` în `AdminHome` (union + VIEW_LABEL_KEY + nav array + render + import). i18n `admin.navHealth` +
>   `admin.health.*` ro+en. Nu scrie nimic; nu consumă AI.
> Verificat: 16/16 suites + build (typecheck + paritate i18n) + build:site (16 pagini) + boot. DEPLOYED: hosting + rules
>   (serveLp re-actualizat de rewrite). **RĂMAS pe Andrei (consolă GCP):** backup zilnic Firestore + PITR; alertă de buget.

**2026-06-20 - Task Completed — Hardening cost/abuz AI Self Marketing: coșuri fair-share + gate email-verificat**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „continua" (ultracode). Am rulat un workflow multi-agent de UNDERSTAND+AUDIT pe suprafața AI expusă
> clienților (Self Marketing). Auditul mi-a CORECTAT premisa: App Check e DEJA live în cod (enforceAppCheck pe toate
> self-callable-urile + cheie reCAPTCHA reală în .env.local → inline în build-ul local de deploy; absent doar din .env.ci,
> unde oricum App Check se auto-sare sub Playwright). Gaura reală de cost: plafonul global era UN SINGUR coș partajat
> (80/zi) → un atacator care fermentează conturi îl putea goli și BLOCA clienții PLĂTITORI (DoS prin epuizare).
> - **Coșuri fair-share (fix structural):** două contoare pe zi — `aiUsage/__selfGlobalTrial` (trial/gratuit, plafon
>   `trialDailyCap`=40) și `aiUsage/__selfGlobalEntitled` (clienți cu abonament activ, plafon `entitledDailyCap`=200).
>   Costul de ABUZ e acum mărginit DOAR de coșul trial, independent de plătitori; abuzul trial NU mai poate înfometa
>   clienții plătitori. Clasificare pe `entitlement.active` (boolean recalculat, NU `status` brut). Plafoanele + gate-ul =
>   `appConfig/selfMarketing` (coerce unic `src/types/selfMarketingConfig.ts` + port JS, paritate e2e), editabile din /admin.
> - **Gate email-verificat:** toate self-callable-urile AI (strategy/opportunities/details/execution) + `requestSelfAudit`
>   cer `token.email_verified` când `requireEmailVerified` (config, implicit ON) → `permission-denied`+'EMAIL_NOT_VERIFIED'
>   (ÎNAINTE de consumul de quotă). Descurajează farm-area cu adrese inexistente. Client: `Profile.emailVerified` +
>   `sendEmailVerification` la signup + buton retrimite/reîmprospătează (cu `getIdToken(true)`) + banner în funnel +
>   mapare errKey la nudge-ul de verificare. Conturile Google = deja verificate.
> - **Tab „Sănătate & limite":** card editabil (plafoane + checkbox gate, dirty-ref anti-clobber) + consum azi pe ambele
>   coșuri. (Plafonul `__selfGlobal` vechi de 80 eliminat.)
> - **Review adversarial multi-agent (3 dimensiuni → verificare per-finding):** 8 constatări confirmate, reparate 7
>   (clasificare pe `.active` nu `status` [HIGH] + token forțat la refreshUser [MED] + errKey pe requestAudit + dirty-ref
>   în HealthPanel + constanta moartă); a 8-a (banner nag când gate-ul e oprit) = acceptată by design (clientul nu citește
>   configul). Test nou R2 acoperă `selfGlobalPoolFor` (citirea entitlement-ului — bug-ul HIGH ar fi fost prins).
> Verificat: 16/16 suites + e2e (paritate config TS↔JS + fair-share + R2 clasificare) + build + build:site + boot.
>   DEPLOYED: functions (toate self-callable-urile + gate + coșuri) + hosting + rules (appConfig/selfMarketing).
>   **RĂMAS pe Andrei (config, nu cod):** confirmă că App Check ENFORCEMENT e pornit în consola Firebase pt. Cloud
>   Functions; backup zilnic Firestore + PITR; alertă de buget GCP.

**2026-06-20 - Task Completed — Numerotare facturi atomică, fără goluri (Verticala 2)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „da" (continuă; ultracode). Verticala 2 (Facturi) avea numerotare manuală → ilegal în RO (numerele de
> factură trebuie SECVENȚIALE per serie, FĂRĂ goluri, ALE EMITENTULUI). Am adăugat numerotare automată atomică.
> - **Callable `issueInvoice` (Admin SDK):** `performIssueInvoice` rulează o SINGURĂ tranzacție Firestore — citește
>   factura → dacă e deja numerotată o întoarce idempotent → altfel citește contorul `invoiceCounters/{serie}` (GLOBAL pe
>   agenție, NU per client, ca să nu se dubleze numere între clienți) → atribuie număr + incrementează contorul ÎN aceeași
>   tranzacție ⇒ gap-free. Mută draft→sent + `issuedNumberAt`. Seed la prima factură a seriei din `appConfig/invoiceSeller.startNumber`
>   (continuare dintr-un sistem vechi, ex. 248). UI: buton „Emite" pe rândurile nenumerotate; câmpul „număr" devine read-only,
>   seria se blochează după numerotare.
> - **Integritate end-to-end (reguli):** clientul NU poate seta/schimba `number` (create cere number=='', update păstrează
>   numărul); seria blocată după numerotare; `invoiceCounters` write:false (doar callable); `hasOnly` whitelist pe facturi;
>   numerotată ⇒ statusul nu mai revine la draft.
> - **Review adversarial multi-agent (3 dimensiuni → verificare per-finding):** 10 constatări confirmate, reparate cele
>   reale: (HIGH) cheia de contor lossy colaționa serii distincte ('A/B' vs 'A.B') → goluri → FIX bijecție serie↔cheie
>   (`safeSeries` [A-Za-z0-9_-] în coerce + reguli `matches` + UI strip + gardă `BAD_SERIES` în callable); (HIGH) contor
>   corupt reseta tăcut la 1 → numere DUPLICATE → FIX `nextInvoiceNumber` aruncă `CORRUPT_COUNTER` (testul care endorsa
>   bug-ul a fost inversat); (MED) status revenea la draft pe o factură numerotată → blocat în reguli + UI; (MED/LOW) lipsea
>   `hasOnly` → adăugat; stub-ul de test nu impunea read-before-write → gardă adăugată. Acceptate (operațional/amânat):
>   integritatea contorului ține de backup/PITR (consola Andrei); suită de reguli cu emulator (amânată în tot proiectul).
> Verificat: 16/16 suites + e2e (tranzacție: 1,2 fără goluri, idempotent, seed, CORRUPT_COUNTER, BAD_SERIES, serii
>   independente, read-before-write) + build + build:site + boot. DEPLOYED: functions (issueInvoice) + hosting + rules.
>   Rămas (backlog): e-Factura ANAF; storno/corecții; numerotare cu reset anual; facturi în portalul clientului.

**2026-06-21 - Task Completed — Facturile clientului în portal (Verticala 2, read-only + PDF)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „da" (continuă; ultracode). Am închis bucla facturării end-to-end: după ce operatorul emite o factură
> (numerotare atomică), clientul logat în /app o vede și o descarcă.
> - **Portal `InvoicesPortal`** (secțiune în `AppHome`, după ClientAutomationFeed): `onSnapshot` pe
>   `clients/{uid}/invoices` cu `where('number','!=','')` → DOAR facturile EMISE (ciornele interne ale agenției nu apar);
>   tabel (tip/nr/dată/total/status) + buton „Descarcă" → `printInvoice` (reutilizează composer-ul pur `composeInvoiceHtml`,
>   escapat). Sortare: data facturii desc, cu fallback pe `issuedNumberAt` (server-stamped, mereu prezent) la egalitate/dată
>   golită — determinism indiferent de inputul operatorului.
> - **Reguli:** read facturi strâns de la `signedInAs(uid) || isAdmin()` la `isAdmin() || (signedInAs(uid) && number != '')`
>   — clientul nu mai poate citi ciorne (number==''); adminul citește tot (operatorul neatins).
> - i18n `appHome.invoices.*` (ro+en); etichetele PDF reutilizează `admin.invoices.*`; ghid client `clInvoices` (2 itemi,
>   help.* ro+en) — „client guide updates each feature".
> - **Review adversarial focusat (2 dimensiuni → verificare per-finding):** 1 constatare confirmată (LOW) — sortarea lexicală
>   pe issuedAt degrada la dată golită → reparat cu fallback pe issuedNumberAt. Rule↔query confirmate corecte (admin citește
>   tot; query client `!=` satisface regula; fără index compus).
> Verificat: 16/16 suites (incl. acoperire ghid) + build (typecheck + paritate i18n) + build:site + boot. DEPLOYED:
>   hosting + rules (fără functions — niciun callable nou). Backlog: e-Factura ANAF; storno; reset anual; notificare client la emitere.

**2026-06-21 - Task Completed — Notificare client la emiterea facturii**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „da" (continuă; ultracode). La emiterea unei facturi, clientul primește o notificare în feed-ul lui din
> /app — reutilizează infra de notificări a motorului de automatizare (ZERO cod frontend nou).
> - `issueInvoice` (wrapper onCall): după emiterea NON-idempotentă, scrie `clients/{uid}/notifications/invoice-{id}` (id
>   determinist ⇒ fără dubluri) prin `writeInvoiceNotification` (Admin SDK; regula notifications = write:false). Best-effort:
>   un eșec la notificare NU anulează emiterea; nu re-notifică la re-apel idempotent.
> - Text localizat `invoiceNotifText(kind, docNo, lang)` (pur, testat) — ro implicit / en după `clients/{uid}.locale`;
>   formă compatibilă cu `ClientAutomationFeed` (text + createdAt millis). `performIssueInvoice` întoarce acum și `kind`.
> Verificat: e2e (notifText ro/en + fără spațiu dublu, writeInvoiceNotification scrie în feed, performIssueInvoice→kind) +
>   16/16 suites + build. DEPLOYED: functions (issueInvoice). Fără rules/hosting (notificarea apare în feed-ul existent).
>   Backlog: localizare completă a tuturor notificărilor (azi doar cea de factură e bilingvă).

**2026-06-21 - Task Completed — Facturi de STORNARE (corecție/reversare) + hardening din review**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „da" (continuă; ultracode). Cum corectezi în RO o factură deja emisă: emiți un NOU document fiscal
> (factură de stornare) care referă originalul, cu sume NEGATIVE, primind propriul număr secvențial (refolosește
> issueInvoice). Model: `Invoice.stornoOf:{series,number,id}` + `makeStornoDraft` pur (copiază părți/TVA/monedă, NEAGĂ
> cantitățile, aceeași serie, draft). UI: buton „Stornează" pe facturile emise → editor → Emite (număr atomic); badge
> „↩ original"; PDF „FACTURĂ STORNO" + referința. Client portal: vede stornările (total negativ). Ghid client neschimbat
> (stornarea = unealtă operator).
> - **Review adversarial multi-agent (2 dim → verificare per-finding): 8 constatări confirmate, TOATE reparate:**
>   (HIGH) `round2` rotunjea asimetric → stornarea NU anula exact originalul la prețuri .xx5 → FIX round2 simetric
>   (round-half-away-from-zero) ⇒ `round2(-x)===-round2(x)`; (HIGH) lipsea garda de date că stornarea referă o factură
>   emisă + dublă-stornare → FIX validare server în `performIssueInvoice` (citește originalul după `stornoOf.id`, respinge
>   nonexistent/neemis/proformă/storno-de-storno; marchează originalul `stornoedBy` → anti dublă-stornare) + UI ascunde
>   butonul dacă deja stornată; (HIGH) regulile nu fixau `kind`/`stornoOf` după numerotare → FIX pin în reguli; (MED)
>   relaxarea qty negativ era globală → FIX scoped DOAR pe stornări (coerce: qty≥0 fără stornoOf); (MED) proforma consuma
>   secvența fiscală → FIX gate `PROFORMA_NO_ISSUE` (UI + server); (LOW) drift kind↔storno → FIX coerce forțează
>   kind=factura când stornoOf + select dezactivat; (LOW) stornoOf nevalidat în reguli → FIX `hasOnly(['series','number','id'])`
>   + tipuri/dimensiuni. Reguli: hasOnly += stornoOf/stornoedBy.
> Verificat: 16/16 suites (storno: reversare exactă .xx5, round2 simetric) + e2e (PROFORMA_NO_ISSUE, storno valid +
>   stornedBy, ALREADY_STORNOED, STORNO_NO_ORIGINAL/NOT_FOUND/NOT_ISSUED/OF_STORNO) + build + build:site + boot. DEPLOYED:
>   functions + hosting + rules. Backlog: e-Factura ANAF; numerotare proforme (serie separată); reset anual.

**2026-06-21 - Task Completed — CRM intern: jurnal de activități per lead (Verticala 2)**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „da" (continuă; ultracode). Primul pas din CRM-ul intern: un ISTORIC de interacțiuni pe lead (peste
> nota unică + pipeline-ul de status existent), care leagă relația de marketing de munca/facturarea ulterioară.
> - Model `src/types/crmActivity.ts` (`CrmActivity` schema:1: type[note/call/email/meeting/other] + body + at(millis) +
>   dueAt(follow-up) + createdBy; coerce unic). Colecție `leads/{leadId}/activities/{id}` (zona operatorilor).
> - UI `src/admin/LeadActivity.tsx` (autonomă, ca LeadRequests/OpportunityBoard) — timeline cronologic + formular (tip +
>   text + dată de follow-up); follow-up scadent evidențiat roșu. Un rând în AdminHome (expanderul lead-ului).
> - Reguli: `leads/{id}/activities` read/delete admin, create admin (hasOnly + type enum + body≤2000 + at number +
>   dueAt≤10), **append-only** (`update:false` — corecție = șterge+adaugă). `at` = client clock (number), nu serverTimestamp
>   (cere `is number` + ordonare client-side; unealtă operator, nu registru legal).
> - i18n `admin.activity.*` (ro+en); test pur `scripts/test-crm.ts` (coerce). Review adversarial (1 agent): 0 bug-uri,
>   1 nit (import `serverTimestamp` nefolosit) — reparat.
> Verificat: 17/17 suites + build (typecheck + paritate i18n) + build:site + boot. DEPLOYED: hosting + rules (fără functions).
>   Backlog CRM: contacte multiple per client; follow-up scadent în „Sugestii"; activități și pe clienții cu cont.

**2026-06-21 - Task Completed — Follow-up CRM scadent în tab-ul „Sugestii"**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „da" (continuă; ultracode). Închide bucla CRM: loghezi un follow-up pe o activitate → ești reamintit
> când e scadent, în tab-ul „Sugestii" al operatorului.
> - **Denormalizare anti-query:** `LeadActivity` scrie `leads/{id}.nextFollowUp` = dueAt-ul ULTIMEI activități (la add;
>   recalculat din activitățile rămase la delete). Evită un collectionGroup query + index pe subcolecție — `SuggestionsPanel`
>   citește deja `leads`, deci primește câmpul gratis (tiparul „anti-bloat fără citire").
> - `buildSuggestions` (pur): regulă nouă `followUpDue` (severity high) când `nextFollowUp` ≤ azi (UTC din nowMs injectat).
>   Model „ultima interacțiune" — o activitate nouă fără follow-up golește nextFollowUp (rezolvă reminderul).
> - i18n `admin.sugFollowUp` (ro+en); teste pure noi în buildSuggestions (scadent/azi/viitor/gol). Fără reguli noi
>   (update lead = admin), fără functions.
> Verificat: 17/17 suites + build (typecheck + paritate i18n) + build:site + boot. DEPLOYED: hosting + rules. Slice mic,
>   admin-only, pur+denormalizare → verificare prin teste (fără workflow de review). Backlog: contacte multiple/client.

**2026-06-21 - Task Completed — Reorganizare /admin: tab „Design & Pagini" + analytics LP în Marketing Center**
> Model: Claude Opus 4.8 (1M context)
> Prompt Andrei: „vreau ca tot ce ține de design/landing pages/site într-un tab dedicat și analytics la fel — nu e optim
> să avem design și analytics în același ecran." Răspunsuri la clarificări: un singur tab Design (Landing + Site); analytics
> LP MUTAT în Marketing Center (nu tab nou).
> - **Tab „Design & Pagini"** (`DesignHome`, view `design`): comasează Landing Pages + Site ca sub-tab-uri; AdminView
>   `landing`+`site` → `design` (nav + label + render). Editorul LP rămâne DOAR design/conținut.
> - **Analytics LP mutat în Marketing Center** (`LpAnalyticsSection`): alegi o pagină → `LpAnalytics` (trafic/conversie/
>   variante + rezultate A/B) + `LpLinkBuilder` (linkuri UTM). Scos din `LpEditor` (tab-urile `analytics` + `links` +
>   importurile lor). Setarea A/B (arme) rămâne în editor (e conținut). Separă proiectarea de măsurare.
> - i18n `admin.navDesign` + `lpAnalyticsTitle/Hint/Pick` (ro+en); `navLanding/navSite` reutilizate ca etichete sub-tab.
> - Review adversarial (1 agent): 0 probleme — fără funcționalitate pierdută, fără referințe agățate, paritate i18n,
>   editorul randează corect cele 6 tab-uri rămase, A/B setup păstrat.
> Verificat: 17/17 suites + build (typecheck + paritate i18n) + build:site + boot. DEPLOYED: hosting + rules (fără
>   functions). Pur refactor UI/IA (zero schimbări de date/reguli/securitate).

**2026-06-21 - Audit pre-lansare (multi-agent) — stare & capacitate**
> Model: Claude Opus 4.8 (1M context). Workflow: 9 finderi (rules/multi-tenant, functions, ai-cost, money-legal,
> data-integrity, pii, public-surface, frontend, secrets-deploy) + 2 mapperi (capability, opstate), verificare
> adversarială per-constatare. 28 constatări → 21 confirmate (4 high, 2 medium, 14 low, 1 nit). ZERO blocker, ZERO
> breșă cross-tenant exploatabilă anonim. Nu lansăm încă (mai e dezvoltare) — listă de remediat înainte de lansare:
> **HIGH (cod):**
> 1. Factura EMISĂ rămâne complet editabilă (items/TVA/părți/date) — regulile blochează doar number/series/kind/status;
>    fix: îngheață câmpurile financiare în firestore.rules când number!='' + dezactivează inputurile în UI.
> 2. Factura EMISĂ poate fi ștearsă (delete fără gardă pe number) → gol în secvența legală + contor nedecrementat;
>    fix: `allow delete: if isAdmin() && resource.data.number==''` + ascunde butonul Șterge pe facturi emise.
> 3. `aiInsight` (verdict/reasoning intern + aiInsightBy=UID operator) e citibil de client pe campaigns/{id} (read direct,
>    fără mirror client-safe); fix: mută aiInsight pe doc admin-only / mirror whitelisted (ca deliverables).
> 4. CSV formula-injection în exportul de leads din AdminHome (csvEscape local nu prefixează =+-@); date de la formularul
>    PUBLIC anonim → RCE/exfil în Excel la operator; fix: folosește `csvCell` din utils/csv.ts (deja există).
> **MEDIUM (cod):** 5. Gate-ul AI automatizări folosește `ent.status==='active'` în loc de `ent.active` (expirați primesc AI;
>    trialing respins) — fix `ent.active===true` (ca selfGlobalPoolFor). 6. `nextFollowUp` derivă greșit (o activitate fără
>    dată golește un follow-up real) — recalculează din toate activitățile (cel mai apropiat dueAt).
> **LOW (14):** leads create cu 12 câmpuri necapate (umflare doc anonim); checkout_sessions nevalidat (App Check pending);
>    callable-urile AI admin fără enforceAppCheck (consistență); storno cu sume necontrolate server-side; mirror deliverables
>    fără backfill (doar lpIndex are); clientName/requests.clientUid denorm fără re-sync server; operator UID în campaign;
>    EntCache fără coerce; cap AI operator doar lunar (fără daily/global); etc. **NIT (1):** idem cap operator.
> **OPERAȚIONAL (consolă Andrei — cele mai mari riscuri):** backup zilnic Firestore + PITR (CRITIC — contorul de facturi
>    n-are recuperare); monitorizare/alerte externe (error-rate functions+serveLp, uptime, alertă buget — azi ZERO);
>    confirmă App Check ENFORCEMENT pornit; firestore.indexes.json e gol (indecși compuși de codificat+deploy); suită de
>    reguli cu emulator (lipsă); pipeline de deploy (manual, fără staging/rollback); rotație ANTHROPIC_API_KEY; a11y (neabordat).
> Capacitate: Vertical 1 (Marketing AI) + Vertical 2 (Facturi+CRM activități) LIVE; LP Studio/serveLp/analytics, Self
> Marketing 5 pași, Meta ingest, automatizări notify-only — toate live. Dormant: Stripe self-serve (priceIds goale),
> Google/TikTok, email/SMS, ANAF e-Factura. (Niciun fix aplicat în acest pas — doar evaluare; remedierile = felii viitoare.)

**2026-06-21 - Task Completed — Remediere audit: Felia A (money-legal facturi) + Felia B (scurgere date + CSV)**
> Model: Claude Opus 4.8 (1M context). Prompt Andrei: „a+b" (remediază HIGH-urile #1+#2+#6 money-legal și #3+#4 securitate).
> **Felia A — facturi imutabile (HIGH #1+#2, MED #6):**
> - **Imutabilitate factură EMISĂ** (firestore.rules + UI): odată cu `number != ''`, conținutul fiscal e ÎNGHEȚAT —
>   `items/vatRate/seller/buyer/currency/issuedAt` + (din review) CONȚINUTUL `stornoOf` + marcajele server `issuedNumberAt`/
>   `stornoedBy`. Editabile DOAR status/dueAt/notes. `createdBy` = provenanță imuabilă pe ORICE update (pin în reguli +
>   UI nu o mai rescrie la fiecare salvare — `createdBy: a.createdBy || currentUser`). `InvoicesPanel` blochează inputurile
>   (`locked`/`disabled`) + ascunde ✕/„adaugă linie" pe facturi emise.
> - **Ștergere blocată pe facturi emise:** `allow delete: if isAdmin() && resource.data.number == ''` + butonul Șterge
>   ascuns pe rândurile numerotate (corecția = stornare, nu ștergere — fără gol în secvență).
> - **Storno = reversare EXACTĂ (invariant server, MED #6):** `stornoMatchesOriginal` (pur, exportat) verifică în
>   `performIssueInvoice` că storno-ul neagă exact originalul (qty negate, preț/părți/TVA/monedă identice) → `STORNO_MISMATCH`
>   altfel. Epsilon 1e-9 (fără fals-pozitive la cenți). i18n `errStornoMismatch`.
> **Felia B — scurgere `aiInsight` (HIGH #3) + CSV injection (HIGH #4):**
> - **Analiza AI campanii MUTATĂ** de pe `campaigns/{id}` (citibil de client) în colecția admin-only `campaignInsights/{id}`
>   (reguli: read admin, write false; scrisă exclusiv de Admin SDK). `performCampaignInsight` scrie acolo (denormalizează
>   leadId/clientUid/platform pt. triggere); `onMetricWrite` citește verdictul de acolo; `onCampaignAutomation` repointat pe
>   `campaignInsights/{campaignId}` (before/after pe `.verdict`). Frontend: `MarketingCenter` + `SuggestionsPanel` au listener
>   separat pe `campaignInsights` → Map indexat pe id. Cheia ctx automatizări rămâne `campaign.aiInsight.verdict` (compat).
> - **Migrare date ISTORICE (din review — relocarea oprea doar scrierile NOI):** callable admin `migrateCampaignInsights`
>   (+ nucleu testabil `performMigrateCampaignInsights`) mută `aiInsight`/`aiInsightAt`/`aiInsightBy` vechi în `campaignInsights`
>   și le ȘTERGE de pe `campaigns/{id}` (FieldValue.delete). Idempotentă. Buton „Mentenanță" în tab-ul Sănătate (de rulat o
>   dată de Andrei post-deploy). **Până la rulare, leak-ul persistă pe datele vechi.**
> - **CSV formula-injection:** `AdminHome.exportCsv` folosește acum `csvCell` (utils/csv.ts — prefixează `'` pe `=+-@\t\r`)
>   în loc de `csvEscape` local; date din formularul PUBLIC anonim nu mai pot deveni formule în Excel-ul operatorului.
> - **Review adversarial:** workflow 4 dimensiuni × verificatori. Faza de verificare a căzut pe limită de sesiune; cele 13
>   constatări brute verificate MANUAL (citire cod). Reale → reparate (stornoOf/issuedNumberAt/stornoedBy/createdBy freeze +
>   scrub istoric + test campaignInsights). Refuzate de finderi înșiși: sameParty/epsilon/happy-path/guard original/qty-zero.
> - Test nou e2e **MIG**: `performMigrateCampaignInsights` (câmpuri campaignInsights corecte + scrub + idempotență) — prinde
>   typo de nume de câmp (functions = JS fără typecheck; vezi feedback_dataread_functions_testing).
> Verificat: 17/17 suites + e2e (INV storno + MIG) + build (typecheck + paritate i18n) + build:site (16) + boot. DEPLOYED:
>   functions + hosting + firestore:rules. Rămâne pentru Andrei: rulează butonul „Migrează analizele AI campanii" o dată.

**2026-06-21 - Task Completed — Comasare /admin: tab principal „Administrare" (nav pe două niveluri)**
> Model: Claude Opus 4.8 (1M context). Prompt Andrei: „lead-uri, sugestii, automatizări, facturi, administratori, sănătate
> .. toate sub un tab: Administrare." Reduce 9 tab-uri → 4 principale.
> - **Nav pe DOUĂ niveluri** în `AdminHome.tsx`: tab-uri principale **Administrare / Marketing Center / Design & Pagini /
>   Ghid**; „Administrare" arată un rând de sub-tab-uri (Lead-uri·Sugestii·Automatizări·Facturi·Administratori·Sănătate).
> - **Zero mutare de logică:** `view` rămâne granular (cele 9 view-uri); `TOP_TAB_VIEWS` + `topTabOf(view)` derivă grupul
>   activ; blocurile de randare per view sunt NEATINSE. Clic pe tab principal → primul view al grupului (păstrează sub-tab-ul
>   dacă ești deja în grup). `SuggestionsPanel.onNavigate(view)` funcționează nealterat (top-tab recalculat din view).
> - i18n `admin.navAdministrare` (ro „Administrare" / en „Administration").
> Verificat: build (typecheck + paritate i18n) + build:site (16) + boot. DEPLOYED: hosting + rules. Pur refactor UI/IA
>   (zero schimbări de date/reguli/securitate/logică).

**2026-06-21 - Task Completed — Fix: email-ul administratorilor afișa UID în loc de adresă**
> Model: Claude Opus 4.8 (1M context). Andrei a raportat (screenshot) că „Administratori activi" arăta UID-ul în coloana
> Email, deși jurnalul de audit afișa corect adresele. Cauză: docul `admins/{uid}` poartă `email`, dar adminii vechi
> (creați înainte de fluxul RBAC din 15.06 + cel de bootstrap) NU au câmpul → UI cădea pe UID. Auditul are emailuri
> fiindcă le stochează separat (actorEmail/targetEmail) la momentul acțiunii.
> - **`resolveAuthIdentity(uid)`** (functions): email+nume din Firebase Auth (sursa de adevăr; best-effort).
> - **Bootstrap** (`onAdminRequestCreated`) scrie acum email/displayName din Auth la crearea founder-ului.
> - **`backfillAdminEmails`** (callable admin-only, nucleu `performBackfillAdminEmails`): repopulează din Auth orice
>   admin fără email; idempotent (cine are email e sărit; nerezolvabil în Auth → neatins).
> - **Auto-vindecare UI** (`AdminsPanel`): la încărcare, dacă vreun admin n-are email, cheamă o dată backfill-ul →
>   onSnapshot reîmprospătează → tabelul arată adresa. Zero acțiune manuală pentru Andrei.
> - Test e2e **ADM**: `performBackfillAdminEmails` (repopulare din Auth, păstrare rol prin merge, sărit cei cu email /
>   negăsiți în Auth, idempotență). Stub `admin.auth().getUser` adăugat în harness.
> Verificat: 17/17 suites + e2e (MIG+ADM) + build (typecheck+paritate i18n) + boot. DEPLOYED: functions + hosting + rules.

**2026-06-21 - Task Completed — Închiderea backlogului de audit (MEDIUM + LOW de cod)**
> Model: Claude Opus 4.8 (1M context). Andrei: „ce urmează" → opțiunea 1 (curățenie audit). Patru fix-uri din constatările
> rămase ale auditului pre-lansare:
> - **MED #5 — poarta AI automatizări:** `executeAutomationAction` folosea `ent.status==='active'` (expirați cu status vechi
>   primeau AI; un `trialing` valid era respins). Acum `ent.active===true` — boolean RECALCULAT de `recomputeEntitlement`
>   (include periodEnd>now), aceeași sursă de adevăr ca `selfGlobalPoolFor`.
> - **MED #6 — `nextFollowUp` drift:** la ADĂUGAREA unei activități fără dată, `nextFollowUp` era suprascris cu '' →
>   golea un follow-up real; la delete lua dueAt-ul celei mai recente activități (nu cel mai apropiat). Acum helper pur
>   `nearestDue` = cel mai mic dueAt non-gol din TOATE activitățile, recalculat la add+delete (`LeadActivity`).
> - **LOW — enforceAppCheck pe AI admin:** cele 6 callable-uri AI admin (aiGenerateCampaign/aiAnalyzeCampaign/aiClientReport/
>   aiRecommendChannels/aiGenerate+EditLandingPage) au acum `enforceAppCheck: APP_CHECK_ENFORCED` (consistență cu self/issue;
>   cheia reCAPTCHA e deja în build, App Check live).
> - **LOW — plafoane `leads` create:** formularul PUBLIC anonim — toate câmpurile de string rămase (cui/website/contactName/
>   industry/industryOther/adBudget/facebook/instagram/tiktok/packageInterest/locale) capate în firestore.rules (guard `in`),
>   anti umflare doc / abuz.
> Verificat: 17/17 suites + e2e + build (typecheck+paritate i18n) + boot. DEPLOYED: functions + hosting + firestore:rules.
> Rămas din audit (amânat, valoare/efort): EntCache coerce (boot-test acoperă coruperea), denorm re-sync server, cap AI
> operator zilnic/global, deliverables backfill. Operațional (consolă Andrei): backup+PITR, monitorizare/alerte, App Check
> enforcement, firestore.indexes.json, rotație cheie, staging/CD, a11y.

**2026-06-21 - Task Completed — Ofertă cu termen de valabilitate + pagină „expirat" (Task #55, tracking diferențiat)**
> Model: Claude Opus 4.8 (1M context). Andrei: „hai să vedem ce iese" (după planul confirmat). A treia direcție din
> „ce urmează" (1,2,3,4); #2 (SmartBill) e parcat până la decizia înlocuiește/augmentează.
> - **Date:** `LandingPage.offer` (`LpOffer`: expiresAt ISO UTC gol=fără expirare + mode message|redirect + titlu/mesaj/CTA
>   pagină expirată + redirectUrl). `coerceOffer` unic (expiresAt validat ISO-Z strict → fără ambiguitate de fus orar).
> - **serveLp:** după `Date.now() >= Date.parse(expiresAt)` nu mai servește LP-ul — redirect→302 (https LP_SAFE_IMG) sau
>   `composeExpiredPage` (temată, text/CTA escapate, noindex, fără formular/beacon). Citire BRUTĂ defensivă a `lp.offer`.
> - **Tracking DIFERENȚIAT:** `logLpExpiredHit` incrementează `stats/{zi}.expired` (contor SEPARAT, boții excluși) — NU
>   atinge `visits`/conversii ⇒ metricile campaniei live rămân curate. `lpStats` agregă `expired`; `LpAnalytics` afișează
>   „Vizite după expirare" când >0.
> - **UI:** tab nou „Ofertă" în LP Editor (`LpOfferPanel`, datetime-local↔ISO UTC, mod + câmpuri pagină expirată/redirect).
>   Reguli: `offer` validat `is map` (string-urile plafonate de coerce/UI + backstop 1MiB).
> - **Teste:** coerce (#55) în test-landing (ISO valid/ambiguu/gunoi, mode, plafoane) + e2e **OFF** (viitor→normal;
>   expirat message→pagină expirat + contor expired NU visits; redirect https→302; redirect non-https→fallback; bot→fără
>   contor). Notă: Link Builder are DEJA dropdown de campanie; partea nouă livrată = expirarea + pagina + metrici separate.
> Verificat: 17/17 suites + e2e (OFF) + build (typecheck+paritate i18n) + build:site + boot. DEPLOYED: functions+hosting+rules.
> Amânat: valabilitate trasă automat din setările `campaigns` (necesită câmp expirare pe modelul de campanie).

**2026-06-21 - Task Completed — CRM comunicare felia 1: email către lead (gated, deploy-safe)**
> Model: Claude Opus 4.8 (1M context). Andrei a ales opțiunea ③ (comunicare email/SMS), abordarea „email gestionat" — după
> o discuție despre livrabilitate (blacklist/junk). Concluzie comună: deliverability ≈ 90% DNS+cont (SPF/DKIM/DMARC), nu cod;
> SendGrid (extensia Firebase) minimizează cooking-ul. Livrat GATED ca să nu trimită nimic până e setup-ul gata.
> - **Nucleu pur** `src/utils/email.ts` (`renderEmail`: escape corp + newline→<br> + footer dezabonare https; `coerceEmailDraft`)
>   PORTAT 1:1 în functions (paritate e2e TEST EMAIL).
> - **functions:** `EMAIL_ENABLED=false` (gate); `performSendLeadEmail`/`sendLeadEmail` (admin+App Check) → verifică opt-out,
>   generează `emailUnsubToken`, randează, scrie în coada `mail/{id}` (extensia Trigger Email), loghează activitate CRM (email).
>   Cu flag false → 'disabled', nimic în coadă. **Dezabonare un-click** `GET /p/_unsubscribe?lead&t` → `performUnsubscribe`
>   setează `emailOptOut` (token aleator = autorizare). Reguli: `mail` read/write false (doar Admin SDK + extensie).
> - **UI:** „Trimite email" în `LeadActivity` (subiect+corp → callable; stări disabled/opt-out/no-addr). i18n ro+en.
> - **Teste:** render (TS test-landing + JS e2e), performSendLeadEmail (coadă+activitate+token+opt-out/NO_EMAIL),
>   performUnsubscribe (token corect/greșit).
> Verificat: 17/17 suites + e2e (EMAIL) + build + build:site + boot. DEPLOYED: functions+hosting+rules (rămâne DORMANT).
> **ACTIVARE (Andrei, consolă):** instalează extensia firestore-send-email (SendGrid/SMTP) + autentifică domeniul
> (SPF/DKIM/DMARC) + `EMAIL_ENABLED=true` + deploy:functions. Rămas (felii viitoare): acțiune motor `email.send` (automatizări
> CRM) + SMS (Twilio) — reutilizează renderEmail/coada.

**2026-06-21 - Task Completed — „Strategie/Campanie → Landing Page" (north star felia 1)**
> Model: Claude Opus 4.8 (1M context). Andrei: îmbunătățim serviciile (plățile lângă lansare) + north star = cockpit care
> creează materiale și publică campanii pe platforme din admin. Felia 1 = transformă output-ul AI în asset (LP). Sursă:
> AMBELE (campanie lead SAU strategie Self Marketing).
> - **functions:** callable `aiLandingFromSource` (admin + App Check + quota aiUsage) — citește sursa server-side, compune
>   brief-ul cu `buildSourceBrief` (PUR, exportat), generează HTML prin `runLpModel`/`buildLpGeneratePrompt` (reutilizate),
>   `uniqueLpSlug` (bază sanitizată + sufix la coliziune), persistă `landingPages/{slug}` (draft, kind campaign, scoped client/lead).
> - **UI:** în `LeadRequests` — „🪄 Landing page" per cerere (source=campaign) + „🪄 LP din strategie" la nivel de panou când
>   lead-ul are client conectat (source=strategy). Rezultat: ciornă în Design & Pagini. i18n ro+en.
> - **Teste:** e2e **LPSRC** — buildSourceBrief (campanie: companie+descriere+adTexts; strategie: profil+overview; surse goale)
>   + uniqueLpSlug (sanitizare diacritice + sufix la coliziune).
> Verificat: 17/17 suites + e2e (LPSRC) + build + boot. DEPLOYED: functions + hosting + rules.
> Arhitectat spre north star: LP = primul „material"; urmează output AI bogat (creative) + asset package + publicare (ads_management, App Review).

**2026-06-23 - Task Started — Fundația AI stratificată + prompt caching + ghid Admin**
> Model: Claude Opus 4.8 (1M context). Andrei: „AI cât mai bun și să contribuie cât mai mult" → prima felie din roadmap-ul
> AI (audit multi-agent). Decis cu Andrei: Fundație DIRECT STRATIFICATĂ (nu mono-strat) + ghid Admin detaliat care explică
> straturile + caching-ul. Workflow understand+design (wf_028d00ec-e67) a mapat suprafața AI (runAiJson + 9 callable-uri) și
> a draftat conținutul personas RO + ghidul.

**2026-06-23 - Task Completed — Fundația AI stratificată + prompt caching + ghid Admin**
> Model: Claude Opus 4.8 (1M context).
> - **Module noi (CommonJS, pure):** `functions/prompts/personas.js` (L1 `AGENCY_CONTEXT_RO` în €, cele 4 persona —
>   strateg+copywriter/analist/account-manager/LP-designer — + few-shot BUN/SLAB; `buildL1Text`/`buildL2Text`/`normIndustry`/
>   `buildSystemBlocks`) + `functions/prompts/benchmarks.js` (`BENCHMARKS_RO` pe cele 8 `SELF_INDUSTRIES` + `VERTICAL_NOTES_RO`,
>   valori orientative DE CALIBRAT).
> - **runAiJson:** `system` acceptă acum string SAU array de blocuri (backward-compatible). `buildSystemBlocks({persona,industry})`
>   produce [L1(cache_control), L2-per-verticală(cache_control) dacă industria e mapabilă, directivă rol activ(fără cc)].
>   L1 ~17,6k caractere ⇒ ≥4096 tokeni (clear pragul Opus 4.8 chiar la chars/4). 2 breakpoints (din 4). L3 client + L4 cererea
>   rămân în mesajul user (necache-uite) — regula de aur: zero volatile în prefix.
> - **9 callable-uri** mutate pe `buildSystemBlocks` + cele 4 inline (campaign/insight/report/runLpModel) CONSOLIDATE pe runAiJson
>   (sursă unică). `LP_SYSTEM` eliminat (persona în personas.js). Verticala vine din lead.industry (admin) / profile.industry (self).
> - **Ghid Admin:** secțiune nouă `opAi` (7 itemi) „Cum funcționează AI-ul: Fundația stratificată și caching-ul" (de ce Fundație,
>   4 straturi, exemplu HoReCa, ce e caching, exemplu numeric 500→165, regula de aur, limite practice) — ro+en paritate.
> - **Teste:** pur `scripts/test-personas.ts` (structură blocuri + plasare cache_control + invarianți volatilitate + prag 4096
>   + mapare verticală) + e2e **TEST FND** (buildSystemBlocks re-exportat din index.js → dovedește încărcarea require-ului).
> Verificat: 18/18 suites (inclusiv test-personas) + typecheck (paritate en) + e2e (FND + toate cele existente) + build + build:site + boot.
> Caching = prefix-match, cheiat pe conținut+model la nivel de organizație (nu „una pe API key"). BENCHMARKS_RO = orientative,
> de calibrat cu Andrei pe date reale. Următorii pași AI: memoria project_dataread_ai_roadmap (grounding ieftin → benchmarks reali → structură livrabile).

**2026-06-23 - Task Completed — AI felia 2: quick wins grounding**
> Model: Claude Opus 4.8 (1M context). A doua felie din roadmap-ul AI: re-injectează date deja prezente ca generările să fie
> specifice, nu generice (grounding ieftin, atinge mai multe callable-uri).
> - **adBudget în leadContextBlock:** bugetul de reclame (AD_BUDGET_RO) e acum în TOATE prompturile pe lead (campanie/insight/
>   raport/canale), nu doar la „Oportunități". Eliminat dublajul din buildChannelsPrompt.
> - **Verdict pe obiectiv (buildInsightPrompt):** regulă explicită — calibrează verdictul după obiectivele firmei (awareness/
>   trafic → reach/CPM/CTR, NU penaliza ROAS mic; leads → CPL; sales → ROAS/AOV). Campania nu are obiectiv propriu → folosim
>   obiectivele firmei (deja în leadContextBlock).
> - **Carry-over canale (channelRecsBlock → buildCampaignPrompt):** dacă lead-ul are channelRecommendations (din pasul
>   „Oportunități"), promptul de campanie le rezumă (titlu + obiectiv + ofertă sugerată) ca generarea să se alinieze. Gol dacă lipsesc.
> - **clampText (truncare grațioasă):** taie pe graniță de propoziție/cuvânt (nu slice brut la mijloc de cuvânt), aplicat pe
>   output-urile lungi AI: campanie (8000), insight (4000), raport (6000) + cele 4 self (prin helperul `sl`). Plasă de siguranță.
> - **Mesaj de refuz acțional** în runAiJson (sugerează ce să reformuleze).
> - Exporturi noi pt. e2e: buildCampaignPrompt, buildInsightPrompt, clampText.
> Verificat: 18/18 suites + e2e **TEST GND** (clampText prefix curat + carry-over + regula de obiectiv + adBudget în context) + build.
> DEPLOYED: functions (fără frontend → fără hosting). Felia 3 roadmap: benchmarks de judecată (BENCHMARKS_RO reali + framework-uri).

**2026-06-23 - Task Completed — AI felia 3: framework-uri de judecată aplicate per-sarcină**
> Model: Claude Opus 4.8 (1M context). A treia felie din roadmap-ul AI. Cunoașterea framework-urilor era deja în persone (L1,
> din felia 1); felia 3 le face APLICATE pe sarcina concretă (model-ul nu doar „știe" AIDA, ci e instruit să-l folosească pe
> ACEASTĂ campanie) + închide bucla benchmark→verdict (L2 era prezent, dar nu folosit explicit).
> - **buildInsightPrompt:** compară fiecare KPI cu reperele de industrie din Fundație (L2) + diagnostic pe pâlnie (localizează
>   UNDE se rupe: impresii→click→lead→client) și recomandă fix-ul pentru acel punct.
> - **buildCampaignPrompt:** copy structurat pe PAS/AIDA + pornit de la stadiul de conștientizare al publicului.
> - **buildStrategyPrompt:** fiecare direcție ancorată în STP (Segmentare/Targetare/Poziționare).
> - **buildOpportunitiesPrompt:** prioritizare ICE (Impact × Încredere × Ușurință).
> - **buildChannelsPrompt:** ordonare ICE (nu doar impact).
> Prompt-only (funcții pure), zero schimbări de schemă/cost. Verificat: 18/18 suites + e2e **TEST FW3** + build. DEPLOYED: functions.
> NB: BENCHMARKS_RO rămân orientative — calibrarea cu date reale = task Andrei. Felia 4 roadmap: grounding big-bet (trend MoM,
> memorie insight anterior, campaniile live ale clientului).

**2026-06-23 - Task Completed — AI felia 4: big bet grounding real (date live)**
> Model: Claude Opus 4.8 (1M context). Cel mai mare „bet" din roadmap-ul AI: generările folosesc date REALE, nu doar
> contextul declarat. Toate citirile noi = best-effort (try/catch → nu rup generarea de bază).
> - **Trend MoM (performClientReport):** citește metricile (Promise.all, max 25 campanii), MoM pe UNIUNEA metricilor
>   (`monthlyMoM`) → secțiunea „TREND" în raport (cheltuit/lead-uri/venit/ROAS luna precedentă → curentă cu delte %).
> - **Memorie de insight (performCampaignInsight):** citește campaignInsights/{id} anterior → `prevInsightBlock` în prompt
>   (continuitate: verifică dacă recomandările trecute au fost aplicate/au funcționat). Rămâne admin-only (fără scurgere la client).
> - **Self Marketing cu campaniile live (selfGenerateStrategy/Opportunities):** `campaigns where clientUid==uid` (limit 25,
>   DOAR datele proprii) → `liveCampaignsBlock` în prompt; strategia/oportunitățile se bazează pe performanța reală, nu doar profil.
> - Helperi puri: monthlyMoM/momReportLine/liveCampaignsBlock/prevInsightBlock (exportați, testați e2e TEST GND4). Prompt-builder-ele
>   capătă param opțional nou (backward-compatible). Bug prins de e2e: buildClientReportPrompt neexportat → reparat.
> - **Review adversarial (3 lentile):** prins bug HIGH — agregarea MoM amesteca luni nealiniate între campanii (cur=mai dintr-o
>   campanie + cur=martie din alta, sub aceeași etichetă) → REPARAT prin MoM pe uniunea metricilor (un singur monthlyMoM). Plus
>   MEDIUM (citiri N+1 nemărginite → Promise.all + cap 25) + LOW (query self nemărginit → limit 25). Izolare multi-tenant: OK
>   (clientUid==uid, scris doar de Admin SDK). LOW pre-existent: fereastră clientUid stale la reconectare lead (se auto-vindecă).
> Verificat: 18/18 suites + e2e (TEST GND4) + build. DEPLOYED: functions. Felia 5 roadmap: livrabile string→scheme tipate.

**2026-06-23 - Task Started — AI felia 5a: livrabile campanie+content string → scheme tipate**
> Model: Claude Opus 4.8 (1M context). A 5-a felie din roadmap-ul AI, increment 5a (doar campanie+content; insight/raport
> rămân string în 5b/5c). Livrabilele-listă devin ARRAY-uri de obiecte editabile → editare granulară + pregătire A/B pe
> variantă + publicare (north star). Clean break: nu există date de producție (doar teste sacrificabile) — coerce normalizează
> orice formă veche (string) la liste goale, fără migrare.

**2026-06-23 - Task Completed — AI felia 5a: livrabile campanie+content string → scheme tipate**
> Model: Claude Opus 4.8 (1M context). Livrabilele AI (campanie+content) au trecut de la blob-uri STRING la SCHEME TIPATE.
> Structurare SELECTIVĂ: listele devin array-uri de obiecte; proza rămâne proză (campaignStructure, notes).
> - **Forme noi (src/types/request.ts, REQUEST_SCHEMA=2):** campaign = `adVariants:{hook,body,cta,angle,stage}[]` (stage enum
>   rece/cald/fierbinte) + `videoScripts:{concept,script}[]` + `campaignStructure` (proză) + `notes`; content =
>   `calendar:{day,theme,format,channel}[]` (format enum poza/reel/carusel/text/story/video) + `posts:{text,hashtags,visual}[]`
>   + `ideas:string[]` + `notes`. Plafoane + enum-uri exportate dintr-un singur loc; `coerceToDeliverables`/`coerceToMarketingRequest`
>   normalizează orice (format vechi string / gunoi → liste goale, fără throw). NOU `deliverablesToSections(t,kind,del)` =
>   flatten array→secțiuni {label,body} (reutilizat de copy/PDF în admin ȘI portal — anti-drift; exclude notes implicit).
> - **functions/index.js:** CAMPAIGN_SCHEMA/CONTENT_SCHEMA → array-de-obiecte (enum stage/format); NOU `clampDeliverables(kind,out)`
>   = port 1:1 al coerce-ului TS (plafoane/enum replicate ca tabele JS, paritate prinsă de e2e), întoarce DOAR câmpurile tipului
>   (FĂRĂ notes) → `set({merge:true})` păstrează nota internă a operatorului; `hasPrev` + `clientSafeDeliverables` rescrise
>   array-aware (whitelist neschimbat; valoare = listă ne-goală SAU proză ne-goală); `buildSourceBrief` citește `req.adVariants`.
> - **UI:** `LeadRequests.tsx` editor pe ITEMI (add/remove variantă, câmpuri per item din metadata, `<select>` pt. enum); save +
>   restore + merge-după-AI trec prin coerce (NU `.slice`/`typeof===string` pe array — altfel livrabilele „dispăreau" silent);
>   `AppHome.tsx` (MarketingPortal + VersionHistory) păstrează valoarea brută prin coerce și afișează prin `deliverablesToSections`.
> - **Riscul principal (regresia string→array):** cele 3 filtre `typeof===string` (merge generateWithAi, portal, VersionHistory)
>   + `save` cu `.slice` pe array — toate rescrise array-aware.
> Verificat: typecheck + 18/18 suites (test-normalisers typed) + e2e (TEST DELIV paritate clamp JS↔coerce TS + TEST V clientSafe
>   array-aware + LPSRC adVariants) + build + boot-smoke. Review adversarial (3 lentile: regresie/paritate/merge-privacy) cu
>   verificare per finding. DEPLOYED: functions + hosting. Felii rămase: 5b (insight.actions[]), 5c (raport kpis[]/highlights[]).

**2026-06-23 - Task Started — AI felia 5b: insight de campanie actions string → actions[] tipat**
> Model: Claude Opus 4.8 (1M context). Incrementul 5b din roadmap-ul AI. `campaignInsights.actions` e azi blob string
> („3-5 acțiuni numerotate") → îl transformăm în `InsightAction[]{changeType,target,magnitude}` (rețeta felia 5a), pentru
> chips în UI + pregătire ca declanșatoare de automatizare/sugestii. Clean break: insight-uri vechi (string) → `[]` prin coerce.

**2026-06-23 - Task Completed — AI felia 5b: insight de campanie actions string → actions[] tipat**
> Model: Claude Opus 4.8 (1M context). Acțiunile recomandate ale analizei de campanie au trecut de la blob string la
> SCHEMĂ TIPATĂ (`InsightAction[]`), pe rețeta dovedită la 5a. `verdict` (scale/maintain/pause/test) rămâne — axă separată.
> - **src/analytics/kpi.ts:** enum-uri exportate `INSIGHT_CHANGE_TYPES` (scale/reduce/pause/keep/test, fallback keep) /
>   `INSIGHT_TARGETS` (budget/audience/creative/placement/bid, fallback budget) / `INSIGHT_MAGNITUDES` (small/medium/large,
>   fallback medium); `AiInsight.actions: string → InsightAction[]`; `coerceInsightAction` (enum cu fallback); `coerceToInsight`
>   PĂSTREAZĂ null-pe-verdict-invalid (UI tratează null = fără insight) + clean break pe actions (string/non-array → `[]`); NOU
>   `insightActionsToText` (flatten → text numerotat pt. copy/PDF).
> - **functions/index.js:** `INSIGHT_SCHEMA.actions` → array-de-obiecte (3 enum-uri, required, `additionalProperties:false` ⇒
>   modelul NU mai poate da proză); NOU `clampInsightActions` (port 1:1, exportat) lângă clampDeliverables; `performCampaignInsight`
>   scrie `schema:2, actions: clampInsightActions(out)`; `buildInsightPrompt` cere acum 3-5 acțiuni STRUCTURATE (changeType+target+
>   magnitude), nu proză (narativul stă în `reasoning`); `migrateCampaignInsights` → `schema:2, actions:[]` (clean break, fără re-parsare).
> - **MarketingCenter.tsx:** acțiunile randate ca CHIPS (changeType colorat + target + magnitude), nu proză; `reasoning` rămâne text.
> - **Riscul principal (regresia string→array):** orice `{insight.actions}` randat ca string → `[object Object]`; reparat (chips
>   + niciodată `.trim()/.slice()/.startsWith()` pe array). Singurii consumatori: kpi.ts (coerce) + MarketingCenter (chips);
>   onCampaignAutomation/SuggestionsPanel citesc doar verdict/headline (neatinse).
> - **Anti-drift:** tabele enum/plafon JS marcate „PARITATE"; e2e `TEST INS` verifică clampInsightActions JS == coerceToInsight TS
>   pe cazuri adversariale (string→[], cap 8, enum-fallback) + că FIECARE enum din INSIGHT_SCHEMA e acceptat de coerce (schema↔coerce).
> Verificat: typecheck + 18/18 suites (test-normalisers + test-analytics actualizat) + e2e (TEST INS + MIG actualizat) + build +
>   boot-smoke. Review adversarial (regresie + paritate/schema) cu verificare per finding. DEPLOYED: functions + hosting (rules
>   neschimbate). NB: insight-urile vechi (schema 1, string) arată „0 acțiuni" până la regenerare (clean break, precedent 5a).
>   Felii rămase: predicție comportamentală (PART 2 din plan), 5c (raport kpis[]/highlights[]/recommendations[]).

**2026-06-23 - Task Started — Predicție comportamentală Faza 0+1**
> Model: Claude Opus 4.8 (1M context). Felia 6 din roadmap-ul AI: funcție AI nouă care analizează clienții
> CLIENȚILOR noștri (consumatorii finali) și prezice comportamentul din istoria acumulată; motor reutilizabil
> și pe lead-urile noastre. Faza 0 = fundația de date (contacte + evenimente, ingestie forward-only). Faza 1 =
> motorul de predicție AI (operator). Decizii: subiect primar = contactul; ingestie activă acum (date de test).

**2026-06-23 - Task Completed — Predicție comportamentală Faza 0: fundația de contacte**
> Model: Claude Opus 4.8 (1M context). Fundație nouă pt. consumatorii finali ai clienților, sub `clients/{uid}/**`.
> - **Date:** `contacts/{contactId}` (identitate MASCATĂ + hash; lifecycle; rollup RFM) + `contacts/{id}/events` (append-only,
>   `at` explicit) + `contactRefs/{submissionId}` (index server-only submissionId→contactId). PII BRUT rămâne DOAR în submissions.
> - **Identitate:** `identityHash = sha256(uid:kind:valoare)` (per-tenant → necorelabil cross-tenant; email→același contact pe
>   LP-uri diferite). `src/types/contact.ts` + `contactEvent.ts` (coerce + mascare/normalizare puri); port JS în functions (paritate e2e).
> - **Ingestie (best-effort, gate `CONTACT_INGEST_ENABLED=true`):** trigger `onSubmissionCreate` (re-citește LP pt. clientUid +
>   tipuri câmpuri, extrage email/telefon, upsert contact tranzacțional + event form_submit + contactRefs) + `onLpLeadStateWrite`
>   (status_change → event + lifecycle). Sărit dacă LP n-are client conectat; fail-closed prin `clientExists`.
> - **Reguli:** contacts/events read owner+admin/write false; contactRefs read+write false.
> Verificat: typecheck + 18/18 suites + e2e TEST CONTACT (identitate determinism + mascare paritate + clamp JS↔TS) + build + boot.
> Review adversarial (PII/izolare + corectitudine triggere) → 0 defecte. DEPLOYED: functions + hosting (rules).

**2026-06-23 - Task Completed — Predicție comportamentală Faza 1: motor AI generic**
> Model: Claude Opus 4.8 (1M context). Motor UNIC de predicție peste un profil MASCAT; subiect = contact (consumatorul
> clientului) SAU lead (pipeline-ul nostru) — „același sistem și pentru noi".
> - **Schemă (`src/types/prediction.ts`):** conversionLikelihood (low/med/high) + temperature (hot/warm/cooling/cold) +
>   confidence + reasoning + nextBestActions[]{action,detail,whenDays} + caveats + dataGaps[]. confidence/caveats/dataGaps
>   OBLIGATORII (onestitate pe date subțiri). FĂRĂ churn/LTV (lipsesc date monetare). coerce + clamp JS (paritate e2e TEST PRED).
> - **functions:** `PREDICTION_SCHEMA` (additionalProperties:false) + `clampPrediction` + `buildContactProfile`/`buildLeadProfile`
>   (puri, ZERO PII brut în prompt) + `buildPredictionPrompt` + nucleu `performPrediction` (citiri best-effort, persona nouă
>   `predictor` în personas.js, claude-opus-4-8). Callable-uri admin-only `predictContactBehavior`→`contactPredictions/{id}` +
>   `predictLeadBehavior`→`leadPredictions/{id}` (consumeAiQuota, gate `PREDICTION_ENABLED`). Reguli: read admin/write false
>   (UID-ul operatorului `by` NU ajunge la client; mirror client-safe = Faza 4 ulterioară).
> - **UI:** `src/admin/PredictionPanel.tsx` (PredictionCard partajat + `LeadPrediction` în expanderul de lead + `ClientContacts`
>   = listă contacte per client cu „Prezice comportament" în expanderul de client din AdminHome).
> Verificat: typecheck + 18/18 suites + e2e TEST PRED (paritate clamp↔coerce + schema↔coerce + profil fără PII brut) + build + boot.
> Review adversarial (PII în prompt + securitate callable + paritate/UI). DEPLOYED: functions + hosting. Faze rămase: 2 (sugestii),
> 3 (warehouse: unificare identitate + events cross-LP + churn/LTV), 4 (client-facing /app cu consimțământ + fair-share).

**2026-06-23 - Task Completed — Predicție F2: sugestii din predicții (operator)**
> Model: Claude Opus 4.8 (1M context). Predicțiile pe lead alimentează acum tab-ul „Sugestii". `buildSuggestions` (pur)
> capătă input `predictions[]` + două tipuri noi: `predictionHot` (temperature hot → high, „acționează acum") și
> `predictionCooling` (cooling/cold → medium, „reactivează"); warm → fără sugestie (zgomot). `SuggestionsPanel` are
> listener nou pe `leadPredictions` (300), îmbinat cu numele firmei din leads în useMemo. Pur frontend (fără functions/rules).
> Verificat: typecheck + 18/18 suites (3 teste noi în test-landing) + build + boot. DEPLOYED: hosting. Următor: F3 (coadă merge).

**2026-06-23 - Task Completed — Predicție F3: unificare identitate + coadă merge-candidates**
> Model: Claude Opus 4.8 (1M context). Maturarea „warehouse"-ului de contacte.
> - **Auto-unificare prin alias:** când un submission are ȘI email ȘI telefon, scriem `clients/{uid}/contactAlias/{phoneHash}=
>   {contactId: emailHash}` (server-only) → viitoarele submission-uri DOAR-cu-telefon rutează la contactul de email
>   (`onSubmissionCreate` citește aliasul). identityKind se păstrează (nu flipează la 'phone' când rutează în contactul de email).
> - **Detecție duplicat retroactiv:** dacă exista deja un contact separat pe telefon înainte de submission-ul combinat →
>   `mergeCandidate=true` + `mergeWith` (arrayUnion) pe AMBELE. Patch-ul de ingestie NU atinge mergeCandidate/mergeWith/mergedInto
>   (merge:true le păstrează — fix anti-clobber).
> - **Combinare manuală:** `mergeContactDocs` (pur: rollup sumă/min firstSeen/max lastSeen, cel mai avansat lifecycle, identitate
>   unită, curăță flagul) + `performMergeContacts` (mută evenimentele, sursă→tombstone `mergedInto`) + callable admin `mergeContacts`.
>   `onLpLeadStateWrite` urmează `mergedInto` (status scris pe contactul supraviețuitor). `contact.ts` capătă `mergeWith[]`/`mergedInto`.
> - **UI:** `ClientContacts` ascunde tombstone-urile + buton „Combină duplicatul" pe candidați. Reguli: `contactAlias` read+write false.
> Verificat: typecheck + 18/18 suites + e2e TEST MERGE (merge math + orchestrare pe stub + tombstone redirect) + build + boot.
> Review adversarial → 1 HIGH + 1 LOW prinse+reparate: (HIGH) ingestia putea scrie pe un contact-tombstone (alias/refs spre
> contacte combinate) → helper NOU `liveContactId` urmează lanțul `mergedInto` în onSubmissionCreate + onLpLeadStateWrite;
> (LOW) merge-ul golea tot `mergeWith` pe țintă → acum scoate doar sursa, păstrează ceilalți candidați; + gardă „sursă deja
> combinată" (anti dublă-numărare). Teste e2e adăugate pt. ambele. DEPLOYED: functions + hosting + rules. churn/LTV rămâne
> blocat (lipsesc evenimente de valoare contact↔factură). Următor: F4 (client-facing /app).

**2026-06-23 - Task Completed — Predicție F4: client-facing /app (predicții despre clienții clientului)**
> Model: Claude Opus 4.8 (1M context). Ultima felie a viziunii: clientul vede în /app predicții despre PROPRIII lui clienți.
> - **Mirror client-safe:** trigger `onContactPredictionWrite` oglindește `contactPredictions/{id}` (admin-only, cu `by`
>   operator) în `clients/{uid}/predictions/{id}` prin `clampPrediction` (păstrează DOAR câmpurile de predicție — fără `by`/
>   clientUid/kind). Gestionează și ștergerea. Reguli: read owner+admin, write false (doar Admin SDK).
> - **UI /app:** secțiune `ContactPredictions` în AppHome — contactele clientului (mascate, non-tombstone) + predicția
>   oglindită, randată prin `predictionToSections` (read-only).
> - **Self-serve DORMANT:** callable `selfPredictContact` (clientul prezice un contact propriu) — gate `CLIENT_PREDICTION_ENABLED=false`
>   (Andrei pornește după consimțământ/acorduri GDPR). Izolare: clientUid = token (niciodată input). Garduri: App Check +
>   `assertEmailVerified` + consimțământ (refuz pe `optOut`/tombstone) + throttle re-predicție ≥6h + cotă fair-share self
>   (consumeSelfQuota + consumeGlobalSelfQuota + refundSelfQuota la eșec) — același tipar ca `selfGenerate*`.
> Verificat: typecheck + 18/18 suites + e2e (clampPrediction client-safe: fără by/clientUid/kind) + build + boot. Review
> adversarial (mirror/privacy + selfPredict gating/izolare). DEPLOYED: functions + hosting + rules.
> **Viziunea predicției comportamentale e completă (F0→F4).** Rămas pe Andrei: pornește `CLIENT_PREDICTION_ENABLED` după GDPR;
> churn/LTV când apar evenimente de valoare contact↔factură.

**2026-06-23 - Task Completed — UI: reorganizare panou „Site" (Design & Pagini)**
> Model: Claude Opus 4.8 (1M context). Optimizare UX cerută de Andrei pe tab-ul Design & Pagini → Site.
> - **Preview LIVE al paginii reale:** iframe pe ruta aleasă (homepage implicit) + selector de pagină + „Reîncarcă" +
>   „Deschide" în tab nou. Reflectă tema/chrome PUBLICATE; se reîncarcă automat după „Salvează & publică". (Înlocuiește
>   focusul pe cardul demo — care rămâne ca preview INSTANT al editărilor nepublicate, în interiorul editorului.)
> - **Toate paginile vizibile:** secțiune „Pagini platformă" (read-only) cu rutele React (Acasă/Pachete/Self Marketing/
>   Start/Contact/Termeni/Confidențialitate/Portal client) — fiecare cu „Previzualizează" (în iframe) + „Deschide" + buton
>   „Editează designul". Paginile editabile din LP Studio (kind:'site') rămân dedesubt.
> - **Sistem de design COLAPSAT implicit:** editorul de temă + Header/Footer nu mai ocupă spațiu la deschidere — se deschid la
>   cerere (toggle „Sistem de design"). Conținutul/logica de publicare neatinse.
> Frontend-only (SiteAdminPanel.tsx + i18n ro/en). Verificat: typecheck + 18/18 suites + build. Hosting fără X-Frame-Options →
> iframe same-origin OK. DEPLOYED: hosting.

**2026-06-23 - Task Completed — Editare per-pagină Felia A: temă per pagină + temare /app**
> Model: Claude Opus 4.8 (1M context). Prima felie din „editez fiecare pagină" (aspect; conținutul = Felia B ulterioară).
> Rezolvă și plângerea: editai designul previzualizând /app dar /app nu se schimba (avea temă proprie).
> - **Date:** `siteConfig/pageThemes` (UN doc, map `themes[pageKey]=CustomTheme`; pageKey ∈ home/pachete/self/start/contact/
>   termeni/confid/app). `src/types/pageThemes.ts` (coerce: include DOAR cheile prezente → o pagină fără override NU primește
>   temă default; pageThemeFor/pageKeyForSlug). Reguli: extins allowlist-ul `siteConfig` cu `pageThemes` (read public, write admin, themes is map).
> - **Aplicare:** `usePagePublicTheme(slug)` în PublicTheme.tsx — global (snapshot→runtime, gardă webdriver) + override per slug;
>   aplicat pe `.theme-banner` în SiteLayout (același pattern hibrid → fără hydration drift). `/app`: `useAppPageTheme()` în AppHome
>   învelește conținutul în `customThemeStyle(pageThemes.app)` dacă există (altfel aspectul default neschimbat) → editarea designului „Portal client" îl afectează.
> - **UI admin (SiteAdminPanel):** editor de design PER SCOP — selector „Aplici designul pe: Global / o pagină"; „Salvează & publică"
>   scrie în publicTheme (global) sau pageThemes.themes[pageKey]; „Resetează la tema globală" (șterge override-ul); buton „🎨 Design"
>   per rând de pagină (setează scopul + deschide editorul); preview-ul live arată pagina aleasă și se reîncarcă după publicare.
>   Anti-clobber: `initRef` inițializează copia de lucru o singură dată (snapshot-urile ulterioare nu suprascriu editările).
> Verificat: typecheck + 18/18 suites (coerceToPageThemes) + build + boot. Review adversarial (hydration/prerender + reguli/editor).
> Frontend + rules. DEPLOYED: hosting + rules. Felia B (conținut editabil per-pagină) = următoarea.

**2026-06-23 - Task Completed — Fix preview /admin: „mă trimite la login" + mod preview (?preview=1)**
> Model: Claude Opus 4.8 (1M context). Plângere: la „Previzualizează" în panoul Site, iframe-ul trimitea operatorul la login.
> Cauză reală: iframe-ul (același origin) rula aplicația completă cuplată la auth — `/app` cerea login (afișa AuthPanel în
> preview) și side-effect-urile Firebase Auth ale iframe-ului (ensureClientDoc ca admin + refresh token pe același IndexedDB)
> puteau perturba sesiunea operatorului. Sandbox-ul oprea doar top-navigation, nu asta.
> - **`src/app/previewMode.ts` (NOU):** `isPreviewSearch(search)` / `isPreviewNow()` — detectează `?preview=1`.
> - **`AppHome.tsx`:** în mod preview randează `<AppThemePreview theme={appTheme}>` (shell tematizat real: antet + carduri demo,
>   data-page="app-theme-preview") ÎNAINTE de gardul de auth → fără login; effect-ul de cont e sărit. FĂRĂ date de client.
> - **`useAuthInit.ts`:** în mod preview sare ensureClientDoc + getIdTokenResult → iframe-ul nu mai scrie/împrospătează sesiunea.
> - **`SiteAdminPanel.tsx`:** iframe-ul de preview încarcă `${path}?preview=1` (linkurile „Deschide ↗" rămân spre pagina reală autentificată).
> Verificat: typecheck + 18/18 suites + build + boot (test NOU `/app?preview=1 → shell tematizat (fără login)`). Review adversarial
> (bypass auth/scurgere date + corectitudine hooks/i18n). Frontend-only. DEPLOYED: hosting.

**2026-06-23 - Task Completed — Catalog Servicii (Felia 1): pagină /servicii + cerere etichetată pe serviciu**
> Model: Claude Opus 4.8 (1M context). Integrarea celor 7 servicii din infografia DataRead (Audit, SaaS & platforme,
> Automatizări, Creare site web, Self Marketing, Automatizare SEO, SMS+Email). Felia 1 = prezentare + intake; modulele
> software lipsă (SEO, SMS/Email) = felii ulterioare.
> - **`src/config/services.ts` (NOU):** sursa unică — SERVICE_IDS (7), ServiceDef{emoji,bulletCount,cta:'lead'|'self'},
>   isValidServiceId/getService/serviceBulletKeys/serviceNameKey. CTA: self → produs live (/self-marketing), restul → cerere
>   etichetată (/start?service=id).
> - **`src/site/Services.tsx` (NOU):** pagină publică /servicii (data-page="services") — hero + 4 pastile de valoare + grilă 7
>   carduri (emoji/nume/tagline/bullet-uri din imagine) + CTA pe card + CTA final. Prerenderizată (rută publică).
> - **Tag de serviciu pe lead:** OnboardingData.serviceInterest (opțional, nullable, coerce-uit prin isValidServiceId — nu sparge
>   lead-urile vechi). StartPage citește ?service= + chip „Serviciu de interes". AdminHome: linie în detaliu + coloană CSV + chip
>   în tabel (lângă „🔎 Self").
> - **Integrare:** publicRoutes /servicii (+EN, prerender+sitemap), App.tsx PAGE_FOR_SLUG, default chrome nav (Servicii primul;
>   niciun doc publicChrome în Firestore → default-ul e live), teaser pe homepage, pageThemes PAGE_KEYS+slug 'servicii' (temabilă),
>   SiteAdminPanel PLATFORM_PAGES (apare în preview + editor temă). i18n complet ro+en (services.*, nav.services, seo.services*,
>   admin.fService, start.serviceInterest, pg_servicii).
> Verificat: typecheck + 20/20 suites + build + prerender (18 pagini, sitemap 14 URL) + boot (test NOU /servicii).
> **Review adversarial — bug HIGH real prins & reparat:** câmpul nou `serviceInterest` (mereu prezent ca `null` — SDK-ul
> serializează null ca field) NU era în whitelist-urile `hasOnly([...])` din firestore.rules → ar fi respins TOATE lead-urile
> publice ȘI onboarding-ul de client (nu doar /servicii). Build/typecheck nu prind (eșec runtime de reguli). Fix: adăugat
> `serviceInterest` în ambele whitelist-uri (leads + onboarding) + gardă null/string≤40 pe leads. **Plasă anti-regresie:**
> `scripts/test-rules.ts` (NOU) leagă cheile emptyOnboarding() de ambele whitelist-uri — pică dacă un câmp nou e uitat din reguli.
> Frontend + REGULI. DEPLOYED: hosting + firestore rules.

**2026-06-23 - Task Completed — Temă consistentă pe TOATE paginile /app/* (layout comun)**
> Model: Claude Opus 4.8 (1M context). Plângere (screenshot): /app/self-marketing (și celelalte pagini sub /app) apăreau
> albe — Felia A pusese tema portalului (pageThemes.app) DOAR pe /app (AppHome), nu și pe rutele imbricate.
> - **`src/app/appPageTheme.ts` (NOU):** `useAppPageTheme()` extras din AppHome (best-effort getDoc + gardă webdriver).
> - **`src/app/AppThemeLayout.tsx` (NOU):** layout route care aplică `customThemeStyle(pageThemes.app)` + minHeight:100vh O
>   SINGURĂ DATĂ pe un wrapper, prin `<Outlet/>` → toate /app/* (/, /onboarding, /self-marketing, /ghid) moștenesc tema.
> - **App.tsx:** rutele /app/* grupate sub `<Route element={<AppThemeLayout/>}>`.
> - **AppHome.tsx:** scos wrapper-ul propriu de temă + hook-ul local (layout-ul preia); AppThemePreview nu mai învelește singur.
> Verificat: typecheck + 20/20 suites + build + boot (/app?preview=1 shell tematizat + /app auth panel intacte). Review adversarial
> (single-agent): CLEAN — fără dublă-temare, ordine hooks ok, fără importuri orfane. Frontend-only. DEPLOYED: hosting.

**2026-06-23 - Task Completed — Buton header stilizabil + animații (CTA per item de meniu, customizabil din admin)**
> Model: Claude Opus 4.8 (1M context). Cerere: butonul „Self Marketing" din header cu stil + animații, customizabile manual.
> Generalizat la ORICE item de meniu, editabil din /admin → Site → Header.
> - **siteChrome.ts:** ChromeItem +emphasis (none/solid/outline/glow/gradient) +anim (none/pulse/shine/bounce/flash) +color
>   (hex). Coerce sigur (enum-only + HEX6 → fără injecție); helper `chromeItemClass`.
> - **styles.css:** clase `.navcta*` + keyframes `navcta-*` + gardă prefers-reduced-motion; `--navcta-color` bate var(--accent).
> - **SiteLayout.tsx:** nav randează clasa + culoarea per item (link simplu rămâne neschimbat).
> - **ChromeEditor.tsx:** per item de nav — select Stil + Animație + culoare (input color + „Auto"); preview live cu clasele aplicate.
> - **functions/index.js (serveLp, paritate):** chromeItemsJs coerce emphasis/anim/color; navHtml cu clase + `--navcta-color`;
>   `NAVCTA_CSS` injectat (identic cu styles.css) doar când există item stilizat. DEFAULT_SITE_CHROME sincronizat cu TS (+Servicii).
> - **Default:** „Self Marketing" evidențiat (gradient + sclipire) — customizabil.
> Securitate: color = doar #rrggbb (regex în TS+JS) + lpEscape; clasele doar din enum-uri → fără injecție CSS/HTML. Bonus: am reparat
> driftul de paritate chrome TS↔JS introdus de felia Servicii (DEFAULT_SITE_CHROME nu avea „Servicii").
> Verificat: typecheck + 20/20 suites + build + boot + **e2e (paritate chrome TS↔JS ✓)**. Review adversarial (injecție + paritate): CLEAN.
> Frontend + functions. DEPLOYED: hosting + functions.

**2026-06-23 - Task Completed — Servicii Felia 2: comenzi de servicii (operator pe lead/client + client din /app)**
> Model: Claude Opus 4.8 (1M context). Model „1+3": operatorul gestionează comenzi de servicii din /admin ȘI clientul logat
> își poate cere singur un serviciu din /app. Colecție DEDICATĂ (nu suprascriu pipeline-ul AI campaign/content).
> - **`src/types/serviceOrder.ts` (NOU):** ServiceOrder {service, status(requested/in_progress/delivered/cancelled),
>   source(operator/client), clientUid, leadId, companyName, contact, note, deliverable} + coerceToServiceOrder (defaults sigure)
>   + culori status. CLIENT-SAFE: doc fără note interne/UID operator.
> - **`firestore.rules`:** colecția `serviceOrders` — admin = tot; client citește DOAR comenzile lui (clientUid==uid); creare de
>   client STRICT constrânsă (source 'client', status 'requested', fără livrabil/leadId, clientUid==uid, whitelist hasOnly,
>   createdAt==request.time); update/delete doar admin. Anonim = blocat.
> - **`src/app/ServiceOrdersPortal.tsx` (NOU):** secțiune în /app — listă proprie (query where clientUid==uid, FĂRĂ orderBy →
>   fără index compozit, sortat client-side) + „Cere un serviciu" (creează serviceOrder). Vede statusul + livrabilul.
> - **`src/admin/ServiceOrdersPanel.tsx` (NOU):** tab „Comenzi servicii" — board cu toate comenzile, filtru status, schimbare
>   status, editare livrabil (vizibil clientului), creare comandă (operator, opțional legat de un client prin uid), ștergere.
> - i18n complet ro+en (serviceOrders.* + admin.svc.* + admin.navServiceOrders).
> Verificat: typecheck + 20/20 suites (coerceToServiceOrder + paritate whitelist serviceOrders în test-rules) + build + boot.
> Review adversarial (securitate reguli/izolare + corectitudine). Frontend + REGULI (fără functions). DEPLOYED: hosting + rules.

**2026-06-23 - Task Completed — Modul Automatizare SEO (Felia 1): audit on-page automat (URL) + recomandări AI**
> Model: Claude Opus 4.8 (1M context). Al treilea serviciu din catalog construit ca funcție software. Audit SEO on-page
> AUTOMAT pe un URL + recomandări AI grounded pe semnale REALE.
> - **`functions/index.js`:** `seoAudit` callable (operator + App Check + AI gate + quota). Gardă anti-SSRF `isPublicHttpUrl`
>   (blochează localhost/metadata/IP private/IPv6/porturi non-standard; re-validează URL-ul FINAL după redirecturi). Fetch cu
>   timeout 8s + plafon ~800KB + check text/html. `extractSeoSignals` (regex pur: titlu/meta/H1-H3/imagini-alt/linkuri int-ext/
>   canonical/OG/viewport/lang/densitate cuvânt-cheie). `scoreSeoSignals` (scor 0-100 DETERMINIST + probleme critical/warning/good).
>   `runAiJson` (SEO_RECO_SCHEMA, persona strategist) → recomandări prioritizate, grounded pe semnale+probleme; dacă AI eșuează,
>   întoarce auditul determinist. Quota se consumă DOAR după fetch reușit. Persistă în seoAudits.
> - **`src/types/seoAudit.ts` (NOU):** tipuri + coerceToSeoAudit (consumat de UI) + seoGrade (A-F).
> - **`firestore.rules`:** seoAudits (admin read; write false — doar functions).
> - **`src/admin/SeoPanel.tsx` (NOU):** tab „SEO" — URL+keyword → audit (scor+notă, semnale, probleme, recomandări AI) + istoric.
> - i18n ro+en. Teste: e2e (SSRF guard + extract + score + prompt grounding, ~23 aserții) + test-seo (coerce+grade+i18n).
> Monitorizare ranking SERP = felie ulterioară (necesită chei API la Andrei → dormant). Audit URL extern = SSRF-guarded (admin-only).
> **Review adversarial (SSRF) — 3 fix-uri aplicate:** (1) MEDIUM redirect-SSRF: `redirect:'follow'` accesa ținta internă înainte de
> re-validare → trecut pe `redirect:'manual'` cu validare per-hop (max 5); (2) bypass FQDN cu punct final (`metadata.google.internal.`
> ocolea endsWith) → normalizez host-ul (scot punctele finale) + regresie e2e; (3) buffering nelimitat (arrayBuffer) → citire pe stream
> cu plafon de octeți (~1MB) + check content-length. DNS-rebinding = rezidual acceptat (admin-only, documentat). Host-parsing (octal/hex/
> IPv4-mapped/userinfo) = deja blocat de normalizarea WHATWG (verificat).
> Verificat: typecheck + 21/21 suites + build + boot + e2e (gardă SSRF + regresii). Frontend + functions + reguli. DEPLOYED: hosting + rules + functions.

**2026-06-23 - Task Completed — Quick wins (audit multi-agent): 6 îmbunătățiri pe platforma existentă**
> Model: Claude Opus 4.8 (1M context). După un audit multi-agent (7 dimensiuni → 42 idei sintetizate), pachetul de quick wins:
> 1. **Anti-injecție `buildSeoPrompt`** — conținutul extern adus de audit-ul SEO primește nota „date, nu instrucțiuni" (ca prompturile self-*).
> 2. **Plafon GLOBAL zilnic AI operatori** — `consumeAiQuota` adaugă coșul `aiUsage/__operatorGlobal` (AI_OPERATOR_GLOBAL_DAILY_CAP=400) în aceeași tranzacție (read-before-write) → backstop de cost contra buclă/cheie scursă.
> 3. **Sugestiile deschid direct lead-ul** — SuggestionsPanel pasează `leadId`; AdminHome face setOpenLead + scrollIntoView (id pe rând). **Fix de review:** resetează filtrul/căutarea persistate, altfel lead-ul ascuns făcea „Deschide" inert.
> 4. **Buton „Audit SEO" pe lead** — pre-completează URL-ul (detail.website) → SeoPanel(initialUrl) + tab SEO.
> 5. **Filtre/căutare persistate** — `src/utils/persistedState.ts` (usePersistedState, prefix dataread); leadFilter/leadSearch + filtrul ServiceOrders nu se mai resetează la refresh.
> 6. **Instrumentare funnel** — track() nou: packages_view + package_cta, start_view + form_start (o dată), contact_view, self_marketing_view.
> Verificat: typecheck + 21/21 suites + build + boot + e2e. Review adversarial single-agent (5/6 corecte; gap sinergic filtre↔deep-link reparat). Frontend + functions. DEPLOYED: hosting + functions.

**2026-06-23 - Task Completed — Hardening securitate #7 + #8 (din auditul multi-agent)**
> Model: Claude Opus 4.8 (1M context). Pachetul de securitate; #9 (suită reguli pe emulator) AMÂNAT (vezi mai jos).
> - **#7 Anti-abuz pe endpointurile publice `/p/_submit` & `/p/_track`** (neautentificate): rate-limit zilnic
>   tranzacțional per-IP (`clientIpHash` = sha256(primul XFF), fără PII brut) + per-slug, în `abuseGuard/{key}_{day}`
>   (reguli: read admin, write false). Plafoane: submit 30/IP + 500/slug (→429), track 1000/IP (→204). Fail-OPEN la
>   eroare de guard (nu rupe traficul legit). App Check hard-enforce = NEfezabil (paginile LP servite n-au SDK App Check
>   → ar rupe submit-urile) — notat ca limitare; honeypot + rate-limit rămân apărarea.
> - **#8 Gardă de calitate în `runAiJson`**: detectează `stop_reason==='max_tokens'` (livrabil TRUNCHIAT → aruncă, nu mai
>   trece tăcut) + răspuns gol → eroare clară. Bug-ul „livrabil plătit tăiat la mijloc trece ca valid", închis pentru TOATE
>   callable-urile AI dintr-un loc.
> Verificat: typecheck + 21/21 suites + build + boot + e2e (bloc NOU ABUSE: clientIpHash + lpRateExceeded cap/izolare;
> fakeFirestore capătă runTransaction). DEPLOYED: hosting + rules + functions.
> **#9 AMÂNAT (onest):** suita de reguli pe emulator necesită Firestore emulator (Java 11+) + `@firebase/rules-unit-testing`;
> mediul are doar Java 1.8 și libul nu e instalat → NU poate fi rulată/verificată aici. De făcut în CI/mediu cu Java 11+
> (rămâne pe lista de îmbunătățiri).

**2026-06-23 - Task Completed — Capabilități AI #10+#11 (din audit): prioritizare inbox + ciornă follow-up**
> Model: Claude Opus 4.8 (1M context). Valorifică predicția + comunicarea deja construite, închizând bucla operator.
> - **#10 `leadPriority`** (`src/admin/leadPriority.ts`, PUR): scor DETERMINIST 0-100 („pe cine sun primul azi") care
>   CONSUMĂ predicția AI existentă (temperature+conversionLikelihood din leadPredictions) + recență + status + follow-up
>   scadent → tier high/medium/low + motiv dominant. AdminHome: listener pe `leadPredictions` (admin-read), toggle sort
>   „Recente/Prioritate" (persistat), badge ★scor pe rând (titlu = motiv i18n). FĂRĂ AI nou (instant, fără cost, explicabil).
>   LeadRow capătă createdAtMs + nextFollowUpMs. Test `scripts/test-leadpriority.ts`.
> - **#11 `aiDraftFollowUp`** (callable AI nou, operator + App Check + quota): citește lead-ul + activitățile CRM recente +
>   predicția (best-effort) → persona accountManager + `buildFollowUpPrompt` (nota anti-injecție) → ciornă {subiect, corp}.
>   NU trimite/persistă (operatorul revizuiește). UI: buton „✨ Ciornă AI" în `LeadActivity` umple composer-ul de email
>   (peste `sendLeadEmail` deja construit). Quota consumată DOAR după ce lead-ul există.
> Verificat: typecheck + 22/22 suites (test-leadpriority nou) + build + boot + e2e (bloc FOLLOWUP: sumar+prompt+nota).
> Review adversarial single-agent: CLEAN pe 7 verificări (securitate callable, paritate i18n motive, hooks, izolare). DEPLOYED: hosting + functions.

**2026-06-23 - Task Completed — Conversie & portal #12+#13+#14 (din audit)**
> Model: Claude Opus 4.8 (1M context). Ultimul pachet din auditul multi-agent. Frontend-only.
> - **#12 Scurtare `/start`**: `validateOnboarding(d, mode)` — mod 'lead' (public) cere DOAR nucleul (firmă+nume+CEL PUȚIN
>   un contact+obiectiv); industrie/buget/descriere/social = OPȚIONALE. Mod 'full' (cont /app) = neschimbat (default,
>   backward-compatible). `OnboardingFields` capătă `leadMode`: nucleu vizibil + „Adaugă mai multe detalii (opțional)"
>   colapsat (se auto-deschide dacă un câmp opțional are eroare). Modelul `leads` NESCHIMBAT (coerce tolerează golurile).
>   Teste lead-mode în test-onboarding-validate.
> - **#13 Bară „Următorul pas" în `/app`**: derivată din date deja încărcate (onboardingDone/subActive) → o singură
>   direcție (completează profilul → alege pachet → generează strategie). Fără date noi, fără hooks noi.
> - **#14 Dovadă socială pe site**: `src/config/socialProof.ts` (cifre/capabilități ADEVĂRATE) + `SocialProof.tsx` între
>   „Ce facem" și catalog. **ONESTITATE: testimonialele rămân GOALE până le dă Andrei** (citate reale + acord) — componenta
>   le afișează doar când există; NU inventăm pe site live.
> Verificat: typecheck + 22/22 suites + build + boot (incl /start). Review adversarial single-agent: CLEAN (niciun câmp pierdut
> în refactor, 'full' neschimbat, paritate i18n). Frontend-only. DEPLOYED: hosting. **TODO Andrei:** testimoniale reale în socialProof.ts.

**2026-06-25 - Task Completed — Fundație design + accesibilitate (din auditul UI) + self-fix bug „Servicii" header**
> Model: Claude Opus 4.8 (1M context). Răspuns la „analizează starea UI-ului + sugestii". Am rulat un audit UI multi-agent
> (5 perspective, 30 sugestii) → utilizatorul a ales pachetul „Fundație design + a11y". Frontend/CSS-only.
> - **Tokeni de design** în `src/styles.css` `:root`: scară de spațiere (`--space-1..7`), tipografie (`--text-xs..display`),
>   raze (`--radius-sm/lg/pill`) + **culori semantice de stare** (`--success/--warn/--danger/--info` + `-soft`) cu paletă
>   pentru fundal DESCHIS în `:root` și ÎNTUNECAT în `.theme-banner` (pe dark, variantele light pică sub AA).
> - **Injectare per temă** (`src/theme/themes.ts`): `semanticVars(bg0)` alege paleta după luminanța fundalului și e
>   adăugată în `themeStyle`/`customThemeStyle`/`customThemeCss` → admin (orice preset), `/app` și paginile per-pagină
>   primesc automat `--danger` etc. potrivite, fără a extinde modelul `AdminTheme`.
> - **`:focus-visible` global**: inel de focus VIZIBIL (2px accent) la navigarea cu tastatura pe ORICE element focusabil
>   (multe butoane inline cu `border:none` erau invizibile la Tab — eșec WCAG 2.4.7); `:focus:not(:focus-visible)` curăță
>   inelul UA la click cu mouse-ul. Verificat în preview: regula e în stylesheet; mouse/programatic = fără inel, Tab = inel.
> - **Label-uri reale pe `AuthPanel`**: inputurile (nume/email/parolă) sunt acum în `<label>` cu text VIZIBIL (era doar
>   placeholder, care dispare la tastare și nu e citit de screen-reader). (`OnboardingFields` avea deja label-uri.)
> - **Contrast**: `.theme-banner --fg-1` ridicat la `#aebcd8` (≈7.5:1 pe navy, era ≈6.1:1).
> - **`.chip` + base `.section-title`**: clasă unică de pill (înlocuiește stiluri inline copiate) + scară unică de titlu de
>   secțiune (`var(--text-2xl)`), aplicate în `Landing.tsx` (chips catalog + 4 titluri, fără mărimi inline divergente).
> - **Literali de status → tokeni** în fișierele atinse (AuthPanel/OnboardingFields/SiteAdminPanel): `#c0392b`→`var(--danger)`,
>   `#1e7e34`→`var(--success)`, `#e05666`→`var(--danger)`.
> - **Self-fix bug live „Servicii" lipsă din meniu:** docul `siteConfig/publicChrome` publicat e mai vechi decât catalogul
>   → override-ul runtime ascunde „Servicii" + CTA-ul stilizat. NU am cale de scriere admin în Firestore din acest mediu
>   (fără ADC/service-account; reguli = write admin-only). Soluție livrabilă: buton **„↺ Meniul implicit"** în ChromeEditor
>   (`SiteAdminPanel`) care reîncarcă `PUBLIC_CHROME_DEFAULT` (deja conține Servicii + Self Marketing stilizat) → Andrei dă
>   „Salvează & publică" (o singură dată, ~10s). Snapshot-ul copt a fost lăsat cu Servicii (NU am rulat pull-public-chrome,
>   care ar fi re-copt docul stale).
> Verificat: typecheck + 22/22 suites + build + boot (10/10) + preview live (chip/section-title/labels/--danger dark/focus-visible).
> DEPLOYED: hosting + rules. **TODO Andrei (≈10s):** /admin → Design & Pagini → Site → (deschide design) → Header & Footer →
> „↺ Meniul implicit" → „Salvează & publică" pentru a aduce „Servicii" în meniul live. Restul auditului (mobile/hamburger,
> skeletoane /app, badge-uri /admin, /servicii/:id, sweep literali în 36 fișiere) = pachete viitoare.

**2026-06-25 - Task Completed — FIX critic: publicarea în /admin scotea operatorul la login + preview header ≠ live**
> Model: Claude Opus 4.8 (1M context). Două bug-uri raportate de Andrei pe /admin → Site.
> **BUG 1 (critic) — sign-out la „Salvează & publică":** iframe-ul de preview live (same-origin, `allow-same-origin`,
> remontat la fiecare publicare prin `key={previewKey}`) pornea o A DOUA instanță Firebase pe sesiunea PARTAJATĂ
> (browserLocalPersistence = IndexedDB same-origin). A doua instanță Auth face `initializeCurrentUser()/reload()` pe
> sesiunea partajată și o poate ȘTERGE; ștergerea se sincronizează în tab-ul părinte /admin → operatorul ajunge delogat.
> Cauză confirmată prin workflow multi-agent (5 ipoteze + verificare adversarială): nu e claim-ul admin (gate-ul e
> `if (!user) return <AuthPanel/>` → user e null = sign-out real), nu form-submit (butoanele-s type=button), nu pierderea
> `?preview=1`. **FIX (`src/firebase.ts`) — închide TOATE mecanismele, indiferent de enforcement-ul App Check:** în
> „context de preview" (`?preview=1` SAU `window.self !== window.top`) Auth folosește **persistență IN-MEMORY proprie**
> (`initializeAuth(app,{persistence:inMemoryPersistence})`) → iframe-ul NU citește/scrie/șterge sesiunea operatorului; +
> sare `initializeAppCheck` (a doua instanță reCAPTCHA pe același domeniu) + sare `setPersistence(browserLocal)` în iframe.
> Top-level (operatori/vizitatori reali, ne-încadrați) = NESCHIMBAT (getAuth + browserLocalPersistence + App Check). Verificatorul
> adversarial a respins fix-ul „doar App Check" (App Check e în MONITOR, nu blochează Auth; cauza portantă = a doua sesiune
> Auth partajată) → de aceea izolăm persistența, nu doar App Check. **#89 reparase doar iframe-ul să AFIȘEZE un shell, nu
> pierderea sesiunii părintelui** — bug distinct, mai adânc.
> **BUG 2 — preview header ≠ site live (WYSIWYG):** previzualizarea din `ChromeEditor` era o re-implementare care diverge de
> `SiteLayout` (fără clasa `.theme-banner`, brand fără `.wordmark`, CTA hand-rolled în loc de `.btn btn-primary`, alt fundal) →
> un item „degradeu+sclipire" arăta altfel în admin vs live. FIX: preview-ul randează acum cu ACELEAȘI clase/culori/fundal ca
> SiteLayout → identic cu live-ul.
> Verificat: typecheck + 22/22 suites + build + boot (10/10, incl /app?preview=1 cu auth in-memory). DEPLOYED: hosting + rules.
> **De știut:** docul publicat `siteConfig/publicChrome` are eticheta CTA coruptă (mojibake „ÃŽncepe acum" din „Începe acum",
> dintr-o publicare veche) — se repară cu „↺ Meniul implicit" → Salvează & publică (text curat din PUBLIC_CHROME_DEFAULT).
> Risc viitor notat: dacă se pornește enforcement App Check pe Firestore, citirile publice siteConfig din iframe (fără App Check
> acum) ar pica → preview-ul ar cădea pe snapshot-ul copt; atunci = preview din srcDoc fără Firebase (alternativă documentată).

**2026-06-26 - Task Completed — Eficiență /admin (din auditul UI): badge-uri + expander pe sub-tab-uri + zebra + segmented nav**
> Model: Claude Opus 4.8 (1M context). Pachet de productivitate operator (tot în `AdminHome.tsx`, frontend-only).
> - **Badge-uri „inbox" pe tab-uri:** numere de acțiuni în așteptare — Lead-uri (status `new`, din listenerul existent),
>   Comenzi servicii (`serviceOrders` where status=='requested', listener nou ușor), Administratori (`adminRequests` where
>   status=='pending', DOAR owner/bootstrap → fără permission-denied pt. operatori). Suma urcă pe tabul principal „Administrare".
>   Pastila accent cu „99+" la depășire. Single-field equality → fără index compus.
> - **Expander lead pe SUB-TAB-URI:** cele 8 secțiuni stivuite într-un `<td>` (detalii/SEO/note/oportunități/cereri/activitate/
>   predicție/cont/șterge) → 5 sub-tab-uri segmented (Detalii [+SEO+note+cont client+șterge] / Oportunități / Cereri / Activitate /
>   Predicție). `leadTab` resetat la `detail` la deschiderea fiecărui lead. Mai puțin scroll, focus pe o sarcină; componentele grele
>   (LeadRequests/OpportunityBoard/etc.) se montează DOAR când sub-tabul e activ.
> - **Tabele mai scanabile:** antet `th` cu majuscule discrete + zebra pe rânduri impare (lead + clienți); rândul de lead nou
>   păstrează evidențierea albastră peste zebra.
> - **Segmented control** pe sub-tab-urile din „Administrare" (grup de pastile cu fundal) → distinge clar nivelul 2 de tab-urile
>   principale (underline). Literal de status `#c0392b` → `var(--danger)` la butonul Șterge lead.
> Verificat: typecheck + 22/22 suites + build + boot (10/10). /admin e auth-gated → nu se poate verifica vizual în preview-ul local
> (necesită login admin); acoperit prin typecheck/build/review. DEPLOYED: hosting + rules. i18n `admin.leadTab.*` (ro+en).
> NOTĂ: sticky-header pe tabele AMÂNAT — containerul `overflowX:auto` + expanderul inline ar cere un refactor de tabel (scroll
> intern), incompatibil cu rândul expandabil; zebra + sub-tab-urile acoperă deja „scanabil". Badge de „Sugestii" amânat (ar dubla
> 4 listenere; badge-urile concrete lead/comenzi/cereri acoperă inbox-ul).

**2026-06-26 - Task Completed — Mobile + portal /app (din auditul UI): hamburger header + skeletoane**
> Model: Claude Opus 4.8 (1M context). Frontend/CSS-only.
> - **Header public responsiv (hamburger):** `SiteLayout` capătă un buton hamburger (`.site-hamburger`, vizibil DOAR sub
>   760px prin CSS) care comută un sertar vertical (`.site-nav.open`); meniul se închide automat la navigare (`useEffect` pe
>   `pathname`). Nav-ul a trecut din stil inline în clasa `.site-nav` (desktop: rând cu margin-left auto; mobil: coloană
>   full-width). Tagline ascuns sub 480px. Verificat în preview: 375px → hamburger + sertar vertical; 1280px → nav inline (hamburger `display:none`).
> - **Skeletoane de încărcare (anti-pâlpâit) în `/app`:** clasă `.skeleton` (shimmer, respectă reduced-motion) + helperi
>   `Skel`/`SkelCard` în AppHome. Înlocuit `…` de la `initializing` cu un skeleton care reflectă layout-ul real (antet + bară
>   pas + 3 carduri); `MarketingPortal` nu mai face `return null` cât se încarcă (camps===null) → arată titlul + 2 carduri-skeleton,
>   apoi conținut SAU empty state (`portalNotLinked`). `App.tsx` RouteFallback (`…` pt. chunk-urile lazy /app,/admin) → skeleton neutru.
> Verificat: typecheck + 22/22 suites + build + boot (10/10) + preview live (hamburger mobil/desktop). DEPLOYED: hosting + rules.
> i18n `nav.menu` (ro+en). NOTĂ: empty-state-urile celorlalte secțiuni (/app) rămân „hide când gol" (corect — fără clutter);
> bara „Următorul pas" + 3 cardurile fixe asigură că un client nou NU vede ecran gol.

**2026-06-26 - Task Completed — Primitive UI (Button/Field) + ierarhie CTA (din auditul UI)**
> Model: Claude Opus 4.8 (1M context). Frontend-only. Începe consolidarea celor ~1551 `style={{}}` + ~95 butoane reinventate.
> - **`src/ui/Button.tsx`** — `Button` (<button>) + `LinkButton` (<Link>): variante tipate (primary/secondary/blue/ghost/danger)
>   + mărimi (sm/md), peste clasele `.btn`; **`type="button"` implicit** (evită submit accidental). CSS nou: `.btn-ghost`,
>   `.btn-danger` (contur roșu, lizibil pe orice temă via `--danger`), `.btn-sm`.
> - **`src/ui/Field.tsx`** — câmp cu etichetă vizibilă + `error`/`hint` (chei i18n) — consolidează tiparul label+input.
> - **Adopție cu payoff VIZIBIL (ierarhie CTA — quick win #4 din audit):** `Packages` — pachetul recomandat = `primary`
>   (roșu plin), restul = `blue` (contur) → recomandatul iese în evidență (era: toate identice). `Contact` — acțiunea
>   principală „Începe acum" = `primary` → /start (lead) + „Vezi pachetele" = secondary (era: un singur buton neutru spre /pachete).
>   `AuthPanel` — Field local înlocuit cu primitiva partajată + butoanele submit/Google → `Button`.
> Verificat: typecheck + 22/22 + build + boot (10/10) + preview live (Packages: recomandat roșu vs albastru; Contact: 2 CTA cu
> ierarhie). DEPLOYED: hosting + rules. i18n `contact.ctaStart`. **Restul auditului UI: sweep complet al primitivelor în cele ~59
> fișiere = follow-up incremental (primitivele există + sunt adoptate în paginile de conversie + AuthPanel).**

**2026-06-26 - Task Completed — Pagini detaliu per-serviciu /servicii/:id (ultimul item din auditul UI)**
> Model: Claude Opus 4.8 (1M context). Conținut + rutare + SEO prerender.
> - **`src/site/ServiceDetail.tsx`** (NOU): hero (emoji+nume+tagline+intro) + „Provocarea" + „Ce livrăm" (bullet-urile existente) +
>   FAQ (3 Q&A) + CTA contextual (self→/self-marketing, lead→/start?service=id) + breadcrumb. Folosește primitiva LinkButton. Text 100% i18n.
> - **Rutare + SEO:** `publicRoutes.ts` generează 7 rute `/servicii/<id>` din `SERVICE_IDS` (titleKey/descKey = `services.<id>.metaTitle/metaDesc`);
>   `App.tsx:publicElement` randează `ServiceDetail` din slug (regex `/servicii/(.+)` + `isValidServiceId`); import STATIC (pagini publice
>   prerenderizate). Prerender confirmat: **32 pagini** (incl. 7 servicii × ro/en), sitemap 28 URL-uri. SEO per serviciu din SiteLayout.
> - **Catalog → detaliu:** fiecare card din `/servicii` capătă link „Detalii →" către pagina de detaliu (pe lângă CTA).
> - **Conținut RO+EN** generat printr-un Workflow paralel (7 agenți, 1/serviciu), GROUNDED strict în bullet-urile existente
>   (fără metrici/termene/garanții inventate — regula „nu inventăm funcționalități"). Corectat manual: diacritice RO lipsă la saas/web/seo,
>   typo „Încearci"→„Încearcă". Conținut: metaTitle/metaDesc/intro/problem/3×FAQ per serviciu × ro/en.
> Verificat: typecheck + 22/22 + build:site (prerender 32 pagini, 0 erori) + boot + preview live (titlu+diacritice+secțiuni+FAQ corecte; 7 link-uri „Detalii").
> DEPLOYED: hosting + rules. **Auditul UI e acum acoperit integral** (rămâne doar sweep-ul incremental al primitivelor în restul fișierelor).

**2026-06-26 - Task Completed — Audit analytics/AI · Pachet D: bug-uri + robustețe (verificat adversarial)**
> Model: Claude Opus 4.8 (1M context). Din auditul analytics/AI (workflow 14 agenți, verificat adversarial). Corectitudine, risc mic.
> - **CSV virgulă-mie (`metricsCsv.parseLooseNumber`):** `'1,000,000'` devenea `1` (virgula fără punct era mereu zecimală). Fix:
>   dacă e grupare de mii (grupuri de EXACT 3 cifre, `^\d{1,3}(,\d{3})+$`) → elimină virgulele; altfel zecimală ro (`12,50`→12.5).
>   Teste noi în test-connectors (1,000,000 / 12,345 / 1,234 / 1,234,567.89).
> - **A/B winner gardă np≥5 (`lpABWinner`):** declara câștigător la `4/200 vs 0/200` (np<5, aproximare normală invalidă). Fix:
>   după pragul de vizite, cer ca nr. AȘTEPTAT de conversii ȘI ne-conversii (sub proporția pooled) ≥5 în ambele arme; altfel
>   `insufficient` cu reasonKey `ab.verdict.lowConversions` (+ hint UI dedicat „prea puține conversii, nu vizite"). `50/1000 vs 0/1000` (np=25) rămâne winner valid. Teste în test-ab.
> - **MoM onest (`functions monthlyMoM`/`momReportLine`):** `monthsAdjacent` + flag `prevAdjacent` (luni ne-consecutive → titlu
>   „interval cu gol", nu „lună-pe-lună") + `curPartial` (param `nowMonth`; lună în curs → notă „PARȚIALĂ, orientativ") + plafon
>   1e12 pe agregare. `performClientReport` pasează luna curentă. Teste e2e (gap/partial/cap).
> - **Plafon pe totals (`kpi.coerceToTotals`):** `num`→`numCap` — un rollup `totals` corupt nu mai otrăvește dashboard/AI (plafonul
>   exista doar pe metrica zilnică).
> Verificat: typecheck + 22/22 suites + build + boot + e2e-lp (toate). DEPLOYED: hosting + rules + functions.
> **AMÂNAT conștient (D#5):** recompute `totals` server-side tranzacțional în `onMetricWrite` — atinge un trigger fierbinte +
> ar dubla cu recompute-ul client/connector existent + NU se poate verifica headless (fără emulator, Java 11). Felie dedicată ulterior.
> **Corecții din verificarea adversarială (alarme false evitate):** ROAS NU e „ficțiune" — conectorii Meta/Google/TikTok mapează
> valoarea reală de conversie în `revenue`; atribuirea spend→lead→revenue ESTE legată (campania poartă leadId+clientUid, metricile=subcolecție);
> doar contact↔campanie e nelegat. Restul pachetelor: A (bucla de învățare), B (calibrare benchmark), C (profunzime AI) — următoarele.

**2026-06-26 - Task Completed — Audit analytics/AI · Pachet A: BUCLA DE ÎNVĂȚARE (snapshot → reconciliere → acuratețe)**
> Model: Claude Opus 4.8 (1M context). Cea mai consecventă lipsă din audit: softul NU învăța (doar grounding live, write-once).
> Acum: prima buclă de feedback închisă — predicțiile se compară cu rezultatul real și acuratețea devine MĂSURABILĂ.
> - **A1 — snapshot imutabil:** `performPrediction` scrie acum și un doc append-only în `predictionLog` (kind/subjectId/clientUid/
>   temperature/conversionLikelihood/confidence/predictedAtMs/reconciled:false); `performCampaignInsight` în `campaignInsightLog`
>   (verdict + `totalsAt` = totalurile campaniei la momentul analizei, pt. delta ROAS viitoare). Best-effort (nu rup generarea).
>   Docul „live" (leadPredictions/{id}, campaignInsights/{id}) rămâne overwrite; istoricul e separat, imutabil.
> - **A2 — motor pur + job de reconciliere:** `src/analytics/predictionAccuracy.ts` (PUR, testat headless `test-prediction-accuracy.ts`):
>   leadOutcome/contactOutcome (won/lost/open), isPositivePrediction, accuracyByTemperature/Likelihood (curbă de calibrare),
>   directionalAccuracy, isCalibrated (hot convertește > cold?). Job nou `reconcilePredictions` (onSchedule 05:30, UNGATED, fără AI):
>   pt. snapshot-urile ≥14 zile citește statusul real (lead won/lost; contact lifecycle) și stampează `outcome`; cele „open" >60 zile
>   = timed-out. eq pe un câmp (reconciled==false) → fără index compus.
> - **A3 — dashboard:** card „Acuratețea predicțiilor" în HealthPanel — citește `predictionLog` reconciliat (≤500) și rulează modulul
>   pur: acuratețe direcțională %, nr. predicții decise, badge calibrat/necalibrat, tabel rată reală de conversie pe temperatură.
> - Reguli: `predictionLog` + `campaignInsightLog` read admin / write false (Admin SDK only). i18n `admin.health.acc*` (ro+en).
> Verificat: typecheck + 23/23 suites (test-prediction-accuracy nou) + build + boot + e2e-lp. DEPLOYED: hosting + rules + functions
> (incl. `reconcilePredictions`). NOTĂ: jobul scheduled nu e testabil headless (fără emulator) — logica de scorare e însă acoperită
> de modulul pur testat. Datele de acuratețe apar după ce predicțiile au ≥14 zile și lead-urile se decid. Insight-accuracy (delta
> ROAS din campaignInsightLog) = sub-felie viitoare; snapshot-ul se acumulează de pe acum. Următor: B (calibrare benchmark), C (profunzime AI).

**2026-06-26 - Task Completed — Audit analytics/AI · Pachet B: CALIBRARE benchmark din date proprii**
> Model: Claude Opus 4.8 (1M context). Remediază finding-ul #2 (confirmat): reperele `BENCHMARKS_RO` „NEVALIDATE" ancorau
> verdictele AI, dar metricile reale acumulate nu erau folosite. Acum benchmark-urile se CALIBREAZĂ din datele platformei.
> - **Job săptămânal `calibrateBenchmarks`** (onSchedule luni 04:00, ungated): agregă CROSS-TENANT pe industrie × platformă
>   (din campaniile cu cheltuială reală), calculează p25/p50/p75 pentru CTR/CPL/ROAS/CVR și scrie DOAR AGREGATE (percentile +
>   nr. eșantion, ZERO rânduri per-tenant → privacy-safe) în `benchmarkStats/{industrie}` (min 5 campanii/industrie).
> - **Injectare în prompt:** `buildL2Text(industry, calibrated)` + `buildSystemBlocks({...calibrated})` — când o platformă are
>   ≥5 campanii reale, linia de reper devine `[REAL · N campanii]` cu mediană + interval p25–p75; altfel cade pe static. Insight +
>   raport citesc `benchmarkStats/{industrie}` (best-effort) și pasează `calibrated`. Modelul e instruit să trateze [REAL] ca date, nu ghiciri.
> - Helperi puri `abPercentile`/`tripletPercentiles` (interpolare liniară, ignoră negativ/non-număr) — exportați + testați e2e.
> - Reguli: `benchmarkStats/{industrie}` read admin / write false (Admin SDK only).
> Verificat: typecheck + 23/23 suites + build + boot + e2e-lp (percentile + L2 calibrat vs static + prag eșantion). DEPLOYED:
> hosting + rules + functions (incl. `calibrateBenchmarks`). Date reale apar după ce o industrie strânge ≥5 campanii cu cheltuială.
> **AMÂNAT (B2):** bază per-client (mediana proprie a clientului injectată în prompt „CTR-ul tău vs mediana ta") — sub-felie viitoare.
> Următor: C (profunzime AI — confidence/dataGaps + prag eșantion + aiBudgetAllocation + anomalii).

**2026-06-26 - Task Completed — Audit analytics/AI · Pachet C: profunzime AI (confidence + prag eșantion + anomalii)**
> Model: Claude Opus 4.8 (1M context). Remediază finding #6 (insight pe 8 click-uri avea aceeași autoritate ca pe 4000).
> - **C1 — confidence calibrat de eșantion:** `AiInsight` capătă `confidence` (low/med/high); `INSIGHT_SCHEMA` cere câmpul.
>   `insightConfidence(clicks, leads, model)` PUR (kpi.ts, testat) + port JS în performCampaignInsight: sub 50 click-uri SAU 15
>   lead-uri → `confidence='low'` (override peste model). `onCampaignAutomation` NU se mai declanșează pe verdict cu confidence
>   'low' (gata cu automatizări pe zgomot). Badge în MarketingCenter (low=warn). `coerceToInsight` default 'med' pe docuri vechi.
> - **C3 — anomalii precalculate:** `metricAnomalies(metrics)` PUR (JS, testat e2e) — zile cu cheltuială și 0 lead-uri (bani
>   irosiți) + cel mai mare salt de CPL între zile consecutive → bloc „ANOMALII DETECTATE" în buildInsightPrompt (modelul
>   primește spike-urile gata găsite, nu „se uită" la 14 rânduri).
> Verificat: typecheck + 23/23 suites (insightConfidence în test-analytics) + build + boot + e2e-lp (metricAnomalies + confidence).
> DEPLOYED: hosting + rules + functions. i18n `admin.insightConf_*`.
> **AMÂNAT (C2 — felie dedicată):** `aiBudgetAllocation` (callable nou + schemă + UI: realocare buget între campanii — analiza
> cu cel mai mare impact, dar e o funcție AI nouă completă, merită felie proprie). Notat ca următorul pas major AI.
>
> **═══ AUDIT ANALYTICS/AI — SUMAR (D+A+B+C livrate; C2 + B2 amânate) ═══** Răspuns la „poate AI-ul să analizeze și să
> ÎNVEȚE din date": ACUM DA. D = corectitudine (CSV/A-B/MoM/plafoane). A = bucla de învățare (snapshot→reconciliere→acuratețe
> măsurată). B = benchmark calibrat din date reale (nu mai ghicește). C = onestitate pe eșantion (confidence) + anomalii.
> Rămase (felii viitoare, low-urgență): C2 aiBudgetAllocation; B2 bază per-client; D#5 totals server-side; axă monetară
> (value ContactEvent + invoice↔contact) + contact↔campanie FK pentru LTV/CAC; insight-accuracy (delta ROAS din campaignInsightLog).

**2026-06-26 - Task Completed — Audit analytics/AI · C2: aiBudgetAllocation (realocare buget cross-campanie)**
> Model: Claude Opus 4.8 (1M context). Cel mai valoros pas AI amânat din audit: AI-ul nu mai analizează doar O campanie
> izolată (aiAnalyzeCampaign), ci PORTOFOLIUL — compară campaniile între ele și spune unde să muți banii.
> - **Backend (`functions/index.js`):** `ALLOCATION_SCHEMA` (headline + summary + `moves[]` cu `action` enum scale/reduce/
>   pause/keep + reason; additionalProperties:false) · `buildAllocationPrompt(lead, camps)` (leadContextBlock + campaniile cu
>   spend>0 prin campKpiLine + TOTAL PORTOFOLIU cu ROAS general; constrângere zero-sum „aproximativ neutră ca buget total, nu
>   crește tot" + aliniere la obiectiv: lead-uri→CPL mic, venit→ROAS) · `performBudgetAllocation(db, leadId, actor, consume)`
>   (validează lead + ≥2 campanii cu cheltuială ÎNAINTE de quota; persona strategist + benchmark calibrat (Pachet B); clamp cu
>   enum derivat din schemă → fără drift) · callable `aiBudgetAllocation` (admin-only + App Check + consumeAiQuota, oglindă
>   aiClientReport). Persist `budgetAllocations/{leadId}` (read admin / write false — conține `by` operator).
> - **TS paritate (`src/analytics/kpi.ts`):** `ALLOCATION_ACTIONS` + `coerceToAllocation` (doc corupt→null, mișcare fără nume
>   ignorată, enum invalid→keep). Aceleași 4 valori ca schema JS (testat la ambele capete).
> - **UI (`MarketingCenter.tsx` → ClientReportPanel):** buton „⚖️ Realocare buget AI" (dezactivat <2 campanii cu spend, gardă
>   oglindă pe server) → card cu headline/summary + listă de mișcări cu chip colorat pe acțiune (scale=verde, reduce=chihlimbar,
>   pause=roșu, keep=gri); citește budgetAllocations/{leadId}. i18n `admin.alloc*` (RO+EN).
> Verificat: typecheck + 23/23 suites (coerceToAllocation în test-analytics) + e2e-lp (ALLOCATION_SCHEMA + buildAllocationPrompt:
> filtru spend>0, total portofoliu, zero-sum) + build + boot. DEPLOYED: hosting + rules + functions (aiBudgetAllocation confirmat
> live, v2 callable europe-central2). Verificarea în browser a butonului = în spatele login-ului operator (necredențiabil aici);
> logica e acoperită de teste unit/e2e. Cu C2 livrat, auditul analytics/AI e COMPLET (D+A+B+C+C2); rămân doar feliile low-urgență.

**2026-06-26 - Task Completed — Audit analytics/AI · B2: REPERUL PROPRIU al clientului (mediana propriilor campanii în prompturi)**
> Model: Claude Opus 4.8 (1M context). Design via judece-panel multi-agent (3 propuneri independente → sinteză) + review
> adversarial (3 dimensiuni → verificare). AI-ul poate acum spune „CTR-ul TĂU e sub mediana TA proprie", DESCRIPTIV — distinct
> de reperul de INDUSTRIE (Pachet B, cross-tenant, în blocul L2 cache-uit). Per-client → stă în promptul per-cerere, nu în L2.
> - **Numeric core (`src/analytics/kpi.ts`, TS testat + port byte-echivalent în functions/index.js):** `median` (par/impar,
>   ignoră negative/non-numere), `computeClientBaseline(items,{excludeId})` (cohortă spend>0; mediana per-KPI peste RATELE
>   per-campanie egal-ponderate; ROAS/CPL/CTR/convRate; `present` = cohortă≥2 ȘI ≥1 KPI cu mediană; per-KPI `n`+`smallSample`),
>   `compareToBaseline` (polaritate: CPL mic=bine; |pct|≤3→„la fel"; mediană≤0→null). Constante `CLIENT_BASELINE_MIN_N=3`/
>   `THIN_N=5`/`KPI_LOWER_IS_BETTER` (paritate asertată TS↔JS).
> - **Formatare RO (functions, lângă campKpiLine):** `clientBaselineBlock` (tabel median + caveat „eșantion mic" pe n∈[3,5) +
>   caveat mix multi-platformă) și `campaignVsBaselineLine` (deltele acestei campanii vs mediană, polaritate precalculată).
> - **Cablare:** `buildInsightPrompt`/`buildClientReportPrompt`/`buildAllocationPrompt` primesc param opțional `baseline`
>   (lipsă → prompt byte-identic, compat). `performCampaignInsight` face O interogare proiectată `.select(platform,totals)`
>   pe campaniile lead-ului, exclude-self prin campaignId, best-effort. report/allocation calculează inline din `camps[]`
>   (zero citiri extra). Fără rules/schema/UI nou.
> - **Fix-uri din review adversarial:** (1) MEDIU — KPI-ul afișat în insight folosea fereastra de 60 zile a metricilor, dar
>   delta nouă folosea totals all-time → 2 ROAS contradictorii pe aceeași campanie (>60 zile). Fix: KPI afișat = camp.totals
>   (aceeași bază ca delta + cohortă); `metrics` rămâne doar pt. evoluția recentă + anomalii. + test de regresie. (2) NIT —
>   comentariul citirii surori corectat + `.select(platform,totals)` adăugat (fetch slim real, nu doc întreg).
> Verificat: typecheck + 23/23 suites (median/computeClientBaseline/compareToBaseline + edge-cases) + e2e-lp (TEST B2: paritate
> constante + port JS + formatare RO + wiring byte-compat + regresie display==delta) + build + boot. DEPLOYED: functions
> (fără rules/hosting — B2 nu schimbă reguli/schemă; helperii TS sunt doar pt. teste, neincluși în UI). Notă latentă (out-of-scope,
> task spawn): `metrics` în performCampaignInsight se citește `orderBy date asc limit 60` = primele 60 zile, nu ultimele — afectează
> doar blocul „evoluție recentă", nu KPI-ul (acum din totals).

**2026-06-28 - Task Completed — Audit analytics/AI · D#5: `totals` recalculat SERVER-side tranzacțional (anti-race)**
> Model: Claude Opus 4.8 (1M context). Design + review adversarial multi-agent (4 finding-uri confirmate, toate reparate).
> `totals` (rollup-ul campaniei) era recalculat CLIENT-side în MarketingCenter (read-all-metrics → write) = race
> (doi scriitori concurenți / operator+conector → totals stricat). Acum `totals` = proprietate a SERVERULUI.
> - **Nucleu:** `performRecomputeCampaignTotals(db, campaignId)` — tranzacție Firestore (citește camp + toate metricile
>   ÎNAINTE de scriere), `sumMetricsRaw` → `totals`, idempotent (recompute din zero → sigur la livrare at-least-once +
>   concurență). Gardă: campanie ștearsă → NU scrie (set+merge ar reînvia un doc fantomă). `maxAttempts:15` (absoarbe
>   contenția rafalelor CSV peste default-ul de 5).
> - **Trigger UNGATED `onMetricTotals`** (nou) pe `campaigns/{id}/metrics/{date}` → recompute la ORICE create/update/delete.
>   DEDICAT + independent de `AUTOMATION_ENABLED` (un kill-switch pe automatizare NU mai oprește integritatea datelor —
>   finding #3). `onMetricWrite` (gated) păstrează DOAR dispatch-ul de automatizare (nu mai recalculează totals).
> - **Backstop zilnic `reconcileCampaignTotals`** (onSchedule 05:15, ungated) — reconciliază totalurile tuturor campaniilor
>   dacă o tranzacție terminală eșuează sub contenție extremă (finding #2). Idempotent, fără AI.
> - **Conector:** `runConnectorPull` folosește acum ACEEAȘI cale tranzacțională (nu mai face read-all-then-write racy —
>   finding #1).
> - **Client:** scos `recomputeTotals()` + cele 3 apeluri (saveDay/deleteDay/importCsv) din MarketingCenter. KPI-urile
>   per-campanie se derivă LOCAL din metrici (instant); vederile agregate se actualizează când triggerul scrie totals.
> - **aiAnalyzeCampaign (finding #4):** gardă „adaugă cheltuială" verifică acum cheltuiala REALĂ (suma metricilor încărcate),
>   nu doar `totals.spend` denormalizat (care e 0 ~1s după prima metrică până rulează triggerul) → fără eroare falsă.
> Verificat: typecheck + 23/23 suites + e2e (TEST TOT nou: sumă/idempotență/delete→zero/campanie-ștearsă→null/corupte +
> stub conector cu runTransaction) + build + boot. DEPLOYED: hosting + functions (onMetricTotals + reconcileCampaignTotals
> confirmate live, europe-central2). Fără rules/schema nou.

**2026-06-28 - Task Completed — Axă monetară F1: economia clienților clientului (LTV contact + CAC/ROI campanie)**
> Model: Claude Opus 4.8 (1M context). Decizie Andrei: „ambele, în ordine" (F1 = clienții clientului, F2 = agenția).
> Design judece-panel (3 propuneri → sinteză) + review adversarial (3 dimensiuni → 5 finding-uri confirmate, toate reparate).
> Închide bucla de VENIT pe sistemul de contacte: clientul notează valoarea tranzacției pe lead-ul „Câștigat" → LTV per
> contact + CAC/ROI per campanie (consumatorii FINALI ai clientului). Extinde predicția/contactele cu bani reali.
> - **Date:** `lpLeadState.value` (deal EUR, scris de client) → oglindă server `clients/{uid}/contacts/{cid}/deals/{subId}`
>   {value,won} → `contact.rollup.value` (LTV) + `contact.acquisition{campaign,source,medium}` (set-once din primul form_submit).
> - **Pur (`src/analytics/monetary.ts`, TS + port JS):** coerceMoney/sumWonValue/coerceToContactDeal (paritate e2e) +
>   wonRevenue/campaignKey/campaignEconomics/campaignEconomicsAll (CAC=spend/contacte, ROI=LTV cohortă/spend, găleată
>   „neatribuit" pt. reconciliere, caveat eșantion mic, dedupe pe nume de campanie).
> - **Triggere:** `performRecomputeContactValue` (tranzacție idempotentă din deals, tiparul D#5, maxAttempts:15, gardă
>   contact-șters) apelat de `onLpLeadStateWrite` (oglindește deal-ul din starea LIVE re-citită — imun la redelivery stale —
>   pe orice create/update/delete) + `reconcileContactValues` (backstop zilnic 05:45, re-oglindește TOATE lead-state-urile cu
>   won derivat + recalculează) + `performMergeContacts` (mută deals + recalculează). `onSubmissionCreate` setează acquisition.
> - **Reguli:** `lpLeadState.value` validat (number ≥0 ≤1e12, hasOnly) + `deals/{subId}` read owner+admin / write false.
> - **UI:** input valoare în mini-CRM /app (pe „Câștigat") + „Venit din lead-uri câștigate" + valoare în CSV; chip „LTV" +
>   campania de achiziție pe cardul de contact (/admin); card „CAC / ROI per campanie" în Marketing Center (încarcă contactele
>   clientului). i18n ro+en.
> - **Fix-uri review:** (#2) oglindă deal din LIVE re-read (nu din payload-ul stale al evenimentului); (#1/#4) reconcile
>   re-oglindește TOATE stările (nu doar castigat) → un deal blocat won:true după castigat→pierdut se corectează; (#3) dedupe
>   campanii pe cheie (nume duplicat nu mai dublează cohortValue + cheie React stabilă); (#5) campaniile cu spend dar 0 contacte
>   apar (cheltuială irosită vizibilă).
> Verificat: typecheck + 24/24 suites (test-monetary + test-normalisers F1) + e2e (paritate coerceMoney/sumWonValue/clampDeal +
> performRecomputeContactValue pe stub + merge) + build + boot. DEPLOYED: hosting + rules + functions (reconcileContactValues
> creat, europe-central2). Forward-only, fără backfill. Următor: **F2 — economia agenției (facturi↔lead/client).**

### Backlog (adaugat 2026-06-13)
- [x] Sistem Landing Pages (LP Studio v1: IDE cod+preview+AI, servire /p/{slug}, analytics) ✅ 2026-06-13
- [ ] Builder vizual Landing Pages (drag&drop elemente din UI) — peste IDE-ul de cod actual (viitor)
- [ ] Izolare LP pe subdomeniu (pages.dataread.ro) înainte de autori ne-de-încredere
- [x] Creator de teme admin extins (culori/background/animații; fără layout) ✅ 2026-06-13
- [x] Livrabile în portalul de client (cu note interne separate) — pasul 2 al portalului ✅ 2026-06-13
