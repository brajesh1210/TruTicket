// Mock data for the admin portal. All names and emails are fictional.
// Phase 2 replaces these with Supabase queries and enforces role checks with RLS.

export const ADMIN_KPIS = [
  { label: "Registered users", value: "48,215", hint: "+2.4% this week", tone: "success" as const },
  { label: "Live events", value: "37", hint: "4 pending review", tone: "info" as const },
  { label: "Open risk events", value: "19", hint: "6 high band", tone: "danger" as const },
  { label: "Open appeals", value: "11", hint: "3 older than 48h", tone: "warning" as const },
  { label: "Tickets sold today", value: "1,284", hint: "+11% vs yesterday", tone: "success" as const },
  { label: "Resale transfers today", value: "212", hint: "0 cap breaches", tone: "success" as const },
  { label: "Gate scans today", value: "3,906", hint: "0.4% denied", tone: "info" as const },
  { label: "Emergency mode", value: "Off", hint: "Last used 14 Mar", tone: "neutral" as const },
];

export const USERS = [
  { name: "Riya Sharma", email: "riya.s@example.com", role: "Attendee", email_verified: true, twofa: "Not required", status: "Active", last: "2 min ago" },
  { name: "Kabir Mehta", email: "kabir.m@example.com", role: "Organiser", email_verified: true, twofa: "TOTP on", status: "Active", last: "1 hr ago" },
  { name: "Ananya Iyer", email: "ananya.i@example.com", role: "Attendee", email_verified: true, twofa: "Not required", status: "Suspended", last: "3 days ago" },
  { name: "Dev Kapoor", email: "dev.k@example.com", role: "Gate staff", email_verified: false, twofa: "Not required", status: "Pending", last: "Never" },
  { name: "Meera Nair", email: "meera.n@example.com", role: "Organiser", email_verified: true, twofa: "TOTP on", status: "Active", last: "Yesterday" },
  { name: "Arjun Singh", email: "arjun.s@example.com", role: "Attendee", email_verified: true, twofa: "Not required", status: "Active", last: "Today" },
];

export const EVENT_QUEUE = [
  { title: "Sunset Music Festival 2025", organiser: "TruTicket Events", submitted: "3 Nov 2026", state: "Published", risk: "Low" },
  { title: "Tech Summit India 2026", organiser: "Kabir Mehta", submitted: "2 Nov 2026", state: "Pending review", risk: "Medium" },
  { title: "Comedy Night Pune", organiser: "Meera Nair", submitted: "1 Nov 2026", state: "Pending review", risk: "Low" },
  { title: "Food Expo 2025", organiser: "Food Expo Ltd", submitted: "28 Oct 2026", state: "Paused", risk: "High" },
];

export const EMERGENCY_ACTIONS = [
  { title: "Pause all ticket sales", detail: "Stops checkout across every live event. Existing tickets stay valid.", danger: true },
  { title: "Freeze resale", detail: "Blocks new resale listings and transfers platform-wide.", danger: true },
  { title: "Gate-only mode", detail: "Scanners keep working. Sales and resale stop. Use during incidents at the venue.", danger: false },
  { title: "Notify organisers", detail: "Sends a templated message to every organiser with a live event.", danger: false },
];

export const AUDIT = [
  { time: "04 Nov, 18:02", actor: "admin@truticket.in", action: "Approved organiser", target: "Kabir Mehta", result: "Success" },
  { time: "04 Nov, 17:48", actor: "system", action: "Session flagged (HIGH)", target: "SESS-88C1", result: "Held" },
  { time: "04 Nov, 16:10", actor: "admin@truticket.in", action: "Suspended user", target: "Ananya Iyer", result: "Success" },
  { time: "04 Nov, 14:37", actor: "gate-03@truticket.in", action: "Device authorised", target: "Gate 3 · Dev Kapoor", result: "Pending" },
  { time: "04 Nov, 11:20", actor: "system", action: "Cap breach blocked", target: "LST-2194", result: "Blocked" },
];

export const RISK_EVENTS = [
  { ref: "RISK-1041", type: "Bot-like checkout", band: "HIGH", score: 91, event: "Sunset Music Festival 2025", status: "Open" },
  { ref: "RISK-1040", type: "Velocity: many cards", band: "HIGH", score: 88, event: "Tech Summit India 2026", status: "Open" },
  { ref: "RISK-1039", type: "Resale above cap attempt", band: "MEDIUM", score: 64, event: "Sunset Music Festival 2025", status: "In review" },
  { ref: "RISK-1038", type: "Device change on login", band: "MEDIUM", score: 58, event: "Comedy Night Pune", status: "Open" },
  { ref: "RISK-1037", type: "Single IP, many accounts", band: "LOW", score: 22, event: "Food Expo 2025", status: "Closed" },
];

export const SESSIONS = [
  { id: "SESS-88C1", user: "Ananya Iyer", device: "Android · new", region: "Mumbai, IN", signals: "New device, VPN", decision: "Step-up", band: "HIGH" },
  { id: "SESS-88C2", user: "Dev Kapoor", device: "Android · known", region: "Delhi, IN", signals: "Email unverified", decision: "Blocked", band: "MEDIUM" },
  { id: "SESS-88C3", user: "Riya Sharma", device: "iOS · known", region: "Pune, IN", signals: "None", decision: "Allowed", band: "LOW" },
];

export const APPEALS = [
  { ref: "APL-310", user: "Ananya Iyer", type: "Account suspended", submitted: "2 Nov 2026", status: "Open" },
  { ref: "APL-309", user: "Dev Kapoor", type: "Gate device blocked", submitted: "1 Nov 2026", status: "In review" },
  { ref: "APL-308", user: "Arjun Singh", type: "Ticket transfer held", submitted: "30 Oct 2026", status: "Resolved" },
];
