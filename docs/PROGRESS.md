# TruTicket — Progress Tracker

_Last updated: 2026-11-04. Progress file is kept in the workspace and is NOT committed. Update it at every step._

Legend: [x] done · [~] scaffold/draft exists but not tested · [ ] not started

Spec: `TruTicket Master Unified PRD v2.0` (authoritative). Priority: **Mobile first, then Web**.

---

## v3 Status (Plan v3, free-first auth) — 2026-11-04

Done in this batch:
- [x] Phase 0: brand assets generated from the official logo (`assets/brand/`, generator `tools/brand_assets.py`)
- [x] Phase 0: design tokens (`packages/ui-tokens/tokens.json` + `index.ts`)
- [x] Phase 1 setup: Expo SDK 57 app (`apps/mobile`), app.json renamed to TruTicket, icons and splash from the logo
- [x] Phase 1 setup: metro config for monorepo tokens import, `npm install`, `tsc --noEmit` clean, `expo export --platform android` bundles OK
- [x] Shared components: Button, Field, OtpInput, Logo, Screen, EventCard
- [x] Auth core (mock, DEMO_MODE gated): normalised email duplicate key, resend cooldown, 5 wrong codes = 15 min lock
- [x] Auth self-test: `apps/mobile/scripts/auth-selftest.sh` (passes)
- [x] Screens: index redirect, onboarding (3 slides), login, login/email, login/otp, verify-gate, tabs layout, Home (explore), Profile (logout)
- [~] Screens: Categories and My Tickets are placeholders only
- [ ] Event detail, queue, seat/tier select, checkout (mock), success, ticket QR, new-device screen, organiser and gate screens (rest of the 22 mobile screens)
- [ ] Phase 1 done-when: full mock flow works on Expo Go (Android)
- [ ] Google One-Tap real login (needs Google OAuth client IDs: Android, iOS, Web)
- [ ] Email OTP real backend (Phase 2, Supabase Auth)
- [ ] Web (Phase 4) not started. Backend migrations 002/003/004 not started.

Decisions still needed from the user (see chat): organiser 2FA default, Google OAuth client IDs, Anany's scope (ML only or ML + Security).

---

## 0. Project & Process

- [x] PRD v2.0 analysed (42 pages)
- [x] Monorepo scaffold (apps/, contracts/, services/, n8n/, infra/, docs/)
- [x] Repo pushed to GitHub `main`
- [x] PR #1 `feature/db-schema` merged
- [x] PR #2 `chore/gitignore` merged (.gitignore + package-lock.json)
- [ ] Branch protection on `main` (PR required, no direct push)
- [ ] PR template + issue labels (frontend / backend / blockchain / ml / security)
- [ ] CI: GitHub Actions — lint + prisma validate + hardhat compile on every PR
- [ ] `.env.example` filled with all keys (no real secrets in repo)

---

## 1. Database — Brajesh (Backend)

