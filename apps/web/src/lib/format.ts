/** INR formatting, Indian digit grouping (₹2,48,880). Same locale on server and browser, so no hydration drift. */
export const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const num = (n: number) => n.toLocaleString("en-IN");
export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;
