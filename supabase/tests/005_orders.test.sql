-- 005 orders tests (PHASE2_PLAN §2.6). Needs 003_seed (second run), 004 and 005 applied.
-- Runs in one transaction and ends with ROLLBACK.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ttype(p_name text) RETURNS uuid
LANGUAGE sql AS $$
  SELECT t.id FROM ticket_types t JOIN events e ON e.id = t."eventId"
   WHERE e.title = 'TruTicket Demo Night' AND t.name = p_name
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql text, p_expect text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE msg text := 'NONE';
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    msg := SQLERRM;
  END;
  IF msg <> p_expect THEN
    RAISE EXCEPTION 'expected % but got %', p_expect, msg;
  END IF;
END $$;

DO $$
DECLARE
  att   uuid := '00000000-0000-0000-0000-0000000000a2';
  buyer uuid := '00000000-0000-0000-0000-0000000000a3';
  ga    uuid := pg_temp.ttype('General');
  stu   uuid := pg_temp.ttype('Student');
  res   record;
  b     record;
  b2    record;
  total integer;
  n     integer;
  st    text;
BEGIN
  -- T35: begin_order makes one order for the hold, and a second call returns the same one.
  SELECT * INTO res FROM reserve_inventory(att, ga, 2, 600);
  SELECT * INTO b FROM begin_order(att, res.reservation_id);
  IF b.already OR b.provider_order_id IS NOT NULL THEN RAISE EXCEPTION 'T35 failed: first call should be new'; END IF;
  IF b.total_minor <> 2 * 49900 THEN RAISE EXCEPTION 'T35 failed: total %', b.total_minor; END IF;
  SELECT * INTO b2 FROM begin_order(att, res.reservation_id);
  IF NOT b2.already OR b2.order_id <> b.order_id THEN RAISE EXCEPTION 'T35 failed: second call must return the same order'; END IF;
  RAISE NOTICE 'T35 ok: order made once, retry returns the same order (total % paise)', b.total_minor;

  -- T36: a captured payment issues 2 tickets, one settlement, and the seats stay sold.
  PERFORM record_provider_order(b.order_id, 'order_T36', b.total_minor, 'INR');
  st := apply_payment_captured('evt_36', 'order_T36', 'pay_36', b.total_minor);
  IF st <> 'ISSUED' THEN RAISE EXCEPTION 'T36 failed: %', st; END IF;
  SELECT count(*) INTO n FROM tickets WHERE "currentOwnerId" = att AND "ticketTypeId" = ga AND status = 'ISSUED_ACTIVE';
  IF n <> 2 THEN RAISE EXCEPTION 'T36 failed: tickets %', n; END IF;
  IF (SELECT status FROM orders WHERE id = b.order_id) <> 'TICKET_ISSUED' THEN RAISE EXCEPTION 'T36 failed: order status'; END IF;
  IF (SELECT count(*) FROM settlements WHERE "orderId" = b.order_id AND "amountMinor" = b.total_minor) <> 1 THEN
    RAISE EXCEPTION 'T36 failed: settlement row';
  END IF;
  IF available_inventory(ga) <> 198 THEN RAISE EXCEPTION 'T36 failed: GA left %', available_inventory(ga); END IF;
  RAISE NOTICE 'T36 ok: payment issued 2 tickets and 1 settlement row';

  -- T37: the same webhook event again changes nothing.
  st := apply_payment_captured('evt_36', 'order_T36', 'pay_36', b.total_minor);
  IF st <> 'DUPLICATE' THEN RAISE EXCEPTION 'T37 failed: %', st; END IF;
  -- T38: a new event for an order that is already issued changes nothing either.
  st := apply_payment_captured('evt_38', 'order_T36', 'pay_36', b.total_minor);
  IF st <> 'ALREADY_ISSUED' THEN RAISE EXCEPTION 'T38 failed: %', st; END IF;
  SELECT count(*) INTO n FROM tickets WHERE "currentOwnerId" = att;
  IF n <> 2 THEN RAISE EXCEPTION 'T38 failed: tickets now %', n; END IF;
  IF (SELECT count(*) FROM settlements WHERE "orderId" = b.order_id) <> 1 THEN RAISE EXCEPTION 'T38 failed: settlement count'; END IF;
  RAISE NOTICE 'T37 ok: replayed webhook changes nothing';
  RAISE NOTICE 'T38 ok: a second event on an issued order changes nothing';

  -- T39: an amount that does not match the order issues nothing.
  SELECT * INTO res FROM reserve_inventory(buyer, stu, 1, 600);
  SELECT * INTO b FROM begin_order(buyer, res.reservation_id);
  PERFORM record_provider_order(b.order_id, 'order_T39', b.total_minor, 'INR');
  st := apply_payment_captured('evt_39', 'order_T39', 'pay_39', 1);
  IF st <> 'AMOUNT_MISMATCH' THEN RAISE EXCEPTION 'T39 failed: %', st; END IF;
  IF (SELECT status FROM orders WHERE id = b.order_id) <> 'PAYMENT_PENDING' THEN RAISE EXCEPTION 'T39 failed: order moved'; END IF;
  RAISE NOTICE 'T39 ok: amount mismatch issues nothing';

  -- T40: payment failed releases the hold, and the seat goes back on sale.
  st := apply_payment_failed('evt_40', 'order_T39');
  IF st <> 'RELEASED' THEN RAISE EXCEPTION 'T40 failed: %', st; END IF;
  IF (SELECT status FROM inventory_reservations WHERE id = res.reservation_id) <> 'released' THEN
    RAISE EXCEPTION 'T40 failed: hold not released';
  END IF;
  IF available_inventory(stu) <> 100 THEN RAISE EXCEPTION 'T40 failed: Student left %', available_inventory(stu); END IF;
  IF (SELECT status FROM orders WHERE id = b.order_id) <> 'PAYMENT_FAILED' THEN RAISE EXCEPTION 'T40 failed: order status'; END IF;
  RAISE NOTICE 'T40 ok: failed payment releases the hold';

  -- T41: an unknown Razorpay order changes nothing.
  PERFORM pg_temp.expect_error(format('SELECT apply_payment_captured(%L,%L,%L,1)', 'evt_41', 'order_nope', 'pay_41'), 'UNKNOWN_ORDER');
  RAISE NOTICE 'T41 ok: unknown order raises so the webhook is retried';

  -- T42: an expired hold cannot start an order.
  SELECT * INTO res FROM reserve_inventory(buyer, ga, 1, 600);
  UPDATE inventory_reservations SET "expiresAt" = now() - interval '1 minute' WHERE id = res.reservation_id;
  PERFORM pg_temp.expect_error(format('SELECT * FROM begin_order(%L, %L)', buyer, res.reservation_id), 'RESERVATION_EXPIRED');
  RAISE NOTICE 'T42 ok: expired hold refused';

  -- T43: only the service role may call these.
  IF has_function_privilege('authenticated', 'public.begin_order(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.apply_payment_captured(text,text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T43 failed: client can run order functions';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.apply_payment_captured(text,text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T43 failed: service role cannot run webhook function';
  END IF;
  RAISE NOTICE 'T43 ok: only service role can run order functions';
END $$;

ROLLBACK;
