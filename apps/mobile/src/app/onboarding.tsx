import React, { useRef, useState } from "react";
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "../components/Button";
import { Logo } from "../components/Logo";
import { Screen } from "../components/Screen";
import { brandMark, colors, fontSize, fontWeight, radius, space } from "../theme";

const SLIDES = [
  {
    title: "Discover Events.\nCreate Memories.",
    body: "Find the best concerts, sports and experiences happening near you and around the world.",
    art: ["#0ACBDB", "#8B7CF6"] as [string, string],
  },
  {
    title: "Your Chance.\nYour Fair Queue.",
    body: "Our fair queue system gives everyone an equal shot at tickets — no bots, no shortcuts, just fairness.",
    art: ["#8B7CF6", "#0ACBDB"] as [string, string],
  },
  {
    title: "Real Tickets.\nVerified Entry.",
    body: "Every ticket is secure, unique and verified for a smooth entry. Safe transfers. Total peace of mind.",
    art: ["#0ACBDB", "#22C55E"] as [string, string],
  },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  function goTo(i: number) {
    const next = Math.max(0, Math.min(SLIDES.length - 1, i));
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  }

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  function finish() {
    router.replace("/login");
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Logo size="sm" showWordmark />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        style={styles.pager}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width: width - space.lg * 2 }]}>
            <LinearGradient
              colors={[s.art[0], s.art[1], colors.bg.base]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.art}
            >
              <Image source={brandMark} style={styles.artMark} resizeMode="contain" />
            </LinearGradient>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        {index > 0 ? (
          <Button label="Back" variant="ghost" onPress={() => goTo(index - 1)} style={styles.half} />
        ) : null}
        <Button
          label={isLast ? "Get Started" : "Next"}
          onPress={() => (isLast ? finish() : goTo(index + 1))}
          style={index > 0 ? styles.half : styles.full}
          testID="onboarding-next"
        />
      </View>

      {!isLast ? (
        <Text onPress={finish} style={styles.skip} accessibilityRole="button">
          Skip
        </Text>
      ) : (
        <View style={styles.skipSpacer} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingTop: space.md, paddingBottom: space.sm },
  pager: { flexGrow: 0 },
  slide: { gap: space.md },
  art: {
    height: 300,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  artMark: { width: 180, height: 120 },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    textAlign: "center",
    marginTop: space.md,
  },
  body: {
    color: colors.text.muted,
    fontSize: fontSize.md,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: space.md,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space.xs,
    marginVertical: space.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg.border,
  },
  dotActive: { backgroundColor: colors.brand.cyan, width: 22 },
  actions: { flexDirection: "row", gap: space.sm },
  half: { flex: 1 },
  full: { flex: 1 },
  skip: {
    color: colors.text.muted,
    fontSize: fontSize.md,
    textAlign: "center",
    marginTop: space.md,
    paddingVertical: space.xs,
  },
  skipSpacer: { height: space.xl },
});
