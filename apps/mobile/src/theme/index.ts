/**
 * Theme for the mobile app. Values come from the shared tokens file so
 * mobile and web never drift apart. Do not hard-code colours in screens.
 */
import tokens from "../../../../packages/ui-tokens/tokens.json";

export const colors = tokens.color;
export const radius = tokens.radius;
export const space = tokens.space;
export const fontSize = tokens.font.size;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const brandMark = require("../../assets/images/logo-mark.png");
