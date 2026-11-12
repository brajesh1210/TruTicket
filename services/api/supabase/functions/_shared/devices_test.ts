import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  activateAfterFrom,
  activationStep,
  challengeExpiresAt,
  challengeIsLive,
  COOLDOWN_SECONDS,
  initialStatus,
  validateRegisterInput,
} from "./devices.ts";

const NOW = new Date("2026-11-11T10:00:00Z");
const GOOD_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE" + "A".repeat(88);

Deno.test("the first device is active at once; a later device is pending", () => {
  assertEquals(initialStatus(false), "active");
  assertEquals(initialStatus(true), "pending");
});

Deno.test("a pending device waits exactly 48 hours", () => {
  assertEquals(COOLDOWN_SECONDS, 48 * 3600);
  assertEquals(activateAfterFrom(NOW).getTime() - NOW.getTime(), 48 * 3600 * 1000);
});

Deno.test("during the cooldown activation is refused with the seconds left", () => {
  const after = activateAfterFrom(NOW);
  const step = activationStep(new Date(NOW.getTime() + 1500), after, false);
  assertEquals(step.step, "cooldown");
  if (step.step === "cooldown") assertEquals(step.retryAfter, Math.ceil((48 * 3600 * 1000 - 1500) / 1000));
});

Deno.test("when the cooldown is over and there is no code yet, a code is sent", () => {
  const after = activateAfterFrom(NOW);
  assertEquals(activationStep(after, after, false), { step: "send_code" });
});

Deno.test("after the cooldown a supplied code is checked", () => {
  const after = activateAfterFrom(NOW);
  assertEquals(activationStep(new Date(after.getTime() + 1000), after, true), { step: "verify_code" });
});

Deno.test("a challenge lives 5 minutes and is then dead", () => {
  const exp = challengeExpiresAt(NOW);
  assert(challengeIsLive(exp, new Date(NOW.getTime() + 299_000)));
  assertEquals(challengeIsLive(exp, exp), false);
});

Deno.test("validateRegisterInput accepts a good body and rejects bad fields", () => {
  const good = {
    nonce: "n".repeat(32),
    device_key_id: "dev-test-A",
    public_key: GOOD_KEY,
    platform: "android",
    certificate_chain: ["QUFBQQ=="],
  };
  assertEquals(validateRegisterInput(good).ok, true);
  assertEquals(validateRegisterInput({ ...good, platform: "ios" }).ok, false);
  assertEquals(validateRegisterInput({ ...good, public_key: "not base64!" }).ok, false);
  assertEquals(validateRegisterInput({ ...good, certificate_chain: [] }).ok, false);
  assertEquals(validateRegisterInput({ ...good, device_key_id: "bad id with spaces" }).ok, false);
});
