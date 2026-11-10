"use client";

import { useState } from "react";
import { Badge, Card, Donut, ProgressBar, Sparkline } from "./ui";
import { ACTIVITY, SALES_SERIES, available, tierRevenue, type Tier } from "@/lib/organiser-data";
import { inr, num, pct } from "@/lib/format";

const TABS = ["Overview", "Sales", "Inventory", "Gate", "Activity"] as const;
type TabName = (typeof TABS)[number];

/** Event detail tabs (PRD screen 17). Data comes from the server page as plain props. */
export function EventTabs({ tiers }: { tiers: Tier[] }) {
  const [tab, setTab] = useState<TabName>("Overview");
  const sold = tiers.reduce((s, t) => s + t.sold, 0);
  const grossByTier = tiers.map((t) => ({ label: t.name, value: t.sold, color: t.color }));

  return (
    <div className="stack">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab ${tab === t ? "on" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="grid-main">
          <Card title="Sales trend">
            <Sparkline values={SALES_SERIES} />
          </Card>
          <Card title="Tickets by category">
            <Donut segments={grossByTier} center={num(sold)} sub="sold" />
          </Card>
        </div>
      ) : null}

      {tab === "Sales" ? (
        <Card title="Sales by ticket type">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket type</th>
                  <th className="right">Face value</th>
                  <th className="right">Sold</th>
                  <th className="right">Revenue</th>
                  <th>Sell-through</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.name}>
                    <td className="strong">{t.name}</td>
                    <td className="right num">{inr(t.face)}</td>
                    <td className="right num">{num(t.sold)}</td>
                    <td className="right num">{inr(tierRevenue(t))}</td>
                    <td style={{ minWidth: 160 }}>
                      <ProgressBar value={t.sold} max={t.qty} color={t.color} />
                      <span className="small muted">{pct((t.sold / t.qty) * 100, 1)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {tab === "Inventory" ? (
        <Card title="Available by ticket type">
          <div className="stack">
            {tiers.map((t) => (
              <div key={t.name} className="spread">
                <div>
                  <div className="strong" style={{ fontSize: 14 }}>{t.name}</div>
                  <div className="small muted">
                    {num(available(t))} available · limit {t.limit} per account
                  </div>
                </div>
                <Badge tone={t.status === "On sale" ? "success" : t.status === "Paused" ? "warning" : "danger"}>
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === "Gate" ? (
        <Card title="Gate redemption by ticket type">
          <div className="stack">
            {tiers.map((t) => (
              <div key={t.name}>
                <div className="spread">
                  <span className="small">{t.name}</span>
                  <span className="small muted">
                    {num(t.redeemed)} of {num(t.sold)} entered
                  </span>
                </div>
                <ProgressBar value={t.redeemed} max={t.sold} color={t.color} />
              </div>
            ))}
            <div className="notice">Redemption counts come from the gate scanners. Live counts start in Phase 2.</div>
          </div>
        </Card>
      ) : null}

      {tab === "Activity" ? (
        <Card title="Event activity">
          <ul className="list activity">
            {ACTIVITY.map((a) => (
              <li key={a.text}>
                <span className="muted small" style={{ minWidth: 62 }}>{a.time}</span>
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
