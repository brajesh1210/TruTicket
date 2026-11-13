// TruTicket Razorpay webhook (PHASE2_PLAN §2.6). Called by Razorpay, not by the app.
// No JWT (config.toml). The signature over the RAW body is the only gate.
// Events: payment.captured -> tickets issued (or a resale transfer); payment.failed -> hold released.
// Replays are safe: each event id is stored once.
import { adminClient } from "../_shared/db.ts";
import { loadConfig } from "../_shared/env.ts";
import { ApiError, errorResponse, json } from "../_shared/http.ts";
import { verifyWebhookSignature } from "../_shared/razorpay.ts";

const MAX_BODY = 200_000;

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST."));
  try {
    const cfg = loadConfig();
    if (!cfg.razorpayWebhookSecret) throw new ApiError(500, "CONFIG_MISSING", "Payments are not configured yet.");

    const raw = await req.text();
    if (raw.length > MAX_BODY) throw new ApiError(413, "TOO_LARGE", "Payload too large.");

    const signature = req.headers.get("x-razorpay-signature") ?? "";
    if (!(await verifyWebhookSignature(raw, signature, cfg.razorpayWebhookSecret))) {
      console.error("webhook signature rejected");
      throw new ApiError(401, "SIGNATURE_INVALID", "Signature check failed.");
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Body must be JSON.");
    }
    const kind = String(payload.event ?? "");
    const entity = (((payload.payload as Record<string, unknown>)?.payment as Record<string, unknown>)?.entity ?? {}) as Record<string, unknown>;

    // Razorpay sends a unique id per delivery. Fall back to a hash of the body if it is missing.
    const eventId = req.headers.get("x-razorpay-event-id") || `body:${await sha256Hex(raw)}`;

    if (kind !== "payment.captured" && kind !== "payment.failed") {
      return json({ ok: true, result: "IGNORED" });
    }

    const rzpOrder = String(entity.order_id ?? "");
    if (!rzpOrder.startsWith("order_")) throw new ApiError(400, "INVALID_INPUT", "Missing order id.");

    const admin = adminClient(cfg);
    // A resale payment (PHASE2_PLAN §2.8) has its own attempt row. Everything else is a ticket order.
    const { data: resaleRow, error: resaleErr } = await admin
      .from("resale_payments")
      .select("id")
      .eq("providerOrderId", rzpOrder)
      .maybeSingle();
    if (resaleErr) throw resaleErr;
    const isResale = resaleRow !== null;

    let result: unknown;
    if (kind === "payment.captured") {
      const args = {
        p_event_id: eventId,
        p_rzp_order: rzpOrder,
        p_rzp_payment: String(entity.id ?? ""),
        p_amount: Number(entity.amount ?? -1),
      };
      const { data, error } = isResale
        ? await admin.rpc("apply_resale_captured", args)
        : await admin.rpc("apply_payment_captured", args);
      if (error) throw error;
      result = data;
    } else {
      const args = { p_event_id: eventId, p_rzp_order: rzpOrder };
      const { data, error } = isResale
        ? await admin.rpc("apply_resale_failed", args)
        : await admin.rpc("apply_payment_failed", args);
      if (error) throw error;
      result = data;
    }
    return json({ ok: true, result });
  } catch (e) {
    // 500s make Razorpay retry, which is what we want for transient errors.
    return errorResponse(e);
  }
});
