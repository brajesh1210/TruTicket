// Sessions (PHASE2_PLAN §2.3). Supabase issues and rotates the tokens. We keep our own
// user_sessions table, keyed by the Supabase session id (the `session_id` claim).
//
// Method for issuing a session: admin creates a one-time token hash (no email is sent),
// then the anon client exchanges it for a normal access and refresh token.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { anonClient } from "./db.ts";
import type { Config } from "./env.ts";
import { ApiError } from "./http.ts";
import { sessionIdFromAccessToken } from "./session_token.ts";

/** The fields we need from a Supabase session. The full object is returned to the client. */
export interface IssuedSession {
  access_token: string;
  refresh_token: string;
}

export async function issueSession(cfg: Config, admin: SupabaseClient, userId: string): Promise<IssuedSession> {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData.user?.email) {
    throw userError ?? new ApiError(500, "SESSION_FAILED", "Could not start a session.");
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    throw linkError ?? new ApiError(500, "SESSION_FAILED", "Could not start a session.");
  }

  const { data, error } = await anonClient(cfg).auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error || !data.session) {
    console.error("verifyOtp failed", error?.message);
    throw new ApiError(500, "SESSION_FAILED", "Could not start a session.");
  }
  return data.session;
}

/** The active device row for this account, if `deviceKeyId` names it. Otherwise null. */
export async function activeDeviceRowId(
  admin: SupabaseClient,
  userId: string,
  deviceKeyId: string | undefined,
): Promise<string | null> {
  if (!deviceKeyId) return null;
  const { data, error } = await admin
    .from("user_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_key_id", deviceKeyId)
    .eq("status", "active")
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? (data[0].id as string) : null;
}

/**
 * Ends every session of this account except `keepSessionId`.
 * Removes the Supabase sessions (their refresh tokens stop working) and marks our rows revoked.
 * Pass null to end all of them.
 */
export async function endOtherSessions(
  admin: SupabaseClient,
  userId: string,
  keepSessionId: string | null,
  reason: string,
): Promise<void> {
  const { error: rpcError } = await admin.rpc("revoke_auth_sessions", { p_user: userId, p_keep: keepSessionId });
  if (rpcError) throw rpcError;

  let q = admin
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: reason })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (keepSessionId) q = q.neq("session_id", keepSessionId);
  const { error } = await q;
  if (error) throw error;
}

/**
 * Records the new sign-in. Ends the account's previous sessions first, because only one
 * session per account may be active (a new login ends the old one at once).
 */
export async function startSession(
  admin: SupabaseClient,
  args: { userId: string; sessionId: string; deviceRowId: string | null },
): Promise<void> {
  await endOtherSessions(admin, args.userId, args.sessionId, "new_login");
  const { error } = await admin.from("user_sessions").insert({
    session_id: args.sessionId,
    user_id: args.userId,
    device_key_id: args.deviceRowId,
  });
  if (error) throw error;
}

/** Session id from an issued session, or a 500 if the token has none (should never happen). */
export function sessionIdOf(session: IssuedSession): string {
  const sid = sessionIdFromAccessToken(session.access_token);
  if (!sid) throw new ApiError(500, "SESSION_FAILED", "Could not start a session.");
  return sid;
}
