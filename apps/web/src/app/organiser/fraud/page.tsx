import { Badge, Card, PageHeader } from "@/components/ui";
import { FRAUD_SESSIONS } from "@/lib/organiser-data";
import { num } from "@/lib/format";

const BAND_TONE = { LOW: "success", MEDIUM: "warning", HIGH: "danger" } as const;
const STATUS_TONE = { New: "info", "In review": "warning", Reviewed: "neutral" } as const;

/**
 * Fraud monitoring (PRD screen 20 and the fraud dashboard). Scores come from the ML risk service,
 * which is built by the ML team. Here they are mock values with the same fields.
 */
export default function Fraud() {
  const count = (band: "LOW" | "MEDIUM" | "HIGH") => FRAUD_SESSIONS.filter((s) => s.band === band).length;
  const tiles = [
    { label: "Low risk", value: 32, tone: "success" as const, hint: "Allowed" },
    { label: "Medium risk", value: 18, tone: "warning" as const, hint: "Step-up check" },
    { label: "High risk", value: 7, tone: "danger" as const, hint: "Held for review" },
  ];

  return (
    <>
      <PageHeader title="Fraud monitoring" subtitle="Suspicious sessions for your events. Organisers can review, but cannot change a risk score." />

      <div className="grid-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <div className="spread">
              <span className="small muted">{t.label}</span>
              <Badge tone={t.tone}>{t.hint}</Badge>
            </div>
            <div style={{ fontSize: 30, fontWeight: 700 }} className={`t-${t.tone}`}>
              {num(t.value)}
            </div>
          </Card>
        ))}
      </div>

      <Card title="Suspicious sessions">
        <div className="row small muted">
          Flagged sessions on your events: {FRAUD_SESSIONS.length}. High-band: {count("HIGH")}.
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Session</th>
                <th className="right">Score</th>
                <th>Risk band</th>
                <th>Reason codes</th>
                <th>Event</th>
                <th>Detected</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {FRAUD_SESSIONS.map((s) => (
                <tr key={s.ref}>
                  <td className="strong">{s.ref}</td>
                  <td className="right num">{s.score}</td>
                  <td>
                    <Badge tone={BAND_TONE[s.band]}>{s.band}</Badge>
                  </td>
                  <td className="small">{s.reasons.join(", ")}</td>
                  <td className="small">{s.event}</td>
                  <td className="small muted">{s.detected}</td>
                  <td>
                    <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                  </td>
                  <td>
                    <span className="btn btn-sm btn-outline" aria-disabled="true" style={{ opacity: 0.6 }}>
                      View details
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted">Session details (evidence view) open from the admin fraud queue. Organiser access is read-only.</div>
      </Card>
    </>
  );
}
