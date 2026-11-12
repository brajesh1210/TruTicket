-- ============================================================================
-- 002b_sessions_devices.test.sql — database tests for migration 002b (package 2.3).
-- Self-contained: runs in ONE transaction and ends with ROLLBACK.
-- Any failed check raises an exception and stops the run (psql -v ON_ERROR_STOP=1).
--
-- Run (plain Postgres after local_stubs.sql, 001, 002, 002b):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/002b_sessions_devices.test.sql
-- Do not run this file on Supabase production. Dev only, and only from a local .env.
-- ============================================================================

BEGIN;

-- C = verified attendee, D = second verified attendee (for cross-user checks)
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'chandni@example.com'),
  ('00000000-0000-0000-0000-0000000000d1', 'deepak@example.com');

INSERT INTO user_emails (user_id, email, email_key, verified_at) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'chandni@example.com', 'chandni@example.com', now()),
  ('00000000-0000-0000-0000-0000000000d1', 'deepak@example.com',  'deepak@example.com',  now());

-- Supabase's own session rows for C and D (session ids are fixed here for the tests).
INSERT INTO auth.sessions (id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1');

-- Active device per account (C and D), then one active session each, linked to that device.
DO $$
DECLARE v_sc uuid := '00000000-0000-0000-0000-0000000000e1';
        v_sd uuid := '00000000-0000-0000-0000-0000000000e2';
        v_dc uuid; v_dd uuid;
BEGIN
  INSERT INTO user_devices (user_id, device_key_id, public_key, platform, attestation, status, activated_at)
  VALUES ('00000000-0000-0000-0000-0000000000c1', 'key-t-c1', 'pkc1', 'android', 'verified', 'active', now())
  RETURNING id INTO v_dc;
  INSERT INTO user_devices (user_id, device_key_id, public_key, platform, attestation, status, activated_at)
  VALUES ('00000000-0000-0000-0000-0000000000d1', 'key-t-d1', 'pkd1', 'android', 'verified', 'active', now())
  RETURNING id INTO v_dd;

  INSERT INTO user_sessions (session_id, user_id, device_key_id) VALUES (v_sc, '00000000-0000-0000-0000-0000000000c1', v_dc);
  INSERT INTO user_sessions (session_id, user_id, device_key_id) VALUES (v_sd, '00000000-0000-0000-0000-0000000000d1', v_dd);
  PERFORM set_config('test.s_c', v_sc::text, true);
  PERFORM set_config('test.s_d', v_sd::text, true);
END $$;

-- ---------- T15: session_can_transact is true for the caller's own active session ----------
DO $$
DECLARE v_ok boolean;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000c1','session_id',current_setting('test.s_c'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT session_can_transact() INTO v_ok;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION 'T15 FAILED: active own session cannot transact'; END IF;
  RAISE NOTICE 'T15 ok: active session can transact';
END $$;

-- ---------- T16: a revoked session is blocked at the DB ----------
DO $$
DECLARE v_ok boolean;
BEGIN
  UPDATE user_sessions SET revoked_at = now(), revoke_reason = 'new_login'
   WHERE session_id = current_setting('test.s_c')::uuid;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000c1','session_id',current_setting('test.s_c'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT session_can_transact() INTO v_ok;
  RESET ROLE;
  IF v_ok THEN RAISE EXCEPTION 'T16 FAILED: revoked session can still transact'; END IF;
  RAISE NOTICE 'T16 ok: revoked session blocked';
END $$;

-- ---------- T17: a session id that belongs to another user does not count ----------
DO $$
DECLARE v_ok boolean;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000c1','session_id',current_setting('test.s_d'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT session_can_transact() INTO v_ok;
  RESET ROLE;
  IF v_ok THEN RAISE EXCEPTION 'T17 FAILED: C can transact with D''s session id'; END IF;
  RAISE NOTICE 'T17 ok: foreign session id rejected';
END $$;

-- ---------- T18: no session claim means no transaction (e.g. a token without session_id) ----------
DO $$
DECLARE v_ok boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1"}', true);
  SET LOCAL ROLE authenticated;
  SELECT session_can_transact() INTO v_ok;
  RESET ROLE;
  IF v_ok THEN RAISE EXCEPTION 'T18 FAILED: token without session_id can transact'; END IF;
  RAISE NOTICE 'T18 ok: missing session claim blocked';
END $$;

-- ---------- T19: a suspended account is blocked even with an active session ----------
DO $$
DECLARE v_ok boolean;
BEGIN
  UPDATE user_sessions SET revoked_at = NULL, revoke_reason = NULL
   WHERE session_id = current_setting('test.s_d')::uuid;
  UPDATE profiles SET status = 'suspended' WHERE id = '00000000-0000-0000-0000-0000000000d1';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000d1','session_id',current_setting('test.s_d'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT session_can_transact() INTO v_ok;
  RESET ROLE;
  IF v_ok THEN RAISE EXCEPTION 'T19 FAILED: suspended account can transact'; END IF;
  UPDATE profiles SET status = 'active' WHERE id = '00000000-0000-0000-0000-0000000000d1';
  RAISE NOTICE 'T19 ok: suspended account blocked';
END $$;

-- ---------- T20: revoke_auth_sessions keeps the current session and removes the rest ----------
DO $$
DECLARE v_keep uuid := '00000000-0000-0000-0000-00000000aa01';
        v_n integer;
        v_expect integer;
BEGIN
  INSERT INTO auth.sessions (id, user_id) VALUES
    (v_keep, '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-00000000aa04', '00000000-0000-0000-0000-0000000000d1');

  SELECT count(*) INTO v_expect FROM auth.sessions
   WHERE user_id = '00000000-0000-0000-0000-0000000000c1' AND id <> v_keep;
  IF v_expect < 3 THEN RAISE EXCEPTION 'T20 setup: expected at least 3 other rows for C, got %', v_expect; END IF;

  v_n := revoke_auth_sessions('00000000-0000-0000-0000-0000000000c1', v_keep);
  IF v_n <> v_expect THEN RAISE EXCEPTION 'T20 FAILED: expected % rows removed, got %', v_expect, v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = v_keep) THEN
    RAISE EXCEPTION 'T20 FAILED: current session was removed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = '00000000-0000-0000-0000-00000000aa04') THEN
    RAISE EXCEPTION 'T20 FAILED: another user''s session was removed';
  END IF;
  RAISE NOTICE 'T20 ok: other sessions of the same user revoked only';
