-- ============================================================================
-- TruTicket — 002b_sessions_devices.sql   (Phase 2, package 2.3)
-- Session helpers, device challenges, and a transaction gate that also
-- requires the caller's own session to still be active.
-- Depends on: 001_init.sql, 002_auth_sessions.sql.
-- Safe to re-run: IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
--
-- Session model:
--   * Supabase Auth issues and rotates the tokens (built-in rotation).
--   * public.user_sessions is keyed by the Supabase session id, which is the
--     `session_id` claim in the access token.
--   * A new login revokes the old user_sessions row and deletes the old
--     auth.sessions rows (so their refresh tokens stop working).
--   * session_can_transact() = can_transact() AND the caller's session is
--     still active in our table AND in Supabase's auth.sessions AND linked to
--     the account's active device.
--   * can_transact() (002) is unchanged, so the 002 tests still hold.
--   * Refresh reuse detection is a dashboard setting (Authentication → Sessions:
--     "Detect and revoke compromised tokens"). See the integration guide.
-- ============================================================================

-- ---------- 1. Device challenges (one-time nonces for attestation) ----------
CREATE TABLE IF NOT EXISTS device_challenges (
  nonce      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,     -- created_at + 5 minutes
  used_at    timestamptz
);

ALTER TABLE device_challenges ENABLE ROW LEVEL SECURITY;
-- No client policies. Service role only.
REVOKE ALL ON device_challenges FROM anon, authenticated;

-- ---------- 2. Is this session still active? (service role only) ----------
-- Both our row and Supabase's own auth.sessions row must still be live. Supabase
-- deletes or ends its row when it revokes a session (for example after refresh-token
-- reuse), so this catches that case too.
CREATE OR REPLACE FUNCTION public.session_is_active(p_session uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
           SELECT 1 FROM user_sessions s
           WHERE s.session_id = p_session
             AND s.user_id = p_user
             AND s.revoked_at IS NULL
         )
     AND EXISTS (
           SELECT 1 FROM auth.sessions a
           WHERE a.id = p_session
             AND a.user_id = p_user
             AND (a.not_after IS NULL OR a.not_after > now())
         );
$$;

-- ---------- 3. Revoke other Supabase auth sessions for one user (service role only) ----------
-- Deleting an auth.sessions row also removes its refresh tokens.
CREATE OR REPLACE FUNCTION public.revoke_auth_sessions(p_user uuid, p_keep uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM auth.sessions
   WHERE user_id = p_user
     AND id IS DISTINCT FROM p_keep;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------- 4. Transaction gate: account, active session, and an active device ----------
-- Use this in RLS and functions for purchases, resale, and organiser writes.
-- The session must be the caller's own, still active, and linked to the account's
-- ACTIVE device. A pending (not yet activated) device cannot transact.
CREATE OR REPLACE FUNCTION public.session_can_transact(p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.can_transact(p_user)
     AND EXISTS (
           SELECT 1
           FROM user_sessions s
           JOIN user_devices d ON d.id = s.device_key_id
           WHERE s.session_id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
             AND s.user_id = p_user
             AND s.revoked_at IS NULL
             AND d.user_id = p_user
             AND d.status = 'active'
         )
     AND EXISTS (
           SELECT 1 FROM auth.sessions a
           WHERE a.id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
             AND a.user_id = p_user
             AND (a.not_after IS NULL OR a.not_after > now())
         );
$$;

-- ---------- 5. Grants ----------
REVOKE ALL ON FUNCTION public.session_is_active(uuid, uuid)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_auth_sessions(uuid, uuid)  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.session_is_active(uuid, uuid)     TO service_role;
GRANT  EXECUTE ON FUNCTION public.revoke_auth_sessions(uuid, uuid)  TO service_role;

REVOKE ALL ON FUNCTION public.session_can_transact(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.session_can_transact(uuid) TO authenticated;
