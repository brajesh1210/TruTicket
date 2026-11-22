import React, { useReducer } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { isGateStaff, useAuth } from "../../auth/session";
import { GATE_TONE } from "../../components/gateStatus";
import { getActivity, resetGateSession } from "../../services/gate";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

const pad = (n: number) => String(n).padStart(2, "0");

/** Gate scan activity (PRD screen 25). Results and times only, no attendee names. */
export default function Activity() {
  const { session } = useAuth();
  const allowed = isGateStaff(session);

  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const items = getActivity();

  if (!allowed) {
    return (
      <Screen edges={["top", "bottom"]}>
        <View style={styles.restrictedWrap}>
          <Text style={styles.heading}>Gate staff only</Text>
          <Text style={styles.body}>This function is restricted to authorized gate staff.</Text>
          <Button label="Back to Home" onPress={() => router.replace("/(tabs)")} />
        </View>
      </Screen>
    );
  }

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

      <View style={styles.footer}>
        <Button label="Reset shift" variant="secondary" onPress={reset} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  restrictedWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: space.md },
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  heading: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  body: { color: colors.text.muted, fontSize: fontSize.md, marginTop: space.xs, marginBottom: space.md },
  empty: { color: colors.text.muted, fontSize: fontSize.md, textAlign: "center", marginTop: space.xl },
  list: { gap: space.sm, paddingBottom: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
  },
  time: { color: colors.text.muted, fontSize: fontSize.xs, fontFamily: "monospace" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { color: colors.text.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  meta: { color: colors.text.muted, fontSize: fontSize.xs },
  footer: { paddingTop: space.sm },
});
