import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { canTransact, useAuth } from "../../auth/session";
import { useEvent } from "../../services/events";
import { checkoutPageUrl, createOrder, reserveTickets } from "../../services/checkout";
import { ApiError, messageOf } from "../../services/errors";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

const MAX_PER_ORDER = 10; // server limit (events reserve: 1 to 10)

/**
 * Checkout (PHASE2_PLAN §2.6, §2.9). Holds the seats, creates a Razorpay order, then opens
 * Razorpay's hosted payment page in the browser. Tickets are issued only after the webhook
 * confirms the payment, so this screen never shows "paid" by itself.
 */
export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, loading, error: loadError } = useEvent(id);
  const { session } = useAuth();
  const [tierId, setTierId] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const tier = useMemo(
    () => event?.tiers.find((t) => t.id === (tierId ?? event.tiers[0]?.id)),
    [event, tierId],
  );

  if (!event || !tier) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missing}>{loading ? "Loading…" : loadError ?? "Event not found."}</Text>
      </Screen>
    );
  }

  const ev = event;
  const tr = tier;
  const subtotal = tr.price * qty;
  const maxQty = Math.max(1, Math.min(MAX_PER_ORDER, tr.perAccountLimit, tr.remaining));

  async function pay() {
    // Verified email gate: transactions need a verified email (Plan v3).
    if (!canTransact(session)) {
      router.push("/verify-gate");
      return;
    }
    setPayError(null);
    setPaying(true);
    try {
      const hold = await reserveTickets(tr.id, qty);
      const order = await createOrder(hold.reservation_id);
      setPaying(false);
      await WebBrowser.openBrowserAsync(checkoutPageUrl(order.razorpay_order_id));
      router.replace({
        pathname: "/success",
        params: { eventId: ev.id, tier: tr.name, qty: String(qty), orderId: order.order_id },
      });
    } catch (e) {
      setPaying(false);
      if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED") {
        router.push("/verify-gate");
        return;
      }
      setPayError(messageOf(e, "Could not start payment. Try again."));
    }
  }

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>
      <Text style={styles.title}>Checkout</Text>
      <Text style={styles.sub}>{event.title} · {event.venue}</Text>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>Ticket type</Text>
        {event.tiers.map((t) => {
          const active = t.id === tr.id;
          const soldOut = t.remaining <= 0;
          return (
            <Pressable
              key={t.id}
              disabled={soldOut}
              onPress={() => {
                setTierId(t.id);
                setQty(1);
              }}
              style={[styles.option, active && { borderColor: t.color }, soldOut && { opacity: 0.5 }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: soldOut }}
            >
              <View style={[styles.dot, { backgroundColor: t.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optName}>{t.name}</Text>
                <Text style={styles.optMeta}>{soldOut ? "Sold out" : `${t.remaining} left`}</Text>
              </View>
              <Text style={styles.optPrice}>₹{t.price.toLocaleString("en-IN")}</Text>
            </Pressable>
          );
        })}

        <Text style={styles.section}>Quantity</Text>
        <View style={styles.stepper}>
          <Button label="−" variant="secondary" onPress={() => setQty((q) => Math.max(1, q - 1))} style={styles.stepBtn} />
          <Text style={styles.qty}>{qty}</Text>
          <Button label="+" variant="secondary" onPress={() => setQty((q) => Math.min(maxQty, q + 1))} style={styles.stepBtn} />
        </View>
        <Text style={styles.note}>Max {maxQty} tickets for this type.</Text>

        <Text style={styles.section}>Summary</Text>
        <View style={styles.summary}>
          <Row label={`${tr.name} × ${qty}`} value={`₹${subtotal.toLocaleString("en-IN")}`} />
          <View style={styles.line} />
          <Row label="Total" value={`₹${subtotal.toLocaleString("en-IN")}`} strong />
        </View>
        <Text style={styles.note}>Seats are held for 10 minutes. Taxes and fees are shown on the payment page.</Text>
        {payError ? <Text style={styles.error}>{payError}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={canTransact(session) ? `Pay ₹${subtotal.toLocaleString("en-IN")}` : "Verify email to continue"}
          onPress={pay}
          loading={paying}
          disabled={tr.remaining <= 0}
          testID="pay"
        />
      </View>
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  sub: { color: colors.text.muted, fontSize: fontSize.sm, marginBottom: space.sm },
  body: { paddingBottom: space.xl, gap: space.sm },
  section: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: space.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bg.border,
    backgroundColor: colors.bg.card,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  optName: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  optMeta: { color: colors.text.muted, fontSize: fontSize.sm },
  optPrice: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepBtn: { width: 64, height: 48 },
  qty: { color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.bold, minWidth: 32, textAlign: "center" },
  note: { color: colors.text.muted, fontSize: fontSize.sm },
  error: { color: colors.status.danger, fontSize: fontSize.sm },
  summary: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
    gap: space.xs,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: colors.text.secondary, fontSize: fontSize.md },
  rowValue: { color: colors.text.primary, fontSize: fontSize.md },
  strong: { fontWeight: fontWeight.bold, color: colors.text.primary },
  line: { height: 1, backgroundColor: colors.bg.border, marginVertical: space.xs },
  footer: { paddingTop: space.sm },
  missing: { color: colors.text.primary, fontSize: fontSize.lg, marginTop: space.xl, textAlign: "center" },
});
