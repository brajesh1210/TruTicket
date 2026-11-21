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
