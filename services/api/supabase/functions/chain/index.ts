// TruTicket chain Edge Function (PHASE2_PLAN Phase 3, PRD §6.4 / FR-018 to FR-022).
// Internal only: called by n8n with the x-internal-secret header. Never by the app.
//
//   POST { "action": "setup_event", "event_id" }                 -> set the on-chain resale policy
//   POST { "action": "mint",        "ticket_id" }               -> mint the NFT to the buyer's custodial wallet
//   POST { "action": "list",        "ticket_id", "ask_minor" }  -> list on-chain (cap enforced there)
//   POST { "action": "cancel",      "ticket_id" }               -> cancel the on-chain listing
//   POST { "action": "settle",      "ticket_id", "buyer_user_id" }    -> resale transfer on-chain
//   POST { "action": "allocate",    "ticket_id", "member_user_id" }   -> group zero-price transfer on-chain
//   POST { "action": "redeem",      "ticket_id" }               -> mark redeemed on-chain (gate VALID)
//
// Every write is idempotent: a repeat returns the existing result. A mint claims the ticket row first,
// so two parallel retries cannot mint two tokens. Chain errors return 502 and never change DB ownership.
import { createPublicClient, createWalletClient, http, parseEventLogs, type Address, type Hex } from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { polygonAmoy } from "npm:viem@2.21.0/chains";
import { adminClient } from "../_shared/db.ts";
import { loadConfig, type Config } from "../_shared/env.ts";
import { ApiError, CORS_HEADERS, errorResponse, json, readJsonObject } from "../_shared/http.ts";
import { custodyAddress, eventKeyFor, faceValueArg, policyArgs } from "../_shared/chain.ts";
import { TRUTICKET_ABI } from "../_shared/truticket_abi.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PENDING = "pending";

function env(name: string): string {
  const v = Deno.env.get(name) ?? "";
  if (!v) throw new ApiError(500, "CONFIG_MISSING", `${name} is not set.`);
  return v;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function requireInternal(req: Request): void {
  const expected = env("CHAIN_INTERNAL_SECRET");
  if (expected.length < 32) throw new ApiError(500, "CONFIG_WEAK", "CHAIN_INTERNAL_SECRET is too short.");
  const got = req.headers.get("x-internal-secret") ?? "";
  if (!timingSafeEqual(got, expected)) throw new ApiError(401, "UNAUTHORISED", "Internal call only.");
}

type Chain = {
  address: Address;
  operator: ReturnType<typeof privateKeyToAccount>;
  pub: ReturnType<typeof createPublicClient>;
  wallet: ReturnType<typeof createWalletClient>;
  masterSecret: string;
};

function chainFromEnv(): Chain {
  const rpc = Deno.env.get("CHAIN_RPC_URL") || "https://polygon-amoy.drpc.org";
  const operator = privateKeyToAccount(env("CHAIN_OPERATOR_KEY") as Hex);
  const address = env("CHAIN_CONTRACT_ADDRESS") as Address;
  const masterSecret = env("CHAIN_MASTER_SECRET");
  if (masterSecret.length < 32) throw new ApiError(500, "CONFIG_WEAK", "CHAIN_MASTER_SECRET is too short.");
  const transport = http(rpc);
  return {
    address,
    operator,
    pub: createPublicClient({ chain: polygonAmoy, transport }),
    wallet: createWalletClient({ account: operator, chain: polygonAmoy, transport }),
    masterSecret,
  };
}

async function writeTx(c: Chain, functionName: string, args: readonly unknown[]): Promise<Hex> {
  // deno-lint-ignore no-explicit-any
  const hash = await c.wallet.writeContract({ address: c.address, abi: TRUTICKET_ABI, functionName, args: args as any, chain: polygonAmoy, account: c.operator } as any);
  const receipt = await c.pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new ApiError(502, "CHAIN_REVERTED", `${functionName} reverted on chain.`);
  return hash;
}

async function chainError(e: unknown): Promise<never> {
  if (e instanceof ApiError) throw e;
  const msg = e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "unknown";
  throw new ApiError(502, "CHAIN_ERROR", `Chain call failed: ${msg}`);
}

async function loadTicket(cfg: Config, id: string) {
  const { data, error } = await adminClient(cfg)
    .from("tickets")
    .select('id, "eventId", "currentOwnerId", "faceValueMinor", "tokenId", status')
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) throw new ApiError(404, "NOT_FOUND", "Ticket not found.");
  return data[0] as { id: string; eventId: string; currentOwnerId: string; faceValueMinor: number; tokenId: string | null; status: string };
}

