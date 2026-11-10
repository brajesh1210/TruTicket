import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

/**
 * New-device verification (PLAN 6.3). Demo flow only. The real check runs on the server in Phase 2.
 * Steps: email code, then a 48-hour cooldown, then the new device becomes active.
 * The old device gets an email alert.
 */
export default function NewDevice() {
  return (
    <Screen edges={["top", "bottom"]}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>
      <Text style={styles.heading}>New device detected</Text>
      <Text style={styles.body}>
        Your account can use one active device at a time. To move your tickets here, confirm with a code sent to your
        email.
      </Text>

      <View style={styles.card}>
        <Step n={1} title="Confirm with email code" text="A 6-digit code, valid for 10 minutes." />
        <Step n={2} title="48-hour cooldown" text="The new device becomes active after 48 hours. This blocks account takeover." />
        <Step n={3} title="Old device is signed out" text="The old phone gets an email alert and loses access to QR codes." last />
      </View>

      <View style={{ flex: 1 }} />
      <Button label="Send code to my email" onPress={() => router.push("/login/email")} testID="new-device-send" />
      <Button label="Not now" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

function Step({ n, title, text, last }: { n: number; title: string; text: string; last?: boolean }) {
  return (
    <View style={[styles.step, !last && styles.stepBorder]}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  heading: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  body: { color: colors.text.muted, fontSize: fontSize.md, lineHeight: 22, marginTop: space.sm, marginBottom: space.lg },
  card: { borderRadius: radius.lg, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.bg.border },
  step: { flexDirection: "row", gap: space.md, padding: space.md },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: colors.bg.border },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.ctaCyan,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#041014", fontWeight: fontWeight.bold },
  stepTitle: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  stepText: { color: colors.text.muted, fontSize: fontSize.sm, marginTop: space.xxs, lineHeight: 20 },
});
