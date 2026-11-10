/**
 * Gate scan logic (mock, PRD section 6.4 and screens 23–26).
 * The server does the real checks in Phase 2: signature, nonce, and an atomic redeem.
 * Here the redeemed set lives in memory, so it resets when the app reloads.
 */
import { getEvent } from "./events";
import { getTicket } from "./tickets";

export const GATE_EVENT_ID = "evt-coldplay"; // the event this demo gate admits for
export const QR_WINDOW_SECONDS = 10;
const SKEW_SECONDS = 2; // allowed clock difference between phone and gate

export type ScanStatus =
  | "VALID"
  | "ALREADY USED"
  | "EXPIRED"
  | "REVOKED"
  | "INVALID"
  | "WRONG EVENT"
  | "OFFLINE-UNVERIFIED";

export type ScanResult = {
  status: ScanStatus;
  ticketId: string | null; // ticket ref only. No holder name, so no attendee PII is stored.
  detail: string;
  atSec: number;
};

const redeemed = new Set<string>();
let activity: ScanResult[] = [];

/** Builds a QR-style payload for the demo buttons. windowOffset > 0 makes it stale. */
export function mockPayload(ticketId: string, nowSec: number, windowOffset = 0): string {
  return `TT|${ticketId}|${Math.floor(nowSec / QR_WINDOW_SECONDS) - windowOffset}`;
}

function record(status: ScanStatus, ticketId: string | null, detail: string, atSec: number): ScanResult {
  const r: ScanResult = { status, ticketId, detail, atSec };
  activity = [r, ...activity];
  return r;
}

/** `ageSec` is null for a manual lookup, which has no QR window to check. */
function checkTicket(ticketId: string, ageSec: number | null, nowSec: number): ScanResult {
  const ticket = getTicket(ticketId);
  if (!ticket) return record("INVALID", null, "Ticket not found.", nowSec);
  if (ticket.eventId !== GATE_EVENT_ID) {
    const other = getEvent(ticket.eventId)?.title ?? "another event";
    return record("WRONG EVENT", ticketId, `This ticket is for ${other}.`, nowSec);
  }
  if (ticket.status === "past") return record("EXPIRED", ticketId, "The event is over.", nowSec);
  if (ticket.status === "listed") {
    return record("INVALID", ticketId, "Listed for resale. Locked, so it cannot enter.", nowSec);
  }
  if (ageSec !== null && (ageSec > QR_WINDOW_SECONDS + SKEW_SECONDS || ageSec < -SKEW_SECONDS)) {
    return record("EXPIRED", ticketId, "QR is older than 10 seconds. Ask the attendee to refresh.", nowSec);
  }
  if (redeemed.has(ticketId)) {
    return record("ALREADY USED", ticketId, "Already admitted at this gate.", nowSec);
  }
  redeemed.add(ticketId);
  return record("VALID", ticketId, `Admit ${ticket.quantity} · ${ticket.tierName}`, nowSec);
}

export function evaluateScan(raw: string, nowSec: number, opts: { offline?: boolean } = {}): ScanResult {
  if (opts.offline) {
    return record(
      "OFFLINE-UNVERIFIED",
      null,
      "No server connection. Check ID manually. Do not admit until verified online.",
      nowSec,
    );
  }
  const parts = raw.trim().split("|");
  if (parts.length !== 3 || parts[0] !== "TT") return record("INVALID", null, "Not a TruTicket code.", nowSec);
  const windowIndex = Number(parts[2]);
  if (!Number.isInteger(windowIndex)) return record("INVALID", null, "Malformed code.", nowSec);
  const ageSec = nowSec - windowIndex * QR_WINDOW_SECONDS;
  return checkTicket(parts[1], ageSec, nowSec);
}

/** Fallback when the attendee's phone screen is damaged. Uses the ticket ref only. */
export function manualLookup(ref: string, nowSec: number, opts: { offline?: boolean } = {}): ScanResult {
  if (opts.offline) {
    return record("OFFLINE-UNVERIFIED", null, "No server connection. Check ID manually.", nowSec);
  }
  return checkTicket(ref.trim(), null, nowSec);
}

export function getActivity(): ScanResult[] {
  return activity;
}

/** Start a new shift. Clears the demo redeemed set and the log. */
export function resetGateSession(): void {
  redeemed.clear();
  activity = [];
}
