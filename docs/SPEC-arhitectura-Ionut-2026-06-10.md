# DataRead — Specificația de arhitectură (de la Ionuţ)

> Sursă: mesaje WhatsApp de la Ionuţ, 10.06.2026, 21:07–21:10.
> Acesta este documentul de pornire al proiectului, păstrat ca referință.
> Deciziile efective de stack și scope sunt în `../PROJECT_KICKOFF.md` (și ulterior în `CLAUDE.md`).

---

## Mesajul 1 — Arhitectura completă (Soft Marketing + Lansare Soft)

### 1. Frontend (site public) — asta vede clientul

Pagini:
- 🏠 Landing page (prezentare firmă)
- 💰 Pachete & prețuri
- 📋 Formular onboarding client
- 📊 Login client (dashboard basic)
- 📞 Contact / vânzare

Ce face frontend-ul: atrage clienți, colectează date, arată servicii, arată rezultate (mai târziu).

❌ NU face logică. ❌ NU are AI. ❌ NU are API-uri.

### 2. Backend (creierul sistemului) — aici este tot businessul

Module backend:
- **Client Management** — conturi clienți, date firmă, status abonament
- **Marketing Engine (Soft Marketing)** — generează: reclame, postări, video scripturi, campanii; stochează rezultate
- **Ads Manager Layer** — conectare Meta Ads API, Google Ads API (mai târziu); creare campanii, citire rezultate
- **Analytics Engine** — ROAS, CPL, lead-uri, conversii
- **AI Layer (Claude / OpenAI)** — AI folosit ca strateg, copywriter, analist.
  Ex: „generează 10 ads pentru client X", „analizează campania Y", „optimizează buget"
- **Lansare Soft Module (mai târziu)** — facturi, clienți, scoring, recuperare creanțe, notificări automate

### 3. Flux complet

```
CLIENT → WEBSITE (form + login) → BACKEND (core system) → AI ENGINE (Claude/GPT)
       → BACKEND PROCESSING → META/GOOGLE ADS API → TRACKING (Pixel/Analytics)
       → BACKEND (analiză) → AI (optimizare) → DASHBOARD CLIENT
```

### 4. Cum lucrează AI în sistem

AI NU este separat — este integrat în backend. Se folosește pentru:
1. **Generare marketing** — reclame, texte, video scripts
2. **Analiză performanță** — ce campanie merge, ce nu merge
3. **Decizii** — scale / stop / test
4. **Planificare conținut** — calendar 30 zile, idei postări

### 5. Concret (tehnic simplu)

Backend endpoints: `/generate-campaign`, `/create-ads`, `/analyze-performance`, `/optimize-budget`, `/generate-content`

AI call (exemplu logic) — Backend → AI: „Client: presto.ro, buget 500€, generează 3 campanii și 10 ads" → AI răspunde: structuri campanii, texte, audiențe.

Meta API — Backend → Meta: creează campanie, setează buget, adaugă reclame.

Tracking — Pixel trimite date, backend le colectează, AI le analizează.

### 6. Admin panel (dashboard intern)

- 👤 **Clienți** — listă firme, status, bugete
- 📢 **Campanii** — active, performanță, ROAS
- 🤖 **AI Assistant** — „generează ads", „optimizează campanii", „creează strategie"
- 📊 **Analytics** — rapoarte, comparări
- 🔗 **Integrations** — Meta API, Google Ads API, Pixel, CRM (mai târziu)

### 7. Important (realitate business)

❌ NU începe cu: full automation, API-uri peste tot, AI complet autonom.
✔️ Începe cu: site + formular, AI manual / semi-auto, ads manual, backend simplu.

### 8. Ordinea corectă de construcție

- 🟢 **Faza 1** (1–2 săptămâni): site, formular, AI generează ads manual
- 🟡 **Faza 2**: backend simplu, dashboard intern, AI API integrat
- 🔴 **Faza 3**: Meta API, tracking, optimizare automată
- ⚫ **Faza 4 (Lansare Soft)**: CRM complet, scoring, recuperare creanțe, automatizări business

