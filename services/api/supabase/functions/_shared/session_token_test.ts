import { assertEquals } from "jsr:@std/assert@1";
import { sessionIdFromAccessToken } from "./session_token.ts";

function token(payload: unknown): string {
  const b64 = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64('{"alg":"HS256"}')}.${b64(JSON.stringify(payload))}.sig`;
}

const SID = "7d9c2f1e-3b4a-4c5d-8e6f-0a1b2c3d4e5f";

Deno.test("reads the session_id claim", () => {
  assertEquals(sessionIdFromAccessToken(token({ sub: "u1", session_id: SID })), SID);
});

Deno.test("returns null when the claim is missing", () => {
  assertEquals(sessionIdFromAccessToken(token({ sub: "u1" })), null);
});

Deno.test("returns null when the claim is not a UUID", () => {
  assertEquals(sessionIdFromAccessToken(token({ session_id: "not-a-uuid" })), null);
  assertEquals(sessionIdFromAccessToken(token({ session_id: 42 })), null);
});

Deno.test("returns null for a token that is not three parts", () => {
  assertEquals(sessionIdFromAccessToken("abc.def"), null);
  assertEquals(sessionIdFromAccessToken(""), null);
});

Deno.test("returns null when the payload is not valid base64 JSON", () => {
  assertEquals(sessionIdFromAccessToken("aGVhZGVy.!!!notbase64!!!.sig"), null);
});
