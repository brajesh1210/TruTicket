-- 011 notification outbox tests (PHASE2_PLAN Phase 5). Local PGlite check only: run after 001..010.
-- Not for Supabase. One transaction, ends with ROLLBACK.
-- Every "refused" check first proves the good case works, so a broken table cannot pass by failing everything.
BEGIN;

DO $$
DECLARE
  a2 uuid := '00000000-0000-0000-0000-0000000000a2';
  n integer;
  got text;
BEGIN
  -- T91: RLS is on, and anon / authenticated have no privileges on the table.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'notification_outbox') THEN
    RAISE EXCEPTION 'T91 failed: RLS is off on notification_outbox';
  END IF;
  IF has_table_privilege('anon', 'notification_outbox', 'SELECT')
     OR has_table_privilege('authenticated', 'notification_outbox', 'SELECT')
     OR has_table_privilege('anon', 'notification_outbox', 'INSERT')
     OR has_table_privilege('authenticated', 'notification_outbox', 'INSERT') THEN
    RAISE EXCEPTION 'T91 failed: a client role has privileges on notification_outbox';
  END IF;
  IF NOT has_table_privilege('service_role', 'notification_outbox', 'INSERT') THEN
    RAISE EXCEPTION 'T91 failed: service_role cannot insert (n8n would be blocked)';
  END IF;
  RAISE NOTICE 'T91 ok: RLS on, clients have no privileges, service_role can write';
END $$;

DO $$
DECLARE
  a2 uuid := '00000000-0000-0000-0000-0000000000a2';
  n integer;
BEGIN
  -- T92: a good row inserts; the same dedupeKey is refused (idempotent insert for n8n).
  INSERT INTO notification_outbox (kind, "dedupeKey", "recipientId", payload)
  VALUES ('PAYMENT_CONFIRMED', 'PAYMENT_CONFIRMED:order-test-1', a2, '{"amount": 49900}');
  SELECT count(*) INTO n FROM notification_outbox WHERE "dedupeKey" = 'PAYMENT_CONFIRMED:order-test-1';
  IF n <> 1 THEN RAISE EXCEPTION 'T92 failed: good row not stored'; END IF;
  BEGIN
    INSERT INTO notification_outbox (kind, "dedupeKey", "recipientId")
    VALUES ('PAYMENT_CONFIRMED', 'PAYMENT_CONFIRMED:order-test-1', a2);
    RAISE EXCEPTION 'T92 failed: duplicate dedupeKey was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  RAISE NOTICE 'T92 ok: dedupeKey is unique';
END $$;

DO $$
DECLARE
  a2 uuid := '00000000-0000-0000-0000-0000000000a2';
BEGIN
  -- T93: an unknown kind is refused; every planned kind is accepted.
  BEGIN
    INSERT INTO notification_outbox (kind, "dedupeKey", "recipientId")
    VALUES ('MADE_UP_KIND', 'bad-kind-1', a2);
    RAISE EXCEPTION 'T93 failed: unknown kind accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  INSERT INTO notification_outbox (kind, "dedupeKey", "recipientId") VALUES
    ('EVENT_PUBLISHED', 'k-event-1', a2),
    ('RESALE_OFFER', 'k-resale-1', a2),
    ('QR_EXPIRY_WARNING', 'k-qr-1', a2),
    ('TICKET_REDEEMED', 'k-redeemed-1', a2),
    ('PAYMENT_CLEANUP', 'k-cleanup-1', a2),
    ('GROUP_INVITE', 'k-invite-1', a2);
  RAISE NOTICE 'T93 ok: unknown kind refused, 6 planned kinds accepted';
END $$;

DO $$
DECLARE
  a2 uuid := '00000000-0000-0000-0000-0000000000a2';
BEGIN
  -- T94: status is limited to PENDING, SENT, FAILED; negative attempts are refused.
  BEGIN
    INSERT INTO notification_outbox (kind, "dedupeKey", "recipientId", status)
    VALUES ('GROUP_INVITE', 'bad-status-1', a2, 'DONE');
    RAISE EXCEPTION 'T94 failed: bad status accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO notification_outbox (kind, "dedupeKey", "recipientId", attempts)
    VALUES ('GROUP_INVITE', 'bad-attempts-1', a2, -1);
    RAISE EXCEPTION 'T94 failed: negative attempts accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  UPDATE notification_outbox SET status = 'SENT', "sentAt" = now() WHERE "dedupeKey" = 'k-event-1';
  IF (SELECT status FROM notification_outbox WHERE "dedupeKey" = 'k-event-1') <> 'SENT' THEN
    RAISE EXCEPTION 'T94 failed: valid status change did not apply';
  END IF;
  RAISE NOTICE 'T94 ok: status and attempts are checked; a valid update applies';
END $$;

DO $$
DECLARE
  a2 uuid := '00000000-0000-0000-0000-0000000000a2';
  a3 uuid := '00000000-0000-0000-0000-0000000000a3';
  deleted integer;
BEGIN
  -- T95: deleting a profile removes its outbox rows (no orphan emails).
  INSERT INTO notification_outbox (kind, "dedupeKey", "recipientId")
  VALUES ('TICKET_REDEEMED', 'k-cascade-1', a3);
  DELETE FROM profiles WHERE id = a3;
  SELECT count(*) INTO deleted FROM notification_outbox WHERE "dedupeKey" = 'k-cascade-1';
  IF deleted <> 0 THEN RAISE EXCEPTION 'T95 failed: outbox row survived profile delete'; END IF;
  RAISE NOTICE 'T95 ok: profile delete cascades to outbox';
END $$;

ROLLBACK;
