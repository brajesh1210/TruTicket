/**
 * Price-capped resale (mock, UI logic only).
 * PRD section 6.5: max ask = face_value x capBps / 10000. Phase 2 enforces the same rule
 * on the server and in the contract. The app only shows the numbers.
 */
import { getEvent } from "./events";
import type { MockTicket } from "./tickets";

export const DEFAULT_CAP_BPS = 11000; // 110% of face value (PRD example)
export const PLATFORM_FEE_PCT = 2; // demo value. PRD range is 1–3%.

export type Listing = {
  id: string;
  eventId: string;
  tierName: string;
  faceValue: number; // INR, whole rupees (paise in the database)
  ask: number;
  capBps: number;
  transfersUsed: number;
  transferLimit: number;
};

export const MOCK_LISTINGS: Listing[] = [
  {
    id: "lst-2001",
    eventId: "evt-coldplay",
    tierName: "Premium",
    faceValue: 4499,
    ask: 4800,
    capBps: DEFAULT_CAP_BPS,
    transfersUsed: 0,
    transferLimit: 2,
  },
  {
    id: "lst-2002",
    eventId: "evt-ind-aus",
    tierName: "General Admission",
    faceValue: 2000,
    ask: 2150,
    capBps: DEFAULT_CAP_BPS,
    transfersUsed: 1,
    transferLimit: 2,
  },
  {
    id: "lst-2003",
    eventId: "evt-sunburn",
    tierName: "VIP",
    faceValue: 5500,
    ask: 6000,
    capBps: DEFAULT_CAP_BPS,
    transfersUsed: 0,
    transferLimit: 2,
  },
];

/** Highest price the seller may ask. Rounded down, so it never exceeds the cap. */
export function maxResalePrice(faceValue: number, capBps: number): number {
  return Math.floor((faceValue * capBps) / 10000);
}

export function platformFee(ask: number): number {
  return Math.round((ask * PLATFORM_FEE_PCT) / 100);
}

export function sellerNet(ask: number): number {
  return ask - platformFee(ask);
}

/** Returns an error message, or null when the ask is allowed. */
export function askError(ask: number, cap: number): string | null {
  if (!Number.isFinite(ask) || ask <= 0) return "Enter a price in rupees.";
  if (ask > cap) return `Above the cap. Maximum is ${inr(cap)}.`;
  return null;
}

/** Face value of a ticket, from its tier on the event. */
export function faceValueFor(ticket: MockTicket): number {
  const event = getEvent(ticket.eventId);
  return event?.tiers.find((t) => t.name === ticket.tierName)?.price ?? 0;
}

export function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}
