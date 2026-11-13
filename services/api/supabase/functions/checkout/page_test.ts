import { assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";
import { renderCheckoutPage, scriptJson } from "./page.ts";

Deno.test("page embeds only the public key and the order id", () => {
  const html = renderCheckoutPage({ keyId: "rzp_test_abc123", orderId: "order_ABC123xyz", nonce: "n0nce" });
  assertStringIncludes(html, "rzp_test_abc123");
  assertStringIncludes(html, "order_ABC123xyz");
  assertStringIncludes(html, "https://checkout.razorpay.com/v1/checkout.js");
  assertFalse(html.includes("key_secret"));
  assertFalse(html.includes("RAZORPAY_KEY_SECRET"));
});

Deno.test("scriptJson cannot close the script tag", () => {
  const out = scriptJson({ x: "</script><script>alert(1)</script>" });
  assertFalse(out.includes("</script"));
  assertFalse(out.includes("<"));
});

Deno.test("every script tag carries the nonce", () => {
  const html = renderCheckoutPage({ keyId: "rzp_test_k", orderId: "order_ABC123xyz", nonce: "zz9" });
  assertEquals((html.match(/<script/g) ?? []).length, (html.match(/nonce="zz9"/g) ?? []).length);
});
