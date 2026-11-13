-- ============================================================================
-- TruTicket 2.7: rotating QR nonces and gate redemption.
-- TARGET: truticket-dev ONLY (project ref oviqjnzlgbkmggytaqao).
-- NEVER run this on production (ccqbubgebsayoviilnul).
-- Needs 2.6 first (APPLY_2_6_TO_SUPABASE_DEV.sql).
-- Safe to run twice.
-- ============================================================================

-- TruTicket 006: rotating QR nonces and gate redemption (PHASE2_PLAN §2.7). Service role only.
-- A QR nonce is issued per request and lives 10 seconds (PRD §6.4). The scan is one transaction:
-- the ticket row is locked, so two scans of the same QR give exactly one VALID and one ALREADY_USED.
-- Every decision for a known ticket is logged in redemptions, keyed by the scan's idempotency key.

CREATE INDEX IF NOT EXISTS idx_qr_ticket_nonce ON qr_credentials ("ticketId", "nonceHash");

-- Issue a QR nonce for a ticket the caller owns and that is still active.
CREATE OR REPLACE FUNCTION public.issue_qr_nonce(p_ticket uuid, p_owner uuid, p_nonce_hash text, p_expires timestamptz)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t tickets%ROWTYPE;
BEGIN
  SELECT * INTO t FROM tickets WHERE id = p_ticket;
  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;
  IF t."currentOwnerId" <> p_owner THEN
    RETURN 'NOT_YOURS';
  END IF;
  IF t.status <> 'ISSUED_ACTIVE' THEN
    RETURN 'NOT_ACTIVE';
  END IF;
  INSERT INTO qr_credentials ("ticketId", "nonceHash", "expiresAt", "keyId", status)
  VALUES (p_ticket, p_nonce_hash, p_expires, 'v1', 'active');
  RETURN 'OK';
END;
$$;

-- Verify and redeem one scan. Returns VALID, ALREADY_USED, EXPIRED, WRONG_EVENT or INVALID.
-- Raises SCANNER_NOT_FOUND if the scanner is not an active scanner of the event.
-- Raises KEY_REUSED if the idempotency key was used for a different ticket.
CREATE OR REPLACE FUNCTION public.scan_ticket(
  p_ticket     uuid,
  p_event      uuid,
  p_scanner    uuid,
  p_key        text,
  p_nonce_hash text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t   tickets%ROWTYPE;
  q   qr_credentials%ROWTYPE;
  r   redemptions%ROWTYPE;
  res text;
BEGIN
  -- Retry of a scan we already decided: same answer, nothing new recorded.
  SELECT * INTO r FROM redemptions WHERE "idempotencyKey" = p_key;
  IF FOUND THEN
    IF r."ticketId" <> p_ticket THEN
      RAISE EXCEPTION 'KEY_REUSED';
    END IF;
    RETURN r.result;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM scanners s WHERE s.id = p_scanner AND s."eventId" = p_event AND s.status = 'active') THEN
    RAISE EXCEPTION 'SCANNER_NOT_FOUND';
  END IF;

  -- Lock the ticket. A concurrent scan waits here, then sees REDEEMED.
  SELECT * INTO t FROM tickets WHERE id = p_ticket FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'INVALID';  -- unknown ticket: nothing to log against
  END IF;

  IF t."eventId" <> p_event THEN
    res := 'WRONG_EVENT';
  ELSE
    SELECT * INTO q FROM qr_credentials
     WHERE "ticketId" = p_ticket AND "nonceHash" = p_nonce_hash AND status = 'active'
     ORDER BY "createdAt" DESC LIMIT 1;
    IF NOT FOUND THEN
      res := 'INVALID';
    ELSIF q."expiresAt" <= now() THEN
      res := 'EXPIRED';
    ELSIF t.status = 'REDEEMED' THEN
      res := 'ALREADY_USED';
    ELSIF t.status <> 'ISSUED_ACTIVE' THEN
      res := 'INVALID';
    ELSE
      res := 'VALID';
      UPDATE tickets SET status = 'REDEEMED', "updatedAt" = now() WHERE id = p_ticket;
    END IF;
  END IF;

  INSERT INTO redemptions ("ticketId", "eventId", "scannerId", result, "idempotencyKey")
  VALUES (p_ticket, p_event, p_scanner, res, p_key);
  RETURN res;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_qr_nonce(uuid, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scan_ticket(uuid, uuid, uuid, text, text)     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_qr_nonce(uuid, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.scan_ticket(uuid, uuid, uuid, text, text)     TO service_role;
