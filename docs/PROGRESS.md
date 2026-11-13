# TruTicket — Progress Tracker

_Last updated: 2026-11-13 (fix 1 for purchase device link added). Progress file is kept in the workspace and is NOT committed. Update it at every step._

Legend: [x] done · [~] scaffold/draft exists but not tested · [ ] not started

Spec: `TruTicket Master Unified PRD v2.0` (authoritative). Priority: **Mobile first, then Web**.

---

## v3 Status (Plan v3, free-first auth) — updated 2026-11-09

Done:
- [x] Phase 0: brand assets from the official logo (`assets/brand/`, `tools/brand_assets.py`)
- [x] Phase 0: design tokens (`packages/ui-tokens/`)
- [x] Phase 1 setup: Expo SDK 57 app (`apps/mobile`), icons and splash from the logo, typecheck and bundle OK
- [x] Shared components: Button, Field, OtpInput, Logo, Screen, EventCard
- [x] Auth core: normalised email duplicate key, resend cooldown, 5 wrong codes = 15 min lock, auth self-test passes
- [x] Real Google sign-in (native, `@react-native-google-signin`), tested on Android dev build: login and home work
- [x] Dev build: EAS `development` profile, APK installed on test phone
- [x] Screens: onboarding, login, login/email, login/otp, verify-gate, home (explore), event detail, fair queue, checkout (mock), success, ticket with QR, my tickets, profile
- [~] Categories tab: placeholder only
- [ ] Remaining PRD mobile screens from PLAN §4: resale listing, group tickets, new-device, gate scanner, organiser screens
- [ ] Phase 1 done-when: full mock flow works (it does for purchase; resale, group and gate screens pending)

Decisions accepted:
- Organiser verification default (D-O1): verified email + TOTP 2FA (free). GST and PAN before real payouts.
- Anany's scope: ML only. Security review owner not assigned yet.

Not started:
- Web (Phase 4). Backend migrations 002/003/004 (Phase 2). Real email OTP (Phase 2). Razorpay (Phase 5).
- iOS Google client and Apple Sign-In (Launch).

Remaining work to verify on the device: real Google login on the test phone. Done.

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

Base (Phase 2.9, 13 Nov):
- [x] Expo SDK 57 app, API client in `src/services/` (one module per area: events, tickets, checkout, gate)
- [x] Supabase Edge Functions with the anon key only (no service key in the app)
- [x] Tokens in secure storage, refreshed with Supabase rotation
- [ ] Navigation role switcher (attendee / gate staff): gate is a route from Profile, not a role switch
- [x] Theme and design tokens

Screens (wired to the DEV backend in Phase 2.9):
- [x] Splash / onboarding / login (Google native, email code, demo account on DEV)
- [x] Explore and categories (real events from the `events` function)
- [x] Event detail (real ticket types and seats left)
- [~] FairQueue: still a timer (UI only, no server queue yet)
- [x] Checkout: hold seats, Razorpay order, hosted payment page in the browser
- [x] Success: waits for the webhook to issue tickets before showing "confirmed"
- [x] My tickets (real)
- [x] Ticket detail with the server QR (refreshes before the 10 s expiry)
- [~] Resale: still mock (Phase 2.8 mobile wiring, next zip)
- [~] Group tickets: still mock (Phase 2.8 mobile wiring, next zip)
- [x] Gate scanner: live camera scan (expo-camera) and paste-QR path (demo), via `scanner_verify`
- [x] Profile + logout (signs out and clears the saved tokens)
- [ ] Wallet / ticket history
- [~] Error, empty and offline states (loading and error text on the main screens; gate offline switch logs OFFLINE-UNVERIFIED)

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


---

## v3 Status — Phase 1 batch 3 (mobile screens, mock data)

**Built (mobile):**
- Categories tab (4 categories, event list per category)
- Resale marketplace (capped listings, transfer count) and Sell-a-ticket (ask capped at face × 110%, 2% demo fee, net to seller)
- Group distribution manager (FR-027): invite by email, PENDING_CLAIM / CLAIMED, revoke unclaimed invites
- New-device verification (demo flow: email code, 48-hour cooldown, old device signed out)
- Security & devices screen
- Gate staff: scanner camera view, scan result (VALID, ALREADY USED, EXPIRED, WRONG EVENT, INVALID, OFFLINE-UNVERIFIED), scan activity log (no attendee names), manual lookup by ticket ref
- Ticket detail: Ticket DNA block, List for resale / Cancel listing buttons
- Profile: links to security, resale, group, gate (demo)

**Changed:**
- Gate QR window is 10 seconds (PRD 6.4). Earlier builds used 30 seconds.
- Demo QR text is honest: not secure until the Phase 2 signed credential.

**Checks run:** `tsc --noEmit` pass. Android `expo export` pass. Logic tests (resale cap maths, group rules, gate states, QR window and skew) all pass.

**Not built yet:** camera scanning (needs expo-camera and a new EAS dev build), web portals (organiser and admin, 18 screens), Phase 2 backend.

---

## v3 Status — Phase 1 web batch (organiser and admin portals, mock data)

**Built (web, Next.js 15.5.29, React 19.2.3):** all 18 screens from PLAN §4.
- Organiser (10): Overview, Create event (5-step wizard), Event detail (tabs), Ticket inventory, Resale policy (cap calculator), Fraud monitoring, Gate staff (authorise device), Payouts & settlements, Organisation details (new), Verification status (new).
- Admin (8): Platform overview, User management, Event moderation, Emergency protocol, Audit logs, Risk events queue, Session investigation, Appeal review.
- Shared: sidebar, top bar, brand logo (`public/brand/`), design tokens from `packages/ui-tokens/tokens.json` as CSS variables.

**Changed or deviated:**
- Styling uses plain CSS variables in `src/app/globals.css`, not Tailwind. The starter `tailwind.config.ts` is removed. Reason: keeps one token source shared with mobile.
- Money is shown in ₹ (Indian grouping). Reference screenshots show $.
- All data is mock (`src/lib/organiser-data.ts`, `src/lib/admin-data.ts`). Forms validate locally and do not save yet.
- Risk scores are mock values. The ML service is excluded from this build.

**Checks run:** `tsc --noEmit` pass. `next build` pass (21 routes). Dev server on 0.0.0.0:3000: all 21 routes return 200 (unknown event id returns 404).

**Not built yet:** Supabase auth and RLS, real API calls, Razorpay, role guards on `/organiser` and `/admin`, visual review against the admin reference screenshots, and the Phase 2 backend.

---

## Phase 2.1 — Database foundation (auth tables, verification gate, RLS)

