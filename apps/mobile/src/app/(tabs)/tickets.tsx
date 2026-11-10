import React from "react";
import { StyleSheet, Text } from "react-native";
import { Screen } from "../../components/Screen";
import { colors, fontSize, space } from "../../theme";

/** Placeholder: My Tickets (Upcoming / Past / Listed) is built in the next batch. */
export default function Tickets() {
  return (
    <Screen>
      <Text style={styles.title}>My Tickets</Text>
      <Text style={styles.body}>Coming in the next build batch.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: "700", marginTop: space.lg },
  body: { color: colors.text.muted, fontSize: fontSize.md, marginTop: space.sm },
});
