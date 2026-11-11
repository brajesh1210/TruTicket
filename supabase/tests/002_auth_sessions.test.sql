-- ============================================================================
-- 002_auth_sessions.test.sql — database tests for migration 002.
-- Runs in ONE transaction and ends with ROLLBACK, so nothing is left behind.
-- Any failed check raises an exception and stops the run (psql -v ON_ERROR_STOP=1).
--
-- Run (local Postgres after local_stubs.sql, 001, 002):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/002_auth_sessions.test.sql
-- Run on a dev Supabase project: same command, using the dev project's
-- connection string from the Supabase dashboard (local .env only, never commit).
-- ============================================================================

BEGIN;

-- Fixed test ids. A = verified attendee, B = attendee with only an unverified email.

-- ---------- Setup ----------
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'asha@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'ravi@example.com');

DO $$
BEGIN
  -- T0: profile rows are created by the trigger, with role ATTENDEE and status active
  IF (SELECT count(*) FROM profiles WHERE id IN (
        '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000b')
        AND role = 'ATTENDEE' AND status = 'active') <> 2 THEN
    RAISE EXCEPTION 'T0 FAILED: profiles not created for new auth users';
  END IF;
  RAISE NOTICE 'T0 ok: profile trigger';
END $$;

-- ---------- T1: email normalisation ----------
DO $$
BEGIN
  IF normalise_email_key('J.Doe+shop@Gmail.com') <> 'jdoe@gmail.com' THEN
    RAISE EXCEPTION 'T1 FAILED: gmail dots and +tag not removed';
  END IF;
  IF normalise_email_key('a.b@googlemail.com') <> 'ab@gmail.com' THEN
    RAISE EXCEPTION 'T1 FAILED: googlemail not mapped to gmail';
  END IF;
  IF normalise_email_key('Name+x@Outlook.com') <> 'name+x@outlook.com' THEN
    RAISE EXCEPTION 'T1 FAILED: non-gmail domain should only be lowercased';
  END IF;
  RAISE NOTICE 'T1 ok: normalisation';
END $$;

