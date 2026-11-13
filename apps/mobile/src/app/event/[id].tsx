import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { useEvent } from "../../services/events";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, loading, error } = useEvent(id);

  if (!event) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missing}>{loading ? "Loading…" : error ?? "Event not found."}</Text>
        <Button label="Go back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[event.tint[0], event.tint[1], colors.bg.base]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
            ← Back
          </Text>
          <Text style={styles.tag}>{event.category.toUpperCase()}</Text>
        </LinearGradient>

        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.meta}>{event.when}</Text>
        <Text style={styles.meta}>{event.venue}</Text>

        <Text style={styles.section}>About</Text>
        <Text style={styles.about}>{event.about}</Text>

        <Text style={styles.section}>Tickets</Text>
        {event.tiers.map((t) => (
          <View key={t.id} style={[styles.tier, { borderLeftColor: t.color }]}>
            <View style={styles.tierTop}>
              <Text style={styles.tierName}>{t.name}</Text>
              <Text style={styles.tierPrice}>₹{t.price.toLocaleString("en-IN")}</Text>
            </View>
            {t.perks.map((p) => (
              <Text key={p} style={styles.perk}>
                • {p}
              </Text>
            ))}
            <Text style={styles.left}>{t.remaining} left</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Get tickets"
          onPress={() => router.push({ pathname: "/queue/[id]", params: { id: event.id } })}
          testID="get-tickets"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space.xxl, gap: space.sm },
  hero: {
    height: 220,
    borderRadius: radius.xl,
    padding: space.md,
    justifyContent: "space-between",
    marginTop: space.sm,
  },
  back: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  tag: {
    alignSelf: "flex-start",
    color: colors.text.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginTop: space.md,
  },
  meta: { color: colors.text.muted, fontSize: fontSize.md },
  section: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: space.lg,
  },
  about: { color: colors.text.secondary, fontSize: fontSize.md, lineHeight: 22 },
  tier: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bg.border,
    borderLeftWidth: 4,
    padding: space.md,
    gap: space.xxs,
    marginTop: space.sm,
  },
  tierTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tierName: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  tierPrice: { color: colors.brand.cyan, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  perk: { color: colors.text.muted, fontSize: fontSize.sm },
  left: { color: colors.text.secondary, fontSize: fontSize.sm, marginTop: space.xxs },
  footer: { paddingTop: space.sm },
  missing: { color: colors.text.primary, fontSize: fontSize.lg, marginTop: space.xl, textAlign: "center" },
});
