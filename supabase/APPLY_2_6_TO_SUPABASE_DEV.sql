-- ============================================================================
-- TruTicket 2.6: orders, payments and settlements (Razorpay Test).
-- TARGET: truticket-dev ONLY (project ref oviqjnzlgbkmggytaqao).
-- NEVER run this on production (ccqbubgebsayoviilnul).
-- Needs 2.5 first (APPLY_2_5_TO_SUPABASE_DEV.sql: available_inventory, reserve_inventory).
-- Safe to run twice.
-- ============================================================================

-- TruTicket 005: orders, payments and the Razorpay webhook (PHASE2_PLAN §2.6). Service role only.
-- Order flow: begin_order (hold -> order) -> Razorpay order -> record_provider_order ->
-- webhook payment.captured -> apply_payment_captured (tickets, settlement) or payment.failed -> apply_payment_failed.
-- Every webhook event id is stored once, so a replayed webhook changes nothing.

-- Columns the flow needs (camelCase, like 001).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "providerOrderId" text UNIQUE;
ALTER TABLE inventory_reservations ADD COLUMN IF NOT EXISTS "orderId" uuid REFERENCES orders(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS settlements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"     uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  "amountMinor" integer NOT NULL,
  currency      text NOT NULL DEFAULT 'INR',
  "createdAt"   timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  "providerEventId" text PRIMARY KEY,
  kind              text NOT NULL,
  "receivedAt"      timestamptz(3) NOT NULL DEFAULT now()
);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON settlements, payment_webhook_events FROM PUBLIC, anon, authenticated;

