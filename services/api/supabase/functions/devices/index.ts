// TruTicket devices Edge Function (PHASE2_PLAN §2.3). Every call needs a valid sign-in
// (Authorization: Bearer <access token>) whose session is still active.
//
// POST body (JSON):
//   { "action": "status" }
//   { "action": "challenge" }                                  -> { nonce, expires_in }
//   { "action": "register", "nonce", "device_key_id", "public_key", "platform": "android",
//     "certificate_chain": ["<base64 DER>", ...] }             -> { status: "active" | "pending", ... }
//   { "action": "activate", "device_key_id", "code"? }         -> COOLDOWN, or code_sent, or active
//
// Rules:
//   * The first device becomes active after its attestation passes.
//   * A later device is pending for 48 hours. Activation then needs an emailed code.
//   * Activating a device ends every other session of the account.
//   * ATTESTATION_REQUIRED=false (dev only) skips the attestation check and stores "unverified".
import { adminClient } from "../_shared/db.ts";
import { loadConfig, type Config } from "../_shared/env.ts";
import { sendSecurityEmail } from "../_shared/email.ts";
import {
  ApiError,
  CORS_HEADERS,
  clientIp,
  errorResponse,
  json,
  readJsonObject,
} from "../_shared/http.ts";
import { checkCode, sendCode } from "../_shared/otp_flow.ts";
import { enforceLimit } from "../_shared/rate_limit.ts";
import { DEVICE_ACTION_LIMITS, DEVICES_IP_LIMIT, deviceActionKey, ipKey } from "../_shared/limits.ts";
import { sessionIdFromAccessToken } from "../_shared/session_token.ts";
import { AUTH_INVALID_MESSAGE, authErrorFor } from "../_shared/auth_errors.ts";
import { endOtherSessions } from "../_shared/session.ts";
import {
  AttestationError,
  loadRevokedSerials,
  RevocationUnavailableError,
  verifyKeyAttestation,
} from "../_shared/attestation.ts";
import {
  activateAfterFrom,
  activationStep,
  challengeExpiresAt,
  CHALLENGE_TTL_SECONDS,
  initialStatus,
  validateRegisterInput,
} from "../_shared/devices.ts";
import { bytesToBase64 } from "../_shared/der.ts";

type Admin = ReturnType<typeof adminClient>;
interface Caller {
  userId: string;
  sessionId: string;
}


// ---------- Who is calling ----------

async function authenticate(cfg: Config, req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "AUTH_INVALID", AUTH_INVALID_MESSAGE);

  const admin = adminClient(cfg);
  const { data, error } = await admin.auth.getUser(token);
  if (error) throw authErrorFor(error);
  if (!data.user) throw new ApiError(401, "AUTH_INVALID", AUTH_INVALID_MESSAGE);

  const sessionId = sessionIdFromAccessToken(token);
  if (!sessionId) throw new ApiError(401, "AUTH_INVALID", AUTH_INVALID_MESSAGE);

  const { data: active, error: activeError } = await admin.rpc("session_is_active", {
    p_session: sessionId,
    p_user: data.user.id,
  });
  if (activeError) throw activeError;
  if (active !== true) {
    throw new ApiError(401, "SESSION_REVOKED", "This sign-in has ended. Sign in again.");
  }
  return { userId: data.user.id, sessionId };
}