Concluzie: 1 site = intrare; backend = creierul sistemului; AI = motor de decizie și creare; API-uri = execuție (Meta/Google).

---

## Mesajul 2 — Structura generală (un singur produs, 2 module)

Nu sunt două aplicații separate: **1 platformă SaaS, 2 module mari în interior**.

### Dashboard principal (după login)

- 🟦 **Home Dashboard** — overview general, bani cheltuiți / rezultate, notificări AI
- 🔘 2 butoane principale: **📢 Soft Marketing** și **🧾 Lansare Soft**

### Modul 1: Soft Marketing

1. **Campaign Builder (AI + manual)** — creezi campanii; AI generează ads, audiențe, bugete recomandate
2. **Ads Manager (Meta / Google)** — conectare API Meta Ads, Google Ads; vezi campanii live
3. **AI Creative Studio** — reclame texte, video scripts, postări social media, idei campanii
4. **Analytics** — ROAS, CPL, conversii, comparații campanii
5. **Optimization Panel** (foarte important) — AI spune: ❌ oprește campania X, ✔️ scalează campania Y, 🔁 testează variantă nouă
6. **Content Planner** — calendar postări, idei video, plan 30 zile

### Modul 2: Lansare Soft (CRM + business automation)

Tot ce NU e marketing:

1. **Client Management (CRM simplu)** — listă clienți firmă, status, date contact
2. **Facturi & plăți** — facturi generate, status plătit/întârziat, abonamente active
3. **Risk Scoring** (foarte important) — AI analizează cine plătește la timp / întârzie / nu plătește → scor client 0–100, risc neplată
4. **AI Collections (recuperare creanțe)** — email automat, SMS reminder, mesaje WhatsApp.
   Ex: „Factura dvs. este întârziată, vă rugăm achitați"
5. **Client Activity Log** — câte mesaje/emailuri a primit clientul, istoricul interacțiunilor
6. **AI Business Assistant** — recomandări, detectează clienți problemă, sugerează acțiuni.
   Ex: „Client X are risc mare de neplată, trimite ofertă de reactivare"

### Legătura între cele 2 module

📢 Marketing produce lead-uri și clienți → 🧾 Lansare Soft îi transformă în clienți reali, îi facturează, îi urmărește.

### Backend-ul (un singur backend)

1. **Auth System** — login admin / client
2. **Client DB** — toate firmele
3. **Marketing Engine** — AI + ads + analytics
4. **CRM Engine** — facturi, plăți, status
5. **AI Layer (central)** — toate cererile AI trec pe aici
6. **Integrations Layer** — Meta Ads API, Google Ads API, SMS API, Email API, WhatsApp API

### Flow complet sistem

```
USER LOGIN → DASHBOARD
   ├─ MARKETING     → ADS API        → TRACKING
   ├─ LANSARE SOFT  → CRM + FACTURI  → SMS/EMAIL
   └─ AI CORE       → ANALIZĂ        → OPTIMIZARE
                    (AI LOOP peste toate)
```

Ideea importantă: **un sistem unic cu 2 module**, nu 2 softuri. Clientul NU vede complexitatea — vede un dashboard simplu: Marketing, Facturi/CRM, Rezultate.

---

## Mesajul 3 — Specificație produs „Soft Marketing + Lansare Soft"

### 1. Viziune generală

Platformă SaaS B2B cu 2 module integrate: 📢 Soft Marketing (AI + Ads + content + analytics) și 🧾 Lansare Soft (CRM + facturare + colectare + risc clienți). Un singur sistem, un singur login, două zone funcționale.

### 2. Arhitectură generală — stack recomandat (de Ionuţ)

