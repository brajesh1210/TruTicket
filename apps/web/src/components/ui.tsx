import React from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  title,
  action,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <div className="card-head">
          <h2 className="card-title">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export type Tone = "success" | "warning" | "danger" | "info" | "purple" | "neutral";

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint ? <div className={`kpi-hint t-${tone ?? "neutral"}`}>{hint}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, max, color = "var(--cyan)" }: { value: number; max: number; color?: string }) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar" aria-hidden="true">
      <div className="bar-fill" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

/** Simple line chart in SVG. No chart library, so the bundle stays small. */
export function Sparkline({ values, color = "#0ACBDB", height = 140 }: { values: number[]; color?: string; height?: number }) {
  const w = 600;
  const h = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 8) - 4;
    return { x, y };
  });
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="spark" role="img" aria-label="Trend chart">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spark-fill)" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Donut({
  segments,
  center,
  sub,
}: {
  segments: { label: string; value: number; color: string }[];
  center: string;
  sub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg width="150" height="150" viewBox="0 0 140 140" role="img" aria-label="Breakdown chart">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--bg-raised)" strokeWidth="18" />
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 70 70)"
            />
          );
          acc += len;
          return el;
        })}
        <text x="70" y={sub ? 66 : 74} textAnchor="middle" className="donut-center">
          {center}
        </text>
        {sub ? (
          <text x="70" y="86" textAnchor="middle" className="donut-sub">
            {sub}
          </text>
        ) : null}
      </svg>
      <ul className="legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <b>{Math.round((s.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
