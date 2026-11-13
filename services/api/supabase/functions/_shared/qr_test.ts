import { assertEquals, assert } from "jsr:@std/assert@1";
import { checkQr, issueQr, QR_TTL_SECONDS } from "./qr.ts";

const KEY = "qr-test-key-1234567890";
const TICKET = "6f1c2e3a-1111-4222-8333-444455556666";
const NOW = 1_800_000_000_000;

Deno.test("an issued QR checks out and carries the ticket id", async () => {
  const q = await issueQr(KEY, TICKET, NOW);
  const c = await checkQr(KEY, q.token);
  assertEquals(c.ok, true);
  if (c.ok) {
    assertEquals(c.ticketId, TICKET);
    assertEquals(c.nonceHash, q.nonceHash);
  }
});

Deno.test("expiry is now plus the 10 second TTL", async () => {
  const q = await issueQr(KEY, TICKET, NOW);
  assertEquals(QR_TTL_SECONDS, 10);
  assertEquals(q.expiresAt.getTime(), NOW + 10_000);
});

Deno.test("two QRs for the same ticket have different nonces", async () => {
  const a = await issueQr(KEY, TICKET, NOW);
  const b = await issueQr(KEY, TICKET, NOW);
  assert(a.token !== b.token);
  assert(a.nonceHash !== b.nonceHash);
});

Deno.test("a changed ticket id, expiry or nonce is refused", async () => {
  const q = await issueQr(KEY, TICKET, NOW);
  const [p, t, exp, nonce, sig] = q.token.split(".");
  assertEquals((await checkQr(KEY, [p, "6f1c2e3a-1111-4222-8333-444455557777", exp, nonce, sig].join("."))).ok, false);
  assertEquals((await checkQr(KEY, [p, t, String(Number(exp) + 3600), nonce, sig].join("."))).ok, false);
  assertEquals((await checkQr(KEY, [p, t, exp, "0".repeat(32), sig].join("."))).ok, false);
});

Deno.test("a QR signed with another key is refused", async () => {
  const q = await issueQr("some-other-key-000000000", TICKET, NOW);
  assertEquals((await checkQr(KEY, q.token)).ok, false);
});

Deno.test("malformed input and a missing key fail closed", async () => {
  const q = await issueQr(KEY, TICKET, NOW);
  assertEquals((await checkQr(KEY, "")).ok, false);
  assertEquals((await checkQr(KEY, "TT1.abc")).ok, false);
  assertEquals((await checkQr(KEY, "XX1" + q.token.slice(3))).ok, false);
  assertEquals((await checkQr(KEY, "x".repeat(400))).ok, false);
  assertEquals((await checkQr("", q.token)).ok, false);
});
