-- 004 inventory tests (PHASE2_PLAN §2.5). Needs 003_seed (second run) and 004_functions applied.
-- Everything runs in one transaction and ends with ROLLBACK.
BEGIN;

-- Helpers (temporary, gone at the end of the session).
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
  att uuid := '00000000-0000-0000-0000-0000000000a2';
  buyer uuid := '00000000-0000-0000-0000-0000000000a3';
  ga uuid := pg_temp.ttype('General');
  vip uuid := pg_temp.ttype('VIP');
  stu uuid := pg_temp.ttype('Student');
  r record;
BEGIN
  -- T27: a valid reservation takes seats from the pool.
  SELECT * INTO r FROM reserve_inventory(att, ga, 2, 600);
  IF r.reservation_id IS NULL OR r.expires_at <= now() THEN RAISE EXCEPTION 'T27 failed'; END IF;
  IF available_inventory(ga) <> 198 THEN RAISE EXCEPTION 'T27 failed: GA left %', available_inventory(ga); END IF;
  RAISE NOTICE 'T27 ok: reservation holds seats, GA left 198';

  -- T28: per-account limit is 4. 2 + 3 is refused, 2 + 2 is allowed.
  PERFORM pg_temp.expect_error(format('SELECT * FROM reserve_inventory(%L, %L, 3, 600)', att, ga), 'LIMIT_REACHED');
  SELECT * INTO r FROM reserve_inventory(att, ga, 2, 600);
  IF available_inventory(ga) <> 196 THEN RAISE EXCEPTION 'T28 failed'; END IF;
  RAISE NOTICE 'T28 ok: per-account limit 4 enforced';

  -- T29: bad quantity and bad hold time are refused.
  PERFORM pg_temp.expect_error(format('SELECT * FROM reserve_inventory(%L, %L, 0, 600)', att, stu), 'INVALID_QUANTITY');
  PERFORM pg_temp.expect_error(format('SELECT * FROM reserve_inventory(%L, %L, 11, 600)', att, stu), 'INVALID_QUANTITY');
  PERFORM pg_temp.expect_error(format('SELECT * FROM reserve_inventory(%L, %L, 1, 30)', att, stu), 'INVALID_QUANTITY');
  RAISE NOTICE 'T29 ok: bad quantity and hold time refused';

  -- T30: sold out. VIP has 2 seats. The buyer takes both, so the attendee gets SOLD_OUT.
  UPDATE ticket_types SET quantity = 2 WHERE id = vip;
  SELECT * INTO r FROM reserve_inventory(buyer, vip, 2, 600);
  PERFORM pg_temp.expect_error(format('SELECT * FROM reserve_inventory(%L, %L, 1, 600)', att, vip), 'SOLD_OUT');
  RAISE NOTICE 'T30 ok: sold out when reservations fill the pool';

  -- T31: an expired hold does not count, and release marks it expired.
  INSERT INTO inventory_reservations ("eventId", "ticketTypeId", "userId", quantity, "expiresAt", status)
  SELECT e.id, stu, buyer, 5, now() - interval '1 minute', 'active'
    FROM ticket_types t JOIN events e ON e.id = t."eventId" WHERE t.id = stu;
  IF available_inventory(stu) <> 100 THEN RAISE EXCEPTION 'T31 failed: Student left %', available_inventory(stu); END IF;
  IF release_expired_reservations() < 1 THEN RAISE EXCEPTION 'T31 failed: nothing released'; END IF;
  IF EXISTS (SELECT 1 FROM inventory_reservations WHERE "ticketTypeId" = stu AND "expiresAt" < now() AND status = 'active') THEN
    RAISE EXCEPTION 'T31 failed: expired hold still active';
  END IF;
  RAISE NOTICE 'T31 ok: expired hold ignored and released';

  -- T32: a draft event cannot be bought.
  UPDATE events SET status = 'draft' WHERE title = 'TruTicket Demo Night';
  PERFORM pg_temp.expect_error(format('SELECT * FROM reserve_inventory(%L, %L, 1, 600)', att, stu), 'EVENT_NOT_PUBLISHED');
  UPDATE events SET status = 'published' WHERE title = 'TruTicket Demo Night';
  RAISE NOTICE 'T32 ok: draft event refused';

  -- T33: a sale that has not started is refused.
  UPDATE ticket_types SET "saleStart" = now() + interval '1 day' WHERE id = stu;
  PERFORM pg_temp.expect_error(format('SELECT * FROM reserve_inventory(%L, %L, 1, 600)', att, stu), 'NOT_ON_SALE');
  UPDATE ticket_types SET "saleStart" = now() - interval '1 day' WHERE id = stu;
  RAISE NOTICE 'T33 ok: sale window enforced';

  -- T34: only the service role may call these. Clients (anon, authenticated) may not.
  IF has_function_privilege('authenticated', 'public.reserve_inventory(uuid,uuid,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T34 failed: authenticated can reserve';
  END IF;
  IF has_function_privilege('anon', 'public.reserve_inventory(uuid,uuid,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T34 failed: anon can reserve';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.reserve_inventory(uuid,uuid,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T34 failed: service role cannot reserve';
  END IF;
  RAISE NOTICE 'T34 ok: only service role can reserve';
END $$;

ROLLBACK;
