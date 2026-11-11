import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { sendOtpEmail } from "./email.ts";
import type { Config } from "./env.ts";

const cfg = {
  brevoKey: "xkeysib-test",
  emailFrom: "sender@example.com",
  emailFromName: "TruTicket",
} as Config;

function withFetch(
  handler: (url: string, init: RequestInit) => Response,
  run: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init ?? {}))) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

Deno.test("sends through Brevo with the api-key header and sender", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  await withFetch((url, init) => {
    seen = { url, init };
    return new Response("{}", { status: 201 });
  }, () => sendOtpEmail(cfg, "buyer@example.com", "123456"));

  const s = seen as unknown as { url: string; init: RequestInit };
  assertEquals(s.url, "https://api.brevo.com/v3/smtp/email");
  assertEquals(s.init.method, "POST");
  const headers = s.init.headers as Record<string, string>;
  assertEquals(headers["api-key"], "xkeysib-test");
  const body = JSON.parse(s.init.body as string);
  assertEquals(body.sender, { email: "sender@example.com", name: "TruTicket" });
  assertEquals(body.to, [{ email: "buyer@example.com" }]);
  assertEquals(body.textContent.includes("123456"), true);
});

Deno.test("a Brevo failure becomes EMAIL_SEND_FAILED (502)", async () => {
  await withFetch(() => new Response("{\"message\":\"sender not validated\"}", { status: 400 }), async () => {
    await assertRejects(
      () => sendOtpEmail(cfg, "buyer@example.com", "123456"),
      Error,
      "could not send",
    );
  });
});

Deno.test("missing Brevo key fails closed before any request", async () => {
  let called = false;
  await withFetch(() => {
    called = true;
    return new Response("{}", { status: 201 });
  }, async () => {
    await assertRejects(() => sendOtpEmail({ ...cfg, brevoKey: "" } as Config, "a@b.com", "123456"));
  });
  assertEquals(called, false);
});
