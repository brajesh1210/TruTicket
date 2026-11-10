import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { colors, fontSize, space } from "../theme";

/**
 * Shown before any transaction (buy, resell, create event) if the email is not verified.
 * Browsing is never blocked by this screen.
 */
export default function VerifyGate() {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.icon}>✓</Text>
        <Text style={styles.title}>Verify your email to continue</Text>
        <Text style={styles.body}>
          Tickets are linked to a verified account. This keeps resale fair and stops
          bots. It takes under a minute.
        </Text>
        <Button label="Verify email" onPress={() => router.push("/login/email")} />
        <Button label="Not now" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", gap: space.lg },
  icon: {
    color: colors.brand.cyan,
    fontSize: 48,
    textAlign: "center",
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    color: colors.text.muted,
    fontSize: fontSize.md,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: space.md,
  },
});
