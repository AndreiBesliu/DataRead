# Plan — sisteme din PrestoConstruct adoptate NATIV în DataRead

**Pentru cine:** noi (Andrei + Ionuţ). **Regim:** document VIU. **Data:** 2026-07-30.
**Metoda:** analiză multi-agent pe codul REAL al ambelor proiecte (10 agenți: 6 de recunoaștere, 3 lentile de
evaluare, 1 arhitect), + verificarea mea directă a fiecărei afirmații pe care se sprijină o decizie.
**PrestoConstruct a fost atins STRICT read-only** (e în dezvoltare în altă sesiune).

**Ce răspunde:** care dintre sistemele construite în magazinul online merită să devină parte din **produsul
DataRead însuși** — folosite de operatorii noștri și de clienții noștri.

**Ce NU e:** `docs/PLAN-MAGAZINE-ONLINE.md` acoperă altă axă — magazinul ca **serviciu provizionat** din
DataRead (un magazin = un proiect Firebase, DataRead = plan de control). Cele două planuri sunt complementare.

---

## 0. TL;DR

**Adoptăm 5. Adaptăm 2. Respingem restul.**

Ordinea nu vine dintr-o listă de dorințe, ci dintr-un fapt de arhitectură descoperit la analiză: DataRead are
**un singur punct prin care trec toți banii de AI** (`runAiJson`, `functions/index.js:1763-1805` — există exact
UN `client.messages.create` în tot proiectul, la 1771) și **un singur punct prin care trece tot abuzul public**
(`clientIpHash`, 4160). Ambele sunt reparabile în zeci de linii, iar ambele sunt azi oarbe.

**Adoptăm, în ordine:**
1. **Ledger de cost AI per apel + plafon de buget** — scris ÎNĂUNTRUL lui `runAiJson`, colecție nouă `aiCalls`.
2. **Igienă de securitate publică** — `clientIpHash` ia intrarea greșită din `X-Forwarded-For`; `handleTrack`
   n-are backstop pe slug.
3. **`logServerError` + panou de erori operabil** — 24 de `logger.error` sunt azi invizibile în /admin.
4. **Motor de retenție** — DataRead nu are NICIUN `prune`; 10 colecții cresc nemărginit.
5. **plan → review → apply pe importul CSV de metrici** — o greșeală de import se propagă azi în benchmark-ul
   folosit în prompturile TUTUROR clienților.

**Adaptăm (forma, nu codul):** diagnoză activă (`runDiagnostics`) · PanelGrid (aranjament per-operator).

**Respingem ~20 de sisteme.** Motivul cel mai frecvent **nu e „nu se potrivește", ci „DataRead o are deja, uneori
mai bine"**: constructorul de formulare LP are 9 tipuri de câmp față de 7 la Presto; `printDoc.ts` e mai curat
decât cele două copii ale lui Presto; `src/utils/csv.ts` are anti-formula-injection **pe care Presto nu-l are**.
Pe zonele astea transferul ar fi în direcția greșită.

---

## 1. Metoda și corecțiile la documentația-sursă

`PrestoConstruct/docs/REUTILIZARE.md` e un document bun, dar analiza contra codului l-a corectat în trei locuri.
Le notez pentru că fiecare schimbă o decizie:

| Afirmația din doc | Realitatea în cod | Consecință |
|---|---|---|
| „harness = 2757 linii de stub Firestore in-memory" | Stubul e ~143 de linii (`STUBS` 12-154; `firebase-admin` 23-130). Restul din 2799 sunt **aserțiuni**. | Portarea ar fi ieftină — dar tot o respingem (§5), fiindcă DataRead are deja stub propriu. |
| „dashboard per-admin = generic ca **model**, doar setul de widget-uri e de magazin" | `types/dashboard.ts:4` importă `ReportDimension` → `lib/reports.ts` → `Order`. **Modelul însuși** are dependență de compilare pe modelul de comandă. Cele 20 de `WidgetType` sunt comerț pur. | Nu se portează. Se reface pe modelul nostru dacă vrem widget-uri. |
| PanelGrid apare doar ca „tipar" în §2.7/§2.10, **lipsește din inventarul §5** | E cod separat, cuplaj **0**, deliberat NEcontopit cu `dashboard.ts` (politici de coerce opuse, motivul e scris în `panelLayout.ts:4-11`). | E cel mai transplantabil lucru din tot repo-ul pentru un admin multi-tenant. Îl **adaptăm**. |

