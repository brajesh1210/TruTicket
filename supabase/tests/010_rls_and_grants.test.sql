-- 010 RLS, grants and audit tests (PHASE2_PLAN §2.10). Local PGlite check only: run after 001..009 and the earlier tests.
-- Not for Supabase: it expects the seed accounts and rolls back at the end.
-- Uses the seed accounts a2 (demo attendee) and a3 (other buyer), both verified, from 004_inventory_accounts.
-- Every "hidden" check first proves the row EXISTS (as table owner), so 0 rows means RLS, not an empty table.
-- A permission error counts as "hidden" too (same as T7 in 002). One transaction, ends with ROLLBACK.
BEGIN;

-- Count rows visible to a role. insufficient_privilege counts as 0 (denied).
CREATE OR REPLACE FUNCTION pg_temp.visible(p_role text, p_sub uuid, p_sql text) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE n integer := 0;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub)::text, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    EXECUTE p_sql INTO n;
  EXCEPTION WHEN insufficient_privilege THEN
    n := 0;
  END;
  RESET ROLE;
  RETURN n;
END $$;

DO $$
DECLARE
  a2 uuid := '00000000-0000-0000-0000-0000000000a2';
  a3 uuid := '00000000-0000-0000-0000-0000000000a3';
  u  uuid := '00000000-0000-0000-0000-0000000000c1';  -- new account, email NOT verified
  org_id uuid; ev_pub uuid; ev_draft uuid; ga uuid; corp uuid;
  t3 uuid; t3b uuid; tu uuid; lst uuid; gt uuid;
  n integer; res text; fn text; rec record; cnt integer;
