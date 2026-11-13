// TruTicket resale Edge Function (PHASE2_PLAN §2.8, PRD §6.5). Signed-in users only.
//   { "action": "listings" }                          -> active listings, each with its price cap
//   { "action": "list", "ticket_id", "ask_minor" }    -> list my ticket, at or below the cap
//   { "action": "cancel", "listing_id" }              -> take my listing down (only while ACTIVE)
//   { "action": "buy", "listing_id" }                 -> hold it and start a Razorpay payment
// Ownership changes only in the webhook (razorpay_webhook -> apply_resale_captured), never here.
import { adminClient } from "../_shared/db.ts";
import { loadConfig, type Config } from "../_shared/env.ts";
import { ApiError, CORS_HEADERS, errorResponse, json, readJsonObject } from "../_shared/http.ts";
import { assertBuyerCanTransact, authenticateBuyer, type Buyer } from "../_shared/buyer.ts";
import { createRazorpayOrder } from "../_shared/razorpay.ts";
import { refuse, resultOf, rowOf, type Outcomes } from "../_shared/outcome.ts";
import { formatInr, maxResalePriceMinor, parseAskMinor } from "../_shared/resale.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOLD_SECONDS = 900; // a buyer has 15 minutes to pay
const CURRENCY = "INR";

const LIST_OUTCOMES: Outcomes = {
  NOT_ALLOWED: [403, "CANNOT_TRANSACT", "Verify your email and sign in again before you sell tickets."],
  NOT_FOUND: [404, "NOT_FOUND", "That ticket does not exist."],
  NOT_YOURS: [403, "NOT_YOURS", "That ticket is not yours."],
  NOT_LISTABLE: [409, "NOT_LISTABLE", "This ticket cannot be listed right now."],
  CUTOFF_PASSED: [409, "CUTOFF_PASSED", "Resale is closed for this event."],
  TRANSFER_LIMIT: [409, "TRANSFER_LIMIT", "This ticket has reached its resale limit."],
  INVALID_PRICE: [400, "INVALID_PRICE", "Enter a price in paise, above zero."],
};

const CANCEL_OUTCOMES: Outcomes = {
  NOT_FOUND: [404, "NOT_FOUND", "That listing does not exist."],
  NOT_YOURS: [403, "NOT_YOURS", "That listing is not yours."],
  NOT_CANCELLABLE: [409, "NOT_CANCELLABLE", "This listing cannot be taken down now. A buyer is paying for it."],
};

const BUY_OUTCOMES: Outcomes = {
  NOT_ALLOWED: [403, "CANNOT_TRANSACT", "Verify your email and sign in again before you buy tickets."],
  NOT_FOUND: [404, "NOT_FOUND", "That listing does not exist."],
  OWN_LISTING: [409, "OWN_LISTING", "You cannot buy your own ticket."],
  PURCHASE_IN_PROGRESS: [409, "PURCHASE_IN_PROGRESS", "Someone is paying for this ticket. Try again in a few minutes."],
  NOT_FOR_SALE: [409, "NOT_FOR_SALE", "This ticket is no longer for sale."],
  CUTOFF_PASSED: [409, "CUTOFF_PASSED", "Resale is closed for this event."],
  TRANSFER_LIMIT: [409, "TRANSFER_LIMIT", "This ticket has reached its resale limit."],
};

function uuidOf(value: unknown, message: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new ApiError(400, "INVALID_INPUT", message);
  return value;
}

async function listings(cfg: Config) {
  // Any signed-in user may browse. Buying needs the full gate.
  const admin = adminClient(cfg);
  const { data, error } = await admin
    .from("resale_listings")
    .select("id, askMinor, tickets(faceValueMinor, events(title, venue, startAt, resaleCapBps))")
    .eq("status", "ACTIVE")
    .order("createdAt", { ascending: true })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, any>>;
  return rows
    .filter((r) => r.tickets && r.tickets.events)
    .map((r) => ({
      listing_id: r.id,
      ask_minor: r.askMinor,
      max_minor: maxResalePriceMinor(r.tickets.faceValueMinor, r.tickets.events.resaleCapBps),
      event_title: r.tickets.events.title,
      venue: r.tickets.events.venue,
      starts_at: r.tickets.events.startAt,
    }));
}

