import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import {
  generateOtpCode,
  hashOtp,
  isValidOtpFormat,
  timingSafeEqualHex,
} from "./otp.ts";

Deno.test("generateOtpCode returns 6 digits", () => {
  for (let i = 0; i < 200; i++) {
    assert(isValidOtpFormat(generateOtpCode()));
  }
});

Deno.test("generateOtpCode keeps leading zeros", () => {
  // 0x00000007 -> 7 -> "000007"
  const code = generateOtpCode(() => new Uint8Array([0, 0, 0, 7]));
  assertEquals(code, "000007");
});

Deno.test("generateOtpCode rejects values above the unbiased limit", () => {
  // First draw is 0xFFFFFFFF, which is >= the limit, so it must be skipped.
  const draws = [new Uint8Array([255, 255, 255, 255]), new Uint8Array([0, 0, 0, 1])];
  let i = 0;
  const code = generateOtpCode(() => draws[i++]);
  assertEquals(code, "000001");
  assertEquals(i, 2);
});

Deno.test("isValidOtpFormat accepts only exactly 6 digits", () => {
  assert(isValidOtpFormat("123456"));
  assert(isValidOtpFormat("000000"));
  assert(!isValidOtpFormat("12345"));
  assert(!isValidOtpFormat("1234567"));
  assert(!isValidOtpFormat("12345a"));
  assert(!isValidOtpFormat(" 123456"));
  assert(!isValidOtpFormat(""));
});

Deno.test("hashOtp is deterministic", async () => {
  const a = await hashOtp("secret-secret-secret-secret-1234", "a@b.com", "login", "123456");
  const b = await hashOtp("secret-secret-secret-secret-1234", "a@b.com", "login", "123456");
  assertEquals(a, b);
  assertEquals(a.length, 64);
});

Deno.test("hashOtp changes with secret, email, purpose and code", async () => {
  const s = "secret-secret-secret-secret-1234";
  const base = await hashOtp(s, "a@b.com", "login", "123456");
  assertNotEquals(base, await hashOtp("other-secret-other-secret-1234", "a@b.com", "login", "123456"));
  assertNotEquals(base, await hashOtp(s, "c@b.com", "login", "123456"));
  assertNotEquals(base, await hashOtp(s, "a@b.com", "new_device", "123456"));
  assertNotEquals(base, await hashOtp(s, "a@b.com", "login", "123457"));
});

Deno.test("timingSafeEqualHex compares correctly", () => {
  assert(timingSafeEqualHex("abcd", "abcd"));
  assert(!timingSafeEqualHex("abcd", "abce"));
  assert(!timingSafeEqualHex("abcd", "abc"));
});
