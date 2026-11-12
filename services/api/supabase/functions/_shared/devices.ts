// Device policy (PHASE2_PLAN §2.3). Pure functions only, no database or network.
//   * The first device on an account becomes active as soon as its attestation passes.
//   * Any later device is "pending" for 48 hours. It can only be activated after the
//     cooldown AND a code sent to the account's verified email. Both are required.
//   * Activating a device replaces the old active device (see devices/index.ts).
//   * A challenge (nonce) for attestation lives 5 minutes and works once.

export const COOLDOWN_SECONDS = 48 * 60 * 60;
export const CHALLENGE_TTL_SECONDS = 5 * 60;
export const MAX_CHAIN_LENGTH = 10;

export function initialStatus(hasActiveDevice: boolean): "active" | "pending" {
  return hasActiveDevice ? "pending" : "active";
}

export function activateAfterFrom(now: Date): Date {
  return new Date(now.getTime() + COOLDOWN_SECONDS * 1000);
}

export type ActivationStep =
  | { step: "cooldown"; retryAfter: number }
  | { step: "send_code" }
  | { step: "verify_code" };

/** What the activate call should do next. The cooldown always comes first. */
export function activationStep(now: Date, activateAfter: Date, hasCode: boolean): ActivationStep {
  const ms = activateAfter.getTime() - now.getTime();
  if (ms > 0) return { step: "cooldown", retryAfter: Math.ceil(ms / 1000) };
  return hasCode ? { step: "verify_code" } : { step: "send_code" };
}

export function challengeExpiresAt(now: Date): Date {
  return new Date(now.getTime() + CHALLENGE_TTL_SECONDS * 1000);
}

export function challengeIsLive(expiresAt: Date, now: Date): boolean {
  return now.getTime() < expiresAt.getTime();
}

export interface RegisterInput {
  nonce: string;
  deviceKeyId: string;
  publicKey: string;
  platform: "android";
  chain: string[];
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Checks the request body for `register`. Returns a short message on the first problem. */
export function validateRegisterInput(
  body: Record<string, unknown>,
): { ok: true; value: RegisterInput } | { ok: false; message: string } {
  const nonce = body.nonce;
  if (typeof nonce !== "string" || nonce.length < 16 || nonce.length > 128) {
    return { ok: false, message: "Missing or invalid challenge." };
  }
  const deviceKeyId = body.device_key_id;
  if (typeof deviceKeyId !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(deviceKeyId)) {
    return { ok: false, message: "Invalid device id." };
  }
  const publicKey = body.public_key;
  if (
    typeof publicKey !== "string" ||
    publicKey.length < 40 ||
    publicKey.length > 1024 ||
    publicKey.length % 4 !== 0 ||
    !BASE64_RE.test(publicKey)
  ) {
    return { ok: false, message: "Invalid public key." };
  }
  if (body.platform !== "android") {
    return { ok: false, message: "Only Android devices are supported in this version." };
  }
  const chain = body.certificate_chain;
  if (!Array.isArray(chain) || chain.length === 0 || chain.length > MAX_CHAIN_LENGTH) {
    return { ok: false, message: "Missing certificate chain." };
  }
  if (!chain.every((c) => typeof c === "string" && c.length > 0 && c.length <= 8192)) {
    return { ok: false, message: "Invalid certificate chain." };
  }
  return {
    ok: true,
    value: { nonce, deviceKeyId, publicKey, platform: "android", chain: chain as string[] },
  };
}
