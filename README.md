# NearVibe MVP

Mobile-first installable PWA prototype for adult (18+) local social discovery.

## Included

- 18+ entry gate and date-of-birth validation
- Signup/login and local user profile
- Profile photo preview, gender and discovery preferences
- Approximate nearby discovery, likes and matches
- Private messaging and consent-based video-call request interfaces
- Block, report, moderation and safety controls
- Adult verification and paid-call eligibility foundations
- Demo coin wallet, coin packages, paid call requests and virtual chat gifts
- Negotiable per-minute call pricing with asking rates, bids, counter-offers and acceptance
- Per-minute coin deductions, visible elapsed minutes, low-balance protection and end-call control
- Clearly labelled female AI demonstration profiles for testing discovery and interactions
- Demo owner/admin account with moderation, report resolution, account suspension and adult-verification review interfaces
- PWA manifest and offline service worker

## MVP boundaries

This is a front-end prototype using browser `localStorage`. Coin purchases and spending are demonstrations only: no real money is charged and gifts have no cash value. The demo admin address is `sam.admin@nearvibe.app`; it is not secure authentication. It deliberately does not include live payments, cash withdrawals, explicit-image uploads, precise location sharing, production authentication, live messaging, live video or identity-document collection.

Before production, add a secure backend, privacy and retention controls, verified age/identity services, moderation operations, encrypted transport and legal/platform review.

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.
