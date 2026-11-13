import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { useEvent } from "../../services/events";
import { colors, fontSize, fontWeight, space } from "../../theme";

/**
 * FairQueue (mock). In Phase 2 the server issues the queue position and admission
 * window (queue_entries). Each user gets one slot, so bots cannot jump the line.
 * The demo position counts down every second and admits after about 8 seconds.
 */
const START_POSITION = 1240;
const ADMIT_AFTER_SECONDS = 8;

export default function FairQueue() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event } = useEvent(id);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const admitted = elapsed >= ADMIT_AFTER_SECONDS;
  const position = Math.max(1, Math.round(START_POSITION * (1 - elapsed / ADMIT_AFTER_SECONDS)));
  const progress = Math.min(1, elapsed / ADMIT_AFTER_SECONDS);

  useEffect(() => {
    if (admitted && event) {
      router.replace({ pathname: "/checkout/[id]", params: { id: event.id } });
    }
  }, [admitted, event]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Leave queue
      </Text>

      <View style={styles.center}>
        <Text style={styles.title}>{admitted ? "You're in" : "You're in the fair queue"}</Text>
        <Text style={styles.sub}>{event?.title ?? "Event"}</Text>

        <View style={styles.ring}>
          <View style={[styles.ringFill, { borderColor: colors.brand.cyan, opacity: progress }]} />
          <Text style={styles.position}>{admitted ? "0" : position.toLocaleString("en-IN")}</Text>
          <Text style={styles.positionLabel}>{admitted ? "ready" : "ahead of you"}</Text>
        </View>

        <Text style={styles.note}>
          Everyone joins one queue in order. Bots and multiple accounts are blocked.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          label={admitted ? "Continue" : `Admitting in ${Math.max(0, ADMIT_AFTER_SECONDS - elapsed)}s`}
          disabled={!admitted}
          onPress={() => event && router.replace({ pathname: "/checkout/[id]", params: { id: event.id } })}
          testID="queue-continue"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  sub: { color: colors.text.muted, fontSize: fontSize.md },
  ring: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 10,
    borderColor: colors.bg.border,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: space.lg,
  },
  ringFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 110,
    borderWidth: 10,
  },
  position: { color: colors.text.primary, fontSize: 48, fontWeight: fontWeight.bold },
  positionLabel: { color: colors.text.muted, fontSize: fontSize.sm },
  note: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
    textAlign: "center",
    paddingHorizontal: space.lg,
    lineHeight: 20,
  },
  footer: { paddingBottom: space.md },
});
