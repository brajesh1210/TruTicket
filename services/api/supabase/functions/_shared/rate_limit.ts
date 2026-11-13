// Fixed-window rate limits (PHASE2_PLAN §2.4). Wraps public.rate_limit_hit() (002 migration),
// which is atomic in Postgres. Every auth-facing action checks its limits through here.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ApiError } from "./http.ts";

/** Returns true when the call is allowed (and counts it). */
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

/** Throws 429 RATE_LIMITED when the window is full. Use this in every action. */
export async function enforceLimit(
  admin: SupabaseClient,
  key: string,
  windowSeconds: number,
  max: number,
  message = "Too many requests. Try again later.",
): Promise<void> {
  if (!(await allowRequest(admin, key, windowSeconds, max))) {
    throw new ApiError(429, "RATE_LIMITED", message, { retry_after: windowSeconds });
  }
}
