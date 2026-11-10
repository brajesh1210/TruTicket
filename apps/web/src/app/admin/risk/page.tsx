import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { RISK_EVENTS } from "@/lib/admin-data";

const BAND = { LOW: "success", MEDIUM: "warning", HIGH: "danger" } as const;

/** Risk events queue (reference screen 32). Scores come from the ML risk service (out of scope for this build). */
export default function RiskQueue() {
  const open = RISK_EVENTS.filter((r) => r.status !== "Closed").length;
  const high = RISK_EVENTS.filter((r) => r.band === "HIGH").length;
  return (
    <>
      <PageHeader title="Risk events queue" subtitle="Flagged activity ranked by score. Start with HIGH band items." />
      <div className="grid-kpi">
        <Kpi label="Open events" value={String(open)} tone="info" />
        <Kpi label="High band" value={String(high)} tone="danger" />
        <Kpi label="Closed today" value="4" tone="success" />
        <Kpi label="Median time to triage" value="11 min" />
      </div>
      <Card title="Queue">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Type</th>
                <th>Band</th>
                <th className="right">Score</th>
                <th>Event</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {RISK_EVENTS.map((r) => (
                <tr key={r.ref}>
                  <td className="strong">{r.ref}</td>
                  <td>{r.type}</td>
                  <td>
                    <Badge tone={BAND[r.band as keyof typeof BAND]}>{r.band}</Badge>
                  </td>
                  <td className="right num">{r.score}</td>
                  <td className="small">{r.event}</td>
                  <td className="small">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