**Un avertisment care se aplică sursei înseși.** Docul spune despre jurnalul de recuperare: „dacă îl adopți,
adopt-o integral, altfel ai un istoric cu găuri, ceea ce e mai rău decât să n-ai deloc." Verificat: `AUDIT_KINDS`
declară `'mediaAsset'` și `'integration'`, dar **niciun serviciu nu cheamă `journal()` cu ele**
(`services/media.ts` scrie la 101/117/131/178 fără jurnal). Nejurnalizate și `settings/features`, `settings/ai`,
`settings/company`. Proiectul-sursă își încalcă propria regulă — motiv în plus să nu adoptăm sistemul, ci
disciplina, acolo unde o aplicăm integral.

---

## 2. Tabel de decizie

| Sistem | Ce are DataRead azi | Golul real | Valoare | Efort | Verdict |
|---|---|---|---|---|---|
| **Ledger cost AI + buget** | 5 contoare `{month\|day, count}`; `usage` e disponibil la 1771 și **aruncat** | Zero USD, zero tokeni, zero per-apel, zero per-tenant, zero plafon pe bani | Foarte mare | Mediu | **ADOPTĂM** |
| **`clientIpHash` + backstop slug** | ia `[0]` din `X-Forwarded-For` (4161); `handleTrack` fără backstop | Ambele plafoane publice ocolibile cu un antet | Mare (securitate) | Foarte mic | **ADOPTĂM** |
| **`logServerError` + panou operabil** | 24 `logger.error` doar în Cloud Logging; tabel plat de 50 | Erorile de SERVER invizibile în /admin; fără „rezolvat", fără grupare | Mare | Mic | **ADOPTĂM** |
| **Motor de retenție** | `grep -E "prune\|RETENTION"` → **0** | 10 colecții cresc nemărginit (cost + minimizare GDPR) | Mare | Mic | **ADOPTĂM** |
| **plan→review→apply pe CSV metrici** | `writeBatch` direct din browser (`MarketingCenter.tsx:304`) | Import greșit → raport fals la client **+ benchmark propagat cross-tenant** | Mare | Mediu | **ADOPTĂM** |
| **Diagnoză activă** | 4 dale de contorizare în HealthPanel | Zero verificări de subsistem | Mare | Mediu | **ADAPTĂM** (forma; check-urile se scriu de la zero) |
| **PanelGrid + PanelSections** | `AdminHome.tsx` = lanț de `{view === 'x' && …}` | Zero aranjament per-operator | Medie | Mediu | **ADAPTĂM** |
| Docs randate + căutare BM25 | `helpContent.ts` (54 linii) + ~179 chei i18n | Ghid needitabil fără deploy, fără căutare | Medie | Mediu | **AMÂNĂM** (§7 Q4) |
| Bibliotecă media | **Zero Storage** (fără `storage.rules`, 0 importuri `firebase/storage`) | Operatorul nu poate încărca o imagine pentru o LP | Condiționată | Mare | **AMÂNĂM** (§7 Q3) |
| AI Center ca **panou** | HealthPanel | `aiUsageStore` = `onSnapshot` pe până la 5000 de documente + agregare pe client | Negativă la scară | — | **RESPINGEM** |
| Feature-flags ca sistem | entitlement + 10 constante deploy-safe + `appConfig/*` | Ar fi al 4-lea vocabular de comutatoare | Negativă | — | **RESPINGEM** ca sistem (§4.F) |
| Motor de alarme | `automationEngine.ts` (DSL real, 8 operatori) + `suggestions.ts` | Al 3-lea motor de reguli | Negativă | — | **RESPINGEM** |
| Jurnal audit + restaurare | `adminAudit` **deja folosit** (4790) | Coliziune de semantică pe aceeași colecție | Mică | — | **RESPINGEM** ca sistem |
| Constructor formulare | `LP_FIELD_TYPES` = **9** tipuri + validare server | Al 2-lea model de câmp | Negativă | — | **RESPINGEM** |
| PDF prin print | `src/utils/printDoc.ts`, mai curat decât sursa | — | Zero | — | **RESPINGEM** |
| Punte preview postMessage | `previewMode.ts` + `LpPreviewPane` (srcDoc, multi-ecran) | Doar reload-după-publicare pe paginile de site | Mică | Mic | **AMÂNĂM** (§7 Q2) |
| Rutare notificări | Transport **există** (`functions/index.js:5045`), gardat de `EMAIL_ENABLED=false` | Stratul de destinatari + categorii | Medie | Mediu | **AMÂNĂM** (§7 Q5) |
| Customer 360 / fingerprint device | `contact.ts` — PII mascat **deliberat** | Am deveni împuternicit pentru datele terților | **Negativă (legal)** | Mare | **RESPINGEM** |
| Rapoarte · retururi · coduri reducere · editare în masă · curier/AWB · conector RMS · vitrină · convenție de configurare · harness · căutare/fațete · OTP · prerender/brand | Echivalente în DataRead sau irelevante | — | — | — | **RESPINGEM** (§5) |

