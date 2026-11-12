// Reads the Supabase session id (the `session_id` claim) from an access token.
// Call this only AFTER the token was verified with auth.getUser(token). This function
// does not check the signature. It only reads the payload.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function base64UrlToText(part: string): string {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** The session id in the token, or null if the token has none or is malformed. */
export function sessionIdFromAccessToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlToText(parts[1])) as Record<string, unknown>;
    const sid = payload.session_id;
    if (typeof sid !== "string" || !UUID_RE.test(sid)) return null;
    return sid.toLowerCase();
  } catch {
    return null;
  }
}
