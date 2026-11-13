-- ============================================================================
-- TruTicket 2.8: resale with a price cap, transfer limit, and group distribution (FR-027).
-- TARGET: truticket-dev ONLY (project ref oviqjnzlgbkmggytaqao).
-- NEVER run this on production (ccqbubgebsayoviilnul).
-- Needs 2.7 first (APPLY_2_7_TO_SUPABASE_DEV.sql). Safe to run twice: the ALTERs and CREATEs use IF NOT EXISTS or OR REPLACE.
-- ============================================================================

-- TruTicket 007: resale with a price cap, transfer limit, and group distribution (FR-027).
-- PHASE2_PLAN §2.8. PRD §6.5 (resale) and §6.6 (group). Service role only.
--
-- Price cap: max = floor(faceValueMinor * resaleCapBps / 10000). Checked when listing AND again at payment.
-- Resale purchase: resale_begin_purchase (holds the listing) -> Razorpay order -> resale_record_provider_order
--   -> webhook payment.captured -> apply_resale_captured (transfer) or payment.failed -> apply_resale_failed (release).
--   A payment that arrives after its hold was replaced is flagged refund_needed. It never transfers.
-- Group: a ticket of a groupEligible type sits in the manager's bucket (ISSUED_UNASSIGNED_GROUP, no QR).
--   An invite is claimed once by the invited, verified email. The claim moves ownership at zero price.

-- Event resale policy (PRD §5.1 step 4). Defaults: 110% cap, 2 transfers, cutoff = event start.
ALTER TABLE events ADD COLUMN IF NOT EXISTS "resaleCapBps" integer NOT NULL DEFAULT 11000
  CHECK ("resaleCapBps" BETWEEN 10000 AND 20000);
ALTER TABLE events ADD COLUMN IF NOT EXISTS "resaleTransferLimit" integer NOT NULL DEFAULT 2
  CHECK ("resaleTransferLimit" BETWEEN 1 AND 10);
ALTER TABLE events ADD COLUMN IF NOT EXISTS "resaleCutoffAt" timestamptz(3);
ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS "groupEligible" boolean NOT NULL DEFAULT false;

-- One resale payment attempt per buy. A listing is held by one attempt at a time.
CREATE TABLE IF NOT EXISTS resale_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId"         uuid NOT NULL REFERENCES resale_listings(id) ON DELETE CASCADE,
  "buyerId"           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "amountMinor"       integer NOT NULL,
  "providerOrderId"   text UNIQUE,
  "providerPaymentId" text,
  status              text NOT NULL DEFAULT 'pending',
  "createdAt"         timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz(3) NOT NULL DEFAULT now()
);
ALTER TABLE resale_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON resale_payments FROM PUBLIC, anon, authenticated;

ALTER TABLE resale_listings ADD COLUMN IF NOT EXISTS "buyerId" uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE resale_listings ADD COLUMN IF NOT EXISTS "purchaseExpiresAt" timestamptz(3);
ALTER TABLE resale_listings ADD COLUMN IF NOT EXISTS "activePaymentId" uuid REFERENCES resale_payments(id) ON DELETE SET NULL;
ALTER TABLE group_tickets ADD COLUMN IF NOT EXISTS "inviteeEmailKey" text;

-- One open listing per ticket, one open invite per ticket, one invite per claim code.
CREATE UNIQUE INDEX IF NOT EXISTS uq_resale_open_ticket
  ON resale_listings ("ticketId") WHERE status IN ('ACTIVE', 'PURCHASE_PENDING');
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_open_invite
  ON group_tickets ("ticketId") WHERE status = 'INVITED';
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_claim_token
  ON group_tickets ("claimToken") WHERE "claimToken" IS NOT NULL;

-- Tickets of a groupEligible type go straight to the manager's bucket. No QR until allocated or kept.
CREATE OR REPLACE FUNCTION public.group_bucket_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'ISSUED_ACTIVE' AND EXISTS (
       SELECT 1 FROM ticket_types tt WHERE tt.id = NEW."ticketTypeId" AND tt."groupEligible") THEN
    NEW.status := 'ISSUED_UNASSIGNED_GROUP';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_group_bucket ON tickets;
