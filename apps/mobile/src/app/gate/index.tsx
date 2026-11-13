import React, { useCallback, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { GATE_EVENT_ID } from "../../services/config";
import { useEvent } from "../../services/events";
import { messageOf } from "../../services/errors";
import { recordOffline, scanToken } from "../../services/gate";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

/**
 * Gate scanner (PRD screen 23). Live camera scan of the attendee's QR. Each scan is checked by
 * the server (`scanner_verify`), which marks the ticket used on the first valid scan.
 * Gate staff only: the signed-in account must be the organiser of this event.
 */
export default function GateScanner() {
  const { data: event } = useEvent(GATE_EVENT_ID || undefined);
  const [permission, requestPermission] = useCameraPermissions();
  const [offline, setOffline] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [checking, setChecking] = useState(false);
  const lock = useRef(false);
  const sweep = useRef(new Animated.Value(0)).current;

  // Only one camera preview may run at a time. The camera stops when this screen loses focus.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      lock.current = false;
      setChecking(false);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 1600, easing: Easing.linear, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => {
        setFocused(false);
        loop.stop();
      };
    }, [sweep]),
  );

  async function onScanned(data: string) {
    if (lock.current) return;
    lock.current = true;
    setChecking(true);
    setLast(data.slice(0, 16) + "…");

    if (offline) {
      const r = recordOffline();
      router.push({ pathname: "/gate/result", params: { status: r.status, detail: r.detail } });
      return;
    }
    try {
      const r = await scanToken(GATE_EVENT_ID, data);
      router.push({ pathname: "/gate/result", params: { status: r.status, detail: r.detail } });
    } catch (e) {
      // Server refused the check (not the organiser, scanner off, network). Show the reason.
      const detail = messageOf(e, "Could not check this code. Try again.");
      router.push({ pathname: "/gate/result", params: { status: "INVALID", detail } });
    }
  }

  if (!GATE_EVENT_ID) {
    return (
      <Screen>
        <Text style={styles.note}>The gate event is not set. Add EXPO_PUBLIC_GATE_EVENT_ID to the build settings.</Text>
      </Screen>
    );
  }

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
          {focused && permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={(res) => onScanned(res.data)}
            />
          ) : null}
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          <Animated.View
            style={[
              styles.scanline,
              {
                transform: [
                  { translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 236] }) },
                ],
              },
            ]}
          />
          {!permission?.granted ? (
            <View style={styles.permission}>
              <Text style={styles.permText}>Camera access is needed to scan tickets.</Text>
              <Button label="Allow camera" onPress={requestPermission} testID="allow-camera" />
            </View>
          ) : null}
        </View>
        <Text style={styles.last}>
          {checking ? "Checking…" : last ? `Last scan: ${last}` : "No scans yet this shift"}
        </Text>
      </View>

      <Text style={styles.note}>
        Scan the attendee's QR. A ticket is admitted once. If the camera cannot read the code, paste its text instead.
      </Text>
      <View style={{ flex: 1 }} />
      <View style={styles.footer}>
        <Button label="Paste QR code" variant="secondary" onPress={() => router.push("/gate/manual")} style={{ flex: 1 }} testID="paste-qr" />
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
    justifyContent: "center",
    overflow: "hidden",
  },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.brand.cyan },
  tl: { top: space.sm, left: space.sm, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: space.sm, right: space.sm, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: space.sm, left: space.sm, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: space.sm, right: space.sm, borderBottomWidth: 4, borderRightWidth: 4 },
  scanline: { position: "absolute", top: 12, left: 16, right: 16, height: 2, backgroundColor: colors.brand.cyan },
  permission: { padding: space.md, gap: space.sm, alignItems: "center" },
  permText: { color: colors.text.secondary, fontSize: fontSize.sm, textAlign: "center" },
  last: { color: colors.text.secondary, fontSize: fontSize.sm },
  note: { color: colors.text.muted, fontSize: fontSize.xs, lineHeight: 18, marginTop: space.sm },
  footer: { flexDirection: "row", gap: space.sm, marginBottom: space.sm },
});
