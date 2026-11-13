-- ============================================================================
-- TruTicket DEV ONLY: give the two demo accounts a test device each.
-- TARGET: truticket-dev ONLY (project ref oviqjnzlgbkmggytaqao).
-- NEVER run this on production (ccqbubgebsayoviilnul).
-- Why: the purchase gate (session_can_transact, PHASE2_PLAN §2.3) needs the sign-in to be linked
-- to an ACTIVE device. Real devices are registered with Android key attestation on the phone (2.9).
-- The dev tests have no phone, so this creates a clearly fake device row per demo account.
-- No key, no attestation. Dev only. Run after demo-accounts-dev.ps1. Safe to run twice.
-- ============================================================================

DO $$
DECLARE
  pair   text[][] := ARRAY[
    ARRAY['demo.attendee@example.com',  'dev-demo-attendee-device'],
    ARRAY['demo.organiser@example.com', 'dev-demo-organiser-device']
  ];
  i      integer;
  v_mail text;
  v_key  text;
  uid    uuid;
BEGIN
  FOR i IN 1 .. array_length(pair, 1) LOOP
    v_mail := pair[i][1];
    v_key  := pair[i][2];

    SELECT id INTO uid FROM auth.users WHERE email = v_mail;
    IF uid IS NULL THEN
      RAISE EXCEPTION '% not found. Run scripts/demo-accounts-dev.ps1 first.', v_mail;
    END IF;

    -- One active device per account (unique index). Retire any other active device of this demo account.
    UPDATE user_devices
       SET status = 'revoked', revoked_at = now()
     WHERE user_id = uid AND status = 'active' AND device_key_id <> v_key;

    -- Update in place (not delete), so existing sessions linked to this device keep their link.
    IF EXISTS (SELECT 1 FROM user_devices WHERE device_key_id = v_key) THEN
      UPDATE user_devices
         SET user_id = uid, status = 'active', revoked_at = NULL, activated_at = COALESCE(activated_at, now())
       WHERE device_key_id = v_key;
    ELSE
      INSERT INTO user_devices (user_id, device_key_id, public_key, platform, attestation, status, activated_at)
      VALUES (uid, v_key, 'DEV-FIXTURE-NOT-A-KEY', 'android', 'none', 'active', now());
    END IF;
  END LOOP;
END $$;
