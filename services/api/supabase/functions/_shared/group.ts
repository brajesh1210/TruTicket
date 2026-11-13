// Group ticket claim codes (PRD §6.6, PHASE2_PLAN §2.8). The code goes to the invitee by email.
// The database stores only its SHA-256 hash (group_tickets.claimToken).
import { sha256Hex } from "./qr.ts";

export const INVITE_TTL_HOURS = 168; // 7 days

/** 32 random bytes, base64url, no padding: 43 characters. */
export function newClaimCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const CODE_RE = /^[A-Za-z0-9_-]{43}$/;

export function isClaimCodeShape(code: string): boolean {
  return CODE_RE.test(code);
}

export function claimCodeHash(code: string): Promise<string> {
  return sha256Hex(code);
}
