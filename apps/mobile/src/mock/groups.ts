/**
 * Group distribution (mock, PRD FR-027 and section 6.6).
 * A team manager buys N tickets, then assigns them to team members by email at zero cost.
 * Phase 2 writes group_allocations in Postgres and calls the policy transfer on the contract.
 */
export type MemberStatus = "PENDING_CLAIM" | "CLAIMED";

export type GroupMember = { email: string; status: MemberStatus };

export type BulkOrder = {
  id: string;
  eventId: string;
  tierName: string;
  faceValue: number;
  total: number;
  members: GroupMember[];
};

export const MOCK_BULK_ORDERS: BulkOrder[] = [
  {
    id: "grp-1",
    eventId: "evt-ind-aus",
    tierName: "General Admission",
    faceValue: 2000,
    total: 12,
    members: [
      { email: "ravi.k@acme.in", status: "CLAIMED" },
      { email: "meera.s@acme.in", status: "PENDING_CLAIM" },
    ],
  },
];

export function getBulkOrder(id: string | string[] | undefined): BulkOrder | undefined {
  const key = Array.isArray(id) ? id[0] : id;
  return MOCK_BULK_ORDERS.find((o) => o.id === key);
}

/** Tickets still in the manager's bucket (not assigned to anyone yet). */
export function unassignedCount(order: BulkOrder): number {
  return order.total - order.members.length;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function addMember(order: BulkOrder, rawEmail: string): { ok: true } | { ok: false; error: string } {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (order.members.some((m) => m.email === email)) return { ok: false, error: "This member already has an invite." };
  if (unassignedCount(order) <= 0) return { ok: false, error: "All tickets in this order are assigned." };
  order.members.push({ email, status: "PENDING_CLAIM" });
  return { ok: true };
}

/** Only unclaimed invites can be revoked. Claimed tickets belong to the member now. */
export function revokeInvite(order: BulkOrder, email: string): boolean {
  const i = order.members.findIndex((m) => m.email === email && m.status === "PENDING_CLAIM");
  if (i < 0) return false;
  order.members.splice(i, 1);
  return true;
}
