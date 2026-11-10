import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../components/Screen";
import { getEvent } from "../../mock/events";
import { MOCK_TICKETS, MockTicket } from "../../mock/tickets";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

const TABS = ["Upcoming", "Past", "Listed"] as const;
type TabName = (typeof TABS)[number];

const STATUS_FOR_TAB: Record<TabName, MockTicket["status"]> = {
  Upcoming: "upcoming",
  Past: "past",
  Listed: "listed",
};

/** My Tickets (mock). Real data comes from the tickets table in Phase 2. */
export default function Tickets() {
  const [tab, setTab] = useState<TabName>("Upcoming");

  const list = useMemo(
    () => MOCK_TICKETS.filter((t) => t.status === STATUS_FOR_TAB[tab]),
    [tab],
  );

  return (
    <Screen edges={["top"]}>
      <Text style={styles.title}>My Tickets</Text>

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
        {list.length === 0 ? (
          <Text style={styles.empty}>No {tab.toLowerCase()} tickets.</Text>
        ) : (
          list.map((t) => {
            const event = getEvent(t.eventId);
            return (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: "/ticket/[id]", params: { id: t.id } })}
                style={[styles.card, { borderLeftColor: t.tierColor }]}
                accessibilityRole="button"
              >
                <Text style={styles.event}>{event?.title ?? "Event"}</Text>
                <Text style={styles.meta}>{event?.when}</Text>
                <Text style={styles.meta}>
                  {t.quantity} × {t.tierName} · {t.seat}
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
