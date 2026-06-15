# GAP-URI VERIFICATE

## [confirmat-absent] Verificare absență structură de credite consumabile în DataRead
- categorie: monetizare
- de ce conteaza: Modelul de credite are un prag de intrare mult mai mic (19 LEI vs 149 EUR/luna) si captureaza clienti care nu vor angajament lunar. Pentru o platforma B2B pentru firme mici din Romania, accesibilitatea pretului de intrare e decisiva pentru conversie; abonamentul de la 149 EUR exclude segmentul micro.
- status DataRead: Explorare completă codebase DataRead
- dovada: DataRead are DOAR abonamente lunare recurente Stripe (3 pachete: 149/399/999 EUR), fără sistem de credite consumabile. Colecția aiUsage/{uid} (functions/index.js, l. 204-334) e doar tracking intern (200 generări/lună per operator), nu produs de vânzare. Firestore rules (l. 140-143): read admin-only, write false. Zero colecții pentru creditBalance, creditsTransaction, sau creditPackages. UI checkout (Packages.tsx, l. 60-61) e dormant. Documentația (PACHETE-SI-PRETURI.md) descrie 3 pachete lunare cu entitlements (cotale postări/imagini), NU credite vândute. Spec-ul (SPEC-arhitectura-Ionut-2026-06-10.md) zero referință la monetizare pe credite. Competitorul vinde pachete de credite (Starter 19 LEI=10 credite, Business 79 LEI=50, Professional 249 LEI=200); DataRead nu are această infrastructură.

## [confirmat-absent] Verificare: Explorări gratuite (trial de consum) în DataRead
- categorie: monetizare
- de ce conteaza: Freemium pe consum (nu pe timp) lasa prospectul sa vada valoarea AI-ului INAINTE sa plateasca — motorul clasic de conversie self-serve. DataRead nu are niciun mecanism de 'try before you buy', deci depinde 100% de vanzare asistata de operator, ceea ce nu scaleaza.
- status DataRead: Analizate 7 fișiere critice: CLAUDE.md, entitlementStore.ts, entitlementLogic.ts, functions/index.js (secțiunile entitlement + AI callable-uri), packages.ts, PROJECT_KICKOFF.md
- dovada: DataRead NU are nicio implementare de trial/freemium bazat pe consum. Evidența:

1. **CLAUDL.md linia 134 (oficial):** "Entitlements: extensia Stripe scrie `customers/{uid}/subscriptions` → functions `onSubscriptionWrite` → custom claim `ent` + mirror `clients/{uid}.entitlement`. FĂRĂ trial. Statusuri: `none | active | expired`."

2. **PROJECT_KICKOFF.md (decizie Andrei, 11.06.2026):** "Trial: fără trial (decis 11.06.2026) — plata începe de la abonare; eventuala garanție de preț fix de listă; fără trial."

3. **entitlementLogic.ts linia 4 + 68:** "FĂRĂ trial în DataRead: statusurile sunt `none | active | expired`" și "Fără abonament (sau nelogat): none. (Fără trial — nu există stări intermediare.)"

4. **AI callable-uri (aiGenerateCampaign, aiClientReport, aiAnalyzeCampaign, etc.):** TOATE verifică `if (request.auth.token.admin !== true)` → aruncă 'permission-denied'. Niciun callable AI nu este accessible pentru utilizatori neplătiți sau clienți finali în portal (/app).

5. **consumeAiQuota (functions/index.js linia 322-334):** Quota lunară e de 200 generări/lună per OPERATOR (uid-ul apelantului trebuie să aibă claim admin=true). Nu există nicio cale de consum gratuit pentru utilizatorii fără abonament activ.

6. **packages.ts (config/packages.ts):** Toate 3 pachete (start 149€, growth 399€, premium 999€) necesită abonament Stripe activ. Nicio modulul 'marketing' nu e disponibil în starea 'none'.

7. **entitlementStore.ts:** Cached subscriptions sunt reevaluate pe fiecare event; offline = se păstrează cache, dar needsResync=true dacă período a trecut. Nicio rută de „credit gratuit" sau „trial window".

CONCLUZIE: Competitorul oferă „2 explorări gratuite rămase" ca freemium entry. DataRead nu are echivalent. Infrastructura e pură: 3 statusuri de abonament (none/active/expired), AI admin-only, 0 mecanică de credit/trial/consum gratuit.

## [confirmat-absent] Verificare afirmație competitor DataRead — Cost-per-generare
- categorie: monetizare
- de ce conteaza: Pretul pe actiune aliniaza venitul cu costul real de inferenta AI (care DataRead il suporta integral pe model Opus, cel mai scump) si permite monetizarea utilizatorilor intensivi. Cu abonament flat, un client care genereaza mult erodeaza marja; cu credite, consumul mare = venit mai mare.
- status DataRead: Căutare exhaustivă: CLAUDE.md (reguli hard de proiect), functions/index.js (backend central), src/config/packages.ts (sursa unică de pricing), src/services/billing.ts (logica facturării), docs/PACHETE-SI-PRETURI.md (oferta comercială), docs/SPEC-arhitectura-Ionut-2026-06-10.md (viziunea), PROJECT_KICKOFF.md (scope contract).
- dovada: CONFIRMAT ABSENT: DataRead NU are cost-per-generare și NU factureaza pe acțiune. Dovezi: 1) Model de billing = ABONAMENT FLAT LUNAR (3 pachete: Start 149€/lună, Growth 399€/lună, Premium 999€/lună). 2) Quota internă aiUsage/{uid} cu limita 200 generări/lună este DOAR pe operator (control intern), nu vizibilă clientului și nu legată de facturare. 3) Entitlement = doar status abonament (active/expired), priceId, periodEnd — zero câmpuri de consum sau cost per acțiune. 4) Billing service citește doar subscription metadata, nu consumuri. 5) Documentația (PACHETE-SI-PRETURI.md) explicit: pachete = preț lunar recurent Stripe; cotele (postări/lună, video/lună) = LIMITĂRI DE CAPACITATE (entitlements), nu costuri per unitate. Nu se menționează nicăieri metering, credite, sau debitare variabilă pe generări. Diferența: competitor factureaza variabil per generare (credite pe action); DataRead factureaza flat lunar, iar costurile AI interne se absorb de agentie în abonament.

## [confirmat-absent] Verificare: Model de preț granular per nod / per subiect de aprofundat în DataRead
- categorie: monetizare
- de ce conteaza: Pretul per nod transforma fiecare functie in oportunitate de upsell si lasa clientul sa plateasca exact ce ii trebuie. Diferentierea pretului dupa complexitate (Funnel 5 vs Buget 1) captureaza valoarea perceputa. DataRead lasa bani pe masa vanzand totul intr-un singur bloc cu pret fix.
- status DataRead: Cod analizat: CLAUDE.md (liniile 29-60, principiile arhitecturii și regulile de lucru), PROJECT_KICKOFF.md (secțiunea 4 - Model de business), docs/PACHETE-SI-PRETURI.md (oferta comercială completă), src/config/packages.ts (definiția pachetelor și a modulelor), src/store/entitlementStore.ts și entitlementLogic.ts (rezolvarea drepturilor de acces), functions/index.js (callable-urile AI și quotele), src/types/client.ts (profilul de client și entitlements).
- dovada: DataRead implementează DOAR un model de preț în 3 pachete fixe lunare (monolitic per abonament), fără granularitate per nod/subiect: - 149 €/lună Pachet Start - 399 €/lună Pachet Growth - 999 €/lună Pachet Premium Fiecare pachet include un set COMPLET, NESEGMENTAT de livrabile (docs/PACHETE-SI-PRETURI.md, linia 8-71): postări lunare, imagini AI, videoclipuri, rapoarte, idei de conținut — toate INCLUSE, nu vândute granular. Modelul de entitlement (src/store/entitlementStore.ts, src/store/entitlementLogic.ts) rezolvă dreptul la MODULE (feature flags), nu la credite/noduri diferențiate: PackageDef în src/config/packages.ts folosește DOAR: monthlyAmount, modules[], nu câmpuri de credit/quota per subiect. Cloud Functions (functions/index.js, linia 216) folosesc o SINGURĂ cotă globală (AI_MONTHLY_LIMIT = 200 generări/operator), NU credite diferențiate per tip de livrabil (texte: X, video: Y, structură: Z). Livrabilele scrise pe cerere (adTexts, videoScripts, campaignStructure, calendar, posts, ideas) sunt tratate ca livrabile UNIFI în aceeeași cerere, NU ca articole cu pret diferit — se generează împreună ca un pachet (CAMPAIGN_SCHEMA și CONTENT_SCHEMA din functions/index.js, liniile 219-260) și se scriu într-o singură înregistrare Firestore de cerere. Niciun cod sau configurație nu implementează un sistem de credite, noduri de cost, sau preț per aprofundare temă — doar: status abonament (active/expired), modul activ (marketing/crm/sales/chatbot), și quota lunară unificată.

## [partial-prezent] Verificare Gap: "Re-deschidere gratuita a continutului generat"
- categorie: monetizare
- de ce conteaza: Regula 'platesti o data, revii gratis' clarifica pentru client CE plateste (generarea, nu accesul) si reduce frica de a 'irosi' credite — un boost direct la conversia freemium. Fara ea, perceptia de pret e ostila si descurajeaza experimentarea.
- status DataRead: Cod citit integral: CLAUDE.md, functions/index.js (liniile 321-334, 646-657), src/types/request.ts, src/admin/LeadRequests.tsx (liniile 166-213), src/i18n/locales/ro.ts
- dovada: DataRead are un sistem de **versiuni cu istoric**, dar NU are mecanismul de **re-deschidere gratuita** pe care competitor-ul promite.

INFRASTRUCTURA EXISTENTA (partial-prezent):
1. **Sistem de versiuni INTEGRAL**: `leads/{leadId}/requests/{reqId}/versions` — fiecare regenerare AI salvează starea curentă automat INAINTE de suprascriu (functions/index.js, liniile 644-657, reason='pre-ai-regenerate'). Versiunile se salvează și la restaurare manuala (reason='pre-restore').
2. **Restaurare gratis a versiunilor**: UI din LeadRequests.tsx (liniile 186-213) permite restaurarea oricărei versiuni trecute FARA cost — se apelează doar updateDoc, NU consumeAiQuota.
3. **Calculul corect al cotei**: consumeAiQuota (liniile 321-334) se apelează o singură dată per **generare AI** (aiGenerateCampaign, aiEditLandingPage, etc.), NU la deschidere.

CE LIPSESTE (confirmat-absent):
1. **NU exista conceptul de "continut deja platit care se redeschide gratis pe o pagina noua"**: versiile salvate sunt disponibile DOAR pe aceeași cerere/pagină, NU pot fi copiate/deschise în altă cerere fără cost.
2. **NU exista "skipQuota" sau "isFreeRetry"**: Orice apel la aiGenerateCampaign, aiGenerateLandingPage, aiEditLandingPage consuma quota (await consumeAiQuota, liniile 459, 530, 776, 795). Nu e diferențiat între "noua generare" vs "reluare a unui draft anterior".
3. **NU exista pricing diferențiat per "perechi de deschideri"**: Modelul e simplu — quota lunara = 200 generari/operator/luna (CLAUDE.md, linia 146).

DOVEZI IN COD:
- **functions/index.js, liniile 321-334**: `consumeAiQuota` nu are nicio logica conditională pentru "free reopen" — consumă pur și simplu din quota lunara.
- **functions/index.js, liniile 646-657**: Versiunile se salvează **INAINTE** de AI (plasa de siguranță), dar nu au niciun flag privat/public sau concept de "cost pus deoparte".
- **src/i18n/locales/ro.ts, linia 386**: Mesajul de restaurare spune "notele rămân neatinse" (merge curat, NU generare noua) — deci e clar ca restaurarea = mutare de pointer, zero AI.
- **Absenta totala a termenilor "free", "reopen", "cost", "skip" in functiile AI** (grep-ul returneaza nimic).

CONCLUZIE: DataRead are versioning BUN (ca o reasigurare), dar NU are economie de quota pentru "deschideri repetate". Fiecare apel al `aiGenerateCampaign` consuma 1 credit, indiferent daca e generare noua sau editare unei versiuni trecute.

