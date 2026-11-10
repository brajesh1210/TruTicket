import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { canTransact, useAuth } from "../../auth/session";
import { getEvent } from "../../mock/events";
import { inr, Listing, MOCK_LISTINGS, maxResalePrice } from "../../mock/resale";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

/** Resale marketplace (mock). Every price is capped by the platform (PRD 6.5). */
export default function Resale() {
  const { session } = useAuth();
  const [reserved, setReserved] = useState<string | null>(null);

  function buy(l: Listing) {
    if (!canTransact(session)) {
      router.push("/verify-gate");
      return;
    }
    setReserved(l.id);
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>
      <Text style={styles.title}>Resale marketplace</Text>
      <Text style={styles.body}>
        Prices are capped at face value × the event cap. The platform sets the cap, not the seller.
      </Text>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {MOCK_LISTINGS.map((l) => {
          const event = getEvent(l.eventId);
          const max = maxResalePrice(l.faceValue, l.capBps);
          const left = l.transferLimit - l.transfersUsed;
          return (
            <View key={l.id} style={styles.card}>
              <Text style={styles.event}>{event?.title ?? "Event"}</Text>
              <Text style={styles.meta}>
                {event?.when} · {l.tierName}
              </Text>

              <Row label="Face value" value={inr(l.faceValue)} />
              <Row label={`Max allowed (${l.capBps / 100}%)`} value={inr(max)} />
              <Row label="Ask price" value={inr(l.ask)} strong />
              <Text style={styles.meta}>
                Transfers left: {left} of {l.transferLimit}
              </Text>

              {reserved === l.id ? (
                <Text style={styles.ok}>
                  Reserved in demo mode. Razorpay test payment and the ownership transfer come in Phase 2.
                </Text>
              ) : (
                <Button label={`Buy for ${inr(l.ask)}`} onPress={() => buy(l)} testID={`buy-${l.id}`} />
              )}
            </View>
          );
        })}

        <Button label="Sell one of my tickets" variant="secondary" onPress={() => router.push("/tickets")} />
      </ScrollView>
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
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  body: { color: colors.text.muted, fontSize: fontSize.sm, lineHeight: 20, marginTop: space.xs, marginBottom: space.md },
  list: { paddingBottom: space.xxl, gap: space.md },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bg.border,
    padding: space.md,
    gap: space.xs,
  },
  event: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  meta: { color: colors.text.muted, fontSize: fontSize.sm },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: space.xxs },
  rowLabel: { color: colors.text.muted, fontSize: fontSize.md },
  rowValue: { color: colors.text.primary, fontSize: fontSize.md },
  strong: { fontWeight: fontWeight.bold, color: colors.brand.cyan },
  ok: { color: colors.status.success, fontSize: fontSize.sm, marginTop: space.xs },
});
