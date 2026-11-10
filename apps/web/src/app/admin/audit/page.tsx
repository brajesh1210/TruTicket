import { Badge, Card, PageHeader } from "@/components/ui";
import { AUDIT } from "@/lib/admin-data";

const TONE = { Success: "success", Held: "warning", Blocked: "danger", Pending: "info" } as const;

/** Audit logs (reference screen 31). Append-only. Nothing here can be edited or deleted. */
export default function Audit() {
  return (
    <>
      <PageHeader title="Audit logs" subtitle="Append-only record of admin, system, and gate actions. Entries cannot be edited or deleted." />
      <Card title="Entries">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {AUDIT.map((a) => (
                <tr key={a.time + a.action}>
                  <td className="small muted">{a.time}</td>
                  <td className="small">{a.actor}</td>
                  <td>{a.action}</td>
                  <td className="small">{a.target}</td>
                  <td>
                    <Badge tone={TONE[a.result as keyof typeof TONE]}>{a.result}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