## [partial-prezent] Checkout self-serve activ (cumparare in produs) — DataRead vs competitor
- categorie: monetizare
- de ce conteaza: Fara checkout in produs, fiecare conversie necesita interventie umana (operator) — invers fata de un SaaS care scaleaza. Competitorul poate incasa la momentul intentiei maxime (cand clientul vrea sa genereze acum); DataRead pierde acel moment intr-un email 'contacteaza-ne'.
- status DataRead: DataRead are infrastructura completa de checkout (createCheckoutSession, portal UI, backend entitlements) dar este NEFUNCTIONALA — priceIds Stripe sunt goale in .env.local. Portal /app are UI complet cu buton checkout, dar nu este accesibil din site public (decizie 11.06). Rezultat: checkout DORMANT pana cand Andrei seteaza VITE_STRIPE_PRICE_START/GROWTH/PREMIUM.
- dovada: Dovezi: (1) createCheckoutSession() integral in src/services/billing.ts:156-186; (2) UI checkout in AppHome.tsx:524-570 (card subscription completa cu button "Purtati pachetul"); (3) startCheckout() si openPortal() declarate; (4) VITE_STRIPE_PRICE_* = '' in .env.local; (5) billingConfigured() = false (blocheaza activarea); (6) Site public Packages.tsx:62 duce la /start nu la checkout; (7) CLAUDE.md linia 76 confirma "self-serve public ramane DORMANT".

## [confirmat-absent] Verificare gap funcționalitate: Vizibilitatea soldului și consumului în UI client DataRead
- categorie: monetizare
- de ce conteaza: Vizibilitatea soldului + pretul afisat inainte de actiune creeaza presiune de re-incarcare (cand soldul scade) si transparenta care construieste incredere. E mecanismul psihologic care face economia de credite sa functioneze; fara el, chiar daca DataRead ar adauga credite, conversia la re-cumparare ar fi slaba.
- status DataRead: Analiza completă a codului DataRead: CLAUDE.md, src/, functions/, firestore.rules, i18n
- dovada: ## Dovezi ale ABSENȚEI funcționalității:

### 1. **Colecția `aiUsage/{uid}` — admin-only (firestore.rules:140-143)**
```
match /aiUsage/{uid} {
  allow read: if isAdmin();
  allow write: if false;
}
```
Clientul (non-admin) **NU poate citi** colecția aiUsage, indiferent de context.

### 2. **Portalul client `/app` (AppHome.tsx) — zero referințe la consum/credit**
- Componentele active: `MarketingPortal` (campaniile clientului, KPI-uri), `LandingPagesPortal` (date LP), subscription status (pentru plată, nu pentru quote-uri)
- **LIPSESC**: 
  - Nicio bară de progres a creditelor
  - Nicio afișare de „explorări gratuite rămase"
  - Nicio indicare a prețului pe acțiune
  - Nicio referință la aiUsage în client-side
  - Nicio variantă de i18n pentru consum/sold/credit

### 3. **Entitlement-ul clientului (entitlementStore.ts) — doar status abonament**
- Tracked: `status` (none|active|expired), `packageId`, `modules` (feature flags), `subscription` (datele Stripe)
- **LIPSESC**: counter-uri de generări AI, solduri de credit, limitări de acțiuni

### 4. **Client profile (types/client.ts) — ZERO câmpuri de consum**
```typescript
export interface ClientProfile {
  schema: typeof CLIENT_SCHEMA;
  email: string | null;
  displayName: string | null;
  locale: 'ro' | 'en';
  onboardingStatus: 'none' | 'submitted';
  entitlement: ClientEntitlement | null; // doar {active, status, periodEnd, priceId}
}
```
Nicio structură pentru aiUsage, credit balance, sau consumed calls.

### 5. **Functions (index.js:321-334) — `consumeAiQuota()` logică backend-only**
- Quota **nu e trimisă clientului** după consum
- Quota **nu e consultabilă** din client SDK
- Mecanic: server verifică + arunca `resource-exhausted` dacă depășit

### 6. **Absenț i18n pentru concept de consum**
- Niciun string i18n care să sughereze solduri, credite, limitări de generări
- Niciun text de tipul „Buget 1 credit", „Explorări rămase", „Deschide"

### 7. **Comparație cu competitor (afirmația)**
- **Competitorul**: bară de progres permanentă + numrul explorărilor gratuite + preț pe fiecare acțiune
- **DataRead**: subordonare per-abonament (feature flags în `modules`), fără UI de granularitate de credite

## [confirmat-absent] DataRead - Verificare Gap "Produs Self-Serve Condus de Client"
- categorie: flux-produs
- de ce conteaza: Modelul self-serve schimba fundamental fluxul de produs si economia: clientul produce valoare singur (scalabil, marja mare), nu blocat de timpul a doi operatori. Pentru DataRead, care se vrea un business OS extensibil, un mod self-serve gated pe pachet ar debloca un al doilea segment de utilizatori fara cost marginal de operator.
- status DataRead: Investigație completă: CLAUDE.md, functions/index.js (liniile 200-800), LeadRequests.tsx, AppHome.tsx, firestore.rules
- dovada: 
AFIRMAȚIA COMPETITORULUI: Utilizatorul final (clientul firmei) se loghează singur și generează strategii de marketing / landing pages fără intervenția operatorului.

STAREA ÎN DATAREAD: Gap-ul este CONFIRMAT-ABSENT. Toate cele 5 callable-uri AI sunt STRICT admin-only:

1. **aiGenerateCampaign** (functions/index.js:585-587): `if (request.auth.token.admin !== true) throw 'Doar operatorii pot genera campanii.'`
2. **aiAnalyzeCampaign** (functions/index.js:516): `if (request.auth.token.admin !== true) throw 'Doar operatorii pot analiza campanii.'`
3. **aiClientReport** (functions/index.js:448): `if (request.auth.token.admin !== true) throw 'Doar operatorii pot genera rapoarte.'`
4. **aiGenerateLandingPage** (functions/index.js:771): `if (request.auth.token.admin !== true) throw 'Doar operatorii.'`
5. **aiEditLandingPage** (functions/index.js:787): `if (request.auth.token.admin !== true) throw 'Doar operatorii.'`

IMPLEMENTAREA ACTUALĂ:
- **Portal client (/app) — READ-ONLY**: AppHome.tsx (liniile 28-177) arată că clientul logat vede:
  - Campaniile lui (scoped pe clientUid prin firestore.rules:151)
  - Raportul lunar (oglindit de functions în clients/{uid}.marketingReport)
  - Livrabilele (oglindit în clients/{uid}/deliverables/{reqId})
  - NICIUNul din aceste documente nu permite scrierea de către client (firestore.rules: `allow write: if false` la liniile 97, 104, etc.)

- **Apeluri AI**: Doar LeadRequests.tsx (componentă admin, linia 269-272) poate apela httpsCallable('aiGenerateCampaign'). Directorul /app/ NU conține niciun httpsCallable.

- **Regulile Firestore**: 
  - leads/{id}/requests/{reqId}: `allow create, update, delete: if isAdmin()` (liniile 65) — clientul NU poate crea/edita cereri
  - campaigns/{id}: `allow create, update, delete: if isAdmin()` (liniile 152) — clientul NU poate crea/edita campanii
  - landingPages/{slug}: `allow create, update: if isAdmin()` (linia 171) — clientul NU poate crea/edita LP

MECANISMUL ACTUAL (manual, condus de operator):
1. Clientul se loghează în /app (portal read-only)
2. Operatorul se loghează în /admin
3. Operatorul creează cererea (lead + campaign request)
4. Operatorul apasă "Generează cu AI" → callable aiGenerateCampaign (admin-only)
5. Clientul vede output-ul final (deliverables, marketingReport) în portalul lui (READ-ONLY, oglindit de functions)

INFRASTRUCTURĂ PARȚIAL PREZENTĂ:
- Sistemul de tip "request" (MarketingRequest) e robust și suportă regenerări
- Quota lunară (aiUsage) e deja implementată per operator
- Triggerii (onRequestWrite, onSubscriptionWrite) care oglinzesc datele clientului sunt deja în loc
- RBAC (role: owner|operator) e implementat pentru adminii platformei

CONCLUZIE: Lipsește COMPLET arhitectura de auto-generare condusă de client. Pentru a implementa self-serve, ar trebui:
1. Schimbare fundamentală de autentificare (client → self-signup + lead-ul atribuit automat)
2. Expunerea callable-urilor AI la clientul autentificat (cu rate-limiting distinct)
3. UI în /app pentru crearea cererilor (acum doar read-only)
4. Modificarea regulilor Firestore (allow create/update pe lead/{id}/requests de către client dacă clientUid==uid)


## [confirmat-absent] DataRead Funnel Ghidat - Verificare Funcție Competitor
- categorie: ux
- de ce conteaza: Un funnel numerotat reduce sarcina cognitiva si arata clientului unde se afla si ce urmeaza, crescand activarea si finalizarea. DataRead are deja datele si componentele (profil, campanii, livrabile) dar nu le-a turnat intr-un parcurs ghidat orientat catre utilizator, ceea ce ar imbunatati onboardingul si perceptia de produs (nu de agentie).
- status DataRead: Investigație aprofundată a structurii frontend (StartPage.tsx, OnboardingForm.tsx, AppHome.tsx) și a fluxului administrativ (LeadRequests.tsx, AdminHome.tsx)
- dovada: DataRead include: (1) formular public /start cu câmpuri de onboarding (companie, contact, industry, obiective, buget, social media) — ONE-SHOT, fără numerotare; (2) secțiuni în portal /app (Campaniile, Raport, Livrabile, LP) — read-only, fără progres pas-cu-pas; (3) fluxul de lucru în /admin (creare cerere → completare livrabile) — linear pero non-numerotate, admin-only, invizibil clientului. LIPSESC: sidebar cu etape numerotate, stepper/progress indicator, workflow secvential obligatoriu cu milestone-uri mapate. Fișierele cheie investigate: C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\site\StartPage.tsx, C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\app\OnboardingForm.tsx, C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\app\AppHome.tsx, C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\admin\LeadRequests.tsx, C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\admin\AdminHome.tsx

## [partial-prezent] Verificare gap: Recomandare canale AI pre-strategie în DataRead
- categorie: flux-produs
- de ce conteaza: Pasul de oportunitati ancoreaza tot restul fluxului: alege canalul pe care se construieste strategia si da utilizatorului un moment de valoare imediata ("AI-ul a inteles firma mea"). Fara el, DataRead sare direct la livrabile pe un canal presupus, ratand etapa de divergenta strategica si un punct natural de monetizare (explorare de idei).
- status DataRead: Analizie completă a codului și documentației DataRead (CLAUDE.md, PROJECT_KICKOFF.md, functions/index.js, forms/OnboardingFields.tsx, types/onboarding.ts)
- dovada: DataRead are **infrastructură parțială** pentru recomandarea canalelor, dar **nu expusă la clienți în mod explicit** ca pas dedicat:

**Ce EXISTĂ (partial-prezent):**

1. **Formularul de onboarding colectează date brute despre canalele actuale** (OnboardingFields.tsx:117-130):
   - Câmpuri: Facebook, Instagram, TikTok URLs (prezența/absența, fără mai mult context)
   - Câmpuri: Obiectivele (leads/sales/awareness/traffic)
   - Câmpuri: Industrie, buget anual estimat (under250€, 250-500€, etc.)
   - Descriere firmei și public țintă (text liber, max 2000 caractere)

2. **AI recomandări IMPLICITE în prompturi:**
   - buildCampaignPrompt (functions/index.js:302-319): prompt citește profil client + buget + obiectiv, AI-ul generează "Structura campaniei Meta" - **include recomandări implicite de platforma (Meta)**
   - Prompt-ul spune: "Structura campaniei realistă pentru bugetul dat" = AI deduce canalele potrivite din context (buget mic = niște canale, buget mare = altele)
   - buildContentPrompt (284-300): similar, AI deduce din "ritm realist pentru o firmă mică (12-15 postări/lună)" ce social channels sunt optimi

3. **Post-mortem AI (aiAnalyzeCampaign)**: AI analizează o campanie EXISTENTĂ și dă verdict (scale/maintain/pause/test) - NU este explorare proactivă inainte de strategie

**Ce LIPSEȘTE (confirmat-absent):**
- **PAS EXPLICIT de Oportunitati/Idei ÎN FORMULARUL PUBLIC** - onboarding-ul nu declanșează o analiză AI dedicată care să spună: "Pe baza datelor tale (domeniu=retail, buget=500€, public=mame din Constanța), recomandări: Facebook Ads geo-targeted pe Constanța + Instagram Reels + email list building"
- **NU există callable AI de tip "recomandChannels"** care să ruleze DUPĂ onboarding și să returneze canale potrivite (ex. aiRecommendChannels(leadId))
- **Prompturile sunt STATICE** - nu se adaptează la o fază de brainstorming pre-strategie; sunt legate de o cerere specifică (campaign/content) pe care o deja ai în sistem
- **Formularul de onboarding este PRE-PROCESARE, nu AI-analiza** - colectează date brute, fără feedback din AI

