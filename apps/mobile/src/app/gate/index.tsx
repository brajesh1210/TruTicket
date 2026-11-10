import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { getEvent } from "../../mock/events";
import { evaluateScan, GATE_EVENT_ID, mockPayload } from "../../mock/gate";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

const now = () => Math.floor(Date.now() / 1000);

/**
 * Gate scanner, camera view (PRD screen 23). Gate staff only (demo entry from Profile).
 * This build has no camera module yet. Live camera scanning needs expo-camera, which
 * needs a new EAS dev build. Until then, the sample buttons feed the same scan logic.
 */
export default function GateScanner() {
  const [offline, setOffline] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const sweep = useRef(new Animated.Value(0)).current;
  const event = getEvent(GATE_EVENT_ID);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1600, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  function scan(label: string, payload: string) {
    const r = evaluateScan(payload, now(), { offline });
    setLast(label);
    router.push({
      pathname: "/gate/result",
      params: { status: r.status, detail: r.detail, ticketId: r.ticketId ?? "" },
    });
  }

  const samples: { label: string; run: () => void }[] = [
    { label: "Valid QR · tkt-1001", run: () => scan("Valid QR", mockPayload("tkt-1001", now())) },
    { label: "Stale QR · 30 s old", run: () => scan("Stale QR", mockPayload("tkt-1001", now(), 3)) },
    { label: "Wrong event · tkt-0900", run: () => scan("Wrong event", mockPayload("tkt-0900", now())) },
    { label: "Junk code", run: () => scan("Junk", "hello") },
  ];

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventTitle}>{event?.title ?? "Gate"}</Text>
          <Text style={styles.venue}>{event?.venue}</Text>
        </View>
        <Pressable
          onPress={() => setOffline((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: offline }}
          style={[styles.conn, offline ? styles.connOff : styles.connOn]}
        >
          <Text style={styles.connText}>{offline ? "● Offline" : "● Online"}</Text>
        </Pressable>
      </View>

      <View style={styles.viewWrap}>
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          <Animated.View
            style={[
              styles.scanline,
              {
                transform: [
                  {
                    translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 236] }),
                  },
                ],
              },
            ]}
          />
          <Text style={styles.hint}>Point at the attendee's QR</Text>
        </View>
        <Text style={styles.last}>{last ? `Last: ${last}` : "No scans yet this shift"}</Text>
      </View>

      <Text style={styles.section}>Demo scans (no camera in this build)</Text>
      <View style={styles.samples}>
        {samples.map((s) => (
          <Button
            key={s.label}
            label={s.label}
            variant="secondary"
            onPress={s.run}
            style={styles.sampleBtn}
            testID={`sample-${s.label}`}
          />
        ))}
      </View>
      <Text style={styles.note}>
        Scan the same valid QR twice to see ALREADY USED. Turn Offline on to see OFFLINE-UNVERIFIED.
      </Text>

      <View style={{ flex: 1 }} />
      <View style={styles.footer}>
        <Button label="Manual lookup" variant="secondary" onPress={() => router.push("/gate/manual")} style={{ flex: 1 }} />
        <Button label="Activity log" variant="secondary" onPress={() => router.push("/gate/activity")} style={{ flex: 1 }} />
      </View>
      <Button label="Exit gate mode" variant="ghost" onPress={() => router.replace("/(tabs)")} />
    </Screen>
  );
}

const CORNER = 36;
const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.md },
  eventTitle: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  venue: { color: colors.text.muted, fontSize: fontSize.xs, marginTop: space.xxs },
  conn: { paddingHorizontal: space.sm, paddingVertical: space.xxs, borderRadius: radius.pill, borderWidth: 1 },
  connOn: { borderColor: colors.status.success },
  connOff: { borderColor: colors.status.warning },
  connText: { color: colors.text.primary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  viewWrap: { alignItems: "center", gap: space.sm },
  viewfinder: {
    width: 260,
    height: 260,
    borderRadius: radius.lg,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    paddingBottom: space.md,
  },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.brand.cyan },
  tl: { top: space.sm, left: space.sm, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: space.sm, right: space.sm, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: space.sm + 24, left: space.sm, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: space.sm + 24, right: space.sm, borderBottomWidth: 4, borderRightWidth: 4 },
  scanline: { position: "absolute", top: 12, left: 16, right: 16, height: 2, backgroundColor: colors.brand.cyan },
  hint: { color: colors.text.muted, fontSize: fontSize.xs },
  last: { color: colors.text.secondary, fontSize: fontSize.sm },
  section: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginTop: space.md, marginBottom: space.sm },
  samples: { gap: space.xs },
  sampleBtn: { height: 46 },
  note: { color: colors.text.muted, fontSize: fontSize.xs, lineHeight: 18, marginTop: space.sm },
  footer: { flexDirection: "row", gap: space.sm, marginBottom: space.sm },
});
