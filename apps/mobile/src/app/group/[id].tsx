import React, { useReducer, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Screen } from "../../components/Screen";
import { getEvent } from "../../mock/events";
import { addMember, getBulkOrder, revokeInvite, unassignedCount } from "../../mock/groups";
import { inr } from "../../mock/resale";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

/**
 * Group distribution manager (PRD screen 11, FR-027). The manager assigns tickets to
 * team members by email at zero cost. No resale listing is needed.
 * Mock data. Phase 2 writes group_allocations and sends the invite emails.
 */
export default function GroupManager() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const order = getBulkOrder(id);
  if (!order) {
    return (
      <Screen>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Back
        </Text>
        <Text style={styles.heading}>No group order found.</Text>
      </Screen>
    );
  }

  const o = order;
  const event = getEvent(o.eventId);
  const claimed = o.members.filter((m) => m.status === "CLAIMED").length;
  const pending = o.members.length - claimed;
  const unassigned = unassignedCount(o);

  function invite() {
    const r = addMember(o, email);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setEmail("");
    refresh();
  }

  function revoke(addr: string) {
    revokeInvite(o, addr);
    refresh();
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>
      <Text style={styles.heading}>Group distribution</Text>
      <Text style={styles.body}>
        {event?.title ?? "Event"} · {o.tierName} · face value {inr(o.faceValue)} each
      </Text>

      <View style={styles.stats}>
        <Stat label="Bought" value={o.total} />
        <Stat label="Claimed" value={claimed} tone={colors.status.success} />
        <Stat label="Pending" value={pending} tone={colors.status.warning} />
        <Stat label="Unassigned" value={unassigned} />
      </View>

      <Text style={styles.section}>Invite a team member</Text>
      <Field
        label="Team member's email"
        placeholder="name@company.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={error}
        testID="member-email"
      />
      <View style={{ height: space.sm }} />
      <Button label="Send invite" onPress={invite} disabled={unassigned <= 0} testID="send-invite" />

      <Text style={styles.section}>Members</Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {o.members.length === 0 ? <Text style={styles.empty}>No invites yet.</Text> : null}
        {o.members.map((m) => {
          const isClaimed = m.status === "CLAIMED";
          return (
            <View key={m.email} style={styles.member}>
              <View style={{ flex: 1 }}>
                <Text style={styles.email}>{m.email}</Text>
                <Text style={[styles.status, { color: isClaimed ? colors.status.success : colors.status.warning }]}>
                  {m.status === "CLAIMED" ? "CLAIMED" : "PENDING_CLAIM"}
                </Text>
              </View>
              {isClaimed ? null : (
                <Text style={styles.revoke} onPress={() => revoke(m.email)} accessibilityRole="button">
                  Revoke
                </Text>
              )}
            </View>
          );
        })}
        <Text style={styles.note}>
          Each member gets an invite by email. Their gate QR turns on only after they claim the ticket. Unclaimed
          invites can be revoked. Claimed tickets cannot be taken back.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  heading: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  body: { color: colors.text.muted, fontSize: fontSize.sm, marginTop: space.xxs, marginBottom: space.md },
  stats: { flexDirection: "row", gap: space.xs },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
  },
  statValue: { color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  statLabel: { color: colors.text.muted, fontSize: fontSize.xs, marginTop: space.xxs },
  section: { color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginTop: space.lg, marginBottom: space.sm },
  list: { paddingBottom: space.xxl, gap: space.xs },
  member: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
  },
  email: { color: colors.text.primary, fontSize: fontSize.md },
  status: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginTop: space.xxs },
  revoke: { color: colors.status.danger, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, padding: space.xs },
  empty: { color: colors.text.muted, fontSize: fontSize.md, textAlign: "center", marginTop: space.md },
  note: { color: colors.text.muted, fontSize: fontSize.sm, lineHeight: 20, marginTop: space.md },
});