**Locul unde PUTEA fi (dar nu e):**
- După submit-ul formularului public /start (StartPage.tsx:92-97), ar putea fi un callable `aiRecommendChannels(leadId)` care să ruleze și să salveze recomandări pe `leads/{id}.recommendedChannels` (similar cu `aiClientReport`)
- UI-ul din /admin ar putea arăta: "Recomandări AI pentru acest lead: Facebook Ads geo + Instagram Stories + Google Search (buget recomandat: 300€/lună pe FB, 100€ pe Insta)"
- Clientul în portal ar putea vedea aceste recomandări **INAINTE** de a comanda o campanie

**Status final:** DataRead are **AI implicit în prompt-urile de generare** (AI ia decizia pe canaluri în contextul unei cereri), dar **NU are pas explicit/proactiv de recomandare pre-strategie**. Competitorul are feature-ul ca pas distinct, DataRead l-ar putea adăuga cu un nou callable (effort mic) sau extinde prompturile existente cu o instrucțiune de tip "pe baza profilului clientului X, sugerează 3-4 canale potrivite și buget recomandat per canal".

## [confirmat-absent] Verificare Adversarial: Generare Progresivă pe Niveluri/Etape DataRead
- categorie: ai-depth
- de ce conteaza: Generarea progresiva da utilizatorului control, transparenta si momentum (vede progres etapa cu etapa), si produce planuri mai coerente pentru ca fiecare nivel se bazeaza pe cel validat anterior. Pentru DataRead e si fundatia unei monetizari pe etape si a unui UX de tip wizard, fata de actualul "o apasare = tot sau nimic".
- status DataRead: DataRead v15.06.2026 — sistem generat operațional (CLAUDE.md, functions/index.js, src/types/request.ts verificate)
- dovada: Funcția aiGenerateCampaign (functions/index.js:581–675) execută **one-shot generare completă**: citire lead+cerere (o dată), un singur apel model, output structurat cu TOATE câmpurile (adTexts+videoScripts+campaignStructure pentru campaign; calendar+posts+ideas pentru content) scrise atommic în Firestore prin merge. Colecția leads/{id}/requests/{reqId}/versions (DEVLOG.md:307–314) e **backup imutabil** pentru restaurare post-regenerare, NU pentru rafinement iterativ ghidat. Post-generare, callable-ul aiAnalyzeCampaign (functions/index.js:512–579) analizează performanța campaniei (verdict scale/maintain/pause/test), dar e **analiza separată cu metrici KPI**, nu fază a fluxului de generare. Rafinementul manual se face in editorUI prin copiere+editare text, fără asistență de etape secventiale. Spec 5.5 (docs/SPEC-arhitectura-Ionut-2026-06-10.md liniile 174–175) menționa „AI Optimization Engine", dar implementat ca analiză post-facto (callable aparte), nu ca rafinament progresiv. **Lipsă definitiv:** descompunere in etape cu bifă de progres (Clarificare→Strategie→Texte→Optimizare→Plan final) și rafinament iterativ ghidat pe baza eșantionării intermediare.

## [confirmat-absent] DataRead Expandable Deepening Nodes with Separate Credit Costs
- categorie: flux-produs
- de ce conteaza: Nodurile cu pret per nod transforma aprofundarea intr-un meniu modular pe care utilizatorul il poate parcurge in ritmul si nevoia lui, fiecare nod fiind un micro-livrabil masurabil. Pe langa UX-ul de explorare la cerere, e mecanismul prin care competitorul leaga direct fiecare actiune de valoare de o plata, ceva ce DataRead nu poate face azi cu pachetele lunare.
- status DataRead: Code review complete: CLAUDE.md, PACHETE-SI-PRETURI.md, src/types/request.ts, src/config/packages.ts, functions/index.js, src/admin/LeadRequests.tsx, src/i18n/locales/ro.ts
- dovada: DataRead uses a fixed monthly package model (Start 149€, Growth 399€, Premium 999€) with bulk feature quotas (e.g., "6–10 postări AI/lună", "2–4 videoclipuri AI/lună"), NOT expandable nodes with individual costs. Marketing requests in Firestore (leads/{leadId}/requests/{reqId}) have flat deliverable fields: adTexts, videoScripts, campaignStructure, calendar, posts, ideas — no hierarchical node tree. AI quota is single global counter per operator per month (AI_MONTHLY_LIMIT = 200, stored in aiUsage/{uid}), not per-topic. Package features are bundled, upsells are whole add-ons (Video Extra, Landing Page, Google Ads). Evidence files: functions/index.js (lines 216, 322–334 quota logic), src/types/request.ts (RequestDeliverables interface), src/config/packages.ts (PACKAGES array), src/admin/LeadRequests.tsx (no node/topic UI), ro.ts locale (lines 98–137 feature lists show bulk quotas, not per-topic pricing).

## [confirmat-absent] Verificare export PDF strategii/livrabile în DataRead
- categorie: flux-produs
- de ce conteaza: PDF-ul e artefactul tangibil pe care clientul il pastreaza, il prezinta intern si il percepe ca deliverable finit; e si momentul de inchidere a funnel-ului (Executie). Absenta lui face ca rezultatul DataRead sa para tranzitoriu (text pe ecran), reducand perceptia de valoare livrata.
- status DataRead: Codebase DataRead analizat complet: src/, functions/, CLAUDE.md, tipuri și componente relevante.
- dovada: CONFIRMARE — Export PDF pentru rapoarte/strategii/livrabile LIPSEȘTE complet din DataRead:

**CE EXISTĂ DEJA (doar export CSV):**
1. **LpAnalytics.tsx** (linie 100-112): `exportVariantsCsv()` — export CSV al variantelor landing page (vizite, conversii, engagement rate).
2. **AppHome.tsx** (linie 282-292): `exportLeads()` — export CSV al lead-urilor capturate pe LP cu detalii (dată, câmpuri formular, sursă, status CRM, notă).
3. **utils/csv.ts** — utilitare sigure de export CSV cu protecție la formula-injection.

**CE LIPSEȘTE (confirmat prin grepping și citire cod):**
- ❌ **ZERO referințe la `pdf` sau `PDF`** în src/ (Grep: 0 rezultate)
- ❌ **ZERO callable-uri sau onRequest handlers pentru PDF export** în functions/index.js
- ❌ **ZERO funcționalitate de export strategic/raport la finalul execuției** — rapoartele lunare (MarketingReportSchema din functions/index.js linie 397-406) sunt generate și STOCATE în Firestore, NU EXPORTATE:
  - `aiClientReport` callable (linie 444-510): generează raportul AI și îl salvează în `leads/{leadId}.marketingReport` + mirror în `clients/{uid}.marketingReport`
  - Raportul este CITIT în portalul client (`AppHome.tsx` linie 31, 49, 83-95) și afișat pe ecran — dar NU are buton/funcție de export PDF
- ❌ **ZERO export pe livrabile** (DeliverableSchema) — livrabilele sunt stocate și copiate în clipboard text, niciodată exportate ca PDF:
  - LeadRequests.tsx: `copyText('all', buildCopyAll(draft))` (linie 484) — doar copy-to-clipboard text
  - AppHome.tsx: afișare HTML a livrabilelor (linie 128-150), nici o acțiune de export

**INFRASTRUCTURA DE RAPOARTE (existentă dar fără PDF):**
- Rapoarte lunare generate prin Claude cu schema structurată (summary, highlights, recommendations)
- Livrabile pe cereri marketing (adTexts, videoScripts, campaignStructure, calendar, posts, ideas)
- Ambele STOCATE în Firestore și expuse în UI — **dar zeroopțiuni de export PDF sau descărcare finală**.

**CONCLUSIE:** Competitorul are „export PDF al strategiei/livrabilelor ca pas final de execuție (export și istoric salvat)" — DataRead are rapoarte/livrabile GENERATE și STOCATE, dar NU are export PDF. Export-urile existente sunt EXCLUSIV CSV (LP analytics + lead-uri formular), fără nicio funcție de PDF sau descărcare de documente de strategie.

DOVEZI DOSARE:
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\utils\csv.ts — doar CSV
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\app\AppHome.tsx — liniile 282-292 (export CSV), liniile 83-95 (afișare raport fără export)
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\admin\LeadRequests.tsx — liniile 484-486 (copy text, nu export)
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\functions\index.js — callable aiClientReport (linie 444), zero export PDF în aceeași linie sau în jurul ei; liniile 1228-1260 (serveLp — servire LP, nu export)

## [confirmat-absent] DataRead: Credituri, Cost-per-Action și Trial (Analiza Adversarială)
- categorie: monetizare
- de ce conteaza: Creditele + explorarile gratuite coboara mult bariera de intrare (incerci gratis, platesti micro-sume pe masura ce vezi valoare) si aliniaza venitul cu consumul real de AI, fata de abonamentul lunar care cere angajament mare in avans. Pentru DataRead, un nivel pay-as-you-go ar putea converti lead-urile care nu sunt gata de 149 EUR/luna.
- status DataRead: Read 10 critical files: CLAUDE.md, packages.ts, entitlementLogic.ts, entitlementStore.ts, billing.ts, functions/index.js, test-entitlement.ts, PROJECT_KICKOFF.md, PACHETE-SI-PRETURI.md, lpTemplates.ts. Searched entire src/ and functions/index.js for "credit|payout|trial|freemium|cost-per|micro-transaction".
- dovada: DataRead nu are nicio implementare de credite, cost-per-actiune, sau trial. Dovezi:

1. **packages.ts (linia 45-108):** 3 pachete pure cu preț fix abonament lunar (149/399/999 EUR). Interfața PackageDef nu conține câmpuri pentru credite, cost-per-action, sau trial.

2. **CLAUDE.md (linia 134):** "Entitlements: extensia Stripe scrie `customers/{uid}/subscriptions` → functions `onSubscriptionWrite` → custom claim `ent` + mirror `clients/{uid}.entitlement`. **FĂRĂ trial.** Statusuri: `none | active | expired`."

3. **PROJECT_KICKOFF.md (linia 63-64):** "**Trial: fără trial** (decis 11.06.2026) — plata începe de la abonare; eventuala garanție de rambursare se gestionează manual, fără complexitate tehnică în v1."

4. **entitlementLogic.ts (linia 17, 48):** Tipul EntitlementStatus este explicit: `'none' | 'active' | 'expired'`. Linia 48: verifică doar `(subscription.status === 'active' || subscription.status === 'trialing')` din Stripe, dar mapează în statusuri DataRead fără trial.

5. **entitlementStore.ts (linie 8):** Comentar explicit: "Starea de entitlement a clientului logat — portată din CNCVS, **FĂRĂ trial.**"

6. **billing.ts (linia 3):** "Portat din CNCVS, **FĂRĂ trial.**"

7. **functions/index.js (linia 101):** "FĂRĂ trial în DataRead — statusurile relevante sunt doar cele ale abonamentului plătit."

8. **test-entitlement.ts (linia 1, 22, 101):** Suite headless pentru rezolvarea entitlement-ului: "**FĂRĂ trial** (none | active | expired)". Test explicit: "logat fără abonament → none (nu expired — fără trial)".

9. **PACHETE-SI-PRETURI.md:** Oferta comercială enumă 3 pachete pe bază de abonament lunar (Starter 99-149 €, Growth 299-499 €, Premium 699-1.299 €). Nicio mențiune de credite, cost-per-action, sau explorări gratuite.

10. **functions/index.js (linia 216):** AI_MONTHLY_LIMIT = 200 este gard intern pentru operatori (quota de generări Claude/lună), nu produs vândut clienților.

11. **Caut "credit|payout|trial|freemium|cost-per|micro"** în src/ și functions/: Nicio rezultat relevant (doar comentare în test-entitlement.ts, templates de LP cu "gratuit" în texte de exemplu, și "cost per lead" în i18n ca concept de KPI al clientului, nu strategie de preț DataRead).

## [confirmat-absent] Verificare: Trial/Freemium cu Explorări Gratuite în DataRead
- categorie: monetizare
- de ce conteaza: Un trial/freemium e motorul clasic de activare PLG: lasa firma sa simta produsul (aha-moment) inainte de cerere de bani, crescand conversia. DataRead nu are azi niciun canal prin care un client sa atinga AI-ul gratuit, deci depinde 100% de vanzarea umana operator-condusa.
- status DataRead: Analiza completă a codebase-ului DataRead (CLAUDE.md, src/, functions/, firestore.rules, i18n locales)
- dovada: Afirmația că DataRead NU are trial sau nivel freemium cu explorări gratuite vizibile este CONFIRMATĂ. Evidență directă:

