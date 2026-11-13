const TIER_COLORS = ["#0ACBDB", "#8B7CF6", "#F5A524", "#22C55E"];
const TINTS: [string, string][] = [
  ["#0ACBDB", "#8B7CF6"],
  ["#8B7CF6", "#0ACBDB"],
  ["#F5A524", "#8B7CF6"],
  ["#22C55E", "#0ACBDB"],
];

/** Stable pick from a string, so the same event or tier always gets the same colour. */
export function pickStable<T>(seed: string, options: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return options[h % options.length];
}

export const tierColor = (seed: string) => pickStable(seed, TIER_COLORS);
export const eventTint = (seed: string) => pickStable(seed, TINTS);

/** Paise (integer, 1/100 rupee) to whole rupees for display. */
export const paiseToRupees = (paise: number) => Math.round(paise / 100);

const WHEN = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : WHEN.format(d);
}
