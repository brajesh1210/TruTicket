-- ============================================================================
-- TruTicket — APPLY_TO_SUPABASE_DEV.sql  (Phase 2, packages 2.1 + 2.2 DB side)
-- Paste the WHOLE file into Supabase SQL Editor (DEV project only) and click Run.
-- It runs in ONE transaction: if any step fails, nothing is changed.
-- Contents, in order:
--   1. 001_init.sql          (safe to re-run)
--   2. delete orphan profile rows (profiles with no login account; they were
--      created before real sign-in existed and cannot be used)
--   3. 002_auth_sessions.sql
-- Source of truth: supabase/migrations/. If those files change, regenerate this file.
-- ============================================================================
BEGIN;

-- ---------- Step 1: 001_init.sql ----------
-- ============================================================================
-- TruTicket — 001_init.sql
-- Creates all Prisma-mapped tables (18 models) in dependency order.
-- Column names match prisma/schema.prisma exactly (camelCase, quoted).
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Run the WHOLE file in one go in Supabase SQL Editor.
-- ============================================================================

-- ---------- 1. ENUM TYPES (names match Prisma enums) ----------
DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('ATTENDEE','ORGANIZER','GATE_STAFF','FRAUD_REVIEWER','PLATFORM_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "TicketStatus" AS ENUM ('CREATED','AVAILABLE','ISSUED_ACTIVE','ISSUED_UNASSIGNED_GROUP','LISTED','TRANSFERRED','REDEEMED','REVOKED','CANCELLED','REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "OrderStatus" AS ENUM ('CREATED','RESERVED','PAYMENT_PENDING','PAID','TICKET_ISSUED','PAYMENT_FAILED','RESERVATION_EXPIRED','CANCELLED','REFUND_PENDING','REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ResaleListingStatus" AS ENUM ('DRAFT','ACTIVE','PURCHASE_PENDING','TRANSFER_PENDING','COMPLETED','CANCELLED','EXPIRED','PAYMENT_FAILED','TRANSFER_FAILED','DISPUTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "QueueAllocationStatus" AS ENUM ('JOINED','SELECTED','ADMITTED','EXPIRED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "RiskBand" AS ENUM ('LOW','MEDIUM','HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 2. TABLES (parents first, children after) ----------

-- profiles (no FK dependencies)
CREATE TABLE IF NOT EXISTS profiles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  phone          text,
  "passwordHash" text,
  role           "UserRole" NOT NULL DEFAULT 'ATTENDEE',
  status         text NOT NULL DEFAULT 'active',
  "createdAt"    timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz(3) NOT NULL DEFAULT now()
);

-- organizers -> profiles
CREATE TABLE IF NOT EXISTS organizers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"            uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  "organizationName"  text NOT NULL,
  "verificationStatus" text NOT NULL DEFAULT 'pending',
  "createdAt"         timestamptz(3) NOT NULL DEFAULT now()
);

-- events -> organizers
CREATE TABLE IF NOT EXISTS events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizerId"   uuid NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  venue           text NOT NULL,
  timezone        text NOT NULL DEFAULT 'Asia/Kolkata',
  "startAt"       timestamptz(3) NOT NULL,
  "endAt"         timestamptz(3) NOT NULL,
  "coverImageUrl" text,
  categories      text[] NOT NULL DEFAULT '{}',
  terms           text,
  status          text NOT NULL DEFAULT 'draft',
  "contractAddress" text,
  "chainId"       integer,
  "createdAt"     timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz(3) NOT NULL DEFAULT now()
);

-- ticket_types -> events
CREATE TABLE IF NOT EXISTS ticket_types (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"         uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name              text NOT NULL,
  "faceValueMinor"  integer NOT NULL,
  currency          text NOT NULL DEFAULT 'INR',
  quantity          integer NOT NULL,
  "saleStart"       timestamptz(3) NOT NULL,
  "saleEnd"         timestamptz(3) NOT NULL,
  "perAccountLimit" integer NOT NULL DEFAULT 4,
  "refundRules"     text,
  "createdAt"       timestamptz(3) NOT NULL DEFAULT now()
);