1. **CLAUDE.md (linia 134):** "FĂRĂ trial în DataRead" — este o regulă de arhitectură explicită.

2. **entitlementLogic.ts (liniile 4, 17):** "FĂRĂ trial în DataRead: statusurile sunt `none | active | expired`." Doar 3 stări, fără stare intermediară de trial.

3. **entitlementStore.ts (linia 8):** "Starea de entitlement a clientului logat — portată din CNCVS, **FĂRĂ trial**."

4. **packages.ts (liniile 15, 42-108):** Doar 3 pachete plătite (Start 149€, Growth 399€, Premium 999€), zero pachete gratuite. Status `none | active | expired` — nici o stare de trial.

5. **Firestore Rules (liniile 79-92):** Regula `clients/{uid}` setează entitlement DOAR prin Cloud Functions (mirror din Stripe), care scrie statusuri Stripe: `active`, `trialing` (Stripe standard), `expired`, `none`. Nici o logică de "X explorări rămase".

6. **functions/index.js (linia 103):** `const ACTIVE_STATUSES = new Set(['active', 'trialing']);` — singurele stări care activează accesul sunt abonamentul activ plătit. FĂRĂ status special de freemium.

7. **AppHome.tsx (liniile 466-570):** Portalul de client afișează doar:
   - `subscriptionNone` ("Inactiv")
   - `subscriptionActive` (afiseaza pachetul)
   - `subscriptionPending` (confirmare plată in progress)
   - `subscriptionExpired`
   - CTA: "Plătește" sau "Contactează-ne" — zero mențiuni de credite gratuite, explorări, sau trial.

8. **ro.ts (i18n; liniile 193-250):** Toate mesajele din portal: nicio referință la trial, credit, explorar, sau gratuit. Doar "Inactiv", "Activ", "Abonament expirat".

9. **Comportament cu entitlement `none`:** Fără entitlement, clientul vede CTA "Contactează-ne" la portalul `/app` — NU o interfață de trial cu solduri de credite vizibile.

**Concluzie:** DataRead NU oferi trial vizibil cu explorări gratuite sau bare de progres de credite. Accesul este binar: plătitor sau inactiv. Competitorul care arată "2 explorări gratuite rămase" cu "27 CREDITE DISPONIBILE" are o funcție care DataRead nu o are.

## [confirmat-absent] Verificare: Indicator vizibil de sold/consum (credite + bara progres)
- categorie: ux
- de ce conteaza: Transparenta consumului in interfata creste increderea si controlul utilizatorului si transforma fiecare actiune intr-o decizie informata (merita acest nod?). Daca DataRead introduce vreun model de consum, un indicator vizibil de sold devine necesar pentru a evita surprizele si pentru a incuraja explorarea constienta.
- status DataRead: Codul DataRead cercetat complet: CLAUDE.md, firestore.rules, functions/index.js, src/admin/AdminHome.tsx, src/admin/LpAiPanel.tsx, src/app/AppHome.tsx, src/services/billing.ts
- dovada: Infrastructura de quota EXISTA dar NU e expusa in UI clientilor:

**Existenta infrastructurii:**
1. Colectia `aiUsage/{uid}` cu schema {month, count, updatedAt} (functions/index.js:324)
2. Quota lunara: 200 generari/operator in `AI_MONTHLY_LIMIT` (functions/index.js:329)
3. Restrictioare Firestore: `match /aiUsage/{uid} { allow read: if isAdmin(); allow write: if false; }` (firestore.rules:140-142)

**Ceea ce LIPSESTE complet:**
1. **Zero citire aiUsage in clientul logat** - `/app` (AppHome.tsx) NU are acces la aiUsage. Citeste doar: campaigns (scoped pe clientUid), clients doc, deliverables, landingPages index
2. **Admin-only citire la AdminHome** - Doar operatorii VAD contorul de AI (AdminHome.tsx:263-274): `getDoc(doc(db, 'aiUsage', user.uid))` → afiseaza `{t('admin.statsAi', { count: aiCount })}` in header chip-uri (linia 495). Niciun afisaj de quota maxima (200/luna) sau procent consumat
3. **Nici o bara de progres, gauge, sau indicator vizibil de cost-per-actiune** - Buttoanele "Genereaza cu AI" (LeadRequests, LpAiPanel) NU arata: costul actiunii, soldul ramas, procentaj consumat
4. **Niciun cost pe actiune inline** - Formulele din CNCVS (1-5 credite per nod) NU exista in DataRead. Chiar si adminii vad doar COUNT total, fara detalii de cost
5. **Nici o incadrare in pachete** - Entitlementul clientului (start/growth/premium) nu e legat de quota AI in UI. Nu e diferentiere per pachet

**Regula firestore care blochaza expunerea:**
Linia 141 din firestore.rules: `allow read: if isAdmin()` => clienti obijnuiti NU POT CITI deloc aiUsage, chiar daca ar exista UI pentru asta.

**Verdict**: Competitorul are feature complet. DataRead are NUMAI infrastructure interna (hidden) si un contor admin-only cu count brut, FARA expunere client, FARA bara, FARA cost per actiune.

## [partial-prezent] Verificare Meniu de Sugestii Proactive — DataRead
- categorie: ux
- de ce conteaza: Sugestiile proactive ghideaza urmatorul pas si scot la suprafata oportunitati pe care utilizatorul nu le-ar cauta singur, marind angajamentul si numarul de generari. Pentru un produs ghidat in pasi, ele sunt liantul care tine utilizatorul in flux intre etape.
- status DataRead: Identificate: Callable-uri AI pentru rapoarte și insights; Absente: Interfață proactivă de sugestii în AdminHome; Prezent doar în portal client (read-only), generat pe-demand
- dovada: 1. **Rapoarte cu recomandări existente**: functions/index.js liniile 416-441 (buildClientReportPrompt) și 444-510 (aiClientReport) — genereaza rapoarte lunare cu 3 secțiuni: summary, highlights, recommendations (schema REPORT_SCHEMA).

2. **Insights pe campanii**: functions/index.js liniile 512-579 (aiAnalyzeCampaign) — genereaza verdict (scale/maintain/pause/test) + actions, salvate pe `campaigns/{id}.aiInsight`.

3. **Vizibilitate în portal**: src/app/AppHome.tsx liniile 83-94 — Clientul vede report.summary, report.highlights, report.recommendations din `clients/{uid}.marketingReport`.

4. **AdminHome structure**: src/admin/AdminHome.tsx linia 34 — 4 taburi: leads|marketing|landing|admins; FĂRĂ meniu sugestii în header.

5. **Lead-uri pull-based**: AdminHome liniile 543-589 — tabel cu filtre status + search, FĂRĂ notificări despre X zile pending.

6. **Generare manual**: Buton "Generează raport" pe fiecare lead (LeadRequests.tsx), NU proactiv.

**Concluzie**: Recomandări AI există deja la nivel de date și sunt trimise clientului, dar operatorul nu le vede proactiv — trebuie sa activeze manual generarea.

## [partial-prezent] Verificare: Dashboard de start orientat catre client ca punct de intrare în funnel
- categorie: ux
- de ce conteaza: Dashboard-ul de start e busola produsului: arata starea, progresul si urmatoarea actiune, mentinand utilizatorul orientat. DataRead are componentele de date dar nu un hub care sa orchestreze parcursul, lasand portalul sa para o vitrina pasiva mai degraba decat un spatiu de lucru.
- status DataRead: Analiza completă a codului DataRead: CLAUDE.md, src/app/AppHome.tsx, src/i18n/locales/ro.ts, structura rutelor din App.tsx
- dovada: 
## STATUS ACTUAL IN DATAREAD

**Ce EXISTA deja:**
1. **Portal client /app (AppHome.tsx)** — Clients logati isi vad:
   - Banda de header cu email + opțiuni Sign Out / Back to Site
   - Card "Onboarding" — stare (Necompletat | Trimis)
   - Card "Abonament" — stare subscription (Activ | Inactiv | În așteptare)
   - Secțiunea "Datele tale de marketing" (MarketingPortal) — campaniile, raport lunar, livrabile
   - Secțiunea "Paginile tale (Landing Pages)" (LpPortal) — performanță LP + mini-CRM cu lead-uri capturate

2. **Structură multi-tenant** — Fiecare client vede DOAR datele proprii (scoped prin Firestore rules pe clientUid)

3. **Sidebar / Navigare TOP — NU EXISTA** — Portalul nu are o bară de navigație în header care să prezinte opțiuni/meniu

**Ce LIPSESTE (confirmat-absent):**
1. **Dashboard Hub de start ca punct de intrare în funnel:**
   - **Nu exista un panou principal care sa prezinte "progresul prin etapele unui funnel"** (Onboarding → Abonament → Campanii → Rezultate)
   - **Nu exista "recomandare de pași următori"** — portalul afișează DOAR starea statică (onboarding: yes/no, subscription: active/inactive) + carduri read-only de performanță
   - **Nu exista o "bară de progres vizuală"** care să ghideze clientul prin etapele de start

2. **Lipsa unui "entry point" dinamic:**
   - Comentariul în AppHome.tsx (linia 433-434) spune explicit: "*Structura prevede de pe acum secțiunile Verticalei 1 (cereri de marketing / rezultate / AI insights) — „în curând" în v1, populate în felia 2.*"
   - Trei carduri placeholder rămân neimplementate: `requestsTitle`, `resultsTitle`, `insightsTitle` cu label "În curând"

3. **Bare de sus / Nav interna:**
   - Header-ul portalului (AppHome.tsx:501-512) conține DOAR:
     - Titlu "Contul tău"
     - Email + buton Sign Out / Back to Site
   - **NU exista meniu de navigare intern** (gen "Campanii | Rapoarte | Landing Pages | Rezultate") care să funcționeze ca hub

## FISIERUL DOVEDA
**C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\app\AppHome.tsx**
- Liniile 433-434: comentariul explicit despre pași "în curând"
- Liniile 501-512: header-ul simplu (no nav)
- Liniile 514-572: grid de 2 carduri (Onboarding + Abonament), restul secțiuni read-only (MarketingPortal + LpPortal)

## CONCLUZIE
DataRead are **un portal client funcțional (AppHome)** cu structura de bază, dar **NU are un Dashboard hub cu rol de "start point" care să:
- Prezinte etapele funnel-ului și progresul curent
- Ofere recomandări de "pași următori"  
- Funcționeze ca punct central de lansare pentru parcursul clientului

Portalul e un **agregator de date read-only** (campanii + rapoarte + lead-uri), nu un hub dinamic de onboarding/progres. Pașii următori e un feature așteptat în v2 ("felia 2") conform comentariilor din cod.


## [partial-prezent] DataRead Self-Serve AI vs Competitor Gap Analysis
- categorie: flux-produs
- de ce conteaza: Prin lentila GTM, aceasta e ruptura de model: competitorul e o masina self-serve (client-led growth) unde costul marginal pe client tinde la zero; DataRead e done-for-you operat de Andrei+Ionut, unde fiecare client nou consuma timp de operator. Fara un mod self-serve, DataRead nu poate scala dincolo de capacitatea celor 2 operatori — TAM efectiv = cati clienti pot servi manual, nu cati pot plati.
- status DataRead: Backend AI infrastructure complete
- dovada: CONFIRMAȚIE DOVEZI: DataRead HAS 5 callable-uri AI (aiGenerateCampaign, aiAnalyzeCampaign, aiClientReport, aiGenerateLandingPage, aiEditLandingPage) fully implemented in functions/index.js, model claude-opus-4-8, schema structurată, quota lunară per operator. PERÒ all 5 are hard-gated by: if (request.auth.token.admin !== true) throw HttpsError(permission-denied). Client portal (/app) in src/app/AppHome.tsx reads ONLY scoped campaigns + pre-generated marketingReport from Firestore, zero calls to AI functions. Structural gap with competitor: Competitor allows client self-serve generation; DataRead restricts to operator-only generation with client read-only access. Not missing—architectural choice to maintain agenție control model.</anEvidence>
</invoke>

## [confirmat-absent] Verificare afirmație: Onboarding PLG auto-servit la DataRead
- categorie: gtm
- de ce conteaza: In modelul self-serve, activarea = motorul de crestere (produsul se vinde prin folosire, nu prin call de vanzari). DataRead are un funnel de captare lead (pull catre operatori), nu un funnel de activare a clientului. Asta inseamna cost de achizitie + cost de vanzare uman pe fiecare conversie, vs. conversie automata la competitor — diferenta directa intre CAC si viteza de crestere.
- status DataRead: CULES ȘI ANALIZAT: CLAUDE.md (rnd 73-76), StartPage.tsx (fluxul /start), types/onboarding.ts (schema), functions/index.js (todos callables AI — aiGenerateCampaign, aiGenerateLandingPage etc.)
- dovada: **FAPTE CONSOLIDATE:**

