/**
 * Mock events for Phase 1 (UI only). Replaced by Supabase data in Phase 2.
 * Names and prices follow the reference screens.
 */
export type TicketTier = {
  id: string;
  name: string;
  price: number; // INR, whole rupees
  color: string;
  remaining: number;
  perks: string[];
};

export type MockEvent = {
  id: string;
  title: string;
  when: string;
  venue: string;
  fromPrice: number; // INR, whole rupees
  category: "Concerts" | "Sports" | "Comedy" | "Festivals";
  tint: [string, string]; // gradient colours for the placeholder artwork
  about: string;
  tiers: TicketTier[];
};

export const MOCK_EVENTS: MockEvent[] = [
  {
    id: "evt-coldplay",
    title: "Coldplay Live",
    when: "Sat, 25 May · 7:00 PM",
    venue: "DY Patil Stadium, Navi Mumbai",
    fromPrice: 2499,
    category: "Concerts",
    tint: ["#0ACBDB", "#8B7CF6"],
    about:
      "An evening of hits and new songs under the open sky. Gates open at 4:30 PM. Carry a valid ID and your TruTicket QR. Re-entry is not allowed.",
    tiers: [
      { id: "ga", name: "General Admission", price: 2499, color: "#0ACBDB", remaining: 420, perks: ["Standing area", "Entry from 4:30 PM"] },
      { id: "vip", name: "VIP", price: 6999, color: "#8B7CF6", remaining: 60, perks: ["Front section", "Priority lounge", "Merch pack"] },
      { id: "premium", name: "Premium", price: 4499, color: "#F5A524", remaining: 150, perks: ["Seated, lower bowl", "Fast-track entry"] },
    ],
  },
  {
    id: "evt-arijit",
    title: "Arijit Singh Live",
    when: "Sun, 26 May",
    venue: "Jio World Garden",
    fromPrice: 1999,
    category: "Concerts",
    tint: ["#8B7CF6", "#0ACBDB"],
    about: "An intimate night of Bollywood classics and fresh releases. Doors open at 6:00 PM.",
    tiers: [
      { id: "ga", name: "General Admission", price: 1999, color: "#0ACBDB", remaining: 300, perks: ["Standing area"] },
      { id: "premium", name: "Premium", price: 3499, color: "#F5A524", remaining: 90, perks: ["Seated", "Fast-track entry"] },
    ],
  },
  {
    id: "evt-sunburn",
    title: "Sunburn Arena",
    when: "Fri, 24 May",
    venue: "Mahalaxmi Racecourse",
    fromPrice: 1499,
    category: "Festivals",
    tint: ["#F5A524", "#8B7CF6"],
    about: "Three stages, 40 artists, one weekend of electronic music. Sunscreen and water bottles allowed.",
    tiers: [
      { id: "ga", name: "General Admission", price: 1499, color: "#0ACBDB", remaining: 800, perks: ["Festival access"] },
      { id: "vip", name: "VIP", price: 4999, color: "#8B7CF6", remaining: 120, perks: ["VIP deck", "Lounge access"] },
    ],
  },
  {
    id: "evt-ind-aus",
    title: "India vs Australia",
    when: "Thu, 30 May",
    venue: "Wankhede Stadium",
    fromPrice: 2999,
    category: "Sports",
    tint: ["#22C55E", "#0ACBDB"],
    about: "Day-night T20 international. Gates open at 4:00 PM. Bags above A4 size are not allowed.",
    tiers: [
      { id: "ga", name: "General Admission", price: 2999, color: "#0ACBDB", remaining: 500, perks: ["Stand seating"] },
      { id: "student", name: "Student", price: 1499, color: "#F59E0B", remaining: 80, perks: ["Valid student ID required at gate"] },
      { id: "premium", name: "Premium", price: 5999, color: "#F5A524", remaining: 60, perks: ["Lower bowl", "Fast-track entry"] },
    ],
  },
  {
    id: "evt-comedy",
    title: "Stand-up Comedy Night",
    when: "Tonight · 8:00 PM",
    venue: "The Habitat, Kharghar",
    fromPrice: 699,
    category: "Comedy",
    tint: ["#F59E0B", "#EF4444"],
    about: "Five comics, one stage, zero sleep. Age 18+. Seating is first come, first served within your tier.",
    tiers: [
      { id: "ga", name: "General Admission", price: 699, color: "#0ACBDB", remaining: 120, perks: ["Standard seating"] },
      { id: "premium", name: "Front Row", price: 1299, color: "#F5A524", remaining: 20, perks: ["Front row seats"] },
    ],
  },
  {
    id: "evt-local-train",
    title: "The Local Train Live",
    when: "Tomorrow · 7:30 PM",
    venue: "Navi Mumbai Sports Assoc.",
    fromPrice: 999,
    category: "Concerts",
    tint: ["#0ACBDB", "#22C55E"],
    about: "The band's first Navi Mumbai show in five years. Doors open at 6:30 PM.",
    tiers: [
      { id: "ga", name: "General Admission", price: 999, color: "#0ACBDB", remaining: 250, perks: ["Standing area"] },
    ],
  },
];

export function getEvent(id: string | string[] | undefined): MockEvent | undefined {
  const key = Array.isArray(id) ? id[0] : id;
  return MOCK_EVENTS.find((e) => e.id === key);
}
