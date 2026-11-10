/**
 * Mock tickets for Phase 1 (UI only).
 * In Phase 2 these come from the `tickets` table. The real gate QR is a server-signed
 * credential that rotates every 10 seconds (PRD section 6.4).
 */
export type MockTicket = {
  id: string;
  eventId: string;
  tierName: string;
  tierColor: string;
  quantity: number;
  seat: string;
  status: "upcoming" | "past" | "listed";
  holder: string;
};

export const MOCK_TICKETS: MockTicket[] = [
  {
    id: "tkt-1001",
    eventId: "evt-coldplay",
    tierName: "VIP",
    tierColor: "#8B7CF6",
    quantity: 2,
    seat: "Block A · Row 4 · Seats 12–13",
    status: "upcoming",
    holder: "Brajesh",
  },
  {
    id: "tkt-1002",
    eventId: "evt-ind-aus",
    tierName: "General Admission",
    tierColor: "#0ACBDB",
    quantity: 1,
    seat: "Stand 3 · Gate 5",
    status: "listed",
    holder: "Brajesh",
  },
  {
    id: "tkt-0900",
    eventId: "evt-comedy",
    tierName: "General Admission",
    tierColor: "#0ACBDB",
    quantity: 1,
    seat: "Standard",
    status: "past",
    holder: "Brajesh",
  },
];

export function getTicket(id: string | string[] | undefined): MockTicket | undefined {
  const key = Array.isArray(id) ? id[0] : id;
  return MOCK_TICKETS.find((t) => t.id === key);
}

/** Mock state change. Phase 2 calls the backend listForResale() instead. */
export function listTicket(id: string): boolean {
  const t = MOCK_TICKETS.find((x) => x.id === id);
  if (!t || t.status !== "upcoming") return false;
  t.status = "listed";
  return true;
}

/** Mock state change. Phase 2 calls the backend cancel-listing endpoint instead. */
export function cancelListing(id: string): boolean {
  const t = MOCK_TICKETS.find((x) => x.id === id);
  if (!t || t.status !== "listed") return false;
  t.status = "upcoming";
  return true;
}
