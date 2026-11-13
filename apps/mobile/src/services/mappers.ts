/**
 * Pure mapping from API rows to app shapes. No network and no native modules, so these
 * can be unit tested on their own.
 */
import { eventTint, formatWhen, paiseToRupees, tierColor } from "./format";
import type { AppEvent, AppTicket, AppTier, EventCategory, ScanStatus, TicketStatusGroup } from "./types";

export type RawTicketType = {
  id: string;
  name: string;
  faceValueMinor: number;
  quantity: number;
  perAccountLimit: number | null;
  seatsLeft: number;
};

export type RawEvent = {
  id: string;
  title: string;
  description: string | null;
  venue: string;
  startAt: string;
  endAt: string;
  categories: string[] | null;
  ticketTypes: RawTicketType[];
};

type Joined<T> = T | T[] | null;

export type RawTicket = {
  id: string;
  status: string;
  faceValueMinor: number;
  events: Joined<{ id: string; title: string; venue: string; startAt: string }>;
  ticket_types: Joined<{ id: string; name: string }>;
};

const CATEGORIES: readonly EventCategory[] = ["Concerts", "Sports", "Comedy", "Festivals"];

export function toAppEvent(raw: RawEvent): AppEvent {
  const category =
    raw.categories?.find((c): c is EventCategory => (CATEGORIES as readonly string[]).includes(c)) ?? "Concerts";

  const tiers: AppTier[] = raw.ticketTypes.map((t) => ({
    id: t.id,
    name: t.name,
    price: paiseToRupees(t.faceValueMinor),
    color: tierColor(t.id),
    remaining: t.seatsLeft,
    perAccountLimit: t.perAccountLimit ?? 4,
    perks: [], // not in the API yet
  }));
  const prices = tiers.map((t) => t.price);

  return {
    id: raw.id,
    title: raw.title,
    when: formatWhen(raw.startAt),
    venue: raw.venue,
    fromPrice: prices.length ? Math.min(...prices) : 0,
    category,
    tint: eventTint(raw.id),
    about: raw.description ?? "",
    startAt: raw.startAt,
    endAt: raw.endAt,
    tiers,
  };
}

const first = <T,>(v: Joined<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Ticket states that can never enter the gate again. */
const DONE_STATUSES = new Set(["REDEEMED", "REVOKED", "CANCELLED", "REFUNDED", "TRANSFERRED"]);
const PAST_GRACE_MS = 6 * 60 * 60 * 1000;

export function groupOf(statusRaw: string, startAt: string, now = Date.now()): TicketStatusGroup {
  if (statusRaw === "LISTED") return "listed";
  if (DONE_STATUSES.has(statusRaw)) return "past";
  const start = new Date(startAt).getTime();
  if (!isNaN(start) && start + PAST_GRACE_MS < now) return "past";
  return "upcoming";
}

export function toAppTicket(raw: RawTicket, now = Date.now()): AppTicket | null {
  const ev = first(raw.events);
  const tt = first(raw.ticket_types);
  if (!ev) return null;
  const tierName = tt?.name ?? "Ticket";
  return {
    id: raw.id,
    eventId: ev.id,
    eventTitle: ev.title,
    venue: ev.venue,
    startAt: ev.startAt,
    tierName,
    tierColor: tierColor(tt?.id ?? tierName),
    faceValue: paiseToRupees(raw.faceValueMinor),
    status: groupOf(raw.status, ev.startAt, now),
    statusRaw: raw.status,
  };
}

/** Server scan result (scanner_verify) to the gate's status. Unknown codes count as INVALID. */
const SERVER_STATUS: Record<string, ScanStatus> = {
  VALID: "VALID",
  ALREADY_USED: "ALREADY USED",
  EXPIRED: "EXPIRED",
  INVALID: "INVALID",
  WRONG_EVENT: "WRONG EVENT",
};

export function toScanStatus(serverResult: string): ScanStatus {
  return SERVER_STATUS[serverResult] ?? "INVALID";
}
