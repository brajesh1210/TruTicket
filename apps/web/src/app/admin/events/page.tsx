import { Badge, Card, PageHeader } from "@/components/ui";
import { EVENT_QUEUE } from "@/lib/admin-data";

const STATE_TONE = { Published: "success", "Pending review": "warning", Paused: "danger" } as const;

/** Event moderation (reference screen 29). Approve, pause, or reject events. */
export default function Moderation() {
  return (
    <>
      <PageHeader title="Event moderation" subtitle="Review events before they go on sale. Pausing an event stops checkout immediately." />
      <Card title="Moderation queue">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Organiser</th>
                <th>Submitted</th>
                <th>State</th>
                <th>Risk</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {EVENT_QUEUE.map((e) => (
                <tr key={e.title}>
                  <td className="strong">{e.title}</td>
                  <td className="small">{e.organiser}</td>
                  <td className="small muted">{e.submitted}</td>
                  <td>
                    <Badge tone={STATE_TONE[e.state as keyof typeof STATE_TONE]}>{e.state}</Badge>
                  </td>
                  <td>
                    <Badge tone={e.risk === "High" ? "danger" : e.risk === "Medium" ? "warning" : "success"}>{e.risk}</Badge>
                  </td>
                  <td>
                    <div className="row">
                      <span className="btn btn-sm" aria-disabled="true">Review</span>
                      <span className="btn btn-sm btn-danger" aria-disabled="true">Pause</span>
                    </div>
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
