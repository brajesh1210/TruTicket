// Wraps public.rate_limit_hit() (002 migration). Fixed window, atomic in Postgres.
// Returns true when the call is allowed. Package 2.4 adds more limits on top of this.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function allowRequest(
  admin: SupabaseClient,
  key: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) throw error;
  return data === true;
}
