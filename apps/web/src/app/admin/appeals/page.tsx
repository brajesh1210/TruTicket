import { Badge, Card, PageHeader } from "@/components/ui";
import { APPEALS } from "@/lib/admin-data";

const STATUS = { Open: "info", "In review": "warning", Resolved: "success" } as const;

/** Appeal review (reference screen 34). Appeals against suspensions, holds, and blocks. */
export default function Appeals() {
  return (
    <>
      <PageHeader title="Appeal review" subtitle="Users can appeal a suspension, a device block, or a held transfer. Each appeal has a reviewer and a decision." />
      <Card title="Appeals">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>User</th>
                <th>Type</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {APPEALS.map((a) => (
                <tr key={a.ref}>
                  <td className="strong">{a.ref}</td>
                  <td>{a.user}</td>
                  <td>{a.type}</td>
                  <td className="small muted">{a.submitted}</td>
                  <td>
                    <Badge tone={STATUS[a.status as keyof typeof STATUS]}>{a.status}</Badge>
                  </td>
                  <td>
                    <span className="btn btn-sm" aria-disabled="true">
                      {a.status === "Resolved" ? "View decision" : "Review"}
                    </span>
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
