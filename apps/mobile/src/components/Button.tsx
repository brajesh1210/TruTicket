import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, fontSize, fontWeight, radius, space } from "../theme";

type Variant = "primary" | "secondary" | "ghost" | "social";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  testID,
}: Props) {
  const isDisabled = disabled || loading;
  const palette = PALETTE[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const PALETTE: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand.ctaCyan, fg: "#041014", border: colors.brand.ctaCyan },
  secondary: { bg: "transparent", fg: colors.brand.cyan, border: colors.brand.cyan },
  ghost: { bg: "transparent", fg: colors.text.secondary, border: colors.bg.border },
  social: { bg: "#FFFFFF", fg: "#111111", border: "#FFFFFF" },
};

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
