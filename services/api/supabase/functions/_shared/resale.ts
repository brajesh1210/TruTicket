// Resale rules (PRD §6.5, PHASE2_PLAN §2.8). Pure functions. The database enforces the same rules
// (resale_max_price_minor, resale_list, apply_resale_captured), so a bug here cannot list an over-cap ticket.

const MIN_CAP_BPS = 10_000; // 100%: no-profit cap
const MAX_CAP_BPS = 20_000; // 200%: sanity bound

/** Highest allowed resale price in paise: floor(face × capBps / 10000). Never rounds up. */
export function maxResalePriceMinor(faceMinor: number, capBps: number): number {
  if (!Number.isSafeInteger(faceMinor) || faceMinor < 0) {
    throw new Error("face value must be a whole number of paise");
  }
  if (!Number.isSafeInteger(capBps) || capBps < MIN_CAP_BPS || capBps > MAX_CAP_BPS) {
    throw new Error("cap must be between 10000 and 20000 basis points");
  }
  return Number((BigInt(faceMinor) * BigInt(capBps)) / 10_000n);
}

/** A price from the request body: a whole number of paise above zero, or null if it is not one. */
export function parseAskMinor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) return null;
  return value;
}

/** Shows paise as rupees with Indian grouping, for messages. 54890 -> "₹548.90". */
export function formatInr(minor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