-- scanners -> events   (MUST be before redemptions)
CREATE TABLE IF NOT EXISTS scanners (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"         uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "deviceName"      text NOT NULL,
  "publicKey"       text,
  "deviceSecretRef" text,
  status            text NOT NULL DEFAULT 'active',
  "createdAt"       timestamptz(3) NOT NULL DEFAULT now()
);

-- tickets -> events, ticket_types, profiles
CREATE TABLE IF NOT EXISTS tickets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "ticketTypeId"   uuid NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  "tokenId"        text,
  "currentOwnerId" uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "faceValueMinor" integer NOT NULL,
  status           "TicketStatus" NOT NULL DEFAULT 'CREATED',
  "transferCount"  integer NOT NULL DEFAULT 0,
  "policyVersion"  integer NOT NULL DEFAULT 1,
  "createdAt"      timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz(3) NOT NULL DEFAULT now()
);

-- orders -> profiles, events
CREATE TABLE IF NOT EXISTS orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "buyerId"        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "eventId"        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status           "OrderStatus" NOT NULL DEFAULT 'CREATED',
  "totalMinor"     integer NOT NULL,
  currency         text NOT NULL DEFAULT 'INR',
  "idempotencyKey" text NOT NULL UNIQUE,
  "createdAt"      timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz(3) NOT NULL DEFAULT now()
);

-- order_items -> orders, ticket_types, tickets
CREATE TABLE IF NOT EXISTS order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "ticketTypeId"   uuid NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  "ticketId"       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  "unitPriceMinor" integer NOT NULL
);

-- payments -> orders
CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"           uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider            text NOT NULL DEFAULT 'razorpay',
  "providerPaymentId" text,
  status              text NOT NULL DEFAULT 'pending',
  "signatureVerified" boolean NOT NULL DEFAULT false,
  "createdAt"         timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz(3) NOT NULL DEFAULT now()
);

-- inventory_reservations -> events, ticket_types, profiles
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "ticketTypeId" uuid NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  "userId"       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quantity       integer NOT NULL,
  "expiresAt"    timestamptz(3) NOT NULL,
  status         text NOT NULL DEFAULT 'active'
);

-- queue_entries -> events, profiles
CREATE TABLE IF NOT EXISTS queue_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"          uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "userId"           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  "sessionId"        text,
  "joinedAt"         timestamptz(3) NOT NULL DEFAULT now(),
  "allocationStatus" "QueueAllocationStatus" NOT NULL DEFAULT 'JOINED',
  "admissionExpiresAt" timestamptz(3),
  "createdAt"        timestamptz(3) NOT NULL DEFAULT now()
);

-- resale_listings -> tickets, profiles
CREATE TABLE IF NOT EXISTS resale_listings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId"  uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  "sellerId"  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "askMinor"  integer NOT NULL,
  status      "ResaleListingStatus" NOT NULL DEFAULT 'DRAFT',
  "expiresAt" timestamptz(3),
  "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(3) NOT NULL DEFAULT now()
);

-- transfers -> tickets, profiles
CREATE TABLE IF NOT EXISTS transfers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId"    uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  "fromOwnerId" uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "toOwnerId"   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "priceMinor"  integer NOT NULL,
  "txHash"      text,
  status        text NOT NULL DEFAULT 'pending',
  "createdAt"   timestamptz(3) NOT NULL DEFAULT now()
);

-- qr_credentials -> tickets
CREATE TABLE IF NOT EXISTS qr_credentials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId"   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  "nonceHash"  text NOT NULL,
  "expiresAt"  timestamptz(3) NOT NULL,
  "keyId"      text NOT NULL,
  "consumedAt" timestamptz(3),
  status       text NOT NULL DEFAULT 'active',
  "createdAt"  timestamptz(3) NOT NULL DEFAULT now()
);