async function listTicket(cfg: Config, buyer: Buyer, body: Record<string, unknown>) {
  const ticketId = uuidOf(body.ticket_id, "Missing ticket id.");
  const ask = parseAskMinor(body.ask_minor);
  if (ask === null) throw new ApiError(400, "INVALID_PRICE", "Enter a price in paise, above zero.");
  await assertBuyerCanTransact(cfg, buyer.token, buyer.userId);

  const admin = adminClient(cfg);
  const { data, error } = await admin.rpc("resale_list", {
    p_seller: buyer.userId,
    p_ticket: ticketId,
    p_ask: ask,
  });
  if (error) throw error;
  const row = rowOf(data);
  const result = resultOf(data);
  if (result === "OVER_CAP") {
    const max = Number(row.out_max_minor);
    throw new ApiError(422, "OVER_CAP", `The highest price allowed is ${formatInr(max)}.`, { max_minor: max });
  }
  if (result !== "OK") throw refuse(result, LIST_OUTCOMES);
  return { ok: true, listing_id: row.out_listing_id, max_minor: Number(row.out_max_minor) };
}

async function cancelListing(cfg: Config, buyer: Buyer, body: Record<string, unknown>) {
  const listingId = uuidOf(body.listing_id, "Missing listing id.");
  await assertBuyerCanTransact(cfg, buyer.token, buyer.userId);
  const admin = adminClient(cfg);
  const { data, error } = await admin.rpc("resale_cancel", { p_seller: buyer.userId, p_listing: listingId });
  if (error) throw error;
  const result = resultOf(data);
  if (result !== "OK") throw refuse(result, CANCEL_OUTCOMES);
  return { ok: true };
}

async function buyListing(cfg: Config, buyer: Buyer, body: Record<string, unknown>) {
  const listingId = uuidOf(body.listing_id, "Missing listing id.");
  if (!cfg.razorpayKeyId || !cfg.razorpayKeySecret) {
    throw new ApiError(500, "CONFIG_MISSING", "Payments are not configured yet.");
  }
  await assertBuyerCanTransact(cfg, buyer.token, buyer.userId);

  const admin = adminClient(cfg);
  const { data, error } = await admin.rpc("resale_begin_purchase", {
    p_buyer: buyer.userId,
    p_listing: listingId,
    p_ttl_seconds: HOLD_SECONDS,
  });
  if (error) throw error;
  const result = resultOf(data);
  if (result !== "OK") throw refuse(result, BUY_OUTCOMES);
  const hold = rowOf(data);
  const paymentId = String(hold.out_payment_id);
  const amount = Number(hold.out_amount_minor);

  const rzp = await createRazorpayOrder(cfg, { amountMinor: amount, currency: CURRENCY, receipt: paymentId });
  const { data: recorded, error: recErr } = await admin.rpc("resale_record_provider_order", {
    p_payment: paymentId,
    p_rzp_order: rzp.id,
  });
  if (recErr) throw recErr;
  if (recorded !== "OK") throw new ApiError(409, "HOLD_EXPIRED", "Your hold expired. Try again.");

  return {
    ok: true,
    payment_id: paymentId,
    razorpay_order_id: rzp.id,
    amount,
    currency: CURRENCY,
    key_id: cfg.razorpayKeyId,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST."));
  try {
    const cfg = loadConfig();
    const body = await readJsonObject(req);
    const buyer = await authenticateBuyer(cfg, req);

    if (body.action === "listings") return json({ ok: true, listings: await listings(cfg) });
    if (body.action === "list") return json(await listTicket(cfg, buyer, body));
    if (body.action === "cancel") return json(await cancelListing(cfg, buyer, body));
    if (body.action === "buy") return json(await buyListing(cfg, buyer, body));
    throw new ApiError(400, "INVALID_ACTION", "Unknown action.");
  } catch (e) {
    return errorResponse(e);
  }
});
