-- 006 tickets and gate tests (PHASE2_PLAN §2.7). Needs 003_seed (second run), 004, 005 and 006 applied.
-- One transaction. Ends with ROLLBACK.
BEGIN;

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
  att    uuid := '00000000-0000-0000-0000-0000000000a2';  -- demo attendee
  other  uuid := '00000000-0000-0000-0000-0000000000a3';  -- another buyer
  ev1    uuid;
  ev2    uuid;
  org    uuid;
  gaType uuid;
  sc1    uuid;
  sc2    uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid;
  res    text;
  n      integer;
BEGIN
  SELECT e.id, e."organizerId" INTO ev1, org FROM events e WHERE e.title = 'TruTicket Demo Night' LIMIT 1;
  SELECT id INTO gaType FROM ticket_types WHERE "eventId" = ev1 AND name = 'General';
  SELECT id INTO sc1 FROM scanners WHERE "eventId" = ev1 AND status = 'active' LIMIT 1;

  -- A second event of the same organiser, with its own scanner (for WRONG_EVENT and scanner checks).
  INSERT INTO events ("organizerId", title, venue, "startAt", "endAt", status)
  VALUES (org, 'Other Event', 'Other Hall', now() + interval '40 days', now() + interval '41 days', 'published')
  RETURNING id INTO ev2;
  INSERT INTO scanners ("eventId", "deviceName", status) VALUES (ev2, 'Other scanner', 'active') RETURNING id INTO sc2;

  -- Tickets for the attendee (ISSUED_ACTIVE), one per test; one REVOKED.
  INSERT INTO tickets ("eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
  VALUES (ev1, gaType, att, 49900, 'ISSUED_ACTIVE') RETURNING id INTO t1;
  INSERT INTO tickets ("eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
  VALUES (ev1, gaType, att, 49900, 'ISSUED_ACTIVE') RETURNING id INTO t2;
  INSERT INTO tickets ("eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
  VALUES (ev1, gaType, att, 49900, 'ISSUED_ACTIVE') RETURNING id INTO t3;
  INSERT INTO tickets ("eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
  VALUES (ev1, gaType, att, 49900, 'REVOKED') RETURNING id INTO t4;

  -- T44: the owner gets a QR nonce.
  res := issue_qr_nonce(t1, att, 'hash-t1-a', now() + interval '10 seconds');
  IF res <> 'OK' THEN RAISE EXCEPTION 'T44 failed: %', res; END IF;
  RAISE NOTICE 'T44 ok: owner gets a QR nonce';

  -- T45: another buyer cannot get a QR for this ticket.
  res := issue_qr_nonce(t1, other, 'hash-t1-x', now() + interval '10 seconds');
  IF res <> 'NOT_YOURS' THEN RAISE EXCEPTION 'T45 failed: %', res; END IF;
  RAISE NOTICE 'T45 ok: not the owner, refused';

  -- T46: first scan is VALID and the ticket becomes REDEEMED.
  res := scan_ticket(t1, ev1, sc1, 'key-46', 'hash-t1-a');
  IF res <> 'VALID' THEN RAISE EXCEPTION 'T46 failed: %', res; END IF;
  IF (SELECT status FROM tickets WHERE id = t1) <> 'REDEEMED' THEN RAISE EXCEPTION 'T46 failed: ticket not redeemed'; END IF;
  RAISE NOTICE 'T46 ok: first scan VALID, ticket REDEEMED';

  -- T47: the same QR scanned again (new scan key) is ALREADY_USED.
  res := scan_ticket(t1, ev1, sc1, 'key-47', 'hash-t1-a');
  IF res <> 'ALREADY_USED' THEN RAISE EXCEPTION 'T47 failed: %', res; END IF;
  RAISE NOTICE 'T47 ok: second scan ALREADY_USED';

  -- T48: retrying the first scan with the same key returns the same answer and adds no row.
  res := scan_ticket(t1, ev1, sc1, 'key-46', 'hash-t1-a');
  IF res <> 'VALID' THEN RAISE EXCEPTION 'T48 failed: %', res; END IF;
  SELECT count(*) INTO n FROM redemptions WHERE "idempotencyKey" = 'key-46';
  IF n <> 1 THEN RAISE EXCEPTION 'T48 failed: % redemption rows for one key', n; END IF;
  RAISE NOTICE 'T48 ok: retry of the same scan is idempotent';

  -- T49: an expired QR is refused, and the ticket stays unused.
  PERFORM issue_qr_nonce(t2, att, 'hash-t2-old', now() - interval '1 second');
  res := scan_ticket(t2, ev1, sc1, 'key-49', 'hash-t2-old');
  IF res <> 'EXPIRED' THEN RAISE EXCEPTION 'T49 failed: %', res; END IF;
  IF (SELECT status FROM tickets WHERE id = t2) <> 'ISSUED_ACTIVE' THEN RAISE EXCEPTION 'T49 failed: expired scan changed the ticket'; END IF;
  RAISE NOTICE 'T49 ok: expired QR refused, ticket untouched';

  -- T50: a valid QR (ticket for event 1) scanned at event 2 gives WRONG_EVENT.
  PERFORM issue_qr_nonce(t3, att, 'hash-t3', now() + interval '10 seconds');
  res := scan_ticket(t3, ev2, sc2, 'key-50', 'hash-t3');
  IF res <> 'WRONG_EVENT' THEN RAISE EXCEPTION 'T50 failed: %', res; END IF;
  RAISE NOTICE 'T50 ok: wrong event refused';

  -- T51: a nonce that was never issued for this ticket is INVALID.
  res := scan_ticket(t2, ev1, sc1, 'key-51', 'hash-never-issued');
  IF res <> 'INVALID' THEN RAISE EXCEPTION 'T51 failed: %', res; END IF;
  RAISE NOTICE 'T51 ok: unknown nonce is INVALID';

  -- T52: a revoked ticket is INVALID even with a fresh QR.
  PERFORM issue_qr_nonce(t4, att, 'hash-t4', now() + interval '10 seconds') ;
  res := scan_ticket(t4, ev1, sc1, 'key-52', 'hash-t4');
  IF res <> 'INVALID' THEN RAISE EXCEPTION 'T52 failed: %', res; END IF;
  RAISE NOTICE 'T52 ok: revoked ticket is INVALID';

  -- T53: a scanner of another event cannot scan here.
  PERFORM pg_temp.expect_error(format('SELECT scan_ticket(%L,%L,%L,%L,%L)', t2, ev1, sc2, 'key-53', 'hash-t2-old'), 'SCANNER_NOT_FOUND');
  RAISE NOTICE 'T53 ok: scanner of another event refused';

  -- T54: a scan key cannot be reused for a different ticket.
  PERFORM pg_temp.expect_error(format('SELECT scan_ticket(%L,%L,%L,%L,%L)', t2, ev1, sc1, 'key-46', 'hash-t2-old'), 'KEY_REUSED');
  RAISE NOTICE 'T54 ok: key reuse across tickets refused';

  -- T55: issuing for an unknown ticket is NOT_FOUND.
  res := issue_qr_nonce('00000000-0000-0000-0000-00000000dead', att, 'h', now() + interval '10 seconds');
  IF res <> 'NOT_FOUND' THEN RAISE EXCEPTION 'T55 failed: %', res; END IF;
  RAISE NOTICE 'T55 ok: unknown ticket NOT_FOUND';

  -- T56: only the service role runs these.
  IF has_function_privilege('authenticated', 'public.scan_ticket(uuid,uuid,uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.issue_qr_nonce(uuid,uuid,text,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T56 failed: client can run gate functions';
  END IF;
  RAISE NOTICE 'T56 ok: only service role runs the gate functions';
END $$;

ROLLBACK;
