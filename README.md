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
- PWA manifest and offline service worker

## MVP boundaries

This is a front-end prototype using browser `localStorage`. It deliberately does not include real payments, paid calls, explicit-image uploads, precise location sharing, production authentication, live messaging, live video or identity-document collection.

Before production, add a secure backend, privacy and retention controls, verified age/identity services, moderation operations, encrypted transport and legal/platform review.

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.
