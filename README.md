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

## Production backend

Cloudflare Pages Functions and D1 now provide server-side authentication, profiles, matches, messages, wallets, gifts, call-rate negotiation, minute billing, safety reports and admin moderation. Stripe Checkout endpoints are included; real charges remain unavailable until Stripe secrets and price IDs are configured.

### Deploy

1. Create a D1 database named `nearvibe-production`, replace the placeholder ID in `wrangler.toml`, then run `npx wrangler d1 migrations apply nearvibe-production --remote`.
2. Add Pages secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and a long random `ADMIN_SETUP_TOKEN`.
3. Set the Stripe webhook URL to `https://YOUR-DOMAIN/api/payments/webhook` for `checkout.session.completed`.
4. Deploy the repository as a Cloudflare Pages project. The static root is `.` and Functions are detected from `/functions`.
5. Create the owner account normally, then make one authenticated `POST /api/admin/bootstrap` request with the setup token. Remove or rotate the token afterwards.

Use `GET /api/health` as the deployment health check.

## MVP boundaries

Live video transport, cash withdrawals, explicit-image uploads, precise location sharing and identity-document collection are intentionally not included. Paid calls require a separate video provider and formal age/identity, safeguarding, payments and platform-policy review before public launch.

Before production, add a secure backend, privacy and retention controls, verified age/identity services, moderation operations, encrypted transport and legal/platform review.

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.
