import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { checkGoogleClaims } from "./google_claims.ts";

const AUD = ["web-client.apps.googleusercontent.com", "android-client.apps.googleusercontent.com"];
const NOW = 1_800_000_000;

function good(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sub: "1234567890",
    aud: AUD[1],
    exp: NOW + 300,
    email: "ansh@example.com",
    email_verified: true,
    name: "Ansh",
    ...extra,
  };
}

Deno.test("accepts a valid payload", () => {
  const id = checkGoogleClaims(good(), AUD, NOW);
  assertEquals(id, { sub: "1234567890", email: "ansh@example.com", name: "Ansh" });
});

Deno.test("accepts array aud when one value is allowed", () => {
  const id = checkGoogleClaims(good({ aud: ["other", AUD[0]] }), AUD, NOW);
  assertEquals(id.sub, "1234567890");
});

Deno.test("accepts email_verified as the string 'true'", () => {
  checkGoogleClaims(good({ email_verified: "true" }), AUD, NOW);
});

Deno.test("rejects unverified Google email", () => {
  assertThrows(() => checkGoogleClaims(good({ email_verified: false }), AUD, NOW), Error, "not verified");
  assertThrows(() => checkGoogleClaims(good({ email_verified: undefined }), AUD, NOW), Error, "not verified");
});

Deno.test("rejects a wrong audience", () => {
  assertThrows(() => checkGoogleClaims(good({ aud: "someone-else" }), AUD, NOW), Error, "audience");
});

Deno.test("rejects an expired token", () => {
  assertThrows(() => checkGoogleClaims(good({ exp: NOW }), AUD, NOW), Error, "expired");
});

Deno.test("rejects a missing sub or email", () => {
  assertThrows(() => checkGoogleClaims(good({ sub: "" }), AUD, NOW), Error, "sub");
  assertThrows(() => checkGoogleClaims(good({ email: undefined }), AUD, NOW), Error, "email");
});
