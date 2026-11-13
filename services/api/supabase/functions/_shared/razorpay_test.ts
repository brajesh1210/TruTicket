import { assert, assertEquals } from "jsr:@std/assert@1";
import { hmacHex, verifyWebhookSignature } from "./razorpay.ts";

const SECRET = "whsec_test_123";
const BODY = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1","order_id":"order_1","amount":49900}}}}';

Deno.test("hmacHex is 64 lowercase hex characters", async () => {
  const h = await hmacHex(SECRET, BODY);
  assertEquals(h.length, 64);
  assert(/^[0-9a-f]{64}$/.test(h));
});

Deno.test("a correct signature over the raw body is accepted", async () => {
  const sig = await hmacHex(SECRET, BODY);
  assertEquals(await verifyWebhookSignature(BODY, sig, SECRET), true);
  assertEquals(await verifyWebhookSignature(BODY, sig.toUpperCase(), SECRET), true);
});

Deno.test("a changed body is refused", async () => {
  const sig = await hmacHex(SECRET, BODY);
  const tampered = BODY.replace("49900", "100");
  assertEquals(await verifyWebhookSignature(tampered, sig, SECRET), false);
  assertEquals(await verifyWebhookSignature(BODY + " ", sig, SECRET), false);
});

Deno.test("a wrong secret is refused", async () => {
  const sig = await hmacHex("someone-else", BODY);
  assertEquals(await verifyWebhookSignature(BODY, sig, SECRET), false);
});

Deno.test("missing signature or secret fails closed", async () => {
  assertEquals(await verifyWebhookSignature(BODY, "", SECRET), false);
  assertEquals(await verifyWebhookSignature(BODY, "abc", ""), false);
  assertEquals(await verifyWebhookSignature(BODY, "00".repeat(32), SECRET), false);
});
