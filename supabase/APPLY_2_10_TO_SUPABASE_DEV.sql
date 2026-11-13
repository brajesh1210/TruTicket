-- ============================================================================
-- TruTicket 2.10: client grants (no TRUNCATE for clients) and append-only audit trail.
-- TARGET: truticket-dev ONLY (project ref oviqjnzlgbkmggytaqao).
-- NEVER run this on production (ccqbubgebsayoviilnul).
-- Needs 2.8 first (007). Safe to run twice: REVOKE, CREATE OR REPLACE and DROP TRIGGER IF EXISTS are idempotent.
-- ============================================================================

-- 008 client grants (PHASE2_PLAN §2.10).
-- Supabase gives anon and authenticated ALL privileges on public tables by default. TRUNCATE skips RLS,
-- so clients must not have it. RLS already blocks row writes (see 010 T88); this removes the TRUNCATE path.
-- Applies to existing tables and to tables created later.
-- DEV ONLY until the user says otherwise. Do not run on production (ccqbubgebsayoviilnul).

REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;

-- 009 audit trail (PHASE2_PLAN §2.10; closes the "audit in 2.10" gap from 2.8).
-- 1. Status and owner changes on money and ticket tables write one audit_logs row, from the database itself.
--    Done by trigger, so no edge function code has to remember to do it.
-- 2. audit_logs is append-only: UPDATE, DELETE and TRUNCATE are refused for every role, service role included.
--    Retention (deleting old rows) needs a separate, reviewed step later.
-- DEV ONLY until the user says otherwise. Do not run on production (ccqbubgebsayoviilnul).

CREATE OR REPLACE FUNCTION public.audit_state_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
  v_new text;
BEGIN
  -- Works for every table that has a status column (tickets, orders, resale_listings, group_tickets).
  v_old := to_jsonb(OLD) ->> 'status';
  v_new := to_jsonb(NEW) ->> 'status';
  IF v_old IS DISTINCT FROM v_new THEN
    INSERT INTO audit_logs ("actorId", action, "objectType", "objectId", outcome)
    VALUES (NULL, 'STATUS_CHANGED', TG_TABLE_NAME, NEW.id::text, coalesce(v_old, '-') || ' -> ' || coalesce(v_new, '-'));
  END IF;
  -- Ownership moves (a resale or a group claim) are audited too.
  IF TG_TABLE_NAME = 'tickets' AND (to_jsonb(OLD) ->> 'currentOwnerId') IS DISTINCT FROM (to_jsonb(NEW) ->> 'currentOwnerId') THEN
    INSERT INTO audit_logs ("actorId", action, "objectType", "objectId", outcome)
    VALUES (NULL, 'OWNER_CHANGED', TG_TABLE_NAME, NEW.id::text,
            coalesce(to_jsonb(OLD) ->> 'currentOwnerId', '-') || ' -> ' || coalesce(to_jsonb(NEW) ->> 'currentOwnerId', '-'));
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.audit_state_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_tickets ON tickets;
CREATE TRIGGER trg_audit_tickets AFTER UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_state_change();

DROP TRIGGER IF EXISTS trg_audit_orders ON orders;
CREATE TRIGGER trg_audit_orders AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_state_change();

DROP TRIGGER IF EXISTS trg_audit_resale_listings ON resale_listings;
CREATE TRIGGER trg_audit_resale_listings AFTER UPDATE ON resale_listings
  FOR EACH ROW EXECUTE FUNCTION public.audit_state_change();

DROP TRIGGER IF EXISTS trg_audit_group_tickets ON group_tickets;
CREATE TRIGGER trg_audit_group_tickets AFTER UPDATE ON group_tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_state_change();

-- Append-only: one function refuses the change; it is attached to UPDATE/DELETE per row and TRUNCATE per statement.
CREATE OR REPLACE FUNCTION public.audit_logs_block_change() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_APPEND_ONLY';
END $$;

REVOKE ALL ON FUNCTION public.audit_logs_block_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_update_delete BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_block_change();

DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_logs_block_change();
