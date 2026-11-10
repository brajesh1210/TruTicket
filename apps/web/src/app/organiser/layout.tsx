import { Sidebar, type NavItem } from "@/components/Sidebar";
import { Badge } from "@/components/ui";

/** The 10 organiser screens (PLAN §4). */
const NAV: NavItem[] = [
  { href: "/organiser", label: "Overview" },
  { href: "/organiser/create", label: "Create event" },
  { href: "/organiser/events/sunset-2025", label: "Event detail" },
  { href: "/organiser/inventory", label: "Ticket inventory" },
  { href: "/organiser/resale", label: "Resale policy" },
  { href: "/organiser/fraud", label: "Fraud monitoring" },
  { href: "/organiser/gate", label: "Gate staff" },
  { href: "/organiser/payouts", label: "Payouts" },
  { href: "/organiser/organisation", label: "Organisation" },
  { href: "/organiser/verification", label: "Verification" },
];

/** Shell for all organiser screens: sidebar, top bar, page content. */
export default function OrganiserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar items={NAV} label="Organiser navigation" footer={{ name: "Organiser", email: "organizer@example.com", initial: "O" }} />
      <div className="main">
        <header className="topbar">
          <div className="search">Search events, tickets, orders…</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
            <Badge tone="success">2FA on</Badge>
            <span className="bell" aria-label="Notifications">●</span>
            <div className="avatar" aria-label="Account">O</div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
