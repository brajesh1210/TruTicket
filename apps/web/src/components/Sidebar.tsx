"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

export type NavItem = { href: string; label: string };

/**
 * Shared side navigation for the organiser and admin portals.
 * `items` are passed from the server layout so this component stays data-free.
 */
export function Sidebar({
  items,
  label,
  footer,
}: {
  items: NavItem[];
  label: string;
  footer: { name: string; email: string; initial: string };
}) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Logo height={26} />
      <nav className="nav" aria-label={label}>
        {items.map((n) => {
          // The root item (e.g. /organiser) matches only itself. Others match their own path and sub-paths.
          const isRoot = n.href === items[0].href;
          const active = isRoot ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`);
          return (
            <Link key={n.href} href={n.href} className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="avatar">{footer.initial}</div>
        <div>
          <div className="foot-name">{footer.name}</div>
          <div className="muted small">{footer.email}</div>
        </div>
      </div>
    </aside>
  );
}
