import { Badge, Card, PageHeader } from "@/components/ui";

/** Organisation details (new screen, PLAN §4). Legal and contact details for payouts and tax. */
export default function Organisation() {
  return (
    <>
      <PageHeader
        title="Organisation details"
        subtitle="Legal and contact details. These appear on invoices, tickets, and payout statements."
        actions={<Badge tone="success">Verified</Badge>}
      />
      <div className="grid-main">
        <Card title="Legal entity">
          <div className="grid-form">
            <Field label="Legal name" value="TruTicket Events Pvt. Ltd." />
            <Field label="Display name" value="TruTicket Events" />
            <Field label="Entity type" value="Private limited company" />
            <Field label="GSTIN" value="27AAAAA0000A1Z5" />
            <Field label="PAN" value="AAAAA0000A" />
            <Field label="Registered address" value="Plot 12, Sector 17, Vashi, Navi Mumbai 400703" full />
          </div>
        </Card>
        <Card title="Contact">
          <div className="grid-form">
            <Field label="Support email" value="support@truticket.in" />
            <Field label="Support phone" value="+91 22 0000 0000" />
            <Field label="Website" value="https://www.truticket.in" full />
          </div>
        </Card>
      </div>
      <Card title="Signatories">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>2FA</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="strong">Kabir Mehta</td>
                <td>Owner</td>
                <td className="small muted">kabir.m@example.com</td>
                <td><Badge tone="success">TOTP on</Badge></td>
              </tr>
              <tr>
                <td className="strong">Meera Nair</td>
                <td>Finance</td>
                <td className="small muted">meera.n@example.com</td>
                <td><Badge tone="warning">Not set up</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="small muted">Editing these details needs re-verification. Changes apply after an admin review.</div>
      </Card>
    </>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className="field" style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label>{label}</label>
      <input className="input" defaultValue={value} readOnly />
    </div>
  );
}
