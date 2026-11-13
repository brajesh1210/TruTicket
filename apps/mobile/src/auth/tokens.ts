/**
 * Stores the sign-in tokens in the phone's secure storage and refreshes the access token.
 * Refresh uses Supabase's built-in rotation: every refresh returns a NEW refresh token,
 * and we always save the newest one.
 */
import * as SecureStore from "expo-secure-store";
import { isBackendConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "../services/config";
import { ApiError } from "../services/errors";

const STORE_KEY = "truticket.session.v1";
const REFRESH_MARGIN_SECONDS = 60;

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
  userId: string;
  email: string;
  provider: "google" | "email";
  googleSub?: string;
};

let current: StoredSession | null = null;
let refreshing: Promise<StoredSession | null> | null = null;
const endedListeners = new Set<() => void>();

export function onSessionEnded(listener: () => void): () => void {
  endedListeners.add(listener);
  return () => {
    endedListeners.delete(listener);
  };
}

export function getStoredSession(): StoredSession | null {
  return current;
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    current = raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    current = null;
  }
  return current;
}

export async function saveSession(s: StoredSession): Promise<void> {
  current = s;
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(s));
}

async function clearStored(): Promise<void> {
  current = null;
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {
    // Nothing stored or storage unavailable: the in-memory copy is already cleared.
  }
}

/** Ends the local sign-in (log out, or the server says the session is over). */
export async function endSession(): Promise<void> {
  await clearStored();
  endedListeners.forEach((l) => l());
}

/** Returns a valid access token, refreshing it first when it is close to expiry. */
export async function getAccessToken(): Promise<string> {
  if (!current) throw new ApiError("AUTH_REQUIRED", "Sign in to continue.", 401);
  const now = Math.floor(Date.now() / 1000);
  if (current.expiresAt - REFRESH_MARGIN_SECONDS > now) return current.accessToken;

  refreshing ??= refreshSession().finally(() => {
    refreshing = null;
  });
  const next = await refreshing;
  if (!next) throw new ApiError("AUTH_REQUIRED", "Your sign-in has ended. Sign in again.", 401);
  return next.accessToken;
}

async function refreshSession(): Promise<StoredSession | null> {
  const prev = current;
  if (!prev || !isBackendConfigured()) return null;

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: prev.refreshToken }),
    });
  } catch {
    throw new ApiError("NETWORK", "No connection. Check your internet and try again.");
  }

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    await endSession();
    return null;
  }
  if (!res.ok) throw new ApiError("NETWORK", "Could not refresh your sign-in. Try again.", res.status);

  const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_at?: number };
  if (!body.access_token || !body.refresh_token) {
    await endSession();
    return null;
  }
  const next: StoredSession = {
    ...prev,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  };
  await saveSession(next);
  return next;
}