async function loadEvent(cfg: Config, id: string) {
  const { data, error } = await adminClient(cfg)
    .from("events")
    .select('id, "resaleCapBps", "resaleTransferLimit", "resaleCutoffAt", "startAt"')
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) throw new ApiError(404, "NOT_FOUND", "Event not found.");
  return data[0] as { id: string; resaleCapBps: number; resaleTransferLimit: number; resaleCutoffAt: string | null; startAt: string };
}

async function setupEvent(cfg: Config, c: Chain, eventId: string): Promise<Hex> {
  const ev = await loadEvent(cfg, eventId);
  const p = policyArgs({
    resaleCapBps: ev.resaleCapBps,
    resaleTransferLimit: ev.resaleTransferLimit,
    resaleCutoffAt: ev.resaleCutoffAt,
    startAt: ev.startAt,
  });
  const hash = await writeTx(c, "setPolicy", [eventKeyFor(eventId), p.capBps, p.transferLimit, p.cutoff]);
  const { error } = await adminClient(cfg).from("events").update({ contractAddress: c.address, chainId: polygonAmoy.id }).eq("id", eventId);
  if (error) throw error;
  return hash;
}

async function audit(cfg: Config, action: string, ticketId: string, outcome: string): Promise<void> {
  const { error } = await adminClient(cfg).from("audit_logs").insert({
    actorId: null,
    action: `CHAIN_${action.toUpperCase()}`,
    objectType: "tickets",
    objectId: ticketId,
    outcome: outcome.slice(0, 200),
  });
  if (error) throw error;
}

