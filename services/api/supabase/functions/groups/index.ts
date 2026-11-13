// TruTicket group tickets Edge Function (PHASE2_PLAN §2.8, PRD §6.6 / FR-027). Signed-in users only.
//   { "action": "mine" }                                       -> invites I sent
//   { "action": "allocate", "ticket_id", "invitee_email" }     -> invite a verified member by email
//   { "action": "claim", "claim_code" }                        -> I accept an invite (once)
//   { "action": "revoke", "group_ticket_id" }                  -> cancel an invite nobody has claimed
//   { "action": "keep", "ticket_id" }                          -> keep one bucket ticket for myself
// The claim code is emailed to the invitee and stored only as a hash. Demo mode also returns it
// in the response so the dev test can claim without a mailbox.
import { adminClient } from "../_shared/db.ts";
import { loadConfig, type Config } from "../_shared/env.ts";
import { ApiError, CORS_HEADERS, errorResponse, json, readJsonObject } from "../_shared/http.ts";
import { assertBuyerCanTransact, authenticateBuyer, type Buyer } from "../_shared/buyer.ts";
import { sendSecurityEmail } from "../_shared/email.ts";
import { refuse, resultOf, rowOf, type Outcomes } from "../_shared/outcome.ts";
import { claimCodeHash, INVITE_TTL_HOURS, isClaimCodeShape, newClaimCode } from "../_shared/group.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOCATE_OUTCOMES: Outcomes = {
  NOT_ALLOWED: [403, "CANNOT_TRANSACT", "Verify your email and sign in again first."],
  INVALID_EMAIL: [400, "INVALID_EMAIL", "Enter a valid email address."],
  NOT_FOUND: [404, "NOT_FOUND", "That ticket does not exist."],
  NOT_YOURS: [403, "NOT_YOURS", "That ticket is not yours."],
  NOT_GROUP_TICKET: [409, "NOT_GROUP_TICKET", "Only group tickets can be shared with a team."],
  NOT_IN_BUCKET: [409, "NOT_IN_BUCKET", "This ticket is already assigned."],
  SELF_INVITE: [409, "SELF_INVITE", "You cannot invite yourself. Keep the ticket instead."],
  ALREADY_INVITED: [409, "ALREADY_INVITED", "This ticket already has an open invite."],
  NO_ORDER: [409, "NO_ORDER", "This ticket has no order."],
};

const CLAIM_OUTCOMES: Outcomes = {
  NOT_ALLOWED: [403, "CANNOT_TRANSACT", "Verify your email and sign in again first."],
  NOT_FOUND: [404, "CODE_INVALID", "This code is not valid."],
  ALREADY_CLAIMED: [409, "ALREADY_CLAIMED", "This invite was already accepted."],
  REVOKED: [409, "REVOKED", "This invite was cancelled by the manager."],
  EXPIRED: [410, "EXPIRED", "This invite has expired. Ask the manager to send a new one."],
  WRONG_ACCOUNT: [403, "WRONG_ACCOUNT", "Sign in with the email address that was invited."],
  NOT_IN_BUCKET: [409, "NOT_IN_BUCKET", "This ticket can no longer be assigned."],
};

const REVOKE_OUTCOMES: Outcomes = {
  NOT_FOUND: [404, "NOT_FOUND", "That invite does not exist."],
  NOT_YOURS: [403, "NOT_YOURS", "That invite is not yours."],
  NOT_REVOCABLE: [409, "NOT_REVOCABLE", "This invite was already accepted."],
};

const KEEP_OUTCOMES: Outcomes = {
  NOT_ALLOWED: [403, "CANNOT_TRANSACT", "Verify your email and sign in again first."],
  NOT_FOUND: [404, "NOT_FOUND", "That ticket does not exist."],
  NOT_YOURS: [403, "NOT_YOURS", "That ticket is not yours."],
  NOT_GROUP_TICKET: [409, "NOT_GROUP_TICKET", "Only group tickets can be kept this way."],
  NOT_IN_BUCKET: [409, "NOT_IN_BUCKET", "This ticket is already assigned."],
  ALREADY_INVITED: [409, "ALREADY_INVITED", "This ticket has an open invite. Revoke it first."],
  ALREADY_KEPT: [409, "ALREADY_KEPT", "You already keep one group ticket for yourself."],
};

function uuidOf(value: unknown, message: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new ApiError(400, "INVALID_INPUT", message);
  return value;
}

function emailOf(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < 3 || text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new ApiError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }
  return text;
}

async function mine(cfg: Config, buyer: Buyer) {
  const admin = adminClient(cfg);
  const { data, error } = await admin
    .from("group_tickets")
    .select("id, status, inviteExpiresAt, ticketId, inviteeEmailKey")
    .eq("managerId", buyer.userId)
    .order("createdAt", { ascending: false })
    .limit(200);
  if (error) throw error;
  return { ok: true, invites: data ?? [] };
}

