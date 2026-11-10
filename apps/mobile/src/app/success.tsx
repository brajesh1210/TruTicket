import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { getEvent } from "../mock/events";
import { colors, fontSize, fontWeight, radius, space } from "../theme";

export default function Success() {
  const { eventId, tier, qty, total } = useLocalSearchParams<{
    eventId: string;
    tier: string;
    qty: string;
    total: string;
  }>();
  const event = getEvent(eventId);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.center}>
        <View style={styles.badge}>
          <Text style={styles.check}>✓</Text>
        </View>
        <Text style={styles.title}>Booking confirmed</Text>
        <Text style={styles.sub}>
          {qty} × {tier} · {event?.title ?? "Event"}
        </Text>
        <Text style={styles.total}>Paid ₹{Number(total ?? 0).toLocaleString("en-IN")} (demo)</Text>
        <Text style={styles.note}>
          Your tickets are in My Tickets. Each ticket has a QR code that changes every 30 seconds, so screenshots do not work at the gate.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="View my tickets" onPress={() => router.replace("/(tabs)/tickets")} testID="view-tickets" />
        <Button label="Back to home" variant="ghost" onPress={() => router.replace("/(tabs)")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingHorizontal: space.md },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#0F2A1C",
    borderWidth: 2,
    borderColor: colors.status.success,
    alignItems: "center",
    justifyContent: "center",
  },
  check: { color: colors.status.success, fontSize: 48, fontWeight: fontWeight.bold },
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  sub: { color: colors.text.secondary, fontSize: fontSize.md, textAlign: "center" },
  total: { color: colors.brand.cyan, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  note: { color: colors.text.muted, fontSize: fontSize.sm, textAlign: "center", lineHeight: 20 },
  footer: { gap: space.sm, paddingBottom: space.md },
});
