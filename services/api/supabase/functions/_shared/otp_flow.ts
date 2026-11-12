// Email code flow shared by sign-in (purpose "login") and new-phone activation
// (purpose "new_device"). Rules (PHASE2_PLAN §2.2): 6 digits, 10-minute expiry,
// 5 wrong tries, 60-second resend wait, hash-only storage, one code works once.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Config } from "./env.ts";
import { sendOtpEmail, type OtpPurpose } from "./email.ts";
import { ApiError } from "./http.ts";
import { allowRequest } from "./rate_limit.ts";
import {
  generateOtpCode,
  hashOtp,
  isValidOtpFormat,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
  timingSafeEqualHex,
} from "./otp.ts";

const INVALID_CODE_MESSAGE = "That code is wrong or has expired. Request a new one.";

/** Demo code, only when DEMO_MODE=true and the email is on the demo list. */
function demoCodeFor(cfg: Config, key: string): string | null {
  if (cfg.demoMode && cfg.demoEmailKeys.includes(key)) return cfg.demoOtpCode;
  return null;
}

/** Sends a code to `email`. `ip` feeds the per-IP limit. Throws ApiError on limits or send failure. */
export async function sendCode(
  cfg: Config,
  admin: SupabaseClient,
  args: { email: string; key: string; purpose: OtpPurpose; ip: string },
): Promise<{ sent: true; expires_in: number; resend_in: number }> {
  const { email, key, purpose, ip } = args;

  // Limits: per email (5 codes an hour) and per IP (30 an hour).
  const okEmail = await allowRequest(admin, `otp_send:email:${key}`, 3600, 5);
  const okIp = await allowRequest(admin, `otp_send:ip:${ip}`, 3600, 30);
  if (!okEmail || !okIp) {
    throw new ApiError(429, "RATE_LIMITED", "Too many code requests. Try again later.", { retry_after: 3600 });
  }

  // 60-second resend wait. The reply does not show whether an account exists.
  const since = new Date(Date.now() - OTP_RESEND_SECONDS * 1000).toISOString();
  const { data: recent, error: recentError } = await admin
    .from("otp_codes")
    .select("id")
    .eq("email_key", key)
    .eq("purpose", purpose)
    .gte("created_at", since)
    .limit(1);
  if (recentError) throw recentError;
  if (recent && recent.length > 0) {
    throw new ApiError(429, "RESEND_WAIT", "Please wait a minute before requesting another code.", {
      retry_after: OTP_RESEND_SECONDS,
    });
  }

  const demoCode = demoCodeFor(cfg, key);
  const code = demoCode ?? generateOtpCode();

  // Only the newest code is valid. Retire older unused codes for this email and purpose.
  const { error: retireError } = await admin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email_key", key)
    .eq("purpose", purpose)
    .is("consumed_at", null);
  if (retireError) throw retireError;

  const { error: insertError } = await admin.from("otp_codes").insert({
    email_key: key,
    purpose,
    code_hash: await hashOtp(cfg.otpSecret, key, purpose, code),
    max_attempts: OTP_MAX_ATTEMPTS,
    expires_at: new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString(),
  });
  if (insertError) throw insertError;

  if (demoCode === null) {
    await sendOtpEmail(cfg, email, code, purpose);
  }
  return { sent: true, expires_in: OTP_TTL_SECONDS, resend_in: OTP_RESEND_SECONDS };
}

/**
 * Checks a code. Resolves when it is correct (and consumes it). Throws ApiError otherwise.
 * `key` is the normalised email key; `purpose` must match the one used to send.
 */
export async function checkCode(
  cfg: Config,
  admin: SupabaseClient,
  args: { key: string; purpose: OtpPurpose; code: string },
): Promise<void> {
  const { key, purpose, code } = args;
  if (!isValidOtpFormat(code)) {
    throw new ApiError(400, "INVALID_INPUT", "Enter the 6-digit code.");
  }

  // Limit on all guesses for this email (30 in 15 minutes), on top of the per-code limit.
  if (!(await allowRequest(admin, `otp_verify:email:${key}`, 900, 30))) {
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Try again later.", { retry_after: 900 });
  }

  const { data: rows, error: rowsError } = await admin
    .from("otp_codes")
    .select("id, code_hash, attempts, max_attempts, expires_at")
    .eq("email_key", key)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (rowsError) throw rowsError;

  const row = rows && rows.length > 0 ? rows[0] : null;
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new ApiError(401, "OTP_INVALID", INVALID_CODE_MESSAGE);
  }
  if (row.attempts >= row.max_attempts) {
    throw new ApiError(429, "OTP_LOCKED", "Too many wrong codes. Request a new code.");
  }

  // Count this guess before checking it. The update only succeeds if attempts still has the value we read.
  const { data: bumped, error: bumpError } = await admin
    .from("otp_codes")
    .update({ attempts: row.attempts + 1 })
    .eq("id", row.id)
    .eq("attempts", row.attempts)
    .select("id");
  if (bumpError) throw bumpError;
  if (!bumped || bumped.length === 0) {
    throw new ApiError(409, "OTP_BUSY", "Please try again.");
  }

  const expected = await hashOtp(cfg.otpSecret, key, purpose, code);
  if (!timingSafeEqualHex(expected, row.code_hash)) {
    const attemptsLeft = row.max_attempts - (row.attempts + 1);
    throw new ApiError(401, "OTP_INVALID", INVALID_CODE_MESSAGE, { attempts_left: Math.max(attemptsLeft, 0) });
  }

  // Correct code. Consume it. Only one request can win this update, so a code works once.
  const { data: consumed, error: consumeError } = await admin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("consumed_at", null)
    .select("id");
  if (consumeError) throw consumeError;
  if (!consumed || consumed.length === 0) {
    throw new ApiError(401, "OTP_INVALID", INVALID_CODE_MESSAGE);
  }
}
