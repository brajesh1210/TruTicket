-- 007 resale and group tests (PHASE2_PLAN §2.8). Needs 003_seed (second run), 004, 005, 006 and 007 applied.
-- Users are the seeded verified accounts: a1 organiser, a2 demo attendee, a3 other buyer.
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

CREATE OR REPLACE FUNCTION pg_temp.mk_ticket(p_event uuid, p_type uuid, p_owner uuid, p_face integer, p_status text)
RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v uuid;
BEGIN
  INSERT INTO tickets ("eventId", "ticketTypeId", "currentOwnerId", "faceValueMinor", status)
  VALUES (p_event, p_type, p_owner, p_face, p_status::"TicketStatus")
  RETURNING id INTO v;
  RETURN v;
END $$;

DO $$
DECLARE
  seller uuid := '00000000-0000-0000-0000-0000000000a2';  -- demo attendee (verified)
  buyer  uuid := '00000000-0000-0000-0000-0000000000a3';  -- other buyer (verified)
  org    uuid := '00000000-0000-0000-0000-0000000000a1';  -- demo organiser (verified)
  org_id uuid;
  ev1 uuid; ev4 uuid; ga uuid; ga4 uuid; corp uuid; sc1 uuid; ord uuid;
  tk1 uuid; tk2 uuid; tk3 uuid; tk4 uuid;
  g1 uuid; g2 uuid; g3 uuid; g4 uuid; g5 uuid;
  l1 uuid; l1b uuid; l2 uuid; gid1 uuid; gid2 uuid; gid3 uuid;
  pay1 uuid; pay2 uuid; pay3 uuid; pay4 uuid; pay5 uuid;
  res text; mx integer; st text; n integer; ps text; ow uuid; amt integer; ev uuid;
  dummy text;
