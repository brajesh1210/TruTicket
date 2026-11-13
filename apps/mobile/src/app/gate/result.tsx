import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { GATE_TONE, isScanStatus } from "../../components/gateStatus";
import { fontSize, fontWeight, space } from "../../theme";
import type { ScanStatus } from "../../services/gate";

/**
 * Scan result (PRD screen 24). Full-screen colour, icon, and text. The server's answer only:
 * no holder name and no ticket details are shown here.
 */
export default function ScanResultScreen() {
  const params = useLocalSearchParams<{ status: string; detail: string }>();
  const raw = params.status ?? "";
  const status: ScanStatus = isScanStatus(raw) ? raw : "INVALID";
  const tone = GATE_TONE[status];

  return (
    <Screen edges={["top", "bottom"]} style={{ backgroundColor: tone.bg }}>
      <View style={styles.wrap}>
        <Text style={[styles.icon, { color: tone.fg }]}>{tone.icon}</Text>
        <Text style={[styles.status, { color: tone.fg }]}>{status}</Text>
        <Text style={[styles.detail, { color: tone.fg }]}>{params.detail}</Text>
      </View>

      <Button label="Next scan" variant="secondary" onPress={() => router.back()} testID="next-scan" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: space.md, paddingHorizontal: space.md },
  icon: { fontSize: 96, fontWeight: fontWeight.bold },
  status: { fontSize: fontSize.display, fontWeight: fontWeight.bold, textAlign: "center" },
  detail: { fontSize: fontSize.lg, textAlign: "center", lineHeight: 26 },
});
