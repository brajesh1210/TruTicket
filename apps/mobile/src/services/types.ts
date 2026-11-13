/** App-side shapes. Screens use these; the API rows are mapped in the service modules. */
export type EventCategory = "Concerts" | "Sports" | "Comedy" | "Festivals";

export type AppTier = {
  id: string; // ticket type id (uuid)
  name: string;
  price: number; // INR, whole rupees
  color: string;
  remaining: number;
  perAccountLimit: number;
  perks: string[]; // not in the API yet: always empty
};

export type AppEvent = {
  id: string;
  title: string;
  when: string;
  venue: string;
  fromPrice: number; // INR
  category: EventCategory;
  tint: [string, string];
  about: string;
  startAt: string;
  endAt: string;
  tiers: AppTier[];
};

export type TicketStatusGroup = "upcoming" | "past" | "listed";

export type AppTicket = {
  id: string;
  eventId: string;
  eventTitle: string;
  venue: string;
  startAt: string;
  tierName: string;
  tierColor: string;
  faceValue: number; // INR
  status: TicketStatusGroup;
  statusRaw: string;
};

export type ScanStatus =
  | "VALID"
  | "ALREADY USED"
  | "EXPIRED"
  | "REVOKED"
  | "INVALID"
  | "WRONG EVENT"
  | "OFFLINE-UNVERIFIED";
