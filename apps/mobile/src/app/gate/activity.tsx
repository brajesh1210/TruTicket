import React, { useReducer } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { GATE_TONE } from "../../components/gateStatus";
import { getActivity, resetGateSession } from "../../services/gate";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

const pad = (n: number) => String(n).padStart(2, "0");

/** Gate scan activity (PRD screen 25). Results and times only, no attendee names. */
export default function Activity() {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const items = getActivity();

  function reset() {
    resetGateSession();
    refresh();
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>
      <Text style={styles.heading}>Scan activity</Text>
      <Text style={styles.body}>This shift · this device · {items.length} scans</Text>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? <Text style={styles.empty}>No scans yet.</Text> : null}
        {items.map((r, i) => {
          const d = new Date(r.atSec * 1000);
          const tone = GATE_TONE[r.status];
          return (
            <View key={`${r.atSec}-${i}`} style={styles.row}>
              <Text style={styles.time}>
                {pad(d.getHours())}:{pad(d.getMinutes())}:{pad(d.getSeconds())}
              </Text>
              <View style={{ flex: 1, gap: space.xxs }}>
                <View style={styles.statusRow}>
                  <View style={[styles.dot, { backgroundColor: tone.bg }]} />
                  <Text style={styles.status}>{r.status}</Text>
                </View>
                <Text style={styles.meta}>{r.detail}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Button label="Start new shift (clear log)" variant="ghost" onPress={reset} testID="reset-shift" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  heading: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  body: { color: colors.text.muted, fontSize: fontSize.sm, marginTop: space.xxs, marginBottom: space.md },
  list: { gap: space.xs, paddingBottom: space.md },
  row: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
  },
  time: { color: colors.text.secondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, width: 72 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  meta: { color: colors.text.muted, fontSize: fontSize.sm },
  empty: { color: colors.text.muted, fontSize: fontSize.md, textAlign: "center", marginTop: space.xl },
});
