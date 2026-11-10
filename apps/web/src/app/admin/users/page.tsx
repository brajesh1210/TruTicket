import { Badge, Card, PageHeader } from "@/components/ui";
import { USERS } from "@/lib/admin-data";

const TONE = { Active: "success", Suspended: "danger", Pending: "warning" } as const;

/** User management (reference screen 28). Suspend and role changes are audited. */
export default function Users() {
  return (
    <>
      <PageHeader title="User management" subtitle="Search, verify, suspend, and change roles. Every change is written to the audit log." />
      <Card title="Users">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Email verified</th>
                <th>2FA</th>
                <th>Status</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.email}>
                  <td className="strong">{u.name}</td>
                  <td className="small muted">{u.email}</td>
                  <td>{u.role}</td>
                  <td className={u.email_verified ? "t-success" : "t-danger"}>{u.email_verified ? "✓ Verified" : "✕ Not verified"}</td>
                  <td className="small">{u.twofa}</td>
                  <td>
                    <Badge tone={TONE[u.status as keyof typeof TONE]}>{u.status}</Badge>
                  </td>
                  <td className="small muted">{u.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted">Actions such as suspend and reinstate open a confirmation dialog in Phase 2. Demo accounts are marked in Phase 2.</div>
      </Card>
    </>
  );
}
