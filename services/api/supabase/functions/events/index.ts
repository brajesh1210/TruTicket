// TruTicket events Edge Function (PHASE2_PLAN §2.5). Public reads, organiser create (draft only),
// and inventory reservation for a signed-in buyer.
//
// POST body (JSON):
//   { "action": "list" }                                  -> published events with ticket types and seats left
//   { "action": "get", "event_id" }                       -> one published event, same shape
//   { "action": "create", "title", "venue", "starts_at", "ends_at", "description"?, "categories"? }
//                                                         -> organiser only, creates a DRAFT (admin approves later)
//   { "action": "reserve", "ticket_type_id", "quantity" } -> signed-in buyer, holds seats for 10 minutes
//
// Auth: list and get need no sign-in. create and reserve need a valid sign-in whose session is still active.
import { adminClient } from "../_shared/db.ts";
import { loadConfig, type Config } from "../_shared/env.ts";
import { ApiError, CORS_HEADERS, errorResponse, json, readJsonObject } from "../_shared/http.ts";
import { AUTH_INVALID_MESSAGE, authErrorFor } from "../_shared/auth_errors.ts";
import { sessionIdFromAccessToken } from "../_shared/session_token.ts";

type Admin = ReturnType<typeof adminClient>;
const RESERVE_SECONDS = 600;
const MAX_QTY = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Caller {
  userId: string;
}

// ---------- who is calling ----------

async function authenticate(cfg: Config, req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "AUTH_INVALID", AUTH_INVALID_MESSAGE);

  const admin = adminClient(cfg);
  const { data, error } = await admin.auth.getUser(token);
  if (error) throw authErrorFor(error);
  if (!data.user) throw new ApiError(401, "AUTH_INVALID", AUTH_INVALID_MESSAGE);

  const sessionId = sessionIdFromAccessToken(token);
  if (!sessionId) throw new ApiError(401, "AUTH_INVALID", AUTH_INVALID_MESSAGE);
  const { data: active, error: activeError } = await admin.rpc("session_is_active", {
    p_session: sessionId,
    p_user: data.user.id,
  });
  if (activeError) throw activeError;
  if (active !== true) throw new ApiError(401, "SESSION_REVOKED", "This sign-in has ended. Sign in again.");
  return { userId: data.user.id };
}

/** Buyer check: active profile with at least one verified email. Fails closed. */
async function assertBuyerCanTransact(admin: Admin, userId: string) {
  const { data: profile, error: pErr } = await admin.from("profiles").select("status").eq("id", userId).limit(1);
  if (pErr) throw pErr;
  if (!profile || profile.length === 0 || profile[0].status !== "active") {
    throw new ApiError(403, "ACCOUNT_BLOCKED", "This account cannot buy tickets.");
  }
  const { data: emails, error: eErr } = await admin
    .from("user_emails")
    .select("id")
    .eq("user_id", userId)
    .not("verified_at", "is", null)
    .limit(1);
  if (eErr) throw eErr;
  if (!emails || emails.length === 0) {
    throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email before you buy tickets.");
  }
}

// ---------- reads ----------

async function eventsWithSeats(admin: Admin, onlyId?: string) {
  let q = admin
    .from("events")
    .select("id, title, description, venue, \"startAt\", \"endAt\", categories, \"coverImageUrl\", status")
    .eq("status", "published")
    .order("startAt", { ascending: true });
  if (onlyId) q = q.eq("id", onlyId);
  const { data: events, error } = await q;
  if (error) throw error;
  if (!events || events.length === 0) return [];

  const ids = events.map((e) => e.id);
  const { data: types, error: tErr } = await admin
    .from("ticket_types")
    .select("id, \"eventId\", name, \"faceValueMinor\", currency, quantity, \"saleStart\", \"saleEnd\", \"perAccountLimit\"")
    .in("eventId", ids)
    .order("faceValueMinor", { ascending: true });
  if (tErr) throw tErr;

  const out = [];
  for (const e of events) {
    const mine = (types ?? []).filter((t) => t.eventId === e.id);
    const ticketTypes = [];
    for (const t of mine) {
      const { data: left, error: lErr } = await admin.rpc("available_inventory", { p_ticket_type: t.id });
      if (lErr) throw lErr;
      ticketTypes.push({ ...t, seatsLeft: typeof left === "number" ? left : 0 });
    }
    out.push({ ...e, ticketTypes });
  }
  return out;
}

// ---------- organiser create ----------

