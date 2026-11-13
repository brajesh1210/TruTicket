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

/**
 * My Tickets. Data from the `tickets` function. Re-reads on focus.
 */
export default function Tickets() {
  const [tab, setTab] = useState<TabName>("Upcoming");
  const { tickets, error, loading, reload } = useMyTickets();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const list = (tickets ?? []).filter((t) => t.status === STATUS_FOR_TAB[tab]);

  return (
    <Screen edges={["top"]}>
      <Text style={styles.title}>My Tickets</Text>

      <View style={styles.links}>
        <Pressable onPress={() => router.push("/resale")} style={styles.link} accessibilityRole="button">
          <Text style={styles.linkText}>Resale market →</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: "/group/[id]", params: { id: "grp-1" } })}
          style={styles.link}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>Group tickets →</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: t === tab }}
            style={[styles.tab, t === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, t === tab && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
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
            return (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: "/ticket/[id]", params: { id: t.id } })}
                style={[styles.card, { borderLeftColor: t.tierColor }]}
                accessibilityRole="button"
              >
                <Text style={styles.event}>{t.eventTitle}</Text>
                <Text style={styles.meta}>{formatWhen(t.startAt)}</Text>
                <Text style={styles.meta}>
                  1 × {t.tierName} · ₹{t.faceValue.toLocaleString("en-IN")}
                </Text>
                <Text style={styles.open}>{t.status === "listed" ? "View listing" : "Show QR"} →</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, marginTop: space.md },
  links: { flexDirection: "row", gap: space.md, marginTop: space.sm },
  link: { paddingVertical: space.xxs },
  linkText: { color: colors.brand.cyan, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  tabs: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  tab: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.bg.border,
  },
  tabActive: { backgroundColor: colors.brand.ctaCyan, borderColor: colors.brand.ctaCyan },
  tabText: { color: colors.text.secondary, fontSize: fontSize.sm },
  tabTextActive: { color: "#041014", fontWeight: fontWeight.semibold },
  list: { paddingTop: space.md, paddingBottom: space.xxl, gap: space.md },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bg.border,
    borderLeftWidth: 4,
    padding: space.md,
    gap: space.xxs,
  },
  event: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  meta: { color: colors.text.muted, fontSize: fontSize.sm },
  open: { color: colors.brand.cyan, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: space.xs },
  empty: { color: colors.text.muted, fontSize: fontSize.md, textAlign: "center", marginTop: space.xl },
});
