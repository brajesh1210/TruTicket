// Rotating ticket QR (PHASE2_PLAN §2.7, PRD §6.4). Server-side only: the phone never holds the key.
// Token: TT1.<ticketId>.<exp>.<nonce>.<sig>
//   exp   = unix seconds, server time, now + 10 s
//   nonce = 16 random bytes, hex. Only its SHA-256 is stored (qr_credentials.nonceHash).
//   sig   = first 32 hex chars of HMAC-SHA256(QR_HMAC_KEY, "TT1.<ticketId>.<exp>.<nonce>")
import { hmacHex } from "./razorpay.ts";
import { timingSafeEqualHex } from "./otp.ts";

export const QR_TTL_SECONDS = 10;
const PREFIX = "TT1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NONCE_RE = /^[0-9a-f]{32}$/;
const SIG_RE = /^[0-9a-f]{32}$/;

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomNonceHex(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function signature(key: string, ticketId: string, exp: number, nonce: string): Promise<string> {
  return (await hmacHex(key, `${PREFIX}.${ticketId}.${exp}.${nonce}`)).slice(0, 32);
}

export interface IssuedQr {
  token: string;
  nonceHash: string;
  expiresAt: Date;
}

/** A new QR for one ticket, valid for QR_TTL_SECONDS from `nowMs`. */
export async function issueQr(key: string, ticketId: string, nowMs: number): Promise<IssuedQr> {
  const exp = Math.floor(nowMs / 1000) + QR_TTL_SECONDS;
  const nonce = randomNonceHex();
  const sig = await signature(key, ticketId, exp, nonce);
  return {
    token: `${PREFIX}.${ticketId}.${exp}.${nonce}.${sig}`,
    nonceHash: await sha256Hex(nonce),
    expiresAt: new Date(exp * 1000),
  };
}

export type QrCheck =
  | { ok: true; ticketId: string; nonceHash: string }
  | { ok: false };

/** Checks the shape and the signature. Does not check time or the database (scan_ticket does). */
export async function checkQr(key: string, token: string): Promise<QrCheck> {
  if (!key || typeof token !== "string" || token.length > 300) return { ok: false };
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== PREFIX) return { ok: false };
  const [, ticketId, expText, nonce, sig] = parts;
  if (!UUID_RE.test(ticketId) || !/^[0-9]{1,12}$/.test(expText) || !NONCE_RE.test(nonce) || !SIG_RE.test(sig)) {
    return { ok: false };
  }
  const expected = await signature(key, ticketId.toLowerCase(), Number(expText), nonce);
  if (!timingSafeEqualHex(expected, sig.toLowerCase())) return { ok: false };
  return { ok: true, ticketId: ticketId.toLowerCase(), nonceHash: await sha256Hex(nonce) };
}
