import Link from "next/link";
import { Badge, Card, Kpi, PageHeader, ProgressBar } from "@/components/ui";
import { EVENTS, available, tierRevenue } from "@/lib/organiser-data";
import { inr, num, pct } from "@/lib/format";

/** Ticket types and inventory (PRD screen 18). Counts follow the PRD state list. */
export default function Inventory() {
  // Show the Sunset event by default. The event picker is wired to the API in Phase 2.
  const e = EVENTS[0];
  const tiers = e.tiers;
  const qty = tiers.reduce((s, t) => s + t.qty, 0);
  const sold = tiers.reduce((s, t) => s + t.sold, 0);
  const avail = tiers.reduce((s, t) => s + available(t), 0);

  return (
    <>
      <PageHeader
        title="Ticket inventory"
        subtitle={`${e.title} · ${e.venue}`}
        actions={
          <>
            <span className="btn" style={{ cursor: "default" }}>
              {e.title}
            </span>
            <Link href="/organiser/create" className="btn btn-primary">
              + Add ticket type
            </Link>
          </>
        }
      />

      <div className="grid-kpi">
        <Kpi label="Ticket types" value={num(tiers.length)} />
        <Kpi label="Total quantity" value={num(qty)} />
        <Kpi label="Sold" value={num(sold)} />
        <Kpi label="Available" value={num(avail)} tone="info" hint={`${pct((avail / qty) * 100, 1)} left`} />
      </div>

      <Card title="Ticket types">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ticket type</th>
                <th className="right">Face value</th>
                <th className="right">Total qty</th>
                <th className="right">Sold</th>
                <th className="right">Available</th>
                <th>Sale window</th>
                <th className="right">Limit</th>
                <th>Status</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.name}>
                  <td className="strong">
                    <span className="dot" style={{ background: t.color, marginRight: 8 }} />
                    {t.name}
                  </td>
                  <td className="right num">{inr(t.face)}</td>
                  <td className="right num">{num(t.qty)}</td>
                  <td className="right num">
                    {num(t.sold)}
                    <div style={{ width: 110, marginLeft: "auto", marginTop: 4 }}>
                      <ProgressBar value={t.sold} max={t.qty} color={t.color} />
                    </div>
                  </td>
                  <td className="right num">{num(available(t))}</td>
                  <td className="small">{t.window}</td>
                  <td className="right num">{t.limit}</td>
                  <td>
                    <Badge tone={t.status === "On sale" ? "success" : t.status === "Paused" ? "warning" : "danger"}>
                      {t.status}
                    </Badge>
                  </td>
                  <td className="num">{inr(tierRevenue(t))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Inventory by state (PRD 17.2)">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ticket type</th>
                <th className="right">Reserved</th>
                <th className="right">Sold</th>
                <th className="right">Available</th>
                <th className="right">Group unassigned</th>
                <th className="right">Listed</th>
                <th className="right">Cancelled</th>
                <th className="right">Redeemed</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.name}>
                  <td className="strong">{t.name}</td>
                  <td className="right num">{num(t.reserved)}</td>
                  <td className="right num">{num(t.sold)}</td>
                  <td className="right num">{num(available(t))}</td>
                  <td className="right num">{num(t.groupUnassigned)}</td>
                  <td className="right num">{num(t.listed)}</td>
                  <td className="right num">{num(t.cancelled)}</td>
                  <td className="right num">{num(t.redeemed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted">
          Sold counts paid orders, and each one is minted as a ticket. Reserved holds last 10 minutes at checkout. Group
          unassigned tickets sit with the manager until members claim them (FR-027).
        </div>
      </Card>
    </>
  );
}