/** The verified email we send codes to: the account's first verified address. */
async function primaryEmail(admin: Admin, userId: string): Promise<{ email: string; key: string }> {
  const { data, error } = await admin
    .from("user_emails")
    .select("email, email_key")
    .eq("user_id", userId)
    .not("verified_at", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email first.");
  return { email: data[0].email as string, key: data[0].email_key as string };
}

// ---------- challenge ----------

async function createChallenge(cfg: Config, caller: Caller) {
  const admin = adminClient(cfg);
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const nonce = bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const { error } = await admin.from("device_challenges").insert({
    nonce,
    user_id: caller.userId,
    expires_at: challengeExpiresAt(new Date()).toISOString(),
  });
  if (error) throw error;
  return { nonce, expires_in: CHALLENGE_TTL_SECONDS };
}

// ---------- register ----------

async function attest(cfg: Config, body: { chain: string[]; publicKey: string; nonce: string }) {
  if (!cfg.attestationRequired) return "unverified" as const;
  try {
    const revoked = await loadRevokedSerials();
    await verifyKeyAttestation({
      chainB64: body.chain,
      publicKeyB64: body.publicKey,
      challenge: body.nonce,
      revoked,
    });
    return "verified" as const;
  } catch (e) {
    if (e instanceof RevocationUnavailableError) {
      console.error("revocation list unavailable");
      throw new ApiError(503, "ATTESTATION_UNAVAILABLE", "Phone check is temporarily unavailable. Try again shortly.");
    }
    if (e instanceof AttestationError) {
      console.error("attestation rejected", e.reason);
      throw new ApiError(403, "ATTESTATION_FAILED", "This phone could not be verified.");
    }
    throw e;
  }
}

async function registerDevice(cfg: Config, caller: Caller, body: Record<string, unknown>) {
  const v = validateRegisterInput(body);
  if (!v.ok) throw new ApiError(400, "INVALID_INPUT", v.message);
  const input = v.value;
  const admin = adminClient(cfg);
  const now = new Date();

  // The challenge works once. Consume it first, so it cannot be replayed.
  const { data: used, error: usedError } = await admin
    .from("device_challenges")
    .update({ used_at: now.toISOString() })
    .eq("nonce", input.nonce)
    .eq("user_id", caller.userId)
    .is("used_at", null)
    .gt("expires_at", now.toISOString())
    .select("nonce");
  if (usedError) throw usedError;
  if (!used || used.length === 0) {
    throw new ApiError(400, "CHALLENGE_INVALID", "Start again. The check expired or was already used.");
  }

  const attestation = await attest(cfg, { chain: input.chain, publicKey: input.publicKey, nonce: input.nonce });

  const { data: same, error: sameError } = await admin
    .from("user_devices")
    .select("id")
    .eq("device_key_id", input.deviceKeyId)
    .limit(1);
  if (sameError) throw sameError;
  if (same && same.length > 0) {
    throw new ApiError(409, "DEVICE_EXISTS", "This phone is already registered.");
  }

  const { data: activeRows, error: activeError } = await admin
    .from("user_devices")
    .select("id")
    .eq("user_id", caller.userId)
    .eq("status", "active")
    .limit(1);
  if (activeError) throw activeError;
  const status = initialStatus(!!(activeRows && activeRows.length > 0));

  // Only one phone can wait at a time. A new request replaces the waiting one.
  if (status === "pending") {
    const { error: replaceError } = await admin
      .from("user_devices")
      .update({ status: "revoked", revoked_at: now.toISOString() })
      .eq("user_id", caller.userId)
      .eq("status", "pending");
    if (replaceError) throw replaceError;
  }

  const activateAfter = status === "pending" ? activateAfterFrom(now) : null;
  const { data: row, error: insertError } = await admin
    .from("user_devices")
    .insert({
      user_id: caller.userId,
      device_key_id: input.deviceKeyId,
      public_key: input.publicKey,
      platform: input.platform,
      attestation,
      status,
      activate_after: activateAfter ? activateAfter.toISOString() : null,
      activated_at: status === "active" ? now.toISOString() : null,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  // This sign-in is now on this phone.
  const { error: linkError } = await admin
    .from("user_sessions")
    .update({ device_key_id: row.id })
    .eq("session_id", caller.sessionId)
    .eq("user_id", caller.userId);
  if (linkError) throw linkError;

  if (status === "pending") {
    // A notice only. The activation code is the real gate, so a failed email does not block registration.
    try {
      const { email } = await primaryEmail(admin, caller.userId);
      await sendSecurityEmail(
        cfg,
        email,
        "A new phone was added to your TruTicket account",
        "A new phone was added to your TruTicket account. It becomes active after 48 hours, and only with a code we send to this email. " +
          "If this was not you, do not share any code and contact TruTicket support.",
      );
    } catch (e) {
      console.error("pending-device notice not sent", (e as Error).message);
    }
    return { status, device_key_id: input.deviceKeyId, activate_after: activateAfter!.toISOString() };
  }
  return { status, device_key_id: input.deviceKeyId };
}

// ---------- activate ----------

async function activateDevice(cfg: Config, req: Request, caller: Caller, body: Record<string, unknown>) {
  const deviceKeyId = typeof body.device_key_id === "string" ? body.device_key_id : "";
  if (!deviceKeyId) throw new ApiError(400, "INVALID_INPUT", "Missing device id.");
  const admin = adminClient(cfg);
  const now = new Date();

  const { data: rows, error: rowsError } = await admin
    .from("user_devices")
    .select("id, activate_after")
    .eq("user_id", caller.userId)
    .eq("device_key_id", deviceKeyId)
    .eq("status", "pending")
    .limit(1);
  if (rowsError) throw rowsError;
  if (!rows || rows.length === 0) throw new ApiError(404, "DEVICE_NOT_FOUND", "No waiting phone with that id.");
  const device = rows[0];

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const step = activationStep(now, new Date(device.activate_after as string), code.length > 0);

  if (step.step === "cooldown") {
    throw new ApiError(
      403,
      "COOLDOWN",
      "This phone can be activated after the 48-hour wait.",
      { retry_after: step.retryAfter },
    );
  }

  if (step.step === "send_code") {
    const { email, key } = await primaryEmail(admin, caller.userId);
    const sent = await sendCode(cfg, admin, { email, key, purpose: "new_device", ip: clientIp(req) });
    return { status: "code_sent", ...sent };
  }

  // Correct code required. Retire the old active phone, then activate this one.
  const { key } = await primaryEmail(admin, caller.userId);
  await checkCode(cfg, admin, { key, purpose: "new_device", code });

  const { error: retireError } = await admin
    .from("user_devices")
    .update({ status: "revoked", revoked_at: now.toISOString() })
    .eq("user_id", caller.userId)
    .eq("status", "active");
  if (retireError) throw retireError;

  const { data: activated, error: activateError } = await admin
    .from("user_devices")
    .update({ status: "active", activated_at: now.toISOString(), activate_after: null })
    .eq("id", device.id)
    .eq("status", "pending")
    .select("id");
  if (activateError) throw activateError;
  if (!activated || activated.length === 0) throw new ApiError(409, "DEVICE_BUSY", "Please try again.");

  // The old phone is signed out: every other session of the account ends.
  await endOtherSessions(admin, caller.userId, caller.sessionId, "device_replaced");

  const { error: linkError } = await admin
    .from("user_sessions")
    .update({ device_key_id: device.id })
    .eq("session_id", caller.sessionId)
    .eq("user_id", caller.userId);
  if (linkError) throw linkError;

  return { status: "active", device_key_id: deviceKeyId };
}

// ---------- status ----------

async function listDevices(cfg: Config, caller: Caller) {
  const { data, error } = await adminClient(cfg)
    .from("user_devices")
    .select("device_key_id, status, attestation, activate_after, activated_at")
    .eq("user_id", caller.userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { ok: true, devices: data ?? [] };
}

// ---------- router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST."));
  }

  try {
    const cfg = loadConfig();
    // Per-IP first, so bad tokens and bad bodies are capped too (2.4).
    await enforceLimit(
      adminClient(cfg),
      ipKey("devices", clientIp(req)),
      DEVICES_IP_LIMIT.windowSeconds,
      DEVICES_IP_LIMIT.max,
      "Too many phone requests. Try again later.",
    );
    const body = await readJsonObject(req);
    const caller = await authenticate(cfg, req);

    // Per-account limit for each action (2.4).
    const rule = typeof body.action === "string" ? DEVICE_ACTION_LIMITS[body.action] : undefined;
    if (rule) {
      await enforceLimit(
        adminClient(cfg),
        deviceActionKey(body.action as string, caller.userId),
        rule.windowSeconds,
        rule.max,
        "Too many phone requests. Try again later.",
      );
    }

    switch (body.action) {
      case "status":
        return json(await listDevices(cfg, caller));
      case "challenge":
        return json(await createChallenge(cfg, caller));
      case "register":
        return json(await registerDevice(cfg, caller, body));
      case "activate":
        return json(await activateDevice(cfg, req, caller, body));
      default:
        throw new ApiError(400, "INVALID_ACTION", "Unknown action.");
    }
  } catch (e) {
    return errorResponse(e);
  }
});
