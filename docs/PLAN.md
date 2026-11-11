# TruTicket — Execution Plan (v3, free-first auth)

_Date: 2026-11-08 · Owner: Brajesh · Spec: TruTicket Master Unified PRD v2.0 (authoritative)_

## 0. What changed in v3 and why

| # | Change | Reason |
|---|---|---|
| C1 | Auth is now **free-first**: Google One-Tap + Email OTP. Apple Sign-In, phone OTP, Play Integrity and App Attest move to a **Launch phase (2b)**. | User asked for the best completely free option. Paid items need Play Console ($25 once) and Apple Developer ($99/yr). |
| C2 | Transaction gate = **verified email** (free). Phone verification is added at launch. | Email is free to verify. Phone adds stronger duplicate protection later. |
| C3 | Device binding uses a **device key** in Keychain (iOS) or Keystore (Android). On Android, hardware-backed **Keystore key attestation** is added (free, does not need Play Console). | Gives device binding without paid services. |
| C4 | Single active session per account. Short access tokens, refresh rotation. | User requirement. |
| C5 | Rate limiting on OTP, login and sign-up, using Postgres counters in Edge Functions. | User requirement. Free. |
| C6 | Duplicate account check: email normalised (lowercase, Gmail dots and +tags removed) and unique; Google subject unique. | Free protection against the most common duplicate tricks. |
| C7 | Web (organiser and admin) uses TOTP 2FA. | Web cannot do device attestation. TOTP is free. |
| C8 | **Corrected count.** v2 said 21 mobile screens. The correct count for v2 was 22. v3 is 22 mobile and 18 web (total 40). | Ginti galat thi, ab theek hai. |
| C9 | Git: workspace only (D8 from v1 still applies). | User decision. |

## 1. Decisions

| # | Decision |
|---|---|
| D1 | Mobile app first, then web. |
| D2 | Supplied logo (`uploads/image-2.png`) is the official brand logo. |
| D3 | Supplied reference screens define the UI. We build them now; Ansh and Shivam refine later. |
| D4 | ML is not in this plan's scope (friend's track). Backend uses a rules-based placeholder score. Brief: `docs/ML_BRIEF.md`. |
| D5 | Plan first, then execute. |
| D6 | **Free auth now:** Google One-Tap and Email OTP. |
| D7 | **Transacting** (buy, resell, create event, organiser actions) requires a **verified email** now, and a verified phone at launch. |
| D8 | No git commits for now. Workspace only. Code delivered as zip + robocopy commands. |
| D9 | No Aadhaar or government-ID KYC for attendees. |
| D10 | One verified email = one active account. Duplicate checks use normalised email and Google subject. |
| D11 | Demo accounts (attendee and organiser) are pre-verified. Demo OTP works only with `DEMO_MODE=true`. |
| D12 | Device binding now uses device keys. Android key attestation is added in Phase 2. iOS attestation (App Attest) waits for Launch. |
| D13 | Launch phase adds: Apple Sign-In, phone OTP at checkout, Play Integrity, App Attest. Architecture is designed for these now, so they plug in without rewrites. |

## 2. Cost

| Item | Cost | When |
|---|---|---|
| Google sign-in (One-Tap, OAuth client) | Free | Now |
| Email OTP (Supabase built-in for dev; free-tier custom SMTP for production) | Free at low volume | Now (dev), Launch (production SMTP) |
| Supabase | Free tier for development | Now |
| Android Keystore key attestation | Free | Phase 2 |
| Google Play Console | $25 one-time | Launch (for Play Integrity and Play Store release) |
| Apple Developer Program | $99 per year | Launch (for Apple Sign-In, App Attest, TestFlight, App Store) |
| Play Integrity API | Free; default 10,000 checks/day per app | Launch |
| App Attest | Free with Apple program | Launch |
| SMS OTP (DLT-registered gateway) | Per message, paid | Launch |
| Razorpay | Per transaction, unavoidable | Phase 5 onwards |

Development and demo cost: **zero rupees, zero dollars.** Launch cost: about $124 for the first year, plus SMS and payment fees.

## 3. Brand & Design Tokens (from logo and screens)

| Token | Value | Source |
|---|---|---|
| Brand cyan | `#0ACBDB` | Logo mark |
| CTA cyan | `#1FCBCD` | Button fill in screens |
| Base background | `#0B0B0B` | Logo tile |
| Surface (cards) | `#0A1423` to `#111827` | Screen backgrounds |
| Text primary | `#FFFFFF` | Headings |
| Text muted | `#9CA3AF` | Body copy |
| Accent purple | `#8B7CF6` (approx.) | VIP tier, links |
| Premium amber | `#F5A524` (approx.) | Premium seating, medium risk |
| Success green | `#22C55E` | Valid, verified, confirmed |
| Danger red | `#EF4444` | Invalid, revoked, high risk |
| Font | Inter (fallback: system UI) | Matches screens |
| Radius | 12px cards, 14px buttons, 24px phone frame | Observed |

