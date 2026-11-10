/**
 * TruTicket design tokens — single source for mobile (Expo) and web (Next.js).
 * Values come from tokens.json. Do not hard-code colours in screens; import from here.
 */
import tokens from "./tokens.json";

export const colors = {
  brand: tokens.color.brand,
  bg: tokens.color.bg,
  text: tokens.color.text,
  status: tokens.color.status,
  tier: tokens.color.tier,
} as const;

export const radius = tokens.radius;
export const space = tokens.space;
export const font = tokens.font;
export const motion = tokens.motion;

/** Ticket tier -> colour (matches reference screens: GA cyan, VIP purple, Premium amber). */
export const tierColor = {
  GA: colors.tier.generalAdmission,
  VIP: colors.tier.vip,
  PREMIUM: colors.tier.premium,
  STUDENT: colors.tier.student,
} as const;

/** Badge variants used across Ticket, Resale and Scanner screens. */
export const badge = {
  verified: { bg: "#0F2A1C", fg: colors.status.success },
  compliant: { bg: "#0F2A1C", fg: colors.status.success },
  valid: { bg: "#0F2A1C", fg: colors.status.success },
  alreadyUsed: { bg: "#2A230F", fg: colors.status.warning },
  revoked: { bg: "#2A1010", fg: colors.status.danger },
  upcoming: { bg: "#0C2A30", fg: colors.brand.cyan },
  past: { bg: "#231A33", fg: colors.brand.purple },
} as const;

export type ColorToken = keyof typeof colors;
