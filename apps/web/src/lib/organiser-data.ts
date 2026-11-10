/**
 * Mock data for the organiser portal (Phase 4 UI). Replaced by Supabase queries in Phase 2/4.
 * Amounts are whole INR rupees. Totals are computed from the tiers, so every screen agrees.
 */

export type TierStatus = "On sale" | "Paused" | "Sold out";

export type Tier = {
  name: string;
  color: string;
  face: number;
  qty: number;
  sold: number;
  reserved: number;
  listed: number;
  cancelled: number;
  redeemed: number;
  groupUnassigned: number; // FR-027 bucket: bought by a group manager, not yet given to members
  limit: number; // max per account
  window: string;
  status: TierStatus;
};

export type EventStatus = "Published" | "Draft" | "Paused";

export type EventRecord = {
  id: string;
  title: string;
  category: string;
  venue: string;
  when: string;
  status: EventStatus;
  tint: [string, string];
  tiers: Tier[];
};

const SUNSET_TIERS: Tier[] = [
  {
    name: "General Admission",
    color: "#0ACBDB",
    face: 2499,
    qty: 10000,
    sold: 8450,
    reserved: 120,
    listed: 36,
    cancelled: 14,
    redeemed: 7620,
    groupUnassigned: 0,
    limit: 6,
    window: "1 May – 24 Aug",
    status: "On sale",
  },
  {
    name: "VIP Lounge",
    color: "#8B7CF6",
    face: 6999,
    qty: 4000,
    sold: 2850,
    reserved: 40,
    listed: 22,
    cancelled: 8,
    redeemed: 2610,
    groupUnassigned: 0,
    limit: 4,
    window: "1 May – 24 Aug",
    status: "On sale",
  },
  {
    name: "Student (ID required)",
    color: "#F5A524",
    face: 1499,
    qty: 2500,
    sold: 1542,
    reserved: 12,
    listed: 9,
    cancelled: 4,
    redeemed: 1400,
    groupUnassigned: 0,
    limit: 2,
    window: "1 May – 24 Aug",
    status: "On sale",
  },
];

const TECH_TIERS: Tier[] = [
  {
    name: "Delegate Pass",
    color: "#0ACBDB",
    face: 4999,
    qty: 6000,
    sold: 3920,
    reserved: 80,
    listed: 10,
    cancelled: 12,
    redeemed: 0,
    groupUnassigned: 150,
    limit: 4,
    window: "1 Jun – 12 Sep",
    status: "On sale",
  },
];

const FOOD_TIERS: Tier[] = [
  {
    name: "Entry Pass",
    color: "#22C55E",
    face: 299,
    qty: 8000,
    sold: 2100,
    reserved: 0,
    listed: 0,
    cancelled: 0,
    redeemed: 0,
    groupUnassigned: 0,
    limit: 10,
    window: "1 Aug – 12 Oct",
    status: "Paused",
  },
];

export const EVENTS: EventRecord[] = [
  {
    id: "sunset-2025",
    title: "Sunset Music Festival 2025",
    category: "Concerts",
    venue: "DY Patil Stadium, Navi Mumbai",
    when: "Aug 24–26, 2025 · 4:00 PM",
    status: "Published",
    tint: ["#0ACBDB", "#8B7CF6"],
    tiers: SUNSET_TIERS,
  },
  {
    id: "techsummit-2025",
    title: "Tech Summit 2025",
    category: "Conferences",
    venue: "BKC Convention Hall, Mumbai",
    when: "Sep 13, 2025 · 10:00 AM",
    status: "Published",
    tint: ["#F5A524", "#0ACBDB"],
    tiers: TECH_TIERS,
  },
  {
    id: "food-expo-2025",
    title: "City Food Expo",
    category: "Festivals",
    venue: "Pune Exhibition Centre",
    when: "Oct 12–13, 2025 · 11:00 AM",
    status: "Paused",
    tint: ["#8B7CF6", "#F5A524"],
    tiers: FOOD_TIERS,
  },
];

export function getEventRecord(id: string): EventRecord | undefined {
  return EVENTS.find((e) => e.id === id);
}

export const available = (t: Tier) => t.qty - t.sold - t.reserved;
export const tierRevenue = (t: Tier) => t.sold * t.face;
export const eventSold = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.sold, 0);
export const eventCapacity = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.qty, 0);
export const eventRevenue = (e: EventRecord) => e.tiers.reduce((s, t) => s + tierRevenue(t), 0);
export const eventRefunds = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.cancelled * t.face, 0);
export const eventRedeemed = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.redeemed, 0);

/** Account-level totals for the overview. Completed and total history are mock until Phase 2. */
export function totals() {
  const sold = EVENTS.reduce((s, e) => s + eventSold(e), 0);
  const revenue = EVENTS.reduce((s, e) => s + eventRevenue(e), 0);
  const refunds = EVENTS.reduce((s, e) => s + eventRefunds(e), 0);
  const active = EVENTS.filter((e) => e.status === "Published").length;
  return {
    active,
    upcoming: 3,
    completed: 24,
    totalEvents: 44,
    sold,
    revenue,
    refunds,
    avgPerEvent: Math.round(sold / EVENTS.length),
  };
}

/** Cumulative tickets sold, last 30 days (Sunset Music Festival). */
export const SALES_SERIES = [
  120, 260, 410, 560, 720, 905, 1080, 1240, 1430, 1660, 1900, 2140, 2390, 2650, 2930, 3190, 3480, 3760, 4050,
  4390, 4720, 5060, 5420, 5790, 6160, 6540, 6930, 7320, 7710, 8100,
];

