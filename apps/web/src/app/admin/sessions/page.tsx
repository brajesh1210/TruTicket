import { Badge, Card, PageHeader } from "@/components/ui";
import { SESSIONS } from "@/lib/admin-data";

const BAND = { LOW: "success", MEDIUM: "warning", HIGH: "danger" } as const;

/**
 * Session investigation (reference screen 33). Read-only evidence view.
 * Decisions are recorded as admin actions in the audit log.
 */
export default function Sessions() {
  const s = SESSIONS[0];
  return (
    <>
      <PageHeader title="Session investigation" subtitle="Why a session was flagged, and what the platform did about it." />
      <Card title="Flagged sessions">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Session</th>
                <th>User</th>
                <th>Device</th>
                <th>Region</th>
                <th>Signals</th>
                <th>Band</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {SESSIONS.map((x) => (
                <tr key={x.id}>
                  <td className="strong">{x.id}</td>
                  <td>{x.user}</td>
                  <td className="small">{x.device}</td>
                  <td className="small">{x.region}</td>
                  <td className="small">{x.signals}</td>
                  <td>
                    <Badge tone={BAND[x.band as keyof typeof BAND]}>{x.band}</Badge>
                  </td>
                  <td className="small">{x.decision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid-2">
        <Card title={`Evidence · ${s.id}`}>
          <div className="kv"><span>User</span><span>{s.user}</span></div>
          <div className="kv"><span>Device</span><span>{s.device}</span></div>
          <div className="kv"><span>Region</span><span>{s.region}</span></div>
          <div className="kv"><span>Signals</span><span>{s.signals}</span></div>
          <div className="kv"><span>Decision</span><span>{s.decision}</span></div>
        </Card>
        <Card title="Next steps">
          <p className="small muted">Confirm the device with a fresh email OTP, or hold the session for manual review. Holds need a reason and are logged.</p>
          <div className="row">
            <span className="btn btn-sm" aria-disabled="true">Require re-verification</span>
            <span className="btn btn-sm btn-danger" aria-disabled="true">Revoke sessions</span>
          </div>
        </Card>
      </div>
    </>
  );
}