1. **Intrarea publică (/start) — DOAR colectare de lead, NU generare de valoare:**
   - Conform CLAUDE.md rnd 73-76: „Site-ul public NU are login (decizie Andrei, 11.06.2026): intrarea clienților e formularul public `/start` (fără cont) → colecția `leads` (create anonim, validat strict; citit doar de admini). Doar `/admin` (backend-ul) are autentificare."
   - StartPage.tsx (rnd 26-146) implementează o formă simplă care colectează 12 câmpuri: companyName, industry, objectives, description, website, social media, buget reclame etc., apoi transmite anonim în colecția `leads` a Firestore.
   - Status post-submit: mesaj de confirmare „Suntem în curs să analizez cererea dvs." (rnd 114-129), nimic mai mult.

2. **Lipsă TOTALĂ a generării auto-servite de conținut public:**
   - **Callable-uri AI EXCLUSIV pentru operatori (+admin claim):** 
     * `aiGenerateCampaign` (functions/index.js rnd 581): necesită `request.auth.token.admin !== true` — aruncă „Doar operatorii pot genera campanii."
     * `aiGenerateLandingPage` (rnd 767): același check — admin-only.
     * `aiEditLandingPage` (rnd 783): admin-only.
     * `aiClientReport` (rnd 444): admin-only — „Doar operatorii pot genera rapoarte."
     * `aiAnalyzeCampaign` (rnd 512): admin-only.
   - **NU există `onRequest` public pentru generare AI** — singurul `onRequest` public este `serveLp` (rnd 826+), care SERVEȘTE pagini Landing deja create de admin, nu le generate.

3. **Procesul real post-lead (manual, nu PLG):**
   - Lead se trimite anonim la /start.
   - Adminul (în /admin) vede lead-ul, creează o cerere (`leads/{leadId}/requests/{reqId}`).
   - Adminul clickează „Generează cu AI" → `aiGenerateCampaign` se apelează (admin-only), generează livrabile (texte reclame, scripturi video, structură Meta).
   - Abia după ce adminul a generat, livrabilele se oglindesc în portalul clientului (`clients/{uid}/deliverables`) — dar NU automat, ci numai dacă adminul a conectat lead-ul la un cont (`clientUid`).

4. **„Self-serve-ul public (checkout Stripe din site) rămâne DORMANT și nelegat din site"** (CLAUDE.md rnd 75-76) — confirmare că nu există nici fluxul de cumpărare auto-servit, deci nici onboarding post-cumpărare auto-servit.

5. **Niciun „aha moment" auto-gol în minuni:**
   - Competitorul: 5 pași pe ecran (Profil firma → Oportunități → Strategie → Detalii → Execuție) + 2 explorări gratuite + 27 credite → strategie generată în cateva minute = **valoare imediată**.
   - DataRead: /start = doar form 12 câmpuri → lead în coadă operatorilor = **zero valoare până la intervenție manuală**.

**VERDICT: LIPSĂ CONFIRMATĂ.**
DataRead **NU are** onboarding PLG auto-servit. Are colectare de lead-uri, dar generarea de conținut (strategii, campanii, landinguri) e pur manuală, operată de admini, DUPĂ ce lead-ul a fost aprovat și conectat la un cont client.

## [confirmat-absent] DataRead Trial/Freemium Gap Analysis
- categorie: monetizare
- de ce conteaza: Free-to-paid e mecanismul de conversie standard al unui SaaS self-serve: scade frictiunea, dovedeste valoarea inainte de plata, alimenteaza top-of-funnel ieftin. Lipsa lui la DataRead inseamna ca top-of-funnel-ul depinde de efort de vanzare uman, nu de produs. E o piesa lipsa direct din motorul de achizitie.
- status DataRead: DataRead has ZERO trial/freemium functionality. Entitlement statuses are hardcoded as: none | active | expired (no intermediate 'trialing' state for free users). This is documented explicitly in CLAUDE.md, entitlementLogic.ts, PROJECT_KICKOFF.md, and design decisions from 2026-06-11.
- dovada: File evidence: 
1. CLAUDE.md:134 - "FĂRĂ trial. Statusuri: none | active | expired"
2. src/store/entitlementLogic.ts:4 - "FĂRĂ trial în DataRead: statusurile sunt `none | active | expired`"
3. src/store/entitlementStore.ts:8 - "portată din CNCVS, FĂRĂ trial"
4. src/services/billing.ts:3 - "Portat din CNCVS, FĂRĂ trial"
5. PROJECT_KICKOFF.md:63 - "Trial: fără trial (decis 11.06.2026)"
6. docs/PACHETE-SI-PRETURI.md - zero mention of trial, only fixed monthly prices
7. functions/index.js:101 - "FĂRĂ trial în DataRead — statusurile relevante sunt doar cele ale abonamentului plătit"
Prospect flow: /start (anon form) → leads table (status:new) → operator manual contact → then payment. No self-serve exploration possible. Stripe checkout is "DORMANT și nelegat din site" (CLAUDE.md:75-76).

## [confirmat-absent] Generare progresivă pe niveluri, condusă de client — DataRead
- categorie: flux-produs
- de ce conteaza: Modelul pe niveluri NU e doar UX — e mecanica de monetizare self-serve: fiecare nivel = un punct de re-engagement si o micro-vanzare condusa de client, fara operator. Transforma produsul intr-un drip de valoare auto-consumat. La DataRead generarea e un eveniment operational unic, deci nu poate genera revenue incremental fara munca de operator de fiecare data.
- status DataRead: DataRead implementează one-shot AI generation: operator apasă "Generează cu AI", backend cere AI pachetul complet de livrabile, rezultatul se suprascrie integral. Nu există niveluri progresive, avansare ghidată de client, plată incrementală sau rafinament iterativ pe etape.
- dovada: Dovezi în cod: (1) functions/index.js liniile 581-675: callable aiGenerateCampaign e one-shot, merge pe deliverables[kind] integral; (2) src/admin/LeadRequests.tsx liniile 258-298: generateWithAi handler apelează aiGenerateCampaign, trage pachetul complet; (3) src/types/request.ts: REQUEST_STATUSES = ['open','done'] fără nivele intermediare; (4) PROJECT_KICKOFF.md: "AI Creative Studio expus clienților" marcat NU în v1. Modelul: operator creează cerere, apasă "Generează", apel unic la Claude, rezultat integral salvat (versiuni imutabile în versions/ doar pentru audit/restore integral, nu etape progresive). Clientul nu conduce etape, nu plătește pe progresie, nu vede niveluri intermediare. Diferență față de competitor: NU există rafinament iterativ ghidat de client pe niveluri cu plată incrementală.

## [confirmat-absent] DataRead: Verificare Absență Noduri Expandabile cu Preț per Nod
- categorie: monetizare
- de ce conteaza: Pricing-ul per-nod e expansion revenue self-serve: clientul ridica singur ARPU-ul cumparand adancime cand are nevoie, fara up-sell uman. E un motor de monetizare care scaleaza cu interesul clientului, nu cu timpul operatorului. DataRead lasa pe masa exact acest venit incremental auto-servit — orice up-sell azi cere o conversatie cu Andrei/Ionut (vezi UPSELLS vandute doar prin 'contacteaza-ne').
- status DataRead: Codul DataRead examinat: src/config/packages.ts (definiția pachetelor), functions/index.js (logica AI quota), CLAUDE.md (arhitectura), PROJECT_KICKOFF.md (scope), PACHETE-SI-PRETURI.md (oferta comercială). Nicio dovadă de "noduri" sau pricing granular per subiect.
- dovada: 
DataRead implementează un model de preț MONOLITIC: 3 pachete cu tarif lunar fix (Start 149€, Growth 399€, Premium 999€), fiecare cu cuotă AI lunară GLOBALĂ (200 generări/operator/lună, non-diferențiată). 

Dovezi concrete:
1. src/config/packages.ts: PACKAGES[] conține doar PackageDef cu {id, monthlyAmount, priceId, modules} — nicio structură de "noduri" sau "cost per item"
2. functions/index.js linia 216: const AI_MONTHLY_LIMIT = 200; — UN singur contor pe operator, nu per-subiect
3. functions/index.js liniile 322–334: consumeAiQuota() verifică count >= 200; orice generare consumă 1 unitate, indiferent de tip (ads, content, landing page, raport)
4. CLAUDE.md linia 148: "contorul AI_MONTHLY_LIMIT=200 e un singur numar intern pe operator, nu pricing granular pe client"
5. Nimic în DEVLOG.md, PROJECT_KICKOFF.md sau documentația de spec despre un model de "noduri expandabile" cu preț individual

Competitorul oferă: Buget 1cr, Structura 2cr, Texte 2cr, Analiza concurență 3cr, Remarketing 2cr, Funnel 5cr — fiecare apel de client la un nod îl consumă direct din credite separate.

DataRead: toate generările (indiferent de subiect) merg în aceeași coadă de 200/lună, iar plata e la nivel de pachet, nu per-generare.


## [confirmat-absent] Verificare adversarial: "Pas de Oportunitati cu AI care recomanda canale inainte de strategie"
- categorie: ai-depth
- de ce conteaza: Intr-un produs self-serve, recomandarea de canal e ce inlocuieste consultantul uman — fara ea, un proprietar de firma fara expertiza nu stie ce sa ceara. La DataRead expertiza de canal sta in capul operatorilor (de aceea e admin-only). Ca sa devina self-serve, DataRead trebuie sa externalizeze acel rationament catre AI; pana atunci, produsul nu poate functiona fara operator si nu poate scala GTM.
- status DataRead: DataRead NU are o funcție de recomandări AI de canale înainte de alegerea strategiei. Fluxul curent: admin alege manual obiectivul → apasă "Generează cu AI" → callable-ul `aiGenerateCampaign` (functions/index.js, lines 581–675) generează livrabile (texte ads, structură campanie Meta) pe baza unui prompt STATIC. Analiza de performanță (aiAnalyzeCampaign, lines 512–579) vine post-mortem, nu pre-strategia.
- dovada: 1. **Prompt-uri statice (functions/index.js, lines 302–319 + 284–300)**: `buildCampaignPrompt()` și `buildContentPrompt()` construiesc prompt pe baza lead-ului + cererii DEJA definite (obiectiv ales + ofertă + buget). ZERO logică de recomandare de canale PRE-ALEGERE. 2. **Flow-ul de creare cereri (LeadRequests.tsx, lines 65–150)**: Admin selectează `objective` dintr-o lista dropdown (leads/sales/awareness/traffic/other), completează title + offer + budget, abia apoi apasă "Generează cu AI". AI-ul NU e apelat PRE-ALEGERE. 3. **Tipuri AI calls disponibile (CLAUDE.md, lines 145–171, 201–220)**: `aiGenerateCampaign` (pe baza cererii existente), `aiAnalyzeCampaign` (pe baza metricilor campaniei — post-mortem), `aiGenerateLandingPage` (pe baza brief-ului). Niciuna NU recomandă canale INAINTE. 4. **Spec oficial (PROJECT_KICKOFF.md, lines 87–89)**: Felia 1 = semi-manual, NU automat. Recomandări automate de canale = "Faza 3", nu Fazia 1. 5. **Fișiere-dovadă**: C:\Users\besli\Desktop\MyWork\Apps\DataRead\functions\index.js (lines 302–675), C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\admin\LeadRequests.tsx (lines 65–298), C:\Users\besli\Desktop\MyWork\Apps\DataRead\CLAUDE.md (lines 145–171), C:\Users\besli\Desktop\MyWork\Apps\DataRead\PROJECT_KICKOFF.md (lines 87–123).

## [partial-prezent] Verificare adversarială: Export PDF pentru strategii de client în DataRead
- categorie: ux
- de ce conteaza: Prin lentila self-serve, PDF-ul e livrabilul tangibil pe care clientul il scoate fara sa ceara nimic operatorului — inchide bucla 'am platit, am primit un deliverable'. La DataRead, pentru ca operatorul livreaza oricum, lipsa PDF-ului e mai mica; dar pentru un eventual portal self-serve devine asteptare de baza. Gap real, prioritate medie prin lentila GTM.
- status DataRead: DataRead are export CSV implementat în mai multe locuri, dar NU are export PDF. Infrastructura de export există, funcționalitatea PDF lipsește complet.
- dovada: Export CSV PREZENT (infrastructura existentă):

