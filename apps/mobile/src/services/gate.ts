/**
 * Gate scanning (PHASE2_PLAN §2.7). The server does the real checks: QR signature, nonce,
 * event match, and an atomic redeem. The app only shows the answer.
 * Source: the `scanner_verify` Edge Function. Needs an organiser sign-in.
 */
import { callFunction } from "./api";
import { ApiError } from "./errors";
import { toScanStatus } from "./mappers";
import type { ScanStatus } from "./types";

export type { ScanStatus } from "./types";

export type ScanResult = {
  status: ScanStatus;
  detail: string;
  atSec: number;
};

const DETAIL: Record<ScanStatus, string> = {
  VALID: "Admit. Ticket is now marked used.",
  "ALREADY USED": "This ticket was already admitted.",
  EXPIRED: "QR is older than 10 seconds. Ask the attendee to refresh.",
  REVOKED: "This ticket was revoked.",
  INVALID: "Not a valid TruTicket code.",
  "WRONG EVENT": "This ticket is for another event.",
  "OFFLINE-UNVERIFIED": "No server connection. Check ID manually. Do not admit until verified online.",
};

let activity: ScanResult[] = [];

function record(status: ScanStatus, detail?: string): ScanResult {
  const r: ScanResult = { status, detail: detail ?? DETAIL[status], atSec: Math.floor(Date.now() / 1000) };
  activity = [r, ...activity];
  return r;
}

function newKey(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Checks a scanned QR token for an event. Throws ApiError for problems the gate must see. */
export async function scanToken(eventId: string, token: string): Promise<ScanResult> {
  const clean = token.trim();
  if (!clean) throw new ApiError("INVALID_INPUT", "Scan a QR code or paste its text.");
  const res = await callFunction<{ result: string }>(
    "scanner_verify",
    { event_id: eventId, token: clean, idempotency_key: newKey() },
    { auth: true },
  );
  return record(toScanStatus(res.result));
}

/** Offline toggle on the gate: never admits, only logs that the check was not done. */
export function recordOffline(): ScanResult {
  return record("OFFLINE-UNVERIFIED");
}

export function getActivity(): ScanResult[] {
  return activity;
}

/** Start a new shift. Clears the log. */
export function resetGateSession(): void {
  activity = [];
}
