import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { AuthorizeDevice } from "@/components/AuthorizeDevice";
import { GATE_STAFF } from "@/lib/organiser-data";
import { num } from "@/lib/format";

/** Gate staff management (PRD screen 21). */
export default function GateStaff() {
  const active = GATE_STAFF.filter((s) => s.status === "Active").length;
  const suspended = GATE_STAFF.filter((s) => s.status === "Suspended").length;
  const devices = GATE_STAFF.length;

  return (
    <>
      <PageHeader title="Gate staff" subtitle="Sunset Music Festival 2025 · scanners and staff allowed to admit attendees" />

      <div className="grid-kpi">
        <Kpi label="Total staff" value={num(GATE_STAFF.length)} />
        <Kpi label="Active" value={num(active)} tone="success" />
        <Kpi label="Suspended" value={num(suspended)} tone="danger" />
        <Kpi label="Devices" value={num(devices)} tone="info" />
      </div>

      <div className="grid-main">
        <Card title="Authorised staff">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Email</th>
                  <th>Gate</th>
                  <th>Device</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th>Last active</th>
                </tr>
              </thead>
              <tbody>
                {GATE_STAFF.map((s) => (
                  <tr key={s.email}>
                    <td className="strong">{s.name}</td>
                    <td className="small muted">{s.email}</td>
                    <td>{s.gate}</td>
                    <td>{s.device}</td>
                    <td className={s.verified ? "t-success" : "t-danger"}>{s.verified ? "✓" : "✕"}</td>
                    <td>
                      <Badge tone={s.status === "Active" ? "success" : "danger"}>{s.status}</Badge>
                    </td>
                    <td className="small muted">{s.lastActive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <AuthorizeDevice staff={GATE_STAFF.map((s) => s.name)} />
      </div>
    </>
  );
}