-- Step 1: lock the hold and create the order (or return the one already made).
CREATE OR REPLACE FUNCTION public.begin_order(p_user uuid, p_reservation uuid)
RETURNS TABLE (order_id uuid, provider_order_id text, total_minor integer, currency text, event_id uuid, already boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r  inventory_reservations%ROWTYPE;
  t  ticket_types%ROWTYPE;
  o  orders%ROWTYPE;
  p  payments%ROWTYPE;
BEGIN
  SELECT * INTO r FROM inventory_reservations WHERE id = p_reservation FOR UPDATE;
  IF NOT FOUND OR r."userId" <> p_user THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF r."orderId" IS NOT NULL THEN
    SELECT * INTO o FROM orders WHERE id = r."orderId";
    SELECT * INTO p FROM payments WHERE "orderId" = o.id ORDER BY "createdAt" DESC LIMIT 1;
    RETURN QUERY SELECT o.id, p."providerOrderId", o."totalMinor", o.currency, o."eventId", true;
    RETURN;
  END IF;

  IF r.status <> 'active' OR r."expiresAt" <= now() THEN
    RAISE EXCEPTION 'RESERVATION_EXPIRED';
  END IF;

  SELECT * INTO t FROM ticket_types WHERE id = r."ticketTypeId";
  INSERT INTO orders ("buyerId", "eventId", status, "totalMinor", currency, "idempotencyKey")
  VALUES (p_user, r."eventId", 'PAYMENT_PENDING', t."faceValueMinor" * r.quantity, t.currency, 'reservation:' || r.id)
  RETURNING * INTO o;

  UPDATE inventory_reservations SET "orderId" = o.id WHERE id = r.id;
  RETURN QUERY SELECT o.id, NULL::text, o."totalMinor", o.currency, o."eventId", false;
END;
$$;

-- Step 2: store the Razorpay order id against our order.
CREATE OR REPLACE FUNCTION public.record_provider_order(p_order uuid, p_rzp_order text, p_amount integer, p_currency text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO payments ("orderId", provider, "providerOrderId", status)
  VALUES (p_order, 'razorpay', p_rzp_order, 'created');
END;
$$;

-- Webhook payment.captured. Returns DUPLICATE, ALREADY_ISSUED, AMOUNT_MISMATCH,
-- SOLD_OUT_AFTER_PAYMENT or ISSUED. Any RAISE rolls back the event record too, so Razorpay can retry.
CREATE OR REPLACE FUNCTION public.apply_payment_captured(
  p_event_id    text,
  p_rzp_order   text,
  p_rzp_payment text,
  p_amount      integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p  payments%ROWTYPE;
  o  orders%ROWTYPE;
  r  inventory_reservations%ROWTYPE;
  i  integer;
  tid uuid;
  n  integer;
BEGIN
  INSERT INTO payment_webhook_events ("providerEventId", kind)
  VALUES (p_event_id, 'payment.captured')
  ON CONFLICT ("providerEventId") DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'DUPLICATE';
  END IF;

  SELECT * INTO p FROM payments WHERE "providerOrderId" = p_rzp_order;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_ORDER';  -- rolls back the event record, so Razorpay's retry is processed (not DUPLICATE)
  END IF;

  SELECT * INTO o FROM orders WHERE id = p."orderId" FOR UPDATE;
  IF o.status = 'TICKET_ISSUED' THEN
    RETURN 'ALREADY_ISSUED';
  END IF;
  IF p_amount IS DISTINCT FROM o."totalMinor" THEN
    RETURN 'AMOUNT_MISMATCH';
  END IF;

  SELECT * INTO r FROM inventory_reservations WHERE "orderId" = o.id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_ORDER';  -- rolls back the event record, so Razorpay's retry is processed (not DUPLICATE)
  END IF;

  -- The hold may have expired while the buyer paid. Issue only if the seats are still free.
  IF NOT (r.status = 'active' AND r."expiresAt" > now())
     AND public.available_inventory(r."ticketTypeId") < r.quantity THEN
    UPDATE orders SET status = 'REFUND_PENDING', "updatedAt" = now() WHERE id = o.id;
    UPDATE payments SET status = 'captured', "providerPaymentId" = p_rzp_payment, "signatureVerified" = true, "updatedAt" = now()
     WHERE "providerOrderId" = p_rzp_order;
    RETURN 'SOLD_OUT_AFTER_PAYMENT';
  END IF;

  SELECT t."faceValueMinor" INTO i FROM ticket_types t WHERE t.id = r."ticketTypeId";
  FOR n IN 1..r.quantity LOOP
    INSERT INTO tickets ("eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
    VALUES (o."eventId", r."ticketTypeId", o."buyerId", i, 'ISSUED_ACTIVE')
    RETURNING id INTO tid;
    INSERT INTO order_items ("orderId", "ticketTypeId", "ticketId", "unitPriceMinor")
    VALUES (o.id, r."ticketTypeId", tid, i);
  END LOOP;

  UPDATE inventory_reservations SET status = 'converted' WHERE id = r.id;
  UPDATE orders SET status = 'TICKET_ISSUED', "updatedAt" = now() WHERE id = o.id;
  UPDATE payments SET status = 'captured', "providerPaymentId" = p_rzp_payment, "signatureVerified" = true, "updatedAt" = now()
   WHERE "providerOrderId" = p_rzp_order;
  INSERT INTO settlements ("orderId", "amountMinor", currency)
  VALUES (o.id, o."totalMinor", o.currency)
  ON CONFLICT ("orderId") DO NOTHING;

  RETURN 'ISSUED';
END;
$$;

-- Webhook payment.failed: release the hold so the seats go back on sale.
CREATE OR REPLACE FUNCTION public.apply_payment_failed(p_event_id text, p_rzp_order text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p payments%ROWTYPE;
  o orders%ROWTYPE;
BEGIN
  INSERT INTO payment_webhook_events ("providerEventId", kind)
  VALUES (p_event_id, 'payment.failed')
  ON CONFLICT ("providerEventId") DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'DUPLICATE';
  END IF;

  SELECT * INTO p FROM payments WHERE "providerOrderId" = p_rzp_order;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_ORDER';  -- rolls back the event record, so Razorpay's retry is processed (not DUPLICATE)
  END IF;

  SELECT * INTO o FROM orders WHERE id = p."orderId" FOR UPDATE;
  IF o.status = 'TICKET_ISSUED' THEN
    RETURN 'ALREADY_ISSUED';
  END IF;

  UPDATE orders SET status = 'PAYMENT_FAILED', "updatedAt" = now() WHERE id = o.id;
  UPDATE payments SET status = 'failed', "updatedAt" = now() WHERE "providerOrderId" = p_rzp_order;
  UPDATE inventory_reservations SET status = 'released'
   WHERE "orderId" = o.id AND status = 'active';
  RETURN 'RELEASED';
END;
$$;

REVOKE ALL ON FUNCTION public.begin_order(uuid, uuid)                                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_provider_order(uuid, text, integer, text)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_payment_captured(text, text, text, integer)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_payment_failed(text, text)                              FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_order(uuid, uuid)                                    TO service_role;
GRANT EXECUTE ON FUNCTION public.record_provider_order(uuid, text, integer, text)           TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_payment_captured(text, text, text, integer)          TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_payment_failed(text, text)                           TO service_role;
