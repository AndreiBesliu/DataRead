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
  grafic, CSV, introducere/editare manuală a zilelor
- Câmpul `source` și upsert-ul pe dată — pregătite pentru scriere automată
