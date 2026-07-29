# Plan — „Magazin online" ca serviciu provizionat din DataRead

**Pentru cine:** noi (Andrei + Ionuţ). **Regim:** document VIU, se editează. **Data:** 2026-07-12.
**Sursa:** analiză multi-agent pe codul REAL din `PrestoConstruct` + `DataRead`, cu un pas de reality-check
adversarial care a corectat 4 greșeli din prima versiune a planului (marcate mai jos cu ⚠️).

**Ce răspunde:** (1) ce mai trebuie făcut în Presto ca sistemele lui să fie ridicabile; (2) cum se adaptează
DataRead ca să provizioneze și să administreze magazine online cu features care contribuie la cost.

**Documente înrudite:** `PrestoConstruct/docs/REUTILIZARE.md` (inventarul celor 27 de sisteme + capcanele deja
plătite) · `PrestoConstruct/ROADMAP.md` (secțiunile „ÎNAINTE de livrare" și „Clonare/white-label") ·
`DataRead/src/config/packages.ts` (oferta comercială).

---

## 0. TL;DR

- **Arhitectura:** un magazin = **un proiect Firebase propriu**. DataRead nu găzduiește magazine, ci le
  **provizionează și le guvernează** (registru + licență + facturare + sănătate). Izolarea stă SUB codul
  aplicativ, niciodată în cod.
- **Motivul, în cifre:** regulile Presto au **54 de colecții top-level fără discriminant de tenant**, iar
  `isAdmin()` guvernează scrierea pe toate. Într-un proiect partajat, adminul magazinului A ar putea scrie peste
  `orders`/`refundLedger` ale lui B. Mutarea discriminantului în cod = ~193 call-site-uri client + 57
  `admin.firestore()`, plasate exact în `functions/`, care **nu are typecheck**. Nu facem asta niciodată.
- **Secvențierea (decizia owner-ului, respectată):** termină Presto → livrează → încasează → apoi integrează.
  Singurele lucruri de făcut ACUM în Presto sunt inerte (zero schimbare de comportament) sau reparații de bani.
- **Ce blochează azi provisioning-ul automat** (descoperit la reality-check): nu putem crea proiecte GCP
  programatic fără organizație (cont gmail ⇒ fără org). Soluția e un **pool de proiecte pre-create**, alocate de
  provisioner. Vezi §6.1.

---

## 1. Decizia de arhitectură

**Un magazin = un proiect Firebase. DataRead = planul de control.**

| Opțiune | Verdict |
|---|---|
| **A. Proiect per magazin** (ales) | Izolare prin construcție; zero refactor aplicativ; magazinul #2 e atins fără săptămâni de infrastructură. |
| **B. Un proiect partajat, discriminant de tenant în colecții** | **Niciodată.** 54 de colecții × reguli × ~250 call-site-uri, în zona fără typecheck. Riscul e „bani/comenzi în magazinul greșit". |
| **C. Nexus comun + bază Firestore NUMITĂ per magazin** | **Evoluția documentată**, nu punctul de start. Trecerea A→C schimbă doar ținta provisionerului + un argument în `getFirestore(app, dbId)` — dacă facem acum pregătirile ieftine din §2(ii). |

**Ce face decizia reversibilă:** helperul `shopDb(ctx)` + citirile de config per-request (T1–T3). Cu ele,
mutarea la varianta C e mecanică.
**Ce ar face-o ireversibilă (deci evităm):** (a) discriminant în colecții; (b) darea de IAM/Owner GCP clientului
pe proiectul magazinului — atunci poarta comercială devine doar contractuală; (c) promisiuni comerciale de tip
„magazin live în 2 minute" înainte să existe pool-ul de proiecte.

---

## 2. Ce mai trebuie făcut în PRESTO

Nimic din lista asta nu oprește finalizarea și livrarea magazinului curent.

### (i) Blocante pentru provisioning

