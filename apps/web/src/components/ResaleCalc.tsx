"use client";

import { useState } from "react";
import { Card, Badge } from "./ui";
import { inr } from "@/lib/format";

/**
 * Resale policy calculator (PRD 6.5). max = face × capBps / 10000.
 * The slider sets the cap as a % of face value. 110% means up to 10% above face value.
 */
export function ResaleCalc() {
  const [cap, setCap] = useState(110);
  const [face, setFace] = useState(2499);
  const [fee, setFee] = useState(2);
  const [saved, setSaved] = useState(false);

  const max = Math.floor((face * cap) / 100);
  const feeOk = fee >= 1 && fee <= 3;
  const capOk = cap >= 100 && cap <= 150;
  const sample = [face, max];

  return (
    <div className="grid-main">
      <div className="stack">
        <Card title="Maximum resale percentage" action={<Badge tone="success">Policy active</Badge>}>
          <p className="small muted">Set the highest resale price, as a percentage of the original ticket price.</p>
          <input
            className="range"
            type="range"
            min={100}
            max={150}
            step={1}
            value={cap}
            onChange={(e) => setCap(Number(e.target.value))}
            aria-label="Maximum resale percentage"
          />
          <div className="spread small muted">
            <span>100% (no profit)</span>
            <span className="strong" style={{ color: "var(--cyan)", fontSize: 14 }}>
              {cap}%
            </span>
            <span>150%</span>
          </div>
          <div className="grid-form">
            <div className="field">
              <label>Original ticket price (₹)</label>
              <input className="input" type="number" min={1} value={face} onChange={(e) => setFace(Number(e.target.value) || 0)} />
            </div>
            <div className="field">
              <label>Platform resale fee (%)</label>
              <input className="input" type="number" min={1} max={3} step={0.5} value={fee} onChange={(e) => setFee(Number(e.target.value))} />
              <span className="hint">PRD range: 1–3%.</span>
            </div>
          </div>
          {!capOk ? <div className="notice err">Cap must be between 100% and 150%.</div> : null}
          {!feeOk ? <div className="notice err">Platform fee must be between 1% and 3%.</div> : null}
        </Card>

        <Card title="Policy details">
          <div className="grid-form">
            <div className="field">
              <label>Maximum transfer count</label>
              <select className="input" defaultValue="2">
                <option value="1">1 transfer</option>
                <option value="2">2 transfers</option>
                <option value="3">3 transfers</option>
              </select>
            </div>
            <div className="field">
              <label>Resale cutoff</label>
              <input className="input" type="datetime-local" defaultValue="2025-08-23T23:59" />
              <span className="hint">Before the event starts.</span>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Eligible ticket categories</label>
              <div className="row">
                <span className="chip on">General Admission</span>
                <span className="chip on">VIP Lounge</span>
                <span className="chip on">Student</span>
              </div>
            </div>
            <div className="field">
              <label>Policy version</label>
              <input className="input" value="v2.1 (1 Aug 2025)" readOnly />
            </div>
          </div>
        </Card>

        <div className="row">
          <button
            className="btn btn-primary"
            disabled={!capOk || !feeOk}
            onClick={() => setSaved(true)}
          >
            Save policy
          </button>
          {saved ? <span className="small t-success">Saved as a draft (demo). Policy goes on-chain in Phase 3.</span> : null}
        </div>
      </div>

      <div className="stack">
        <Card title="Price cap example">
          <p className="small muted">See how the cap works for one ticket.</p>
          <div className="price-bars">
            {sample.map((v, i) => {
              const height = Math.max(8, (v / Math.max(max, face)) * 100);
              return (
                <div key={i} className="price-bar">
                  <span className="small strong">{inr(v)}</span>
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "flex-end" }}>
                    <div className="col" style={{ height: `${height}%`, background: i === 0 ? "#8B7CF6" : "#0ACBDB" }} />
                  </div>
                  <span className="small muted">{i === 0 ? "Original price" : "Maximum resale price"}</span>
                </div>
              );
            })}
          </div>
          <div className="kv"><span>Max resale price</span><span className="strong">{inr(max)}</span></div>
          <div className="kv"><span>Platform fee ({fee}%)</span><span>{inr(Math.round((max * fee) / 100))}</span></div>
          <div className="kv"><span>Seller receives at max</span><span>{inr(max - Math.round((max * fee) / 100))}</span></div>
        </Card>

        <Card title="Why the cap is enforced">
          <p className="small muted">
            The resale price is calculated from the original face value, not from what the seller paid. The smart
            contract checks the cap again on every transfer. A listing above the cap is rejected.
          </p>
        </Card>
      </div>
    </div>
  );
}