Approximate colours are confirmed in Phase 0.

## 4. Screen Inventory (40 screens)

PRD baseline is 34. v3 adds 6 auth and verification screens (flagged). Launch phase adds 2 more (phone entry and OTP).

### Mobile — 22 screens (Expo, Android first)
| Group | Screens |
|---|---|
| Onboarding (3) | Onboarding 1 (Discover), 2 (Fair Queue), 3 (Verified Entry) |
| Login & verification (5, 4 new) | Login (Google One-Tap; Apple button hidden until Launch), Email entry (new), Email OTP entry (new), New-device verification (new), "Verify email to continue" gate (new) |
| Attendee purchase (6) | Explore home, Event detail, FairQueue waiting room, Select tickets, Checkout (Razorpay), Booking success |
| Tickets, resale & profile (4) | My Tickets (Upcoming / Past / Listed), Ticket detail (dynamic QR + Ticket DNA), Resale marketplace, Profile |
| Gate scanner (4) | Scanner camera, Valid / result states, Scan activity, Manual lookup |

### Web — 18 screens (Next.js)
| Group | Screens |
|---|---|
| Organiser (8 + 2 new) | Overview, Create event (5-step wizard), Event detail, Ticket inventory, Resale policy, Fraud monitoring, Gate staff, Payouts. New: Organisation details, Verification status |
| Platform admin (8) | Platform overview, User management, Event moderation, Emergency protocol, Audit logs, Risk events, Session investigation, Appeal review |

Public web pages (landing, public event page, web login, TOTP setup) are not counted, like the v1 plan.

### Launch-phase additions (not in the 40)
- Phone entry, phone OTP (2 mobile screens)
- Apple Sign-In button goes live (existing login screen)

## 5. Phases

Order: **mobile first, then web.** Backend and blockchain run in parallel once the mobile UI exists.

### Phase 0 — Brand & Design System (S) — DONE (2026-11-04)
- Logo assets in `assets/brand/`: mark (SVG + PNG), app icon 1024px, Android adaptive icon, splash, favicon, OG image.
- `packages/ui-tokens/` with colours, type, spacing, radius as JSON.
- Shared components: Button, Input, OTP input, Card, Chip, Tabs, Bottom nav, Sidebar, Badge (Verified, Compliant, Valid, Already Used, Revoked), KPI tile, Data table, QR frame, Queue ring, Ticket card, Price-cap bar, Social login button (Google, Apple).
- Deliverable: `docs/DESIGN_SYSTEM.md` and `/styleguide` page on web.
- Done when: style guide renders every component in dark theme.

### Phase 1 — Mobile UI with mock data (L) — MOBILE SCREENS BUILT (batch 3 done; on-device test pending; web not started)
- Expo app (current SDK, TypeScript, Expo Router). Replace starter screens in `apps/mobile/`.
- Build 22 mobile screens with mock data (Coldplay, Arijit Singh, Taylor Swift, Billie Eilish from references).
- Navigation: 4-tab bottom bar (Home, Categories, Tickets, Profile). Gate staff get a separate scanner stack.
- Mock layer behind `services/`, so real APIs replace it without screen changes.
- Batch 3 (built): Categories, Resale marketplace, Sell-a-ticket (price cap, PRD 6.5), Group distribution manager (FR-027), New-device verification (demo), Security & devices, Gate scanner (camera view, scan result, activity log, manual lookup). Ticket DNA section added to ticket detail. Gate QR window set to 10 s per PRD 6.4.
- Mock limits (replaced in Phase 2): gate scanning uses sample buttons until expo-camera is in a new EAS dev build; redeemed set is in memory; resale and group state reset on app reload.
- Done when: all 22 screens are reachable on Expo Go (Android). Flow works: onboarding → login → email OTP → explore → event → queue → select → checkout (mock) → success → my tickets → QR.

### Phase 2 — Backend core: Free auth, sessions, ticketing (L) — APPROVED 2026-11; 2.1 database in progress
**Auth**
- Google One-Tap: server verifies the Google ID token (Supabase `signInWithIdToken`). Google subject stored and unique.
- Email OTP: 6-digit code, 10-minute expiry, 5 attempts per code, 60-second resend cooldown.
- Email normalisation for duplicate checks (lowercase; Gmail dots and +tags removed for the duplicate key only; original address kept for sending).
- Verified email is the transaction gate. `can_transact` is enforced in DB (RLS and functions).

