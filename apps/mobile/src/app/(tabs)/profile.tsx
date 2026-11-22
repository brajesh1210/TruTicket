import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../components/Screen";
import { canTransact, isGateStaff, signOut, useAuth } from "../../auth/session";
import { getDeviceKeyId } from "../../auth/device";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

/** Profile & security. Layout follows the reference screens. Actions are the same as before. */
export default function Profile() {
  const { session } = useAuth();
  const verified = canTransact(session);
  const gateStaff = isGateStaff(session);
  const email = session?.email ?? "";
  const name = email ? email.split("@")[0] : "Guest";
  const initial = name.charAt(0).toUpperCase();
  const [deviceKey, setDeviceKey] = useState("");

  useEffect(() => {
    // Dev builds only: shows this phone's device key so it can be matched in the DEV database.
    if (__DEV__) void getDeviceKeyId().then(setDeviceKey).catch(() => setDeviceKey("unavailable"));
  }, []);

  function onLogout() {
    void signOut();
    router.replace("/login");
  }

  return (
    <Screen edges={["top"]}>
      <Text style={styles.title}>Profile & security</Text>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.idRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {email || "Not signed in"}
              </Text>
              {__DEV__ && deviceKey ? (
                <Text style={styles.debug} selectable>
                  Device key: {deviceKey}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.badge, verified ? styles.badgeOk : styles.badgeWarn]}>
              {verified ? "✓ Verified" : "Not verified"}
            </Text>
          </View>

          <Text style={styles.label}>Account role</Text>
          <View style={styles.roles}>
            <Text style={[styles.role, styles.roleOn]}>{gateStaff ? "Gate staff" : "Attendee"}</Text>
          </View>
        </View>

        <Text style={styles.section}>Security & alerts</Text>
        <View style={styles.list}>
          <Row label="Security & devices" sub="Sessions and phone link" onPress={() => router.push("/security")} />
          <Row label="Resale marketplace" sub="Buy and sell passes" onPress={() => router.push("/resale")} last={!gateStaff} />
          {gateStaff ? (
            <Row label="Gate staff" sub="Scan tickets at the gate" onPress={() => router.push("/gate")} last />
          ) : null}
        </View>

        <Pressable onPress={onLogout} style={styles.logout} accessibilityRole="button" testID="logout">
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, sub, onPress, last }: { label: string; sub: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.item}>{label}</Text>
        <Text style={styles.meta}>{sub}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, marginTop: space.md },
  body: { paddingTop: space.md, paddingBottom: space.xxl, gap: space.sm },
  card: {
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
    gap: space.sm,
  },
  idRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bg.raised,
    borderWidth: 2,
    borderColor: colors.brand.ctaCyan,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.brand.ctaCyan, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  name: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  meta: { color: colors.text.muted, fontSize: fontSize.sm },
  debug: { color: colors.text.muted, fontSize: fontSize.xs, marginTop: 2 },
  badge: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  badgeOk: { color: "#86EFAC", backgroundColor: "rgba(34,197,94,0.15)" },
  badgeWarn: { color: "#FCD34D", backgroundColor: "rgba(245,165,36,0.15)" },
  label: { color: colors.text.muted, fontSize: fontSize.sm, marginTop: space.xs },
  roles: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  role: {
    color: colors.text.secondary,
    borderWidth: 1,
    borderColor: colors.bg.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    fontSize: fontSize.sm,
    overflow: "hidden",
  },
  roleOn: { color: "#0A0A0C", backgroundColor: colors.brand.ctaCyan, borderColor: colors.brand.ctaCyan, fontWeight: fontWeight.semibold },
  section: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: space.sm },
  list: {
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.bg.border },
  item: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.medium },
  chev: { color: colors.text.muted, fontSize: fontSize.xl },
  logout: {
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bg.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.sm,
  },
  logoutText: { color: colors.status.danger, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
