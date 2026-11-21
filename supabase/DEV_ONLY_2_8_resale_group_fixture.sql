-- ============================================================================
-- TruTicket DEV ONLY (2.8): test tickets for the resale and group checks.
-- TARGET: truticket-dev ONLY (project ref oviqjnzlgbkmggytaqao).
-- NEVER run this on production (ccqbubgebsayoviilnul).
-- Needs: APPLY_2_8_TO_SUPABASE_DEV.sql, the demo accounts (demo-accounts-dev.ps1), and the device fixture.
-- Makes two tickets for the demo attendee, with fixed ids:
--   ...08a1  a General ticket (ISSUED_ACTIVE) for the resale price-cap check
--   ...08b1  a Corporate Bulk ticket (in the manager's bucket) for the group invite check
-- Run it again before every run of test-resale-dev.ps1 (it resets both tickets). Safe to run twice.
-- ============================================================================

DO $$
DECLARE
  att  uuid;
  ev   uuid;
  ga   uuid;
  corp uuid;
  resale_ticket  constant uuid := '00000000-0000-4000-8000-0000000008a1';
  bucket_ticket  constant uuid := '00000000-0000-4000-8000-0000000008b1';
  fixture_order  constant uuid := '00000000-0000-4000-8000-0000000008c1';
BEGIN
  SELECT id INTO att FROM auth.users WHERE email = 'demo.attendee@example.com';
  IF att IS NULL THEN
    RAISE EXCEPTION 'demo.attendee@example.com not found. Run scripts/demo-accounts-dev.ps1 first.';
  END IF;
  SELECT id INTO ev FROM events WHERE title = 'TruTicket Demo Night' LIMIT 1;
  IF ev IS NULL THEN
    RAISE EXCEPTION 'Demo event not found. Run the 2.5 SQL first.';
  END IF;
  SELECT id INTO ga FROM ticket_types WHERE "eventId" = ev AND name = 'General';

  -- The group ticket type for the demo event. Only this type goes to the manager's bucket.
  INSERT INTO ticket_types ("eventId", name, "faceValueMinor", quantity, "saleStart", "saleEnd", "groupEligible", "perAccountLimit")
  SELECT ev, 'Corporate Bulk', 200000, 100, now() - interval '1 day', now() + interval '60 days', true, 50
   WHERE NOT EXISTS (SELECT 1 FROM ticket_types WHERE "eventId" = ev AND name = 'Corporate Bulk');
  UPDATE ticket_types SET "groupEligible" = true WHERE "eventId" = ev AND name = 'Corporate Bulk';
  SELECT id INTO corp FROM ticket_types WHERE "eventId" = ev AND name = 'Corporate Bulk';

  -- Rebuild the two fixed tickets. Deleting them cascades to order items, invites and listings.
  DELETE FROM tickets WHERE id IN (resale_ticket, bucket_ticket);
  DELETE FROM orders WHERE id = fixture_order;

  INSERT INTO orders (id, "buyerId", "eventId", status, "totalMinor", currency, "idempotencyKey")
  VALUES (fixture_order, att, ev, 'TICKET_ISSUED', 49900 + 200000, 'INR', 'dev-2-8-fixture');
  INSERT INTO tickets (id, "eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
  VALUES (resale_ticket, ev, ga, att, 49900, 'ISSUED_ACTIVE');
  -- Inserted as ISSUED_ACTIVE: the database moves it to ISSUED_UNASSIGNED_GROUP (no QR until allocated).
  INSERT INTO tickets (id, "eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
  VALUES (bucket_ticket, ev, corp, att, 200000, 'ISSUED_ACTIVE');
  INSERT INTO order_items ("orderId", "ticketTypeId", "ticketId", "unitPriceMinor") VALUES
    (fixture_order, ga, resale_ticket, 49900),
    (fixture_order, corp, bucket_ticket, 200000);
END $$;

-- Check: the bucket ticket must read ISSUED_UNASSIGNED_GROUP, the resale ticket ISSUED_ACTIVE.
SELECT id, status FROM tickets
 WHERE id IN ('00000000-0000-4000-8000-0000000008a1', '00000000-0000-4000-8000-0000000008b1');
