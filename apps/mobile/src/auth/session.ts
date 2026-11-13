/**
 * Auth state for the app (PHASE2_PLAN §2.2, §2.3, §2.9).
 *
 * - Google sign-in: the phone gets a Google ID token (native sign-in). The token is sent to
 *   the `auth` Edge Function, which verifies it. The phone never creates an account by itself.
 * - Email code: `auth` sends a 6-digit code (Brevo) and verifies it.
 * - Tokens are kept in secure storage (auth/tokens.ts) and refreshed automatically.
 * - Demo mode (EXPO_PUBLIC_DEMO_MODE=true) only changes the UI. The demo code is checked
 *   by the server, and only for the demo emails on the DEV project.
 */
import { useSyncExternalStore } from "react";
import { callFunction } from "../services/api";
import {
  DEMO_EMAIL,
  DEMO_MODE,
  GOOGLE_WEB_CLIENT_ID,
} from "../services/config";
import { ApiError, messageOf } from "../services/errors";
import {
  endSession,
  loadStoredSession,
  onSessionEnded,
  saveSession,
  type StoredSession,
} from "./tokens";
import { isValidEmail, normalizeEmail } from "./email";
import { ensureDeviceLinked, getDeviceKeyId } from "./device";

export { DEMO_MODE, DEMO_EMAIL };

export type Session = {
  userId: string;
  email: string;
  provider: "google" | "email";
  emailVerified: boolean;
  /** Google account subject (stable Google user id). */
  googleSub?: string;
};

type State = {
  session: Session | null;
  /** False until secure storage has been read once. Screens wait for this before routing. */
  ready: boolean;
  pendingEmail: string | null;
  resendAvailableAt: number; // epoch ms
};

const RESEND_COOLDOWN_MS = 60_000;

let state: State = {
  session: null,
  ready: false,
  pendingEmail: null,
  resendAvailableAt: 0,
};

const listeners = new Set<() => void>();

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuth(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function getSession(): Session | null {
  return state.session;
}

function toSession(s: StoredSession): Session {
  return {
    userId: s.userId,
    email: s.email,
    provider: s.provider,
    emailVerified: true,
    googleSub: s.googleSub,
  };
}

type SignInBody = {
  session: { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number };
  user_id: string;
};

/** Stores the tokens from a successful sign-in and makes it the active session. */
async function startSession(body: SignInBody, email: string, provider: "google" | "email", googleSub?: string) {
  const now = Math.floor(Date.now() / 1000);
  const stored: StoredSession = {
    accessToken: body.session.access_token,
    refreshToken: body.session.refresh_token,
    expiresAt: body.session.expires_at ?? now + (body.session.expires_in ?? 3600),
    userId: body.user_id,
    email,
    provider,
    googleSub,
  };
  await saveSession(stored);
  setState({ session: toSession(stored), pendingEmail: null });
  // Link this phone to the new session. A failure here must not block sign-in: checkout
  // retries the link and shows the server's message if it still fails.
  void ensureDeviceLinked(body.user_id).catch(() => undefined);
}

export type AuthResult = { ok: true } | { ok: false; error: string };

/** Restores the saved sign-in when the app starts. */
async function hydrate() {
  const stored = await loadStoredSession();
  setState({ session: stored ? toSession(stored) : null, ready: true });
}
void hydrate();

onSessionEnded(() => setState({ session: null, pendingEmail: null }));

/** Loads the native Google module lazily. In Expo Go the native part is missing. */
async function loadGoogle() {
  try {
    return await import("@react-native-google-signin/google-signin");
  } catch {
    return null;
  }
}

/** Google sign-in (native). The ID token is verified by the backend. */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!GOOGLE_WEB_CLIENT_ID) {
    return { ok: false, error: "Google sign-in is not configured (missing web client ID)." };
  }
  const google = await loadGoogle();
  if (!google) {
    return {
      ok: false,
      error: "Google sign-in needs the TruTicket development build. It does not work in Expo Go.",
    };
  }

  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = google;
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ["email", "profile"],
      offlineAccess: false,
    });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { ok: false, error: "Sign-in cancelled." };

    const { user, idToken } = response.data;
    if (!idToken) return { ok: false, error: "Google did not return a sign-in token. Try again." };

    const body = await callFunction<SignInBody & { created?: boolean }>("auth", {
      action: "google",
      id_token: idToken,
      device_key_id: await getDeviceKeyId(),
    });
    await startSession(body, normalizeEmail(user.email), "google", user.id);
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e.message };
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.IN_PROGRESS) return { ok: false, error: "Sign-in already in progress." };
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, error: "Google Play Services is missing or outdated on this phone." };
      }
    }
    return { ok: false, error: "Google sign-in failed. Try again." };
  }
}

/** Sends a 6-digit sign-in code to the email. The server enforces the limits. */
export async function requestEmailOtp(rawEmail: string): Promise<AuthResult> {
  const now = Date.now();
  if (!isValidEmail(rawEmail)) return { ok: false, error: "Enter a valid email address." };
  if (now < state.resendAvailableAt) {
    const secs = Math.ceil((state.resendAvailableAt - now) / 1000);
    return { ok: false, error: `Please wait ${secs}s before requesting a new code.` };
  }

  const email = normalizeEmail(rawEmail);
  try {
    const res = await callFunction<{ sent: boolean; resend_in?: number }>("auth", {
      action: "otp_request",
      email,
    });
    const cooldown = res.resend_in ? res.resend_in * 1000 : RESEND_COOLDOWN_MS;
    setState({ pendingEmail: email, resendAvailableAt: Date.now() + cooldown });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: messageOf(e, "Could not send the code. Try again.") };
  }
}

/** Checks the 6-digit code for the pending email and starts the session. */
export async function verifyEmailOtp(code: string): Promise<AuthResult> {
  const email = state.pendingEmail;
  if (!email) return { ok: false, error: "Request a new code first." };
  try {
    const body = await callFunction<SignInBody>("auth", {
      action: "otp_verify",
      email,
      code: code.trim(),
      device_key_id: await getDeviceKeyId(),
    });
    await startSession(body, email, "email");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: messageOf(e, "Could not verify the code. Try again.") };
  }
}

/** Log out: clears the saved tokens and the Google account choice on this phone. */
export async function signOut(): Promise<void> {
  await endSession();
  setState({ session: null, pendingEmail: null });
  const google = await loadGoogle();
  if (google) void google.GoogleSignin.signOut().catch(() => undefined);
}

/** Used by screens that need a verified email before a transaction. */
export function canTransact(session: Session | null): boolean {
  return !!session && session.emailVerified;
}
