import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { colors, fontSize, fontWeight, radius, space } from "../theme";

/** Security & devices (PRD screen 14, mock). Sessions and devices come from Phase 2. */
const DEVICES = [
  { name: "This phone · Android", detail: "Active now · Google sign-in", active: true },
  { name: "Old phone · Android", detail: "Signed out when this device was added", active: false },
];

export default function Security() {
  return (
    <Screen edges={["top", "bottom"]}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>
      <Text style={styles.heading}>Security & devices</Text>
      <Text style={styles.body}>
        One active device at a time. A new login signs out the old one, so your QR codes only work on your phone.
      </Text>

      <Text style={styles.section}>Devices</Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {DEVICES.map((d) => (
          <View key={d.name} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{d.name}</Text>
              <Text style={styles.detail}>{d.detail}</Text>
            </View>
            <Text style={[styles.pill, d.active ? styles.pillOn : styles.pillOff]}>
              {d.active ? "Active" : "Signed out"}
            </Text>
          </View>
        ))}

        <Text style={styles.section}>Try it</Text>
        <Button
          label="Simulate a new phone"
          variant="secondary"
          onPress={() => router.push("/login/new-device")}
          testID="simulate-new-device"
        />
        <Text style={styles.note}>
          Demo only. Real device checks, email alerts, and the 48-hour cooldown are built in Phase 2.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  heading: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  body: { color: colors.text.muted, fontSize: fontSize.sm, lineHeight: 20, marginTop: space.xs, marginBottom: space.md },
  section: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginTop: space.md, marginBottom: space.sm },
  list: { paddingBottom: space.xxl, gap: space.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
  },
  name: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  detail: { color: colors.text.muted, fontSize: fontSize.sm, marginTop: space.xxs },
  pill: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, paddingHorizontal: space.sm, paddingVertical: space.xxs, borderRadius: radius.pill, overflow: "hidden" },
  pillOn: { color: colors.status.success, borderWidth: 1, borderColor: colors.status.success },
  pillOff: { color: colors.text.muted, borderWidth: 1, borderColor: colors.bg.border },
  note: { color: colors.text.muted, fontSize: fontSize.sm, lineHeight: 20, marginTop: space.sm },
});