**Built:**
- `supabase/migrations/002_auth_sessions.sql`: `user_emails` (one verified email key per account, several verified emails allowed), `user_identities` (Google subject unique), `user_devices` (one active device, new device pending 48 h), `user_sessions` (one active session), `otp_codes` (HMAC hash only, 10-minute expiry), `rate_limits` plus `rate_limit_hit()`, `normalise_email_key()`, `can_transact()` (verified-email gate), and a profile trigger on `auth.users`.
- RLS on every new table. Clients read their own rows only. OTP and rate-limit tables and functions are service-only.
- Removed `profiles.passwordHash` (no passwords in this app). Added FK `profiles.id` to `auth.users`.
- Dropped Prisma (approved decision). `prisma/` removed. Root `db:push` and `db:generate` scripts removed.

**Tests:**
- `supabase/tests/002_auth_sessions.test.sql`: 14 groups (T0 to T14). Runs in one transaction and rolls back.
- `supabase/tests/local_stubs.sql`: recreates Supabase's roles, `auth.users`, `auth.uid()` and default grants for plain Postgres. Local use only.
- Local run (PGlite, PostgreSQL 18 build): 001, 002 and all 14 test groups pass.
- Mutation check: 7 deliberately broken variants (missing unique indexes, client access to OTP, RLS off on sessions, gate ignoring verification). Each one is caught.

**Not yet:** not run on the dev Supabase project. Not run on Docker postgres:17 yet.

**Open for package 2.2 and 2.3:**
- Replace `services/api/supabase/functions/auth`. The current stub uses email and password signup and takes `role` from the request body, which allows privilege escalation. It must not be deployed.
- Email normalisation removes dots and +tags for Gmail only (plan §5). Other providers allow +tag aliases. Decide whether to extend this.
- Refresh tokens: use Supabase's built-in rotation (with reuse detection) plus our `user_sessions` row, or build our own rotation table. Decide in 2.3.
- `profiles` FK needs no profile rows without an auth user. Delete any old test rows before applying 002.

---

## Phase 2.2 — Auth and verification (Google and email code)

**Built:**
- `services/api/supabase/functions/auth/index.ts` replaces the password draft. Three actions only: `google` (Google ID token), `otp_request`, `otp_verify`. No passwords, and the role is never taken from the request.
- Google: the ID token is checked for signature (Google JWKS), issuer, audience (`GOOGLE_CLIENT_IDS`), expiry, and `email_verified`. A new Google login is refused with `EMAIL_LINKED` if the same normalised email is already verified on another account (no silent linking).
- Email code: 6 digits from a uniform random source, 10-minute expiry, 5 wrong attempts per code, 60-second resend wait, only the newest code is valid. The stored value is an HMAC-SHA256 bound to the email key and purpose. Comparison is constant time. The code is consumed once.
- Limits (via `rate_limit_hit`): 5 codes per email per hour, 30 per IP per hour, 30 verify guesses per email per 15 minutes.
- Session: the server creates a normal Supabase session (access and refresh token) with an admin-generated token hash. No email is sent for this step. Refresh rotation is Supabase's built-in. Our `user_sessions` one-session rule is 2.3.
- Demo hook: only when `DEMO_MODE=true` and the email is in `DEMO_EMAILS`, the code is `DEMO_OTP_CODE` and no email is sent. Off by default. Policy still open (PLAN §6 item 3).
- Shared helpers in `services/api/supabase/functions/_shared/`: OTP, email key, Google claims and verification, rate limit, accounts (with rollback), session, email sender (Brevo transactional API, free plan 300 emails/day), config, HTTP errors.
- `supabase/APPLY_TO_SUPABASE_DEV.sql`: 001, then removal of orphan profile rows (no auth user), then 002. One transaction. Re-runnable.
- `scripts/set-auth-secrets.ps1` and `scripts/deploy-auth.ps1`: set secrets and deploy the function (the deploy script copies to a temp folder, so the repo gets no extra files).
- `supabase/config.toml`: `auth` has `verify_jwt = false`. The function checks each request itself.

**Tests:**
- Unit tests (Deno, offline): 26 pass. OTP format, leading zeros, rejection sampling, HMAC binding, constant-time compare, email key rules, Google claim rules, Brevo request shape (URL, api-key header, sender, recipient) and failure handling (mocked fetch).
- Parity: `emailKey()` in TypeScript and `public.normalise_email_key()` in SQL give the same result on all 7 cases (PGlite).
- Type check: `deno check auth/index.ts` passes.
- Request validation, run live (no database needed): bad method (405), bad JSON (400), unknown action (400), bad email (400), bad code format (400), missing Google token (400), bad Google token (401).
- Combined apply on a simulated dev project (old 001 state with one orphan profile): applied, orphan removed, FK and trigger present; second run OK; the 002 DB tests pass after it.

**Not yet tested:** a real Supabase project (deploy, secrets, real email delivery, real Google token). These happen in the dev project during integration. The mobile wiring is 2.9.

**Decisions made in 2.2:**
- Session method: admin token hash, then `verifyOtp` (chosen over minting JWTs ourselves).
- Refresh: Supabase's built-in rotation for now. Reuse-detection and the family revoke are 2.3.
- Email normalisation: still Gmail-only (open question, PHASE2_PLAN §6).
- Google sign-in for an email already held by an OTP-only account is refused with `EMAIL_LINKED`. Linking from settings is later.

**Open:**
- DEMO_MODE policy (PLAN §6 item 3). The hook exists and is off by default.
- Sample gate buttons vs camera build first (PLAN §6 item 4).
- Brevo sender: the sender address must be verified in Brevo before sends work. Brevo may ask for account approval before sending. Domain authentication (SPF/DKIM) is recommended before real users.

## Phase 2 status (overview)

| Package | Scope | Status |
|---|---|---|
| 2.1 | DB foundation (002) | Merged to `main` (`062f6f3`). Verified on Docker PG 17 and dev. |
| 2.2 | Auth: Google and email code | Merged to `main`. Verified on dev (email code end to end). Real Google token pending 2.9. |
| 2.3 | Sessions, devices, attestation | PR open (`feature/phase2-3-sessions`, commit `9a672de`). Dev: 6 of 8 checks. **Known gap: refresh reuse.** |
| 2.4 | Rate limits | Branch `feature/phase2-4-rate-limits` (commit `fca9f17`), on top of 2.3. Deployed to dev. Tests 71 pass. |
| 2.5 | Events and inventory | Branch `feature/phase2-5-inventory`, on top of 2.4. DB checks 15 pass (PGlite), 4 mutants caught. Dev run pending. |
| 2.6 | Orders and Razorpay Test | Merged to `main`. Dev end-to-end passed (3 of 3). DB checks T35 to T43, 6 of 6 mutants caught. |
| 2.7 | Tickets, rotating QR, gate scan | Branch `feature/phase2-7-tickets` (commit `08147f8`, pushed). DB checks T44 to T56 pass (PGlite), 8 of 8 mutants caught. Deno 82 pass. Dev gate test: 4 of 4 pass (13 Nov). |
| 2.8 | Resale price cap, transfers, group tickets (FR-027) | Branch `feature/phase2-8-resale-group`, on top of 2.7. DB checks T57 to T80 pass (PGlite), 12 of 12 mutants caught. Deno 93 pass. Dev run pending (`test-resale-dev.ps1`). |
| 2.9 | Mobile wiring (events, tickets, checkout, gate, email code, Google) | Zip 1 (13 Nov). Verified: typecheck, Android bundle, 12 mapper tests with 3 of 3 mutants caught, Deno 108 pass. Dev run pending (user). Resale and group screens still mock. |
| 2.10 | RLS, grants, audit and security pass | Merged (see section below). |

