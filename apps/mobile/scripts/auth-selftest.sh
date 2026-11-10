#!/usr/bin/env bash
# Unit-style checks for email normalisation and OTP lockout (no device needed).
# Usage: bash scripts/auth-selftest.sh   (run from apps/mobile)
set -euo pipefail
OUT=".tmp-authtest"
rm -rf "$OUT" && mkdir -p "$OUT"
npx tsc src/auth/email.ts src/auth/session.ts --ignoreConfig --outDir "$OUT" \
  --module commonjs --target es2019 --skipLibCheck --esModuleInterop --jsx react-jsx --strict || true
cat > "$OUT/run.js" <<'JS'
const assert = require("assert");
process.env.EXPO_PUBLIC_DEMO_MODE = "true";
const { duplicateKey, normalizeEmail, isValidEmail } = require("./email.js");
const S = require("./session.js");
assert.strictEqual(duplicateKey("A.B+promo@Gmail.com"), duplicateKey("ab@gmail.com"));
assert.strictEqual(duplicateKey("ab@googlemail.com"), "ab@gmail.com");
assert.notStrictEqual(duplicateKey("a.b@yahoo.com"), duplicateKey("ab@yahoo.com"));
assert.strictEqual(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
assert.ok(!isValidEmail("nope@"));
(async () => {
  assert.strictEqual((await S.verifyEmailOtp("123456")).ok, false, "no pending email must fail");
  assert.strictEqual((await S.requestEmailOtp("bad")).ok, false);
  assert.strictEqual((await S.requestEmailOtp("x@y.com")).ok, true);
  assert.strictEqual((await S.requestEmailOtp("x@y.com")).ok, false, "cooldown must block resend");
  for (let i = 0; i < 4; i++) assert.strictEqual((await S.verifyEmailOtp("000000")).ok, false);
  const fifth = await S.verifyEmailOtp("000000");
  assert.strictEqual(fifth.ok, false);
  assert.match(fifth.error, /Locked/);
  assert.strictEqual((await S.verifyEmailOtp("123456")).ok, false, "locked account must reject even correct code");
  console.log("ALL AUTH TESTS PASSED");
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
JS
node "$OUT/run.js"
rm -rf "$OUT"
