// TruTicket auth Edge Function (PHASE2_PLAN §2.2). Replaces the old password draft.
// Sign-in only: Google ID token, or email code (OTP). No passwords. No client-chosen role.
//
// POST body (JSON):
//   { "action": "google",      "id_token": "..." }
//   { "action": "otp_request", "email": "name@example.com" }
//   { "action": "otp_verify",  "email": "name@example.com", "code": "123456" }
//
// Success: { session, user_id, created }   (session = Supabase access + refresh token)
// Errors:  { error: { code, message } }
import { allowRequest } from "../_shared/rate_limit.ts";
import { adminClient } from "../_shared/db.ts";
import { loadConfig, type Config } from "../_shared/env.ts";
import { sendOtpEmail } from "../_shared/email.ts";
import {
  ApiError,
  CORS_HEADERS,
  clientIp,
  errorResponse,
  json,
  readJsonObject,
} from "../_shared/http.ts";
import { emailKey, isValidEmail, normaliseEmail } from "../_shared/identity.ts";
import {
  createAccount,
  EMAIL_LINKED_MESSAGE,
  ensureIdentity,
  findIdentity,
  findVerifiedOwner,
} from "../_shared/accounts.ts";
import { issueSession } from "../_shared/session.ts";
import { verifyGoogleIdToken } from "../_shared/google.ts";
import {
  generateOtpCode,
  hashOtp,
  isValidOtpFormat,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
  timingSafeEqualHex,
} from "../_shared/otp.ts";

const PURPOSE = "login";
const INVALID_CODE_MESSAGE = "That code is wrong or has expired. Request a new one.";

// ---------- Google ----------

async function signInWithGoogle(cfg: Config, body: Record<string, unknown>) {
  const idToken = typeof body.id_token === "string" ? body.id_token : "";
  if (!idToken || idToken.length > 4096) {
    throw new ApiError(400, "INVALID_INPUT", "Missing Google sign-in token.");
  }
  if (cfg.googleClientIds.length === 0) {
    console.error("config missing: GOOGLE_CLIENT_IDS");
    throw new ApiError(500, "CONFIG_MISSING", "Service is not configured.");
  }

  let google;
  try {
    google = await verifyGoogleIdToken(idToken, cfg.googleClientIds);
  } catch (e) {
    console.error("google token rejected", (e as Error).message);
    throw new ApiError(401, "GOOGLE_TOKEN_INVALID", "Google sign-in failed. Please try again.");
  }

  const admin = adminClient(cfg);
  let userId = await findIdentity(admin, "google", google.sub);
  let created = false;

  if (!userId) {
    // New Google login. If the email is already verified on another account,
    // do not link silently. Ask the user to use the email code.
    const key = emailKey(google.email);
    if (await findVerifiedOwner(admin, key)) {
      throw new ApiError(409, "EMAIL_LINKED", EMAIL_LINKED_MESSAGE);
    }
    userId = await createAccount(admin, {
      email: normaliseEmail(google.email),
      key,
      provider: "google",
      subject: google.sub,
    });
    created = true;
  }

  const session = await issueSession(cfg, admin, userId);
  return { session, user_id: userId, created };
}

// ---------- Email code: request ----------

/** Demo code, only when DEMO_MODE=true and the email is on the demo list. */
function demoCodeFor(cfg: Config, key: string): string | null {
  if (cfg.demoMode && cfg.demoEmailKeys.includes(key)) return cfg.demoOtpCode;
  return null;
}

