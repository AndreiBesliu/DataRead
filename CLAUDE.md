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
  admini). Doar `/admin` (backend-ul) are autentificare. Self-serve-ul public (checkout Stripe din
  site) rămâne DORMANT și nelegat din site până revine.
- **Portal client `/app` (cont propriu, ACTIV):** clientul se autentifică (self-signup), iar adminul
  îl conectează la lead-ul lui din `/admin` (setează `clientUid`). Portalul are 3 fețe scoped
  multi-tenant: **performanță** (campaniile lui, `campaigns where clientUid==uid`), **raport**
  (`clients/{uid}.marketingReport`, oglindit de `aiClientReport`) și **livrabile**
  (`clients/{uid}/deliverables/{reqId}`, oglindite de trigger-ul `onRequestWrite` DOAR cu câmpurile
  din `CLIENT_SAFE_DELIVERABLES` — notele interne ale agenției NU se scurg). Clientul citește doar
  ale lui; oglinzile le scrie exclusiv Admin SDK (rules: write false). **Istoric versiuni read-only
  (ACTIV 19.06.2026):** versiunile (`leads/{id}/requests/{reqId}/versions`, snapshot la regenerare)
  conțin starea anterioară COMPLETĂ (cu note interne) → NU se citesc direct; trigger `onRequestVersionCreated`
  le oglindește client-safe (filtru comun `clientSafeDeliverables`) sub `clients/{uid}/deliverables/{reqId}/versions`.
  `deleteVersionsMirror` curăță subcolecția la reatribuire/deconectare (subcolecțiile nu cad la ștergerea doc-ului).
  UI: expander „Istoric versiuni" per livrabil în `/app` (`VersionHistory`, read-only).
- **Acces backend prin cereri aprobate:** o logare pe `/admin` fără claim înregistrează automat
  `adminRequests/{uid}` (pending); un admin existent aprobă din `/admin` (creează `admins/{uid}` →
  trigger → claim). Bootstrap: UID-ul lui Andrei (`IMBKFBkONkOB7VVZCmqgS90JdBi2`, constantă în
  functions) e auto-aprobat la prima cerere, DOAR cât timp nu există niciun admin.
- **RBAC admini (ACTIV 15.06.2026):** doi membri de claim — `admin` (boolean) + `role`
  (`owner`|`operator`), setate de `recomputeAdminClaim`/`deriveAdminRole` (rolul stocat în `admins/{uid}`
  câștigă; founder-ul = owner implicit cât timp rolul nu e setat, persistat prin self-heal). **Owner**
  gestionează adminii; **operator** face munca zilnică. TOATE mutațiile (approve/reject/revoke/setRole)
  trec prin callable-ul owner-only `manageAdmin` → nucleu testabil `performManageAdmin(db, caller, data)`:
  autorizează apelantul DIN FIRESTORE (rol live, nu token vechi), tranzacție cu toate citirile înainte de
  scrieri, protecția ultimului owner (`canMutateAdmin` pură), audit append-only `adminAudit/{id}`.
  Reguli: `admins`/`adminRequests`(update,delete)/`adminAudit` = `write:false` (doar Admin SDK). UI: tab
  „Administratori" (`AdminsPanel`) cu cereri+listă+roluri+revoke+jurnal. Amânat: invitație pe email;
  permisiuni per-modul; suită reguli cu emulator.
- **Design:** tema bannerului oficial (navy #0a1228, roșu #e02639, albastru electric #2e7fff,
  diagonale + dot grid) e scoped pe clasa `.theme-banner` = DOAR site-ul public.
- **Teme backend (configurator):** `/admin` are un selector de temă (header) cu preset-uri tech
  (Midnight/Carbon/Matrix/Ocean/Light) — `src/theme/themes.ts` (seturi de variabile CSS + grid
  dot pentru cele „digital"), `useAdminTheme` persistă alegerea local. Aplicat prin `themeStyle()`
  pe wrapperul view-ului de admin; componentele se reskinează automat (folosesc deja variabilele).
  Default = Midnight (dark digital). Portalul de client (/app) rămâne pe tema default deocamdată.
- **Tipografie (ACTIV, 14.06.2026):** `CustomTheme.headingFont/bodyFont` (id din `LP_FONTS` — 10
  fonturi Google + System); aplicate pe paginile LP de `customThemeCss`/`lpThemeCss` (`@import` +
  font-family pe body/h1-h6). În `ThemeControls` doar cu prop `withFonts` (LP design = da; tema admin
  = nu, inline-style nu poate @import). Sistemul de design e complet: culori/fundal/fonturi/animații/
  decor (parametric + plasare liberă). **Decor pe orice bloc:** `props.bgDecor` pe orice bloc (≠
  'decor') e învelit de `compileBlocks` ca fundal (decor z-index 0 + conținut z-index 1); decorul din
  props (bgDecor + decor) e coerce-uit la LOAD în `coerceToLpBlock`. Gardă de mărime la salvarea LP
  (refuz, nu truncare, peste 200KB). Motorul de decor pune rAF pe pauză offscreen (IntersectionObserver).
- **Creator de teme personalizate (configurator extins):** opțiunea „Personalizată" + butonul
  „Editează tema" deschid `ThemeEditor` — se modifică DOAR design-ul (cele 8 culori, imagine de
  fundal prin URL https, animație de decor: aurora/puls/sclipire, grilă), NICIODATĂ layout/
  structură (decizie Andrei, 13.06). Tema custom = `CustomTheme` (schema 1) cu `coerceToCustomTheme`
  (normaliser unic; respinge URL-uri nesigure pt. CSS `url()`), persistată în
  `dataread_admin_theme_custom`; randată prin `customThemeStyle` (fundal în straturi: grilă + văl de
  lizibilitate gradient peste imagine + culoare) + stratul decorativ animat `.admin-fx` (z-index 0,
  sub `<main>`). Asta e fundația viitorului sistem **Landing Pages** (același motor de design,
  pentru clienți cu conținut variabil).