| # | Ce | Efort | Când |
|---|---|---|---|
| **P1** | `licence/current` — colecție nouă (`read: isAdmin()`, `write: false`), `src/types/licence.ts` cu coercer unic + selector pur `moduleActive()`. **Doc lipsă ⇒ toate modulele active** (magazinul de azi, neschimbat). | 2-3 z | acum |
| **P2** | `licenceBlocked(db, moduleId)` în `functions/index.js`, clonat după `aiFeatureBlocked`. Aplicat după `requireAdmin` pe: AWB/expediere→`logistics`; oferte B2B→`b2b`; schedulerele de retenție→`retention`; integrări ERP→`erp`; asistenții→`storefrontAi`; restul AI→`ai`. | 3-4 z | după livrare |
| **P3** ⚠️ | **Plafon AI dur.** `settings/*` e admin-writable ⇒ proprietarul își poate ridica singur plafonul pe cheia NOASTRĂ. **Corecție critică:** în cod, `budget = 0` înseamnă **fără plafon** (`if (!(budget > 0)) return false`) — deci un simplu `min(licenţă, setări)` cu setări=0 dă 0 = **fără plafon**, adică exact gaura pe care voiam s-o închidem. Corect: normalizează `0`/absent la `+∞` ÎNAINTE de `min`, iar licența lipsă → plafon implicit **tare**, nu infinit. Plus: `aiBudgetBlocked` e azi fail-OPEN pe eroare de citire — pentru BANI trebuie fail-closed (sau ultima valoare cunoscută). | 0,5-1 z | **acum** |
| **P4** | Registru `FUNCTION_MODULE` + aserțiune în `scripts/functions-smoke.mjs` care enumeră toate `exports.X = onCall` (azi ~92) și **pică** dacă vreunul lipsește din registru. ⚠️ **Înaintea lui P2**, nu odată cu el — altfel primul callable adăugat în timpul integrării e gratuit pentru toți. | 1 z | înainte de P2 |
| **P5** | `controlPlane` — `onRequest` cu HMAC per magazin + allowlist strictă de comenzi (`setLicence`, `getHealth`, `exportData`, `suspend`, `resume`). **Agent în magazin, NU service-account ținut la noi** (un service-account per magazin la noi = o breșă compromite toate magazinele). | 5-7 z | felia F3 |
| **P6** | Extensia Trigger Email **nu e declarată în repo** (`firebase.json` fără bloc `extensions`) — livrarea o face o extensie instalată manual din consolă. Ultimul pas manual care blochează provizionarea automată. | 2 z | felia F4 |
| **P7** | Cele 5 scurgeri **fără canal de override** (restul de 19 au override în admin ⇒ sunt conținut, nu defecte): `app.tagline` din i18n (folosit ca `<title>` pe 6 pagini) · `Logo.tsx` cu calea SVG hardcodată (**imagine ruptă în header**) · `DEFAULT_ORDER_EMAIL.subject` · `robots.txt` cu sitemap-ul nostru · `gen-og.mjs`. | 2-3 z | înainte de magazinul #2 |

### (ii) Parametrizări (hardcodat → config) — inerte, se fac ACUM

| # | Ce | Efort |
|---|---|---|
| **T1** | `SITE_ORIGIN` + `OWNER_EMAIL` din constante de modul → citiri per-request cu cache 60s (tiparul `brandName()`). Închide și un bug real: `success_url`/`cancel_url` Stripe pleacă azi cu originea din env-ul de deploy. | mic |
| **T2** | `REGION` hardcodat în functions vs citit din env în client — două surse care pot deriva tăcut, cu simptom opac (callable mut). | mic |
| **T3** | Helper `shopDb(ctx)` care azi întoarce exact `admin.firestore()` + gardă statică care pică build-ul la orice `admin.firestore()` în afara lui. **Cea mai bună investiție de 1 zi din tot planul** — e ancora care ține deschisă varianta C. | 1 z |

### (iii) Sisteme de ridicat
Inventarul complet e în `REUTILIZARE.md` §5 (16 drop-in / 7 small-rewire / 4 significant-rework). De adăugat
acolo, ca procedură: **S1** — fiecare sistem „drop-in" primește o fișă (colecții, secrete, config, ce se rescrie);
**S3** — suită de teste pe reguli (533 de linii validate azi doar prin citire umană; într-un model multi-magazin
o regulă greșită e breșă între doi clienți plătitori). ⚠️ Verticala/meseria din prompturile AI se parametrizează
**înainte de magazinul #2** (primul client non-construcții), nu înainte de livrarea lui Presto.

