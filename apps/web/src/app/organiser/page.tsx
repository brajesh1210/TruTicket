import Link from "next/link";
import { Card, Kpi, PageHeader, ProgressBar, Sparkline } from "@/components/ui";
import {
  ACTIVITY,
  EVENTS,
  SALES_SERIES,
  SCHEDULE,
  eventCapacity,
  eventSold,
  totals,
} from "@/lib/organiser-data";
import { inr, num, pct } from "@/lib/format";

/** Organiser overview (PRD screen 15). */
export default function OrganiserOverview() {
  const t = totals();
  return (
    <>
      <PageHeader
        title="Welcome back, Organiser"
        subtitle="Here is what is happening with your events."
        actions={
          <Link href="/organiser/create" className="btn btn-primary">
            + Create new event
          </Link>
        }
      />

      <div className="grid-kpi">
        <Kpi label="Active events" value={num(t.active)} />
        <Kpi label="Upcoming events" value={num(t.upcoming)} />
        <Kpi label="Completed events" value={num(t.completed)} />
        <Kpi label="Total events" value={num(t.totalEvents)} />
        <Kpi label="Tickets sold" value={num(t.sold)} hint="+18.6% vs last month" tone="success" />
        <Kpi label="Revenue" value={inr(t.revenue)} hint="+9.2% vs last month" tone="success" />
        <Kpi label="Avg tickets per event" value={num(t.avgPerEvent)} />
        <Kpi label="Refunds" value={inr(t.refunds)} hint="−3.1% vs last month" tone="danger" />
      </div>

      <div className="section-title">Featured events</div>
      <div className="grid-3">
        {EVENTS.map((e) => {
          const sold = eventSold(e);
          const cap = eventCapacity(e);
          return (
            <Link key={e.id} href={`/organiser/events/${e.id}`} className="event-tile">
              <div className="event-art" style={{ background: `linear-gradient(135deg, ${e.tint[0]}, ${e.tint[1]} 60%, #0b0b0b)` }} />
              <div className="event-tile-body">
                <b>{e.title}</b>
                <span className="muted small">{e.venue}</span>
                <span className="muted small">{e.when}</span>
                <ProgressBar value={sold} max={cap} />
                <span className="small muted">
                  {pct((sold / cap) * 100)} sold · {e.status}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid-main">
        <Card title="Ticket sales · last 30 days (Sunset Music Festival)">
          <Sparkline values={SALES_SERIES} />
        </Card>
        <Card title="Recent activity">
          <ul className="list activity">
            {ACTIVITY.map((a) => (
              <li key={a.text}>
                <span className="muted small" style={{ minWidth: 62 }}>
                  {a.time}
                </span>
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Upcoming schedule">
          {SCHEDULE.map((s) => (
            <div key={s.title} className="schedule">
              <div className="date-chip">
                <div className="d">{s.day}</div>
                <div className="m">{s.month}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
                <div className="muted small">{s.meta}</div>
              </div>
            </div>
          ))}
        </Card>
        <Card title="Quick actions">
          <div className="row">
            <Link href="/organiser/create" className="btn btn-primary">
              Create event
            </Link>
            <Link href="/organiser/inventory" className="btn">
              Ticket inventory
            </Link>
            <Link href="/organiser/payouts" className="btn">
              View payouts
            </Link>
            <Link href="/organiser/gate" className="btn">
              Add gate staff
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