- **LP Studio — galerie de șabloane:** „Pagină nouă" → `LpTemplatePicker` (carduri cu mini-preview)
  cu 6 șabloane RO gata făcute (`src/admin/lpTemplates.ts`; `landingPageFromTemplate` → coerceToLandingPage,
  mod vizual) sau pagină goală. Șabloanele sunt date statice generate prin workflow.
- **LP Studio — panou de previzualizare MULTI-ECRAN (ACTIV 15.06.2026):** `LpPreviewPane` arată mai multe
  ecrane de dimensiuni diferite SIMULTAN (toate cu același srcDoc live): presete dispozitiv + dimensiune
  custom W×H + șterge/resetează. Setul de ecrane = preferință de workspace, salvată per-browser în
  localStorage (`src/types/lpPreviewScreens.ts`, coerce/clamp, prefix `dataread`). Fundal-canvas distinct
  (`.lp-preview-surface`, transparency grid).
- Un singur SPA Vite + React + TS + Zustand: rute publice prerenderizate (`/`, `/pachete`,
  `/start`, `/contact`, `/legal/*`; en sub `/en/*`) + `/app` (portal client, noindex) + `/admin`.
- Limba pe rutele publice derivă STRICT din path (`src/i18n/routing.ts`) — nu din localStorage
  (regulă pentru prerender).
- Entitlements: extensia Stripe scrie `customers/{uid}/subscriptions` → functions
  `onSubscriptionWrite` → custom claim `ent` + mirror `clients/{uid}.entitlement`. FĂRĂ trial.
  Statusuri: `none | active | expired`.
- `functions/index.js`: secțiuni separate — admin (claims + bootstrap) / entitlement / (viitor) AI.
  Runtime **Node 22** gen-2; trigger-ele primesc EXPLICIT `{ region: 'europe-central2' }`.
- **Marketing Center** (tab în /admin): monitorizare campanii pe toate platformele (meta/google/
  tiktok/other). Colecția de nivel superior `campaigns/{id}` (cu `leadId` + `clientName`
  denormalizat + `totals` rollup) + `campaigns/{id}/metrics/{YYYY-MM-DD}` (o zi de performanță,
  upsert pe dată). Motorul de KPI: `src/analytics/kpi.ts` PUR (ROAS/CPL/CTR/CPC/CPM/conversie),
  testat în `scripts/test-analytics.ts`. Introducere MANUALĂ + **import CSV** (`src/utils/metricsCsv.ts`,
  parser pur tolerant ro/en, upsert pe dată); conectorii API scriu în același model. `source` pe metrică
  (`'manual'|Platform`) distinge manual vs API. Plafon valoric `MAX_METRIC_VALUE` în `coerceToDailyMetric`.
