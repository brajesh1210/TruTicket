/**
 * Mock events for Phase 1 (UI only). Replaced by Supabase data in Phase 2.
 * Names and prices follow the reference screens.
 */
export type MockEvent = {
  id: string;
  title: string;
  when: string;
  venue: string;
  fromPrice: number; // INR, whole rupees
  category: "Concerts" | "Sports" | "Comedy" | "Festivals";
  tint: [string, string]; // gradient colours for the placeholder artwork
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
  },
  {
    id: "evt-arijit",
    title: "Arijit Singh Live",
    when: "Sun, 26 May",
    venue: "Jio World Garden",
    fromPrice: 1999,
    category: "Concerts",
    tint: ["#8B7CF6", "#0ACBDB"],
  },
  {
    id: "evt-sunburn",
    title: "Sunburn Arena",
    when: "Fri, 24 May",
    venue: "Mahalaxmi Racecourse",
    fromPrice: 1499,
    category: "Festivals",
    tint: ["#F5A524", "#8B7CF6"],
  },
  {
    id: "evt-ind-aus",
    title: "India vs Australia",
    when: "Thu, 30 May",
    venue: "Wankhede Stadium",
    fromPrice: 2999,
    category: "Sports",
    tint: ["#22C55E", "#0ACBDB"],
  },
  {
    id: "evt-comedy",
    title: "Stand-up Comedy Night",
    when: "Tonight · 8:00 PM",
    venue: "The Habitat, Kharghar",
    fromPrice: 699,
    category: "Comedy",
    tint: ["#F59E0B", "#EF4444"],
  },
  {
    id: "evt-local-train",
    title: "The Local Train Live",
    when: "Tomorrow · 7:30 PM",
    venue: "Navi Mumbai Sports Assoc.",
    fromPrice: 999,
    category: "Concerts",
    tint: ["#0ACBDB", "#22C55E"],
  },
];
