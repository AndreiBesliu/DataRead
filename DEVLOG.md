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

### Backlog (adaugat 2026-06-13)
- [ ] Sistem Landing Pages (conținut per client) — va alimenta și customizarea temelor admin
- [x] Creator de teme admin extins (culori/background/animații; fără layout) ✅ 2026-06-13
- [x] Livrabile în portalul de client (cu note interne separate) — pasul 2 al portalului ✅ 2026-06-13
