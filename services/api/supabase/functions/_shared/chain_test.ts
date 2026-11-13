import { assertEquals, assertNotEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import { custodyAddress, custodyPrivateKey, eventKeyFor, faceValueArg, policyArgs } from "./chain.ts";

const EVENT = "11111111-2222-4333-8444-555555555555";
const USER_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const USER_B = "bbbbbbbb-0000-4000-8000-00000000000b";
const SECRET = "test-master-secret-0123456789abcdef";

Deno.test("eventKeyFor matches the Solidity side (ethers.id of the same UUID)", () => {
  // Vector computed with ethers.id("11111111-2222-4333-8444-555555555555") in contracts/.
  assertEquals(eventKeyFor(EVENT), "0xefcf0d86adc8491834c77a01b8f7fbc87e7dd72b594e712fe2e5c6c8b92d070b");
});

Deno.test("eventKeyFor rejects a non-UUID", () => {
  assertThrows(() => eventKeyFor("event-uuid-1"));
});

Deno.test("custody key is deterministic and differs per user", async () => {
  const a1 = await custodyPrivateKey(SECRET, USER_A);
  const a2 = await custodyPrivateKey(SECRET, USER_A);
  const b = await custodyPrivateKey(SECRET, USER_B);
  assertEquals(a1, a2);
  assertNotEquals(a1, b);
  assertEquals(a1.length, 66);
});

Deno.test("custody key changes with the master secret", async () => {
  const x = await custodyPrivateKey(SECRET, USER_A);
  const y = await custodyPrivateKey("another-master-secret-0123456789abcd", USER_A);
  assertNotEquals(x, y);
});

Deno.test("custody address is a checksum-style 0x address", async () => {
  const addr = await custodyAddress(SECRET, USER_A);
  assertEquals(addr.length, 42);
  assertEquals(addr.slice(0, 2), "0x");
});

Deno.test("custody refuses a short master secret", async () => {
  await assertRejects(() => custodyPrivateKey("short", USER_A));
});

Deno.test("custody refuses a non-UUID user id", async () => {
  await assertRejects(() => custodyPrivateKey(SECRET, "not-a-uuid"));
});

Deno.test("policyArgs uses the explicit cutoff when set", () => {
  const p = policyArgs({
    resaleCapBps: 11000,
    resaleTransferLimit: 2,
    resaleCutoffAt: "2026-12-01T00:00:00.000Z",
    startAt: "2026-12-10T00:00:00.000Z",
  });
  assertEquals(p.capBps, 11000);
  assertEquals(p.transferLimit, 2);
  assertEquals(p.cutoff, BigInt(Date.parse("2026-12-01T00:00:00.000Z") / 1000));
});

Deno.test("policyArgs falls back to event start when cutoff is null", () => {
  const p = policyArgs({
    resaleCapBps: 11000,
    resaleTransferLimit: 2,
    resaleCutoffAt: null,
    startAt: "2026-12-10T00:00:00.000Z",
  });
  assertEquals(p.cutoff, BigInt(Date.parse("2026-12-10T00:00:00.000Z") / 1000));
});

Deno.test("policyArgs refuses a cap below 100% or above 200%", () => {
  const base = { resaleTransferLimit: 2, resaleCutoffAt: null, startAt: "2026-12-10T00:00:00.000Z" };
  assertThrows(() => policyArgs({ ...base, resaleCapBps: 9999 }));
  assertThrows(() => policyArgs({ ...base, resaleCapBps: 20001 }));
});

Deno.test("policyArgs refuses a transfer limit outside 1..10", () => {
  const base = { resaleCapBps: 11000, resaleCutoffAt: null, startAt: "2026-12-10T00:00:00.000Z" };
  assertThrows(() => policyArgs({ ...base, resaleTransferLimit: 0 }));
  assertThrows(() => policyArgs({ ...base, resaleTransferLimit: 11 }));
});

Deno.test("faceValueArg refuses zero, negatives and fractions", () => {
  assertEquals(faceValueArg(49900), 49900n);
  assertThrows(() => faceValueArg(0));
  assertThrows(() => faceValueArg(-1));
  assertThrows(() => faceValueArg(10.5));
});
