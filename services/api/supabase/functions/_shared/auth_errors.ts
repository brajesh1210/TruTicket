// Maps an error from auth.getUser(token) to the client response (2.3).
// supabase-js reports a session that Supabase has ended as AuthSessionMissingError (HTTP 400 in
// its own type), so status codes alone are not enough. Checked by name first.
import { ApiError } from "./http.ts";

export const AUTH_INVALID_MESSAGE = "Sign in again to continue.";

interface AuthLike {
  name?: string;
  status?: number;
  __isAuthError?: boolean;
}

/** The ApiError to return for a failed token check. Unknown errors are returned as-is (they become 500). */
export function authErrorFor(error: unknown): ApiError | unknown {
  const e = (error ?? {}) as AuthLike;
  if (e.name === "AuthRetryableFetchError") {
    return new ApiError(503, "AUTH_UNAVAILABLE", "Please try again in a moment.");
  }
  if (e.name === "AuthSessionMissingError") {
    return new ApiError(401, "SESSION_REVOKED", "This sign-in has ended. Sign in again.");
  }
  if (e.__isAuthError === true) {
    return new ApiError(401, "AUTH_INVALID", AUTH_INVALID_MESSAGE);
  }
  return error;
}
