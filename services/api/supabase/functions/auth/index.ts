// TruTicket auth Edge Function (PHASE2_PLAN §2.2, §2.3). Sign-in only: Google ID token, or
// email code. No passwords. No client-chosen role.
//
// POST body (JSON):
//   { "action": "google",      "id_token": "...",  "device_key_id": "optional" }
//   { "action": "otp_request", "email": "name@example.com" }
//   { "action": "otp_verify",  "email": "name@example.com", "code": "123456", "device_key_id": "optional" }
//
// Each successful sign-in ENDS the account's previous session (2.3): the old refresh token
// stops working and the old access token is refused by the devices function.
//
// Success: { session, user_id, created }   (session = Supabase access + refresh token)
// Errors:  { error: { code, message } }
import { adminClient } from "../_shared/db.ts";
import { loadConfig, type Config } from "../_shared/env.ts";
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
import { activeDeviceRowId, issueSession, sessionIdOf, startSession } from "../_shared/session.ts";
import { verifyGoogleIdToken } from "../_shared/google.ts";
import { checkCode, sendCode } from "../_shared/otp_flow.ts";
import { enforceLimit } from "../_shared/rate_limit.ts";
import { GOOGLE_IP_LIMIT, ipKey } from "../_shared/limits.ts";

const PURPOSE = "login" as const;

function deviceKeyFrom(body: Record<string, unknown>): string | undefined {
  return typeof body.device_key_id === "string" && body.device_key_id.length <= 128
    ? body.device_key_id
    : undefined;
}

/** Issues the session and makes it the account's only active one. */
async function finishSignIn(cfg: Config, admin: ReturnType<typeof adminClient>, userId: string, deviceKeyId?: string) {
  const session = await issueSession(cfg, admin, userId);
  const sessionId = sessionIdOf(session);
  const deviceRowId = await activeDeviceRowId(admin, userId, deviceKeyId);
  await startSession(admin, { userId, sessionId, deviceRowId });
  return session;
}

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

  const session = await finishSignIn(cfg, admin, userId, deviceKeyFrom(body));
  return { session, user_id: userId, created };
}

// ---------- Email code: request ----------

async function requestOtp(cfg: Config, req: Request, body: Record<string, unknown>) {
  const rawEmail = typeof body.email === "string" ? body.email : "";
  if (!isValidEmail(rawEmail)) {
    throw new ApiError(400, "INVALID_INPUT", "Enter a valid email address.");
  }
  const email = normaliseEmail(rawEmail);
  const key = emailKey(email);
  return await sendCode(cfg, adminClient(cfg), { email, key, purpose: PURPOSE, ip: clientIp(req) });
}

// ---------- Email code: verify ----------

async function verifyOtp(cfg: Config, body: Record<string, unknown>) {
  const rawEmail = typeof body.email === "string" ? body.email : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!isValidEmail(rawEmail)) {
    throw new ApiError(400, "INVALID_INPUT", "Enter your email and the 6-digit code.");
  }
  const email = normaliseEmail(rawEmail);
  const key = emailKey(email);
  const admin = adminClient(cfg);

  await checkCode(cfg, admin, { key, purpose: PURPOSE, code });

  let userId = await findVerifiedOwner(admin, key);
  let created = false;
  if (userId) {
    await ensureIdentity(admin, userId, "email", key);
  } else {
    userId = await createAccount(admin, { email, key, provider: "email", subject: key });
    created = true;
  }

  const session = await finishSignIn(cfg, admin, userId, deviceKeyFrom(body));
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
        // Per-IP limit before the Google token is checked (2.4).
        await enforceLimit(
          adminClient(cfg),
          ipKey("google", clientIp(req)),
          GOOGLE_IP_LIMIT.windowSeconds,
          GOOGLE_IP_LIMIT.max,
          "Too many sign-in attempts. Try again later.",
        );
        return json(await signInWithGoogle(cfg, body));
      case "otp_request":
        return json(await requestOtp(cfg, req, body));
      case "otp_verify":
        return json(await verifyOtp(cfg, body));
      default:
        throw new ApiError(400, "INVALID_ACTION", "Unknown action.");
    }
  } catch (e) {
    return errorResponse(e);
  }
});
