# DataRead — Pachete & Prețuri (oferta comercială)

> Sursă: Andrei, 11.06.2026 (definite împreună cu Ionuţ).
> Acest document alimentează pagina publică „Pachete & prețuri" și produsele Stripe.
> Decizia preț fix vs. interval + trial: vezi `../PROJECT_KICKOFF.md` §4.

## 📢 Pachet Start — 99–149 €/lună

Pentru firme mici care vor prezență online constantă.

**Include:**
- 6–10 postări AI/lună
- 4–6 imagini create cu AI
- 12 idei de conținut/lună
- optimizare profil Facebook / Instagram
- plan de conținut de bază
- programare postări
- raport lunar simplu

**Nu include:** reclame plătite, video AI, administrare campanii.

## 🚀 Pachet Growth — 299–499 €/lună

Pentru firme care vor lead-uri și promovare activă.

**Include:** tot din Pachet Start, plus:
- administrare reclame Meta (Facebook & Instagram)
- creare texte reclame
- audiențe și targeting
- monitorizare campanii
- raport performanță
- recomandări de optimizare AI
- 2–4 videoclipuri AI/lună
- conținut adaptat pentru oferte și promoții

**Obiectiv:** generare lead-uri, trafic pe site, creștere vizibilitate.

## 👑 Pachet Premium AI — 699–1.299 €/lună

Pentru companii care vor marketing aproape complet externalizat.

**Include:** tot din Pachet Growth, plus:
- 8–12 videoclipuri AI/lună
- strategii lunare personalizate
- analiză concurență
- audit marketing lunar
- dashboard performanță
- AI Assistant Marketing
- analiză rezultate campanii
- recomandări automate de optimizare
- planificare conținut pe 30 zile
- întâlnire lunară de strategie

**AI Assistant Marketing:** analizează performanța reclamelor, identifică reclamele câștigătoare,
propune texte noi, propune audiențe noi, sugerează creșteri/scăderi de buget, generează idei de
conținut.

## 💡 Upsell-uri (se pot vinde separat)

- 🎥 **Video AI Extra** — 5 videoclipuri AI suplimentare
- 🌐 **Website Landing Page** — pagină de prezentare pentru campanii
- 📸 **Shooting Foto/Video Real** — pentru firme care vor și conținut autentic
- 📈 **Google Ads Management** — administrare campanii Google Ads
- 🤖 **AI Chatbot Website** — chatbot pentru site-ul clientului

## Note tehnice (pentru implementare)

- Fiecare pachet devine un produs Stripe cu preț lunar recurent (test mode întâi).
- Cotele (postări/lună, video/lună, idei/lună) devin **entitlements** pe contul clientului,
  verificate server-side. Schema exactă se decide DUPĂ felia verticală (regula din kickoff).
- Upsell-urile pot fi afișate pe site din v1, dar cumpărarea lor self-serve NU e în v1
  (gardul de scope) — deocamdată „contactează-ne".
