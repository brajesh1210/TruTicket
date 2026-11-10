import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { canTransact, useAuth } from "../../auth/session";
import { getEvent } from "../../mock/events";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

const MAX_PER_ORDER = 4; // PRD: limit per user per event (demo value)
const SERVICE_FEE_PCT = 0.02; // demo value; real fee rules come from Phase 2

export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = getEvent(id);
  const { session } = useAuth();
  const [tierId, setTierId] = useState<string | undefined>(event?.tiers[0]?.id);
  const [qty, setQty] = useState(1);
  const [paying, setPaying] = useState(false);

  const tier = useMemo(() => event?.tiers.find((t) => t.id === tierId), [event, tierId]);

  if (!event || !tier) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missing}>Event not found.</Text>
      </Screen>
    );
  }

  const subtotal = tier.price * qty;
  const fee = Math.round(subtotal * SERVICE_FEE_PCT);
  const total = subtotal + fee;
  const maxQty = Math.min(MAX_PER_ORDER, tier.remaining);
  const ev = event;
  const tr = tier;

  function pay() {
    // Verified email gate: transactions need a verified email (Plan v3, D-rules).
    if (!canTransact(session)) {
      router.push("/verify-gate");
      return;
    }
    setPaying(true);
    // Mock payment. Razorpay test mode is added in Phase 5.
    setTimeout(() => {
      setPaying(false);
      router.replace({
        pathname: "/success",
        params: { eventId: ev.id, tier: tr.name, qty: String(qty), total: String(total) },
      });
    }, 900);
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
          const active = t.id === tierId;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                setTierId(t.id);
                setQty(1);
              }}
              style={[styles.option, active && { borderColor: t.color }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.dot, { backgroundColor: t.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optName}>{t.name}</Text>
                <Text style={styles.optMeta}>{t.remaining} left</Text>
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
        <Text style={styles.note}>Max {maxQty} tickets per order.</Text>

        <Text style={styles.section}>Summary</Text>
        <View style={styles.summary}>
          <Row label={`${tier.name} × ${qty}`} value={`₹${subtotal.toLocaleString("en-IN")}`} />
          <Row label="Service fee (2%)" value={`₹${fee.toLocaleString("en-IN")}`} />
          <View style={styles.line} />
          <Row label="Total" value={`₹${total.toLocaleString("en-IN")}`} strong />
        </View>
        <Text style={styles.note}>Demo checkout. No real payment is taken in this build.</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={canTransact(session) ? `Pay ₹${total.toLocaleString("en-IN")}` : "Verify email to continue"}
          onPress={pay}
          loading={paying}
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
