# Phase 2 plan: Backend core (free auth, sessions, ticketing)

Status: **APPROVED** (as written). Decisions: Prisma dropped; Android key attestation in Phase 2.
Work packages run in order. Package 2.1 is in progress.
Source: `docs/PLAN.md` §5 Phase 2 and §6, PRD v2.0. Mobile is Phase 1 (screens built). Web is Phase 4 (screens built ahead of plan; wiring happens in Phase 5).

## 1. Goal

Replace the mock layer with real data, behind Supabase, for the free-tier flow:
Google sign-in, Email OTP, one active session, one active device, verified-email gate, inventory reservation, ticket issue with a rotating QR, gate redemption, and Razorpay Test-mode payment.

**Done when:** the mobile purchase-to-entry flow runs on real data in the test environment, and an unverified user is blocked at the database level.

## 2. In scope

| Area | What ships |
|---|---|
| Database | Migrations `002_auth_sessions.sql`, `003_seed.sql`, `004_functions.sql` on top of `001_init.sql`. RLS on every table. |
| Auth | Google One-Tap via Supabase `signInWithIdToken` (server verifies the ID token). Email OTP: 6 digits, 10-minute expiry, 5 attempts per code, 60-second resend cooldown. Email normalisation for the duplicate key only. |
| Verification gate | `can_transact` enforced in SQL functions and RLS. Buying, reselling and creating events need a verified email. |
| Sessions | One active session per account. Access token 15 minutes. Refresh-token rotation with reuse detection (a reused token revokes the whole family). Sensitive actions re-check the session. |
| Devices | Device key in Keychain or Keystore. Public key stored in `user_devices`. One active device. Android key-attestation chain verified server-side (free). iOS Secure Enclave key, no attestation until Launch. New device: email OTP, then a 48-hour cooldown. Old device gets an email. |
| Rate limits | Postgres `rate_limits` table, checked in Edge Functions. Limits from PLAN §5: OTP send, OTP verify, login, sign-up. Supabase built-in auth limits also on. |
| Ticketing | Atomic inventory reservation with expiry. Orders with Razorpay Test: create order, verify signature, webhook with idempotency. Tickets issued with a rotating QR nonce. Gate redemption is idempotent and the nonce is single-use. |
| Queue | FairQueue (server-side positions). Realtime is Phase 5. |
| Resale | Price-cap check (face × capBps / 10000) in the function. Transfers recorded. On-chain transfer is Phase 3. |
| Group tickets | FR-027 allocation and claim, server-side. |
| Risk | Rules-based `/score` placeholder per `docs/ML_BRIEF.md`. Fails closed for HIGH. No ML work. |
| Audit | Append-only `audit_logs` for admin, gate and payment events. |
| Mobile | Replace `src/mock/` calls behind the existing `services/` layer. Screens do not change. Gate scanner: add `expo-camera` in a new EAS dev build. |
| Web | Only the auth and session plumbing needed to test (Google sign-in and Email OTP). Full web wiring is Phase 5. |

## 3. Out of scope (Launch, Phase 2b)

Apple Sign-In, Play Integrity, App Attest, phone OTP at checkout, custom SMTP. Blockchain is Phase 3. n8n workflows are Phase 5. ML models are excluded from this build.

## 4. Work packages (in order)

Each package ends with a test run and a short entry in `docs/PROGRESS.md`.

**2.1 Database foundation**
- Apply `002_auth_sessions.sql`: `user_emails` (verified_at, unique normalised key), `user_identities` (provider, provider_subject, unique), `user_sessions`, `user_devices`, `rate_limits`.
- RLS on all tables. Default deny.
- Done when: RLS tests pass for "attendee cannot read others' rows" and "anon cannot read draft events".

**2.2 Auth and verification**
- Google ID-token exchange (Edge Function `auth`). Store the Google subject, unique.
- Email OTP send and verify (Edge Function `auth`). Store only a hash of the OTP.
- Duplicate check on normalised email. Message: "this email is already linked", with a recovery path.
- Done when: a new user can sign in with Google or Email OTP, and the verified flag is set.

