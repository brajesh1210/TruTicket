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
- `scripts/test-sessions-dev.ps1`: the three "done when" checks, dev project only (refuses production and any other ref).

**Tests:**
- Database (PGlite, Postgres 18): `002b_sessions_devices.test.sql`, T15 to T24, all pass. The chain runs stubs, 001, 002, 002b, 002 test, 002b test. Re-applying the dev file twice is OK.
- Mutation check (`mutate3.mjs`, 7 mutants): every mutant is caught (device not checked, revoked session passes, other user's session passes, pending device passes, revoke-all, client can revoke, challenges readable, Supabase-ended session passes).
- Deno unit tests: 60 pass (der 4, devices 7, session token 5, attestation 18, email 3, otp 7, identity 9, google claims 7). Attestation tests use synthetic chains under a test root; the five pinned roots are checked to parse and to hold the two known keys.
- `deno check` passes for `auth/index.ts` and `devices/index.ts`.
- Live, no database: `auth` GET 405, bad JSON 400, unknown action 400, bad email 400. `devices` GET 405, no token 401 `AUTH_REQUIRED`, bad token 401 `AUTH_INVALID`, bad JSON 400.
- PowerShell 7.4.6 parse OK for all four scripts. Production guards tested: prod ref refused, wrong ref refused, nothing staged.

**Not yet tested (needs the dev project or a phone):**
- Real Supabase: `revoke_auth_sessions` on the real `auth.sessions`, and that the `session_id` claim is present on dev tokens (the guide has a check).
- Refresh-token reuse on dev (`scripts/test-sessions-dev.ps1`, step 3). Depends on the dashboard setting "Detect and revoke compromised tokens".
- Real Android key attestation on a phone. Needs the 2.9 EAS dev build and Keystore code. Until then, dev runs with `ATTESTATION_REQUIRED=false`, which must never be set on production.

**Decisions made in 2.3 (confirm with the user):**
- A new sign-in on any device ends the previous session at once. The old device is signed out at that moment.
- A new device is blocked until 48 hours have passed AND the code sent to the verified email is entered. Both are required. The code alone does not skip the cooldown.
- Attestation roots are pinned as public keys (the 5 certificates on the official page). Google's revocation list must load, or device registration fails closed (503).
- Refresh rotation: Supabase built-in. Reuse detection is the dashboard setting, not code.
- Activation revokes the old active device first, then activates the new one (the unique index allows one active device).

**Open:**
- Gmail-only email normalisation (PHASE2_PLAN §6). Still open.
- Brevo sender domain (SPF/DKIM) before real users.
- Mobile wiring for challenge and register (2.9).
- Production (`ccqbubgebsayoviilnul`): not touched. 002b, functions and secrets are not applied there. Needs explicit approval.
