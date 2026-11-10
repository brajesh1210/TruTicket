import { Badge, Card, PageHeader } from "@/components/ui";
import { ResaleCalc } from "@/components/ResaleCalc";
import { RESALE_LISTINGS } from "@/lib/organiser-data";
import { inr } from "@/lib/format";

/** Resale policy and control (PRD screens 20 and the policy part of 16). */
export default function ResalePolicy() {
  return (
    <>
      <PageHeader title="Resale policy" subtitle="Set the price cap, transfer limits, and cutoff for your events." />
      <ResaleCalc />

      <Card title="Active resale listings and cap compliance">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Event</th>
                <th>Ticket type</th>
                <th className="right">Face value</th>
                <th className="right">Ask price</th>
                <th>Cap check</th>
              </tr>
            </thead>
            <tbody>
              {RESALE_LISTINGS.map((l) => (
                <tr key={l.ref}>
                  <td className="strong">{l.ref}</td>
                  <td>{l.event}</td>
                  <td>{l.tier}</td>
                  <td className="right num">{inr(l.face)}</td>
                  <td className="right num">{inr(l.ask)}</td>
                  <td>
                    <Badge tone={l.status === "Compliant" ? "success" : "danger"}>{l.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted">Listings over the cap are blocked on the server. This table shows any that slipped through for review.</div>
      </Card>
    </>
  );
}