- [x] Prisma schema, 18 models (`prisma/schema.prisma`, `uuid()` ids, `prisma validate` OK)
- [x] Supabase migration `supabase/migrations/001_init.sql` (18 tables, enums, indexes, RLS on all tables) — applied to Supabase
- [x] `prisma generate` OK (v5.22.0 — do NOT upgrade to v7/v8)
- [ ] Prisma runtime connection via Session pooler (`DATABASE_URL` in local `.env` only)
- [ ] `002_seed.sql` — demo organizer, 1 demo event, ticket types, test attendee, scanner device
- [ ] `003_functions.sql` — atomic inventory reservation (decrement + expiry)
- [ ] `004_functions.sql` — atomic gate redemption (idempotent, single-use QR)
- [ ] Ticket lifecycle state machine enforced in DB (PRD Appendix A)
- [ ] RLS policy tests (attendee cannot read other users' tickets)
- [ ] Storage bucket for event cover images

---

## 2. Backend API (Supabase Edge Functions) — Brajesh

- [~] `auth` function (draft in `services/api/supabase/functions/auth/`)
- [~] `events/create` function (draft)
- [~] `scanner/verify` function (draft)
- [ ] Deploy functions: `supabase functions deploy` + `supabase secrets set` (never commit secrets)
- [ ] Order creation: reserve tickets → create order → Razorpay order
- [ ] Razorpay Test Mode: create order, verify signature (server-side), webhook handler
- [ ] Ticket issuance after payment (order → tickets → ownership)
- [ ] Dynamic QR: rotating nonce, `qr_credentials` rows, expiry (≈30s)
- [ ] FairQueue: join queue, allocate slots, admission expiry (`queue_entries`)
- [ ] Price-capped resale: listing, cap check, purchase, transfer (`resale_listings`, `transfers`)
- [ ] Group tickets (FR-027): manager, invite/claim token, member assign (`group_tickets`)
- [ ] Audit log writes on sensitive actions (`audit_logs`)
- [ ] Rate limiting on auth, queue join, scanner verify
- [ ] API contract doc updated (`docs/API_CONTRACTS.md`)

---

## 3. Blockchain — Brajesh

- [~] `contracts/TruTicket.sol` draft (ERC-721, AccessControl, ReentrancyGuard, price cap, pause)
- [~] `contracts/hardhat.config.js` (Polygon Amoy + hardhat networks)
- [ ] `npm install` + `npx hardhat compile` passes (fix any errors)
- [ ] Unit tests: mint, price cap, resale, group allocation, redemption, pause
- [ ] Deploy to Polygon Amoy (test POL from faucet); deployer key only in local `.env`
- [ ] Backend mints ticket on purchase; stores `contractAddress` and `tokenId`
- [ ] On-chain transfer on resale with price cap check
- [ ] On-chain redemption flag on gate scan
- [ ] Verify contract on PolygonScan (Amoy)

---

## 4. Mobile App (React Native + Expo) — Ansh & Shivam (Frontend)

Base:
- [~] `apps/mobile` starter (App.tsx, SplashScreen, LoginScreen, ExploreScreen, MyTicketsScreen, ScannerScreen, services/auth.ts) — not yet run
- [ ] `npm install` + `npx expo start` runs on Expo Go (Android)
- [ ] Supabase client using **anon key only**
- [ ] Navigation structure + theme/design tokens
- [ ] Role switcher (attendee / gate staff)

Screens (from PRD, 34 total across mobile + web — mobile list):
- [~] Splash
- [~] Login / signup
- [ ] Onboarding
- [~] Explore (event list)
- [ ] Event detail + ticket type selection
- [ ] FairQueue waiting room (realtime position)
- [ ] Checkout (Razorpay Test Mode)
- [~] My tickets
- [ ] Ticket detail with dynamic QR (auto refresh)
- [ ] Resale: list ticket, price cap message
- [ ] Transfer / group ticket assign
- [~] Gate scanner (camera + verify call)
- [ ] Profile + logout
- [ ] Wallet / ticket history
- [ ] Error, empty and offline states

---

## 5. Web App (Next.js) — Ansh & Shivam (Frontend)

_Starts after mobile core flows work._

- [~] `apps/web` starter (layout, globals.css, page.tsx, tailwind config) — not yet run
- [ ] Organizer dashboard: create event, ticket types, sales view
- [ ] Platform admin: verify organizers, view audit logs
- [ ] Fraud reviewer: queue of fraud events, review actions
- [ ] Public event page (SEO)
- [ ] Responsive pass for mobile browsers

---

## 6. ML & Fraud Scoring — Anany

- [~] `services/ml/main.py` FastAPI risk scoring with rule-based fallback
- [~] `services/ml/requirements.txt`
- [ ] Synthetic training dataset (bots, velocity, multi-account patterns)
- [ ] Train model (scikit-learn), save artifact, document features
- [ ] Model metrics report (precision/recall, threshold)
- [ ] Serve via FastAPI; Docker image (`infra/Dockerfile.ml`)
- [ ] Backend calls `/score` on queue join and checkout; writes `fraud_events`

_Note: security review role for Anany to be confirmed (task brief says ML & Security; team constraint says model training only)._

---

## 7. Automation — n8n — Brajesh

- [x] Infra compose file drafted (`infra/docker-compose.yml`)
- [~] Workflow 1: `payment-confirmation.json`
- [~] Workflow 2: `qr-expiry-warning.json`
- [ ] Remaining 7 workflows from PRD (9 total) — list in PRD section on n8n
- [ ] Workflows tested end-to-end with test webhooks

---

## 8. Security & Compliance

- [ ] No secrets in repo (scan with gitleaks before each merge)
- [ ] Mobile uses anon key only; service_role only in Edge Functions
- [ ] RLS tested for every table with policies
- [ ] Razorpay signature verification tested
- [ ] QR replay protection tested (nonce used once)
- [ ] Input validation on all Edge Functions

---

## 9. Demo Readiness (PRD Section 20 — 7-minute demo)

- [ ] Demo script rehearsed
- [ ] Demo data seeded (`002_seed.sql`)
- [ ] Fallback plan for network/testnet failures (PRD Section 21)
- [ ] Backup video recorded

---

## Next 3 PRs (suggested order)

1. `feature/mobile-setup` — Ansh/Shivam: expo app runs, Supabase anon client, navigation
2. `feature/contracts-compile` — Brajesh: hardhat compile + tests passing
3. `feature/db-seed-functions` — Brajesh: 002 seed + 003 reservation function
