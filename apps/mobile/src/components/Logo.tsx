import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { brandMark, colors, fontSize, fontWeight, space } from "../theme";

type Props = {
  size?: "sm" | "lg";
  showWordmark?: boolean;
};

/** Official TruTicket mark (from the supplied logo) with optional wordmark. */
export function Logo({ size = "lg", showWordmark = true }: Props) {
  const markSize = size === "lg" ? 64 : 32;
  const textSize = size === "lg" ? fontSize.xxl : fontSize.md;
  return (
    <View style={styles.wrap}>
      <Image
        source={brandMark}
        style={{ width: markSize * 1.45, height: markSize }}
        resizeMode="contain"
        accessibilityLabel="TruTicket logo"
      />
      {showWordmark ? (
        <Text style={[styles.word, { fontSize: textSize }]}>TruTicket</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space.xs },
  word: {
    color: colors.text.primary,
    fontWeight: fontWeight.bold,
  },
});
