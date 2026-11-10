import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { ADMIN_KPIS, AUDIT, EVENT_QUEUE } from "@/lib/admin-data";

/** Platform overview (reference screen 27). */
export default function AdminOverview() {
  return (
    <>
      <PageHeader title="Platform overview" subtitle="Health of ticket sales, resale, gate, and risk across TruTicket." />
      <div className="grid-kpi">
        {ADMIN_KPIS.map((k) => (
          <Kpi key={k.label} label={k.label} value={k.value} hint={k.hint} tone={k.tone} />
        ))}
      </div>
      <div className="grid-2">
        <Card title="Events waiting on you">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Organiser</th>
                  <th>State</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {EVENT_QUEUE.map((e) => (
                  <tr key={e.title}>
                    <td className="strong">{e.title}</td>
                    <td className="small">{e.organiser}</td>
                    <td className="small">{e.state}</td>
                    <td>
                      <Badge tone={e.risk === "High" ? "danger" : e.risk === "Medium" ? "warning" : "success"}>{e.risk}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Recent audit entries">
          <ul className="list activity">
            {AUDIT.slice(0, 4).map((a) => (
              <li key={a.time + a.action}>
                <span className="muted small" style={{ minWidth: 100 }}>{a.time}</span>
                <span>
                  {a.action} · <span className="muted">{a.target}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
