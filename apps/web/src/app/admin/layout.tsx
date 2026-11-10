import { Sidebar, type NavItem } from "@/components/Sidebar";
import type { Metadata } from "next";
import { Badge } from "@/components/ui";

export const metadata: Metadata = { title: "TruTicket · Admin" };

/** The 8 admin screens (PLAN §4, PRD reference screens 27–34). */
const NAV: NavItem[] = [
  { href: "/admin", label: "Platform overview" },
  { href: "/admin/users", label: "User management" },
  { href: "/admin/events", label: "Event moderation" },
  { href: "/admin/emergency", label: "Emergency protocol" },
  { href: "/admin/audit", label: "Audit logs" },
  { href: "/admin/risk", label: "Risk events queue" },
  { href: "/admin/sessions", label: "Session investigation" },
  { href: "/admin/appeals", label: "Appeal review" },
];

/** Admin shell. Same visual system as the organiser portal, with an admin badge. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar items={NAV} label="Admin navigation" footer={{ name: "Admin", email: "admin@truticket.in", initial: "A" }} />
      <div className="main">
        <header className="topbar">
          <div className="search">Search users, events, sessions…</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
            <Badge tone="danger">Admin · 2FA required</Badge>
            <span className="bell" aria-label="Notifications">●</span>
            <div className="avatar" aria-label="Account">A</div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
