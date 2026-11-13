import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fontSize, fontWeight, radius, space } from "../theme";
import type { AppEvent } from "../services/types";

type Props = {
  event: AppEvent;
  variant?: "wide" | "compact";
  onPress?: () => void;
};

/** Event tile. Artwork is a gradient placeholder until real event images exist. */
export function EventCard({ event, variant = "compact", onPress }: Props) {
  const wide = variant === "wide";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, from ₹${event.fromPrice}`}
      style={({ pressed }) => [
        styles.card,
        wide ? styles.wide : styles.compact,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={[event.tint[0], event.tint[1], colors.bg.base]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.art, wide ? styles.artWide : styles.artCompact]}
      >
        <Text style={styles.tag}>{event.category.toUpperCase()}</Text>
      </LinearGradient>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {event.when}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {event.venue}
        </Text>
        <Text style={styles.price}>From ₹{event.fromPrice.toLocaleString("en-IN")}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
    overflow: "hidden",
  },
  wide: { width: 300 },
  compact: { width: "48%" },
  pressed: { opacity: 0.9 },
  art: {
    padding: space.sm,
    justifyContent: "flex-start",
  },
  artWide: { height: 150 },
  artCompact: { height: 110 },
  tag: {
    color: colors.text.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignSelf: "flex-start",
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  body: { padding: space.sm, gap: 2 },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  meta: { color: colors.text.muted, fontSize: fontSize.sm },
  price: {
    color: colors.brand.cyan,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: space.xxs,
  },
});