---

## 3. Ce se construiește în DATAREAD (pe felii)

DataRead **nu are azi nicio noțiune de magazin** (zero `shops` în reguli; toate cele 3 pachete au
`modules: ['marketing']`). E modul nou, nu extindere.

**F0 — Reparația de bani** *(se poate face acum, independentă de magazine)*
`recomputeEntitlement` alege un singur „best" abonament per uid și extrage `priceId` din `s.items[0]` ⇒ orice
add-on vândut ca linie separată e invizibil. ⚠️ **Corecție de la reality-check:** problema reală nu e doar
`items[0]`, ci că funcția e **per-uid, un singur abonament** — un client cu **două magazine** are al doilea
abonament ignorat tăcut. Semnătura corectă: `entitlements(subs[]) → Map<shopId, …>`, cu `shopId` în `metadata`
la subscription **și** pe fiecare item. *Efort: 3-4 z.*

**F1 — Catalogul comercial + registrul de magazine**
`src/config/shopModules.ts` (sursă unică: id, priceId, preț, dependențe, i18n) mapat pe cele 27 de flag-uri
Presto. Colecția **top-level** `shops/{shopId}` (identitate / provisioning / comercial / operațional), reguli
`read: isAdmin() || resource.data.clientUid == auth.uid`, `write: false`. Secretele **separat**, în
`shopSecrets/{shopId}` (`read,write: false`, criptate). ⚠️ **Înainte de a fixa prețuri:** enumeră explicit
modulele **fără chokepoint pe server** (analytics/conținut randate în client) — pentru ele poarta comercială e
la fel de cosmetică precum flag-urile pe care le declarăm nefacturabile; ori intră în nucleu, ori se
re-proiectează cu date servite de server. *Efort: 3 z.*

**F2 — Puntea + poarta comercială reală**
Callable `applyLicence(shopId)` → HMAC → `controlPlane` din magazin → `licence/current`. Poarta din P2 devine
efectivă. ⚠️ **Include obligatoriu** (mutat din F4/F5): legătura de identitate admin-magazin ↔ client-DataRead
(două pool-uri Auth diferite!) — token semnat pentru deep-link la checkout și credențial pentru heartbeat.
Fără asta, oricine cu URL-ul cumpără module pentru magazinul altcuiva. *Efort: 8-11 z.*

**F3 — Provisionerul ca mașină de stări**
`requested → approved → provisioning → live → grace → suspended → archived` (+`failed`), fiecare pas un doc
creat cu `.create()` (dedupe at-least-once). Verificarea unei rute **non-root = 200** e obligatorie (bug-ul
„404 pe tot ce nu e `/`" a lovit deja de două ori). ⚠️ **Efort real: 4-8 săptămâni, nu 7-10 zile** — vezi §6.1
pentru blocantele de platformă care trebuie rezolvate ÎNAINTE de a estima.

**F4 — Panoul operator „Magazine" + sănătatea flotei**
Sub-tab în „Administrare": tabel client/domeniu/plan/module/stare/sănătate/MRR + acțiuni (aprobă, re-rulează
pas, comută modul, suspendă, export, jurnal). Heartbeat → rollup + card în `HealthPanel`. `deployedVersion` per
magazin (10 magazine = 10 redeploy-uri coordonate la un bug de securitate). *Efort: 4 z.*

**F5 — Portalul clientului + upsell la lacăt**
`/app/magazin` → componentă **separată** (`AppHome.tsx` are deja 55KB). „Ce plătesc" din `priceBreakdown`,
consum, facturi (reutilizează `InvoicesPortal`). În Presto, modulele neplătite apar **dezactivate cu lacăt** cu
deep-link la checkout, nu ascunse. *Efort: 4 z.*

**F6/F7 (opționale, târziu)** — ledger de cost + marjă per tenant (azi `runAiJson` aruncă `usage` în log) ·
`serveShop` din hostname. ⚠️ F7 e mai puțin valoros decât pare: `src/firebase.ts` citește configul Firebase din
`import.meta.env` = **build-time**, deci „brand la runtime" NU elimină build-ul per magazin.

---

## 4. Modelul comercial

**Patru clase, criteriul = „are cost marginal real?"**

