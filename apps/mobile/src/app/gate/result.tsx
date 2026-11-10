import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { GATE_TONE, isScanStatus } from "../../components/gateStatus";
import { getEvent } from "../../mock/events";
import type { ScanStatus } from "../../mock/gate";
import { getTicket } from "../../mock/tickets";
import { colors, fontSize, fontWeight, space } from "../../theme";

/**
 * Scan result (PRD screen 24). Full-screen colour, icon, and text. Haptic and audio
 * feedback come with the native build. Shows the tier and event only, no holder name.
 */
export default function ScanResultScreen() {
  const params = useLocalSearchParams<{ status: string; detail: string; ticketId: string }>();
  const raw = params.status ?? "";
  const status: ScanStatus = isScanStatus(raw) ? raw : "INVALID";
  const tone = GATE_TONE[status];
  const ticket = getTicket(params.ticketId || undefined);
  const event = ticket ? getEvent(ticket.eventId) : undefined;

  return (
    <Screen edges={["top", "bottom"]} style={{ backgroundColor: tone.bg }}>
      <View style={styles.wrap}>
        <Text style={[styles.icon, { color: tone.fg }]}>{tone.icon}</Text>
        <Text style={[styles.status, { color: tone.fg }]}>{status}</Text>
        <Text style={[styles.detail, { color: tone.fg }]}>{params.detail}</Text>

        {ticket ? (
          <View style={styles.info}>
            <Text style={[styles.infoLine, { color: tone.fg }]}>{event?.title ?? "Event"}</Text>
            <Text style={[styles.infoLine, { color: tone.fg }]}>
              {ticket.tierName} × {ticket.quantity}
            </Text>
            <Text style={[styles.infoSmall, { color: tone.fg }]}>Ticket ref: {ticket.id}</Text>
          </View>
        ) : null}
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
  info: { marginTop: space.lg, alignItems: "center", gap: space.xxs },
  infoLine: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: "center" },
  infoSmall: { fontSize: fontSize.sm, opacity: 0.85 },
});
