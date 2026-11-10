import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { QrView } from "../../components/QrView";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Screen } from "../../components/Screen";
import { getEvent } from "../../mock/events";
import { getTicket } from "../../mock/tickets";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

const REFRESH_SECONDS = 30;

/**
 * Ticket with a demo QR. The payload is NOT secure yet: it is built on the device from
 * the ticket id and the 30-second window, so anyone can reproduce it. The real gate QR
 * is a server-signed token with a nonce, verified by the scanner (Phase 2/3).
 */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticket = getTicket(id);
  const event = ticket ? getEvent(ticket.eventId) : undefined;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!ticket || !event) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missing}>Ticket not found.</Text>
      </Screen>
    );
  }

  // Wall-clock aligned: the QR and the countdown both use the same 30-second window.
  // `tick` only forces a re-render every second.
  void tick;
  const nowSec = Math.floor(Date.now() / 1000);
  const windowIndex = Math.floor(nowSec / REFRESH_SECONDS);
  const secondsLeft = REFRESH_SECONDS - (nowSec % REFRESH_SECONDS);
  const payload = `TT|${ticket.id}|${windowIndex}`;
  const isListed = ticket.status === "listed";

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { borderTopColor: ticket.tierColor }]}>
          <Text style={styles.event}>{event.title}</Text>
          <Text style={styles.meta}>{event.when}</Text>
          <Text style={styles.meta}>{event.venue}</Text>

          <View style={styles.qrWrap}>
            {isListed ? (
              <View style={styles.listed}>
                <Text style={styles.listedText}>Listed for resale</Text>
                <Text style={styles.meta}>QR is hidden while listed.</Text>
              </View>
            ) : (
              <QrView value={payload} size={220} color="#000000" backgroundColor="#FFFFFF" />
            )}
          </View>

          {!isListed ? (
            <Text style={styles.refresh}>
              Demo QR refreshes in {secondsLeft}s. The real gate QR will be signed by the server (Phase 2).
            </Text>
          ) : null}
        </View>

        <View style={styles.details}>
          <Detail label="Ticket" value={ticket.tierName} />
          <Detail label="Quantity" value={String(ticket.quantity)} />
          <Detail label="Seat / area" value={ticket.seat} />
          <Detail label="Holder" value={ticket.holder} />
          <Detail label="Status" value={ticket.status} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  body: { paddingBottom: space.xxl, gap: space.md },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.bg.border,
    borderTopWidth: 4,
    padding: space.lg,
    alignItems: "center",
    gap: space.xs,
  },
  event: { color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: "center" },
  meta: { color: colors.text.muted, fontSize: fontSize.sm, textAlign: "center" },
  qrWrap: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: "#FFFFFF",
  },
  listed: { width: 220, height: 220, alignItems: "center", justifyContent: "center", gap: space.xs },
  listedText: { color: "#111111", fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  refresh: { color: colors.text.secondary, fontSize: fontSize.sm, marginTop: space.sm, textAlign: "center" },
  details: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bg.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.border,
  },
  rowLabel: { color: colors.text.muted, fontSize: fontSize.md },
  rowValue: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold, maxWidth: "60%", textAlign: "right" },
  missing: { color: colors.text.primary, fontSize: fontSize.lg, marginTop: space.xl, textAlign: "center" },
});
