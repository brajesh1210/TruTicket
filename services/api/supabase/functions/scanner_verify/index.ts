// TruTicket gate scan Edge Function (PHASE2_PLAN §2.7). Replaces the old placeholder at functions/scanner/verify.
//   POST { "token": "<QR>", "event_id": "<uuid>", "scanner_id"?: "<uuid>", "idempotency_key": "<8-100 chars, new per scan>" }
//   scanner_id is optional: if missing, the event's first active scanner is used.
//   -> { ok: true, result: "VALID" | "ALREADY_USED" | "EXPIRED" | "WRONG_EVENT" | "INVALID" }
// Caller must be signed in, pass the full gate, and be the organiser of event_id.
import { adminClient } from "../_shared/db.ts";
import { loadConfig, type Config } from "../_shared/env.ts";
import { ApiError, CORS_HEADERS, errorResponse, json, readJsonObject } from "../_shared/http.ts";
import { assertBuyerCanTransact, authenticateBuyer, type Buyer } from "../_shared/buyer.ts";
import { checkQr } from "../_shared/qr.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertOrganiserOf(cfg: Config, buyer: Buyer, eventId: string): Promise<void> {
  const admin = adminClient(cfg);
  const { data: org, error: oErr } = await admin.from("organizers").select("id").eq("userId", buyer.userId).limit(1);
  if (oErr) throw oErr;
  if (!org || org.length === 0) throw new ApiError(403, "NOT_ORGANISER", "Only the organiser can scan tickets for this event.");
  const { data: ev, error: eErr } = await admin.from("events").select("id").eq("id", eventId).eq("organizerId", org[0].id).limit(1);
  if (eErr) throw eErr;
  if (!ev || ev.length === 0) throw new ApiError(403, "NOT_ORGANISER", "Only the organiser can scan tickets for this event.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST."));
  try {
    const cfg = loadConfig();
    const body = await readJsonObject(req);
    const eventId = typeof body.event_id === "string" ? body.event_id : "";
    let scannerId = typeof body.scanner_id === "string" ? body.scanner_id : "";
    const key = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
    const token = typeof body.token === "string" ? body.token : "";
    if (!UUID.test(eventId)) throw new ApiError(400, "INVALID_INPUT", "Missing event id.");
    if (scannerId && !UUID.test(scannerId)) throw new ApiError(400, "INVALID_INPUT", "Bad scanner id.");
    if (key.length < 8 || key.length > 100) throw new ApiError(400, "INVALID_INPUT", "Missing scan key.");

    const buyer = await authenticateBuyer(cfg, req);
    await assertBuyerCanTransact(cfg, buyer.token, buyer.userId);
    await assertOrganiserOf(cfg, buyer, eventId);
    if (!cfg.qrHmacKey) throw new ApiError(500, "CONFIG_MISSING", "Tickets are not configured yet.");
    if (!scannerId) {
      // No scanner named: use the event's first active scanner (the demo gate device).
      const { data: sc, error: scErr } = await adminClient(cfg).from("scanners").select("id").eq("eventId", eventId).eq("status", "active").limit(1);
      if (scErr) throw scErr;
      if (!sc || sc.length === 0) throw new ApiError(403, "SCANNER_NOT_FOUND", "That scanner is not active for this event.");
      scannerId = sc[0].id as string;
    }

    // A bad or forged QR never reaches the database.
    const check = await checkQr(cfg.qrHmacKey, token);
    if (!check.ok) return json({ ok: true, result: "INVALID" });

    const { data, error } = await adminClient(cfg).rpc("scan_ticket", {
      p_ticket: check.ticketId,
      p_event: eventId,
      p_scanner: scannerId,
      p_key: key,
      p_nonce_hash: check.nonceHash,
    });
    if (error) {
      const msg = String(error.message ?? "");
      if (msg.includes("SCANNER_NOT_FOUND")) throw new ApiError(403, "SCANNER_NOT_FOUND", "That scanner is not active for this event.");
      if (msg.includes("KEY_REUSED")) throw new ApiError(409, "KEY_REUSED", "This scan key was used for another ticket.");
      throw error;
    }
    // Phase 3: mark the NFT redeemed on chain. Best effort: the DB result is the gate truth,
    // a failed chain call never changes the scan result. n8n reconciles the rest later.
    if (data === "VALID") await redeemOnChainBestEffort(check.ticketId);
    return json({ ok: true, result: data });
  } catch (e) {
    return errorResponse(e);
  }
});

async function redeemOnChainBestEffort(ticketId: string): Promise<void> {
  const url = Deno.env.get("CHAIN_FUNCTION_URL") ?? "";
  const secret = Deno.env.get("CHAIN_INTERNAL_SECRET") ?? "";
  if (!url || !secret) return; // chain not configured yet (e.g. before Amoy deploy)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ action: "redeem", ticket_id: ticketId }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("chain redeem failed", res.status);
  } catch (e) {
    console.error("chain redeem error", e instanceof Error ? e.name : "unknown");
  }
}
