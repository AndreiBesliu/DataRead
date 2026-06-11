# DataRead — Kickoff Brief

> Completat 10.06.2026 (Andrei + Claude), pe baza specificației lui Ionuţ
> ([docs/SPEC-arhitectura-Ionut-2026-06-10.md](docs/SPEC-arhitectura-Ionut-2026-06-10.md)).
> Acesta e contractul de scope al v1. Regulile de aici devin reguli hard în CLAUDE.md la scaffold.

## 1. Produs — paragraful care supraviețuiește tuturor pivotărilor

- **Ce este (consolidat 11.06.2026):** platformă SaaS B2B **multi-tenant** — un „business
  operating system" pentru firme mici și mijlocii din România. NU agenție de marketing, NU tool
  singular: platformă extensibilă, cu module/produse adăugate în timp (verticala 1 = Marketing AI,
  verticala 2 = Lansare Soft). Operatori: Andrei + Ionuţ. Principiile arhitecturale: CLAUDE.md.
- **Bucla de bază v1:** vizitator → landing → pachete & prețuri → formular onboarding → plată
  abonament (Stripe) → cont client creat → noi livrăm marketingul (inițial semi-manual, cu AI ca
  unealtă internă).
- **Succes v1 =** un client străin de noi parcurge singur: descoperă site-ul → alege pachet →
  plătește → completează onboarding-ul → avem toate datele ca să-i livrăm prima campanie.

## 2. Explicit NU în v1 (gardul de scope — se parchează în backlog fără discuție)

- Meta Ads API / Google Ads API (creare automată de campanii) — Faza 3 din spec
- Tracking pixel + ingestie analytics + AI Optimization automat — Faza 3
- Modulul Lansare Soft: CRM complet, facturi clienți, risk scoring, AI collections
  (email/SMS/WhatsApp) — Faza 4
- Content Planner / postări automate pe social media
- Dashboard client cu rezultate live de campanii (în v1 clientul vede doar statusul
  onboarding/abonament)
- AI Creative Studio expus clienților — AI-ul e întâi unealtă INTERNĂ (felia 2)
- Alte limbi peste ro + en

## 3. Platformă & stack

- **Platformă primară MVP:** web (site public + aplicație SPA)
- **Platforme ulterioare:** nedecis, nimic promis
- **Stack (decis 10.06.2026):** React + TS + Vite + Zustand + Firebase
  (Auth / Firestore / Functions / Hosting) — stack-ul dovedit pe CNCVS/OurDays; harness-ul de
  teste, CI, deploy și error reporting se portează din ziua 1.
  - Deviere asumată de la recomandarea lui Ionuţ (Next.js + NestJS + PostgreSQL + Redis).
    Motiv: viteză la MVP, zero servere de administrat, cost ~0 la început.
  - Mapare pe spec: „backend" = Cloud Functions; coada de taskuri AI = Cloud Tasks;
    raportare grea mai târziu = export Firestore → BigQuery, dacă devine nevoie.
  - SEO pentru site-ul public: pagini statice/prerenderizate pe Firebase Hosting —
    landing-ul nu depinde de JS ca să se indexeze.
- **AI layer (felia 2+):** Claude API apelat DOAR din Cloud Functions — principiul din spec:
  AI e un serviciu apelat din backend, niciodată direct din client.
- **Arhitectură de platformă (consolidat 11.06.2026):** backend central prin care trece TOT
  (Functions + Stripe + entitlements + admin); module independente cu feature flags pe abonamente
  (`modules` în `src/config/packages.ts`); izolare multi-tenant (`clients/{uid}/**`, owner-only,
  admin prin claim); integrările externe sunt opționale, nu dependențe critice.

## 4. Model de business

- **Plătit, abonamente self-serve prin Stripe DIN V1** (decis 10.06.2026).
- **3 pachete + upsell-uri** (definite 11.06.2026 — detalii în
  [docs/PACHETE-SI-PRETURI.md](docs/PACHETE-SI-PRETURI.md)):
  Start 99–149 €/lună · Growth 299–499 €/lună · Premium AI 699–1.299 €/lună.
- **Preț fix de listă per pachet** (decis 11.06.2026) — checkout direct de pe site. Provizoriu,
  până confirmați cifrele finale: Start 149 €, Growth 399 €, Premium AI 999 € (Stripe test mode).
- Upsell-urile se afișează pe site, dar în v1 se vând doar prin „contactează-ne".
- **Gating:** entitlements verificate server-side din start — statusul abonamentului (scris în
  Firestore de webhook-urile Stripe prin Functions) e verificat de Firestore rules + Functions;
  clientul nu decide niciodată singur ce acces are.
