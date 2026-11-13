// Pure helpers for the Polygon chain (PHASE2_PLAN Phase 3). No network, no DB.
//
// Custody model: users do not hold keys. Each user has a custodial wallet derived from a
// platform master secret: key = HMAC-SHA256(CHAIN_MASTER_SECRET, "truticket-custody-v1:" + userId).
// The backend signs for them. Users never need MATIC. The master secret must never be logged.
import { keccak256, toBytes, toHex } from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";

const LABEL = "truticket-custody-v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** keccak256 of the UTF-8 event UUID. The contract stores this as eventKey. */
export function eventKeyFor(eventId: string): `0x${string}` {
  if (!UUID.test(eventId)) throw new Error("eventKeyFor: not a UUID");
  return keccak256(toBytes(eventId.toLowerCase()));
}

/** Custodial private key for a user (32 bytes, hex). Deterministic for the same secret and user. */
export async function custodyPrivateKey(masterSecret: string, userId: string): Promise<`0x${string}`> {
  if (masterSecret.length < 32) throw new Error("custodyPrivateKey: master secret too short");
  if (!UUID.test(userId)) throw new Error("custodyPrivateKey: not a UUID");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(masterSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(LABEL + userId.toLowerCase()));
  return ("0x" + toHex(new Uint8Array(mac)).slice(2)) as `0x${string}`;
}

/** Custodial address for a user. */
export async function custodyAddress(masterSecret: string, userId: string): Promise<`0x${string}`> {
  const pk = await custodyPrivateKey(masterSecret, userId);
  return privateKeyToAccount(pk).address;
}

export type PolicyInput = {
  resaleCapBps: number;
  resaleTransferLimit: number;
  resaleCutoffAt: string | null; // timestamptz from the DB, or null
  startAt: string;               // event start, used when cutoff is null
};

/** Turns the event's resale settings into the arguments of setPolicy(). Bounds match the contract. */
export function policyArgs(e: PolicyInput): { capBps: number; transferLimit: number; cutoff: bigint } {
  if (!Number.isInteger(e.resaleCapBps) || e.resaleCapBps < 10000 || e.resaleCapBps > 20000) {
    throw new Error("policyArgs: cap out of range");
  }
  if (!Number.isInteger(e.resaleTransferLimit) || e.resaleTransferLimit < 1 || e.resaleTransferLimit > 10) {
    throw new Error("policyArgs: transfer limit out of range");
  }
  const cutoffIso = e.resaleCutoffAt ?? e.startAt;
  const ms = Date.parse(cutoffIso);
  if (Number.isNaN(ms)) throw new Error("policyArgs: bad cutoff");
  return { capBps: e.resaleCapBps, transferLimit: e.resaleTransferLimit, cutoff: BigInt(Math.floor(ms / 1000)) };
}

/** Face value in paise must be a positive integer, like the contract requires. */
export function faceValueArg(faceValueMinor: number): bigint {
  if (!Number.isInteger(faceValueMinor) || faceValueMinor <= 0) throw new Error("faceValueArg: must be a positive integer");
  return BigInt(faceValueMinor);
}
