// Issues a Supabase session for an account the server has already verified.
// Method: admin generates a one-time token hash (no email is sent), then the
// anon client exchanges it for a session. The client gets a normal access and
// refresh token and can use RLS as usual.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { anonClient } from "./db.ts";
import type { Config } from "./env.ts";
import { ApiError } from "./http.ts";

export async function issueSession(cfg: Config, admin: SupabaseClient, userId: string) {
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

  const { data, error } = await anonClient(cfg).auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (error || !data.session) {
    console.error("verifyOtp failed", error?.message);
    throw new ApiError(500, "SESSION_FAILED", "Could not start a session.");
  }
  return data.session;
}