function requireMinted(t: { tokenId: string | null }): bigint {
  if (!t.tokenId || t.tokenId === PENDING) throw new ApiError(409, "NOT_MINTED", "Ticket is not on chain yet.");
  return BigInt(t.tokenId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST."));
  try {
    requireInternal(req);
    const cfg = loadConfig();
    const body = await readJsonObject(req);
    const action = typeof body.action === "string" ? body.action : "";
    const c = chainFromEnv();

    if (action === "setup_event") {
      const eventId = typeof body.event_id === "string" ? body.event_id : "";
      if (!UUID.test(eventId)) throw new ApiError(400, "INVALID_INPUT", "Missing event id.");
      let hash: Hex;
      try { hash = await setupEvent(cfg, c, eventId); } catch (e) { return await chainError(e); }
      return json({ ok: true, action, tx_hash: hash, contract: c.address });
    }

    const ticketId = typeof body.ticket_id === "string" ? body.ticket_id : "";
    if (!UUID.test(ticketId)) throw new ApiError(400, "INVALID_INPUT", "Missing ticket id.");
    const ticket = await loadTicket(cfg, ticketId);

    if (action === "mint") {
      if (ticket.tokenId && ticket.tokenId !== PENDING) {
        return json({ ok: true, action, token_id: ticket.tokenId, already: true });
      }
      // Claim the row first: only one caller can move tokenId from null to pending.
      const { data: claimed, error: cErr } = await adminClient(cfg)
        .from("tickets").update({ tokenId: PENDING }).eq("id", ticketId).is("tokenId", null).select("id");
      if (cErr) throw cErr;
      if (!claimed || claimed.length === 0) throw new ApiError(409, "IN_PROGRESS", "Mint already in progress.");
      try {
        await setupEvent(cfg, c, ticket.eventId);
        const owner = await custodyAddress(c.masterSecret, ticket.currentOwnerId);
        const hash = await writeTx(c, "mintTicket", [owner, eventKeyFor(ticket.eventId), faceValueArg(ticket.faceValueMinor)]);
        const receipt = await c.pub.getTransactionReceipt({ hash });
        const logs = parseEventLogs({ abi: TRUTICKET_ABI, logs: receipt.logs, eventName: "TicketMinted" });
        if (logs.length !== 1) throw new ApiError(502, "CHAIN_ERROR", "Mint receipt has no TicketMinted event.");
        const tokenId = logs[0].args.tokenId.toString();
        const { error } = await adminClient(cfg).from("tickets").update({ tokenId }).eq("id", ticketId);
        if (error) throw error;
        await audit(cfg, action, ticketId, `token ${tokenId} tx ${hash}`);
        return json({ ok: true, action, token_id: tokenId, tx_hash: hash });
      } catch (e) {
        await adminClient(cfg).from("tickets").update({ tokenId: null }).eq("id", ticketId).eq("tokenId", PENDING);
        return await chainError(e);
      }
    }

    if (action === "list") {
      const ask = typeof body.ask_minor === "number" ? body.ask_minor : NaN;
      if (!Number.isInteger(ask) || ask <= 0) throw new ApiError(400, "INVALID_INPUT", "Bad ask price.");
      const tokenId = requireMinted(ticket);
      try {
        const hash = await writeTx(c, "listForResaleFor", [tokenId, BigInt(ask)]);
        await audit(cfg, action, ticketId, `token ${tokenId} ask ${ask} tx ${hash}`);
        return json({ ok: true, action, token_id: tokenId.toString(), tx_hash: hash });
      } catch (e) {
        return await chainError(e);
      }
    }

    if (action === "cancel") {
      const tokenId = requireMinted(ticket);
      const listing = await c.pub.readContract({ address: c.address, abi: TRUTICKET_ABI, functionName: "listings", args: [tokenId] });
      if (!listing[3]) return json({ ok: true, action, token_id: tokenId.toString(), already: true });
      try {
        const hash = await writeTx(c, "cancelListing", [tokenId]);
        await audit(cfg, action, ticketId, `token ${tokenId} tx ${hash}`);
        return json({ ok: true, action, token_id: tokenId.toString(), tx_hash: hash });
      } catch (e) {
        return await chainError(e);
      }
    }

    if (action === "settle") {
      const buyer = typeof body.buyer_user_id === "string" ? body.buyer_user_id : "";
      if (!UUID.test(buyer)) throw new ApiError(400, "INVALID_INPUT", "Missing buyer id.");
      const tokenId = requireMinted(ticket);
      const buyerAddr = await custodyAddress(c.masterSecret, buyer);
      const listing = await c.pub.readContract({ address: c.address, abi: TRUTICKET_ABI, functionName: "listings", args: [tokenId] });
      if (!listing[3]) {
        const owner = await c.pub.readContract({ address: c.address, abi: TRUTICKET_ABI, functionName: "ownerOf", args: [tokenId] });
        if (owner.toLowerCase() === buyerAddr.toLowerCase()) return json({ ok: true, action, token_id: tokenId.toString(), already: true });
        throw new ApiError(409, "NOT_LISTED", "No active on-chain listing for this ticket.");
      }
      try {
        const hash = await writeTx(c, "settleResale", [tokenId, buyerAddr]);
        await audit(cfg, action, ticketId, `token ${tokenId} to ${buyerAddr} tx ${hash}`);
        return json({ ok: true, action, token_id: tokenId.toString(), tx_hash: hash });
      } catch (e) {
        return await chainError(e);
      }
    }

    if (action === "allocate") {
      const member = typeof body.member_user_id === "string" ? body.member_user_id : "";
      if (!UUID.test(member)) throw new ApiError(400, "INVALID_INPUT", "Missing member id.");
      const tokenId = requireMinted(ticket);
      const memberAddr = await custodyAddress(c.masterSecret, member);
      const owner = await c.pub.readContract({ address: c.address, abi: TRUTICKET_ABI, functionName: "ownerOf", args: [tokenId] });
      if (owner.toLowerCase() === memberAddr.toLowerCase()) return json({ ok: true, action, token_id: tokenId.toString(), already: true });
      try {
        const hash = await writeTx(c, "allocate", [tokenId, memberAddr]);
        await audit(cfg, action, ticketId, `token ${tokenId} to ${memberAddr} tx ${hash}`);
        return json({ ok: true, action, token_id: tokenId.toString(), tx_hash: hash });
      } catch (e) {
        return await chainError(e);
      }
    }

    if (action === "redeem") {
      const tokenId = requireMinted(ticket);
      const t = await c.pub.readContract({ address: c.address, abi: TRUTICKET_ABI, functionName: "tickets", args: [tokenId] });
      if (t[3]) return json({ ok: true, action, token_id: tokenId.toString(), already: true });
      try {
        const hash = await writeTx(c, "redeem", [tokenId]);
        await audit(cfg, action, ticketId, `token ${tokenId} tx ${hash}`);
        return json({ ok: true, action, token_id: tokenId.toString(), tx_hash: hash });
      } catch (e) {
        return await chainError(e);
      }
    }

    throw new ApiError(400, "INVALID_ACTION", "Unknown action.");
  } catch (e) {
    return errorResponse(e);
  }
});
