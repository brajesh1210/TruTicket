import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { EVENTS, PAYOUTS, PAYOUT_TOTALS, eventRefunds, eventRevenue } from "@/lib/organiser-data";
import { inr } from "@/lib/format";

const STATUS_TONE = {
  Pending: "warning",
  Eligible: "info",
  Released: "success",
  Refunded: "neutral",
  Disputed: "danger",
} as const;

/** Payouts and settlements (PRD screen 22). Ledger states follow PRD 6.5 step 7. */
export default function Payouts() {
  const earnings = EVENTS.map((e) => {
    const gross = eventRevenue(e);
    const refunds = eventRefunds(e);
    const fees = Math.round(gross * 0.05); // demo: 5% platform fee on primary sales
    return { title: e.title, gross, refunds, fees, net: gross - refunds - fees };
  });

  return (
    <>
      <PageHeader
        title="Payouts & settlements"
        subtitle="Money from ticket sales, after fees and refunds."
        actions={
          <>
            <button className="btn" disabled>
              Download statement
            </button>
            <button className="btn btn-primary" disabled title="Available in Phase 2">
              Initiate payout
            </button>
          </>
        }
      />

      <div className="grid-kpi">
        <Kpi label="Available balance" value={inr(PAYOUT_TOTALS.available)} />
        <Kpi label="Total settled" value={inr(PAYOUT_TOTALS.settled)} tone="success" />
        <Kpi label="Pending settlements" value={inr(PAYOUT_TOTALS.pending)} tone="warning" />
        <Kpi label="Platform fees" value={inr(PAYOUT_TOTALS.platformFees)} />
      </div>

      <Card title="Transaction history">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Event</th>
                <th className="right">Amount</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {PAYOUTS.map((p) => (
                <tr key={p.ref}>
                  <td className="small muted">{p.date}</td>
                  <td>{p.description}</td>
                  <td className="small">{p.event}</td>
                  <td className={`right num ${p.amount < 0 ? "t-danger" : "t-success"}`}>
                    {p.amount < 0 ? `−${inr(Math.abs(p.amount))}` : `+${inr(p.amount)}`}
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                  </td>
                  <td className="small" style={{ color: "var(--cyan)" }}>
                    {p.ref}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Event-wise earnings">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th className="right">Gross sales</th>
                <th className="right">Refunds</th>
                <th className="right">Fees (5%)</th>
                <th className="right">Net earnings</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((r) => (
                <tr key={r.title}>
                  <td className="strong">{r.title}</td>
                  <td className="right num">{inr(r.gross)}</td>
                  <td className="right num t-danger">−{inr(r.refunds)}</td>
                  <td className="right num">−{inr(r.fees)}</td>
                  <td className="right num t-success">{inr(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted">
          Payouts run through Razorpay (test mode in the prototype). Ledger states follow PRD: PENDING, ELIGIBLE, RELEASED,
          REFUNDED, DISPUTED. The 5% fee here is a demo primary fee, within the PRD range of 2–5%.
        </div>
      </Card>
    </>
  );
}