-- ---------- T2: verification gate, before and after ----------
DO $$
BEGIN
  IF can_transact('00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'T2 FAILED: user with no verified email can transact';
  END IF;
  INSERT INTO user_emails (user_id, email, email_key, verified_at)
  VALUES ('00000000-0000-0000-0000-00000000000a', 'asha@example.com',
          normalise_email_key('asha@example.com'), now());
  IF NOT can_transact('00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'T2 FAILED: verified user cannot transact';
  END IF;
  RAISE NOTICE 'T2 ok: verification gate';
END $$;

-- ---------- T3: several verified emails are allowed; one verified email key per account ----------
DO $$
BEGIN
  -- A adds a second verified Gmail address (normalises to asha@gmail.com)
  INSERT INTO user_emails (user_id, email, email_key, verified_at)
  VALUES ('00000000-0000-0000-0000-00000000000a', 'as.ha@gmail.com',
          normalise_email_key('as.ha@gmail.com'), now());

  -- B tries to verify the same normalised key: must fail
  BEGIN
    INSERT INTO user_emails (user_id, email, email_key, verified_at)
    VALUES ('00000000-0000-0000-0000-00000000000b', 'asha@gmail.com',
            normalise_email_key('asha@gmail.com'), now());
    RAISE EXCEPTION 'T3 FAILED: second account verified an already-verified email key';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- B can still hold an UNVERIFIED claim on that key (does not block anyone)
  INSERT INTO user_emails (user_id, email, email_key, verified_at)
  VALUES ('00000000-0000-0000-0000-00000000000b', 'asha@gmail.com',
          normalise_email_key('asha@gmail.com'), NULL);

  IF (SELECT count(*) FROM user_emails
      WHERE user_id = '00000000-0000-0000-0000-00000000000a' AND verified_at IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'T3 FAILED: account A should hold two verified emails';
  END IF;
  RAISE NOTICE 'T3 ok: multiple verified emails, unique verified key';
END $$;

-- ---------- T4: unverified account cannot transact ----------
DO $$
BEGIN
  IF can_transact('00000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'T4 FAILED: account B has only an unverified claim but can transact';
  END IF;
  RAISE NOTICE 'T4 ok: unverified account blocked at DB level';
END $$;

-- ---------- T5: RLS, a user sees only their own rows ----------
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM user_emails;
  RESET ROLE;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'T5 FAILED: user A sees % user_emails rows, expected 2 (own only)', v_count;
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM user_emails;
  RESET ROLE;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'T5 FAILED: user B sees % user_emails rows, expected 1 (own only)', v_count;
  END IF;
  RAISE NOTICE 'T5 ok: RLS own-row read';
END $$;

-- ---------- T6: clients cannot write to identity tables ----------
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE user_emails SET verified_at = now() WHERE user_id = auth.uid();
    RESET ROLE;
    RAISE EXCEPTION 'T6 FAILED: authenticated user can update user_emails';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
  END;
  RAISE NOTICE 'T6 ok: no client writes to user_emails';
END $$;

-- ---------- T7: OTP table and rate limits are service-only ----------
DO $$
BEGIN
  -- anon
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM 1 FROM otp_codes;
    RESET ROLE;
    RAISE EXCEPTION 'T7 FAILED: anon can read otp_codes';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE;
  END;
  -- authenticated
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM 1 FROM otp_codes;
    RESET ROLE;
    RAISE EXCEPTION 'T7 FAILED: authenticated can read otp_codes';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE;
  END;
  SET LOCAL ROLE authenticated;   -- the previous handler reset the role
  BEGIN
    PERFORM rate_limit_hit('t7:key', 3600, 5);
    RESET ROLE;
    RAISE EXCEPTION 'T7 FAILED: authenticated can call rate_limit_hit';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE;
  END;
  RAISE NOTICE 'T7 ok: service-only tables and functions';
END $$;

-- ---------- T8: one active session per account ----------
DO $$
DECLARE v_first uuid;
BEGIN
  INSERT INTO user_sessions (user_id) VALUES ('00000000-0000-0000-0000-00000000000a')
  RETURNING session_id INTO v_first;

  BEGIN
    INSERT INTO user_sessions (user_id) VALUES ('00000000-0000-0000-0000-00000000000a');
    RAISE EXCEPTION 'T8 FAILED: two active sessions for one account';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- A new login revokes the old session first, then creates the new one
  UPDATE user_sessions SET revoked_at = now(), revoke_reason = 'new_login' WHERE session_id = v_first;
  INSERT INTO user_sessions (user_id) VALUES ('00000000-0000-0000-0000-00000000000a');

  RAISE NOTICE 'T8 ok: single active session';
END $$;

-- ---------- T9: one active device per account; a new device starts pending ----------
DO $$
DECLARE v_dev uuid;
BEGIN
  INSERT INTO user_devices (user_id, device_key_id, public_key, platform, status, activated_at)
  VALUES ('00000000-0000-0000-0000-00000000000a', 'key-t9-old', 'pk1', 'android', 'active', now());

  -- second ACTIVE device must fail
  BEGIN
    INSERT INTO user_devices (user_id, device_key_id, public_key, platform, status)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'key-t9-bad', 'pk2', 'ios', 'active');
    RAISE EXCEPTION 'T9 FAILED: two active devices for one account';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- a new device enters as pending with a 48-hour cooldown
  INSERT INTO user_devices (user_id, device_key_id, public_key, platform, status, activate_after)
  VALUES ('00000000-0000-0000-0000-00000000000a', 'key-t9-new', 'pk3', 'android', 'pending',
          now() + interval '48 hours')
  RETURNING id INTO v_dev;

  IF (SELECT status FROM user_devices WHERE id = v_dev) <> 'pending' THEN
    RAISE EXCEPTION 'T9 FAILED: new device not pending';
  END IF;
  RAISE NOTICE 'T9 ok: one active device, new device pending';
END $$;

-- ---------- T10: rate limits ----------
DO $$
DECLARE i int; v_last boolean;
BEGIN
  FOR i IN 1..5 LOOP
    IF NOT rate_limit_hit('t10:email:x', 3600, 5) THEN
      RAISE EXCEPTION 'T10 FAILED: call % blocked before the limit of 5', i;
    END IF;
  END LOOP;
  v_last := rate_limit_hit('t10:email:x', 3600, 5);
  IF v_last THEN
    RAISE EXCEPTION 'T10 FAILED: 6th call inside the window was allowed';
  END IF;
  -- other keys have their own counters
  IF NOT rate_limit_hit('t10:email:y', 3600, 5) THEN
    RAISE EXCEPTION 'T10 FAILED: limit leaked across keys';
  END IF;
  RAISE NOTICE 'T10 ok: rate limit';
END $$;

-- ---------- T11: profile must belong to a real auth user ----------
DO $$
BEGIN
  BEGIN
    INSERT INTO profiles (id, email) VALUES (gen_random_uuid(), 'ghost@example.com');
    RAISE EXCEPTION 'T11 FAILED: profile created without an auth user';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  RAISE NOTICE 'T11 ok: profile FK to auth.users';
END $$;

-- ---------- T12: password column is gone ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'profiles'
               AND column_name = 'passwordHash') THEN
    RAISE EXCEPTION 'T12 FAILED: profiles.passwordHash still exists';
  END IF;
  RAISE NOTICE 'T12 ok: no password column';
END $$;

-- ---------- T13: anon has no access to identity tables ----------
DO $$
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM 1 FROM user_sessions;
    RESET ROLE;
    RAISE EXCEPTION 'T13 FAILED: anon can read user_sessions';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE;
  END;
  RAISE NOTICE 'T13 ok: anon blocked';
END $$;

-- ---------- T14: RLS on sessions and devices, another user's rows are invisible ----------
DO $$
DECLARE v_seen int; v_seen_dev int;
BEGIN
  -- B gets a session and a device too (A already has them from T8 and T9)
  INSERT INTO user_sessions (user_id) VALUES ('00000000-0000-0000-0000-00000000000b');
  INSERT INTO user_devices (user_id, device_key_id, public_key, platform, status, activated_at)
  VALUES ('00000000-0000-0000-0000-00000000000b', 'key-t14-b', 'pkb', 'android', 'active', now());

  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM user_sessions WHERE user_id = '00000000-0000-0000-0000-00000000000b';
  SELECT count(*) INTO v_seen_dev FROM user_devices WHERE user_id = '00000000-0000-0000-0000-00000000000b';
  RESET ROLE;
  IF v_seen <> 0 OR v_seen_dev <> 0 THEN
    RAISE EXCEPTION 'T14 FAILED: user A can see user B sessions (%) or devices (%)', v_seen, v_seen_dev;
  END IF;
  RAISE NOTICE 'T14 ok: RLS on sessions and devices';
END $$;

\echo '=== ALL 002 DATABASE TESTS PASSED (rolled back) ==='
ROLLBACK;
