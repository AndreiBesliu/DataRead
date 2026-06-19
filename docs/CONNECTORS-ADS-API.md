# DataRead — Conectori Ads API (Meta / Google / alte platforme)

> Faza următoare a Marketing Center. Sistemul de analytics există deja și funcționează cu
> **introducere manuală** a datelor. Conectorii API descriși aici **scriu în EXACT același model
> de date**, deci nu schimbă nimic în dashboard — doar automatizează alimentarea cu date.

## Principiul (de ce nu blochează nimic)

Modelul de date e platform-agnostic și deja live:
- `campaigns/{campaignId}` — campanie (cu `leadId`, `platform`, `totals` denormalizate)
- `campaigns/{campaignId}/metrics/{YYYY-MM-DD}` — o zi de performanță (spend, impressions, clicks, leads, revenue, `source`)

Cheia documentului de metrică e **data** → scrierea unei zile e **idempotentă** (upsert). Un conector
care rulează zilnic și rescrie ultimele N zile nu creează duplicate. Câmpul `source` marchează
proveniența (`manual` acum; `meta`/`google`/`tiktok` când vine conectorul) — poți vedea ce e
introdus de om și ce de API.

Motorul de KPI (`src/analytics/kpi.ts`) calculează ROAS/CPL/CTR/CPC/CPM/conversie din metrici,
indiferent de sursă. Nimic nu se schimbă în UI când datele încep să vină din API.

## Arhitectura conectorului (Cloud Functions)

Un conector = un scheduled function (Cloud Scheduler, zilnic) care:
1. citește campaniile cu `platform == 'meta'` (sau google/…) și un `externalId` setat;
2. cheamă API-ul platformei pentru insights-urile pe ultimele ~7 zile (spend, impressions, clicks,
   conversions, revenue/conversion value);
3. face upsert pe `campaigns/{id}/metrics/{ziua}` cu `source: 'meta'`;
4. recalculează `totals` pe documentul campaniei (sau o face un trigger pe `metrics`).

Secțiunea e rezervată în `functions/index.js` lângă AI — aceeași structură (secret în Secret
Manager, regiune europe-central2). Token-urile NU ajung niciodată în client.

## Pașii lui Andrei (înainte de a putea construi conectorul)

### Meta (Facebook/Instagram) Ads
1. **Meta Business Manager** + **app de developer** (developers.facebook.com) — pornește DEVREME:
   verificarea de business durează **săptămâni**.
2. Permisiunea `ads_read` + acces la conturile de Ads ale clienților (System User token cu acces
   pe Business-ul clientului, sau OAuth per client).
3. Token-ul (long-lived / System User) → `firebase functions:secrets:set META_ADS_TOKEN`.
4. `externalId` pe fiecare campanie DataRead = ID-ul campaniei/contului din Meta.

### Google Ads
1. Cont **Google Ads API** + **developer token** (aprobare Google, poate dura).
2. OAuth client + refresh token pentru contul de manager (MCC).
3. Secretele → Secret Manager; `externalId` = ID campanie Google.

### Alte platforme (TikTok etc.)
Același tipar: token în Secret Manager + `externalId` pe campanie + un scheduled function care
mapează insights-urile platformei pe schema noastră de metrici.

## Ce e deja gata (nu mai trebuie făcut)
- Modelul de date multi-platformă + rules (admin-only)
- Motorul de KPI testat (ROAS/CPL/CTR/CPC/CPM/conversie)
- Panoul Marketing Center: agregat, filtre (platformă/status/căutare), drill-down per campanie,
  grafic, CSV (export + **import**), introducere/editare manuală a zilelor
- Câmpul `source` și upsert-ul pe dată — pregătite pentru scriere automată

---

## STARE IMPLEMENTARE (actualizat 2026-06-19)

### Felia 0 — LIVRATĂ (fără blocante externe)
- **`clientUid` denormalizat pe campanie** (`CampaignDef.clientUid`, `coerceToCampaign`) — leagă campania de
  contul clientului pentru regulile multi-tenant ȘI pentru jobul de ingestie. Scris la create (din lead) +
  ținut în sincron de triggerul **`onLeadWrite`** (când `leads/{id}.clientUid` se schimbă → propagă pe campaniile lead-ului).
- **Import CSV** în Marketing Center (`src/utils/metricsCsv.ts` — parser pur tolerant: alias-uri antet ro/en,
  delimitator `;`/`,`, numere ro/en, upsert pe dată, dată invalidă sărită). Operatorul exportă din Ads Manager → încarcă.
- **Plafon valoric** pe metrici (`MAX_METRIC_VALUE` în `coerceToDailyMetric`) — anti intrare absurdă / date corupte.
- **Schema credențiale** `clients/{uid}/platformCredentials/{platform}` (`src/types/platformCredentials.ts`) +
  reguli: **read admin-only, write false** (token-ul nu ajunge niciodată la client; scris doar de Admin SDK).

