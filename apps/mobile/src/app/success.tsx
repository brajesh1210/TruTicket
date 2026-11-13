import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { fetchMyTickets } from "../services/tickets";
import { colors, fontSize, fontWeight, space } from "../theme";

const POLL_MS = 3000;
const MAX_WAIT_MS = 60_000;

type Phase = "checking" | "confirmed" | "pending";

/**
 * After the hosted payment page closes, the app waits for the webhook to issue the tickets.
 * The tickets are the proof: this screen only says "confirmed" once new tickets for this
 * event show up in My Tickets.
 */
export default function Success() {
  const { eventId, tier, qty, orderId } = useLocalSearchParams<{
    eventId: string;
    tier: string;
    qty: string;
    orderId: string;
  }>();
  const [phase, setPhase] = useState<Phase>("checking");
  const [count, setCount] = useState(0);
  const baseline = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();

    async function poll() {
      try {
        const mine = (await fetchMyTickets()).filter((t) => t.eventId === eventId && t.status !== "past");
        if (!alive) return;
        if (baseline.current === null) baseline.current = mine.length;
        const fresh = mine.length - baseline.current;
        if (fresh > 0) {
          setCount(fresh);
          setPhase("confirmed");
          return;
        }
      } catch {
        // Keep polling: a short network blip should not end the wait.
      }
      if (!alive) return;
      if (Date.now() - started > MAX_WAIT_MS) {
        setPhase("pending");
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    }

    timer = setTimeout(poll, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [eventId]);

  const title =
    phase === "confirmed" ? "Booking confirmed" : phase === "pending" ? "Payment not confirmed yet" : "Confirming your payment…";

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.center}>
        <View style={[styles.badge, phase === "pending" && styles.badgeWait]}>
          <Text style={[styles.check, phase === "pending" && styles.checkWait]}>
            {phase === "confirmed" ? "✓" : phase === "pending" ? "!" : "…"}
          </Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          {qty} × {tier}
        </Text>
        {phase === "confirmed" ? (
          <Text style={styles.note}>{count} ticket{count === 1 ? "" : "s"} added to My Tickets. The gate QR refreshes every 10 seconds.</Text>
        ) : phase === "pending" ? (
          <Text style={styles.note}>
            No money is taken twice. Check My Tickets in a minute. Order ref: {orderId}
          </Text>
        ) : (
          <Text style={styles.note}>This takes a few seconds. Keep this screen open.</Text>
        )}
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
  badgeWait: { backgroundColor: "#2A220F", borderColor: colors.status.warning },
  check: { color: colors.status.success, fontSize: 48, fontWeight: fontWeight.bold },
  checkWait: { color: colors.status.warning },
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, textAlign: "center" },
  sub: { color: colors.text.secondary, fontSize: fontSize.md, textAlign: "center" },
  note: { color: colors.text.muted, fontSize: fontSize.sm, textAlign: "center", lineHeight: 20 },
  footer: { gap: space.sm, paddingBottom: space.md },
});