## Phase 2.3 — Sessions and devices (single session, device binding, Android attestation)

**Done (code, tests, guide):**
- `supabase/migrations/002b_sessions_devices.sql` (and the dev-only copy `supabase/APPLY_2_3_TO_SUPABASE_DEV.sql`, same content):
  - `session_can_transact()`: the gate for purchases and organiser writes from 2.5 on. It needs the account to be active with a verified email (`can_transact`), the caller's own session still active in our `user_sessions` AND in Supabase's `auth.sessions`, and that session linked to the account's **active** device.
  - `session_is_active()`, `revoke_auth_sessions()` (service role only), `device_challenges` (service role only).
  - `can_transact()` from 002 is unchanged, so the 002 tests still hold.
- `services/api/supabase/functions/_shared/`:
  - `session.ts`: every sign-in ends the previous session (`user_sessions` revoked, other Supabase sessions deleted, so their refresh tokens stop working). The account holder gets an email when a session was replaced. Fails closed.
  - `session_token.ts`: reads the `session_id` claim.
  - `der.ts`: minimal DER reader for the Android KeyDescription.
  - `attestation.ts` and `attestation_roots.ts`: Android key attestation. Chain signatures, pinned Google root keys (5 certificates, 2 keys, from the official page on 2026-11-11), leaf validity, leaf key equals the registered key, revocation list (Google status JSON, cached 1 hour, fail closed), nonce, TEE or StrongBox level.
  - `devices.ts`: policy. First device active at once. Any further device waits 48 hours AND an email code. Both are required.
  - `otp_flow.ts`: OTP issue and check extracted from `auth/index.ts`, used by login and new-device.
  - `email.ts`: `sendOtpEmail` takes a purpose; `sendSecurityEmail` for notices.
  - `env.ts`: `ATTESTATION_REQUIRED` (default on; `false` only for dev tests without a real phone).
- `services/api/supabase/functions/auth/index.ts`: same actions as 2.2; uses the shared OTP flow and the new session replacement.
- `services/api/supabase/functions/devices/index.ts`: actions `challenge`, `register`, `activate`, `status`. Every call checks the session is still active.
- `supabase/config.toml`: `[functions.devices] verify_jwt = false`.
- `scripts/deploy-functions.ps1`: deploys `auth` and `devices`. Refuses `ccqbubgebsayoviilnul` unless `-AllowProduction`.
- `scripts/test-sessions-dev.ps1`: 8 checks, dev project only (refuses production and any other ref). Device ids are unique per run. The refusal checks pass only on HTTP 400 or 401.