BEGIN
  -- Setup: a fresh published event (cutoff in the future), a second one whose cutoff has passed,
  -- one scanner for the first event, and the ticket types.
  SELECT "organizerId" INTO org_id FROM events WHERE title = 'TruTicket Demo Night' LIMIT 1;
  INSERT INTO events ("organizerId", title, venue, "startAt", "endAt", status)
  VALUES (org_id, 'Resale Test Event', 'Hall R', now() + interval '40 days', now() + interval '41 days', 'published')
  RETURNING id INTO ev1;
  INSERT INTO events ("organizerId", title, venue, "startAt", "endAt", status, "resaleCutoffAt")
  VALUES (org_id, 'Closed Resale Event', 'Hall C', now() + interval '40 days', now() + interval '41 days', 'published', now() - interval '1 hour')
  RETURNING id INTO ev4;
  INSERT INTO scanners ("eventId", "deviceName", status) VALUES (ev1, 'Resale gate', 'active') RETURNING id INTO sc1;
  INSERT INTO ticket_types ("eventId", name, "faceValueMinor", quantity, "saleStart", "saleEnd")
  VALUES (ev1, 'General', 49900, 100, now() - interval '1 day', now() + interval '30 days') RETURNING id INTO ga;
  INSERT INTO ticket_types ("eventId", name, "faceValueMinor", quantity, "saleStart", "saleEnd")
  VALUES (ev4, 'General', 49900, 100, now() - interval '1 day', now() + interval '30 days') RETURNING id INTO ga4;
  INSERT INTO ticket_types ("eventId", name, "faceValueMinor", quantity, "saleStart", "saleEnd", "groupEligible", "perAccountLimit")
  VALUES (ev1, 'Corporate Bulk', 200000, 100, now() - interval '1 day', now() + interval '30 days', true, 50) RETURNING id INTO corp;
  INSERT INTO orders ("buyerId", "eventId", status, "totalMinor", currency, "idempotencyKey")
  VALUES (seller, ev1, 'TICKET_ISSUED', 600000, 'INR', 'test-007-group-order') RETURNING id INTO ord;

  -- T57: cap maths (floor, exact cap allowed, no-profit cap, larger group ticket).
  IF resale_max_price_minor(49900, 11000) <> 54890 THEN RAISE EXCEPTION 'T57 failed: 49900 at 110%%'; END IF;
  IF resale_max_price_minor(999, 11000) <> 1098 THEN RAISE EXCEPTION 'T57 failed: floor 999 at 110%%'; END IF;
  IF resale_max_price_minor(49900, 10000) <> 49900 THEN RAISE EXCEPTION 'T57 failed: no-profit cap'; END IF;
  IF resale_max_price_minor(200000, 11000) <> 220000 THEN RAISE EXCEPTION 'T57 failed: group face'; END IF;

  -- Tickets for the resale tests. tk1 gets a QR before it is listed, so its old QR can be checked later.
  tk1 := pg_temp.mk_ticket(ev1, ga, seller, 49900, 'ISSUED_ACTIVE');
  tk2 := pg_temp.mk_ticket(ev1, ga, seller, 49900, 'ISSUED_ACTIVE');
  tk3 := pg_temp.mk_ticket(ev4, ga4, seller, 49900, 'ISSUED_ACTIVE');
  tk4 := pg_temp.mk_ticket(ev1, ga, seller, 49900, 'ISSUED_ACTIVE');
  res := issue_qr_nonce(tk1, seller, 'hash-old', now() + interval '10 seconds');
  IF res <> 'OK' THEN RAISE EXCEPTION 'setup failed: old QR %', res; END IF;

  -- T58: listing at the cap is accepted; the ticket becomes LISTED.
  SELECT out_result, out_listing_id, out_max_minor INTO res, l1, mx FROM resale_list(seller, tk1, 54890);
  IF res <> 'OK' OR mx <> 54890 THEN RAISE EXCEPTION 'T58 failed: % %', res, mx; END IF;
  SELECT status INTO st FROM tickets WHERE id = tk1;
  IF st <> 'LISTED' THEN RAISE EXCEPTION 'T58 failed: ticket %', st; END IF;

  -- T59: one rupee-paisa above the cap is refused, with the maximum returned; nothing changes.
  SELECT out_result, out_max_minor INTO res, mx FROM resale_list(seller, tk2, 54891);
  IF res <> 'OVER_CAP' OR mx <> 54890 THEN RAISE EXCEPTION 'T59 failed: % %', res, mx; END IF;
  SELECT status INTO st FROM tickets WHERE id = tk2;
  IF st <> 'ISSUED_ACTIVE' THEN RAISE EXCEPTION 'T59 failed: ticket changed to %', st; END IF;

  -- T60: zero price is refused.
  SELECT out_result INTO res FROM resale_list(seller, tk2, 0);
  IF res <> 'INVALID_PRICE' THEN RAISE EXCEPTION 'T60 failed: %', res; END IF;

  -- T61: not your ticket, and a ticket that is already listed.
  SELECT out_result INTO res FROM resale_list(buyer, tk2, 49900);
  IF res <> 'NOT_YOURS' THEN RAISE EXCEPTION 'T61 failed: %', res; END IF;
  SELECT out_result INTO res FROM resale_list(seller, tk1, 49900);
  IF res <> 'NOT_LISTABLE' THEN RAISE EXCEPTION 'T61 failed: second listing %', res; END IF;

  -- T62: a ticket in an event whose resale cutoff has passed cannot be listed.
  SELECT out_result INTO res FROM resale_list(seller, tk3, 49900);
  IF res <> 'CUTOFF_PASSED' THEN RAISE EXCEPTION 'T62 failed: %', res; END IF;

  -- T63: a ticket that already reached its transfer limit cannot be listed.
  UPDATE tickets SET "transferCount" = 2 WHERE id = tk4;
  SELECT out_result INTO res FROM resale_list(seller, tk4, 49900);
  IF res <> 'TRANSFER_LIMIT' THEN RAISE EXCEPTION 'T63 failed: %', res; END IF;
  UPDATE tickets SET "transferCount" = 0 WHERE id = tk4;

  -- T64: only the seller can cancel. Cancel returns the ticket to ISSUED_ACTIVE. Relist at the cap.
  IF public.resale_cancel(buyer, l1) <> 'NOT_YOURS' THEN RAISE EXCEPTION 'T64 failed: cancel by other'; END IF;
  IF public.resale_cancel(seller, l1) <> 'OK' THEN RAISE EXCEPTION 'T64 failed: cancel by seller'; END IF;
  SELECT status INTO st FROM tickets WHERE id = tk1;
  IF st <> 'ISSUED_ACTIVE' THEN RAISE EXCEPTION 'T64 failed: ticket after cancel %', st; END IF;
  SELECT out_listing_id INTO l1b FROM resale_list(seller, tk1, 54890);
  IF l1b IS NULL THEN RAISE EXCEPTION 'T64 failed: relist'; END IF;

  -- T65: the seller cannot buy their own listing. A second buyer is refused while a hold is live.
  SELECT out_result INTO res FROM resale_begin_purchase(seller, l1b);
  IF res <> 'OWN_LISTING' THEN RAISE EXCEPTION 'T65 failed: own %', res; END IF;
  SELECT out_result, out_payment_id, out_amount_minor, out_event_id INTO res, pay1, amt, ev FROM resale_begin_purchase(buyer, l1b);
  IF res <> 'OK' OR amt <> 54890 OR ev <> ev1 THEN RAISE EXCEPTION 'T65 failed: begin %', res; END IF;
  SELECT out_result INTO res FROM resale_begin_purchase(org, l1b);
  IF res <> 'PURCHASE_IN_PROGRESS' THEN RAISE EXCEPTION 'T65 failed: second buyer %', res; END IF;

  -- T66: a payment with the wrong amount is refused: money flagged, no transfer, listing back on sale.
  IF public.resale_record_provider_order(pay1, 'order_RS1') <> 'OK' THEN RAISE EXCEPTION 'T66 failed: record'; END IF;
  SELECT status INTO ps FROM resale_listings WHERE id = l1b;
  IF ps <> 'PURCHASE_PENDING' THEN RAISE EXCEPTION 'T66 failed: listing before capture %', ps; END IF;
  res := apply_resale_captured('evt-rs-1', 'order_RS1', 'pay_rs_1', 54889);
  IF res <> 'REFUND_NEEDED' THEN RAISE EXCEPTION 'T66 failed: wrong amount %', res; END IF;
  SELECT status INTO ps FROM resale_payments WHERE id = pay1;
  IF ps <> 'refund_needed' THEN RAISE EXCEPTION 'T66 failed: payment status %', ps; END IF;
  SELECT status INTO ps FROM resale_listings WHERE id = l1b;
  IF ps <> 'ACTIVE' THEN RAISE EXCEPTION 'T66 failed: listing after refund %', ps; END IF;
  SELECT "currentOwnerId" INTO ow FROM tickets WHERE id = tk1;
  IF ow <> seller THEN RAISE EXCEPTION 'T66 failed: ticket moved on refund'; END IF;

  -- T67: a correct payment transfers the ticket. Owner changes, count goes up, the old QR dies.
  SELECT out_result, out_payment_id INTO res, pay2 FROM resale_begin_purchase(buyer, l1b);
  IF res <> 'OK' THEN RAISE EXCEPTION 'T67 failed: begin %', res; END IF;
  IF public.resale_record_provider_order(pay2, 'order_RS2') <> 'OK' THEN RAISE EXCEPTION 'T67 failed: record'; END IF;
  res := apply_resale_captured('evt-rs-2', 'order_RS2', 'pay_rs_2', 54890);
  IF res <> 'TRANSFERRED' THEN RAISE EXCEPTION 'T67 failed: capture %', res; END IF;
  SELECT "currentOwnerId", status, "transferCount" INTO ow, st, n FROM tickets WHERE id = tk1;
  IF ow <> buyer OR st <> 'ISSUED_ACTIVE' OR n <> 1 THEN
    RAISE EXCEPTION 'T67 failed: ticket owner % status % count %', ow, st, n;
  END IF;
  SELECT count(*) INTO n FROM transfers WHERE "ticketId" = tk1 AND "priceMinor" = 54890 AND "toOwnerId" = buyer;
  IF n <> 1 THEN RAISE EXCEPTION 'T67 failed: transfer rows %', n; END IF;
  SELECT status INTO ps FROM resale_listings WHERE id = l1b;
  IF ps <> 'COMPLETED' THEN RAISE EXCEPTION 'T67 failed: listing %', ps; END IF;
  IF apply_resale_captured('evt-rs-2', 'order_RS2', 'pay_rs_2', 54890) <> 'DUPLICATE' THEN
    RAISE EXCEPTION 'T67 failed: replayed webhook was not DUPLICATE';
  END IF;
  IF apply_resale_captured('evt-rs-3', 'order_RS2', 'pay_rs_2b', 54890) <> 'ALREADY_TRANSFERRED' THEN
    RAISE EXCEPTION 'T67 failed: second event for a transferred payment';
  END IF;

  -- T68: the new owner gets a QR. The seller cannot. The seller's old QR is refused at the gate.
  res := issue_qr_nonce(tk1, seller, 'hash-seller-new', now() + interval '10 seconds');
  IF res <> 'NOT_YOURS' THEN RAISE EXCEPTION 'T68 failed: seller QR %', res; END IF;
  res := issue_qr_nonce(tk1, buyer, 'hash-buyer-new', now() + interval '10 seconds');
  IF res <> 'OK' THEN RAISE EXCEPTION 'T68 failed: buyer QR %', res; END IF;
  dummy := scan_ticket(tk1, ev1, sc1, 'scan-old-1', 'hash-old');
  IF dummy <> 'INVALID' THEN RAISE EXCEPTION 'T68 failed: old QR scanned as %', dummy; END IF;
  SELECT status INTO st FROM tickets WHERE id = tk1;
  IF st <> 'ISSUED_ACTIVE' THEN RAISE EXCEPTION 'T68 failed: ticket after old scan %', st; END IF;

  -- T69: a failed payment releases the hold. Its replay changes nothing.
  SELECT out_listing_id INTO l2 FROM resale_list(seller, tk2, 49900);
  SELECT out_result, out_payment_id INTO res, pay3 FROM resale_begin_purchase(buyer, l2);
  IF res <> 'OK' THEN RAISE EXCEPTION 'T69 failed: begin %', res; END IF;
  IF public.resale_record_provider_order(pay3, 'order_RS3') <> 'OK' THEN RAISE EXCEPTION 'T69 failed: record'; END IF;
  IF apply_resale_failed('evt-f-1', 'order_RS3') <> 'RELEASED' THEN RAISE EXCEPTION 'T69 failed: release'; END IF;
  SELECT status INTO ps FROM resale_listings WHERE id = l2;
  IF ps <> 'ACTIVE' THEN RAISE EXCEPTION 'T69 failed: listing after failure %', ps; END IF;
  SELECT status INTO st FROM tickets WHERE id = tk2;
  IF st <> 'LISTED' THEN RAISE EXCEPTION 'T69 failed: ticket after failure %', st; END IF;
  IF apply_resale_failed('evt-f-1', 'order_RS3') <> 'DUPLICATE' THEN RAISE EXCEPTION 'T69 failed: replay'; END IF;

  -- T70: an expired hold is taken over. Its old payment, if it arrives later, is refused.
  SELECT out_payment_id INTO pay4 FROM resale_begin_purchase(buyer, l2);
  IF public.resale_record_provider_order(pay4, 'order_RS4') <> 'OK' THEN RAISE EXCEPTION 'T70 failed: record 4'; END IF;
  UPDATE resale_listings SET "purchaseExpiresAt" = now() - interval '1 second' WHERE id = l2;
  SELECT out_result, out_payment_id INTO res, pay5 FROM resale_begin_purchase(org, l2);
  IF res <> 'OK' THEN RAISE EXCEPTION 'T70 failed: takeover %', res; END IF;
  SELECT status INTO ps FROM resale_payments WHERE id = pay4;
  IF ps <> 'expired' THEN RAISE EXCEPTION 'T70 failed: old attempt %', ps; END IF;
  IF public.resale_record_provider_order(pay5, 'order_RS5') <> 'OK' THEN RAISE EXCEPTION 'T70 failed: record 5'; END IF;
  IF apply_resale_captured('evt-s-1', 'order_RS4', 'pay_s4', 49900) <> 'REFUND_NEEDED' THEN
    RAISE EXCEPTION 'T70 failed: old attempt was not refused';
  END IF;
  SELECT status INTO ps FROM resale_listings WHERE id = l2;
  IF ps <> 'PURCHASE_PENDING' THEN RAISE EXCEPTION 'T70 failed: new hold lost %', ps; END IF;
  IF apply_resale_captured('evt-s-2', 'order_RS5', 'pay_s5', 49900) <> 'TRANSFERRED' THEN
    RAISE EXCEPTION 'T70 failed: new attempt did not transfer';
  END IF;

  -- T71: a webhook for an order we never made is an error (rolled back, so Razorpay retries).
  PERFORM pg_temp.expect_error('SELECT apply_resale_captured(''evt-u-1'', ''order_nope'', ''pay_x'', 1)', 'UNKNOWN_ORDER');
  PERFORM pg_temp.expect_error('SELECT apply_resale_failed(''evt-u-2'', ''order_nope'')', 'UNKNOWN_ORDER');

  -- Group tickets. Corporate Bulk tickets go to the manager's bucket when issued.
  g1 := pg_temp.mk_ticket(ev1, corp, seller, 200000, 'ISSUED_ACTIVE');
  INSERT INTO order_items ("orderId", "ticketTypeId", "ticketId", "unitPriceMinor") VALUES (ord, corp, g1, 200000);

  -- T72: a bucket ticket gets no QR, and cannot be listed for resale.
  SELECT status INTO st FROM tickets WHERE id = g1;
  IF st <> 'ISSUED_UNASSIGNED_GROUP' THEN RAISE EXCEPTION 'T72 failed: bucket status %', st; END IF;
  res := issue_qr_nonce(g1, seller, 'hash-g1-bucket', now() + interval '10 seconds');
  IF res <> 'NOT_ACTIVE' THEN RAISE EXCEPTION 'T72 failed: QR from bucket %', res; END IF;
  SELECT out_result INTO res FROM resale_list(seller, g1, 200000);
  IF res <> 'NOT_LISTABLE' THEN RAISE EXCEPTION 'T72 failed: list bucket %', res; END IF;

  -- T73: allocation guards: owner only, group tickets only, no self invite, valid email, one open invite.
  SELECT out_result INTO res FROM group_allocate(buyer, g1, 'other.buyer@example.com', 'hash-inv-1');
  IF res <> 'NOT_YOURS' THEN RAISE EXCEPTION 'T73 failed: non-owner %', res; END IF;
  SELECT out_result INTO res FROM group_allocate(seller, tk4, 'other.buyer@example.com', 'hash-x1');
  IF res <> 'NOT_GROUP_TICKET' THEN RAISE EXCEPTION 'T73 failed: not a group ticket %', res; END IF;
  SELECT out_result INTO res FROM group_allocate(seller, g1, 'Demo.Attendee@example.com', 'hash-x2');
  IF res <> 'SELF_INVITE' THEN RAISE EXCEPTION 'T73 failed: self invite %', res; END IF;
  SELECT out_result INTO res FROM group_allocate(seller, g1, 'bad-email', 'hash-x3');
  IF res <> 'INVALID_EMAIL' THEN RAISE EXCEPTION 'T73 failed: bad email %', res; END IF;
  SELECT out_result, out_group_id INTO res, gid1 FROM group_allocate(seller, g1, 'other.buyer@example.com', 'hash-inv-1');
  IF res <> 'OK' OR gid1 IS NULL THEN RAISE EXCEPTION 'T73 failed: allocate %', res; END IF;
  SELECT out_result INTO res FROM group_allocate(seller, g1, 'other.buyer@example.com', 'hash-inv-2');
  IF res <> 'ALREADY_INVITED' THEN RAISE EXCEPTION 'T73 failed: second invite %', res; END IF;

  -- T74: a claim from an account that does not hold the invited verified email is refused.
  SELECT out_result INTO res FROM group_claim(org, 'hash-inv-1');
  IF res <> 'WRONG_ACCOUNT' THEN RAISE EXCEPTION 'T74 failed: wrong account %', res; END IF;
  SELECT out_result INTO res FROM group_claim(buyer, 'hash-unknown');
  IF res <> 'NOT_FOUND' THEN RAISE EXCEPTION 'T74 failed: unknown code %', res; END IF;

  -- T75: the invited member claims. Zero-price transfer, count unchanged, member gets the QR, manager does not.
  SELECT out_result INTO res FROM group_claim(buyer, 'hash-inv-1');
  IF res <> 'CLAIMED' THEN RAISE EXCEPTION 'T75 failed: claim %', res; END IF;
  SELECT "currentOwnerId", status, "transferCount" INTO ow, st, n FROM tickets WHERE id = g1;
  IF ow <> buyer OR st <> 'ISSUED_ACTIVE' OR n <> 0 THEN RAISE EXCEPTION 'T75 failed: owner % status % count %', ow, st, n; END IF;
  SELECT count(*) INTO n FROM transfers WHERE "ticketId" = g1 AND "priceMinor" = 0 AND "fromOwnerId" = seller AND "toOwnerId" = buyer;
  IF n <> 1 THEN RAISE EXCEPTION 'T75 failed: zero-price transfer rows %', n; END IF;
  IF issue_qr_nonce(g1, buyer, 'hash-g1-member', now() + interval '10 seconds') <> 'OK' THEN
    RAISE EXCEPTION 'T75 failed: member has no QR';
  END IF;
  IF issue_qr_nonce(g1, seller, 'hash-g1-manager', now() + interval '10 seconds') <> 'NOT_YOURS' THEN
    RAISE EXCEPTION 'T75 failed: manager still has a QR';
  END IF;

  -- T76: the same claim code cannot be used twice.
  SELECT out_result INTO res FROM group_claim(buyer, 'hash-inv-1');
  IF res <> 'ALREADY_CLAIMED' THEN RAISE EXCEPTION 'T76 failed: second claim %', res; END IF;

  -- T77: the manager can revoke an unclaimed invite. A revoked code cannot be claimed.
  g2 := pg_temp.mk_ticket(ev1, corp, seller, 200000, 'ISSUED_ACTIVE');
  INSERT INTO order_items ("orderId", "ticketTypeId", "ticketId", "unitPriceMinor") VALUES (ord, corp, g2, 200000);
  SELECT out_group_id INTO gid2 FROM group_allocate(seller, g2, 'demo.organiser@example.com', 'hash-inv-3');
  IF gid2 IS NULL THEN RAISE EXCEPTION 'T77 failed: allocate'; END IF;
  IF public.group_revoke(buyer, gid2) <> 'NOT_YOURS' THEN RAISE EXCEPTION 'T77 failed: revoke by other'; END IF;
  IF public.group_revoke(seller, gid2) <> 'OK' THEN RAISE EXCEPTION 'T77 failed: revoke by manager'; END IF;
  SELECT out_result INTO res FROM group_claim(org, 'hash-inv-3');
  IF res <> 'REVOKED' THEN RAISE EXCEPTION 'T77 failed: claim after revoke %', res; END IF;
  SELECT "currentOwnerId", status INTO ow, st FROM tickets WHERE id = g2;
  IF ow <> seller OR st <> 'ISSUED_UNASSIGNED_GROUP' THEN RAISE EXCEPTION 'T77 failed: ticket after revoke % %', ow, st; END IF;

  -- T78: an expired invite cannot be claimed.
  g3 := pg_temp.mk_ticket(ev1, corp, seller, 200000, 'ISSUED_ACTIVE');
  INSERT INTO order_items ("orderId", "ticketTypeId", "ticketId", "unitPriceMinor") VALUES (ord, corp, g3, 200000);
  SELECT out_group_id INTO gid3 FROM group_allocate(seller, g3, 'demo.organiser@example.com', 'hash-inv-4');
  UPDATE group_tickets SET "inviteExpiresAt" = now() - interval '1 minute' WHERE id = gid3;
  SELECT out_result INTO res FROM group_claim(org, 'hash-inv-4');
  IF res <> 'EXPIRED' THEN RAISE EXCEPTION 'T78 failed: expired invite %', res; END IF;

  -- T79: the manager keeps ONE bucket ticket for themselves. A second one is refused.
  g4 := pg_temp.mk_ticket(ev1, corp, seller, 200000, 'ISSUED_ACTIVE');
  INSERT INTO order_items ("orderId", "ticketTypeId", "ticketId", "unitPriceMinor") VALUES (ord, corp, g4, 200000);
  IF public.group_keep_for_self(seller, g4) <> 'OK' THEN RAISE EXCEPTION 'T79 failed: keep'; END IF;
  IF issue_qr_nonce(g4, seller, 'hash-g4-own', now() + interval '10 seconds') <> 'OK' THEN
    RAISE EXCEPTION 'T79 failed: kept ticket has no QR';
  END IF;
  g5 := pg_temp.mk_ticket(ev1, corp, seller, 200000, 'ISSUED_ACTIVE');
  INSERT INTO order_items ("orderId", "ticketTypeId", "ticketId", "unitPriceMinor") VALUES (ord, corp, g5, 200000);
  IF public.group_keep_for_self(seller, g5) <> 'ALREADY_KEPT' THEN RAISE EXCEPTION 'T79 failed: second keep'; END IF;

  -- T80: a ticket that is still in the bucket (g5) cannot be listed for resale.
  SELECT out_result INTO res FROM resale_list(seller, g5, 200000);
  IF res <> 'NOT_LISTABLE' THEN RAISE EXCEPTION 'T80 failed: bucket listing %', res; END IF;
END $$;

ROLLBACK;
