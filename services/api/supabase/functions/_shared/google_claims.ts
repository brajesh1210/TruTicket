// Pure checks on a verified Google ID token payload. Kept separate from the
// network code (google.ts) so these checks can be unit tested offline.

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
}

/**
 * Throws if the payload is not a usable sign-in. Signature, issuer and expiry
 * are checked by jose in google.ts; these are the app-level rules on top.
 */
export function checkGoogleClaims(
  payload: Record<string, unknown>,
  audiences: string[],
  nowSeconds: number,
): GoogleIdentity {
  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error("missing sub");
  }

  const aud = payload.aud;
  const audList = Array.isArray(aud) ? aud : [aud];
  if (!audList.some((a) => typeof a === "string" && audiences.includes(a))) {
    throw new Error("audience not allowed");
  }

  const exp = payload.exp;
  if (typeof exp !== "number" || exp <= nowSeconds) {
    throw new Error("token expired");
  }

  const email = payload.email;
  if (typeof email !== "string" || email.length === 0) {
    throw new Error("missing email");
  }

  // Google sends a boolean. Accept the string form too, to be tolerant.
  const verified = payload.email_verified === true || payload.email_verified === "true";
  if (!verified) {
    throw new Error("email not verified by Google");
  }

  const name = typeof payload.name === "string" ? payload.name : undefined;
  return { sub, email, name };
}