### Felia 1+ (Meta + Google Ads + TikTok) — COD SCRIS, DORMANT (flag PER PLATFORMĂ în `functions/index.js`)
Un SINGUR motor generic `runConnectorPull(db, { platform, fetchRows, encKey, ... })` servește toate platformele
(upsert `source:platform` idempotent pe dată, recalcul totals, `needs_reconnect` pe 400/401/403, izolare per tenant).
Flag-uri independente: `META_ENABLED` / `GOOGLE_ENABLED` / `TIKTOK_ENABLED` (toate `false`). Cu flag-ul pe `false`,
OAuth-ul + jobul acelei platforme **NU sunt exportate** → deploy-ul NU cere secretele ei (principiul #4). Activezi o
platformă independent (ex. Meta întâi, fără secretele Google/TikTok).

Partea PURĂ e mereu activă + testată (`scripts/test-connectors.ts` + e2e TEST U):
- `functions/connectors/meta.js` (`mapMetaInsight`/`mapMetaInsightsResponse`/`buildMetaInsightsUrl`)
- `functions/connectors/google.js` (`mapGoogleAdsRow` — **cost_micros/1e6** — /`mapGoogleAdsResponse`/`buildGoogleAdsQuery`)
- `functions/connectors/tiktok.js` (`mapTikTokRow`/`mapTikTokResponse`/`buildTikTokReportUrl`)
- `functions/lib/tokenCrypto.js` (AES-256-GCM), `runConnectorPull` + `runMetaPull`, `insightsWindow`.

Funcții dormante (gated per platformă): `initiate{Meta,Google,TikTok}OAuth` (callable admin), `{meta,google,tiktok}OAuthCallback`
(onRequest, redirect), `disconnectPlatform` (callable admin, comună), `pull{Meta,Google,TikTok}Insights` (`onSchedule`
zilnic 05:00 Europe/Bucharest, fereastră glisantă 7 zile). Token criptat AES-256-GCM (cheia master `TOKEN_ENC_KEY`).

### PAȘI DE ACTIVARE (Andrei) — per platformă, în ordinea Meta → Google → TikTok
**Comun (o singură dată):** `firebase functions:secrets:set TOKEN_ENC_KEY` (32 octeți, ex. `openssl rand -hex 32`.
⚠️ pierderea cheii = reconectarea tuturor clienților). Apoi rewrite-uri în `firebase.json` pentru callback-uri.

**Meta:** (1) Business Verification (săptămâni, pornește DEVREME); (2) app developers.facebook.com + App Review
`ads_read` (1–3 săpt; privacy policy + screencast); (3) secrete `META_APP_ID`/`META_APP_SECRET`; (4) rewrite
`/api/meta/callback`→`metaOAuthCallback`; (5) `META_ENABLED=true` → `npm run deploy:functions`.

**Google Ads:** (1) developer token Basic→Standard (review Google); (2) OAuth consent screen (scope `adwords`) +
secrete `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`/`GOOGLE_DEVELOPER_TOKEN`/`GOOGLE_LOGIN_CUSTOMER_ID`
(MCC, fără cratime); (3) rewrite `/api/google/callback`→`googleOAuthCallback`; (4) `GOOGLE_ENABLED=true` → deploy.

**TikTok:** (1) app TikTok for Business + app review + data-security review; (2) secrete `TIKTOK_APP_ID`/`TIKTOK_APP_SECRET`;
(3) rewrite `/api/tiktok/callback`→`tiktokOAuthCallback`; (4) `TIKTOK_ENABLED=true` → deploy.

**După activarea oricărei platforme:** adaugă UI-ul de conectare în /admin („Conectează contul {platformă} al
clientului") — callable-urile `initiate*OAuth` există dar sunt dormante până la flip, deci UI-ul se adaugă la activare.

### Note / rafinări pentru activare (din review-ul adversarial)
- **Model token Meta:** Meta nu dă refresh tokens clasice; long-lived user token ~60 zile. Pentru zero-reconectare
  evaluează **System User token** (nu expiră) — `runMetaPull` folosește orice token decriptat din credențială.
- **Selectarea contului:** callback-ul ia ACUM primul ad account (`/me/adaccounts`). Rafinare: lasă operatorul să
  aleagă contul + **confirmă numele contului** înainte de salvare (anti cross-tenant leak).
- **`totals` la scalare:** `runMetaPull` recalculează `totals` O(n) după upsert; la volume mari → trigger
  incremental `onDocumentWritten('campaigns/{id}/metrics/{date}')` cu delta before/after.
- **Conflict manual↔API pe aceeași zi:** upsert `source:'meta'` rescrie ziua. CSV-ul rămâne `source:'manual'`.
  De decis politica fină (avertizare operator / păstrare istoric) la activare.
- **Backfill istoric:** `pullMetaInsights` trage 7 zile; la prima conectare adaugă un job one-shot paginat pentru
  ultimele luni.
- **Timezone/monedă:** stocate per credențială (`accountTimezone`/`accountCurrency`); cheia zilei = data locală a
  contului. Multi-currency (curs istoric) = la primul client non-EUR.