**Tests:**
- Database (PGlite, Postgres 18): `002b_sessions_devices.test.sql`, T15 to T24, all pass. The chain runs stubs, 001, 002, 002b, 002 test, 002b test. Re-applying the dev file twice is OK.
- Mutation check (`mutate3.mjs`, 7 mutants): every mutant is caught (device not checked, revoked session passes, other user's session passes, pending device passes, revoke-all, client can revoke, challenges readable, Supabase-ended session passes).
- Deno unit tests: 63 pass (der 4, devices 7, session token 5, attestation 18, auth errors 3, email 3, otp 7, identity 9, google claims 7). Attestation tests use synthetic chains under a test root; the five pinned roots are checked to parse and to hold the two known keys.
- `deno check` passes for `auth/index.ts` and `devices/index.ts`.
- Live, no database: `auth` GET 405, bad JSON 400, unknown action 400, bad email 400. `devices` GET 405, no token 401 `AUTH_REQUIRED`, bad token 401 `AUTH_INVALID`, bad JSON 400.
- PowerShell 7.4.6 parse OK for all four scripts. Production guards tested: prod ref refused, wrong ref refused, nothing staged.

**Not yet tested (needs the dev project or a phone):**
- Real Supabase: `revoke_auth_sessions` on the real `auth.sessions`, and that the `session_id` claim is present on dev tokens (the guide has a check).
- Refresh-token reuse on dev: **known gap, see Open below.** Last dev run of `scripts/test-sessions-dev.ps1`: 6 of 8 checks pass. The 2 failing checks are the reuse ones.
- Real Android key attestation on a phone. Needs the 2.9 EAS dev build and Keystore code. Until then, dev runs with `ATTESTATION_REQUIRED=false`, which must never be set on production.

**Decisions made in 2.3 (confirm with the user):**
- A new sign-in on any device ends the previous session at once. The old device is signed out at that moment.
- A new device is blocked until 48 hours have passed AND the code sent to the verified email is entered. Both are required. The code alone does not skip the cooldown.
- Attestation roots are pinned as public keys (the 5 certificates on the official page). Google's revocation list must load, or device registration fails closed (503).
- Refresh rotation: Supabase built-in. Reuse detection is the dashboard setting, not code.
- Activation revokes the old active device first, then activates the new one (the unique index allows one active device).

**Known gap (accepted by the user, 2.3 closed at 6 of 8 dev checks):**
- On dev, Supabase accepted a reused refresh token about 20 seconds after it was used (the dashboard reuse interval is 10 s, "Detect and revoke compromised tokens" is ON). Because of this, the newest token of that session was not revoked either. Earlier runs showed the reuse refused once, so the behaviour is not consistent.
- What still holds: the superseded session is blocked by our own checks (`user_sessions` and `session_can_transact()`), and its old access token gets `SESSION_REVOKED` from `devices`. So a stolen token from an earlier sign-in does not reach purchases or organiser writes.
- Not covered: a stolen refresh token from the **current** session, if it is reused after the interval. Supabase is expected to revoke the family here, and it did not on dev.
- Next action (later, not blocking 2.4): check on Supabase support or the auth changelog whether the reuse revoke works on the standard session path (supabase/auth #2913 suggests it may not). Option if it does not: add our own check in `auth` that treats a second use of the same refresh token as a reuse. Rerun `scripts/test-sessions-dev.ps1` after any change.
- Do not claim the "reused token revokes family" requirement is met until the 2 checks pass.

**Open:**
- Gmail-only email normalisation (PHASE2_PLAN §6). Still open.
- Refresh reuse gap above (checks 7 and 8 of `test-sessions-dev.ps1`).
- Brevo sender domain (SPF/DKIM) before real users.
- Mobile wiring for challenge and register (2.9).
- Production (`ccqbubgebsayoviilnul`): not touched. 002b, functions and secrets are not applied there. Needs explicit approval.

## Phase 2.4 — Rate limits

**Built (branch `feature/phase2-4-rate-limits`, on top of 2.3, commit `fca9f17`):**
- `_shared/rate_limit.ts`: `enforceLimit()` throws 429 `RATE_LIMITED` when a window is full. Built on `rate_limit_hit()` from 002 (atomic, fixed window).
- `_shared/limits.ts`: every auth limit in one place.
  - Email code (2.2, now tested): 5 wrong tries per code, then locked (`OTP_LOCKED`). Per email: 5 codes an hour, 30 wrong tries in 15 minutes. Per IP: 30 codes an hour.
  - Google sign-in: 60 per hour per IP (checked before the Google token).
  - Devices: 300 per hour per IP (checked before the token is read). Per account: status 60, challenge 20, register 5, activate 10 per hour.
- `auth/index.ts` and `devices/index.ts` call the limits. Nothing else changed.
- No database change.

**Tests:**
- Deno: 71 pass (63 from 2.3, plus 5 `rate_limit_test.ts` and 3 `otp_flow_test.ts`). `deno check` on `auth` and `devices`: exit 0.
- `otp_flow_test.ts` pins `OTP_MAX_ATTEMPTS` to 5, so changing the constant fails the test.
- Deployed to dev (`truticket-dev`, `oviqjnzlgbkmggytaqao`) with `deploy-functions.ps1`. No SQL, no secret change.

**Not yet tested live:** the "5 wrong codes then block" on the real dev API (needs a real email code; the Deno test proves the logic). Do this with the 2.3 dev test if needed.

**Open:**
- Refresh-token reuse gap from 2.3 (not changed by 2.4).
- Limits are per IP and per account. A shared IP (office or mobile carrier NAT) can hit the IP limit. Revisit before launch.

**Decisions made in 2.4 (confirm with the user):**
- Limits are fixed windows, not sliding. Simple, one row per window, and enough for the done-when test.
- The devices IP limit (300 per hour) is high on purpose, so a normal app session never hits it.

## Phase 2.5 — Events and inventory

**Built (branch `feature/phase2-5-inventory`, on top of 2.4):**
- `supabase/migrations/003_seed.sql`: demo event "TruTicket Demo Night" (published) with 3 ticket types (General Rs 499, VIP Rs 1499, Student Rs 199) and one demo gate scanner. Runs only after the demo organiser has signed in once. Safe to run twice.
- `supabase/migrations/004_functions.sql`: `available_inventory()`, `reserve_inventory()` (atomic, row lock on the ticket type), `release_expired_reservations()`. Service role only.
  - Sold = tickets not revoked, cancelled or refunded. Held = active reservations not expired.
  - Reservation hold: 10 minutes (60 to 1800 allowed). Quantity 1 to 10. Per-account limit from `ticket_types."perAccountLimit"` (4).
  - Refused with a message code: `NOT_FOUND`, `EVENT_NOT_PUBLISHED`, `NOT_ON_SALE`, `LIMIT_REACHED`, `SOLD_OUT`, `INVALID_QUANTITY`.
- `services/api/supabase/functions/events/index.ts`: actions `list`, `get` (public), `create` (verified organiser, always a draft), `reserve` (signed in, active profile, verified email).
- `supabase/APPLY_2_5_TO_SUPABASE_DEV.sql`: 004 and 003 for the dev project only.
- `scripts/demo-accounts-dev.ps1`: creates the two demo accounts on dev. Refuses production.
- `scripts/deploy-functions.ps1`: now deploys `events` too. `supabase/config.toml`: `[functions.events]` added.

**Tests:**
- Database (PGlite, PG 18): `004_inventory.test.sql`, T27 to T34, all pass. Chain: stubs, 001, 002, 002b, 004, 003 (no organiser: creates nothing), accounts, 003 twice (1 event, 3 types, 1 scanner), then T27 to T34.
- Mutation check: 4 mutants caught (no per-account limit, no sale window, held seats ignored, no publish check).
- Deno: `events/index.ts` type check passes. No unit tests for the events function yet (its logic is in SQL).

**Not yet tested:** on the real dev project (needs the demo accounts and `DEMO_MODE=true` on dev); Docker PG 17 run; concurrent reservations (PGlite is single-session).

**Known gaps and decisions (2.5):**
- The reserve action checks the profile and verified email, not the full session gate (`session_can_transact`). The full gate is applied when an order is created (2.6).
- Reservations expire by time only. The cron that calls `release_expired_reservations()` is not set up yet. Expired holds are ignored by the count, so the cron is for tidiness.
- An event goes live only when an admin sets it to `published`. No admin screen does that yet (web, Phase 4).
- Demo accounts use `@example.com` addresses and `DEMO_MODE=true` on dev only. Never on production.

## Phase 2.6 — Orders and Razorpay Test

**Built (branch `feature/phase2-6-orders`, on top of 2.5):**
- `supabase/migrations/005_orders.sql`: `begin_order()` (turns a live hold into an order, once; a retry returns the same order), `record_provider_order()`, `apply_payment_captured()` (issues one ticket per seat, one settlement row, marks the hold converted), `apply_payment_failed()` (releases the hold). Service role only.
  - Each webhook event id is stored once in `payment_webhook_events`. A replay returns `DUPLICATE` and changes nothing.
  - Amount must equal the order total in paise, or nothing is issued (`AMOUNT_MISMATCH`).
  - If the hold expired while the buyer paid, tickets are still issued when seats are free. If the seats are gone, the order moves to `REFUND_PENDING` (`SOLD_OUT_AFTER_PAYMENT`).
  - An unknown Razorpay order raises an error, so the webhook returns 500 and Razorpay retries later.
- `services/api/supabase/functions/orders/index.ts`: action `create` (signed-in buyer, hold id). Checks the full gate `session_can_transact()` with the buyer's own token, then creates the Razorpay TEST order. Returns the Razorpay order id and key id.
- `services/api/supabase/functions/razorpay_webhook/index.ts`: verifies `X-Razorpay-Signature` (HMAC-SHA256 of the raw body) before anything else. Handles `payment.captured` and `payment.failed`. No JWT (Razorpay calls it).
- `services/api/supabase/functions/_shared/razorpay.ts`: signature check (fails closed) and the order call (test keys only in practice; refuses to run without keys).
- `services/api/supabase/functions/_shared/buyer.ts`: bearer token and active session check, then `session_can_transact()`.
- `services/api/supabase/functions/_shared/env.ts`: adds `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- `supabase/APPLY_2_6_TO_SUPABASE_DEV.sql`: 005 with a dev header. Dev only.
- `scripts/set-payments-secrets.ps1`: asks for the Razorpay TEST keys (hidden input). Refuses keys that do not start with `rzp_test_`. Dev only.
- `scripts/test-orders-dev.ps1`: end-to-end dev check (sign in demo attendee, hold, order, signed webhook: ISSUED, replay: DUPLICATE, wrong signature: 401).
- `supabase/DEV_ONLY_2_6_demo_attendee_device.sql`: dev only. Adds a fake active device for the demo attendee, so a dev sign-in passes the purchase gate. The sign-in passes `device_key_id` (`dev-demo-attendee-device`).
- `scripts/deploy-functions.ps1`: now deploys `orders` and `razorpay_webhook` too (both `--no-verify-jwt`). `supabase/config.toml`: both functions added.

**Tests:**
- Database (PGlite, PG 18): `supabase/tests/005_orders.test.sql`, T35 to T43, one transaction, ends with ROLLBACK. Chain: stubs, 001, 002, 002b, 004, 003, accounts, 003, 005, then the tests. All pass.
- Mutation check (`mutate_orders.mjs`): 6 of 6 caught (no amount check, no duplicate guard, no already-issued guard, no expiry check, failed payment does not release, begin_order not idempotent).
- Deno: 76 pass (71 from 2.4 plus 5 new in `razorpay_test.ts`). `deno check` exit 0 on `auth`, `devices`, `events`, `orders`, `razorpay_webhook`.

**Dev:** `test-orders-dev.ps1` passed on 13 Nov (hold, Razorpay TEST order, ISSUED, DUPLICATE, 401). Needed the dev test device (`DEV_ONLY_2_6_demo_attendee_device.sql`).

**Not yet tested:** a real Razorpay Checkout payment (comes with the mobile wiring, 2.9); concurrent orders (PGlite is single-session); Docker PG 17 (optional).

**Known gaps and decisions (2.6):**
- The dev test simulates the signed webhook. It does not pay with a real test card. A real test payment is checked in 2.9 with Razorpay Checkout on the phone.
- Refunds are not automatic. A `REFUND_PENDING` order needs a manual refund in the Razorpay dashboard for now.
- Holds still expire by time only (no cron yet), as in 2.5.
- The webhook uses the `X-Razorpay-Event-Id` header when present, and a hash of the body if it is missing. Confirm on the first live test that Razorpay sends the header.
- Ticket price is the ticket type's face value. Fees and GST are not handled in 2.6.
- The first dev run failed with `CANNOT_TRANSACT`. Cause: the test sign-in had no device link, so `session_can_transact()` correctly refused it. Fix: the dev device fixture and `device_key_id` at sign-in. The gate itself was not changed.

## Phase 2.7 — Tickets, rotating QR and gate scan

**Built (branch `feature/phase2-7-tickets`, on top of 2.6):**
- `supabase/migrations/006_tickets.sql`:
  - `issue_qr_nonce()`: stores a QR nonce (hash only) for a ticket the caller owns and that is active. Lives 10 seconds.
  - `scan_ticket()`: one transaction. Locks the ticket row, then decides and records the result in `redemptions`. Results: VALID, ALREADY_USED, EXPIRED, WRONG_EVENT, INVALID.
  - A retry with the same scan key returns the same answer and adds no row. A key used for another ticket is refused (`KEY_REUSED`).
  - A scanner that is not active for the event is refused (`SCANNER_NOT_FOUND`).
  - Service role only.
- `services/api/supabase/functions/_shared/qr.ts`: QR token `TT1.<ticketId>.<exp>.<nonce>.<sig>`. `sig` is an HMAC-SHA256 (`QR_HMAC_KEY`), cut to 32 hex characters. The phone never sees the key.
- `services/api/supabase/functions/tickets/index.ts`: `mine` (my tickets) and `qr` (a new QR, 10 seconds). `qr` needs the full gate (`session_can_transact`).
- `services/api/supabase/functions/scanner_verify/index.ts`: the gate scan. Caller must pass the full gate and be the organiser of the event. A bad signature is INVALID without touching the database. Scanner id is optional (the event's first active scanner is used).
- **Replaces** the old placeholder `services/api/supabase/functions/scanner/verify/index.ts`. That placeholder used snake_case columns that do not exist in this schema, was not atomic, and returned a `REVOKED` result that is not in the spec. Its folder is removed in the guide.
- `supabase/APPLY_2_7_TO_SUPABASE_DEV.sql`: 006 with a dev header. Dev only.
- `supabase/DEV_ONLY_2_6_demo_attendee_device.sql`: now covers the organiser too (`dev-demo-organiser-device`). Re-run it on dev.
- `scripts/set-qr-secret-dev.ps1`: makes a random `QR_HMAC_KEY` and sets it on dev. The key is never printed.
- `scripts/test-gate-dev.ps1`: end-to-end dev check: an old QR (EXPIRED), a fresh QR (VALID), the same QR again (ALREADY_USED), a changed QR (INVALID).
- `scripts/deploy-functions.ps1`: now deploys `tickets` and `scanner_verify` too. `supabase/config.toml`: both added.

**Tests:**
- Database (PGlite, PG 18): `supabase/tests/006_tickets.test.sql`, T44 to T56, one transaction, ends with ROLLBACK. Chain: stubs, 001, 002, 002b, 004, 003, accounts, 003, 005, 006, then the tests. All pass.
- Mutation check (`mutate_tickets.mjs`): 8 of 8 caught (no expiry check, no idempotency, no event check, no used check, no scanner check, no owner check, no key-reuse check, no nonce match).
- Deno: 82 pass (76 before, plus 6 in `qr_test.ts`). `deno check` exit 0 on `auth`, `devices`, `events`, `orders`, `razorpay_webhook`, `tickets`, `scanner_verify`.

**Not yet tested:** on the real dev project; real concurrency (two scans at the same millisecond). The row lock is what makes that safe, but PGlite is single-session, so the lock itself is not proven by a test. Phone camera scanning (2.9).

**Known gaps and decisions (2.7):**
- **QR TTL is 10 seconds (PRD §6.4).** Network time eats part of it. If a scan reaches the server after 10 seconds, it returns EXPIRED. Decision still open: keep 10 s, or allow a small grace. The PRD says 10 s.
- Only the event's organiser can scan. Gate staff assignment comes later (Phase 4).
- QR issue is not rate-limited yet. Each QR adds one row to `qr_credentials`. Old rows are not purged yet.
- No offline scanning. The scan needs the network.
- The scanner check uses the first active scanner when `scanner_id` is not sent. Fine for the demo; the phone app will send its own id (2.9).

## Phase 2.8 — Resale with a price cap, and group tickets (FR-027)

**Built (branch `feature/phase2-8-resale-group`, on top of 2.7):**
- `supabase/migrations/007_resale_group.sql` (service role only):
  - Event resale policy: `resaleCapBps` (default 11000 = 110%), `resaleTransferLimit` (default 2), `resaleCutoffAt` (default: event start). Ticket types: `groupEligible` (default false).
  - Cap: `resale_max_price_minor()` = floor(face × capBps / 10000). Checked at listing (`resale_list`) and again at payment (`apply_resale_captured`).
  - Listing: `resale_list`, `resale_cancel`. A listed ticket is `LISTED` and gets no QR (`issue_qr_nonce` needs `ISSUED_ACTIVE`). The gate also refuses it (`scan_ticket`).
  - Purchase: `resale_begin_purchase` holds the listing for 15 minutes (one attempt at a time), `resale_record_provider_order` stores the Razorpay order, `apply_resale_captured` transfers the ticket (owner changes, `transferCount` +1, old QR credentials revoked, `transfers` row), `apply_resale_failed` releases the hold.
  - A payment whose hold was replaced, whose amount is wrong, or which arrives after cutoff is marked `refund_needed`. It never transfers.
  - Group: a ticket of a `groupEligible` type goes to the manager's bucket (`ISSUED_UNASSIGNED_GROUP`) by trigger. No QR there.
  - `group_allocate` (invite by email; only the hash of the claim code is stored), `group_claim` (once; the invited, verified email only; zero-price transfer; `transferCount` unchanged), `group_revoke` (before claim), `group_keep_for_self` (one bucket ticket per manager).
- `services/api/supabase/functions/resale/index.ts`: `listings`, `list`, `cancel`, `buy`. `buy` returns a Razorpay order for the hold.
- `services/api/supabase/functions/groups/index.ts`: `mine`, `allocate` (emails the claim code; if the email fails the invite is cancelled), `claim`, `revoke`, `keep`.
- `services/api/supabase/functions/razorpay_webhook/index.ts`: routes a payment to the resale functions when its Razorpay order belongs to a resale attempt. Ticket orders are unchanged.
- `_shared/resale.ts` (cap maths, price check, rupee format), `_shared/group.ts` (claim code), `_shared/outcome.ts` (result code to HTTP error).
- `supabase/APPLY_2_8_TO_SUPABASE_DEV.sql`: 007 with a dev header. Dev only.
- `supabase/DEV_ONLY_2_8_resale_group_fixture.sql`: two fixed test tickets for the demo attendee (one General for resale, one Corporate Bulk for the bucket). Dev only. Re-runnable.
- `scripts/test-resale-dev.ps1`: 7 dev checks (above-cap refused, at-cap accepted, invite, claim, second claim refused, manager has no QR, cleanup).
- `scripts/deploy-functions.ps1` and `supabase/config.toml`: `resale` and `groups` added.

**Tests:**
- Database (PGlite): `supabase/tests/007_resale_group.test.sql`, T57 to T80, one transaction, ends with ROLLBACK. Chain: stubs, 001, 002, 002b, 004, 003, accounts, 003, 005, 006, 007, then the tests. All pass.
- Mutation check (`mutate_resale.mjs`): 12 of 12 caught (no price cap, no transfer limit, no cutoff, no amount check, no QR revoke, no payment dedupe, claim not single-use, no email match, no bucket trigger, no self-invite check, no hold check, no keep limit).
- Fixture (`DEV_ONLY_2_8`): applies, runs twice, statuses correct.
- Deno: 93 pass (82 before, plus 11 in `resale_test.ts`, `group_test.ts`, `outcome_test.ts`). `deno check` exit 0 on `resale`, `groups`, `razorpay_webhook`.

**Not yet tested:** on the dev project (`test-resale-dev.ps1`). The payment-to-transfer path needs a real Razorpay Test checkout. PGlite covers the database side of it.

**Decisions taken in 2.8 (please confirm):**
- Default cap is 110% (PRD example), transfer limit 2, cutoff = event start. The organiser sets these per event later (web resale policy screen is still mock).
- The transfer count goes up on resale only. A group claim is zero-price and does not count.
- Only the Corporate Bulk type (`groupEligible`) goes to the bucket. A single buyer of that type must call `keep` to get a QR. The mobile app must show this in 2.9.
- Invite code is valid for 7 days. Dev mode also returns the code in the response (`DEMO_MODE` only) so the dev test can claim without a mailbox.

**Known gaps (2.8):**
- **No resale fee yet** (PRD: 1 to 3%). No seller settlement ledger for resale. Needs a decision on the fee rate.
- **Refunds for `refund_needed` payments are manual.** No automatic Razorpay refund call yet.
- A Razorpay order that fails to create leaves the hold for up to 15 minutes. Then it is released on the next attempt.
- Resale and group actions are not rate-limited, and do not write `audit_logs` yet (append-only audit is in 2.10).
- A buyer who pays for a listing and then gets `payment.failed` on the same Razorpay order, then succeeds on a retry, is refused and flagged `refund_needed`. Safe, but it needs a human to refund.
- Group order quantity: each purchase request is capped at 10 tickets (`reserve_inventory`). Corporate teams buy in several requests until the per-account limit (set on the ticket type).
- Mobile wiring (2.9) and RLS tests (2.10) are not part of 2.8.

## Phase 2.10 — RLS, grants, audit and security pass

**Built (branch `feature/phase2-10-security`, on top of `main` after 2.8):**
- `supabase/migrations/008_client_grants.sql`: clients (`anon`, `authenticated`) lose TRUNCATE on all public tables, and for future tables. TRUNCATE skips RLS, so it is blocked at grant level. Row writes were already blocked by RLS.
- `supabase/migrations/009_audit_append_only.sql`:
  - Status changes on `tickets`, `orders`, `resale_listings`, `group_tickets` write one `audit_logs` row (`STATUS_CHANGED`, outcome `OLD -> NEW`). Owner changes on `tickets` write `OWNER_CHANGED`. Written by trigger, so edge functions do not need to remember it. Closes the "audit in 2.10" gap noted in 2.8.
  - `audit_logs` is append-only: UPDATE, DELETE and TRUNCATE are refused for every role, service role included.
- `supabase/APPLY_2_10_TO_SUPABASE_DEV.sql`: 008 + 009 with a dev header. Dev only. Safe to run twice.
- `supabase/tests/010_rls_and_grants.test.sql`: T82 to T90, one transaction, ends with ROLLBACK.
  - T82: buyers see only their own orders and tickets. T83: draft events are hidden from anon and attendees; published events are public. T84: resale listings, resale payments, group tickets and QR credentials are closed to clients. T85: no client can run any 2.8 function. T86: an unverified account is refused for list, buy, invite, keep and claim. T87: RLS is on for every public table. T88: the only write policy is `profiles_self_update`; no client can delete or truncate. T89: status and owner changes are audited, and a no-op update writes nothing. T90: `audit_logs` refuses UPDATE, DELETE and TRUNCATE.

**Tests:**
- Database (PGlite): full chain 001 to 007, then 008, 009, 010. All pass. Earlier suites re-run on the same code: 002, 002b (`run_apply23`), 004 inventory, 005 orders, 006 tickets. All pass.
- Mutation check (`mutate_rls.mjs`): 14 of 14 caught. Covers drafts visible, public read on listings and payments, owner policy opened, `can_transact` removed from list and claim, 2.8 functions granted to anon, TRUNCATE grant returned, extra write policy, RLS off, audit trigger on INSERT only, audit DELETE allowed, audit TRUNCATE trigger removed, status change not audited.
- Deno: 93 pass, 0 fail (unchanged).
- Gitleaks v8.24.2 over the repo: 2 hits, both test dummy values (`qr_test.ts` test key string and `devices_test.ts` generated test public key). No real secret found. Not added to an ignore list.
- Client code: no `service_role` or secret key in `apps/`. Mobile uses the anon key only.

**Not yet verified on dev:** the 008 and 009 SQL (`APPLY_2_10_TO_SUPABASE_DEV.sql`). Read-only checks are in the guide.

**Known gaps (2.10):**
- Audit rows have `actorId` NULL. The database does not know who made a change through the service role. Add the actor when the functions pass it in.
- Audit covers status and owner changes only. Inserts (a new listing, a new order) are not audited.
- No retention or purge path for `audit_logs`. Append-only also blocks the service role. A reviewed purge step is needed later.
- The 2.3 accepted gap is unchanged: reused refresh token does not revoke the family on dev (reuse checks 7 and 8 fail). 2.10 does not claim it is fixed.
- `apps/mobile/src/auth/session.ts` has a hardcoded demo OTP (`123456`) and demo emails `@truticket.test`. Dev uses `@example.com` and a `DEMO_OTP_CODE` secret. Replace in 2.9 (mobile wiring) and ensure the demo path is only reachable with `DEMO_MODE=true`.
- The OTP per-email limit (30 guesses per 15 min) is in `otp_flow.ts`, not yet in `limits.ts`.

## Phase 2.9 — Mobile wiring (Zip 1, 13 Nov)

Scope (PHASE2_PLAN §2.9, "as written"): replace the mock data behind `services/` with the API client, add `expo-camera`, and build a new EAS development client for the gate.

Done in this zip:
- [x] `src/services/` : `api.ts` (one HTTP client, errors as `ApiError`), `config.ts` (public values only), `errors.ts`, `types.ts`, `format.ts`, `mappers.ts` (pure API-row to app-shape mapping), `events.ts`, `tickets.ts`, `checkout.ts`, `gate.ts`
- [x] `src/auth/tokens.ts`: sign-in tokens in `expo-secure-store`; refresh before expiry; sign out on `AUTH_INVALID` or `SESSION_REVOKED`
- [x] `src/auth/session.ts`: Google ID token goes to `auth` (`action: google`); email code uses `otp_request` and `otp_verify`; demo account button sends the DEV demo code like any email
- [x] Home, categories, event detail, queue title, checkout, success, my tickets, ticket QR, gate scanner, gate result, paste-QR, activity: wired
- [x] Checkout: `reserve` (events) → `create` (orders) → browser opens `GET /functions/v1/checkout?order=<razorpay order id>`. Tickets come only from the webhook; success waits for them (up to 60 s)
- [x] New Edge Function `checkout` (no sign-in): Razorpay hosted checkout page, nonce CSP, key id only, no secret. Tests: 3 pass
- [x] `tickets` (`mine`) now also returns `events.id` and `ticket_types.id` (for the app). Redeploy `tickets` with the other functions
- [x] `app.json`: `expo-camera` plugin (camera permission text, QR only). `expo-secure-store` plugin
- [x] `eas.json`: development profile has `"environment": "development"` so EAS env values apply
- [x] `scripts/set-mobile-env-dev.ps1`: stores the DEV URL, anon key, and gate event id in EAS (prompts for the key; refuses production)

Not in this zip (on purpose):
- [ ] Resale and group screens are still mock (Phase 2.8 mobile wiring, next zip)
- [ ] FairQueue is still a timer (no server queue)
- [ ] Device registration screens (`devices` function) are UI only; Android Keystore attestation is skipped (demo device path, Phase 2b)
- [ ] Expo lint: the repo has no ESLint config for `apps/mobile`; `expo lint` asks to install one. Not added in this zip. Typecheck and bundle are the checks used.

Checks (13 Nov):
- `tsc --noEmit` (apps/mobile): pass
- `expo export --platform android` (bundle, Hermes): pass
- Mapper unit tests (Node test runner, sandbox): 12 of 12 pass. Mutants: ALREADY_USED mapping, DONE_STATUSES, min→max price: 3 of 3 caught
- Deno (all Edge Functions, incl. checkout page): 108 pass
- `deno check` for `checkout/index.ts` and `tickets/index.ts`: pass
- Lockfile: only `expo-camera` and `expo-secure-store` added (86 lines)

Fix 1 (13 Nov, after first device test): purchase blocked with "Verify your email and sign in again before you buy tickets."
- Cause: `session_can_transact()` (002b) needs the sign-in session linked to an ACTIVE device. The app never registered a device or sent `device_key_id`, so every buyer was blocked. Email was verified; the error was the device link.
- [x] `src/auth/device.ts`: device id in secure storage; `ensureDeviceLinked(userId)` = devices `challenge` → `register` (once per account; `DEVICE_EXISTS` counts as done)
- [x] `auth/session.ts`: sign-in (google, otp_verify) sends `device_key_id`; after sign-in the device link runs in the background (sign-in does not fail if it does)
- [x] `checkout/[id].tsx`: link runs before the hold, so existing sign-ins are fixed without signing in again
- Needs on DEV only: `ATTESTATION_REQUIRED=false` (Edge secret, `truticket-dev` ref). Production keeps attestation on (Phase 2b).
- Checks: `tsc --noEmit` pass; `expo export --platform android` pass (new code in bundle). DEV purchase test: pending (user).

Dev test (user, after deploy): demo attendee sign-in with the DEV demo code → events list → checkout with Razorpay test mode → tickets appear → QR → organiser scans (camera) → VALID, then ALREADY USED on the second scan.

## Phase 3 — Blockchain (Polygon Amoy, testnet)

**Built (branch `feature/phase3-chain`):**
- `contracts/contracts/TruTicket.sol`: OpenZeppelin 5.0.2 rewrite (the old v4 draft is gone). Roles: organiser, marketplace (backend), verifier (gate), admin. Resale cap 100%–200% of face value, transfer limit 1–10, cutoff per event, listing expiry 7 days. Direct wallet-to-wallet transfers and burns are refused. Group allocation is a zero-price move that does not count as a transfer. Redeem is one-way; a redeemed or listed ticket cannot be redeemed twice, resold or revoked.
- `listForResaleFor`: the backend lists on behalf of the on-chain owner. Users have custodial wallets and do not sign, so they never need MATIC.
- `contracts/test/TruTicket.test.js`: 34 Hardhat tests (mint, cap, resale, cutoff, transfer limit, re-check after policy change, allocation, redeem, pause, roles).
- `contracts/scripts/deploy.js` and `scripts/deploy-amoy.ps1`: deploy to Amoy. The private key is typed at a hidden prompt, kept in memory for that run, and never saved.
- `services/api/supabase/functions/_shared/chain.ts` (+ `chain_test.ts`, 12 tests): event key (keccak256 of the event UUID), custodial wallet derivation (HMAC of the master secret per user), policy arguments.
- `services/api/supabase/functions/_shared/truticket_abi.ts`: generated from the compiled artifact. Regenerate after any contract change.
- `services/api/supabase/functions/chain/index.ts`: internal function (needs `x-internal-secret`). Actions: `setup_event`, `mint`, `list`, `cancel`, `settle`, `allocate`, `redeem`. Mint claims the ticket row first (`tokenId` = `pending`), so two retries cannot mint twice. A chain error never changes DB ownership.
- `scanner_verify`: after a VALID scan, a best-effort call marks the NFT redeemed on chain. A chain failure does not change the gate result.
- `scripts/set-chain-secrets-dev.ps1`: sets the chain secrets on DEV only. Generates the master and internal secrets. Refuses to run twice (marker file).

**Tests:**
- Hardhat: 34 pass.
- Mutation check (`mutate_contract.py`): 13 of 13 caught (cap on list and settle, transfer limit, cutoff, expiry, direct transfer, redeem guards, allocation counts as transfer, cancel by others, roles, pause).
- Deno unit tests: 105 pass, 0 fail (93 before + 12 chain).
- Chain smoke on a local Hardhat node, using the same helpers as the Edge Function: 12 of 12 checks pass (policy, mint owner, list above cap refused, list at cap, settle owner, transfer count, allocate, redeem, double redeem refused, list after redeem refused).

**Not yet done (needs the user):**
- Amoy deploy (needs the test wallet and test MATIC from the faucet). Run `scripts/deploy-amoy.ps1`.
- PolygonScan verification (optional).
- `scripts/set-chain-secrets-dev.ps1` and `deploy-functions.ps1` on DEV.
- Mint on purchase, resale and group transfers: triggered by n8n (Phase 5). The n8n workflows are not finished yet.

**Known gaps (Phase 3):**
- Reconciliation: if a chain call fails after a DB change (e.g. redeem after a VALID scan), the chain and DB can disagree. n8n needs a retry job for tickets with `tokenId` set and no on-chain redeem.
- `CHAIN_MASTER_SECRET` loss or change makes every custodial wallet unreachable. Back it up once, outside the repo.
- Backend is the only signer. A compromised operator key can move any listed ticket. Testnet only; a hardware or multisig operator is needed before launch.
- Amoy RPC is public. Rate limits may slow mint under load.
- No gas budget or retry policy beyond one attempt per call.

## Phase 5 — n8n notifications and chain mint (Docker, polling, no public URL)

**Built (branch `feature/phase5-n8n`):**
- `supabase/migrations/011_notification_outbox.sql`: `notification_outbox` table. One row per notification. `dedupeKey` is unique, so a repeat insert is ignored. RLS is on and clients have no privileges; service role only. Dev only so far.
- `supabase/tests/011_notification_outbox.test.sql`: T91 to T95 (RLS and grants, dedupe, kind and status checks, valid update, profile delete cascades).
- `supabase/APPLY_PHASE5_OUTBOX_TO_SUPABASE_DEV.sql`: 011 with a dev header. Safe to run twice.
- `n8n/workflows/` (8 files, replace the two invalid drafts):
  - `tt-01-payment-confirmation`: order TICKET_ISSUED -> outbox PAYMENT_CONFIRMED to the buyer. (Fixed 13 Nov: the query used `ISSUED`, which is not an order status.)
  - `tt-02-event-published`: event published -> outbox EVENT_PUBLISHED to the organiser.
  - `tt-03-resale-listed`: resale listing ACTIVE -> outbox RESALE_OFFER to the seller. A real waitlist offer needs a waitlist table, which does not exist yet.
  - `tt-04-ticket-reminder`: ISSUED_ACTIVE ticket, event within 24 h -> outbox QR_EXPIRY_WARNING (a reminder; the QR lasts 10 s, so the name is kept only for the plan).
  - `tt-05-ticket-redeemed`: VALID redemption -> outbox TICKET_REDEEMED to the holder.
  - `tt-06-payment-cleanup`: PAYMENT_PENDING for 30 min or more -> outbox PAYMENT_CLEANUP to the buyer. Does NOT release seats (holds expire by time only).
  - `tt-07-outbox-sender`: sends PENDING rows through Brevo (max 5 attempts), then marks SENT or FAILED.
  - `tt-08-chain-mint`: ISSUED_ACTIVE tickets with no `tokenId` -> chain function `mint`.
- Removed: the old `payment-confirmation.json` and `qr-expiry-warning.json` drafts (invalid node types).
- `infra/docker-compose.yml`: ML service removed (ML excluded). n8n reads `infra/.env`. Basic-auth password is required, not `changeme`. No public URL: workflows poll every minute. Workflows mounted read-only at `/home/node/workflows`.
- `infra/.env.example`: template. The real `infra/.env` is never committed.
- `scripts/setup-n8n-dev.ps1`: checks infra/.env is DEV (refuses production), asks for the Brevo key and sender in hidden or plain prompts, makes an n8n password if missing, starts Docker n8n, imports the 8 workflows and activates them.

**Tests:**
- Database (PGlite): full chain 001 to 010, then 011. T91 to T95 pass.
- Mutation check (`run_outbox.mjs`): 4 of 4 caught (dedupe not unique, kind check removed, RLS off, client grants not revoked).
- Code nodes (`run_code_nodes.mjs`): tt-01 row shape and empty-buyer skip; tt-07 email for all 7 kinds with real payload shapes; organiser title is HTML-escaped in the email. Pass. (Fixed 13 Nov: the email body injected the event title unescaped.)
- Workflow JSON (`validate.py`): 8 of 8 pass. Checks: valid JSON, one trigger, node types and typeVersions from n8n-nodes-base 2.15.1, every connection points at a real node, every node reachable, expressions start with `=`.
- NOT verified: a live n8n run. The sandbox could not install n8n (native build and network timeouts). Import and run on the user PC is the test.

**Not done / decisions needed:**
- `group-invite` (PLAN Phase 5 item 8) is NOT a workflow. The `groups` function already sends the invite email (2.8). A second email would duplicate it.
- Resale, group and redeem chain sync (list, settle, allocate) are not wired. Only mint is.
- Retries: a failed email is retried up to 5 times, then stays FAILED. A failed mint is retried every minute.
- Email send: Brevo endpoint `https://api.brevo.com/v3/smtp/email` with `api-key` header. Confirm on developers.brevo.com before the demo. The Brevo key in earlier chat must be rotated.
- Event alert goes to the organiser only. No subscriber list exists.

**Known gaps (Phase 5):**
- Polling delays: up to about 1 minute per step (mint, then email).
- The producers read the last day only. Rows older than a day are not picked up after an n8n outage longer than a day.
- Outbox rows have no cleanup path (keep for audit; purge later).
- Email recipient with no profile email is retried 5 times then FAILED.