- **Trial: fără trial** (decis 11.06.2026) — plata începe de la abonare; eventuala garanție de
  rambursare se gestionează manual, fără complexitate tehnică în v1.

## 5. Invarianți din ziua 1 (toți activi)

- **Limbi:** ro + en de la primul string — ro e limba primară, paritatea forțată prin
  `en: typeof ro`. TOT textul user-facing prin `t()`, niciodată hardcodat.
- Orice dată persistată (localStorage, documente Firestore) poartă **versiune de schemă** și se
  încarcă printr-O SINGURĂ funcție normalise/migrate — toate căile de încărcare, inclusiv
  drafts/cache-uri. (Lecția incidentului „app won't load" din CNCVS.)
- **Observabilitate din ziua 1:** ErrorBoundary cu text de eroare vizibil + „Reset app data",
  crash reports cu consimțământ, build hash ștampilat la boot — portate din CNCVS, nu reconstruite.
- **Harness de teste** (`npm test`, suite headless esbuild) + CI + boot-smoke de producție vs
  profile otrăvite — configurate în sesiunea 1, înainte de orice feature.
- **Secretele NU se lipesc niciodată în chat:** `.env.local` (config client) sau Secret Manager
  (secrete server: Stripe secret key, cheia Anthropic), puse de Andrei; Claude referă doar numele.

## 6. Reguli de lucru (setul dovedit)

- **Limba de lucru pe acest proiect: ROMÂNA** — conversație și documente de proiect.
- **Sync workflow:** după fiecare task încheiat — build, deploy, commit, push, fără confirmare.
- **DEVLOG.md Session Log:** intrări Task Started/Completed cu atribuirea modelului AI.
- Regulile + faptele stabile de proiect stau în **CLAUDE.md** (auto-încărcat în fiecare sesiune),
  nu îngropate în DEVLOG. DEVLOG rămâne log append-only + roadmap.
- Feature-urile multi-file încep în **plan mode**; alegerile vin înapoi ca meniuri scurte de opțiuni.
- O **felie verticală** a buclei de bază se livrează și se FOLOSEȘTE înainte de blocarea oricărui
  model de date. Angajamente de schemă doar după ce felia se simte bine.

## 7. Checklist setup owner (săptămâna 1 — blochează lansarea mai târziu)

- [ ] Proiect Firebase creat (nume sugerat: dataread, regiune: europe-west)
- [x] Nume comercial: **DataRead** (decis 11.06.2026) · [ ] domeniu de cumpărat (dataread.ro?)
- [ ] Cont Stripe — test mode acum; live cere: entitate legală, cont bancar, verificare
- [ ] Confirmarea cifrelor finale de listă (provizoriu 149 / 399 / 999 €) — pachetele definite
      în docs/PACHETE-SI-PRETURI.md
- [ ] Email tranzacțional (Resend / Sendgrid / Mailgun) pentru confirmări onboarding/plată
- [ ] Entitate legală (SRL): nume / adresă / jurisdicție pentru ToS / Privacy / facturare
- [ ] Cheie API Anthropic (pentru felia 2 — AI intern) — predată via Secret Manager
- [ ] Meta Business Manager + app de developer pornite DEVREME — necesare abia în Faza 3,
      dar verificarea de business la Meta durează săptămâni

## 8. Checklist lansare v1 (ce înseamnă „gata")

- [ ] Bucla core merge cap-coadă pentru un străin: landing → pachet → plată → onboarding → cont
- [ ] Plăți live + gating de entitlements verificat (inclusiv: abonament expirat → acces închis)
- [ ] Pagini legale reale, fără placeholder (ToS, Privacy/GDPR — colectăm date de firme din UE)
- [ ] Crash reporting + flux de consimțământ pentru analytics
- [ ] Emailuri tranzacționale funcționale (confirmare plată, confirmare onboarding)

## 9. Întrebări deschise / necunoscute

*(Rezolvate 11.06.2026: numele comercial = DataRead; pachetele = docs/PACHETE-SI-PRETURI.md,
preț fix de listă; fără trial.)*

- Cifrele finale de listă per pachet (provizoriu 149 / 399 / 999 €).
- Domeniul — dataread.ro e liber?
- Ce vede clientul în dashboard imediat după plată, până există livrabile?
- **Facturare RO:** Stripe acoperă plata, dar B2B în România implică e-Factura (ANAF) — de
  verificat înainte de live; relevant și pentru modulul Lansare Soft de mai târziu (facturile
  clienților NOȘTRI către clienții lor).
- Cine operează marketingul livrat în primele luni (noi, cu AI-ul intern din felia 2)?