**2.3 Sessions and devices**
- Session create and revoke. A new login revokes the old session and sends a notification.
- Refresh rotation with reuse detection.
- Device key registration. Android attestation check. New-device flow (OTP plus 48-hour cooldown, old-device email).
- Done when: second login revokes the first; a reused refresh token revokes the family; a new device is blocked for 48 hours without OTP.

**2.4 Rate limits**
- `rate_limits` table and a shared check helper used by all auth functions.
- Done when: the OTP brute-force test is blocked after 5 wrong tries.

**2.5 Events and inventory**
- Migrate `003_seed.sql`: demo attendee and organiser (pre-verified), demo event, 3 ticket types (GA, VIP, Student), one scanner device.
- Edge Function `events` (read) and `events/create` (organiser; draft only until admin approval).
- Reservation function in `004_functions.sql`: atomic, with expiry.
- Done when: the mobile event screen and queue read real inventory.

**2.6 Orders and payments (Razorpay Test)**
- `orders` function: create a Razorpay order. Reserve inventory first.
- Webhook: verify the HMAC signature, check idempotency, then mark the order paid and issue tickets.
- Failure webhook releases the reservation.
- Done when: a Test-mode payment produces tickets and a settlement row, and a replayed webhook changes nothing.

**2.7 Tickets, QR and gate**
- Ticket issue with a rotating QR nonce (10-second TTL, per PRD §6.4).
- Scanner verify (Edge Function `scanner/verify`): VALID, ALREADY_USED, EXPIRED, WRONG_EVENT, INVALID. Redemption idempotent.
- Done when: the same QR scanned twice in the same second produces one VALID and one ALREADY_USED.

**2.8 Resale and group tickets**
- Resale listing and buy. Price-cap check in the function. Transfer count enforced.
- Group allocation and claim (FR-027).
- Done when: a listing above the cap is rejected, and a group invite can be claimed once.

**2.9 Mobile wiring**
- Replace each mock module behind `services/` with the API client. One module per PR.
- Add `expo-camera` and a new EAS dev build for the gate scanner.
- Done when: the flow in PLAN §5 Phase 1 "done when" runs against the dev project.

**2.10 Tests and security pass**
- RLS tests (listed in PLAN §5 Phase 2).
- Auth tests: second login revokes the first; reused refresh revokes the family; OTP brute force blocked.
- Gitleaks scan before delivery. Mobile uses the anon key only. `service_role` only in Edge Functions.

## 5. What we need from you

| Item | Why | Status |
|---|---|---|
| Supabase project access and CLI login on your machine | Apply migrations, deploy functions | Project exists. Need CLI login and the project ref. |
| Google OAuth client IDs (Android, Web) | Google sign-in | Android and Web client IDs are already in use. Confirm both are on the dev project. |
| Razorpay Test key ID and secret | Payments | Not yet. Keep them in local `.env` only. |
| Supabase email SMTP | Email OTP | Built-in email is fine for dev. Custom SMTP is Launch. |

Secrets never go in repo files.

## 6. Decisions to confirm

1. **Prisma. DECIDED: dropped.** Supabase migrations are the only schema source.
2. **Android key attestation in Phase 2. DECIDED: yes.**
3. **Demo accounts.** Pre-verified demo attendee and organiser, enabled only when `DEMO_MODE=true`, as agreed in Plan v3. Confirm `DEMO_MODE` is off in any non-test build.
4. **Gate scanning before Phase 2.7.** Keep the sample buttons until the real scanner is wired, or ship the camera build first?

## 7. Risks

| Risk | Mitigation |
|---|---|
| Duplicate accounts with email aliases | Normalised key with a unique constraint. Known partial control until Launch (PLAN §6.4). |
| Rooted iOS device creates a key | Known limit. Session limits now, App Attest at Launch. Stated honestly. |
| Supabase email rate limits in dev | Use the built-in limit plus our rate table. Test with a few real inboxes. |
| Razorpay webhook replays | Idempotency key per order. Replay test in 2.6. |
| Scope creep toward PRD's 34 screens | Phase 2 adds no new screens. New ideas go to the backlog. |

## 8. Delivery

- Same workflow as before: branch per package, PR, merge, `docs/PROGRESS.md` updated at the end of the phase.
- Each package ships as a zip plus robocopy or PowerShell steps, as in earlier batches.