**Sessions (strict)**
- One active session per account. New login revokes the previous session.
- Table `user_sessions` (session_id, user_id, device_key_id, created_at, last_seen, revoked_at).
- Access token 15 minutes. Refresh token rotation with reuse detection (a reused refresh token revokes the whole session family).
- Sensitive actions (checkout, QR refresh, resale) re-check that the session is active.

**Device binding (free)**
- App creates a device key in Keychain (iOS) or Keystore (Android), stored hardware-backed where available.
- Public key registered to account (`user_devices`). Limit: 1 active device.
- Android: key attestation certificate chain verified server-side (free, no Play Console needed). iOS: Secure Enclave key, no attestation until Launch.
- New device: email OTP re-verification plus a 48-hour cooldown before the new device becomes active. Old device is notified by email.
- Known limit: without attestation on iOS, a rooted or modified device can still create a key. Stated honestly.

**Rate limiting (free)**
- Postgres table `rate_limits` (key, window_start, count). Checked in Edge Functions.
- Limits: OTP send 5 per email per hour and 20 per IP per hour; OTP verify 5 wrong tries per code; login 10 per email per 15 min; sign-up 3 per IP per hour.
- Supabase's built-in auth limits also enabled.

**Web admin and organiser**
- Google One-Tap or Email OTP, then TOTP 2FA (mandatory for organiser and admin roles).

**Data and seed**
- Migration `002_auth_sessions.sql`: `user_emails` (verified_at, unique normalised key), `user_identities` (provider, provider_subject, unique), `user_sessions`, `user_devices`, `rate_limits`. Prisma dropped (approved decision): the SQL migrations are the only schema source.
- Seed `003_seed.sql`: demo attendee and organiser (pre-verified), demo event (Coldplay-style), 3 ticket types (GA, VIP, Student), one scanner device.
- Functions `004_functions.sql`: atomic inventory reservation with expiry, idempotent gate redemption, resale price-cap check, verification-gate check.

**Other backend**
- Edge Functions (complete drafts in `services/api/`): auth helpers, events, orders, payments (Razorpay Test: create order, verify signature, webhook), tickets (issue + dynamic QR with rotating nonce), queue (FairQueue), resale, group tickets (FR-027), scanner verify, audit logs.
- Risk placeholder: rules-based `/score` (contract in `docs/ML_BRIEF.md`). Fails closed for HIGH.

**Tests**
- RLS: attendee cannot read others' tickets; anon cannot read draft events; unverified user cannot create an order.
- Auth: second login revokes first session; reused refresh token revokes session family; OTP brute-force blocked.

Done when: mobile flow works on real data in test environment, and an unverified user is blocked at DB level.

### Phase 2b — Launch security (after Play Console and Apple account are bought) (M)
- Apple Sign-In (required on iOS if Google login is offered).
- Play Integrity checks at login, new device and checkout.
- App Attest on iOS at login, new device and checkout.
- Phone OTP (DLT-registered gateway) as checkout gate for buyers.
- Custom SMTP for production email OTP.
- Done when: a modified APK or emulator is blocked at login, and a buyer without a verified phone cannot checkout.

### Phase 3 — Blockchain (Polygon Amoy) (M)
- `contracts/`: `npm install`, `npx hardhat compile` passing.
- Hardhat tests: mint, price cap, resale transfer, group allocation, redemption, pause/unpause.
- Deploy to Amoy; verify on PolygonScan.
- Backend: mint on purchase, store `contractAddress` and `tokenId`, on-chain transfer on resale, on-chain redemption flag on scan.
- Done when: a purchase creates a testnet token and a scan updates it.

### Phase 4 — Web UI (Next.js) (L)
- `apps/web/` (App Router, Tailwind) using `packages/ui-tokens`.
- Web login: Google Identity Services (One-Tap) and Email OTP. TOTP setup and verification for organiser and admin.
- Organiser layout (sidebar + topbar) and admin layout (same shell, different nav).
- Build 18 web screens with mock data, then wire to Phase 2 APIs.
- Done when: all 18 pages render, and an organiser can create an event and see inventory.

### Phase 5 — Integration & Automation (M)
- Replace mocks with real APIs, one module at a time.
- Realtime queue position and live scan activity.
- n8n: all 9 PRD workflows (2 drafts exist today).
- Razorpay Test end-to-end: order, test payment (card or UPI), webhook, tickets issued.

### Phase 6 — QA, Security, Demo (M)
- Mobile: Maestro flows for purchase and scan. Web: Playwright smoke tests.
- Security checklist: no secrets in repo (gitleaks before each delivery), mobile uses anon key only, service_role only in Edge Functions, Razorpay signature verified, QR nonce single-use, input validation on every function, OTP and login brute-force limits tested.
- Demo: rehearse PRD Section 20 (7 min). PRD Section 21 fallbacks (video, offline mode, seeded data).
- Done when: demo runs twice in a row without manual fixes.