1. **NUCLEU inclus** — bucla de cumpărare, admin CRUD, SEO/prerender, monitorizare erori, consimțământ + **toate
   flag-urile pur cosmetice** (secțiuni de homepage, temă întunecată, favorite, comparare…). Facturarea lor se
   percepe ca ransomware de UI și otrăvește percepția modulelor care chiar costă.
2. **MODULE recurente** (au triggere, emailuri sau apeluri externe): `b2b`, `retention`, `ai`, `storefrontAi`
   (separat — cost per vizitator anonim), `logistics`, `analytics360`, `content`, `erp`, `feed`.
3. **ONE-OFF cu manoperă** (migrare catalog, temă custom, integrare curier nouă) → `serviceOrders` (ciclul există
   deja); NU intră în abonament.
4. **METERED** (AI $, comenzi, stocare, email, AWB) — **amânat**; modulele licențiate acoperă ~90% din valoare cu
   ~20% din efort, iar plafonul dur (P3) protejează banii între timp.

**Mecanica:** un abonament Stripe per magazin cu **subscription items** multiple (plan + un item per modul).
`packages.ts` rămâne bundle-uri de module cu discount, nu o a doua listă.
**Regula de compunere:** `efectiv(k) = licenceAllows(k) ȘI ownerEnabled(k)` — licența e un al patrulea strat,
deasupra celor 3 existente, și e singurul pe care clientul nu-l poate scrie.
**Degradare:** `active → grace (10 zile, totul merge) → suspended` — **magazinul rămâne online și VINDE**; se
opresc doar modulele plătite. `terminated` doar prin decizie explicită, cu `exportData` oferit înainte.
**Regula de aur:** poarta se pune pe **mutații** (create/convert/send/generate), niciodată pe citiri.
**Facturare:** nimic nu se rescrie — `performIssueInvoice` + numerotarea gap-free + storno validat server sunt
deja corecte legal pentru RO. Stripe = încasare, DataRead = document fiscal.

---

## 5. Ce NU facem acum

| Nu facem | De ce |
|---|---|
| Discriminant de tenant în colecții | 6-10 săptămâni-om, ireversibil, risc de bani în zona fără typecheck. Niciodată. |
| `serveShop` + brand complet la runtime | Rezolvă probleme de la magazinul #10, nu #2. Și intră în capcana deja plătită a prerenderului. |
| Metered pe consum | Cere ledger per tenant + raportare idempotentă + curs valutar. |
| Subdomenii instant | ⚠️ *Nu imposibil* (deținem zona DNS, verificarea TXT se automatizează) — dar latența emiterii certificatului face din domeniu un **proces cu stare**, nu un buton. |
| Facturarea flag-urilor cosmetice | §4.1. |

---

## 6. Blocante și riscuri descoperite la reality-check

### 6.1. Blocante de platformă (de rezolvat ÎNAINTE de a estima F3)

1. **Nu putem crea proiecte GCP programatic fără organizație.** Un service account are nevoie de
   `resourcemanager.projects.create` pe o organizație/folder; contul e gmail ⇒ fără Cloud Identity nu există org.
   **Ieșiri:** (a) Cloud Identity + org + cotă pe billing account; (b) **pool de proiecte pre-create manual**,
   alocate de provisioner. **Recomand (b)** oricum: ștergerea unui proiect are soft-delete de 30 de zile care
   **continuă să consume cota** — capcană garantată când iterezi pe provisioner.
2. **Secretele v2 se leagă la DEPLOY.** `defineSecret` cere redeploy ca funcțiile să vadă valoarea nouă ⇒
   „clientul își pune singur cheia Stripe" = redeploy de ~92 de funcții, nu un formular. Alternativa (chei
   criptate în Firestore) mută o cheie Stripe LIVE în Firestore — **decizie de risc, nu detaliu**.
3. **Activarea providerilor Auth nu e „un apel"** (client ID/secret OAuth propriu, domenii autorizate, șabloane).
4. **Extensia Stripe (`firestore-stripe-payments`) e arhivată** și nici DataRead n-o declară în `firebase.json`.
   Tot modelul comercial stă pe ea. Planifică ieșirea — tiparul de webhook propriu există deja în Presto.