-- redemptions -> tickets, events, scanners  (scanners already created above)
CREATE TABLE IF NOT EXISTS redemptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId"       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  "eventId"        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "scannerId"      uuid NOT NULL REFERENCES scanners(id) ON DELETE CASCADE,
  "redeemedAt"     timestamptz(3) NOT NULL DEFAULT now(),
  result           text NOT NULL,
  "idempotencyKey" text NOT NULL UNIQUE
);

-- audit_logs -> profiles
CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId"    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action       text NOT NULL,
  "objectType" text NOT NULL,
  "objectId"   text,
  outcome      text NOT NULL,
  "timestamp"  timestamptz(3) NOT NULL DEFAULT now()
);

-- fraud_events -> profiles
CREATE TABLE IF NOT EXISTS fraud_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId"   text NOT NULL UNIQUE,
  "userId"      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  "riskScore"   integer NOT NULL DEFAULT 0,
  "riskBand"    "RiskBand" NOT NULL DEFAULT 'LOW',
  "reasonCodes" text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'open',
  "reviewedBy"  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  "reviewedAt"  timestamptz(3),
  "createdAt"   timestamptz(3) NOT NULL DEFAULT now()
);

-- group_tickets -> orders, profiles, tickets
CREATE TABLE IF NOT EXISTS group_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "managerId"     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "memberId"      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  "ticketId"      uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'unassigned',
  "claimToken"    text,
  "inviteExpiresAt" timestamptz(3),
  "createdAt"     timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz(3) NOT NULL DEFAULT now()
);

-- ---------- 3. INDEXES on foreign keys (fast lookups, scanner/gate speed) ----------
CREATE INDEX IF NOT EXISTS idx_organizers_user        ON organizers("userId");
CREATE INDEX IF NOT EXISTS idx_events_organizer       ON events("organizerId");
CREATE INDEX IF NOT EXISTS idx_ticket_types_event     ON ticket_types("eventId");
CREATE INDEX IF NOT EXISTS idx_scanners_event         ON scanners("eventId");
CREATE INDEX IF NOT EXISTS idx_tickets_event          ON tickets("eventId");
CREATE INDEX IF NOT EXISTS idx_tickets_owner          ON tickets("currentOwnerId");
CREATE INDEX IF NOT EXISTS idx_tickets_type           ON tickets("ticketTypeId");
CREATE INDEX IF NOT EXISTS idx_orders_buyer           ON orders("buyerId");
CREATE INDEX IF NOT EXISTS idx_orders_event           ON orders("eventId");
CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items("orderId");
CREATE INDEX IF NOT EXISTS idx_payments_order         ON payments("orderId");
CREATE INDEX IF NOT EXISTS idx_reservations_event     ON inventory_reservations("eventId");
CREATE INDEX IF NOT EXISTS idx_queue_event            ON queue_entries("eventId");
CREATE INDEX IF NOT EXISTS idx_resale_ticket          ON resale_listings("ticketId");
CREATE INDEX IF NOT EXISTS idx_transfers_ticket       ON transfers("ticketId");
CREATE INDEX IF NOT EXISTS idx_qr_ticket              ON qr_credentials("ticketId");
CREATE INDEX IF NOT EXISTS idx_redemptions_ticket     ON redemptions("ticketId");
CREATE INDEX IF NOT EXISTS idx_redemptions_event      ON redemptions("eventId");
CREATE INDEX IF NOT EXISTS idx_audit_actor            ON audit_logs("actorId");
CREATE INDEX IF NOT EXISTS idx_group_tickets_order    ON group_tickets("orderId");
CREATE INDEX IF NOT EXISTS idx_group_tickets_manager  ON group_tickets("managerId");

-- ---------- 4. ROW LEVEL SECURITY ----------
-- Enable RLS on every table. Mobile/web clients (anon/authenticated keys)
-- can only touch what the policies below allow. Everything else is
-- accessed server-side via Edge Functions using the service_role key.
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types           ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanners               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE resale_listings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_credentials         ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_tickets          ENABLE ROW LEVEL SECURITY;

