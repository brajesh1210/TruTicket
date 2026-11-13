-- ============================================================================
-- TruTicket 2.6 DEV ONLY: give the demo attendee a test device.
-- TARGET: truticket-dev ONLY (project ref oviqjnzlgbkmggytaqao).
-- NEVER run this on production (ccqbubgebsayoviilnul).
-- Why: the purchase gate (session_can_transact, PHASE2_PLAN §2.3) needs the sign-in to be linked
-- to an ACTIVE device. Real devices are registered with Android key attestation on the phone (2.9).
-- The dev test has no phone, so this creates a clearly fake device row for the demo attendee only.
-- It has no key and no attestation. It exists only so the dev test can exercise the gate.
-- Run after demo-accounts-dev.ps1. Safe to run twice.
-- ============================================================================

DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'demo.attendee@example.com';
  IF uid IS NULL THEN
    RAISE EXCEPTION 'demo attendee not found. Run scripts/demo-accounts-dev.ps1 first.';
  END IF;

  -- One active device per account (unique index). Retire any other active device of this demo account.
  UPDATE user_devices
     SET status = 'revoked', revoked_at = now()
   WHERE user_id = uid AND status = 'active' AND device_key_id <> 'dev-demo-attendee-device';

  -- Update in place (not delete), so existing sessions linked to this device keep their link.
  IF EXISTS (SELECT 1 FROM user_devices WHERE device_key_id = 'dev-demo-attendee-device') THEN
    UPDATE user_devices
       SET user_id = uid, status = 'active', revoked_at = NULL, activated_at = COALESCE(activated_at, now())
     WHERE device_key_id = 'dev-demo-attendee-device';
  ELSE
    INSERT INTO user_devices (user_id, device_key_id, public_key, platform, attestation, status, activated_at)
    VALUES (uid, 'dev-demo-attendee-device', 'DEV-FIXTURE-NOT-A-KEY', 'android', 'none', 'active', now());
  END IF;
END $$;