async function createEvent(cfg: Config, caller: Caller, body: Record<string, unknown>) {
  const admin = adminClient(cfg);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";
  const startsAt = typeof body.starts_at === "string" ? new Date(body.starts_at) : null;
  const endsAt = typeof body.ends_at === "string" ? new Date(body.ends_at) : null;
  if (!title || title.length > 120) throw new ApiError(400, "INVALID_INPUT", "Enter a title (up to 120 characters).");
  if (!venue || venue.length > 200) throw new ApiError(400, "INVALID_INPUT", "Enter a venue.");
  if (!startsAt || isNaN(startsAt.getTime()) || !endsAt || isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new ApiError(400, "INVALID_INPUT", "Enter a start time and an end time after it.");
  }
  const description = typeof body.description === "string" ? body.description.slice(0, 2000) : null;
  const categories = Array.isArray(body.categories)
    ? body.categories.filter((c): c is string => typeof c === "string").slice(0, 10)
    : [];

  const { data: org, error: oErr } = await admin
    .from("organizers")
    .select("id, verificationStatus")
    .eq("userId", caller.userId)
    .limit(1);
  if (oErr) throw oErr;
  if (!org || org.length === 0 || org[0].verificationStatus !== "verified") {
    throw new ApiError(403, "ORGANISER_NOT_VERIFIED", "Your organiser account is not verified yet.");
  }

  // Always a draft. An admin moves it to published.
  const { data: row, error: iErr } = await admin
    .from("events")
    .insert({
      "organizerId": org[0].id,
      title,
      description,
      venue,
      "startAt": startsAt.toISOString(),
      "endAt": endsAt.toISOString(),
      categories,
      status: "draft",
    })
    .select("id, status")
    .single();
  if (iErr) throw iErr;
  return { ok: true, event_id: row.id, status: row.status };
}

// ---------- reserve ----------

async function reserve(cfg: Config, caller: Caller, body: Record<string, unknown>) {
  const typeId = typeof body.ticket_type_id === "string" ? body.ticket_type_id : "";
  const qty = typeof body.quantity === "number" ? body.quantity : NaN;
  if (!UUID.test(typeId)) throw new ApiError(400, "INVALID_INPUT", "Pick a ticket type.");
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
    throw new ApiError(400, "INVALID_INPUT", `Pick between 1 and ${MAX_QTY} tickets.`);
  }
  const admin = adminClient(cfg);
  await assertBuyerCanTransact(admin, caller.userId);

  const { data, error } = await admin.rpc("reserve_inventory", {
    p_user: caller.userId,
    p_ticket_type: typeId,
    p_qty: qty,
    p_ttl_seconds: RESERVE_SECONDS,
  });
  if (error) {
    const msg = String(error.message ?? "");
    const map: Record<string, [number, string, string]> = {
      SOLD_OUT: [409, "SOLD_OUT", "Sold out for this ticket type."],
      NOT_ON_SALE: [409, "NOT_ON_SALE", "Sales are not open for this ticket type."],
      EVENT_NOT_PUBLISHED: [409, "EVENT_NOT_PUBLISHED", "This event is not on sale."],
      LIMIT_REACHED: [409, "LIMIT_REACHED", "You already hold the maximum tickets for this event."],
      NOT_FOUND: [404, "NOT_FOUND", "That ticket type does not exist."],
      INVALID_QUANTITY: [400, "INVALID_INPUT", "Pick a valid number of tickets."],
    };
    for (const key of Object.keys(map)) {
      if (msg.includes(key)) {
        const [status, code, text] = map[key];
        throw new ApiError(status, code, text);
      }
    }
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new ApiError(500, "RESERVE_FAILED", "Could not hold the tickets. Try again.");
  return { ok: true, reservation_id: row.reservation_id, expires_at: row.expires_at, quantity: qty };
}

// ---------- router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST."));

  try {
    const cfg = loadConfig();
    const body = await readJsonObject(req);
    switch (body.action) {
      case "list":
        return json({ ok: true, events: await eventsWithSeats(adminClient(cfg)) });
      case "get": {
        const id = typeof body.event_id === "string" ? body.event_id : "";
        if (!UUID.test(id)) throw new ApiError(400, "INVALID_INPUT", "Missing event id.");
        const found = await eventsWithSeats(adminClient(cfg), id);
        if (found.length === 0) throw new ApiError(404, "NOT_FOUND", "Event not found.");
        return json({ ok: true, event: found[0] });
      }
      case "create":
        return json(await createEvent(cfg, await authenticate(cfg, req), body));
      case "reserve":
        return json(await reserve(cfg, await authenticate(cfg, req), body));
      default:
        throw new ApiError(400, "INVALID_ACTION", "Unknown action.");
    }
  } catch (e) {
    return errorResponse(e);
  }
});
