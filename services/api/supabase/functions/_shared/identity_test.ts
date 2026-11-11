import { assert, assertEquals } from "jsr:@std/assert@1";
import { emailKey, isValidEmail, normaliseEmail } from "./identity.ts";

// These cases are also run against public.normalise_email_key() in Postgres
// (see supabase/tests/002_auth_sessions.test.sql, group T15). Keep both in sync.
export const EMAIL_KEY_CASES: Array<[string, string]> = [
  ["  Ansh@Example.COM ", "ansh@example.com"],
  ["a.b.c@gmail.com", "abc@gmail.com"],
  ["a.b+shop@gmail.com", "ab@gmail.com"],
  ["A.B+x+y@GoogleMail.com", "ab@gmail.com"],
  ["x@googlemail.com", "x@gmail.com"],
  ["first.last@outlook.com", "first.last@outlook.com"],
  ["a+tag@outlook.com", "a+tag@outlook.com"],
];

Deno.test("normaliseEmail trims and lowercases", () => {
  assertEquals(normaliseEmail("  Ansh@Example.COM "), "ansh@example.com");
});

for (const [input, expected] of EMAIL_KEY_CASES) {
  Deno.test(`emailKey(${JSON.stringify(input)}) = ${expected}`, () => {
    assertEquals(emailKey(input), expected);
  });
}

Deno.test("isValidEmail", () => {
  assert(isValidEmail("a@b.co"));
  assert(isValidEmail("  A@B.CO  "));
  assert(!isValidEmail("no-at-sign"));
  assert(!isValidEmail("a@b"));
  assert(!isValidEmail("a b@c.com"));
  assert(!isValidEmail(`${"a".repeat(250)}@b.com`));
});