-- profiles: a user can read and update only their own row
DROP POLICY IF EXISTS profiles_self_select ON profiles;
CREATE POLICY profiles_self_select ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_update ON profiles;
CREATE POLICY profiles_self_update ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- events: public can read published events only
DROP POLICY IF EXISTS events_public_read ON events;
CREATE POLICY events_public_read ON events FOR SELECT TO anon, authenticated
  USING (status = 'published');

-- ticket_types: public can read types belonging to published events
DROP POLICY IF EXISTS ticket_types_public_read ON ticket_types;
CREATE POLICY ticket_types_public_read ON ticket_types FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM events e WHERE e.id = ticket_types."eventId" AND e.status = 'published'));

-- tickets: owner can see their own tickets
DROP POLICY IF EXISTS tickets_owner_read ON tickets;
CREATE POLICY tickets_owner_read ON tickets FOR SELECT TO authenticated
  USING ("currentOwnerId" = auth.uid());

-- orders: buyer can see their own orders
DROP POLICY IF EXISTS orders_buyer_read ON orders;
CREATE POLICY orders_buyer_read ON orders FOR SELECT TO authenticated
  USING ("buyerId" = auth.uid());

-- All other tables: RLS enabled with NO policy => denied to clients.
-- (payments, scanners, redemptions, qr_credentials, fraud_events, audit_logs,
--  transfers, resale_listings, queue_entries, inventory_reservations, group_tickets, ...)

-- ---------- Step 2: remove orphan profiles (no login account) ----------
DELETE FROM profiles WHERE id NOT IN (SELECT id FROM auth.users);

-- ---------- Step 3: 002_auth_sessions.sql ----------
-- ============================================================================
-- TruTicket — 002_auth_sessions.sql   (Phase 2, package 2.1)
-- Auth identities, verified-email gate, single session, single device,
-- OTP storage, and rate limits. Supabase auth.users is the login record.
-- Depends on: 001_init.sql (profiles) and Supabase's auth schema.
-- Safe to re-run: IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
--
-- Run order on a fresh project: 001_init.sql, then this file.
-- Notes:
--  * Prisma is dropped (decision 2026-11). This file is the only schema source.
--  * Passwords are removed. Sign-in is Google ID token or email OTP only.
--  * Only the server (service_role, used in Edge Functions) writes to these
--    tables. Clients can read their own rows and nothing else.
-- ============================================================================

-- ---------- 1. Profiles follow Supabase auth ----------
-- No passwords in this app. Drop the unused column from 001.
ALTER TABLE profiles DROP COLUMN IF EXISTS "passwordHash";

-- profiles.id must be the auth user id. Fails only if old profile rows exist
-- that have no auth user. Delete those first (they were never used).
DO $$ BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_id_auth_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create the profile row when an auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, status)
  VALUES (NEW.id, lower(NEW.email), 'ATTENDEE', 'active')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------- 2. Email normalisation (duplicate key only) ----------
