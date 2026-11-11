// Supabase clients for Edge Functions.
// admin: service role. Bypasses RLS. Use only inside functions, never sent to a client.
// anon:  used only to exchange a server-generated token hash for a session.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Config } from "./env.ts";

const NO_PERSIST = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

export function adminClient(cfg: Config): SupabaseClient {
  return createClient(cfg.supabaseUrl, cfg.serviceKey, { auth: NO_PERSIST });
}

export function anonClient(cfg: Config): SupabaseClient {
  return createClient(cfg.supabaseUrl, cfg.anonKey, { auth: NO_PERSIST });
}
