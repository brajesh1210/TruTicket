// Razorpay helpers (PHASE2_PLAN §2.6): create an order, and verify webhook signatures.
// Amounts are in paise (integers). Verified against Razorpay's docs: HMAC-SHA256 of the raw body,
// hex-encoded, sent in the X-Razorpay-Signature header.
import { ApiError } from "./http.ts";
import { timingSafeEqualHex } from "./otp.ts";
import type { Config } from "./env.ts";

const enc = new TextEncoder();

/** HMAC-SHA256(secret, rawBody) as lowercase hex. */
export async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** True only when the signature matches the RAW request body. Fails closed on missing values. */
export async function verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = await hmacHex(secret, rawBody);
  return timingSafeEqualHex(expected, signature.trim().toLowerCase());
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

/** Creates a Razorpay order. `receipt` is our order id. Throws ApiError on failure. */
export async function createRazorpayOrder(
  cfg: Config,
  args: { amountMinor: number; currency: string; receipt: string },
): Promise<RazorpayOrder> {
  if (!cfg.razorpayKeyId || !cfg.razorpayKeySecret) {
    console.error("config missing: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
    throw new ApiError(500, "CONFIG_MISSING", "Payments are not configured yet.");
  }
  const auth = btoa(`${cfg.razorpayKeyId}:${cfg.razorpayKeySecret}`);
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: args.amountMinor, currency: args.currency, receipt: args.receipt }),
  });
  if (!res.ok) {
    console.error("razorpay order failed", res.status);
    throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", "Payment could not start. Try again.");
  }
  const body = (await res.json()) as Partial<RazorpayOrder>;
  if (typeof body.id !== "string" || !body.id.startsWith("order_")) {
    console.error("razorpay order response unexpected");
    throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", "Payment could not start. Try again.");
  }
  return { id: body.id, amount: Number(body.amount), currency: String(body.currency) };
}
