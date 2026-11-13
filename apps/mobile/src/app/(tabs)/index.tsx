import React, { useMemo, useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../../components/Screen";
import { EventCard } from "../../components/EventCard";
import { Logo } from "../../components/Logo";
import { useEvents } from "../../services/events";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

const CHIPS = ["Discover", "Concerts", "Sports", "Comedy", "Festivals"] as const;

/** Home / Explore. Mock data for Phase 1; wired to Supabase in Phase 2. */
export default function Explore() {
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("Discover");
  const [query, setQuery] = useState("");

  const all = useEvents();

  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all.data ?? []).filter((e) => {
      const chipOk = chip === "Discover" || e.category === chip;
      const qOk = !q || e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q);
      return chipOk && qOk;
    });
  }, [chip, query, all.data]);

  const highlights = events.slice(0, 3);
  const trending = events.slice(0, 4);

  return (
    <Screen edges={["top"]}>
      <View style={styles.topBar}>
        <Logo size="sm" showWordmark={false} />
        <View>
          <Text style={styles.city}>Navi Mumbai</Text>
        </View>
        <View style={styles.avatar} />
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search events, artists, venues"
        placeholderTextColor={colors.text.muted}
        style={styles.search}
        accessibilityLabel="Search events"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsWrap} contentContainerStyle={styles.chips}>
        {CHIPS.map((c) => (
          <Text
            key={c}
            onPress={() => setChip(c)}
            accessibilityRole="button"
            style={[styles.chip, c === chip && styles.chipActive]}
          >
            {c}
          </Text>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {all.error ? (
          <Text style={styles.empty} onPress={all.reload} accessibilityRole="button">
            {all.error} Tap to retry.
          </Text>
        ) : null}
        {all.loading && !all.data ? <Text style={styles.empty}>Loading events…</Text> : null}

        {highlights.length > 0 ? (
          <>
            <SectionHeader title="This Week's Highlights" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {highlights.map((e) => (
                <EventCard key={e.id} event={e} variant="wide" onPress={() => router.push(`/event/${e.id}`)} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {trending.length > 0 ? (
          <>
            <SectionHeader title="Trending Events" />
            <View style={styles.grid}>
              {trending.map((e) => (
                <EventCard key={e.id} event={e} onPress={() => router.push(`/event/${e.id}`)} />
              ))}
            </View>
          </>
        ) : null}

        {events.length === 0 ? (
          <Text style={styles.empty}>No events match your search.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  city: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.raised,
    borderWidth: 1,
    borderColor: colors.bg.border,
  },
  search: {
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bg.border,
    backgroundColor: colors.bg.card,
    color: colors.text.primary,
    paddingHorizontal: space.md,
    fontSize: fontSize.md,
  },
  chipsWrap: { flexGrow: 0, marginTop: space.md },
  chips: { gap: space.sm, paddingVertical: space.xxs },
  chip: {
    color: colors.text.secondary,
    borderWidth: 1,
    borderColor: colors.bg.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    fontSize: fontSize.sm,
    overflow: "hidden",
  },
  chipActive: {
    backgroundColor: colors.brand.ctaCyan,
    borderColor: colors.brand.ctaCyan,
    color: "#041014",
    fontWeight: fontWeight.semibold,
  },
  body: { paddingTop: space.lg, paddingBottom: space.xxl, gap: space.md },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  row: { gap: space.md, paddingRight: space.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.md },
  empty: { color: colors.text.muted, textAlign: "center", marginTop: space.xl },
});