- **Ingestie automată campanii (conectori Ads — Meta ACTIV 19.06.2026; Google/TikTok dormant):** vezi
  `docs/CONNECTORS-ADS-API.md`. **Felia 0 (live):** `campaigns.clientUid` denormalizat (din lead, ținut în
  sincron de triggerul **`onLeadWrite`**) — leagă campania de cont pentru reguli multi-tenant + jobul de
  ingestie (REPARĂ mismatch: regulile cereau clientUid dar nu se scria). Credențiale la
  `clients/{uid}/platformCredentials/{platform}` (`src/types/platformCredentials.ts`), reguli **read admin-only,
  write false** (token criptat AES-256-GCM, nu ajunge la client). **Flag PER PLATFORMĂ** (`META_ENABLED=true` /
  `GOOGLE_ENABLED`/`TIKTOK_ENABLED`=false în `functions/index.js`; cu flag false OAuth+`onSchedule` NU se exportă →
  deploy nu cere secretele platformei; tipar „integrare opțională" ca `AI_ENABLED`). Motor generic **`runConnectorPull`**
  (un nucleu: upsert `source:platform` idempotent, recalcul totals, `needs_reconnect` pe 400/401/403, izolare per
  tenant); `runMetaPull` = wrapper. Pur + testat: `functions/connectors/{meta,google,tiktok}.js` (atenție Google
  **cost_micros/1e6**), `functions/lib/tokenCrypto.js`. **META LIVE:** secrete `META_APP_ID/META_APP_SECRET/TOKEN_ENC_KEY`
  în Secret Manager; app Meta (App ID 1015855461036302, Facebook Login for Business); rewrite `/api/meta/callback`→
  `metaOAuthCallback`; funcții `initiateMetaOAuth`/`metaOAuthCallback`/`disconnectPlatform`/`pullMetaInsights` (zilnic
  05:00 Europe/Bucharest); UI `PlatformConnect` (buton „Conectează Meta" per client în Marketing Center). **Meta: pentru
  clienți reali necesită Tech Provider + verificare (App Review ads_read); test pe cont propriu = development mode.**
  **Toggle „Ingestie automată" per conexiune (ACTIV 20.06.2026):** `platformCredentials.ingestEnabled` (coerce default
  `true`) — comutator în `PlatformConnect` (callable admin `setPlatformIngest`) pune fluxul pe PAUZĂ fără a deconecta
  (token-ul rămâne); `runConnectorPull` sare conexiunea cu `ingestEnabled===false` (skipped, status neatins). Conectorul
  e **read-only `ads_read`** (doar ingestie) — crearea de campanii cap-coadă din admin = fază viitoare `ads_management`
  (builder campanie + App Review pe alt scope), NU acum.
  Activare Google/TikTok: secrete + flag=true + rewrite `/api/{platform}/callback` + deploy. Rămas: trigger incremental
  totals; backfill istoric; selectare cont (nu primul); HMAC pe cookie A/B (separat).
- **Motor de automatizare (Felia 0 ACTIV 20.06.2026 — fundație pură, dormantă):** UN motor generic
  `declanșatoare → condiții (AND) → acțiuni (secvență)` pe care cele 4 verticale (workflows marketing / optimizare
  campanii / creare campanii / CRM) se montează ca module prin enum-uri — fără refactor de nucleu. Model unic
  `src/types/automation.ts` (`Automation` schema:1: trigger{type,config} + conditions[] + actions[] + scope
  `agency|client` + clientUid + enabled default OFF; 9 declanșatoare, 8 operatori, 10 acțiuni cu `AUTOMATION_ACTIONS_V1`
  subset sigur + `AUTOMATION_AI_ACTIONS`; coerce unic cu plafoane). Nucleu PUR `src/automation/automationEngine.ts`
  (`applyOperator`/`evaluateConditions`/`matchesTrigger`/`buildIdempotencyKey`/`planActions`/`selectMatching`), portat
  1:1 în `functions/index.js` (paritate TS↔JS testată e2e TEST X). **Date:** `automations/{id}` + `automations/{id}/runs/{runId}`
  (audit + dedupe). Reguli: read admin SAU client-owner scope:'client', **write:false** (mutații doar prin callable-uri).
  **Garanții (din start):** anti-buclă (`origin:'automation'` ignorat + `buildIdempotencyKey` + backstop
  `AUTOMATION_MAX_RUNS_PER_TARGET_HOUR`), at-least-once dedupe (`runs/{key}` creat tranzacțional), cost AI mărginit de cotă,
  izolare multi-tenant pe clientUid, **deploy-safe** (`AUTOMATION_ENABLED=false`; triggere/UI/email NU se exportă încă).
  **Felia 1 ACTIV 20.06.2026 (management reguli):** callable-uri admin-gated `saveAutomation`/`deleteAutomation`/
  `setAutomationEnabled` (fără secrete, exportate mereu; `saveAutomation` refuză acțiunile din afara `AUTOMATION_ACTIONS_V1`)
  + builder UI `src/admin/AutomationsPanel.tsx` (tab „Automatizări" în /admin, între Marketing și Landing).
  **Felia 2 ACTIV 20.06.2026 (motor LIVE, notify-only — decizie Andrei):** `AUTOMATION_ENABLED=true`.
  `dispatchAutomationEvent(db,event)` interoghează regulile pornite → `selectMatching` (pur) → creează
  `automations/{id}/runs/{key}` cu **`.create()`** (DEDUPE at-least-once + anti-buclă) → `executeAutomationAction`
  (implementat DOAR `notify.operator` → scrie `notifications/{id}`; restul `skipped`). Triggere LIVE gate-uite:
  **`onMetricWrite`** (metrici → `campaign.metric_threshold`, ctx metric.spend/leads/cpl/roas/ctr + campaign.platform/
  aiInsight.verdict; stateHash data+valori = re-pull idempotent) + **`onCampaignAutomation`** (→ `campaign.insight` DOAR
  la schimbare de verdict aiInsight). Reguli `notifications/{id}` read admin-only/write:false; UI „Notificări recente" în
  AutomationsPanel.
  **Felia 2b ACTIV 20.06.2026 (acțiuni AI guvernate):** `campaign.recommend`/`report.generate` rulează prin nucleele
  reutilizabile `performCampaignInsight`/`performClientReport` (extrase din callable-urile aiAnalyzeCampaign/aiClientReport,
  acum delegare anti-drift; cota se consumă prin callback DUPĂ validare). **Guvernare:** poartă pură
  `automationAiAllowed(config,{aiEnabled,entitlementActive})` = AI activ ȘI (bypass admin SAU client cu entitlement activ);
  plafon GLOBAL/zi configurabil `consumeAutomationAiQuota` (`aiUsage/__automationGlobal`). Config `appConfig/automation`
  (`src/types/automationConfig.ts`: `aiDailyCap` default 50 + `aiBypassEntitlement`) — reguli read+write admin, UI card în
  AutomationsPanel (plafon + checkbox bypass). Triggerele automatizării au `secrets:[ANTHROPIC_API_KEY]` când AI_ENABLED.
  `auto-pause` campanie tot imposibil (ads_read, nu ads_management).
  **Felia 3 ACTIV 20.06.2026 (workflows lead lifecycle):** executori `lead.set_status` (scrie status + marcaj
  `automationStamp`) + `task.create` (`tasks/{id}`). Triggere `onLeadAutomation` (lead.created/lead.status_changed) cu
  GARDĂ ANTI-BUCLĂ (scrierile motorului poartă `automationStamp` → origin='automation' → planActions null) + scaner zilnic
  `automationDailyScan` (06:00, lead.inactive cu ctx `lead.daysSinceUpdate`; reguli+config încărcate o dată).
  `tasks/{id}` read admin/create false/update-delete admin; UI „Task-uri deschise" în AutomationsPanel.
  **Motorul acoperă toate declanșatoarele planificate** (lead.*/campaign.*/schedule.*) + acțiuni notify/set_status/task/AI.
  **Felia 5a ACTIV 20.06.2026 (client-scope: operator face / client vede):** ieșirile motorului sunt rutate pe domeniu
  via `automationOutCol()` — regulile de agenție scriu top-level `notifications`/`tasks` (operatori), cele cu scope:'client'
  scriu sub `clients/{clientUid}/notifications`+`/tasks` (izolat). Reguli: `clients/{uid}/notifications` read owner+admin/
  write false; `clients/{uid}/tasks` read owner+admin/create-delete false/update owner-admin DOAR status∈open/done. UI:
  dropdown de clienți la scope=client în AutomationsPanel + secțiune `ClientAutomationFeed` în /app (client vede notificări+
  task-uri proprii, marchează „Gata"). Felii rămase: **F5b** (client self-serve — builder în /app pe mini-CRM, gated abonament)
  → **F5c** (CRM clasic facturi/memento — necesită modelul de date Vertical 2). F4 email/SMS (AMÂNAT); F6 publicare campanii
  (ads_management). **Backstop orar ACTIV 20.06.2026 (E1):** `AUTOMATION_MAX_RUNS_PER_TARGET_HOUR`=5 aplicat în
  `dispatchAutomationEvent` prin `automations/{id}/rate/{targetId}` (fereastră fixă count+windowStart, reset orar; read
  admin/write false) — oprește oscilația (stateHash diferit) pe aceeași țintă. Garanții complete: dedupe + anti-buclă +
  cap AI + backstop orar. NOTĂ: F5b/F5c din nota de mai sus = ANULATE (clientul NU face automatizări — vezi Self Marketing).
- **Verticala 2 „Lansare Soft" — PORNITĂ (20.06.2026, modul `crm`): Facturi & Proforme.** Prima felie a verticalei a
  doua. Model `src/types/invoice.ts` (`Invoice` schema:1 + `coerceToInvoice` + `invoiceTotals` pur: rotunjire 2 zecimale/
  linie, apoi TVA pe subtotal). PDF: `src/utils/invoiceDoc.ts` (`composeInvoiceHtml` pur+escapat, reutilizează printDoc;
  print-to-PDF, fără deps). Colecție `clients/{uid}/invoices/{id}` (read owner+admin, write admin — validat în reguli).
  UI: tab „Facturi" în /admin (`InvoicesPanel`) — alegi client → listă + editor (părți/linii/TVA/status, totaluri live) +
  PDF. Test `scripts/test-invoice.ts`. e-Factura ANAF + numerotare auto + portal client = felii viitoare. NU e gated încă
  pe pachet (unealtă operator). Restul Verticalei 2 (CRM intern, comunicare, automatizări CRM) = neînceput.
- **Verticala 1 Marketing AI — ACTIVĂ (12.06.2026):** callable-ul `aiGenerateCampaign` e deployat
  la europe-central2: admin-only, quota lunară în `aiUsage/{uid}` (200/lună/operator), citește
  lead-ul + cererea server-side, model `claude-opus-4-8` cu adaptive thinking + ieșire structurată
  (schema CAMPAIGN_SCHEMA: adTexts/videoScripts/campaignStructure), scrie livrabilele pe
  `leads/{id}/requests/{reqId}` cu merge (notele manuale rămân; source: 'ai'). Butonul „Generează
  cu AI" din /admin e funcțional. `ANTHROPIC_API_KEY` = Secret Manager v1 (decizie Andrei: cheia
  inițială; ROTIREA rămâne în backlog înainte de scalare — la rotire: secrets:set cu cheia nouă +
  `npm run deploy:functions`). Comutatorul `AI_ENABLED` din functions/index.js stinge tot fluxul
  la nevoie (flip + deploy).
- **Pas „Oportunități" — recomandare canale AI (ACTIV 15.06.2026):** callable `aiRecommendChannels(leadId)`
  (admin-only, oglindă `aiGenerateCampaign`, aceeași quota `aiUsage`) — citește lead-ul, model
  `claude-opus-4-8` + `CHANNELS_SCHEMA` (4-6 canale: titlu/impact/motiv/descriere/obiectiv/ofertă), scrie
  `leads/{id}.channelRecommendations={schema,channels}` (merge). UI `OpportunityBoard` în rândul de lead:
  board sortabil după impact + „Creează cerere" pre-completată din oportunitate (→ LeadRequests). Coerce TS
  `src/types/recommendation.ts`. **Paritate TS↔JS↔schema:** clamp-ul JS din callable se DERIVĂ din
  `CHANNELS_SCHEMA` (anti-drift); coerce TS folosește aceleași 4 obiective + 4 niveluri de impact ca schema.
  Inspirat de competitor (vezi `docs/ANALIZA-COMPETITOR-...`); pivotul self-serve (client-gen+credite) e
  amânat post-MVP. Testat în test-landing (coerce/sort) + e2e TEST N (prompt+schema).
- **„Self Marketing" — strategie AI self-serve (ACTIV 16.06.2026, felia 1):** PRIMUL callable AI accesibil
  CLIENȚILOR non-admin: `selfGenerateStrategy({profile})` (auth obligatoriu, FĂRĂ admin-gate) → strategie amplă cu
  3-4 direcții (`STRATEGY_SCHEMA`: overview + per direcție poziționare/segment/canale/mesaje/idei/KPI), scrie
  `clients/{uid}/selfMarketing/strategy` (Admin SDK). Profilul firmei (`SelfCompanyProfile`: Firma/Ofertă/Piață/
  Obiective) scris de client la `clients/{uid}/selfMarketing/profile` (reguli: doar `profile`, whitelist + plafoane
  pe toate câmpurile; `strategy`/`quota` server-only, client-read). **Protecție cost (AI expus clienților):** quotă
  de trial per-client `consumeSelfQuota` (5 lifetime + 2/zi, `clients/{uid}/selfMarketing/quota`, SEPARAT de aiUsage)
  + **plafon GLOBAL/zi FAIR-SHARE (ACTIV 20.06.2026):** DOUĂ coșuri separate — `aiUsage/__selfGlobalTrial` (trial/gratuit,
  `trialDailyCap`=40) și `aiUsage/__selfGlobalEntitled` (clienți cu abonament activ, `entitledDailyCap`=200). Costul de ABUZ
  e mărginit DOAR de coșul trial, independent de plătitori → abuzul trial NU mai poate înfometa clienții plătitori (DoS prin
  epuizarea coșului unic, vechiul `__selfGlobal`=80, eliminat). Clasificarea coșului = `entitlement.active` (boolean
  RECALCULAT din `recomputeEntitlement`, NU `status` brut — sursă unică cu client.ts/entitlementStore), via
  `selfGlobalPoolFor`→`selfPoolFor` (pur, paritate TS↔JS e2e R2). `refundSelfQuota` restituie slotul per-client la eșec de
  model (coșul global rămâne backstop). **Gate email-verificat (ACTIV 20.06.2026):** toate self-callable-urile AI +
  `requestSelfAudit` cer `token.email_verified` când `requireEmailVerified` (config, implicit ON) → `permission-denied`+
  'EMAIL_NOT_VERIFIED' ÎNAINTE de consumul de quotă (descurajează farm-area cu adrese inexistente; Google = deja verificat;
  clientul: `Profile.emailVerified` + `sendEmailVerification` la signup + retrimite/`getIdToken(true)` + banner funnel).
  Plafoanele + gate-ul = `appConfig/selfMarketing` (`src/types/selfMarketingConfig.ts` coerce + port JS; reguli read+write
  admin), editabile din tab-ul „Sănătate & limite". **App Check e DEJA live** (enforceAppCheck pe self-callable-uri + cheie
  reCAPTCHA în .env.local → inline la deploy local). RĂMAS pe Andrei (config): confirmă App Check ENFORCEMENT pornit în
  consola Firebase. Input
  hard-cap server-side + output schema-constrained + clamp. Coerce TS `src/types/selfMarketing.ts` (paritate plafoane/
  industry-allowlist cu JS). UI: tab public `/self-marketing` (explicativ) → funnel logat `/app/self-marketing`
  (`SelfMarketingFunnel` + `SelfStepper` + `SelfProfileFields`). **Țintă: paritate cu marketingexplorer.ro (AI Marketing
  Explorer).** LIVE: Profil → **Oportunități** (S2, ACTIV 20.06.2026: `selfGenerateOpportunities` → ~10 idei prioritizate
  pe impact, `clients/{uid}/selfMarketing/opportunities`) → Strategie → Detalii → **Execuție** (S3, ACTIV 20.06.2026:
  `selfGenerateExecution` → plan 30 zile pe 4 săptămâni + A/B + optimizare, `.../selfMarketing/execution`) — toți cei 5
  pași LIVE, export PDF/copy peste tot. **Paritate funcțională de FLUX cu AI Marketing Explorer atinsă.** Rămas (non-flux):
  S4 bibliotecă multi-firmă, S5 credite cumpărabile (Stripe). Ghidul CLIENTULUI (clSelf) se actualizează la fiecare felie.
  (Automatizările NU sunt pt. client — vezi motorul de automatizare.)
  Hardening recomandat înainte de lansare publică largă: App Check (`VITE_RECAPTCHA_V3_KEY` + `enforceAppCheck`) +
  gate email-verified. Testat: test-self-marketing (coerce/validare) + e2e TEST Q (prompt/schema/coerce/allowlist).
- **Export PDF (ACTIV 16.06.2026):** `src/utils/printDoc.ts` — print-to-PDF din browser, FĂRĂ dependență
  (regula minimizare deps): `composePrintHtml` (pur) compune un document A4 brandat alb cu tot textul ESCAPAT
  (`escapeHtml` — anti-injecție din raport/livrabile, text liber AI/operator), `printHtmlDoc` tipărește
  într-un iframe ascuns (utilizatorul alege „Salvează ca PDF"). Butoane „📄 PDF" pe raportul lunar
  (`MarketingCenter`) + livrabile (`LeadRequests`) și în portalul clientului (`AppHome`). Testat headless
  (escape + compose). Amânat: jsPDF (descărcare fără dialog); logo imagine în antet; PDF pe KPI.
- **Tab „Sugestii" — next-step proactiv operator (ACTIV 16.06.2026):** `src/admin/suggestions.ts`
  (`buildSuggestions` PUR, testat) derivă „ce ai de făcut" din date DEJA generate (NU AI nou): lead-uri
  netratate (new ≥2 zile / contacted ≥14), campanii cu `aiInsight.verdict` pause/test/scale, lead-uri cu
  campanii fără raport luna curentă. `SuggestionsPanel` (tab nou în AdminHome) listenează `leads`/`campaigns`
  (limit 200/300), randează lista sortată pe severitate cu „Deschide" → schimbă tabul. Notă: la livrarea
  RBAC tabul Administratori lipsea din nav array (inaccesibil) — reparat odată cu acest tab.
- **Tab „Sănătate & limite" (ACTIV 20.06.2026):** `src/admin/HealthPanel.tsx` = control center de cost AI + observabilitate.
  **Setări (scriere admin):** card editabil pentru plafoanele fair-share Self Marketing + gate-ul email-verificat
  (`appConfig/selfMarketing`; dirty-ref ca un snapshot remote să nu piardă editări nesalvate). **Observabilitate (citire):**
  consumul AI de AZI pe coșurile `aiUsage/__selfGlobalTrial` + `__selfGlobalEntitled` + `__automationGlobal` (contoare/zi) +
  ultimele 50 erori (`errorReports`, onSnapshot orderBy at desc). Reguli: `errorReports` = `read: if isAdmin()` (date fără
  PII: name/message/stack/kind/version/build/userAgent/lang/at; create whitelist, update/delete false); `aiUsage` = read
  admin; `appConfig/selfMarketing` = read+write admin (ramură de validare în reguli). RĂMAS pe Andrei (consola GCP/Firebase,
  nu cod): App Check enforcement pornit; backup zilnic Firestore + PITR; alertă de buget GCP.
- **Ghid/Documentație — CONȚINUT COMPLET (ACTIV 20.06.2026; schelet din 16.06):** `src/help/helpContent.ts` — ghid
  SEPARAT operator/admin (`OPERATOR_HELP`, 10 module: leads/suggestions/requests/opportunities/marketing/**connectors**/
  **automation**/lp/admins/pdf) vs client (`CLIENT_HELP`, 5 module), randate în /admin tab „Ghid" respectiv /app „/app/ghid".
  `sec()` generează acum titlu + subtitlu + `bodyKey` per item; CORPURILE sunt completate (i18n `help.*` ro+en, 1-2 fraze
  scanabile). Test de acoperire verifică toate cheile (titlu+subtitlu+corp) în ro; paritate en prin typecheck. Conținut de
  completat la fiecare feature nou (ca DEVLOG). (Înlocuiește nota veche „SCHELET ... bodyKey viitor".)
- **(istoric) Ghid SCHELET (16.06.2026):** `src/help/helpContent.ts` (date pure: `OPERATOR_HELP`
  + `CLIENT_HELP`, doar chei i18n — titluri+subtitluri; `bodyKey` viitor pt. conținut),
  `src/help/HelpView.tsx` (prezentațional, refolosit). Tab „Ghid" în /admin + rută `/app/ghid`
  (`src/app/HelpHome.tsx`) + link în header /app. **Strategie:** schelet acum, conținut completat
  INCREMENTAL per feature (ca DEVLOG), polish spre lansare. i18n `help.*` ro+en; test de acoperire a cheilor
  (helpContent → ro). i18n = sursă unică pentru titluri.
- **Landing Pages — LP Studio (ACTIV, 13.06.2026):** tab „Landing Pages" în `/admin` = un „IDE":
  editor de cod (textarea HTML) SAU **builder vizual pe blocuri** (mod `editor: 'code'|'visual'` pe
  LP; blocurile din `src/types/lpBlocks.ts` se compilează prin `compileBlocks` în ACELAȘI `html`
  servit de serveLp — servirea/regulile nu se schimbă; eject one-way visual→cod). Tipuri de bloc:
  hero/heading/text/image/button/features/testimonial/faq/form/spacer/decor + (slice 1, 16.06.2026)
  **pricing/stats/logos/gallery(grid|carusel)/accordion/countdown/video**. Securitate compile: `esc()` pe
  tot textul, `SAFE_URL` (https) pe imagini, `safeHref` pe linkuri, video = `ytVimeoEmbed` (id allowlist
  youtube-nocookie/vimeo), countdown = `<script>` cu INTEGER embed + JSON.stringify (anti `</script>`). Plus preview live
  (iframe sandbox FĂRĂ same-origin) + agent AI
  (`aiGenerateLandingPage`/`aiEditLandingPage` — întorc `{html}`, NU scriu în Firestore; quota
  `aiUsage`) + panou design (refolosește `CustomTheme` via `ThemeControls`) + config formular +
  dashboard analytics. Colecția `landingPages/{slug}` (doc ID = slug, unic prin construcție),
  `schema:1`, coerce unic în `src/types/landingPage.ts`; design = `CustomTheme`; cod = un singur HTML
  self-contained ≤200KB. **Servire:** funcția `serveLp` (onRequest, europe-central2), legată prin
  rewrite Hosting `/p/** → serveLp` (gen-2, pinTag) ÎNAINTE de catch-all. serveLp = „nexus de trafic":
  randează SSR (SEO din doc: title/description + **og:image/twitter:card/favicon** din `ogImage`/`favicon`
  ale LP-ului, URL-uri https validate `LP_SAFE_IMG` + escapate — slice 2, 16.06.2026; design injectat ca
  variabile CSS prin `lpThemeCss` = port JS al `customThemeCss`), `Cache-Control: no-store` (ca fiecare hit
  să se logheze), CSP restrictivă, și
  LOGHEAZĂ fiecare vizită → rollup zilnic `landingPages/{slug}/stats/{YYYY-MM-DD}` (increment) + doc
  brut `visits`. Beacon injectat (scroll/timp/CTA → `/p/_track`) + formular opțional per LP
  (`/p/_submit` → `submissions` + opțional lead în pipeline). Motor analytics pur:
  `src/analytics/lpStats.ts`. Submissions/visits/stats = scrise DOAR de functions (rules:
  create/write false).
  **Formulare avansate (slice 3a, 16.06.2026):** tipuri câmp `LP_FIELD_TYPES` =
  text/email/tel/number/date/textarea/select/radio/checkbox (radio capătă `options` ca select).
  **Honeypot anti-spam**: input ascuns off-screen `LP_HP_FIELD='lp_hp_url'` (paritate TS în
  `landingPage.ts` + JS în `functions/index.js`); `handleSubmit` îl detectează completat → fake-success
  fără scriere; `coerceField` ELIMINĂ un câmp real numit `lp_hp_url` (anti coliziune / pierdere lead).
  **Redirect după submit**: `LpFormConfig.redirectUrl` (https-only `SAFE_HTTPS`/`LP_SAFE_IMG`, validat la
  coerce ȘI la serve, niciodată din body); `handleSubmit` întoarce `{ok:true,redirectUrl}`, scriptul de
  form navighează `location.href` după ~1.2s (re-check https client-side).
  **Conversie pagină (slice 3b, 19.06.2026):** `LandingPage.conversion` (`LpConversion`: stickyCta + exitPopup) →
  `compileConversion` (în `lpBlocks.ts`, lângă escapere) produce `conversionHtml` (ca pageDecorHtml), injectat de
  serveLp în `<body>`. **Sticky CTA** = bară fixă jos (var(--accent), data-cta pt. tracking). **Exit-intent popup** =
  modal `#lp-exit` ascuns + script (mouseout spre bara de adrese, o dată/sesiune via sessionStorage). Text escapat,
  href `safeHref` (acum permite ȘI ancore `#sectiune`), scriptul fără date user. UI: tab „Conversie" (`LpConversionPanel`).
  **Formular multi-step (#59 complet, 19.06.2026):** `LpFormField.step` + `LpFormConfig.multiStep`; blocul `form`
  grupează câmpurile pe pași (≥2 grupuri, altfel plat) cu nav Înapoi/Înainte/Trimite + validare per pas
  (`checkValidity`) + script inline; `compileBlocks` primește `lang` (nav ro/en); submit unic (handler serveLp neschimbat).
- **Decor animat interactiv (ACTIV, 14.06.2026):** `src/types/lpDecor.ts` — `compileDecor` produce
  `<canvas>`+`<script>` inline self-contained (motorul trăiește DOAR în TS); 7 efecte (dots/
  constellation/shapes(7 forme)/grid/waves/bubbles/rings) × 4 interacțiuni (none/mouseReact/
  mouseAttract/mouseParallax/scrollParallax) + intensitate reglabilă (0-100) + **plasare liberă** (effect 'custom': elemente individuale
  poziționate prin drag în `LpFreeformEditor`, 9 forme, animație per element float/pulse/spin/drift,
  randate ca DOM via `compileCustomDecor`/`elementStyle`); culoare
  = `--accent` la runtime; respectă `prefers-reduced-motion`. Două locuri: **fundal de pagină** — STRATURI
  MULTIPLE (`LandingPage.pageDecors: LpDecor[]`, cap 5, suprapuse; ACTIV 15.06.2026) gestionate de
  `LpDecorLayers` (add/remove/reorder peste `LpDecorControls`); `compilePageDecors` concatenează straturile
  (id unic pg0,pg1…) în `pageDecorHtml`, injectat de serveLp după `<body>` (`body{position:relative;z-index:0}`
  ⇒ canvas `z-index:-1`). Coerce migrează legacy `pageDecor` single → `[strat]`. Și **bloc `decor`** (în
  builder, cu overlay text; rămâne single). serveLp servește tot string-ul precompilat (fără port JS al
  motorului). Gardă de mărime la salvare = `html + pageDecorHtml ≤ 200KB`. Amânat: fundaluri multiple pe
  BLOC; WebGL.
- **Atribuire per-link (UTM, ACTIV 15.06.2026):** linkul LP se postează pe multe platforme + assets
  video/statice cu versiuni, codificate prin UTM. Cheia variantei = `src/types/lpAttribution.ts`
  (`variantKey` = [source,medium,campaign,content] sanitizate, unite cu `~`; PUR) + **port JS** în
  functions/index.js (paritate TS↔JS testată cross-runtime în `e2e-lp-serve.mjs`). **Anti-bloat fără
  citire:** `landingPages/{slug}.knownVariants:{[key]:true}` (scris de Link Builder, plafon 200); serveLp
  citește deja doc-ul → variantă cunoscută = contor dedicat `variants/{key}`, UTM necunoscut → `__other`,
  fără UTM → `__direct`. serveLp/handleTrack/handleSubmit scriu în batch {stats(+`byMedium`) + variantă}
  (visits/engagement/submissions); `variantKey` la submit se calculează SERVER-side din UTM. UI: tab
  „Linkuri" (`LpLinkBuilder` — compune URL etichetat + salvează în `links/{id}`+knownVariants + listă cu
  performanță) + în `LpAnalytics` card „Tip asset" (byMedium) + tabel „Variante observate". Reguli:
  variants read-only (functions), links admin-rw (hasOnly+format). Boții rămân în `visits` (înregistrăm
  tot traficul). Amânat: atribuire multi-touch; export cross-LP; conectori platformă API.
- **Organizare LP (ACTIV 15.06.2026):** colecție gestionată `lpProjects/{id}` (nume + culoare + client
  implicit; `src/types/lpProject.ts` + `LpProjectManager`) + `LandingPage.projectId` și `clientUid`
  (atribuite din bara meta a editorului). Lista din Studio: filtre (chips proiect + dropdown client) +
  coloană Proiect/Client; un projectId care referă un proiect șters e tratat ca „fără proiect". Reguli:
  `lpProjects` admin-rw (hasOnly + validare). `clientUid` pe LP = fundația accesului VIITOR al clientului
  la datele lui (portal scoped — de făcut). **Citirea doc-ului `landingPages` e DOAR isAdmin** (publicul
  primește pagina prin serveLp/Admin SDK) — ca să nu se scurgă câmpuri interne.
- **Analytics LP extins:** tabel variante sortabil + export CSV + comparație A/B/n (agregare după
  versiune/asset/platformă/campanie, câștigător după rata de conversie). Contoarele `variants/{key}` sunt
  all-time (fără axă de zi); tabelul/comparația sunt etichetate „(total, toate timpurile)".
- **A/B testing „pe sloturi" (ACTIV 19.06.2026, #60):** test de CONȚINUT pe un slot din pagină, NU pe UTM
  (axă ortogonală de `variants/{key}`). Model: bloc `experiment` (props.expId) ocupă o poziție → `html` are
  placeholder `<!--LP_EXP:id-->`; `LandingPage.experiments[]` (LpExperiment: arms cu blocks/weight/label, status,
  minSample, winnerArm) + `armsHtml[exp][arm]` (fiecare arm.blocks prin ACELAȘI compileBlocks; precompilat ca
  pageDecorHtml). Gardă 200KB pe SUMA html+toate armele+decor+conversie (`lpServedByteSize`). **serveLp** (JS pur,
  testat e2e): `pickAbAssignment` alege varianta per slot — winner promovat→100% (fără cookie/contor); off/stopped→
  control; running→sticky-cookie `lpab_{slug}` (Path=/p, SameSite=Lax, Secure) sau split ponderat; **boții→control
  fără contor** (nu poluează eșantionul). O dată/request → consistență vizită↔contor. `applyArms` înlocuiește
  placeholderele. Contoare `landingPages/{slug}/abStats/{expId__armId}` (vizite în logLpVisit, conversii în
  handleSubmit din cookie sau `__unattributed`); reguli read scoped (ca stats/variants), write false. **FĂRĂ HMAC în
  v1** (ar lega serveLp de secret indisponibil; tamper = mutarea propriei conversii între arme valide = neglijabil;
  HMAC = backlog). **Motor câștigător PUR** `src/analytics/lpABWinner.ts` (`pickAbWinner`): **z-test pe două proporții**
  (CDF normal via erf, fără deps) la α=0.05 + prag minSample → insufficient/no-difference/winner (NU doar uplift —
  anti fals-pozitiv). UI: tab „A/B" (`LpExperimentsPanel`: experimente+arme, conținut prin builder reutilizat, slot)
  + card rezultate în LpAnalytics (`LpAbResults`: tabel + verdict + „Promovează câștigătorul" DOAR la verdict
  statistic → anti-peeking). NON-REGRESIE: LP fără experimente → assign gol, applyArms no-op → output identic.
- **Acces client la datele LP în portal (ACTIV 15.06.2026):** clientul logat în `/app` vede LP-urile LUI
  (`LP.clientUid == uid`) — performanță + defalcare canal/versiune + **lead-urile capturate** (clienții
  lui; portalul = și CRM de monitorizare a propriilor clienți). HIBRID: scoped reads (reguli `get(parinte)
  .clientUid == auth.uid` pe `stats|variants|submissions`, ca la campaigns/metrics; doc-ul `landingPages`
  + `visits` rămân admin-only; unlink INSTANT) + index de descoperire `clients/{uid}/lpIndex/{slug}`
  (oglindit de `onLandingPageWrite`, doar slug/title/publicUrl/status). `backfillLpIndex` (callable admin,
  buton „Sincronizează portalul") pt. LP-uri deja atribuite. Portal = `LandingPagesPortal` în AppHome,
  reutilizează lpStats/lpAttribution. Notă: acordurile cu clienții trebuie să acopere datele lead-urilor.
- **Mini-CRM client pe lead-uri LP (ACTIV 15.06.2026):** clientul gestionează lead-urile capturate —
  status (Nou→Contactat→Calificat→Câștigat/Pierdut) + notă + filtrare/numărare + export CSV. Stare
  deținută de client în `clients/{uid}/lpLeadState/{submissionId}` (`src/types/lpLeadState.ts`), SEPARAT
  de `submissions` (pipeline-ul agenției). Reguli owner-rw (hasOnly+enum+size+`updatedAt==request.time`).
  Exporturile CSV trec prin `src/utils/csv.ts` (`toCsv`/`csvCell` — anti formula-injection; și în LpAnalytics).
- Amânat (LP general): servire pe subdomeniu (izolare XSS pt. autori ne-de-încredere); cod >200KB în
  Storage; `/en/p/**`; atribuire lead la membru de echipă + istoric status; suită reguli cu emulator.
- **Site CMS public — LP Studio controlează site-ul NOSTRU (Workstream B, ACTIV 16–19.06.2026):** panoul
  „Site" din `/admin` administrează design-ul + chrome-ul + paginile site-ului public, **separat strict** de
  LP-urile de campanie. **DISTINCȚIE CRITICĂ:** tema publică + chrome-ul global se aplică DOAR pe site-ul NOSTRU =
  paginile React (`SiteLayout`) + paginile de site `kind:'site'` (`/pagina/{slug}`). **LP-urile de campanie
  `kind:'campaign'` (`/p/{slug}`) sunt ale CLIENȚILOR — ZERO temă publică, ZERO chrome global; design + blocuri proprii.**
  - **B1 — temă publică:** `siteConfig/publicTheme` (CustomTheme) editată în „Site" cu `ThemeControls`. Tipar
    HIBRID anti-flash/anti-hydration-drift: snapshot copt (`src/config/publicTheme.ts`, render sincron == prerender)
    + override runtime `getDoc` cu guard `navigator.webdriver` (NU citi Firestore sub prerender/boot — listener-ele
    blochează `networkidle`). serveLp aplică tema ca `design` pe paginile `kind:'site'` (`getPublicThemeDesign`, cache modul ~60s).
  - **B2a — pagini de site:** `LandingPage.kind: 'campaign'|'site'` (default campaign). `LandingStudio` are prop
    `kind` (filtre/metrici/recompile pe tip; slug-unicitate GLOBALĂ pe colecție). serveLp separă strict: `/pagina`
    servește DOAR `kind:'site'` publicate, `/p` restul; kind greșit → 404. `firebase.json`: rewrite `/pagina/** →
    serveLp` FĂRĂ pinTag (două rewrite-uri cu pinTag pe același Run service → „Failed to replace Run service").
  - **B2b — header/footer GLOBAL + meniu data-driven:** `siteConfig/publicChrome` (`SiteChrome`:
    brand/tagline ro+en/nav[]/CTA/footer text+links[], `src/types/siteChrome.ts`, coerce unic — `internalHref`
    anti open-redirect, plafoane ≤12 itemi). Etichete LITERALE per-limbă (EN cade pe RO) — fără i18n în functions.
    Proiectat O SINGURĂ DATĂ în „Site" (`ChromeEditor`, câmpuri structurate + preview ro/en), aplicat AUTOMAT pe
    paginile React (`usePublicChrome` + `SiteLayout`, hibrid) ȘI pe `/pagina/{slug}` (serveLp `composeSiteChrome`
    injectează header/footer escapate + href localizat; `composeLpPage(...,chrome)` — chrome `null` pe `/p/` =
    NEATINS; `DEFAULT_SITE_CHROME` fallback, paritate TS↔JS testată e2e). Reguli `siteConfig/{docId}` =
    `docId in ['publicTheme','publicChrome']`, read public, write admin. Snapshot-uri coapte de
    `scripts/pull-public-{theme,chrome}.mjs` (manual în sync, înainte de build:site).
  - Amânat (B2c): sitemap dinamic `/pagina/sitemap.xml`; bilingv complet pe paginile de site (pereche ro↔en);
    ascunderea tab-ului Design în LpEditor pt. `kind:'site'`.

## Capcane cunoscute

- `base: '/'` în vite.config.ts — NU `'./'` (rupe asseturile pe rutele prerenderizate imbricate).
- Tripleta de regiuni (extensie = `VITE_FIREBASE_FUNCTIONS_REGION` = functions) trebuie să
  coincidă, altfel callables eșuează cu „internal" opac.
- Produsele Stripe create ÎNAINTE de webhook nu se sincronizează în Firestore — re-salvează-le.
- Paginile publice se randează determinist (fără `Date.now()`/random în render) — `createRoot`
  înlocuiește HTML-ul prerenderizat și trebuie să fie identic.
- Node local e 25, dar functions + CI rulează Node 20 (pinned prin `engines` și workflow).
- **Code-splitting (App.tsx):** rutele auth-gated (NEprerenderizate) `/app*` + `/admin` sunt `React.lazy` (chunk-uri la
  cerere; `index` 172KB). Paginile PUBLICE rămân import STATIC — dacă le faci lazy, prerender-ul capturează fallback-ul de
  Suspense și hidratarea diferă (flash/mismatch). `firebase` (692KB) e tot pe calea critică (auth init) — lazy-firebase = backlog.
