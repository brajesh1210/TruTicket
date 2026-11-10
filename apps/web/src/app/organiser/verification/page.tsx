import { Badge, Card, PageHeader } from "@/components/ui";
import { VERIFICATION_STEPS } from "@/lib/organiser-data";

const TONE = { Done: "success", Pending: "warning", Waiting: "neutral" } as const;

/** Verification status (new screen, PLAN §4). Events go live only after every step is done. */
export default function Verification() {
  const done = VERIFICATION_STEPS.filter((s) => s.state === "Done").length;
  const pct = Math.round((done / VERIFICATION_STEPS.length) * 100);
  return (
    <>
      <PageHeader title="Verification status" subtitle="Complete these steps so your events can go on sale." />
      <Card title={`${done} of ${VERIFICATION_STEPS.length} steps complete`} action={<Badge tone="info">{pct}%</Badge>}>
        <div className="progress" aria-label={`${pct}% complete`}>
          <div className="progress-bar" style={{ width: `${pct}%`, background: "var(--cta)" }} />
        </div>
        <div className="stack" style={{ marginTop: 16 }}>
          {VERIFICATION_STEPS.map((s, i) => (
            <div key={s.label} className="spread" style={{ alignItems: "flex-start" }}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <span className="step-num" style={{ marginTop: 2 }}>{s.state === "Done" ? "✓" : i + 1}</span>
                <div>
                  <div className="strong" style={{ fontSize: 14 }}>{s.label}</div>
                  <div className="small muted">{s.detail}</div>
                </div>
              </div>
              <Badge tone={TONE[s.state]}>{s.state}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Why we check">
        <p className="small muted">
          Verification protects attendees from fake organisers and keeps payouts with the right business. Your documents
          are stored encrypted and used only for review.
        </p>
      </Card>
    </>
  );
}