- Frontend: Next.js (React)
- Backend: Node.js (Express / NestJS)
- DB: PostgreSQL
- AI: OpenAI / Claude API
- Queue system: Redis (pentru taskuri AI)
- Integrations: Meta Ads API, Google Ads API, Email API (Sendgrid/Mailgun), SMS API, WhatsApp API (opțional)

> NOTĂ: decizia finală de stack se ia în PROJECT_KICKOFF.md — vezi acolo alternativa Firebase (stack-ul dovedit pe CNCVS/OurDays) și motivele.

### 3. Login & user system

Tipuri utilizatori: **Admin** (noi) și **Client** (companii). Flow: signup/login → onboarding company → acces dashboard.

### 4. Dashboard principal

Overview: venituri / lead-uri, campanii active, facturi restante, sugestii AI. Plus cele 2 module principale.

### 5. Modul Soft Marketing

- **5.1 Campaign Builder (AI + manual)** — input: obiectiv, buget, industrie; AI generează structuri campanii, audiențe recomandate, bugete distribuite
- **5.2 AI Creative Studio** — generare ads texte, headline-uri, descrieri, video scripts, idei campanii; output 5–10 variante per campanie
- **5.3 Ads Management (Integrations)** — Meta Ads API + Google Ads API: creare campanii, ad sets, ads, setare bugete. IMPORTANT: inițial semi-manual (approve required)
- **5.4 Analytics Engine** — date: impressions, clicks, spend, leads, conversions; metrici: CPL, ROAS, CTR, cost per conversion
- **5.5 AI Optimization Engine** — AI primește date și răspunde: ce funcționează, ce trebuie oprit, ce trebuie scalat, ce teste noi.
  Ex: „Campania A are CPL mai mic cu 40%. Scalează bugetul."
- **5.6 Content Planner** — calendar postări, idei social media, plan 30 zile, postări automate (opțional)

### 6. Modul Lansare Soft (CRM + business ops)

- **6.1 CRM (Client Management)** — listă clienți, detalii firmă, contact, status
- **6.2 Invoice & Payments** — creare facturi; status paid / pending / overdue; abonamente recurente
- **6.3 Risk Scoring AI** — analizează istoricul plăților, întârzieri, comportament → scor 0–100, risc neplată. Ex: „Client X: risc 78%"
- **6.4 Collections Automation (AI)** — email reminder, SMS reminder, WhatsApp follow-up.
  Ex: „Factura dvs. este scadentă. Vă rugăm să achitați."
- **6.5 Client Activity Log** — emailuri trimise, SMS-uri, interacțiuni, status plăți
- **6.6 AI Business Assistant** — analist financiar + operator CRM: detectare clienți problemă, recomandări acțiuni, automatizări follow-up

### 7. Legătura între module

Soft Marketing generează lead-uri și clienți → Lansare Soft îi transformă în clienți reali, îi facturează, îi urmărește → AI optimizează marketingul și cashflow-ul.

### 8. AI Layer (sistem central)

- Marketing: ads copy, strategie, analiză campanii
- CRM: risc scoring, mesaje follow-up, analiză clienți
- Business: recomandări, automatizări

### 9. Backend endpoints (exemplu)

```
POST /client/create
POST /campaign/generate
POST /ads/create
POST /ads/analyze
POST /crm/invoice/create
POST /crm/risk-score
POST /ai/generate
POST /ai/optimize
```

### 10. Principiu cheie

**AI nu acționează singur. AI este un serviciu apelat din backend.**

### 11. MVP strategy

- **Faza 1**: dashboard simplu, AI generate ads manual, CRM basic
- **Faza 2**: Meta Ads API, analytics, semi-automation
- **Faza 3**: full SaaS automation

### Concluzie

Un singur sistem cu: 🌐 frontend (client), 🧠 backend (logică + AI), 📢 modul marketing, 🧾 modul CRM, 🤖 AI layer central, 🔗 API integrations.
