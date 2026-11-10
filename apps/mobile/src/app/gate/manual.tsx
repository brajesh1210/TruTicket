import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Screen } from "../../components/Screen";
import { manualLookup } from "../../mock/gate";
import { colors, fontSize, fontWeight, space } from "../../theme";

/**
 * Manual ticket lookup (PRD screen 26). Fallback when the attendee's phone screen is
 * damaged. Gate staff type the ticket ref and check the attendee's ID.
 */
export default function Manual() {
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);

  function lookup() {
    const clean = ref.trim();
    if (!clean) {
      setError("Enter a ticket ref, for example tkt-1001.");
      return;
    }
    setError(null);
    const r = manualLookup(clean, Math.floor(Date.now() / 1000));
    router.push({
      pathname: "/gate/result",
      params: { status: r.status, detail: r.detail, ticketId: r.ticketId ?? "" },
    });
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>
      <Text style={styles.heading}>Manual lookup</Text>
      <Text style={styles.body}>
        Use this only when the phone screen cannot be scanned. Ask for the attendee's ID and match the name on it before
        you admit.
      </Text>

      <Field
        label="Ticket ref"
        placeholder="tkt-1001"
        autoCapitalize="none"
        autoCorrect={false}
        value={ref}
        onChangeText={setRef}
        error={error}
        onSubmitEditing={lookup}
        returnKeyType="search"
        testID="manual-ref"
      />
      <Text style={styles.hint}>Demo refs: tkt-1001 (valid), tkt-0900 (wrong event)</Text>

      <Button label="Look up" onPress={lookup} style={{ marginTop: space.md }} testID="manual-lookup" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  heading: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  body: { color: colors.text.muted, fontSize: fontSize.md, lineHeight: 22, marginTop: space.xs, marginBottom: space.lg },
  hint: { color: colors.text.muted, fontSize: fontSize.xs, marginTop: space.xs },
});
