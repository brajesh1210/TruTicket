import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../../../components/Button";
import { Field } from "../../../components/Field";
import { Screen } from "../../../components/Screen";
import { canTransact, useAuth } from "../../../auth/session";
import { getEvent } from "../../../mock/events";
import { getTicket, listTicket } from "../../../mock/tickets";
import {
  askError,
  DEFAULT_CAP_BPS,
  faceValueFor,
  inr,
  maxResalePrice,
  PLATFORM_FEE_PCT,
  platformFee,
  sellerNet,
} from "../../../mock/resale";
import { colors, fontSize, fontWeight, radius, space } from "../../../theme";

/**
 * List one of my tickets for resale (PRD 6.5, steps 1–3).
 * The ask is capped by the platform. Once listed, the QR is hidden and the ticket
 * cannot be scanned at the gate.
 */
export default function SellTicket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const ticket = getTicket(id);
  const event = ticket ? getEvent(ticket.eventId) : undefined;
  const face = ticket ? faceValueFor(ticket) : 0;
  const cap = maxResalePrice(face, DEFAULT_CAP_BPS);

  const [askText, setAskText] = useState(String(cap));
  const [done, setDone] = useState(false);

  if (!ticket || !event) {
    return (
      <Screen>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Back
        </Text>
        <Text style={styles.heading}>Ticket not found.</Text>
      </Screen>
    );
  }

  const tk = ticket;
  const ask = Number(askText.replace(/[^0-9]/g, ""));
  const err = askText.length > 0 ? askError(ask, cap) : "Enter a price in rupees.";

  function onList() {
    if (!canTransact(session)) {
      router.push("/verify-gate");
      return;
    }
    if (err) return;
    listTicket(tk.id);
    setDone(true);
  }

  if (tk.status !== "upcoming") {
    return (
      <Screen>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Back
        </Text>
        <Text style={styles.heading}>This ticket cannot be listed.</Text>
        <Text style={styles.body}>Only upcoming tickets can be listed for resale.</Text>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <View style={styles.doneWrap}>
          <Text style={styles.doneIcon}>✓</Text>
          <Text style={styles.heading}>Listed for {inr(ask)}</Text>
          <Text style={styles.body}>
            The QR is hidden while this ticket is listed, so it cannot be used at the gate. You can cancel the listing
            from the ticket screen.
          </Text>
          <Button label="Done" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>
      <Text style={styles.heading}>List for resale</Text>
      <Text style={styles.body}>
        {event.title} · {tk.tierName} × {tk.quantity}
      </Text>

      <View style={styles.card}>
        <Row label="Face value (immutable)" value={inr(face)} />
        <Row label={`Maximum ask (${DEFAULT_CAP_BPS / 100}%)`} value={inr(cap)} />
      </View>

      <Field
        label="Your ask price (₹)"
        value={askText}
        onChangeText={(t) => setAskText(t.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        error={askText.length > 0 && err ? err : null}
        testID="ask-input"
      />

      <View style={styles.card}>
        <Row label={`Platform fee (${PLATFORM_FEE_PCT}%)`} value={`− ${inr(platformFee(Math.max(ask, 0)))}`} />
        <Row label="You receive" value={inr(sellerNet(Math.max(ask, 0)))} strong />
      </View>

      <View style={{ flex: 1 }} />
      <Button label="List for resale" onPress={onList} disabled={!!err} testID="confirm-list" />
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  heading: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, marginBottom: space.xs },
  body: { color: colors.text.muted, fontSize: fontSize.md, lineHeight: 22, marginBottom: space.lg },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bg.border,
    padding: space.md,
    marginBottom: space.md,
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: space.xxs },
  rowLabel: { color: colors.text.muted, fontSize: fontSize.md },
  rowValue: { color: colors.text.primary, fontSize: fontSize.md },
  strong: { color: colors.brand.cyan, fontWeight: fontWeight.bold },
  doneWrap: { flex: 1, justifyContent: "center", gap: space.lg },
  doneIcon: { color: colors.status.success, fontSize: 48, textAlign: "center" },
});
