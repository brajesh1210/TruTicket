/**
 * Device link for purchases (PHASE2_PLAN §2.3).
 *
 * A purchase needs the sign-in session to be linked to an ACTIVE device. This phone:
 *   1. keeps a device id in secure storage (created once),
 *   2. sends that id with every sign-in (auth: device_key_id),
 *   3. registers itself once per account (devices: challenge → register). The server
 *      links the current session to the phone row.
 *
 * Attestation (Android Keystore) is skipped on the DEV demo path. The DEV project runs with
 * ATTESTATION_REQUIRED=false, so the server stores the phone as "unverified". Production must
 * keep attestation on (Phase 2b). This file does not change that check.
 *
 * The device id is an identifier, not a secret, so a random string is enough here.
 */
import * as SecureStore from "expo-secure-store";
import { callFunction } from "../services/api";
import { ApiError } from "../services/errors";

const STORE_KEY = "truticket.device.v1";

// Dev placeholders. The server only checks their format when attestation is off.
const DEV_CHAIN = "ZGV2LWF0dGVzdGF0aW9uLXNraXBwZWQ=";
const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

type Stored = { deviceKeyId: string; linkedUserId?: string };

function randomChars(length: number, alphabet: string): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function load(): Promise<Stored | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** The device id sent with sign-in. Created once and kept on this phone. */
export async function getDeviceKeyId(): Promise<string> {
  const cur = await load();
  if (cur?.deviceKeyId) return cur.deviceKeyId;
  const id = randomChars(32, B64_ALPHABET);
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify({ deviceKeyId: id } as Stored));
  return id;
}

/**
 * Registers this phone for the signed-in account, once per account. The current session must
 * already be saved (the call uses its access token). Throws ApiError if the server refuses.
 */
export async function ensureDeviceLinked(userId: string): Promise<void> {
  const deviceKeyId = await getDeviceKeyId();
  const cur = await load();
  if (cur?.linkedUserId === userId) return;

  const challenge = await callFunction<{ nonce: string }>("devices", { action: "challenge" }, { auth: true });
  try {
    await callFunction(
      "devices",
      {
        action: "register",
        nonce: challenge.nonce,
        device_key_id: deviceKeyId,
        public_key: randomChars(88, B64_ALPHABET), // 88 chars, multiple of 4, base64 alphabet
        platform: "android",
        certificate_chain: [DEV_CHAIN],
      },
      { auth: true },
    );
  } catch (e) {
    // Same phone already registered (for example after a sign-out and sign-in): the link is done.
    if (!(e instanceof ApiError && e.code === "DEVICE_EXISTS")) throw e;
  }
  await SecureStore.setItemAsync(
    STORE_KEY,
    JSON.stringify({ deviceKeyId, linkedUserId: userId } as Stored),
  );
}