5. **Identitatea de expeditor per magazin lipsește.** Dacă toate magazinele trimit de pe contul nostru,
   împart reputația de deliverability și **noi devenim expeditorul juridic** al emailurilor altcuiva.
6. **Plafonul de cheltuială nu există cu adevărat:** bugetele Cloud Billing sunt **doar alerte**. Mecanismul real
   (budget → Pub/Sub → tăiere) scoate magazinul offline, ceea ce contrazice „nucleul nu se oprește niciodată".
   De rezolvat explicit + `maxInstances` per magazin (azi global 10).

### 6.2. Legal — lipsea aproape complet din plan

7. **DPA (Art. 28).** Din clipa în care deținem proiectul GCP avem acces tehnic la datele clienților clientului ⇒
   suntem **persoană împuternicită** pentru fiecare magazin. Necesare ca **condiții de vânzare**: contract de
   prelucrare, listă de subîmputerniciți (Google, Stripe, Brevo, Anthropic, curier) cu notificare la schimbare,
   RoPA, procedură de breach, asistență la cererile persoanelor vizate, ștergere/returnare la încetare.
8. **Transfer internațional pe cheia noastră** — asistentul de vitrină trimite text de la vizitatori anonimi către
   Anthropic pe contul nostru ⇒ noi efectuăm transferul (SCC + informare în politica magazinului).
9. ⚠️ **Clauza de „operator" din Termeni NU e conținut.** Pe magazinul #2, un text implicit care spune „Presto
   Construct" e **identificare greșită a operatorului de date și a comerciantului** (Legea 365/2002, OUG 34/2014).
   Provisionerul trebuie să **refuze `live`** fără `settings/company` complet + pagini legale generate.
10. **`exportData` are nevoie de temei, destinație (URL semnat expirabil), audit și limită** — altfel e o comandă
    de exfiltrare cu binecuvântare arhitecturală.
11. **Cheia Stripe a clientului ținută la noi** (chiar criptată) = putem crea plăți și rambursări în contul lui.
    Decizia „merchant of record" (cheie restricționată vs Connect) schimbă `shopSecrets` **și** contractul.

### 6.3. Alte lipsuri
Backup/restore per magazin (azi deferat în Presto; devine obligație contractuală) · SLA/on-call/runbook ·
Cloud Scheduler are 3 job-uri gratuite **pe cont de facturare**, nu pe proiect · versionare licență vs
`deployedVersion` (un magazin cu deploy vechi nu cunoaște un `moduleId` nou ⇒ fail-open) · idempotența
`applyLicence` (webhook-urile Stripe se re-livrează).

---

## 7. Decizii care rămân pe Andrei

1. **Cine deține proiectul GCP** al magazinului. Dacă e al clientului, poarta comercială devine contractuală și
   tot designul își schimbă natura.
2. **Cine plătește Blaze** (N magazine pe contul nostru = costul nostru).
3. **Stripe: cheie per client vs Connect** — cine e merchant of record, cine gestionează disputele. *De decis
   înainte de F1*, nu după.
4. **Prețurile modulelor** (cifrele din `packages.ts` sunt provizorii).
5. Dacă introducem un palier plătit **„Dedicat"** (izolare contractuală, același cod, altă țintă de deploy).
6. **Ce se întâmplă cu Presto** (magazinul #1, client real, deja plătit): intră în flotă? Semnează DPA? Îi cerem
   abonament pentru module pe care le-a primit deja? *E prima conversație comercială reală.*

---

## 8. Ordinea de execuție

```
ACUM (nu ating livrarea Presto):  P3 (plafon AI, corectat) · T1 · T2 · T3 · P1
      ↓
LIVREAZĂ PRESTO → ÎNCASEAZĂ
      ↓
Cercetare blocante:               §6.1 (1) org/pool proiecte · (2) secrete la deploy   ← înainte de a estima F3
Decizii comerciale:               §7 (3) merchant of record · DPA (§6.2)               ← înainte de a VINDE
      ↓
F0 (entitlement multi-magazin) → P4 → P2 → F1 (+enumerarea modulelor fără chokepoint)
      ↓
F2 (+legătura de identitate) + P5 → F3 (+P6) → F4 → F5 (+P7)
      ↓
opțional: F6 (marjă) · F7 (serveShop)
```
