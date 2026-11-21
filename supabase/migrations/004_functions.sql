-- TruTicket 004: inventory functions (PHASE2_PLAN §2.5). Service role only.
-- Sold = tickets not revoked, cancelled or refunded. Held = active reservations not yet expired.
-- The row lock on ticket_types makes the count-and-insert atomic per ticket type.

CREATE OR REPLACE FUNCTION public.available_inventory(p_ticket_type uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    t.quantity
      - (SELECT count(*) FROM tickets k
          WHERE k."ticketTypeId" = t.id
            AND k.status NOT IN ('REVOKED','CANCELLED','REFUNDED'))
      - (SELECT COALESCE(sum(r.quantity), 0) FROM inventory_reservations r
          WHERE r."ticketTypeId" = t.id AND r.status = 'active' AND r."expiresAt" > now()),
    0)::integer
  FROM ticket_types t
  WHERE t.id = p_ticket_type
$$;

-- Reserves `p_qty` seats for `p_user` for `p_ttl_seconds`. Returns the reservation id and expiry.
-- Raises: NOT_FOUND, NOT_ON_SALE, EVENT_NOT_PUBLISHED, INVALID_QUANTITY, LIMIT_REACHED, SOLD_OUT.
CREATE OR REPLACE FUNCTION public.reserve_inventory(
  p_user        uuid,
  p_ticket_type uuid,
  p_qty         integer,
  p_ttl_seconds integer DEFAULT 600
)
RETURNS TABLE (reservation_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type   ticket_types%ROWTYPE;
  v_event  events%ROWTYPE;
  v_mine   integer;
  v_left   integer;
  v_expiry timestamptz := now() + make_interval(secs => p_ttl_seconds);
  v_id     uuid;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 OR p_qty > 10 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 60 OR p_ttl_seconds > 1800 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  -- Lock the ticket type for the rest of this transaction.
  SELECT * INTO v_type FROM ticket_types WHERE id = p_ticket_type FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = v_type."eventId";
  IF NOT FOUND OR v_event.status <> 'published' THEN
    RAISE EXCEPTION 'EVENT_NOT_PUBLISHED';
  END IF;

  IF now() < v_type."saleStart" OR now() > v_type."saleEnd" THEN
    RAISE EXCEPTION 'NOT_ON_SALE';
  END IF;

  -- Per-account limit: what this user already holds (tickets plus live reservations).
  SELECT (SELECT count(*) FROM order_items oi
            JOIN orders o ON o.id = oi."orderId"
           WHERE oi."ticketTypeId" = v_type.id AND o."buyerId" = p_user
             AND o.status NOT IN ('PAYMENT_FAILED','RESERVATION_EXPIRED','CANCELLED','REFUNDED'))
       + (SELECT COALESCE(sum(r.quantity), 0) FROM inventory_reservations r
           WHERE r."ticketTypeId" = v_type.id AND r."userId" = p_user
             AND r.status = 'active' AND r."expiresAt" > now())
    INTO v_mine;
  IF v_mine + p_qty > v_type."perAccountLimit" THEN
    RAISE EXCEPTION 'LIMIT_REACHED';
  END IF;

  v_left := public.available_inventory(v_type.id);
  IF v_left < p_qty THEN
    RAISE EXCEPTION 'SOLD_OUT';
  END IF;

  INSERT INTO inventory_reservations ("eventId", "ticketTypeId", "userId", quantity, "expiresAt", status)
  VALUES (v_event.id, v_type.id, p_user, p_qty, v_expiry, 'active')
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_expiry;
END;
$$;

-- Marks expired reservations as expired. Safe to run often (e.g. from a cron job).
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE inventory_reservations
     SET status = 'expired'
   WHERE status = 'active' AND "expiresAt" <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.available_inventory(uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_inventory(uuid, uuid, int, int)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_expired_reservations()            FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.available_inventory(uuid)              TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_inventory(uuid, uuid, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_reservations()        TO service_role;
