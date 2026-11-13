import { colors } from "../theme";
import type { ScanStatus } from "../services/gate";

/** Full-screen colour and icon for each gate result (PRD screen 24). */
export const GATE_TONE: Record<ScanStatus, { bg: string; fg: string; icon: string }> = {
  VALID: { bg: colors.status.success, fg: "#041014", icon: "✓" },
  "ALREADY USED": { bg: colors.status.danger, fg: "#FFFFFF", icon: "✕" },
  EXPIRED: { bg: colors.status.danger, fg: "#FFFFFF", icon: "✕" },
  REVOKED: { bg: colors.status.danger, fg: "#FFFFFF", icon: "✕" },
  INVALID: { bg: colors.status.danger, fg: "#FFFFFF", icon: "✕" },
  "WRONG EVENT": { bg: colors.status.danger, fg: "#FFFFFF", icon: "✕" },
  "OFFLINE-UNVERIFIED": { bg: colors.status.warning, fg: "#111111", icon: "!" },
};

export function isScanStatus(value: string): value is ScanStatus {
  return value in GATE_TONE;
}
