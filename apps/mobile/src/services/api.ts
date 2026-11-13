/**
 * The one HTTP client for TruTicket's Edge Functions. Every function is a POST with a JSON
 * body that has an `action` field (see docs/API_CONTRACTS.md note: the Edge Function
 * source is the contract). Errors come back as { error: { code, message } }.
 */
import { getAccessToken, endSession } from "../auth/tokens";
import { FUNCTIONS_URL, isBackendConfigured, SUPABASE_ANON_KEY } from "./config";
import { ApiError, SESSION_ENDED_CODES } from "./errors";

export type FunctionName =
  | "auth"
  | "devices"
  | "events"
  | "orders"
  | "tickets"
  | "scanner_verify"
  | "resale"
  | "groups";

export async function callFunction<T>(
  name: FunctionName,
  body: Record<string, unknown>,
  opts: { auth?: boolean } = {},
): Promise<T> {
  if (!isBackendConfigured()) {
    throw new ApiError("CONFIG_MISSING", "The app is not connected to the server yet.");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY };
  if (opts.auth) headers.Authorization = `Bearer ${await getAccessToken()}`;

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK", "No connection. Check your internet and try again.");
  }

  const data = (await res.json().catch(() => null)) as
    | (T & { error?: undefined })
    | { error?: { code?: string; message?: string } }
    | null;

  if (!res.ok) {
    const err = (data && "error" in data ? data.error : undefined) ?? {};
    const code = err.code ?? `HTTP_${res.status}`;
    if (SESSION_ENDED_CODES.has(code)) await endSession();
    throw new ApiError(code, err.message ?? "Something went wrong. Please try again.", res.status);
  }
  if (!data) throw new ApiError("BAD_RESPONSE", "The server sent an unexpected reply.", res.status);
  return data as T;
}