---

## 3. Feliile adoptate

### A. Ledger de cost AI per apel + plafon de buget

**De ce prima.** DataRead face 13 apeluri `runAiJson`, toate pe `claude-opus-4-8` cu adaptive thinking, și nu
știe cât costă niciunul. Contoarele actuale (`aiUsage/{uid}` = `{month, count}`) numără *apeluri*, nu *bani* —
un apel de 2k tokeni și unul de 200k arată identic. Fără asta nu putem: calcula marja pe client, vinde credite,
sau opri o scurgere de cost.

**Faptul decisiv, care schimbă implementarea față de propunerea inițială.** `runAiJson` **aruncă** pe
`stop_reason === 'refusal'` (1782) și pe `max_tokens` (1786) **înainte** de `return { out, usage }` (1804).
Deci logarea la cele 13 call-site-uri ar rata sistematic exact apelurile pe care Anthropic le **facturează
integral, dar care eșuează**. Ledgerul se scrie **înăuntrul** `runAiJson`, pe toate cele patru ieșiri.

| Ieșire | `status` | `usage` |
|---|---|---|
| `catch` pe `messages.create` (1779) | `'error'` | absent |
| `stop_reason === 'refusal'` (1782) | `'refusal'` | **există** — tokenii sunt taxați |
| `stop_reason === 'max_tokens'` (1786) | `'truncated'` | **există** — idem |
| `return` (1804) | `'ok'` | există |

**Fișiere**
- `functions/index.js` — `AI_PRICES`, `aiCallCost`, `monthKey`, `logAiCall`, `aiBudgetBlocked`; `runAiJson`
  primește `{ feature, ctx: { uid, actor, clientUid, detail, surface } }`
- `src/analytics/aiCost.ts` — **NOU**, pur (zero importuri)
- `scripts/test-aicost.ts` — **NOU** · bloc `TEST AICOST` în `scripts/e2e-lp-serve.mjs` (paritate TS↔JS)
- `src/types/aiBudgetConfig.ts` — **NOU** (coercer pentru `appConfig/aiBudget`)
- `src/admin/HealthPanel.tsx`, `firestore.rules`, `scripts/test-rules.ts`, `src/i18n/locales/{ro,en}.ts`

**Forma datelor**
```
aiCalls/{autoId}          // colecție NOUĂ — NU în aiUsage (acolo HealthPanel citește documente FIXE)
  schema: 1
  feature, surface: 'operator'|'self'|'automation', model
  inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens
  costUsd                 // PREȚUIT LA SCRIERE (prețul nu se recalculează niciodată la citire)
  uid, actor (≤120), clientUid  // ★ tenantul, obligatoriu din felia 1
  detail (≤200), status, at
aiBudget/{YYYY-MM}        // rollup O(1) cu FieldValue.increment: costUsd, calls, tokens, alerted80, alerted100
appConfig/aiBudget        // { schema:1, monthlyUsd }  — 0 = fără plafon
```

**Reguli:** `aiCalls` și `aiBudget` = `read: isAdmin()`, `write: false`. `appConfig/aiBudget` intră sub blocul
`appConfig` existent.

**Pur + testabil:** `aiCallCost(model, usage)` (inclusiv `cacheRead × in × 0.1` și `cacheWrite × in × 1.25`) +
`summarizeAiCost(rows, from, to)` → `{ total, byFeature, bySurface, byActor, byClient, daily }`.

