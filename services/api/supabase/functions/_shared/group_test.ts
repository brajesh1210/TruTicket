import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { claimCodeHash, isClaimCodeShape, newClaimCode } from "./group.ts";

Deno.test("a claim code is 43 url-safe characters and unique", () => {
  const a = newClaimCode();
  const b = newClaimCode();
  assertEquals(a.length, 43);
  assert(isClaimCodeShape(a));
  assertNotEquals(a, b);
});

Deno.test("the claim code hash is stable and differs per code", async () => {
  const h1 = await claimCodeHash("abc");
  assertEquals(h1, await claimCodeHash("abc"));
  assertEquals(h1.length, 64);
  assertNotEquals(h1, await claimCodeHash("abd"));
});

Deno.test("malformed claim codes are refused before the database", () => {
  assertEquals(isClaimCodeShape("short"), false);
  assertEquals(isClaimCodeShape("a".repeat(43) + "="), false);
  assertEquals(isClaimCodeShape("a".repeat(42) + " "), false);
  assertEquals(isClaimCodeShape("a".repeat(44)), false);
});
