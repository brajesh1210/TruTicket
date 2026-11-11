// Pure OTP helpers. No network and no database, so they are unit tested directly.
// Rules (PHASE2_PLAN §2.2): 6 digits, 10-minute expiry, 5 attempts, 60-second resend.
// Only an HMAC of the code is stored. The HMAC key lives in the function secrets.

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 600;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;

const RANDOM_RANGE = 4294967296; // 2^32
const CODE_SPACE = 1000000; // 10^6 codes for 6 digits

function cryptoBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/**
 * Uniform 6-digit code using rejection sampling, so no code is more likely than another.
 * `random` is injectable for tests.
 */
export function generateOtpCode(random: (n: number) => Uint8Array = cryptoBytes): string {
  const limit = RANDOM_RANGE - (RANDOM_RANGE % CODE_SPACE);
  for (;;) {
    const b = random(4);
    const n = b[0] * 16777216 + b[1] * 65536 + b[2] * 256 + b[3];
    if (n < limit) {
      return String(n % CODE_SPACE).padStart(OTP_LENGTH, "0");
    }
  }
}

export function isValidOtpFormat(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * HMAC-SHA256 over "emailKey|purpose|code". Binding the hash to the email and
 * purpose means a stored hash cannot be reused for another address or purpose.
 */
export async function hashOtp(
  secret: string,
  emailKey: string,
  purpose: string,
  code: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${emailKey}|${purpose}|${code}`),
  );
  return toHex(new Uint8Array(sig));
}

/** Constant-time comparison of two hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
