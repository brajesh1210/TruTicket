import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { EventCard } from "../../components/EventCard";
import { Screen } from "../../components/Screen";
import { useEvents } from "../../services/events";
import type { AppEvent } from "../../services/types";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

type Category = AppEvent["category"];
const CATEGORIES: { name: Category; hint: string }[] = [
  { name: "Concerts", hint: "Live music" },
  { name: "Sports", hint: "Matches and leagues" },
  { name: "Comedy", hint: "Stand-up and shows" },
  { name: "Festivals", hint: "Multi-day and open air" },
];

/** Categories (mock). Tap a tile to see its events. */
export default function Categories() {
  const [selected, setSelected] = useState<Category>("Concerts");
  const all = useEvents();
  const pool = all.data ?? [];
  const list = pool.filter((e) => e.category === selected);

  return (
    <Screen edges={["top"]}>
      <Text style={styles.title}>Categories</Text>

      <View style={styles.grid}>
        {CATEGORIES.map((c) => {
          const count = pool.filter((e) => e.category === c.name).length;
          const active = c.name === selected;
          return (
            <Pressable
              key={c.name}
              onPress={() => setSelected(c.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tile, active && styles.tileActive]}
            >
              <Text style={[styles.tileName, active && styles.tileNameActive]}>{c.name}</Text>
              <Text style={[styles.tileHint, active && styles.tileHintActive]}>{c.hint}</Text>
              <Text style={[styles.tileCount, active && styles.tileHintActive]}>
                {count} {count === 1 ? "event" : "events"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>{selected}</Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? (
          <Text style={styles.empty}>No events in this category yet.</Text>
        ) : (
          <View style={styles.cards}>
            {list.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                variant="compact"
                onPress={() => router.push({ pathname: "/event/[id]", params: { id: e.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, marginTop: space.md },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: space.sm, marginTop: space.md },
  tile: {
    width: "48%",
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bg.border,
    backgroundColor: colors.bg.card,
    gap: space.xxs,
  },
  tileActive: { backgroundColor: colors.brand.ctaCyan, borderColor: colors.brand.ctaCyan },
  tileName: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  tileNameActive: { color: "#041014" },
  tileHint: { color: colors.text.muted, fontSize: fontSize.sm },
  tileHintActive: { color: "#041014" },
  tileCount: { color: colors.brand.cyan, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: space.xs },
  section: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginTop: space.lg },
  list: { paddingTop: space.sm, paddingBottom: space.xxl },
  cards: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: space.sm },
  empty: { color: colors.text.muted, fontSize: fontSize.md, textAlign: "center", marginTop: space.xl },
});