CREATE TRIGGER trg_group_bucket BEFORE INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION public.group_bucket_on_insert();

-- Price cap in minor units. Floor, never rounds up.
CREATE OR REPLACE FUNCTION public.resale_max_price_minor(p_face integer, p_cap_bps integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ((p_face::bigint * p_cap_bps::bigint) / 10000)::integer
$$;

-- Internal: put a listing back on sale after a failed or refused payment.
-- Back to ACTIVE only if the ticket is still listed, with the same owner, under the limit, before cutoff.
-- Otherwise the listing is CANCELLED and the ticket returns to ISSUED_ACTIVE.
CREATE OR REPLACE FUNCTION public.resale_release(p_listing uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l resale_listings%ROWTYPE;
  t tickets%ROWTYPE;
  e events%ROWTYPE;
  v_ok boolean;
BEGIN
  SELECT * INTO l FROM resale_listings WHERE id = p_listing FOR UPDATE;
  SELECT * INTO t FROM tickets WHERE id = l."ticketId" FOR UPDATE;
  SELECT * INTO e FROM events WHERE id = t."eventId";
  v_ok := t.status = 'LISTED'
          AND t."currentOwnerId" = l."sellerId"
          AND t."transferCount" < e."resaleTransferLimit"
          AND now() < COALESCE(e."resaleCutoffAt", e."startAt");
  UPDATE resale_listings
     SET status = (CASE WHEN v_ok THEN 'ACTIVE' ELSE 'CANCELLED' END)::"ResaleListingStatus",
         "buyerId" = NULL, "activePaymentId" = NULL, "purchaseExpiresAt" = NULL, "updatedAt" = now()
   WHERE id = l.id;
  IF NOT v_ok AND t.status = 'LISTED' THEN
    UPDATE tickets SET status = 'ISSUED_ACTIVE', "updatedAt" = now() WHERE id = t.id;
  END IF;
END;
$$;

-- Seller lists a ticket. Returns OK, OVER_CAP (with the maximum), INVALID_PRICE, NOT_YOURS, NOT_LISTABLE,
-- CUTOFF_PASSED, TRANSFER_LIMIT, NOT_FOUND or NOT_ALLOWED.
CREATE OR REPLACE FUNCTION public.resale_list(p_seller uuid, p_ticket uuid, p_ask integer)
RETURNS TABLE (out_result text, out_listing_id uuid, out_max_minor integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t     tickets%ROWTYPE;
  e     events%ROWTYPE;
  v_max integer;
  v_id  uuid;
BEGIN
  IF NOT public.can_transact(p_seller) THEN
    RETURN QUERY SELECT 'NOT_ALLOWED'::text, NULL::uuid, NULL::integer; RETURN;
  END IF;
  SELECT * INTO t FROM tickets WHERE id = p_ticket FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::integer; RETURN;
  END IF;
  IF t."currentOwnerId" <> p_seller THEN
    RETURN QUERY SELECT 'NOT_YOURS'::text, NULL::uuid, NULL::integer; RETURN;
  END IF;
  SELECT * INTO e FROM events WHERE id = t."eventId";
  IF t.status <> 'ISSUED_ACTIVE' OR e.status <> 'published' THEN
    RETURN QUERY SELECT 'NOT_LISTABLE'::text, NULL::uuid, NULL::integer; RETURN;
  END IF;
  IF now() >= COALESCE(e."resaleCutoffAt", e."startAt") THEN
    RETURN QUERY SELECT 'CUTOFF_PASSED'::text, NULL::uuid, NULL::integer; RETURN;
  END IF;
  IF t."transferCount" >= e."resaleTransferLimit" THEN
    RETURN QUERY SELECT 'TRANSFER_LIMIT'::text, NULL::uuid, NULL::integer; RETURN;
  END IF;
  IF p_ask IS NULL OR p_ask < 1 THEN
    RETURN QUERY SELECT 'INVALID_PRICE'::text, NULL::uuid, NULL::integer; RETURN;
  END IF;
  v_max := public.resale_max_price_minor(t."faceValueMinor", e."resaleCapBps");
  IF p_ask > v_max THEN
    RETURN QUERY SELECT 'OVER_CAP'::text, NULL::uuid, v_max; RETURN;
  END IF;

  INSERT INTO resale_listings ("ticketId", "sellerId", "askMinor", status, "expiresAt")
  VALUES (t.id, p_seller, p_ask, 'ACTIVE', COALESCE(e."resaleCutoffAt", e."startAt"))
  RETURNING id INTO v_id;
  UPDATE tickets SET status = 'LISTED', "updatedAt" = now() WHERE id = t.id;
  RETURN QUERY SELECT 'OK'::text, v_id, v_max;
END;
$$;

-- Seller takes a listing down. Only while it is ACTIVE (not while a buyer is paying).
CREATE OR REPLACE FUNCTION public.resale_cancel(p_seller uuid, p_listing uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l resale_listings%ROWTYPE;
BEGIN
  SELECT * INTO l FROM resale_listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND THEN RETURN 'NOT_FOUND'; END IF;
  IF l."sellerId" <> p_seller THEN RETURN 'NOT_YOURS'; END IF;
  IF l.status <> 'ACTIVE' THEN RETURN 'NOT_CANCELLABLE'; END IF;
  UPDATE resale_listings SET status = 'CANCELLED', "updatedAt" = now() WHERE id = l.id;
  UPDATE tickets SET status = 'ISSUED_ACTIVE', "updatedAt" = now()
   WHERE id = l."ticketId" AND status = 'LISTED';
  RETURN 'OK';
END;
$$;

-- Buyer starts paying for a listing. Holds it for p_ttl_seconds (60 to 1800, default 900).
-- Returns OK, NOT_FOUND, NOT_ALLOWED, OWN_LISTING, PURCHASE_IN_PROGRESS, NOT_FOR_SALE,
-- CUTOFF_PASSED or TRANSFER_LIMIT. An expired hold is taken over and its old attempt is marked expired.
CREATE OR REPLACE FUNCTION public.resale_begin_purchase(p_buyer uuid, p_listing uuid, p_ttl_seconds integer DEFAULT 900)
RETURNS TABLE (out_result text, out_payment_id uuid, out_amount_minor integer, out_event_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l    resale_listings%ROWTYPE;
  t    tickets%ROWTYPE;
  e    events%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 60 OR p_ttl_seconds > 1800 THEN
    RAISE EXCEPTION 'INVALID_TTL';
  END IF;
  IF NOT public.can_transact(p_buyer) THEN
    RETURN QUERY SELECT 'NOT_ALLOWED'::text, NULL::uuid, NULL::integer, NULL::uuid; RETURN;
  END IF;
  SELECT * INTO l FROM resale_listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::integer, NULL::uuid; RETURN;
  END IF;
  IF l."sellerId" = p_buyer THEN
    RETURN QUERY SELECT 'OWN_LISTING'::text, NULL::uuid, NULL::integer, NULL::uuid; RETURN;
  END IF;
  IF l.status = 'PURCHASE_PENDING' AND l."purchaseExpiresAt" > now() THEN
    RETURN QUERY SELECT 'PURCHASE_IN_PROGRESS'::text, NULL::uuid, NULL::integer, NULL::uuid; RETURN;
  ELSIF l.status = 'PURCHASE_PENDING' THEN
    -- The hold expired. Its attempt can no longer transfer, even if its payment arrives later.
    UPDATE resale_payments SET status = 'expired', "updatedAt" = now()
     WHERE id = l."activePaymentId" AND status IN ('pending', 'created');
  ELSIF l.status <> 'ACTIVE' THEN
    RETURN QUERY SELECT 'NOT_FOR_SALE'::text, NULL::uuid, NULL::integer, NULL::uuid; RETURN;
  END IF;

  SELECT * INTO t FROM tickets WHERE id = l."ticketId" FOR UPDATE;
  SELECT * INTO e FROM events WHERE id = t."eventId";
  IF t.status <> 'LISTED' OR t."currentOwnerId" <> l."sellerId" THEN
    RETURN QUERY SELECT 'NOT_FOR_SALE'::text, NULL::uuid, NULL::integer, NULL::uuid; RETURN;
  END IF;
  IF now() >= COALESCE(e."resaleCutoffAt", e."startAt") THEN
    RETURN QUERY SELECT 'CUTOFF_PASSED'::text, NULL::uuid, NULL::integer, NULL::uuid; RETURN;
  END IF;
  IF t."transferCount" >= e."resaleTransferLimit" THEN
    RETURN QUERY SELECT 'TRANSFER_LIMIT'::text, NULL::uuid, NULL::integer, NULL::uuid; RETURN;
  END IF;

  INSERT INTO resale_payments ("listingId", "buyerId", "amountMinor", status)
  VALUES (l.id, p_buyer, l."askMinor", 'pending')
  RETURNING id INTO v_id;
  UPDATE resale_listings
     SET status = 'PURCHASE_PENDING', "buyerId" = p_buyer, "activePaymentId" = v_id,
         "purchaseExpiresAt" = now() + make_interval(secs => p_ttl_seconds), "updatedAt" = now()
   WHERE id = l.id;
  RETURN QUERY SELECT 'OK'::text, v_id, l."askMinor", t."eventId";
END;
$$;

-- Store the Razorpay order id on a pending attempt. Returns OK or NOT_PENDING.
CREATE OR REPLACE FUNCTION public.resale_record_provider_order(p_payment uuid, p_rzp_order text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE resale_payments
     SET "providerOrderId" = p_rzp_order, status = 'created', "updatedAt" = now()
   WHERE id = p_payment AND status = 'pending';
  IF NOT FOUND THEN RETURN 'NOT_PENDING'; END IF;
  RETURN 'OK';
END;
$$;

-- Webhook payment.captured for a resale attempt. Returns TRANSFERRED, DUPLICATE, ALREADY_TRANSFERRED,
-- or REFUND_NEEDED (the money came in but the transfer must not happen; the refund is a manual step).
-- RAISE UNKNOWN_ORDER rolls back the event record, so Razorpay's retry is processed.
CREATE OR REPLACE FUNCTION public.apply_resale_captured(
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
  p resale_payments%ROWTYPE;
  l resale_listings%ROWTYPE;
  t tickets%ROWTYPE;
  e events%ROWTYPE;
  v_id uuid;
BEGIN
  INSERT INTO payment_webhook_events ("providerEventId", kind)
  VALUES (p_event_id, 'resale.captured')
  ON CONFLICT ("providerEventId") DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'DUPLICATE';
  END IF;
  SELECT * INTO p FROM resale_payments WHERE "providerOrderId" = p_rzp_order FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_ORDER';
  END IF;
  IF p.status = 'captured' THEN
    RETURN 'ALREADY_TRANSFERRED';
  END IF;
  SELECT * INTO l FROM resale_listings WHERE id = p."listingId" FOR UPDATE;
  SELECT * INTO t FROM tickets WHERE id = l."ticketId" FOR UPDATE;
  SELECT * INTO e FROM events WHERE id = t."eventId";

  -- The hold must still be this attempt's. The amount, owner, cutoff and limit must still hold.
  IF l.status <> 'PURCHASE_PENDING' OR l."activePaymentId" IS DISTINCT FROM p.id THEN
    UPDATE resale_payments SET status = 'refund_needed', "providerPaymentId" = p_rzp_payment, "updatedAt" = now()
     WHERE id = p.id;
    RETURN 'REFUND_NEEDED';
  END IF;
  IF p_amount IS DISTINCT FROM l."askMinor"
     OR t.status <> 'LISTED'
     OR t."currentOwnerId" <> l."sellerId"
     OR t."transferCount" >= e."resaleTransferLimit"
     OR now() >= COALESCE(e."resaleCutoffAt", e."startAt") THEN
    UPDATE resale_payments SET status = 'refund_needed', "providerPaymentId" = p_rzp_payment, "updatedAt" = now()
     WHERE id = p.id;
    PERFORM public.resale_release(l.id);
    RETURN 'REFUND_NEEDED';
  END IF;

  -- Transfer. Ownership moves, the count goes up, and the old owner's unredeemed QR credentials die.
  UPDATE tickets
     SET "currentOwnerId" = l."buyerId", status = 'ISSUED_ACTIVE',
         "transferCount" = "transferCount" + 1, "updatedAt" = now()
   WHERE id = t.id;
  UPDATE qr_credentials SET status = 'revoked' WHERE "ticketId" = t.id AND status = 'active';
  UPDATE resale_listings SET status = 'COMPLETED', "updatedAt" = now() WHERE id = l.id;
  INSERT INTO transfers ("ticketId", "fromOwnerId", "toOwnerId", "priceMinor", status)
  VALUES (t.id, l."sellerId", l."buyerId", p_amount, 'completed')
  RETURNING id INTO v_id;
  UPDATE resale_payments SET status = 'captured', "providerPaymentId" = p_rzp_payment, "updatedAt" = now()
   WHERE id = p.id;
  RETURN 'TRANSFERRED';
END;
$$;

-- Webhook payment.failed for a resale attempt. Returns RELEASED, NOOP, DUPLICATE or ALREADY_TRANSFERRED.
CREATE OR REPLACE FUNCTION public.apply_resale_failed(p_event_id text, p_rzp_order text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p resale_payments%ROWTYPE;
  l resale_listings%ROWTYPE;
BEGIN
  INSERT INTO payment_webhook_events ("providerEventId", kind)
  VALUES (p_event_id, 'resale.failed')
  ON CONFLICT ("providerEventId") DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'DUPLICATE';
  END IF;
  SELECT * INTO p FROM resale_payments WHERE "providerOrderId" = p_rzp_order FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_ORDER';
  END IF;
  IF p.status = 'captured' THEN
    RETURN 'ALREADY_TRANSFERRED';
  END IF;
  UPDATE resale_payments SET status = 'failed', "updatedAt" = now()
   WHERE id = p.id AND status IN ('pending', 'created');
  SELECT * INTO l FROM resale_listings WHERE id = p."listingId" FOR UPDATE;
  IF l.status = 'PURCHASE_PENDING' AND l."activePaymentId" = p.id THEN
    PERFORM public.resale_release(l.id);
    RETURN 'RELEASED';
  END IF;
  RETURN 'NOOP';
END;
$$;

-- Manager invites a member to a bucket ticket. Stores only the hash of the claim code.
-- Returns OK, NOT_ALLOWED, INVALID_EMAIL, INVALID_TTL, NOT_FOUND, NOT_YOURS, NOT_GROUP_TICKET,
-- NOT_IN_BUCKET, SELF_INVITE, ALREADY_INVITED or NO_ORDER.
CREATE OR REPLACE FUNCTION public.group_allocate(
  p_manager     uuid,
  p_ticket      uuid,
  p_invitee     text,
  p_token_hash  text,
  p_ttl_hours   integer DEFAULT 168
)
RETURNS TABLE (out_result text, out_group_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t       tickets%ROWTYPE;
  tt      ticket_types%ROWTYPE;
  v_key   text;
  v_order uuid;
  v_id    uuid;
BEGIN
  IF NOT public.can_transact(p_manager) THEN
    RETURN QUERY SELECT 'NOT_ALLOWED'::text, NULL::uuid; RETURN;
  END IF;
  IF p_invitee IS NULL OR position('@' in p_invitee) < 2 THEN
    RETURN QUERY SELECT 'INVALID_EMAIL'::text, NULL::uuid; RETURN;
  END IF;
  IF p_ttl_hours IS NULL OR p_ttl_hours < 1 OR p_ttl_hours > 720 THEN
    RETURN QUERY SELECT 'INVALID_TTL'::text, NULL::uuid; RETURN;
  END IF;
  v_key := public.normalise_email_key(p_invitee);

  SELECT * INTO t FROM tickets WHERE id = p_ticket FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid; RETURN;
  END IF;
  IF t."currentOwnerId" <> p_manager THEN
    RETURN QUERY SELECT 'NOT_YOURS'::text, NULL::uuid; RETURN;
  END IF;
  SELECT * INTO tt FROM ticket_types WHERE id = t."ticketTypeId";
  IF NOT tt."groupEligible" THEN
    RETURN QUERY SELECT 'NOT_GROUP_TICKET'::text, NULL::uuid; RETURN;
  END IF;
  IF t.status <> 'ISSUED_UNASSIGNED_GROUP' THEN
    RETURN QUERY SELECT 'NOT_IN_BUCKET'::text, NULL::uuid; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM user_emails ue WHERE ue.user_id = p_manager AND ue.email_key = v_key) THEN
    RETURN QUERY SELECT 'SELF_INVITE'::text, NULL::uuid; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM group_tickets g WHERE g."ticketId" = p_ticket AND g.status = 'INVITED') THEN
    RETURN QUERY SELECT 'ALREADY_INVITED'::text, NULL::uuid; RETURN;
  END IF;
  SELECT oi."orderId" INTO v_order FROM order_items oi WHERE oi."ticketId" = p_ticket LIMIT 1;
  IF v_order IS NULL THEN
    RETURN QUERY SELECT 'NO_ORDER'::text, NULL::uuid; RETURN;
  END IF;

  INSERT INTO group_tickets ("orderId", "managerId", "ticketId", status, "claimToken", "inviteExpiresAt", "inviteeEmailKey")
  VALUES (v_order, p_manager, p_ticket, 'INVITED', p_token_hash,
          now() + make_interval(hours => p_ttl_hours), v_key)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT 'OK'::text, v_id;
END;
$$;

-- Invitee claims with the claim code. Once only. Returns CLAIMED, NOT_FOUND, ALREADY_CLAIMED, REVOKED,
-- EXPIRED, WRONG_ACCOUNT, NOT_IN_BUCKET or NOT_ALLOWED. Zero-price transfer, transferCount unchanged.
CREATE OR REPLACE FUNCTION public.group_claim(p_user uuid, p_token_hash text)
RETURNS TABLE (out_result text, out_ticket_id uuid, out_group_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g group_tickets%ROWTYPE;
  t tickets%ROWTYPE;
BEGIN
  IF NOT public.can_transact(p_user) THEN
    RETURN QUERY SELECT 'NOT_ALLOWED'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;
  SELECT * INTO g FROM group_tickets WHERE "claimToken" = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;
  IF g.status = 'CLAIMED' THEN
    RETURN QUERY SELECT 'ALREADY_CLAIMED'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;
  IF g.status = 'REVOKED' THEN
    RETURN QUERY SELECT 'REVOKED'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;
  IF g.status <> 'INVITED' THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;
  IF g."inviteExpiresAt" <= now() THEN
    RETURN QUERY SELECT 'EXPIRED'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM user_emails ue
        WHERE ue.user_id = p_user AND ue.email_key = g."inviteeEmailKey" AND ue.verified_at IS NOT NULL) THEN
    RETURN QUERY SELECT 'WRONG_ACCOUNT'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;

  SELECT * INTO t FROM tickets WHERE id = g."ticketId" FOR UPDATE;
  IF t.status <> 'ISSUED_UNASSIGNED_GROUP' OR t."currentOwnerId" <> g."managerId" THEN
    RETURN QUERY SELECT 'NOT_IN_BUCKET'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;

  UPDATE tickets SET "currentOwnerId" = p_user, status = 'ISSUED_ACTIVE', "updatedAt" = now() WHERE id = t.id;
  UPDATE group_tickets SET status = 'CLAIMED', "memberId" = p_user, "updatedAt" = now() WHERE id = g.id;
  INSERT INTO transfers ("ticketId", "fromOwnerId", "toOwnerId", "priceMinor", status)
  VALUES (t.id, g."managerId", p_user, 0, 'completed');
  RETURN QUERY SELECT 'CLAIMED'::text, t.id, g.id;
END;
$$;

-- Manager revokes an invite that is not claimed yet. The ticket stays in the bucket.
CREATE OR REPLACE FUNCTION public.group_revoke(p_manager uuid, p_group uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g group_tickets%ROWTYPE;
BEGIN
  SELECT * INTO g FROM group_tickets WHERE id = p_group FOR UPDATE;
  IF NOT FOUND THEN RETURN 'NOT_FOUND'; END IF;
  IF g."managerId" <> p_manager THEN RETURN 'NOT_YOURS'; END IF;
  IF g.status <> 'INVITED' THEN RETURN 'NOT_REVOCABLE'; END IF;
  UPDATE group_tickets SET status = 'REVOKED', "updatedAt" = now() WHERE id = g.id;
  RETURN 'OK';
END;
$$;

-- Manager keeps ONE bucket ticket for themselves (PRD §6.6 step 2). Returns OK, NOT_FOUND, NOT_YOURS,
-- NOT_ALLOWED, NOT_GROUP_TICKET, NOT_IN_BUCKET, ALREADY_INVITED or ALREADY_KEPT.
CREATE OR REPLACE FUNCTION public.group_keep_for_self(p_manager uuid, p_ticket uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t  tickets%ROWTYPE;
  tt ticket_types%ROWTYPE;
BEGIN
  IF NOT public.can_transact(p_manager) THEN RETURN 'NOT_ALLOWED'; END IF;
  SELECT * INTO t FROM tickets WHERE id = p_ticket FOR UPDATE;
  IF NOT FOUND THEN RETURN 'NOT_FOUND'; END IF;
  IF t."currentOwnerId" <> p_manager THEN RETURN 'NOT_YOURS'; END IF;
  SELECT * INTO tt FROM ticket_types WHERE id = t."ticketTypeId";
  IF NOT tt."groupEligible" THEN RETURN 'NOT_GROUP_TICKET'; END IF;
  IF t.status <> 'ISSUED_UNASSIGNED_GROUP' THEN RETURN 'NOT_IN_BUCKET'; END IF;
  IF EXISTS (SELECT 1 FROM group_tickets g WHERE g."ticketId" = p_ticket AND g.status = 'INVITED') THEN
    RETURN 'ALREADY_INVITED';
  END IF;
  IF EXISTS (
       SELECT 1 FROM tickets x JOIN ticket_types y ON y.id = x."ticketTypeId"
        WHERE x."currentOwnerId" = p_manager AND y."groupEligible"
          AND x.status = 'ISSUED_ACTIVE' AND x.id <> p_ticket) THEN
    RETURN 'ALREADY_KEPT';
  END IF;
  UPDATE tickets SET status = 'ISSUED_ACTIVE', "updatedAt" = now() WHERE id = t.id;
  RETURN 'OK';
END;
$$;

-- Grants: service role only. Trigger and internal helpers are not callable from the API.
REVOKE ALL ON FUNCTION public.resale_max_price_minor(integer, integer)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resale_release(uuid)                                            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resale_list(uuid, uuid, integer)                                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resale_cancel(uuid, uuid)                                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resale_begin_purchase(uuid, uuid, integer)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resale_record_provider_order(uuid, text)                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_resale_captured(text, text, text, integer)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_resale_failed(text, text)                                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.group_allocate(uuid, uuid, text, text, integer)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.group_claim(uuid, text)                                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.group_revoke(uuid, uuid)                                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.group_keep_for_self(uuid, uuid)                                 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resale_max_price_minor(integer, integer)                     TO service_role;
GRANT EXECUTE ON FUNCTION public.resale_list(uuid, uuid, integer)                             TO service_role;
GRANT EXECUTE ON FUNCTION public.resale_cancel(uuid, uuid)                                    TO service_role;
GRANT EXECUTE ON FUNCTION public.resale_begin_purchase(uuid, uuid, integer)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.resale_record_provider_order(uuid, text)                     TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_resale_captured(text, text, text, integer)             TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_resale_failed(text, text)                              TO service_role;
GRANT EXECUTE ON FUNCTION public.group_allocate(uuid, uuid, text, text, integer)              TO service_role;
GRANT EXECUTE ON FUNCTION public.group_claim(uuid, text)                                      TO service_role;
GRANT EXECUTE ON FUNCTION public.group_revoke(uuid, uuid)                                     TO service_role;
GRANT EXECUTE ON FUNCTION public.group_keep_for_self(uuid, uuid)                              TO service_role;