async function allocate(cfg: Config, buyer: Buyer, body: Record<string, unknown>) {
  const ticketId = uuidOf(body.ticket_id, "Missing ticket id.");
  const invitee = emailOf(body.invitee_email);
  await assertBuyerCanTransact(cfg, buyer.token, buyer.userId);

  const code = newClaimCode();
  const admin = adminClient(cfg);
  const { data, error } = await admin.rpc("group_allocate", {
    p_manager: buyer.userId,
    p_ticket: ticketId,
    p_invitee: invitee,
    p_token_hash: await claimCodeHash(code),
    p_ttl_hours: INVITE_TTL_HOURS,
  });
  if (error) throw error;
  const result = resultOf(data);
  if (result !== "OK") throw refuse(result, ALLOCATE_OUTCOMES);
  const groupId = String(rowOf(data).out_group_id);

  // The code goes to the invitee only. If the email fails, the invite is cancelled, so nothing is left half done.
  try {
    await sendSecurityEmail(
      cfg,
      invitee,
      "You have a TruTicket group ticket",
      `A team manager has shared a TruTicket ticket with you.\n\n` +
        `Open TruTicket, sign in with this email address, and enter this claim code:\n\n${code}\n\n` +
        `The code works once and expires in ${INVITE_TTL_HOURS / 24} days. ` +
        `If you did not expect this, ignore this email.`,
    );
  } catch (e) {
    console.error("group invite email failed", e);
    await admin.rpc("group_revoke", { p_manager: buyer.userId, p_group: groupId });
    throw new ApiError(502, "EMAIL_FAILED", "The invite email could not be sent. Try again.");
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000).toISOString();
  const response: Record<string, unknown> = { ok: true, group_ticket_id: groupId, invite_expires_at: expiresAt };
  if (cfg.demoMode) response.dev_claim_code = code; // demo mode only, for the dev test
  return response;
}

async function claim(cfg: Config, buyer: Buyer, body: Record<string, unknown>) {
  const code = typeof body.claim_code === "string" ? body.claim_code.trim() : "";
  if (!isClaimCodeShape(code)) throw new ApiError(400, "CODE_INVALID", "This code is not valid.");
  await assertBuyerCanTransact(cfg, buyer.token, buyer.userId);

  const admin = adminClient(cfg);
  const { data, error } = await admin.rpc("group_claim", {
    p_user: buyer.userId,
    p_token_hash: await claimCodeHash(code),
  });
  if (error) throw error;
  const result = resultOf(data);
  if (result !== "CLAIMED") throw refuse(result, CLAIM_OUTCOMES);
  const row = rowOf(data);
  return { ok: true, ticket_id: row.out_ticket_id, group_ticket_id: row.out_group_id };
}

async function revoke(cfg: Config, buyer: Buyer, body: Record<string, unknown>) {
  const groupId = uuidOf(body.group_ticket_id, "Missing invite id.");
  await assertBuyerCanTransact(cfg, buyer.token, buyer.userId);
  const admin = adminClient(cfg);
  const { data, error } = await admin.rpc("group_revoke", { p_manager: buyer.userId, p_group: groupId });
  if (error) throw error;
  const result = resultOf(data);
  if (result !== "OK") throw refuse(result, REVOKE_OUTCOMES);
  return { ok: true };
}

async function keep(cfg: Config, buyer: Buyer, body: Record<string, unknown>) {
  const ticketId = uuidOf(body.ticket_id, "Missing ticket id.");
  await assertBuyerCanTransact(cfg, buyer.token, buyer.userId);
  const admin = adminClient(cfg);
  const { data, error } = await admin.rpc("group_keep_for_self", { p_manager: buyer.userId, p_ticket: ticketId });
  if (error) throw error;
  const result = resultOf(data);
  if (result !== "OK") throw refuse(result, KEEP_OUTCOMES);
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST."));
  try {
    const cfg = loadConfig();
    const body = await readJsonObject(req);
    const buyer = await authenticateBuyer(cfg, req);

    if (body.action === "mine") return json(await mine(cfg, buyer));
    if (body.action === "allocate") return json(await allocate(cfg, buyer, body));
    if (body.action === "claim") return json(await claim(cfg, buyer, body));
    if (body.action === "revoke") return json(await revoke(cfg, buyer, body));
    if (body.action === "keep") return json(await keep(cfg, buyer, body));
    throw new ApiError(400, "INVALID_ACTION", "Unknown action.");
  } catch (e) {
    return errorResponse(e);
  }
});
