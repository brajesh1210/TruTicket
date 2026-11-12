import { assertEquals, assertInstanceOf } from "jsr:@std/assert@1";
import { authErrorFor } from "./auth_errors.ts";
import { ApiError } from "./http.ts";

Deno.test("a session Supabase ended becomes 401 SESSION_REVOKED (not 500)", () => {
  const r = authErrorFor({ name: "AuthSessionMissingError", status: 400, __isAuthError: true });
  assertInstanceOf(r, ApiError);
  assertEquals([r.status, r.code], [401, "SESSION_REVOKED"]);
});

Deno.test("a rejected token becomes 401 AUTH_INVALID", () => {
  const r = authErrorFor({ name: "AuthApiError", status: 401, __isAuthError: true });
  assertInstanceOf(r, ApiError);
  assertEquals([r.status, r.code], [401, "AUTH_INVALID"]);
});

Deno.test("a network problem becomes 503, and a plain error is passed through", () => {
  const retry = authErrorFor({ name: "AuthRetryableFetchError", status: 500, __isAuthError: true });
  assertEquals([(retry as ApiError).status, (retry as ApiError).code], [503, "AUTH_UNAVAILABLE"]);
  const plain = new Error("db down");
  assertEquals(authErrorFor(plain), plain);
});
