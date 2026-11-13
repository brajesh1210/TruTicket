// Who is buying (PHASE2_PLAN §2.6). Shared by the orders function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { adminClient } from "./db.ts";
import type { Config } from "./env.ts";
import { ApiError } from "./http.ts";
import { AUTH_INVALID_MESSAGE, authErrorFor } from "./auth_errors.ts";
import { sessionIdFromAccessToken } from "./session_token.ts";

export interface Buyer {
  userId: string;
  token: string;
}

/** Checks the bearer token and that its session is still active. */
export async function authenticateBuyer(cfg: Config, req: Request): Promise<Buyer> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "AUTH_INVALID", AUTH_INVALID_MESSAGE);

  const admin = adminClient(cfg);
  const { data, error } = await admin.auth.getUser(token);
  if (error) throw authErrorFor(error);
  if (!data.user) throw new ApiError(401, "AUTH_INVALID", AUTH_INVALID_MESSAGE);

  const sessionId = sessionIdFromAccessToken(token);
  if (!sessionId) throw new ApiError(401, "AUTH_INVALID", AUTH_INVALID_MESSAGE);
  const { data: active, error: activeError } = await admin.rpc("session_is_active", {
    p_session: sessionId,
    p_user: data.user.id,
  });
  if (activeError) throw activeError;
  if (active !== true) throw new ApiError(401, "SESSION_REVOKED", "This sign-in has ended. Sign in again.");
  return { userId: data.user.id, token };
}

/**
 * The full transaction gate (PHASE2_PLAN §2.3, §2.6): session_can_transact() = active profile,
 * verified email, active session and linked active device. It reads auth.jwt(), so it must run
 * with THIS USER's token (not the service role). Fails closed.
 */
export async function assertBuyerCanTransact(cfg: Config, token: string, userId: string): Promise<void> {
  const userClient = createClient(cfg.supabaseUrl, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.rpc("session_can_transact", { p_user: userId });
  if (error) {
    console.error("session_can_transact failed");
    throw new ApiError(503, "TRY_AGAIN", "Something went wrong. Try again.");
  }
  if (data !== true) {
    throw new ApiError(403, "CANNOT_TRANSACT", "Verify your email and sign in again before you buy tickets.");
  }
}
