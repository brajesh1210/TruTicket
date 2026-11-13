import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { canTransact, signOut, useAuth } from "../../auth/session";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

export default function Profile() {
  const { session } = useAuth();

  function onLogout() {
    void signOut();
    router.replace("/login");
  }

  return (
    <Screen>
      <View style={styles.card}>
        <View style={styles.avatar} />
        <Text style={styles.name}>{session?.email ?? "Guest"}</Text>
        <Text style={[styles.badge, canTransact(session) ? styles.ok : styles.warn]}>
          {canTransact(session) ? "✓ Verified email" : "Email not verified"}
        </Text>
      </View>

      <View style={styles.list}>
        <Row label="Security & devices" onPress={() => router.push("/security")} />
        <Row label="Resale marketplace" onPress={() => router.push("/resale")} />
        <Row label="Group distribution" onPress={() => router.push({ pathname: "/group/[id]", params: { id: "grp-1" } })} />
        <Row label="Gate staff" onPress={() => router.push("/gate")} last />
      </View>

      <Button label="Log out" variant="ghost" onPress={onLogout} testID="logout" />
    </Screen>
  );
}

function Row({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.item}>{label}</Text>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xl,
    marginTop: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bg.raised,
    borderWidth: 2,
    borderColor: colors.brand.cyan,
  },
  name: { color: colors.text.primary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  badge: { fontSize: fontSize.sm },
  ok: { color: colors.status.success },
  warn: { color: colors.status.warning },
  list: {
    marginTop: space.lg,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.bg.border },
  item: { color: colors.text.primary, fontSize: fontSize.md },
  chev: { color: colors.text.muted, fontSize: fontSize.xl },
});