**Cade în `functions/index.js` (⇒ paritate testată obligatoriu):** tabelul de prețuri + `aiCallCost` duplicate de
mână (TS-ul nu se poate importa în JS-ul fără typecheck). `logAiCall` **nu aruncă niciodată** — jurnalizarea nu
are voie să strice funcția AI.

**Acceptare:** un apel real de fiecare tip (ok / refuz / trunchiat) produce trei rânduri cu `costUsd > 0`;
`aiBudget/{luna}.costUsd` egalează suma rândurilor la cent; cu `monthlyUsd` setat mic, al doilea apel e refuzat
cu `resource-exhausted` **înainte** de `messages.create`.

---

### B. Igienă de securitate publică *(cea mai ieftină felie din tot planul)*

**B1 — `clientIpHash` ia intrarea greșită.** `functions/index.js:4161` face
`String(req.headers['x-forwarded-for']).split(',')[0]` — adică **prima** intrare, care e complet controlată de
client. Oricine trimite `X-Forwarded-For: <valoare aleatoare>` primește o găleată de rate-limit nouă la fiecare
cerere, deci `SUBMIT_IP_DAILY_CAP` (30) și `TRACK_IP_DAILY_CAP` (1000) sunt **ocolibile integral**. Presto ia
ultima intrare, cu motivul scris în cod.

⚠️ **Nuanță pe care n-o luăm de-a gata de la Presto:** „ultima" nu e universal corect. În spatele
load-balancer-ului Google, IP-ul real e de regulă **penultima** intrare. Regula sigură e „numără din dreapta cu
numărul de proxy-uri de încredere", nu „ia stânga". Felia include **verificarea empirică** pe o cerere live
înainte de a fixa indexul (vezi §7 Q1).

**B2 — `handleTrack` n-are backstop pe slug.** `handleSubmit` are ambele plafoane (IP + slug, 4248), dar
`handleTrack` are doar `trk_ip_`. Cu B1 nereparat, beacon-urile sunt practic nelimitate.

**B3 — `errorReports` e creabil anonim.** `firestore.rules:685` permite `create` fără `request.auth != null`.
Un client poate umple colecția. Mutăm scrierea pe un callable rate-limitat (tiparul `logClientError` din Presto).

**Acceptare:** o suită care trimite 40 de cereri cu `X-Forwarded-For` diferit și verifică refuzul după plafon.

---

### C. `logServerError` + panou de erori operabil

24 de `logger.error` din `functions/index.js` ajung doar în Cloud Logging — invizibile pentru operator.
Adăugăm `logServerError(err, ctx)` care scrie în `errorReports` cu `source:'server'`, plus în panou: câmp
`resolved` (prin callable, fiindcă regulile au `update: false`) și grupare pe `name+message`.

**Acceptare:** o eroare provocată deliberat într-un callable apare în /admin în <10s, cu funcția și `clientUid`.

---

### D. Motor de retenție

DataRead nu are niciun mecanism de ștergere. Cresc nemărginit: `predictionLog`, `campaignInsightLog`, `visits`,
`submissions`, `abuseGuard` (accelerat de bug-ul B1), `errorReports`, `otps`, `adminAudit`.

Portăm forma din Presto (`pruneCollectionsCore` + `pruneOldTelemetry`, onSchedule 24h): buclă generică pe
inegalitate cu **un singur câmp** (deci fără index compus), batch-uri de 400, plafon 5000/colecție/rulare.
Doar harta `RETENTION` numește colecțiile noastre.

**Regula de aur, copiată literal din sursă:** *datele financiare nu se șterg NICIODATĂ* — `invoices`,
`invoiceCounters` și oglinzile lor nu intră în hartă, iar suita o verifică explicit.

**Acceptare:** test pur cu ceas fix care demonstrează că un document mai vechi decât pragul e planificat pentru
ștergere, unul mai nou nu, iar o colecție financiară nu apare niciodată în plan.

---

### E. plan → review → apply pe importul CSV de metrici

Azi `MarketingCenter.tsx:304-321` face `writeBatch` direct din browser în `campaigns/{id}/metrics/{date}`
(regulile 416-421 = doar `isAdmin()`, fără validare de conținut).