1. **AppHome.tsx** (lines 282-291) - Funcția `exportLeads()` pentru lead-uri LP:
   - Exportă submissions de pe landing pages în CSV
   - Format: dată, câmpuri formular, sursă, status, notă
   - Fișier: `leads-{slug}.csv`

2. **LpAnalytics.tsx** (lines 100-112 și 142-154) - Două tipuri de export CSV:
   - `exportVariantsCsv()`: variante campaignie (platformă, tip asset, conversii, engagement)
   - `exportCsv()`: submissions cu toate câmpurile formularului
   - Fișier: `lp-{slug}-variante.csv` și `lp-{slug}-submissions.csv`

3. **MarketingCenter.tsx** (lines 210-219) - Export metrici campanie:
   - Exportă date pe zi: data, spend, impressions, clicks, leads, revenue
   - Fișier: `campanie-{campaignId}.csv`

4. **utils/csv.ts** - Utilități de export CSV sigur:
   - `csvCell()`: escaping ghilimele + protecție formula injection
   - `toCsv()`: construire string CSV complet

EXPORT PDF ABSENT:
- Zero referințe la PDF în `src/` 
- Zero dependențe PDF în package.json (nu există jspdf, pdfkit, html2pdf, etc.)
- Zero funcții de export PDF în niciuna din componente
- Nu există PDF pe bare de acțiuni pentru campanii sau strategii

VERDICT FINAL: `partial-prezent` — infrastructura Blob + download browser existe și se refolosește pe mai multe locuri (CSV), dar generarea PDF este complet absență. Competitorul are export PDF pentru „strategia clientului final", DataRead are DOAR CSV pentru lead-uri, variante și metrici.

## [partial-prezent] Verificare adversarial: Istoric de generari (client-side)
- categorie: flux-produs
- de ce conteaza: Diferenta nu e 'exista versionare' (DataRead are), ci CINE o vede si o controleaza: la competitor e self-service in fata clientului, la DataRead e instrument intern de operator. Pentru un pivot self-serve, istoricul trebuie mutat in portalul clientului. Il raportez ca gap PARTIAL — capacitatea exista, dar nu in lentila self-serve (clientul nu o atinge).
- status DataRead: DataRead ARE infrastructura de versionare completă (snapshots imutabile, storage, restore), DAR accesul e LIMITAT la admin (operator) — clientul din /app NU VEDE istoricul de generari.
- dovada: 1. VERSIONARE BACKEND (functions/index.js:649-657): Snapshots imutabile create inainte de regenerare AI
   - Stored in: leads/{leadId}/requests/{reqId}/versions/{versionId}
   - Câmpuri: deliverables, kind, source, reason, snapshotAt, snapshotBy

2. UI ADMIN (src/admin/LeadRequests.tsx:80,166-213):
   - Butoane toggle versiuni
   - Modal cu istoric (loadVersions, ordenat descrescător)
   - Funcționalitate restaurare cu confirm
   - ACCES DOAR: isAdmin() per Firestore rules

3. FIRESTORE RULES (firestore.rules:64-72):
   - leads/requests/versions: allow read,create,delete IF isAdmin ONLY
   - clients/{uid}/deliverables: read allow client+admin, FARA subcollection versions

4. PORTAL CLIENT (src/app/AppHome.tsx:52-66 MarketingPortal):
   - Citeste clients/{uid}/deliverables/{reqId} (livrabile curente)
   - NU citeste /versions
   - Afiseaza doar: deliverables.deliverables (conținut curent) + raportul

VERDICT: Infrastructura de versionare EXISTA integral, DAR e ADMIN-ONLY. Competitorul are asta VIZIBIL ÎN PORTAL CLIENT. DataRead trebuie sa expuna versioning clientului (fie read-only, fie cu restore-permission scoped).

## [partial-prezent] Verificare Generare Progresivă pe Niveluri - DataRead vs Afirmație Concurent
- categorie: ai-depth
- de ce conteaza: Generarea progresiva creste profunzimea si actionabilitatea: fiecare etapa valideaza decizia anterioara (canal -> audienta -> copy -> KPI) inainte de a investi tokeni in urmatoarea, reducand rebutul si producand un plan coerent. Pentru DataRead, care vinde calitate de agentie, un flux iterativ ar permite operatorului sa duca o campanie de la draft la plan final controlat, nu sa accepte/respinga un bloc monolitic.
- status DataRead: Codul DataRead analizat complet: CLAUDE.md, functions/index.js (liniile 581-675), src/admin/LeadRequests.tsx (liniile 165-213), src/types/request.ts
- dovada: AFIRMAȚIE CONCURENT: Generare progresivă pe 5 etape secvențiale (Clarificare → Strategie → Texte și campanii → Optimizare → Plan complet), cu status per etapă și rafinament incremental ghidat. DataRead GENEREAZA ONE-SHOT: o cerere = un pachet complet de livrabile (3 texte + 2 video-scripturi + structură, SAU calendar + postări + idei), fără pași de rafinament ghidat.

REALITATEA DATAREAD:

✓ CE ARE (infrastructura parțială):
1. Istoric immutable de versiuni (functions/index.js liniile 649-657): înainte de fiecare regenerare AI, starea curentă devine versiune în `leads/{id}/requests/{reqId}/versions` cu metadate (deliverables, kind, source, reason: 'pre-ai-regenerate', timestamp, user)
2. Restore manual (LeadRequests.tsx liniile 186-213): operatorul poate restabili versiunea anterioară
3. Context bogat pe cerere ONE-SHOT (functions/index.js liniile 302-319): prompt include lead context complet (industrie, obiectiv, audiență, etc.)
4. Răspuns integral: `aiGenerateCampaign` callable generează complet pachetul pe SCHEMA_CAMPAIGN sau SCHEMA_CONTENT (3 texte + 2 scripturi + structură, SAU calendar + postări + idei)

✗ CE LIPSEȘTE (absență de progresie pe 5 niveluri):
1. ❌ Fluxul de rafinament ghidat: NU există prompt care spune "validează mai întâi canal-ul și audiența înainte de a genera postări"
2. ❌ Status per etapă: Cererea are doar status: 'open'|'done' (request.ts linia 16); nu sunt 5 status-uri + bife de rafinament
3. ❌ Structurare incrementală în backend: callable-ul aiGenerateCampaign NU construiește etapă-după-etapă; NU poate stopa după "clarificare" și așteptare confirmare
4. ❌ Dependență inter-etape: Nu se validează rezultatul etapei N înainte de etapa N+1 (audiența nu e validată înainte de texte)
5. ❌ UX wizard ghidat: UI (LeadRequests.tsx) nu oferă wizard cu 5 pași și checkboxuri; e doar editor liber cu textarea și buton "Generează"
6. ❌ Versiuni NON-PROGRESIVE: Snapshot-urile din istoric sunt arbitrare în timp (pre-regenerare, pre-restore), nu 5 etape ordonate

CONCLUZIE: DataRead are fundație de versionare imutabilă și context bogat, dar generarea rămâne fundamentally ONE-SHOT. Operatorul controlează prin iterație manuală (regenerează integral sau editează), NU prin fluxul backend care să impună rafinament progresiv pe 5 etape secvențiale cu status+bife.

## [confirmat-absent] Audit adversarial: Noduri de aprofundare cu cost separat per nod în DataRead
- categorie: ai-depth
- de ce conteaza: Nodurile transforma AI-ul dintr-un generator de pachet intr-un consultant la cerere: clientul/operatorul cere exact subiectul de care are nevoie (ex. doar Remarketing) si primeste reguli + KPI specifice acelui subiect. Asta creste atat profunzimea per livrabil cat si monetizarea (plata pe valoare incrementala), doua axe pe care DataRead nu le acopera azi.
- status DataRead: Analizate integral: CLAUDE.md, src/types/request.ts, src/config/packages.ts, firestore.rules, functions/index.js (secțiunile AI), docs/PACHETE-SI-PRETURI.md, docs/SPEC-arhitectura-Ionut-2026-06-10.md
- dovada: **1. Model de cereri: 2 tipuri globale, NU fragmentate pe noduri**
Fișier dovadă: C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\types\request.ts (liniile 13–14)
- DataRead acceptă doar 2 tipuri: RequestKind = 'campaign' | 'content'
- Fiecare cerere = un singur pachet complet de livrabile: adTexts + videoScripts + campaignStructure (campaign) SAU calendar + posts + ideas (content)
- NU există subdiviziuni pe "noduri de subiect" expandabile

**2. Sistem de quota: UN singur contor lunar per operator, NU per-topic**
Fișier dovadă: C:\Users\besli\Desktop\MyWork\Apps\DataRead\functions\index.js (liniile 321–334)
- Colecția aiUsage/{uid} stochează: month, count (total generări AI), updatedAt
- Constanta AI_MONTHLY_LIMIT = 200 (linia 216) = o singură limită lunară pentru TOATE apelurile AI
- Funcția consumeAiQuota(uid) consumă dintr-un singur bucket: count >= AI_MONTHLY_LIMIT aruncă eroare globală
- Fără diferențiere de cost sau subcote pe "Buget", "Structură campanie", "Texte", "Analiza concurență", etc.

**3. Model de facturare: pachete cu preț fix lunar, NU credite granulare**
Fișier dovadă: C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\config\packages.ts (liniile 41–109)
- 3 pachete fixe: Start (149€), Growth (399€), Premium (999€) — cu prețuri lunare uniforme
- Fiecare pachet = un priceId Stripe singular (o singură linie pe factură lunară)
- NU există "noduri" cu prețuri individuale: Buget (1 credit), Structură (2 credite), etc.

**4. Conținut generat: monolitic, NU modular pe subiecte**
Fișier dovadă: C:\Users\besli\Desktop\MyWork\Apps\DataRead\functions\index.js (liniile 237–266)
- Schema CAMPAIGN_SCHEMA = set fix: adTexts, videoScripts, campaignStructure
- Schema CONTENT_SCHEMA = set fix: calendar, posts, ideas
- Prompt-ul e integral pentru subiect — NU noduri separate
- Răspunsul e singurul JSON pe acele câmpuri (NU o listă de noduri cu cost separat)

**Concluzie:** DataRead NU are infrastructura de noduri de aprofundare cu cost granular per-topic. Are model de cereri binare, quota monolitică lunară (200 generări), facturare pe pachete fixe lunare, și livrabile integrate pe prompt. Competitorul ofertă noduri expandabile cu cost (Buget=1, Structura=2, etc.) — DataRead NU are aceasta.

## [confirmat-absent] DataRead — Verificare monetizare prin credite vs. abonamente lunare
- categorie: monetizare
- de ce conteaza: Creditele + explorarile gratuite scad bariera de intrare (testezi gratis, platesti cat folosesti) si aliniaza venitul la consumul real de AI. Pentru DataRead, lipsa unui trial/freemium si a oricarui pret pe actiune inseamna ca un prospect nu poate experimenta valoarea AI inainte de a se angaja la 149€/luna — un obstacol mare de conversie self-serve.
- status DataRead: Analiză completă — CLAUDE.md, src/config/packages.ts, src/store/entitlementLogic.ts, functions/index.js (AI quota), firestore.rules, src/services/billing.ts
- dovada: DataRead folosește EXCLUSIV model de abonament Stripe lunar (3 pachete: 149/399/999 €), fără credite cumparabile, freemium sau trial. Dovezi: (1) src/config/packages.ts liniile 41-109 = 3 pachete DOAR cu priceId Stripe, modules feature-flag, ZERO credit system; (2) entitlementLogic.ts liniile 4, 17, 48 = status 'none|active|expired', FĂRĂ trial; (3) functions/index.js linia 216 = AI_MONTHLY_LIMIT=200 = gard INTERN operator, regula firestore.rules 140-143 = aiUsage scris Admin SDK, clientul NU-l vede; (4) firestore.rules = colecții: customers (Stripe), admins, campaigns, landingPages, lpProjects, clients — NICIO colecție de credite/pachete freemium; (5) services/billing.ts liniile 156-186 = createCheckoutSession abonament LUNAR NUMAI, fără one-time charges; (6) CLAUDE.md linia 134 = "FĂRĂ trial", linia 135 = "ACTIVE_STATUSES = active|trialing", linia 54 = pachete config Stripe standard. Competitorul vinde credite + bar progres + freemium; DataRead vinde abonamente lunare Stripe numai.

