# Verticala 3 — Sales Intelligence (tag pe site-ul clientului + chat AI)

**Pentru:** Andrei + Ionuţ. **Data:** 2026-08-07 (v2, după recenzie adversarială). **Regim:** document VIU.
**Punct de plecare:** briful obținut de Ionuţ de la ChatGPT („Build a complete SaaS MVP called DataRead —
AI-powered sales intelligence platform for ecommerce websites").
**Status:** aprobat ca **DIRECȚIE de investigat**. Construcția e condiționată de poarta din §0.

> **v2 — ce s-a schimbat față de prima versiune.** Am supus documentul unei recenzii adversariale pe trei lentile
> (business / cost tehnic / legal). A găsit **o premisă falsă scrisă de mine** (§4: „până acum prelucrăm datele
> clienților noștri" — fals, prelucrăm deja datele vizitatorilor lor), **o afirmație falsă despre propriul cod**
> (§3.2: „IP-ul e hashat și tranzitoriu" — e SHA-256 nesărat și persistat fără ștergere) și trei lipsuri
> structurale: concurență, economie unitară, poartă de validare. Toate sunt corectate mai jos.

---

## 0. Poarta de validare — condiția de start

Punctul de plecare al acestei verticale e un brief generat de un model de limbaj. **Niciun client n-a cerut-o.**
Un LLM scrie un brief entuziast pentru orice idee îi dai, inclusiv pentru idei pe care nu le vrea nimeni.

**V3.0 nu începe** până când **două magazine** acceptă în scris un pilot plătit (fie și 49 €/lună, discount de
fondator), pe baza unui demo — nu pe „ar fi interesant". Pentru conversația aia sunt necesare, în ordine:
poziționarea din §2.5, șablonul de DPA, și răspunsul scris la obiecția „am Clarity gratuit".

Dacă în **6 săptămâni** de discuții nu există două angajamente, verticala se închide și documentul rămâne ca
decizie consemnată. Motivul e concret: Verticala 1 și Verticala 2 sunt construite dar **nemonetizate**; al treilea
produs 70% gata nu ajută.

**Notă de vânzare:** DPA-ul e artefact de **vânzare**, nu de conformitate post-semnare — un merchant serios îl
cere înainte să lipească scriptul.

---

## 1. Concluzia, în trei propoziții

1. Briful descrie **alt produs**: în loc de „agenția lucrează pentru client", e „clientul pune un tag și noi îi
   analizăm vizitatorii".
2. **Nu e incompatibil** — `ModuleId = 'marketing' | 'crm' | 'sales' | 'chatbot'`, iar `sales` și `chatbot` sunt
   declarate și **nefolosite**. Aterizează ca a treia verticală, nu ca rescriere.
3. **Nu rescriem în Next.js** și **nu identificăm vizitatorii după IP** (§3).

---

## 2. Ce avem vs. ce cere briful

### ✅ Avem (nu se rescrie)
Autentificare + RBAC + audit · izolare multi-tenant (`clients/{uid}/**`) · abonamente Stripe **149/399/999 €**
(exact pragurile din brief) + add-on-uri multi-linie · beacon cu scroll/timp/CTA + atribuire UTM + A/B cu z-test ·
13 fluxuri AI · dashboard de analytics cu export · motor de teme complet (deci și estetica dark/glass/neon).

### ❌ Lipsește (asta e munca)

| Cerința | De ce nu e trivial |
|---|---|
| `<script src="dataread.js" data-site-id>` | Beacon-ul de azi e **injectat de noi** în paginile pe care le servim. Pe domeniu străin: entitate `sites/{siteId}`, verificarea proprietății domeniului, **CORS** (avem **zero** azi), cheie de ingestie |
| Identitate de vizitator + reveniri | Nu stocăm **niciun** identificator (`visits` = referrer/ua/device/țară/zi) |
| Terminal live | Avem rollup-uri **zilnice agregate**, nu flux de evenimente |
| Chat AI + `conversations` | Zero. Cea mai mare piesă |
| Scor de intenție | Zero |
| Gating pe modul | `hasModule()` există cu **0 call-site-uri** — V3 ar fi prima folosire |

**Precizare:** prețurile 149/399/999 coincid pentru că briful a plecat din contextul nostru. **Coincidența nu
validează prețul** — vezi §5.0.

---

## 2.5. Concurența — și de ce ne-ar alege cineva

Lipsea complet din v1. E singura întrebare care contează la prima întâlnire de vânzare.

| Produs | Preț | Ce face | Ce NU face |
|---|---|---|---|
| **Microsoft Clarity** | **gratuit, trafic nelimitat** | heatmaps, session replay, rezumate AI | nu știe nimic despre bugetul tău de reclame |
| **GA4** | gratuit | vizitatori noi vs. reveniți, surse, funnels | idem |
| Hotjar | ~32–80 €/lună | heatmaps, replay, sondaje | idem |
| Plausible | ~9–19 €/lună | analytics simplu, fără cookie-uri | fără identitate, fără chat |
| Leadfeeder / Albacross | ~99–300 €/lună | IP→firmă (B2B) | doar B2B; nu merge pe ecommerce B2C |
| Tidio / Intercom | ~30–100 €/lună | chat live + boți | nu leagă conversația de cheltuiala pe ads |

**Obiecția care trebuie să aibă răspuns scris:** *„De ce plătesc 149 € pentru ce am gratis în Clarity?"*

**Singurul nostru avantaj real (moat-ul):** noi deținem deja campaniile, cheltuiala pe reclame, contactele și
predicțiile clientului (`campaigns`, `metrics`, `contacts`, `leadPredictions`). Niciun produs gratuit nu poate lega
**„am cheltuit 800 € pe Meta"** de **„omul ăsta a revenit de 3 ori și n-a cumpărat"**. Nu vindem analytics —
vindem **închiderea buclei buget → comportament → lead**.

⚠️ **Dacă propoziția asta nu se poate susține în fața unui merchant, verticala nu are moat și nu merită construită.**
De testat în conversațiile din §0, înainte de orice cod.

---

## 3. Cele două devieri de la brief

**3.1 Nu rescriem în Next.js.** Ne-ar da ce avem deja (SSR prin prerender + `serveLp`), cu prețul aruncării a ~50
de felii livrate și funcționale. Estetica cerută e CSS + componente, nu framework.

**3.2 Nu identificăm după IP.** Două motive independente:
- **IP-ul minte.** CGNAT pe mobil, un birou întreg pe un IP, VPN-uri. „A revenit de 40 de ori" = 40 de oameni.
- **E dată cu caracter personal** (§4).

**Corecție la v1:** scrisesem că „IP-ul rămâne folosit doar tranzitoriu și hashat, cum îl folosim deja". **Fals în
ambii termeni.** Azi `clientIpHash` e **SHA-256 nesărat** (spațiul IPv4 = 2³², reversibil prin forță brută în
secunde) și e **persistat pe zile fără ștergere** în `abuseGuard`. E pseudonimizare, nu anonimizare, și nu e
tranzitoriu. Reparație în §4.0.

**Ce facem în schimb:** identificator **first-party**, pus **după consimțământ**. ⚠️ Limitare de acceptat din
start: Safari/ITP plafonează cookie-urile puse din JS la **7 zile**, deci „a revenit după 3 săptămâni" nu se poate
măsura pe Safari. Se declară în produs, nu se ascunde.

---

## 4. Legal

> Nu sunt jurist. Punctele ⚖️ cer confirmarea unui avocat înainte de lansare comercială.

**Ce se schimbă față de azi — și ce NU se schimbă.** Contrar a ce am scris în v1, **prelucrăm deja datele
vizitatorilor clienților noștri**: pe `/p/{slug}` scriem PII brut în `submissions` (valorile formularului + `ua` +
`referrer`), telemetrie în `visits` (`ua`, `referrer`, device, țară), setăm server-side cookie-ul A/B `lpab_` fără
niciun semnal de consimțământ, și injectăm beacon-ul `/p/_track` necondiționat. Suntem **deja împuternicit**, fără
DPA, fără notă de informare pe acele pagini, fără retenție. Tagul nu schimbă **natura** relației — îi schimbă
**scara** și adaugă un **identificator persistent**.

### 4.0 Ce e neconform ASTĂZI (independent de V3)

Nu e datorie a verticalei 3. E datorie a produsului live, cu termen propriu.

| Restanță | Dovada | Reparație |
|---|---|---|
| Politica de confidențialitate + Termeni = **placeholder DRAFT pe LIVE**, în timp ce `/start` colectează nume/email/telefon | `src/i18n/locales/ro.ts` (`legal.privacyBody`) | Notă art. 13 reală, cu operatorul identificat (denumire, CUI, sediu). **Fără entitate juridică identificată nu se poate semna niciun DPA** |
| DPA art. 28 cu clienții pentru LP-urile deja servite | — | Șablon semnat, înainte de V3 |
| Cookie `lpab_` fără consimțământ | `functions/index.js:4607` | A/B nu e „strict necesar"; ori intră sub consimțământ, ori renunțăm la stickiness pe cookie |
| Zero retenție (`submissions`, `visits`, `abuseGuard`) | grep TTL = 0 | Motorul de retenție (`PLAN-SISTEME-NATIVE` §3.D) devine scadent **acum** |
| `clientIpHash` SHA-256 nesărat, persistat | `functions/index.js` | HMAC cu sare rotită + TTL pe `abuseGuard` |
| Banner: „Accept" = primary, „Refuz" = secundar; alegerea nu se poate revizui | `SiteLayout.tsx:138-139` | Butoane egale vizual + link permanent „Setări cookie" |

### 4.1 Ce adaugă V3
⚖️ DPA art. 28 cu fiecare client · ⚖️ DPIA (monitorizare sistematică) · respectarea semnalului de consimțământ de
pe site-ul clientului · drepturile persoanei vizate (ID căutabil, ștergere executabilă) · minimizare (fără PII în
evenimente, fără captură de conținut din formulare) · ⚖️ transferuri internaționale (Firebase = Google).

**Realitate comercială de acceptat:** dacă majoritatea vizitatorilor refuză cookie-urile, produsul măsoară o
minoritate. Asta trebuie spus clientului **înainte**, nu descoperit după.

---

## 5. Planul pe felii

### 5.0 Economia unitară — se completează ÎNAINTE de V3.0

Nu ne angajăm la un preț fără cifrele astea. Pe un magazin de **30k vizite/lună** (ICP realist, nu 500k):

- **Ingestia nu e problema.** Copiind modelul LP ies ~6 scrieri + ~3 citiri per pageview → sub 1 €/lună.
  *(Corecție: afirmația din v1 că „500k vizite pot costa mai mult decât încasarea" e falsă pe ingestie.)*
- **Agregarea la citire e problema ascunsă.** O histogramă de reveniri construită greșit (citind fiecare document
  `visitors`) costă zeci de € **per client, pentru un singur grafic**. Se rezolvă cu contoare pre-agregate.
- **Chatul AI e singurul cost care poate depăși abonamentul.** La 1–2% angajare = 300–600 conversații × ~6 replici
  ≈ 2–4k apeluri, fiecare cărând blocul de persona (~4,5k tokeni). Pe clasa Opus, la preț de listă, depășește
  149 € **doar din chat**, la un singur client.
- **Concluzie:** pragul de trafic protejează ingestia; **plafonul în EURO pe tokeni** protejează restul. Două
  pârghii diferite.

⚠️ **Precondiție absolută:** ledgerul de cost AI (`PLAN-SISTEME-NATIVE` §3.A). Azi `runAiJson` întoarce `usage`
și îl **aruncă** — nu putem măsura costul AI-ului pe care îl vindem **deja**. Se face **înaintea oricărei felii**,
pentru că fără el §5.0 nu se poate completa.

### Ordinea feliilor — felie verticală subțire, nu straturi

Recenzia a avut dreptate: v1 punea valoarea pentru client abia în felia 4–5. Cu 4 felii construite și nimic
vandabil, nu mai poți opri rațional proiectul. Ordinea corectată:

**V3.1 — Prima felie vandabilă: tag + o regulă + o alertă**
Tag minim (un tip de eveniment) + `sites/{siteId}` cu domeniu verificat + CORS + consimțământ + retenție + **o
singură regulă explicabilă de intenție** + **o alertă către merchant**. Dashboard = un tabel urât, deliberat.
**Criteriu de acceptare: merchantul a deschis alerta și a făcut ceva** — nu „contorul crește".

**V3.2 — Vizitatori & reveniri** *(ce a cerut Ionuţ explicit)*
`visitors/{visitorId}` cu contoare pre-agregate; „X noi / Y reveniți"; distribuția reveniilor.

**V3.3 — Mai multe reguli de intenție** (coș atins fără finalizare, produs revăzut, sesiune lungă fără acțiune).
Reguli explicabile, **nu AI** — un scor trebuie explicat clientului, iar regulile sunt gratuite și deterministe.

**V3.4 — Dashboard-ul premium + terminalul live**
Setul de componente în stilul cerut + tab „DataRead SaaS" în /admin. **Polish de demo, după prima încasare.**
Terminalul live pe fereastră mărginită, nu `onSnapshot` pe colecție.

**V3.5 — Chat AI** — cea mai mare felie. Precondiții: ledgerul de cost + decizia de la §7.5.

**V3.6 — Împachetare comercială** — `sales`/`chatbot` devin module reale (prima folosire a lui `hasModule`).

---

## 6. Ce NU facem

Rescriere în Next.js · identificare după IP · fingerprinting (decizie separată, DPIA proprie, implicit OFF) ·
session replay/heatmaps (sunt produsul din `project_own_behaviour_analytics`, de vândut separat; replay-ul cere
plafon de stocare propriu) · captura conținutului din formulare.

---

## 7. Decizii de luat

1. **Trecem sau nu de poarta din §0?** Totul depinde de asta.
2. **Cine e clientul?** Clienții noștri actuali (add-on) sau segment nou? Schimbă onboarding-ul și prețul.
3. **Restanțele din §4.0** — le reparăm acum, independent de V3? *(Recomandarea mea: da. Sunt scadente oricum.)*
4. ⚖️ **Avocat pentru nota de informare + DPA** — înainte de primul client real.
5. **Nivelul de model pentru chatul public** — decizie de **preț**, nu de inginerie, luată înainte de a scrie
   widgetul. *Poziția mea: clasa Haiku + bloc de sistem propriu, mic. Opus rămâne pentru operator, nu pentru
   vizitatorul anonim al unui magazin.*

---

## 8. Legături

`docs/PLAN-SISTEME-NATIVE.md` (ledger AI + retenție = precondiții) · `docs/PLAN-MAGAZINE-ONLINE.md` (axă
complementară) · `CLAUDE.md` (principiile platformei).