BEGIN
  SELECT "organizerId", id INTO org_id, ev_pub FROM events WHERE title = 'TruTicket Demo Night' LIMIT 1;
  SELECT id INTO ga FROM ticket_types WHERE "eventId" = ev_pub AND name = 'General' LIMIT 1;

  INSERT INTO ticket_types ("eventId", name, "faceValueMinor", quantity, "saleStart", "saleEnd", "groupEligible", "perAccountLimit")
  VALUES (ev_pub, 'RLS Corporate', 200000, 100, now() - interval '1 day', now() + interval '30 days', true, 50)
  RETURNING id INTO corp;

  INSERT INTO events ("organizerId", title, venue, "startAt", "endAt", status)
  VALUES (org_id, 'RLS Draft Event', 'Hidden Hall', now() + interval '40 days', now() + interval '41 days', 'draft')
  RETURNING id INTO ev_draft;

  -- Data owned by a3 (created as table owner, RLS bypassed).
  INSERT INTO tickets ("eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
  VALUES (ev_pub, ga, a3, 49900, 'ISSUED_ACTIVE') RETURNING id INTO t3;
  INSERT INTO orders ("buyerId", "eventId", status, "totalMinor", currency, "idempotencyKey")
  VALUES (a3, ev_pub, 'TICKET_ISSUED', 49900, 'INR', 'rls-a3-order');
  INSERT INTO resale_listings ("ticketId", "sellerId", "askMinor", status)
  VALUES (t3, a3, 49900, 'ACTIVE') RETURNING id INTO lst;
  INSERT INTO resale_payments ("listingId", "buyerId", "amountMinor", "providerOrderId", status)
  VALUES (lst, a2, 49900, 'order_RLS_PAY', 'created');
  INSERT INTO tickets ("eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
  VALUES (ev_pub, corp, a3, 200000, 'ISSUED_ACTIVE') RETURNING id INTO t3b;
  INSERT INTO group_tickets ("orderId", "managerId", "ticketId", status, "claimToken", "inviteExpiresAt", "inviteeEmailKey")
  SELECT o.id, a3, t3b, 'INVITED', 'rls-claim-hash', now() + interval '7 days', 'demo.attendee@example.com'
    FROM orders o WHERE o."idempotencyKey" = 'rls-a3-order' RETURNING id INTO gt;
  INSERT INTO qr_credentials ("ticketId", "nonceHash", "expiresAt", "keyId", status)
  VALUES (t3, 'rls-nonce-hash', now() + interval '10 seconds', 'v1', 'active');

  -- T82: a buyer sees only their own orders and tickets.
  n := pg_temp.visible('authenticated', a2, format('SELECT count(*)::int FROM orders WHERE "buyerId" = %L', a3));
  IF n <> 0 THEN RAISE EXCEPTION 'T82 failed: attendee sees % orders of another buyer', n; END IF;
  n := pg_temp.visible('authenticated', a2, format('SELECT count(*)::int FROM tickets WHERE "currentOwnerId" = %L', a3));
  IF n <> 0 THEN RAISE EXCEPTION 'T82 failed: attendee sees % tickets of another owner', n; END IF;
  n := pg_temp.visible('authenticated', a3, format('SELECT count(*)::int FROM tickets WHERE "currentOwnerId" = %L', a3));
  IF n < 2 THEN RAISE EXCEPTION 'T82 failed: owner cannot see own tickets (saw %)', n; END IF;
  n := pg_temp.visible('authenticated', a3, format('SELECT count(*)::int FROM orders WHERE "buyerId" = %L', a3));
  IF n < 1 THEN RAISE EXCEPTION 'T82 failed: buyer cannot see own orders (saw %)', n; END IF;
  RAISE NOTICE 'T82 ok: buyers see only their own orders and tickets';

  -- T83: anon and attendees never read a draft event; anon reads the published one.
  n := pg_temp.visible('anon', NULL, format('SELECT count(*)::int FROM events WHERE id = %L', ev_draft));
  IF n <> 0 THEN RAISE EXCEPTION 'T83 failed: anon reads a draft event'; END IF;
  n := pg_temp.visible('authenticated', a2, format('SELECT count(*)::int FROM events WHERE id = %L', ev_draft));
  IF n <> 0 THEN RAISE EXCEPTION 'T83 failed: attendee reads a draft event'; END IF;
  n := pg_temp.visible('anon', NULL, format('SELECT count(*)::int FROM events WHERE id = %L', ev_pub));
  IF n < 1 THEN RAISE EXCEPTION 'T83 failed: anon cannot read the published event'; END IF;
  RAISE NOTICE 'T83 ok: draft events hidden, published events public';

  -- T84: marketplace, payment and group tables are closed to clients. Rows exist (checked as owner first).
  SELECT count(*) INTO cnt FROM resale_listings WHERE id = lst;
  IF cnt <> 1 THEN RAISE EXCEPTION 'T84 setup: listing missing'; END IF;
  SELECT count(*) INTO cnt FROM resale_payments WHERE "providerOrderId" = 'order_RLS_PAY';
  IF cnt <> 1 THEN RAISE EXCEPTION 'T84 setup: payment missing'; END IF;
  SELECT count(*) INTO cnt FROM group_tickets WHERE id = gt;
  IF cnt <> 1 THEN RAISE EXCEPTION 'T84 setup: group ticket missing'; END IF;
  SELECT count(*) INTO cnt FROM qr_credentials WHERE "nonceHash" = 'rls-nonce-hash';
  IF cnt <> 1 THEN RAISE EXCEPTION 'T84 setup: qr credential missing'; END IF;

  n := pg_temp.visible('authenticated', a2, 'SELECT count(*)::int FROM resale_listings');
  IF n <> 0 THEN RAISE EXCEPTION 'T84 failed: attendee reads resale_listings (%)', n; END IF;
  n := pg_temp.visible('anon', NULL, 'SELECT count(*)::int FROM resale_listings');
  IF n <> 0 THEN RAISE EXCEPTION 'T84 failed: anon reads resale_listings (%)', n; END IF;
  n := pg_temp.visible('authenticated', a2, 'SELECT count(*)::int FROM resale_payments');
  IF n <> 0 THEN RAISE EXCEPTION 'T84 failed: attendee reads resale_payments (%)', n; END IF;
  n := pg_temp.visible('anon', NULL, 'SELECT count(*)::int FROM resale_payments');
  IF n <> 0 THEN RAISE EXCEPTION 'T84 failed: anon reads resale_payments (%)', n; END IF;
  n := pg_temp.visible('authenticated', a3, 'SELECT count(*)::int FROM group_tickets');
  IF n <> 0 THEN RAISE EXCEPTION 'T84 failed: manager reads group_tickets directly (%)', n; END IF;
  n := pg_temp.visible('anon', NULL, 'SELECT count(*)::int FROM group_tickets');
  IF n <> 0 THEN RAISE EXCEPTION 'T84 failed: anon reads group_tickets (%)', n; END IF;
  n := pg_temp.visible('authenticated', a3, 'SELECT count(*)::int FROM qr_credentials');
  IF n <> 0 THEN RAISE EXCEPTION 'T84 failed: owner reads qr_credentials (%)', n; END IF;
  n := pg_temp.visible('anon', NULL, 'SELECT count(*)::int FROM qr_credentials');
  IF n <> 0 THEN RAISE EXCEPTION 'T84 failed: anon reads qr_credentials (%)', n; END IF;
  RAISE NOTICE 'T84 ok: resale, payment, group and QR tables closed to clients';

  -- T85: clients cannot run any 2.8 function (service role only).
  FOREACH fn IN ARRAY ARRAY[
    'public.resale_max_price_minor(integer,integer)', 'public.resale_release(uuid)',
    'public.resale_list(uuid,uuid,integer)', 'public.resale_cancel(uuid,uuid)',
    'public.resale_begin_purchase(uuid,uuid,integer)', 'public.resale_record_provider_order(uuid,text)',
    'public.apply_resale_captured(text,text,text,integer)', 'public.apply_resale_failed(text,text)',
    'public.group_allocate(uuid,uuid,text,text,integer)', 'public.group_claim(uuid,text)',
    'public.group_revoke(uuid,uuid)', 'public.group_keep_for_self(uuid,uuid)'
  ] LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE') OR has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'T85 failed: a client can execute %', fn;
    END IF;
  END LOOP;
  RAISE NOTICE 'T85 ok: 2.8 functions are service-only';

  -- T86: an UNVERIFIED account is blocked in the database for every resale and group money/transfer action.
  INSERT INTO auth.users (id, email) VALUES (u, 'rls.unverified@example.com');
  INSERT INTO user_emails (user_id, email, email_key, verified_at)
  VALUES (u, 'rls.unverified@example.com', 'rls.unverified@example.com', NULL);
  INSERT INTO tickets ("eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
  VALUES (ev_pub, ga, u, 49900, 'ISSUED_ACTIVE') RETURNING id INTO tu;

  SELECT out_result INTO res FROM resale_list(u, tu, 49900);
  IF res <> 'NOT_ALLOWED' THEN RAISE EXCEPTION 'T86 failed: unverified account can list a ticket (%)', res; END IF;
  SELECT out_result INTO res FROM resale_begin_purchase(u, lst);
  IF res <> 'NOT_ALLOWED' THEN RAISE EXCEPTION 'T86 failed: unverified account can start a resale purchase (%)', res; END IF;
  SELECT out_result INTO res FROM group_allocate(u, tu, 'other.buyer@example.com', 'rls-hash-1');
  IF res <> 'NOT_ALLOWED' THEN RAISE EXCEPTION 'T86 failed: unverified account can invite (%)', res; END IF;
  res := group_keep_for_self(u, tu);
  IF res <> 'NOT_ALLOWED' THEN RAISE EXCEPTION 'T86 failed: unverified account can keep a ticket (%)', res; END IF;
  SELECT out_result INTO res FROM group_claim(u, 'rls-claim-hash');
  IF res <> 'NOT_ALLOWED' THEN RAISE EXCEPTION 'T86 failed: unverified account can claim (%)', res; END IF;
  -- Ownership: cancelling someone else's listing is refused.
  res := resale_cancel(u, lst);
  IF res <> 'NOT_YOURS' THEN RAISE EXCEPTION 'T86 failed: cancel of another seller listing gave %', res; END IF;
  RAISE NOTICE 'T86 ok: unverified account blocked from list, buy, invite, keep and claim';

  -- T87: every table in public has RLS switched on (no table is open by accident).
  SELECT string_agg(c.relname, ', ') INTO res
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  IF res IS NOT NULL THEN RAISE EXCEPTION 'T87 failed: RLS off on public tables: %', res; END IF;
  RAISE NOTICE 'T87 ok: RLS on for every public table';

  -- T88: clients cannot change data except through the profile policy.
  -- (a) catalog: the only non-SELECT policy in public is profiles_self_update.
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO res
    FROM pg_policies WHERE schemaname = 'public' AND cmd <> 'SELECT';
  IF res IS DISTINCT FROM 'profiles.profiles_self_update' THEN
    RAISE EXCEPTION 'T88 failed: unexpected write policies: %', res;
  END IF;
  -- (b) behaviour: a DELETE from every public table, as attendee and as anon, removes nothing.
  FOR rec IN SELECT c.relname AS tname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
              WHERE ns.nspname = 'public' AND c.relkind = 'r' LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', a2)::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      EXECUTE format('DELETE FROM %I', rec.tname);
      GET DIAGNOSTICS cnt = ROW_COUNT;
    EXCEPTION WHEN insufficient_privilege THEN
      cnt := 0;
    END;
    RESET ROLE;
    IF cnt <> 0 THEN RAISE EXCEPTION 'T88 failed: attendee deleted % rows from %', cnt, rec.tname; END IF;
    SET LOCAL ROLE anon;
    BEGIN
      EXECUTE format('DELETE FROM %I', rec.tname);
      GET DIAGNOSTICS cnt = ROW_COUNT;
    EXCEPTION WHEN insufficient_privilege THEN
      cnt := 0;
    END;
    RESET ROLE;
    IF cnt <> 0 THEN RAISE EXCEPTION 'T88 failed: anon deleted % rows from %', cnt, rec.tname; END IF;
  END LOOP;
  -- (c) privilege: no client may TRUNCATE (TRUNCATE skips RLS).
  SELECT string_agg(c.relname, ', ') INTO res
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind = 'r'
     AND (has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('authenticated', c.oid, 'TRUNCATE'));
  IF res IS NOT NULL THEN RAISE EXCEPTION 'T88 failed: clients can TRUNCATE: %', res; END IF;
  RAISE NOTICE 'T88 ok: no client write policy except profiles, no client delete, no client truncate';

  -- T89: status and owner changes leave one audit row each (written by the database).
  UPDATE tickets SET status = 'REVOKED' WHERE id = tu;
  SELECT count(*) INTO cnt FROM audit_logs
   WHERE "objectId" = tu::text AND action = 'STATUS_CHANGED' AND outcome = 'ISSUED_ACTIVE -> REVOKED';
  IF cnt <> 1 THEN RAISE EXCEPTION 'T89 failed: status change audit rows = %', cnt; END IF;
  UPDATE tickets SET "currentOwnerId" = a3 WHERE id = tu;
  SELECT count(*) INTO cnt FROM audit_logs
   WHERE "objectId" = tu::text AND action = 'OWNER_CHANGED' AND outcome = u::text || ' -> ' || a3::text;
  IF cnt <> 1 THEN RAISE EXCEPTION 'T89 failed: owner change audit rows = %', cnt; END IF;
  -- An update that changes neither field writes nothing.
  UPDATE tickets SET "transferCount" = "transferCount" WHERE id = tu;
  SELECT count(*) INTO cnt FROM audit_logs WHERE "objectId" = tu::text;
  IF cnt <> 2 THEN RAISE EXCEPTION 'T89 failed: no-op update wrote audit rows (total %)', cnt; END IF;
  RAISE NOTICE 'T89 ok: status and owner changes are audited';

  -- T90: audit_logs is append-only for every role. UPDATE, DELETE and TRUNCATE must all be refused.
  BEGIN
    UPDATE audit_logs SET outcome = 'tampered';
    RAISE EXCEPTION 'T90 failed: audit_logs UPDATE allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUDIT_APPEND_ONLY' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM audit_logs;
    RAISE EXCEPTION 'T90 failed: audit_logs DELETE allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUDIT_APPEND_ONLY' THEN RAISE; END IF;
  END;
  BEGIN
    TRUNCATE audit_logs;
    RAISE EXCEPTION 'T90 failed: audit_logs TRUNCATE allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUDIT_APPEND_ONLY' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'T90 ok: audit_logs refuses UPDATE, DELETE and TRUNCATE';
END $$;

ROLLBACK;
