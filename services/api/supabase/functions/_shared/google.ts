// Verifies a Google ID token: signature (Google JWKS), issuer, audience, expiry.
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";
import { checkGoogleClaims, type GoogleIdentity } from "./google_claims.ts";

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function verifyGoogleIdToken(
  idToken: string,
  audiences: string[],
): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: audiences,
    algorithms: ["RS256"],
  });
  return checkGoogleClaims(
    payload as Record<string, unknown>,
    audiences,
    Math.floor(Date.now() / 1000),
  );
}
