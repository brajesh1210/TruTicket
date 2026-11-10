import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { canTransact, signOut, useAuth } from "../../auth/session";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

export default function Profile() {
  const { session } = useAuth();

  function onLogout() {
    signOut();
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
        <Text style={styles.item}>Personal information</Text>
        <Text style={styles.item}>Security & devices</Text>
        <Text style={styles.item}>Notification preferences</Text>
        <Text style={styles.item}>Help & support</Text>
      </View>

      <Button label="Log out" variant="ghost" onPress={onLogout} testID="logout" />
    </Screen>
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
  item: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.border,
  },
});