## [confirmat-absent] DataRead Client Self-Serve Product Generation Capability
- categorie: flux-produs
- de ce conteaza: Self-serve-ul determina scalabilitatea si profunzimea perceputa: clientul exploreaza, regenereaza si aprofundeaza cand vrea, fara a astepta un operator. Modelul DataRead (operator-in-the-loop) limiteaza throughput-ul la timpul celor 2 operatori si reduce numarul de iteratii AI per client — deci profunzimea efectiva livrata. Chiar partial (un mod 'genereaza singur' limitat), ar debloca explorarea continua.
- status DataRead: Full codebase analysis completed: CLAUDE.md, functions/index.js, AppHome.tsx, and related files reviewed
- dovada: AFIRMAȚIA ANALIZATĂ: "Produs self-serve condus de client (clientul genereaza singur) — LA COMPETITOR, proprietarul firmei se logheaza, completeaza profilul si AI-ul genereaza strategia SINGUR — flux client-facing complet self-serve. LA DATAREAD?"

VERDICT: **CONFIRMAT-ABSENT** — DataRead NU are nici o componentă client-self-serve pentru generare AI.

DOVEZI CONVERGENTE:

1. **FUNCȚII CLOUD (functions/index.js, rânduri 444-800):**
   - 5 callable-uri AI exportate: `aiClientReport` (rând 444), `aiAnalyzeCampaign` (rând 512), `aiGenerateCampaign` (rând 581), `aiGenerateLandingPage` (rând 767), `aiEditLandingPage` (rând 783)
   - TOȚI 5 callable-uri conțin check OBLIGATORIU: `if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', ...)`
   - Verificări exacte:
     * Line 448: `aiClientReport`: "Doar operatorii pot genera rapoarte."
     * Line 516: `aiAnalyzeCampaign`: "Doar operatorii pot analiza campanii."
     * Line 585-586: `aiGenerateCampaign`: "Doar operatorii pot genera campanii."
     * Line 771: `aiGenerateLandingPage`: "Doar operatorii."
     * Line 787: `aiEditLandingPage`: "Doar operatorii."

2. **PORTALUL CLIENT (src/app/AppHome.tsx, rânduri 26-153):**
   - Componenta `MarketingPortal` - READ-ONLY pentru client (rând 28: "Read-only — operatorii gestionează tot")
   - Client VEDE doar:
     * Campaniile lui (rând 36: `campaigns where clientUid==uid`)
     * Raportul lunar generat de AI (rând 48-49, din `clients/{uid}.marketingReport`, oglindit de functions)
     * Livrabilele primite (rând 52-53: `deliverables` colecție, oglindit de trigger `onRequestWrite`)
   - Client NU POATE genera nimic — niciun buton, niciun apel la callable

3. **FLUX FUNCȚIONĂRI (LeadRequests.tsx, rânduri 258-296):**
   - Callable-ul `aiGenerateCampaign` e invocat DOAR din `/admin` (componenta admin-side LeadRequests)
   - Nu există nicio legătură în `/app` (portalul client) care să permită invocarea

4. **OGLINDIREA DATE (onRequestWrite trigger, rânduri 160-198):**
   - Trigger scrie DOAR în `clients/{uid}/deliverables` — copie read-only injectată de backend
   - Rules: `write: false` pe deze colecții (rând 163 CLAUDE.md: "Reguli: `admins`/`adminRequests`/`adminAudit` = `write:false` (doar Admin SDK)")
   - CLIENT nu poate modifica/genera — DOAR citi ce backend-ul scrie

5. **ARHITECTURĂ CONFIRMATĂ (CLAUDE.md):**
   - Rând 26-27: "Backend central (control center): absolut tot trece prin el"
   - Rând 79: "/admin e backend-ul, are autentificare; Self-serve-ul public... rămâne DORMANT"
   - Rând 85: "Acces backend prin cereri aprobate" — nu e direct

CONCLUZIE: DataRead e COMPLET admin-driven. Toate 5 funcții AI sunt **admin-only**. Clientul = consumer read-only al output-ului. Nu există nicio infrastructură self-serve pe client — nici nu e planificată în P2/P3 (spec/DEVLOG).

## [confirmat-absent] Export PDF al strategiei/planului — verificare status DataRead
- categorie: flux-produs
- de ce conteaza: Un PDF al planului final transforma munca AI intr-un livrabil tangibil pe care clientul il poate arhiva, prezenta intern sau trimite mai departe — creste valoarea perceputa si utilitatea practica a continutului generat. Pentru DataRead, planul bogat (sinteza, segmentare, funnel) ramane captiv in UI, fara format portabil.
- status DataRead: DataRead are export CSV pentru lead-uri (AdminHome.tsx), metrici campanie (MarketingCenter.tsx), variante LP și submissions (LpAnalytics.tsx), și rapoarte lunare generate de AI (functions/index.js aiAnalyzeCampaign). NU are export PDF. Package.json nu conține nicio bibliotecă PDF (pdfmake, jspdf, html2pdf, puppeteer). Rapoartele AI sunt stocate ca text plin în Firestore, fără serializare PDF.
- dovada: Fișierele cheie:
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\utils\csv.ts — utilitare CSV sigure (anti-injecție formule)
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\admin\AdminHome.tsx (line 382-415) — exportCsv() pentru lead-uri, format RO cu BOM
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\admin\MarketingCenter.tsx (line 210-219) — exportCsv() pentru metrici campanie
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\admin\LpAnalytics.tsx (line 100-110, 142-151) — exportVariantsCsv() și exportCsv() pentru LP și submissions
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\src\app\AppHome.tsx (line 282-292) — exportLeads() pentru lead-uri LP
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\functions\index.js (line 490-508) — aiAnalyzeCampaign callable generează raport {summary, highlights, recommendations} text-only, stocat în Firestore
- C:\Users\besli\Desktop\MyWork\Apps\DataRead\package.json — zero dependență PDF (doar Firebase, React, i18next, Zustand, Vite, TypeScript)

## [confirmat-absent] Meniu Sugestii (urmatorul pas AI) — Status DataRead
- categorie: ux
- de ce conteaza: Sugestiile inchid bucla de actionabilitate: AI-ul nu doar genereaza, ci indruma 'urmatoarea mutare' (ex. genereaza remarketing acum, optimizeaza bugetul pe cartierul X). Pentru DataRead, un strat de sugestii ar creste utilizarea AI per client si ar ghida operatorul/clientul spre aprofundarile cu cel mai mare impact.
- status DataRead: DataRead are o arhitectură pull-based pentru admin: 4 taburi (leads, marketing, landing, admins) in AdminHome.tsx; toți ai callables (aiGenerateCampaign, aiAnalyzeCampaign, aiClientReport) sunt reactivi — admin apasă butoane explicit. Nu exist nici o infrastructură de sugestii proactive, nici în UI, nici în backend, nici în scheme Firestore.
- dovada: 1. AdminHome.tsx (linia 34): type AdminView = 'leads' | 'marketing' | 'landing' | 'admins' — NO suggestions view. 2. functions/index.js: aiGenerateCampaign/aiAnalyzeCampaign/aiClientReport sunt onCall (reactive triggers), nu geolocații pe Firestore listeners sau push-uri. 3. CLAUDE.md (180): 'panoul admin e pull-based (filtre pe status, search — AdminHome.tsx)' 4. LeadRequests.tsx: „Generează cu AI" e un buton care apelează httpsCallable — nu automat/proactiv. 5. Grep 'suggestion|proactive|next.*step' în src/: nicio match relevantă în componente, doar stringuri i18n descriptive.

## [partial-prezent] Verificare Adversarială: Structura Profil pe Axe Strategice în DataRead
- categorie: ai-depth
- de ce conteaza: Cand fiecare camp de profil (ex. concurenti, zona) e cuplat la o aprofundare AI dedicata (analiza concurenta, geo-targeting pe cartiere), datele de intrare devin parghii de profunzime, nu doar context pasiv. DataRead are deja datele — le foloseste doar ca text de prompt, ratand oportunitatea de a le transforma in noduri/aprofundari concrete si actionabile.
- status DataRead: DataRead colectează date pe 4 axe strategice (Identitate, Oferta, Piață, Obiective) în OnboardingData, dar prompturile AI sunt statice și lineare — bloc context monolitic reutilizat pentru toate generările. Nu există arbore decizional de aprofundări dedicate per-axă, nu sunt mapate explicit axele în prompturi, și nu se contabilizează resurse AI per-nod.
- dovada: 
**1. COLECTARE: Date complete pe 4 axe (src/types/onboarding.ts)**
- Identitate: companyName, industry, industryOther
- Oferta: website, description, facebook, instagram, tiktok  
- Piață: objectives (sales/leads/awareness/traffic), adBudget (under250/b250_500/...)
- Obiective ops: din MarketingRequest (offer, budget, objective) — rândurile 57-70 în request.ts

**2. PROMPTURI: STATICE, NU ADAPTIVE (functions/index.js rândurile 270-320)**

Funcția `leadContextBlock(lead)` stringify-iază TOTI parametrii în bloc monolitic:
```
== FIRMA CLIENTULUI ==
Nume: ...
Industrie: ...
Descriere și public țintă: ...
Website: ...
Social: ...
Obiectivele declarate ale firmei: [toti objectives pe o singura linie]
```

Promptul campaniei (`buildCampaignPrompt`, rândurile 302-319) reutilizează blocul static + adaugă 4 parametri generici (Titlu, Oferta, Buget, Obiectiv).

**3. CEEA CE LIPSESTE (vs. modelul competitorului):**
- NU există mapare explicită: `objectives → aprofundări dedicate` (de ex. sales → CTA agresiv)
- NU există noduri contextuale ramificate (ex. Analiza Concurență, Positioning)
- NU se colectează: concurenți, zona geografică, positioning explicit
- Budget din `MarketingRequest` (rând 63-64) e "text liber v1", NU declanșator de linie bugetară
- NU există contabilitate per-axă în aiUsage (global lunar, NU per-nod strategic)

**4. INFRASTRUCTURA EXISTĂ, NU E EXPLOATATA:**
- OnboardingData structurează datele corect (schema completă)
- callables aiGenerateCampaign citesc lead-ul complet (rândurile 597-606)
- Schema CAMPAIGN_SCHEMA e fixă (3 câmpuri: adTexts, videoScripts, campaignStructure) — NU flexibilă per context
- Niciun IF/THEN arbore pe baza axelor (lipsă decisional tree, rândurile 302-319 sunt lineare)

**DOVEZI TEXTUALE:**
- CLAUDE.md, rândurile 145-152: "callable-ul aiGenerateCampaign ... scrie livrabilele pe cerere (source: 'ai')" — NU mențiune de arbore per-axă
- request.ts, rândurile 63-64: "Bugetul campaniei — text liber în v1" — NU structured, NU mapat la cotă de resurse
- functions/index.js, rândul 312: `Buget: ${r.budget || 'nespecificat'}` — generic, NU declanșator




# ============ RAPORT FINAL ============

Voi genera raportul direct pe baza analizei verificate furnizate. Am toate informațiile necesare (transcrierea competitorului, inventarul DataRead, și 30+ gap-uri verificate cu verdict față de cod).

---

# RAPORT FINAL — Ce are "AI Marketing Explorer" IN PLUS față de DataRead

Pentru: Andrei | Data: 15.06.2026 | Sursă: cod DataRead (main) + transcriere competitor

---

## 1) DIFERENȚA STRATEGICĂ MAJORĂ (nu e o listă de feature-uri, e alt model de business)

Competitorul și DataRead rezolvă aceeași problemă (strategie de marketing cu AI pentru firme mici), dar sunt **două mașini economice diferite**:

| | AI Marketing Explorer | DataRead |
|---|---|---|
| Cine generează | Clientul, singur (self-serve) | Operatorul (Andrei/Ionuț), admin-only |
| Cum plătește | Credite consumabile + 2 explorări gratuite | Abonament lunar 149/399/999 € |
| Barieră de intrare | 19 LEI (sau gratis) | 149 €/lună, fără trial |
| Cost marginal/client | ~0 (clientul face munca) | Timp de operator pe fiecare client |
| Limita de creștere | Câți clienți pot plăti | Câți clienți pot servi 2 oameni |

**Implicația reală, nu cosmetică:**

- **Competitorul scalează fără oameni; DataRead nu.** La competitor, 10 sau 10.000 de clienți consumă același efort uman (zero). La DataRead, fiecare client nou consumă timp de operator la onboarding, generare, regenerare. **TAM-ul efectiv al DataRead azi = câți clienți pot servi manual 2 operatori, nu câți pot plăti.** Asta e plafonul de creștere, dovedit în cod: toate cele 5 callable-uri AI verifică `request.auth.token.admin !== true → permission-denied`.

- **Competitorul vinde "încearcă acum"; DataRead vinde "contactează-ne".** Competitorul încasează la momentul intenției maxime (clientul vrea strategia ACUM, are 2 explorări gratuite, plătește 19 LEI). DataRead pierde acel moment: formularul `/start` produce doar un lead în coadă, valoarea apare abia după ce un operator generează manual. Checkout-ul Stripe există în cod dar e **DORMANT** (priceIds goale, nelegat din site).

