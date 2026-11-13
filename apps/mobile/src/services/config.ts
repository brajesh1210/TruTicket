/**
 * Public app config. Everything here is public (the anon key is designed to ship in apps).
 * Never put a service key, Razorpay secret, or HMAC key in the app.
 */
const trimSlash = (s: string) => s.replace(/\/+$/, "");

export const SUPABASE_URL = trimSlash(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "");
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

/** UI-only flag. The server decides demo OTP codes (DEMO_MODE on the Edge Functions). */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "true";
export const DEMO_EMAIL = "demo.attendee@example.com";
export const DEMO_ORGANISER_EMAIL = "demo.organiser@example.com";

export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

/** The event the gate scanner admits for (a published event id from the events list). */
export const GATE_EVENT_ID = process.env.EXPO_PUBLIC_GATE_EVENT_ID ?? "";

export function isBackendConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
