import React from "react";
import { StyleSheet, Text } from "react-native";
import { Screen } from "../../components/Screen";
import { colors, fontSize, space } from "../../theme";

/** Placeholder: built in the next Phase 1 batch. */
export default function Categories() {
  return (
    <Screen>
      <Text style={styles.title}>Categories</Text>
      <Text style={styles.body}>Coming in the next build batch.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: "700", marginTop: space.lg },
  body: { color: colors.text.muted, fontSize: fontSize.md, marginTop: space.sm },
});
