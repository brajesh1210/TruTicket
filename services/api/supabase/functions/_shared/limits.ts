// Every rate limit for the auth functions, in one place (PHASE2_PLAN §2.4).
// Windows are fixed (clock-aligned). Keys are per account or per IP, never per token.

export const HOUR = 3600;

export interface LimitRule {
  windowSeconds: number;
  max: number;
}

/** Sign-in with Google, per IP. Checked before the Google token is verified. */
export const GOOGLE_IP_LIMIT: LimitRule = { windowSeconds: HOUR, max: 60 };

/** The devices function, per IP. Checked before the token is read, so bad tokens are capped too. */
export const DEVICES_IP_LIMIT: LimitRule = { windowSeconds: HOUR, max: 300 };

/** The devices function, per signed-in account and per action. */
export const DEVICE_ACTION_LIMITS: Record<string, LimitRule> = {
  status: { windowSeconds: HOUR, max: 60 },
  challenge: { windowSeconds: HOUR, max: 20 },
  register: { windowSeconds: HOUR, max: 5 },
  activate: { windowSeconds: HOUR, max: 10 },
};

/** Key for a per-account device action limit. */
export function deviceActionKey(action: string, userId: string): string {
  return `devices:${action}:user:${userId}`;
}

/** Key for a per-IP limit. `scope` names the function, e.g. "google" or "devices". */
export function ipKey(scope: string, ip: string): string {
  return `${scope}:ip:${ip || "unknown"}`;
}
