import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "../../components/Screen";
import { formatWhen } from "../../services/format";
import { useMyTickets } from "../../services/tickets";
import type { TicketStatusGroup } from "../../services/types";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

const TABS = ["Upcoming", "Past", "Listed"] as const;
type TabName = (typeof TABS)[number];

const STATUS_FOR_TAB: Record<TabName, TicketStatusGroup> = {
  Upcoming: "upcoming",
  Past: "past",
  Listed: "listed",
};

/** My Tickets. Data from the `tickets` function. Re-reads on focus. Layout follows the reference screens. */
export default function Tickets() {
  const [tab, setTab] = useState<TabName>("Upcoming");
  const { tickets, error, loading, reload } = useMyTickets();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const all = tickets ?? [];
  const list = all.filter((t) => t.status === STATUS_FOR_TAB[tab]);

  return (
    <Screen edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tickets</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const count = all.filter((x) => x.status === STATUS_FOR_TAB[t]).length;
          const on = t === tab;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && styles.tabActive]}
            >
              <Text style={[styles.tabText, on && styles.tabTextActive]}>
                {t} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {error ? (
          <Text style={styles.empty} onPress={reload} accessibilityRole="button">
            {error} Tap to retry.
          </Text>
        ) : loading && !tickets ? (
          <Text style={styles.empty}>Loading your tickets…</Text>
        ) : list.length === 0 ? (
          <Text style={styles.empty}>No {tab.toLowerCase()} tickets.</Text>
        ) : (
          list.map((t) => {
            const statusLabel = t.status === "listed" ? "Listed" : t.status === "past" ? "Past" : "Upcoming";
            return (
              <View key={t.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.code}>TT-{t.id.slice(0, 4).toUpperCase()}</Text>
                  <Text
                    style={[
                      styles.badge,
                      statusLabel === "Upcoming" && styles.badgeGreen,
                      statusLabel === "Listed" && styles.badgePurple,
                      statusLabel === "Past" && styles.badgeMuted,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>

                <Text style={styles.event}>{t.eventTitle}</Text>
                <Text style={styles.meta}>{formatWhen(t.startAt)}</Text>

                <View style={styles.cardBottom}>
                  <View>
                    <Text style={styles.tier}>{t.tierName.toUpperCase()}</Text>
                    <Text style={styles.price}>₹{t.faceValue.toLocaleString("en-IN")}</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: "/ticket/[id]", params: { id: t.id } })}
                    style={styles.qrBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.qrText}>{t.status === "listed" ? "View listing" : "Show QR"}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.md,
  },
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  tabs: { flexDirection: "row", gap: space.sm, marginTop: space.md, flexWrap: "wrap" },
  tab: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.bg.border,
    backgroundColor: colors.bg.card,
  },
  tabActive: { backgroundColor: colors.brand.ctaCyan, borderColor: colors.brand.ctaCyan },
  tabText: { color: colors.text.secondary, fontSize: fontSize.sm },
  tabTextActive: { color: "#0A0A0C", fontWeight: fontWeight.semibold },
  list: { paddingTop: space.md, paddingBottom: space.xxl, gap: space.md },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.bg.border,
    padding: space.md,
    gap: space.xs,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { color: colors.brand.ctaCyan, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, letterSpacing: 1 },
  badge: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  badgeGreen: { color: "#86EFAC", backgroundColor: "rgba(34,197,94,0.15)" },
  badgePurple: { color: "#C4B5FD", backgroundColor: "rgba(139,92,246,0.18)" },
  badgeMuted: { color: colors.text.muted, backgroundColor: colors.bg.raised },
  event: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: space.xs },
  meta: { color: colors.text.muted, fontSize: fontSize.sm },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: space.sm,
  },
  tier: { color: colors.brand.purple, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: 1 },
  price: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  qrBtn: {
    borderWidth: 1,
    borderColor: colors.bg.border,
    backgroundColor: colors.bg.raised,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    height: 40,
    justifyContent: "center",
  },
  qrText: { color: colors.brand.ctaCyan, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  empty: { color: colors.text.muted, fontSize: fontSize.md, textAlign: "center", marginTop: space.xl },
});