**Raza de explozie, verificată în cod:** `calibrateBenchmarks` (5659) citește `campaigns` **cross-tenant**
(`limit(5000)`, fără filtru de tenant) → scrie `benchmarkStats/{industrie}` → `buildL2Text` le injectează în
prompturile **tuturor** clienților. Deci un import greșit la un client deviază sfaturile AI pentru toți.

**Precizare de onestitate:** nu e o gaură de securitate (scrierea cere `isAdmin()`) — e **raza de explozie a
unei greșeli de operator**, amplificată cross-tenant. `metricNumCap` (1e12) oprește valorile absurde, dar nu pe
cele plauzibil-greșite (o virgulă mutată).

Adoptăm tiparul din motorul de conectori Presto (`functions/integrations/core/engine.js`, care „never names a
Presto collection or field"): callable care produce un **DiffPlan** (ce S-AR schimba), operatorul aprobă, abia
apoi se scrie — plus guards (praguri: „acest import schimbă cheltuiala lunii cu 340% — confirmi?").

**Acceptare:** un CSV cu o virgulă mutată produce un plan cu avertisment și **nu scrie nimic** până la aprobare.

---

## 4. Feliile adaptate (luăm forma, nu codul)

**F. Diagnoză activă (`runDiagnostics`).** HealthPanel arată azi 4 contoare. Forma din Presto e bună: o listă de
verificări care întorc `ok | warn | fail` cu un mesaj acționabil. Check-urile se scriu de la zero pentru DataRead
(secretele sunt setate? extensia Stripe răspunde? `EMAIL_ENABLED` vs. extensia instalată? câte campanii au
`clientUid` gol? ultima rulare a fiecărui `onSchedule`?).

**Notă:** aici intră și verificarea „flag-urile de platformă" — de-aia **respingem sistemul de feature-flags** ca
sistem separat (§5), dar păstrăm nevoia: o diagnoză care spune ce e pornit și ce nu.

**G. PanelGrid.** Cuplaj 0, cu o doctrină care merită copiată literal din regulile Presto:
> *„This is a PREFERENCE store, never a permission one. A block that is not placed is merely not drawn — the
> data behind it stays exactly as reachable, and the real gate remains requireAdmin/requireOwner server-side.
> Never build an access check on the absence of a block."*

Se adoptă **numai împreună** cu suitele care îl fac sigur (`test-panelcss`, `test-panellayout`). Aterizare:
`adminLayouts/{uid}`, read+write doar pentru propriul uid.

---

## 5. Ce rămâne în Presto și de ce

- **Modelul de magazin** (vitrină personalizabilă, retururi/rambursări, coduri de reducere, editare în masă,
  motor de rapoarte, curier/AWB, conector RMS): fără sens în DataRead. Din ele luăm **tiparele** din §2 al
  docului Presto (paritate blocată prin test, revendicare tranzacțională, ledger ca sursă de adevăr) — pe care
  DataRead le aplică deja.
- **Sisteme pe care DataRead le are deja, uneori mai bine:** constructor de formulare (9 tipuri vs. 7), PDF prin
  print, export CSV (al nostru are anti-formula-injection, al lor nu), prerender + SEO, monitorizare erori
  client, convenție de configurare (`schema:N` + coercer unic — e deja regulă în CLAUDE.md), harness de testare.
- **AI Center ca panou:** `aiUsageStore` face `onSnapshot` pe până la 5000 de documente și agregă pe client.
  Într-un magazin cu un singur tenant merge; la noi ar fi o regresie. Luăm **serverul** (ledger + poartă), nu UI-ul.
- **Feature-flags ca sistem:** DataRead are deja trei vocabulare de comutatoare (entitlement pe module, cele 10
  constante deploy-safe, `appConfig/*`). Al patrulea ar fi datorie, nu capabilitate. Nevoia reală („văd ce e
  pornit") se rezolvă în diagnoză (§4.F); dacă apare nevoia de a comuta **fără deploy**, se extinde `appConfig`.
- **Motor de alarme:** `automationEngine.ts` e un DSL real (declanșatoare → condiții → acțiuni, 8 operatori).
  Alarmele se exprimă ca reguli de automatizare, nu ca al treilea motor.
- **Customer 360 + identitate de device:** aici respingerea e **legală, nu tehnică**. `contact.ts` maschează PII
  deliberat (`emailMasked`/`phoneMasked` + hash per-tenant). Un profil 360 cu fingerprint ne-ar face
  **împuternicit pentru datele clienților clienților noștri** — DPIA, temei de prelucrare, contracte Art. 28.
  Nu intrăm acolo fără o decizie explicită de business.

---

## 6. Capcane de portare (concrete)

1. **Coliziune de nume `aiUsage`.** Există în AMBELE proiecte cu semantică OPUSĂ: la Presto e ledger (`.add()`),
   la noi contoare (`.doc(uid)`). Un port 1:1 ar amesteca rândurile cu contoarele, iar `HealthPanel.tsx:52-54`
   (care citește documente fixe) ar începe să vadă gunoi. → colecție nouă `aiCalls`.
2. **`functions/index.js` n-are typecheck.** Orice logică duplicată TS↔JS cere paritate testată în
   `e2e-lp-serve.mjs`. Precedent: `TEST INV`, `TEST X`, `TEST GND`.
3. **Presto = un tenant, DataRead = mulți.** Orice entitate portată primește `clientUid` **din felia 1**, nu
   „mai târziu". Adăugarea ulterioară cere migrare pe date deja scrise.
4. **Costul de citiri.** Presto își permite `onSnapshot` pe colecții întregi. La noi orice panou nou trece prin
   agregat + drill-down la cerere, nu prin abonament pe toată colecția.
5. **i18n obligatoriu.** Fiecare text nou → `t()` cu paritate ro/en (compilatorul o verifică prin `typeof ro`).
6. **Prețurile AI se schimbă.** Tabelul e în cod, iar costul se calculează **la scriere**. Un rând vechi nu se
   re-prețuiește niciodată — altfel istoricul s-ar rescrie retroactiv la fiecare schimbare de preț.

---

## 7. Ordinea de execuție

```
B (securitate, foarte mic)  ──►  independent, se poate livra azi
        │
        ▼
A (ledger AI, mediu)  ──►  C (erori server, mic)  ──►  D (retenție, mic)
        │                                                    │
        │                                                    ▼
        └────────────────────────────────►  F (diagnoză, mediu) ── are nevoie de A+C+D ca să aibă ce raporta
E (plan→apply CSV, mediu)   ──►  independent
G (PanelGrid, mediu)        ──►  ultimul; e confort, nu capabilitate
```

**Recomandarea mea:** B azi (e o oră și închide o gaură reală), apoi A ca felie mare următoare.
D și C sunt mici și se pot lipi de A. E și G pot aștepta.

---

## 8. Decizii care îți cer răspunsul

1. **`X-Forwarded-For`: ce index?** Presto ia ultima intrare; în spatele LB-ului Google e de regulă penultima.
   *Recomandarea mea:* verific empiric pe o cerere live la `/p/_track` și fixez indexul cu comentariul care
   explică alegerea. Nu copiez orbește.
2. **Punte de preview live (postMessage)** — 116 linii la sursă, jumătate există deja la noi. Ar da editorului de
   conținut (Felia B, livrată ieri) previzualizarea **ciornei**, nu doar a ce e publicat. *Recomandarea mea:* da,
   dar după A–D; e confort de operator, nu risc.
3. **Bibliotecă media** — azi operatorul **nu poate încărca o imagine** pentru o landing page (zero Storage în
   DataRead; doar URL-uri https lipite). E infrastructură nouă (bucket + `storage.rules` + cotă + costuri).
   *Recomandarea mea:* da, dar ca felie proprie decisă separat — e produs, nu igienă.
4. **Ghid randat din markdown + căutare BM25** — ar face ghidul editabil fără deploy și căutabil. Se suprapune
   parțial cu ce am livrat ieri (conținut editabil per-pagină). *Recomandarea mea:* amânăm până vedem dacă
   ghidul chiar se schimbă des.
5. **Rutare notificări pe email** — transportul EXISTĂ deja (`functions/index.js:5045`), gardat de
   `EMAIL_ENABLED = false`. Lipsește doar stratul „cine primește ce". Blocantul e al tău: extensia de email +
   autentificarea domeniului (SPF/DKIM/DMARC). *Recomandarea mea:* întâi pornește transportul, apoi discutăm
   stratul de destinatari.
