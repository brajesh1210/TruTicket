import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Kpi, PageHeader } from "@/components/ui";
import { EventTabs } from "@/components/EventTabs";
import { eventCapacity, eventRefunds, eventRevenue, eventSold, getEventRecord } from "@/lib/organiser-data";
import { inr, num, pct } from "@/lib/format";

/** Event detail and analytics (PRD screen 17). */
export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = getEventRecord(id);
  if (!e) notFound();

  const sold = eventSold(e);
  const cap = eventCapacity(e);
  const revenue = eventRevenue(e);
  const refunds = eventRefunds(e);
  const avgOrder = sold > 0 ? Math.round(revenue / sold) : 0;

  return (
    <>
      <Link href="/organiser" className="muted small">
        ← Back to overview
      </Link>
      <PageHeader
        title={e.title}
        subtitle={`${e.venue} · ${e.when}`}
        actions={
          <>
            <Badge tone={e.status === "Published" ? "success" : e.status === "Paused" ? "warning" : "neutral"}>
              {e.status}
            </Badge>
            <Link href="/organiser/inventory" className="btn btn-outline">
              Edit event
            </Link>
          </>
        }
      />

      <div className="hero" style={{ background: `linear-gradient(120deg, ${e.tint[0]}, ${e.tint[1]} 55%, #0b0b0b)` }} />

      <div className="grid-kpi">
        <Kpi label="Tickets sold" value={`${num(sold)} / ${num(cap)}`} hint={`${pct((sold / cap) * 100, 1)} sold`} tone="info" />
        <Kpi label="Gross revenue" value={inr(revenue)} />
        <Kpi label="Avg order value" value={inr(avgOrder)} hint="per ticket" />
        <Kpi label="Refunds" value={inr(refunds)} tone="danger" />
      </div>

      <EventTabs tiers={e.tiers} />
    </>
  );
}
