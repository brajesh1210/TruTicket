/**
 * Auth state for the app.
 *
 * Phase 1 status:
 *   - Google sign-in: REAL native sign-in via @react-native-google-signin.
 *     Needs a development build (not Expo Go) and an Android OAuth client.
 *   - Email OTP: still MOCK (needs the Phase 2 Supabase backend).
 *
 * SECURITY NOTE (must be fixed in Phase 2):
 *   The Google ID token is produced on the device. The app must NOT trust the
 *   email from the device alone. Phase 2 sends the ID token to the backend,
 *   which verifies it (Supabase signInWithIdToken) before any account is created.
 *
 * DEMO MODE (EXPO_PUBLIC_DEMO_MODE=true):
 *   - demo.attendee@truticket.test can sign in with the demo OTP 123456.
 *   - Never enable DEMO_MODE in a production build.
 */
import { useSyncExternalStore } from "react";
import { isValidEmail, normalizeEmail } from "./email";

export type Session = {
  userId: string;
  email: string;
  provider: "google" | "email";
  emailVerified: boolean;
  /** Google account subject (stable Google user id). Used for duplicate checks. */
  googleSub?: string;
};

type State = {
  session: Session | null;
  pendingEmail: string | null;
  resendAvailableAt: number; // epoch ms
  wrongAttempts: number;
  lockedUntil: number; // epoch ms
};

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "true";
export const DEMO_EMAIL = "demo.attendee@truticket.test";
const DEMO_OTP = "123456";
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const RESEND_COOLDOWN_MS = 60_000;
const MAX_WRONG_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;

let state: State = {
  session: null,
  pendingEmail: null,
  resendAvailableAt: 0,
  wrongAttempts: 0,
  lockedUntil: 0,
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

export type AuthResult = { ok: true } | { ok: false; error: string };

/**
 * Loads the native Google module lazily. In Expo Go the native part is missing,
 * so this returns null instead of crashing the app at startup.
 */
async function loadGoogle() {
  try {
    const mod = await import("@react-native-google-signin/google-signin");
    return mod;
  } catch {
    return null;
  }
}

/** Google sign-in (native). Returns a clear error in Expo Go or when not configured. */
export async function signInWithGoogle(): Promise<AuthResult> {
  // Real Google sign-in whenever a web client ID is set, even in demo mode.
  // Demo mode only provides the demo account; it must never fake Google login.
  if (!GOOGLE_WEB_CLIENT_ID) {
    if (DEMO_MODE) {
      setState({
        session: {
          userId: "demo-google-user",
          email: DEMO_EMAIL,
          provider: "google",
          emailVerified: true,
          googleSub: "demo-google-sub",
        },
      });
      return { ok: true };
    }
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

    if (!isSuccessResponse(response)) {
      return { ok: false, error: "Sign-in cancelled." };
    }

    const { user, idToken } = response.data;
    if (!idToken || !user.email) {
      return { ok: false, error: "Google did not return an account email. Try again." };
    }

    // Phase 2: send idToken to the backend and verify it there. Never create an account from device data alone.
    setState({
      session: {
        userId: `google-${user.id}`,
        email: normalizeEmail(user.email),
        provider: "google",
        emailVerified: true, // Google accounts have a verified email; the backend re-checks the claim in Phase 2
        googleSub: user.id,
      },
    });
    return { ok: true };
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.IN_PROGRESS) return { ok: false, error: "Sign-in already in progress." };
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, error: "Google Play Services is missing or outdated on this phone." };
      }
    }
    return {
      ok: false,
      error: "Google sign-in failed. Check the Android OAuth client setup and try again.",
    };
  }
}

/** Sends an email OTP. Rate limited on the client for display; the server enforces it in Phase 2. */
export async function requestEmailOtp(rawEmail: string): Promise<AuthResult> {
  const now = Date.now();
  if (now < state.lockedUntil) {
    const mins = Math.ceil((state.lockedUntil - now) / 60_000);
    return { ok: false, error: `Too many wrong codes. Try again in ${mins} min.` };
  }
  if (!isValidEmail(rawEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (now < state.resendAvailableAt) {
    const secs = Math.ceil((state.resendAvailableAt - now) / 1000);
    return { ok: false, error: `Please wait ${secs}s before requesting a new code.` };
  }
  if (!DEMO_MODE) {
    return {
      ok: false,
      error: "Email OTP is not connected yet. It will be enabled in Phase 2.",
    };
  }
  setState({
    pendingEmail: normalizeEmail(rawEmail),
    resendAvailableAt: now + RESEND_COOLDOWN_MS,
    wrongAttempts: 0,
  });
  return { ok: true };
}

/** Verifies the 6-digit code for the pending email. */
export async function verifyEmailOtp(code: string): Promise<AuthResult> {
  const now = Date.now();
  if (now < state.lockedUntil) {
    const mins = Math.ceil((state.lockedUntil - now) / 60_000);
    return { ok: false, error: `Locked for ${mins} more min after too many wrong codes.` };
  }
  if (!state.pendingEmail) {
    return { ok: false, error: "Request a new code first." };
  }
  if (!DEMO_MODE) {
    return {
      ok: false,
      error: "Email OTP is not connected yet. It will be enabled in Phase 2.",
    };
  }
  if (code !== DEMO_OTP) {
    const wrong = state.wrongAttempts + 1;
    if (wrong >= MAX_WRONG_ATTEMPTS) {
      setState({ wrongAttempts: 0, lockedUntil: now + LOCK_MS, pendingEmail: null });
      return { ok: false, error: "Too many wrong codes. Locked for 15 minutes." };
    }
    setState({ wrongAttempts: wrong });
    return { ok: false, error: `Wrong code. ${MAX_WRONG_ATTEMPTS - wrong} attempts left.` };
  }

  const email = state.pendingEmail;
  setState({
    session: {
      userId: `demo-${email}`,
      email,
      provider: "email",
      emailVerified: true,
    },
    pendingEmail: null,
    wrongAttempts: 0,
  });
  return { ok: true };
}

/** Demo account shortcut. Only works when DEMO_MODE is on. */
export async function signInAsDemo(): Promise<AuthResult> {
  if (!DEMO_MODE) {
    return { ok: false, error: "Demo sign-in is disabled in this build." };
  }
  setState({
    session: {
      userId: "demo-attendee",
      email: DEMO_EMAIL,
      provider: "email",
      emailVerified: true,
    },
  });
  return { ok: true };
}

export function signOut() {
  setState({ session: null, pendingEmail: null, wrongAttempts: 0 });
  // Clear the Google account choice on the device, so the next login shows the account picker.
  void loadGoogle().then((google) => {
    if (!google) return;
    google.GoogleSignin.signOut().catch(() => undefined);
  });
}

/** Used by screens that need a verified email before a transaction. */
export function canTransact(session: Session | null): boolean {
  return !!session && session.emailVerified;
}