export const ACTIVITY = [
  { time: "2m ago", text: "New order #TT-88412 · 2 × VIP Lounge" },
  { time: "11m ago", text: "Refund processed for #TT-88107" },
  { time: "25m ago", text: "Gate A scanned 17 tickets" },
  { time: "1h ago", text: "Event published: Tech Summit 2025" },
  { time: "3h ago", text: "Resale policy updated to v2.1" },
];

export const SCHEDULE = [
  { day: "24", month: "AUG", title: "Sunset Music Festival", meta: "Navi Mumbai · Day 1" },
  { day: "13", month: "SEP", title: "Tech Summit 2025", meta: "Mumbai · Full day" },
  { day: "12", month: "OCT", title: "City Food Expo", meta: "Pune · Paused" },
];

export const RESALE_LISTINGS = [
  { ref: "LST-2041", event: "Sunset Music Festival 2025", tier: "VIP Lounge", face: 6999, ask: 7500, status: "Compliant" },
  { ref: "LST-2038", event: "Sunset Music Festival 2025", tier: "General Admission", face: 2499, ask: 2700, status: "Compliant" },
  { ref: "LST-2030", event: "Tech Summit 2025", tier: "Delegate Pass", face: 4999, ask: 5600, status: "Over cap" },
];

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

export const FRAUD_SESSIONS: {
  ref: string;
  score: number;
  band: RiskBand;
  reasons: string[];
  event: string;
  detected: string;
  status: "New" | "In review" | "Reviewed";
}[] = [
  { ref: "SESS-99081", score: 92, band: "HIGH", reasons: ["IP velocity", "Card test"], event: "Sunset Music Festival", detected: "Aug 18 · 10:12", status: "New" },
  { ref: "SESS-99045", score: 76, band: "HIGH", reasons: ["BIN blacklist"], event: "Tech Summit 2025", detected: "Aug 17 · 09:14", status: "In review" },
  { ref: "SESS-98821", score: 65, band: "MEDIUM", reasons: ["High order value"], event: "Sunset Music Festival", detected: "Aug 17 · 08:33", status: "New" },
  { ref: "SESS-98602", score: 58, band: "MEDIUM", reasons: ["Proxy detected"], event: "City Food Expo", detected: "Aug 17 · 11:21", status: "Reviewed" },
  { ref: "SESS-98711", score: 35, band: "LOW", reasons: ["Device fingerprint"], event: "Tech Summit 2025", detected: "Aug 16 · 18:02", status: "Reviewed" },
];

export const GATE_STAFF: {
  name: string;
  email: string;
  gate: string;
  device: string;
  verified: boolean;
  status: "Active" | "Suspended";
  lastActive: string;
}[] = [
  { name: "John Carter", email: "john.carter@mail.in", gate: "Gate 1", device: "iPhone 14", verified: true, status: "Active", lastActive: "Aug 18 · 10:15" },
  { name: "Sanjana Lopez", email: "s.lopez@mail.in", gate: "Gate 2", device: "Galaxy S22", verified: true, status: "Active", lastActive: "Aug 18 · 10:12" },
  { name: "Mike Johnson", email: "m.johnson@mail.in", gate: "Gate 3", device: "iPhone 13", verified: true, status: "Active", lastActive: "Aug 18 · 09:48" },
  { name: "Emma Davis", email: "emma.davis@mail.in", gate: "Gate 4", device: "Pixel 7", verified: true, status: "Active", lastActive: "Aug 18 · 10:05" },
  { name: "Alex Brown", email: "alex.brown@mail.in", gate: "Gate 5", device: "iPhone 14", verified: false, status: "Suspended", lastActive: "Aug 17 · 18:45" },
];

export type PayoutStatus = "Pending" | "Eligible" | "Released" | "Refunded" | "Disputed";

export const PAYOUTS: {
  date: string;
  description: string;
  event: string;
  amount: number;
  status: PayoutStatus;
  ref: string;
}[] = [
  { date: "Aug 18", description: "Ticket sales", event: "Sunset Music Festival", amount: 8450, status: "Eligible", ref: "TXN-88431" },
  { date: "Aug 17", description: "Ticket sales", event: "Tech Summit 2025", amount: 3900, status: "Pending", ref: "TXN-88421" },
  { date: "Aug 17", description: "Payout initiated", event: "—", amount: -12500, status: "Released", ref: "PAYOUT-2211" },
  { date: "Aug 16", description: "Ticket refund", event: "City Food Expo", amount: -980, status: "Refunded", ref: "RFND-0912" },
  { date: "Aug 15", description: "Platform fee", event: "Sunset Music Festival", amount: -945, status: "Disputed", ref: "FEE-7712" },
];

export const PAYOUT_TOTALS = {
  available: 24850.75,
  settled: 223450.5,
  pending: 18420,
  platformFees: 14230.35,
};

export const VERIFICATION_STEPS: { label: string; detail: string; state: "Done" | "Pending" | "Waiting" }[] = [
  { label: "Email verified", detail: "Verified email is required before any transaction.", state: "Done" },
  { label: "Two-factor login (TOTP)", detail: "Mandatory for organiser accounts. Set up with an authenticator app.", state: "Done" },
  { label: "Organisation details", detail: "Legal name, display name, and support contact submitted.", state: "Done" },
  { label: "Business documents", detail: "Upload registration proof. Reviewed by a TruTicket admin.", state: "Pending" },
  { label: "Payout account", detail: "Bank account linked through Razorpay (Phase 2).", state: "Waiting" },
  { label: "Admin review", detail: "A TruTicket admin approves the organiser before events go live.", state: "Waiting" },
];
