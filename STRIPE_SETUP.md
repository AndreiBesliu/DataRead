# DataRead — Setup Stripe (test mode)

> Pașii de consolă ai lui Andrei pentru activarea checkout-ului self-serve. Codul e deja scris
> și defensiv: până la finalizarea acestor pași, pachetele afișează „Contactează-ne" și nimic
> nu se strică. ORDINEA CONTEAZĂ (lecția CNCVS: prețurile create înainte de webhook nu se
> sincronizează în Firestore).

## 0. Precondiții

- [ ] Proiectul `dataread-e1bd6` pe planul **Blaze** (Firebase console → Upgrade).
- [ ] Cont Stripe în **test mode** (dashboard.stripe.com, comutatorul „Test mode" pornit).
- [ ] Functions deployate: `npm run deploy:functions` (după Blaze; le face Claude).

## 1. Instalează extensia `firestore-stripe-payments`

Firebase console → Extensions → caută **„Run Payments with Stripe"** (invertase/firestore-stripe-payments) → Install. La configurare:

| Setare | Valoare |
|---|---|
| Cloud Functions deployment location | **europe-central2 (Warsaw)** — OBLIGATORIU aceeași cu functions |
| Products and pricing plans collection | `products` |
| Customer details and subscriptions collection | `customers` |
| Sync new users to Stripe customers | **Sync** (on create) |
| Stripe API key (restricted/secret, test) | cheia `sk_test_…` / restricted key — la promptul de Secret Manager; NU în chat/repo |

## 2. Webhook-ul Stripe

După instalare, pagina extensiei afișează **URL-ul webhook-ului** (`ext-firestore-stripe-payments-handleWebhookEvents`).

1. Stripe dashboard → Developers → Webhooks → **Add endpoint** cu acel URL.
2. Evenimente de selectat:
   - `product.created`, `product.updated`, `product.deleted`
   - `price.created`, `price.updated`, `price.deleted`
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.paid`, `invoice.payment_failed`
3. Copiază **Signing secret** (`whsec_…`) → înapoi în configurarea extensiei (Reconfigure → webhook secret).

## 3. Activează Customer Portal (test)

Stripe dashboard → Settings → Billing → **Customer portal** → activează (permite anulare/actualizare card). Butonul „Gestionează abonamentul" din `/app` folosește portalul.

## 4. Creează produsele + prețurile (DUPĂ pașii 1–2!)

Stripe dashboard (test mode) → Product catalog → câte un produs per pachet, fiecare cu UN preț
recurent LUNAR în **EUR** (prețuri de listă provizorii — de confirmat cu Ionuţ):

| Produs | Preț lunar | 
|---|---|
| DataRead Start | 149 € |
| DataRead Growth | 399 € |
| DataRead Premium AI | 999 € |

Copiază cele 3 **Price ID-uri** (`price_…`) → în `.env.local`:

```
VITE_STRIPE_PRICE_START=price_…
VITE_STRIPE_PRICE_GROWTH=price_…
VITE_STRIPE_PRICE_PREMIUM=price_…
```

> Dacă un preț a fost creat înainte de webhook: deschide-l în dashboard și dă-i un Save
> (orice update re-declanșează sincronizarea), apoi verifică cu `npm run prices:check`.

## 5. Verificare

1. `npm run prices:check` → toate 3 prețurile „OK (synced + active)".
2. Claude rulează `npm run deploy` (build + prerender + hosting cu noile price ID-uri).
3. E2E: `/pachete` → „Alege Growth" → cont nou → Checkout → card test `4242 4242 4242 4242`,
   orice expirare viitoare + orice CVC → redirect `/app?checkout=success` → „Se confirmă plata…"
   → „Activ — Growth" în câteva secunde (webhook → extensie → onSubscriptionWrite → claim+mirror).
4. „Gestionează abonamentul" deschide portalul; anularea se reflectă ca „Se încheie: <data>".

## Depanare

- **Callable „internal"** → regiunea extensiei ≠ `VITE_FIREBASE_FUNCTIONS_REGION` (trebuie ambele europe-central2).
- **Prețuri lipsă în Firestore** → webhook-ul nu a fost configurat când s-au creat → re-salvează produsul/prețul.
- **„Activ" nu apare după plată** → vezi logurile functions (`onSubscriptionWrite`) + documentele `customers/{uid}/subscriptions`.
