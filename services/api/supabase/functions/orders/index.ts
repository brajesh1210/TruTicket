// TruTicket orders Edge Function (PHASE2_PLAN §2.6).
//   POST { "action": "create", "reservation_id": "<uuid>" }  (signed-in buyer)
//   -> { ok, order_id, razorpay_order_id, amount, currency, key_id }
// Turns a live seat hold into a Razorpay order. Tickets are issued only by the webhook.
import { adminClient } from "../_shared/db.ts";
import { loadConfig, type Config } from "../_shared/env.ts";
import { ApiError, CORS_HEADERS, errorResponse, json, readJsonObject } from "../_shared/http.ts";
import { assertBuyerCanTransact, authenticateBuyer, type Buyer } from "../_shared/buyer.ts";
import { createRazorpayOrder } from "../_shared/razorpay.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BEGIN_ERRORS: Record<string, [number, string, string]> = {
  NOT_FOUND: [404, "NOT_FOUND", "That hold does not exist."],
  RESERVATION_EXPIRED: [409, "RESERVATION_EXPIRED", "Your hold has expired. Pick your tickets again."],
};

async function createOrder(cfg: Config, buyer: Buyer, body: Record<string, unknown>) {
  const reservationId = typeof body.reservation_id === "string" ? body.reservation_id : "";
  if (!UUID.test(reservationId)) throw new ApiError(400, "INVALID_INPUT", "Missing hold id.");
  if (!cfg.razorpayKeyId || !cfg.razorpayKeySecret) {
    throw new ApiError(500, "CONFIG_MISSING", "Payments are not configured yet.");
  }
  await assertBuyerCanTransact(cfg, buyer.token, buyer.userId);

  const admin = adminClient(cfg);
  const { data, error } = await admin.rpc("begin_order", { p_user: buyer.userId, p_reservation: reservationId });
  if (error) {
    const msg = String(error.message ?? "");
    for (const key of Object.keys(BEGIN_ERRORS)) {
      if (msg.includes(key)) {
        const [status, code, text] = BEGIN_ERRORS[key];
        throw new ApiError(status, code, text);
      }
    }
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new ApiError(500, "ORDER_FAILED", "Could not create the order. Try again.");

  // The order already has a Razorpay order: return it (safe to retry).
  if (row.provider_order_id) {
    return {
      ok: true,
      order_id: row.order_id,
      razorpay_order_id: row.provider_order_id,
      amount: row.total_minor,
      currency: row.currency,
      key_id: cfg.razorpayKeyId,
    };
  }

  const rzp = await createRazorpayOrder(cfg, {
    amountMinor: row.total_minor,
    currency: row.currency,
    receipt: String(row.order_id),
  });
  const { error: recErr } = await admin.rpc("record_provider_order", {
    p_order: row.order_id,
    p_rzp_order: rzp.id,
    p_amount: row.total_minor,
    p_currency: row.currency,
  });
  if (recErr) throw recErr;

  return {
    ok: true,
    order_id: row.order_id,
    razorpay_order_id: rzp.id,
    amount: row.total_minor,
    currency: row.currency,
    key_id: cfg.razorpayKeyId,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST."));
  try {
    const cfg = loadConfig();
    const body = await readJsonObject(req);
    if (body.action !== "create") throw new ApiError(400, "INVALID_ACTION", "Unknown action.");
    const buyer = await authenticateBuyer(cfg, req);
    return json(await createOrder(cfg, buyer, body));
  } catch (e) {
    return errorResponse(e);
  }
});