-- The original address is kept for sending. This key is only for duplicate
-- checks. Gmail and Googlemail: dots and +tags are removed.
-- Other providers: lowercase only (see open question in PHASE2_PLAN §6).
CREATE OR REPLACE FUNCTION public.normalise_email_key(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_local  text;
  v_domain text;
BEGIN
  p_email  := lower(btrim(p_email));
  v_local  := split_part(p_email, '@', 1);
  v_domain := split_part(p_email, '@', 2);
  IF v_domain IN ('gmail.com', 'googlemail.com') THEN
    v_local  := replace(split_part(v_local, '+', 1), '.', '');
    v_domain := 'gmail.com';
  END IF;
  RETURN v_local || '@' || v_domain;
END;
$$;

-- ---------- 3. Tables ----------

-- Emails on an account. One account can hold several verified emails.
-- A normalised email may be verified on only one account at a time (see the
-- partial unique index). Unverified claims do not block anyone.
CREATE TABLE IF NOT EXISTS user_emails (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,             -- original address, used for sending
  email_key   text NOT NULL,             -- normalised, duplicate check only
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_verified_email_key
  ON user_emails (email_key) WHERE verified_at IS NOT NULL;

-- Login identities. Google subject is unique across all accounts.
-- For provider 'email', provider_subject is the normalised email key.
CREATE TABLE IF NOT EXISTS user_identities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         text NOT NULL CHECK (provider IN ('google', 'email')),
  provider_subject text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

-- Device keys. One active device per account. A new device waits in
-- 'pending' until activate_after (48-hour cooldown) and OTP re-verification.
CREATE TABLE IF NOT EXISTS user_devices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_key_id   text NOT NULL UNIQUE,  -- client key identifier
  public_key      text NOT NULL,         -- SPKI, base64
  platform        text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  attestation     text NOT NULL DEFAULT 'none'
                  CHECK (attestation IN ('verified', 'unverified', 'none')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'revoked')),
  activate_after  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  activated_at    timestamptz,
  revoked_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_device
  ON user_devices (user_id) WHERE status = 'active';

-- Sessions. One active session per account (a new login revokes the old one).
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_key_id uuid REFERENCES user_devices(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  revoke_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_session
  ON user_sessions (user_id) WHERE revoked_at IS NULL;

-- OTP codes. Only an HMAC of the code is stored, never the code.
-- The HMAC key lives in the Edge Function environment.
CREATE TABLE IF NOT EXISTS otp_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key    text NOT NULL,
  purpose      text NOT NULL CHECK (purpose IN ('login', 'verify_email', 'new_device')),
  code_hash    text NOT NULL,
  attempts     int  NOT NULL DEFAULT 0,
  max_attempts int  NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,     -- created_at + 10 minutes
  consumed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_otp_email_recent
  ON otp_codes (email_key, created_at DESC);

-- Fixed-window rate limits, written only through rate_limit_hit().
CREATE TABLE IF NOT EXISTS rate_limits (
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  count        int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- ---------- 4. Functions ----------

-- Returns true when the call is allowed. Atomic under concurrency.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_key            text,
  p_window_seconds int,
  p_max            int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_count int;
BEGIN
  v_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO rate_limits (key, window_start, count)
  VALUES (p_key, v_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;

-- The verification gate. A user can buy, resell, or create an event only when
-- the account is active and has at least one verified email.
-- (Verified phone is added at Launch, phase 2b.)
CREATE OR REPLACE FUNCTION public.can_transact(p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM profiles p
           WHERE p.id = p_user AND p.status = 'active'
         )
     AND EXISTS (
           SELECT 1 FROM user_emails e
           WHERE e.user_id = p_user AND e.verified_at IS NOT NULL
         );
$$;

-- ---------- 5. Row Level Security ----------
ALTER TABLE user_emails     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits     ENABLE ROW LEVEL SECURITY;

-- Own rows only, read-only for clients. Writes happen in Edge Functions.
DROP POLICY IF EXISTS user_emails_self_select ON user_emails;
CREATE POLICY user_emails_self_select ON user_emails FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_identities_self_select ON user_identities;
CREATE POLICY user_identities_self_select ON user_identities FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_devices_self_select ON user_devices;
CREATE POLICY user_devices_self_select ON user_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_sessions_self_select ON user_sessions;
CREATE POLICY user_sessions_self_select ON user_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- otp_codes and rate_limits have no client policies at all (service only).

-- ---------- 6. Grants (defence in depth on top of RLS) ----------
REVOKE ALL ON user_emails, user_identities, user_devices, user_sessions,
              otp_codes, rate_limits FROM anon, authenticated;
GRANT SELECT ON user_emails, user_identities, user_devices, user_sessions
  TO authenticated;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalise_email_key(text)      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.normalise_email_key(text)  TO authenticated;
REVOKE ALL ON FUNCTION public.can_transact(uuid)             FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_transact(uuid)         TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user()         FROM PUBLIC, anon, authenticated;

COMMIT;