END $$;

-- ---------- T21: clients cannot call the service-only functions ----------
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM revoke_auth_sessions('00000000-0000-0000-0000-0000000000c1', NULL);
    RESET ROLE;
    RAISE EXCEPTION 'T21 FAILED: authenticated can call revoke_auth_sessions';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE;
  END;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM session_is_active(current_setting('test.s_c')::uuid, '00000000-0000-0000-0000-0000000000c1');
    RESET ROLE;
    RAISE EXCEPTION 'T21 FAILED: authenticated can call session_is_active';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE;
  END;
  RAISE NOTICE 'T21 ok: service-only functions closed to clients';
END $$;

-- ---------- T22: device challenges are invisible and unwritable to clients ----------
DO $$
DECLARE v_seen integer;
BEGIN
  INSERT INTO device_challenges (nonce, user_id, expires_at)
  VALUES ('nonce-t22', '00000000-0000-0000-0000-0000000000c1', now() + interval '5 minutes');

  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT count(*) INTO v_seen FROM device_challenges;
    RESET ROLE;
    RAISE EXCEPTION 'T22 FAILED: authenticated can read device_challenges (%)', v_seen;
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE;
  END;
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO device_challenges (nonce, user_id, expires_at)
    VALUES ('nonce-t22-client', '00000000-0000-0000-0000-0000000000c1', now() + interval '5 minutes');
    RESET ROLE;
    RAISE EXCEPTION 'T22 FAILED: authenticated can insert device_challenges';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE;
  END;
  RAISE NOTICE 'T22 ok: device challenges closed to clients';
END $$;

-- ---------- T23: a pending device cannot transact; activation switches it on ----------
DO $$
DECLARE v_ok boolean; v_pending uuid; v_old uuid;
BEGIN
  SELECT id INTO v_old FROM user_devices WHERE device_key_id = 'key-t-d1';
  INSERT INTO user_devices (user_id, device_key_id, public_key, platform, attestation, status, activate_after)
  VALUES ('00000000-0000-0000-0000-0000000000d1', 'key-t23-new', 'pkd2', 'android', 'verified', 'pending', now() + interval '48 hours')
  RETURNING id INTO v_pending;
  UPDATE user_sessions SET device_key_id = v_pending WHERE session_id = current_setting('test.s_d')::uuid;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000d1','session_id',current_setting('test.s_d'))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT session_can_transact() INTO v_ok;
  RESET ROLE;
  IF v_ok THEN RAISE EXCEPTION 'T23 FAILED: pending device session can transact'; END IF;

  -- Activation as the function does it: retire the old active device, then activate the new one.
  UPDATE user_devices SET status = 'revoked', revoked_at = now() WHERE id = v_old;
  UPDATE user_devices SET status = 'active', activated_at = now(), activate_after = NULL WHERE id = v_pending;

  SET LOCAL ROLE authenticated;
  SELECT session_can_transact() INTO v_ok;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION 'T23 FAILED: activated device session cannot transact'; END IF;
  RAISE NOTICE 'T23 ok: pending device blocked, activated device allowed';
END $$;

-- ---------- T24: Supabase ends a session (e.g. refresh reuse) and our row still says active ----------
DO $$
DECLARE v_ok boolean; v_ok2 boolean; v_sid uuid := '00000000-0000-0000-0000-0000000000e2';
BEGIN
  -- D's session is active in both tables before the change
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000d1','session_id',v_sid)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT session_can_transact() INTO v_ok;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION 'T24 setup: D cannot transact before the change'; END IF;

  -- Supabase removes its row; ours is still active
  DELETE FROM auth.sessions WHERE id = v_sid;
  IF NOT EXISTS (SELECT 1 FROM user_sessions WHERE session_id = v_sid AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'T24 setup: our row should still be active';
  END IF;

  SET LOCAL ROLE authenticated;
  SELECT session_can_transact() INTO v_ok;
  RESET ROLE;
  v_ok2 := session_is_active(v_sid, '00000000-0000-0000-0000-0000000000d1');
  IF v_ok OR v_ok2 THEN RAISE EXCEPTION 'T24 FAILED: session ended in Supabase still passes the gate (transact=%, active=%)', v_ok, v_ok2; END IF;
  RAISE NOTICE 'T24 ok: session ended by Supabase is blocked';
END $$;

\echo '=== ALL 002b DATABASE TESTS PASSED (rolled back) ==='
ROLLBACK;