async function requestOtp(cfg: Config, req: Request, body: Record<string, unknown>) {
  const rawEmail = typeof body.email === "string" ? body.email : "";
  if (!isValidEmail(rawEmail)) {
    throw new ApiError(400, "INVALID_INPUT", "Enter a valid email address.");
  }
  const email = normaliseEmail(rawEmail);
  const key = emailKey(email);
  const admin = adminClient(cfg);

  // Limits: per email (5 codes an hour) and per IP (30 an hour).
  const okEmail = await allowRequest(admin, `otp_send:email:${key}`, 3600, 5);
  const okIp = await allowRequest(admin, `otp_send:ip:${clientIp(req)}`, 3600, 30);
  if (!okEmail || !okIp) {
    throw new ApiError(429, "RATE_LIMITED", "Too many code requests. Try again later.", {
      retry_after: 3600,
    });
  }

  // 60-second resend wait. The reply does not show whether an account exists.
  const since = new Date(Date.now() - OTP_RESEND_SECONDS * 1000).toISOString();
  const { data: recent, error: recentError } = await admin
    .from("otp_codes")
    .select("id")
    .eq("email_key", key)
    .eq("purpose", PURPOSE)
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

  // Only the newest code is valid. Retire older unused codes for this email.
  const { error: retireError } = await admin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email_key", key)
    .eq("purpose", PURPOSE)
    .is("consumed_at", null);
  if (retireError) throw retireError;

  const { error: insertError } = await admin.from("otp_codes").insert({
    email_key: key,
    purpose: PURPOSE,
    code_hash: await hashOtp(cfg.otpSecret, key, PURPOSE, code),
    max_attempts: OTP_MAX_ATTEMPTS,
    expires_at: new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString(),
  });
  if (insertError) throw insertError;

  if (demoCode === null) {
    await sendOtpEmail(cfg, email, code);
  }

  return { sent: true, expires_in: OTP_TTL_SECONDS, resend_in: OTP_RESEND_SECONDS };
}

// ---------- Email code: verify ----------

async function verifyOtp(cfg: Config, req: Request, body: Record<string, unknown>) {
  const rawEmail = typeof body.email === "string" ? body.email : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!isValidEmail(rawEmail) || !isValidOtpFormat(code)) {
    throw new ApiError(400, "INVALID_INPUT", "Enter your email and the 6-digit code.");
  }
  const email = normaliseEmail(rawEmail);
  const key = emailKey(email);
  const admin = adminClient(cfg);

  // Limit on all guesses for this email (30 in 15 minutes), on top of the per-code limit.
  if (!(await allowRequest(admin, `otp_verify:email:${key}`, 900, 30))) {
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Try again later.", {
      retry_after: 900,
    });
  }

  const { data: rows, error: rowsError } = await admin
    .from("otp_codes")
    .select("id, code_hash, attempts, max_attempts, expires_at")
    .eq("email_key", key)
    .eq("purpose", PURPOSE)
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

  // Count this guess before checking it, so guesses cannot skip the count.
  // The update only succeeds if attempts still has the value we read.
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

  const expected = await hashOtp(cfg.otpSecret, key, PURPOSE, code);
  if (!timingSafeEqualHex(expected, row.code_hash)) {
    const attemptsLeft = row.max_attempts - (row.attempts + 1);
    throw new ApiError(401, "OTP_INVALID", INVALID_CODE_MESSAGE, {
      attempts_left: Math.max(attemptsLeft, 0),
    });
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

  let userId = await findVerifiedOwner(admin, key);
  let created = false;
  if (userId) {
    await ensureIdentity(admin, userId, "email", key);
  } else {
    userId = await createAccount(admin, { email, key, provider: "email", subject: key });
    created = true;
  }

  const session = await issueSession(cfg, admin, userId);
  return { session, user_id: userId, created };
}

// ---------- Router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST."));
  }

  try {
    const cfg = loadConfig();
    const body = await readJsonObject(req);

    switch (body.action) {
      case "google":
        return json(await signInWithGoogle(cfg, body));
      case "otp_request":
        return json(await requestOtp(cfg, req, body));
      case "otp_verify":
        return json(await verifyOtp(cfg, req, body));
      default:
        throw new ApiError(400, "INVALID_ACTION", "Unknown action.");
    }
  } catch (e) {
    return errorResponse(e);
  }
});