### Phase 7 — Handover to Ansh & Shivam (S)
- Update `docs/TEAM_HANDOFF.md`: built vs mock screens, component list, how to run each app.
- `ui-refine` issue list for Ansh and Shivam.
- Done when: both apps run from a fresh clone using the README only.

## 6. Login & Verification Detail

### 6.1 Login methods
| Method | Now | Launch |
|---|---|---|
| Google One-Tap | Yes (Android, iOS, Web) | Yes |
| Email OTP | Yes (all platforms) | Yes |
| Apple Sign-In | Hidden in UI | Yes (required on iOS if Google is offered) |
| Phone OTP | No | Yes, as checkout gate |

After first login the account is **logged in, not verified for transactions**. Browsing is free. Buying, reselling, or creating an event requires a verified email now and a verified phone at launch.

### 6.2 Email OTP flow (target under 60 seconds)
1. Enter email. Normalised for duplicate check.
2. 6-digit code sent. Code valid 10 minutes.
3. Enter code. Email marked verified. If the normalised email belongs to another account, show "this email is already linked" with recovery.
4. Session created, device key registered (or new-device flow).
5. Return to the action the user was trying to do.

### 6.3 Sessions and devices
- One active session per account. A new login on another device signs out the old one, with a notification.
- One active device per account. Changing device needs email OTP and a 48-hour cooldown. Old device gets an email.
- Web sessions follow the same single-session rule, plus TOTP for organiser and admin roles.

### 6.4 Abuse controls
- OTP and login limits (Phase 2 table above).
- Gmail alias abuse blocked by normalised email.
- Same device creating many accounts: flagged to risk score (ML track).
- Honest limit: a determined person can still create several accounts with several emails and phones. Until Launch (phone + attestation), duplicate control is partial. We state this in the plan and do not claim more.

## 7. Git & Progress Workflow
- **Workspace only, no commits for now (D8).** Each delivery is a zip of the full project plus robocopy commands for the user's local folder.
- `docs/PROGRESS.md` updated at the end of every phase.
- Secrets stay in local `.env` only. Keys for Razorpay, Supabase service role, Google client secret, SMTP, SMS (later), Apple and Play (later), and the Amoy deployer wallet are never placed in repo files.
- Demo credentials saved to `DEMO_CREDENTIALS.local.md`, listed in `.gitignore`.

## 8. What I need from you (blockers)

| Item | Needed for | When | Cost |
|---|---|---|---|
| Brand colours confirmed (or accept tokens) | Phase 0 | Now | Free |
| Google OAuth client IDs (Android, iOS, Web) | Phase 1 real login, Phase 2 | Now | Free |
| Supabase project access (already exists) | Phase 2 | Now | Free tier |
| SMTP provider for production email | Launch | Launch | Free tier available |
| Razorpay Test key ID and secret | Phase 5 | Phase 5 | Free (test mode) |
| Amoy testnet wallet private key | Phase 3 | Phase 3 | Free (testnet) |
| Supabase CLI login on your machine | Phase 2 deploy | Now | Free |
| Android phone with Expo Go | Phase 1 testing | Now | Free |
| Google Play Console | Play Integrity, Play release | Launch | $25 once |
| Apple Developer Program | Apple Sign-In, App Attest, iOS release | Launch | $99 per year |
| DLT registration and SMS gateway | Phone OTP | Launch | Per-SMS cost |

Organiser verification (D-O1): default is **verified email + TOTP 2FA** (free). GST and PAN checks come before real payouts. Confirm this default when you approve.

## 9. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Duplicate accounts via email aliases | Normalised email key, unique constraint, Google subject unique. Phone + attestation at Launch. |
| Lost or changed phone | New-device flow with email OTP and 48-hour cooldown. Support path documented. |
| Rooted or modified device on iOS (no attestation until Launch) | Secure Enclave key + session limits now; App Attest at Launch. Known limit. |
| Email OTP delivery issues | Custom SMTP before production; resend cooldown; spam guidance in UI. |
| Apple requirement on iOS | Apple Sign-In at Launch, before any iOS release (X8 from v2 still applies). |
| Scope growth beyond PRD's 34 screens | 40 now, 42 at Launch. New ideas go to backlog. |
| Reference screens are images | Treat as target look. Refine with Ansh and Shivam. |
| ML deferred | Rules-based score behind one function. ML plugs in later. |
| Expo and Next.js versions change fast | Pin versions in `package.json`. Record in README. |

## 10. Next step after approval
1. Phase 0: logo assets, `packages/ui-tokens`, style-guide page.
2. Phase 1 starts with login (Google One-Tap, Email OTP) and the new-device and verification screens.
