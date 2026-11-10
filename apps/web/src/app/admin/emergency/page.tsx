import { Badge, Card, PageHeader } from "@/components/ui";
import { EMERGENCY_ACTIONS } from "@/lib/admin-data";

/** Emergency protocol (reference screen 30). PRD §21 risk fallbacks. Actions need two admins in Phase 2. */
export default function Emergency() {
  return (
    <>
      <PageHeader
        title="Emergency protocol"
        subtitle="Controls for incidents: a fake ticket wave, a venue safety issue, or a payment outage."
        actions={<Badge tone="neutral">Mode: Off</Badge>}
      />
      <div className="notice err">
        Emergency actions affect every live event. Each one needs a second admin to confirm, and each is logged in the audit trail.
      </div>
      <div className="grid-2">
        {EMERGENCY_ACTIONS.map((a) => (
          <Card key={a.title} title={a.title} action={<Badge tone={a.danger ? "danger" : "warning"}>{a.danger ? "High impact" : "Medium"}</Badge>}>
            <p className="small muted">{a.detail}</p>
            <span className="btn btn-sm" aria-disabled="true" style={{ opacity: 0.6 }}>
              Request with second admin
            </span>
          </Card>
        ))}
      </div>
      <Card title="Runbook">
        <ol className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Confirm the incident with the venue or the on-call lead.</li>
          <li>Choose the smallest control that stops the harm. Start with gate-only mode.</li>
          <li>Second admin confirms the action and the reason.</li>
          <li>Notify organisers, then post an update to attendees.</li>
          <li>Turn the mode off and log the outcome in the audit trail.</li>
        </ol>
      </Card>
    </>
  );
}
