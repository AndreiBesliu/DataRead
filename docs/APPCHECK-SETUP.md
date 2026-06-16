# App Check (reCAPTCHA v3) — setup & enforcement

Protejează callable-urile AI client-facing (`selfGenerateStrategy`, `selfGenerateDetails`) și scrierile
publice de boți/account-farming. App Check atestă APLICAȚIA (nu utilizatorul), deci formularele anonime
(ex. `/start` → `leads`) continuă să funcționeze din site-ul nostru.

## Stare curentă (2026-06-16)
- ✅ Cheie reCAPTCHA v3 creată; **Site key public** = `6Le0KSMtAAAAAGz_vqk_Sp4Ork6XpkcvIHIbffiS`
  (legată de `dataread.ro`, `dataread-e1bd6.web.app`, `dataread-e1bd6.firebaseapp.com`, `localhost`).
- ✅ `VITE_RECAPTCHA_V3_KEY` setat (`.env.local` + `.env.example`); clientul inițializează App Check
  (`src/firebase.ts`) — **dar sare init-ul sub automatizare** (`navigator.webdriver`) ca să nu spargă
  prerender/boot-smoke (Playwright). Deployat → clientul real trimite token-uri App Check.
- ⏳ **Enforcement = ÎNCĂ OPRIT** (mod Monitor). Nimic nu e blocat încă.

## Pași rămași (în ordine — NU enforce înainte de monitor)
1. **Monitor** (Andrei): Firebase Console → App Check → https://console.firebase.google.com/project/dataread-e1bd6/appcheck
   - Verifică în tab-ul principal că apar **„verified requests"** după ce intri pe dataread.ro și folosești
     Self Marketing. Lasă **APIs → Cloud Functions / Cloud Firestore** pe **Unenforced**.
2. **Dev local** (opțional): App Check → *Manage debug tokens*. `firebase.ts` activează un debug token în DEV;
   îl iei din consola browserului (localhost) și îl înregistrezi, ca să testezi local fără reCAPTCHA real.
3. **Enforce în cod** (eu, când monitorul arată token-uri OK): adaug `enforceAppCheck: true` pe
   `selfGenerateStrategy` + `selfGenerateDetails` (și opțional pe restul callable-urilor) → `npm run deploy:functions`.
4. **Enforce în consolă** (Andrei): App Check → APIs → **Enforce** pe Cloud Functions (apoi, după ce confirmi
   că totul merge, pe Cloud Firestore — închide și sink-urile `errorReports`/`checkout_sessions`).

## Rollback rapid
Dacă enforcement-ul blochează din greșeală utilizatori reali: apasă **Unenforce** în consolă (efect imediat,
fără redeploy). Codul `enforceAppCheck:true` rămâne inofensiv cât timp consola e pe Unenforced.