- **Dar modelul DataRead nu e "inferior" — e altă poziționare.** Competitorul vinde **software** (self-serve, marjă pe credite, dar calitate dependentă de cât de bine se descurcă singur clientul). DataRead vinde **rezultat done-for-you** de calitate de agenție (operator-in-the-loop, control pe output, model Opus, fără ca clientul să trebuiască să știe ce e un funnel). Pentru firme mici fără expertiză de marketing, "îți facem noi" e adesea mai valoros decât "fă-ți singur".

**Concluzia pe care trebuie să o iei conștient, Andrei:** întrebarea nu e "ce feature-uri să copiem", ci **"vrem să rămânem agenție-cu-AI sau să adăugăm un al doilea segment self-serve?"**. Cele mai multe diferențe de mai jos (credite, trial, generare self-serve, noduri cu preț) sunt **manifestări ale aceleiași alegeri de model**, nu funcții independente. Le poți adăuga doar dacă decizi că vrei și un canal self-serve — altfel nu au sens izolat.

---

## 2) FUNCȚII CONFIRMAT LIPSĂ — grupate și prioritizate (impact × efort)

Notă onestă: 18 din ~26 gap-uri verificate sunt `confirmat-absent`. Dar majoritatea sunt **fețe ale aceluiași model self-serve**. Le grupez ca atare.

### GRUP A — "Pivotul self-serve" (impact STRATEGIC uriaș, efort MARE — e o decizie, nu un sprint)

Acestea stau sau cad împreună. Nu are sens să implementezi unul fără celelalte.

1. **Generare condusă de client** (`confirmat-absent`) — azi clientul în `/app` e pur read-only; nu poate apela niciun callable AI.
   - *Implementare:* un al 6-lea claim/rol (`clientCanGenerate`, gated pe pachet), expunere `aiGenerateCampaign` la client cu `clientUid==uid`, reguli Firestore `allow create` pe `leads/{id}/requests` pentru client, UI de creare cerere în `/app` (azi există doar afișare). Refolosești tot backend-ul AI existent — **infrastructura e gata, lipsește doar poarta de acces și UI-ul de input.**

2. **Monetizare prin credite** (`confirmat-absent`) — azi doar abonament Stripe, fără sold consumabil.
   - *Implementare:* colecție nouă `clients/{uid}/credits` (balance + ledger de tranzacții), Stripe one-time prices pentru pachete de credite (Starter/Business/Professional), `consumeCredits()` în Functions paralel cu `consumeAiQuota()` existent (care rămâne gardul intern de operator). Efort mediu pe backend, dar inutil fără A.1.

3. **Trial/freemium pe consum** ("2 explorări gratuite") (`confirmat-absent`) — azi explicit "FĂRĂ trial", statusuri `none|active|expired`.
   - *Implementare:* la self-signup, seed `freeExplorations: 2` pe `clients/{uid}`; `consumeCredits()` consumă întâi explorările gratuite. **Atenție:** contrazice decizia ta din 11.06 ("fără trial") — de aceea e parte din pivot, nu un add-on.

4. **Checkout self-serve în produs** (`partial-prezent` — infrastructura EXISTĂ, e dormantă) — `createCheckoutSession()`, UI card, `startCheckout()` toate scrise; lipsesc doar `VITE_STRIPE_PRICE_*` și legătura din site.
   - *Implementare:* **cel mai ieftin win din tot grupul** — setezi priceIds în env și legi butonul. Dar are sens doar dacă activezi self-serve-ul.

5. **Indicator vizibil de sold + cost-per-acțiune** (`confirmat-absent`) — `aiUsage` e admin-only la citire.
   - *Implementare:* după A.2, o bară de progres + "X credite" în `/app`, preț afișat pe fiecare buton de generare. UI mic odată ce există modelul de credite.

> **Verdict Grup A:** mare impact pe creștere, dar **e o re-arhitecturare de model + decizie de business**, nu un task. Nu-l ataca pe bucăți.

### GRUP B — Profunzime AI & UX (impact MARE, efort MIC–MEDIU — utile chiar și fără pivot self-serve)

Acestea **îmbunătățesc DataRead ca produs de agenție**, indiferent de model. Sunt cele mai bune candidate pentru "acum".

6. **Pas de Oportunități / recomandare canale AI înainte de strategie** (`partial-prezent`) — azi prompturile sunt statice; AI-ul deduce implicit canalul, dar nu există pas explicit care să spună "pentru firma ta, recomand Facebook geo + Instagram + Google, buget X/Y/Z".
   - *Implementare:* **un singur callable nou** `aiRecommendChannels(leadId)` care citește lead-ul deja colectat (industrie, buget, public, zonă) și scrie `leads/{id}.recommendedChannels`. Efort MIC, impact MARE: dă "aha moment" și ancorează tot restul. Datele de intrare există deja în onboarding.

7. **Generare progresivă pe niveluri** (Clarificare → Strategie → Texte → Optimizare → Plan complet) (`confirmat-absent`) — azi one-shot, un buton = tot pachetul.
   - *Implementare:* status pe cerere extins de la `open|done` la etape, fiecare etapă un apel AI care primește output-ul validat al etapei anterioare ca input. Efort MEDIU. **Beneficiu și pentru modelul de agenție:** operatorul duce o campanie de la draft la plan final controlat, planuri mai coerente, mai puțin rebut de tokeni.

8. **Noduri de aprofundare cu conținut concret** (Buget, Structură, Remarketing, Funnel — fiecare cu scop + automatizări + reguli + KPI) (`confirmat-absent`) — partea de **preț per nod** ține de Grup A (credite), dar partea de **profunzime de conținut** e valoroasă independent.
   - *Implementare:* extinde schema de livrabile cu noduri opționale generabile la cerere de operator. Refolosește pattern-ul existent de request. Efort MEDIU.

9. **Export PDF** (`confirmat-absent`) — azi doar CSV (lead-uri) + copy-to-clipboard.
   - *Implementare:* librărie client (`jspdf`/`html2pdf`) pe raportul lunar + livrabile + plan. Efort MIC. **Win de percepție:** transformă "text pe ecran" în deliverable tangibil pe care clientul îl arhivează/prezintă. Util în ambele modele.

### GRUP C — Ghidaj & navigație (impact MEDIU, efort MIC)

10. **Funnel numerotat / wizard cu pași** (`confirmat-absent`) — competitorul are sidebar Firma/Idei/Strategie/Detalii/Istoric + stepper 1-5. DataRead are componentele dar nu un parcurs ghidat.
    - *Implementare:* stepper UI peste componentele existente. Efort MIC. Crește activarea și percepția de "produs", nu de agenție.

11. **Meniu Sugestii proactive** (`partial-prezent` pe date, absent ca UI) — recomandările AI deja se generează (`aiClientReport`, `aiAnalyzeCampaign`) dar operatorul nu le vede proactiv; e pull-based.
    - *Implementare:* un strat "următorul pas recomandat" în AdminHome care suprafațează insight-urile deja generate + lead-uri netratate de X zile. Efort MIC.

12. **Dashboard hub de start** (`partial-prezent`) — portalul e agregator read-only, nu hub cu progres/next-step. Se rezolvă natural odată cu C.10.

---

## 3) CE ARE DataRead DEJA — EGAL SAU MAI BUN (ca să nu pară că rămânem în urmă)

Onest: pe mai multe axe DataRead **nu e în urmă**, e doar poziționat diferit sau are capacitatea ascunsă în panoul de operator.

- **Istoric/versionare — DataRead are MAI MULT decât pare.** Competitorul are "Istoric (generări salvate)". DataRead are **snapshots imutabile** (`versions/{versionId}` cu `snapshotAt`, `snapshotBy`, `reason`) + restaurare gratuită (nu consumă quota). Singura diferență: la DataRead e în panoul de **operator**, nu în fața clientului. Capacitatea e superioară; lipsește doar expunerea în `/app` (mutare de UI, nu construcție de la zero).

- **Analiză de performanță cu verdict acționabil** — `aiAnalyzeCampaign` dă `scale/maintain/pause/test` + reasoning + acțiuni concrete, legat de KPI reali (ROAS, CPL, spend). Competitorul arată plan, dar **DataRead are bucla de optimizare post-lansare pe date reale de campanie** — ceva ce un pur generator self-serve nu are.

- **Mini-CRM pe lead-urile din Landing Pages** — status Nou→Contactat→Calificat→Câștigat/Pierdut + notă + export CSV, scoped per client. Competitorul (din ce s-a transcris) nu are CRM. **Aici DataRead e clar înainte.**

- **Landing Pages cu analytics + variante + telemetrie** — generare, editare AI, statistici pe variante, submisii, byMedium. Competitorul nu pare să livreze LP-uri funcționale, doar plan.

- **Calitate de agenție pe model Opus + control pe output** — operatorul vede și poate corecta înainte de livrare. Pentru segmentul "nu știu marketing, faceți voi", asta bate self-serve-ul.

- **Securitate & multi-tenant solid** — scoping strict pe `clientUid`, livrabile client-safe (fără note interne), Admin-SDK-only writes. Maturitate de platformă reală.

---

## 4) RECOMANDARE — ce preiei ACUM, ce mai TÂRZIU, ce NU

### ACUM (impact mare, efort mic, util în modelul actual de agenție — nu cer pivot)
1. **`aiRecommendChannels(leadId)`** (B.6) — un callable, datele există deja. Cel mai bun raport valoare/efort din tot raportul. Dă "aha moment" și e util și operatorului.
2. **Export PDF** (B.9) — librărie client, câteva zile, mare win de percepție pe deliverable.
3. **Meniu Sugestii pentru operator** (C.11) — suprafațează insight-uri deja generate; ieftin, crește utilizarea AI per client.
4. **Expune istoricul de versiuni în portalul client, read-only** (din §3) — ai deja totul în backend; e doar UI.

### MAI TÂRZIU / condiționat de o decizie de model
5. **Generare progresivă pe niveluri** (B.7) și **noduri de aprofundare ca profunzime de conținut** (B.8) — valoroase chiar și pentru agenție, dar efort mediu; programează-le după ce livrezi câștigurile rapide de mai sus.
6. **Wizard/funnel numerotat** (C.10) — face sens mai ales dacă te apropii de self-serve; altfel, prioritate medie.

### DOAR DACĂ decizi conștient un al DOILEA segment self-serve (pivot de model)
7. **Tot Grupul A** (generare self-serve + credite + trial + checkout activ + indicator de sold). **Nu le implementa izolat.** Au sens doar împreună, ca un al doilea produs (ex: un nivel "self-serve light" gated pe pachet, pentru lead-urile care nu sunt gata de 149 €/lună). Recomandare: tratează-l ca **decizie de business separată**, nu ca backlog tehnic. Notă: dacă mergi pe el, **checkout-ul (A.4) e deja 90% construit și dormant** — singura piesă aproape gratis.

### CE NU se potrivește modelului DataRead (nu copia mecanic)
- **Înlocuirea abonamentului cu credite.** Creditele coboară bariera de intrare, dar **erodează predictibilitatea venitului** (MRR) și nu se potrivesc cu livrarea done-for-you (unde costul real e timpul operatorului, nu inferența). Cel mult **adaugă** credite ca nivel paralel pentru self-serve, nu **înlocui** abonamentul.
- **"Re-deschidere gratuită a conținutului generat" ca mecanică de pricing** — are sens doar în economia de credite a competitorului (reduce frica de a irosi credite). În modelul flat al DataRead e irelevant; oricum nu plătești pe deschidere.
- **Renunțarea la operator-in-the-loop pentru clienții actuali.** Diferențiatorul tău e calitatea controlată de agenție. Self-serve-ul, dacă vine, e un segment NOU, nu o înlocuire.

---

**Bottom line, Andrei:** competitorul nu are un AI "mai bun" — are un **model de distribuție mai scalabil** (self-serve + credite). În PLUS concret față de DataRead are: generare condusă de client, credite + trial + checkout activ + indicator de sold, pas de recomandare canale, generare progresivă pe niveluri, noduri cu preț, export PDF, funnel numerotat și meniu sugestii. Dar pe **CRM, landing pages, analiză de performanță pe date reale, versionare și calitate de output**, DataRead e egal sau mai bun. Pașii corecți acum sunt cele 4 câștiguri rapide din §4 (recomandare canale, PDF, sugestii operator, istoric expus) — toate utile fără să-ți schimbi modelul. Pivotul self-serve (Grupul A) e o decizie strategică separată, de luat conștient, nu un sprint de implementat din inerție.