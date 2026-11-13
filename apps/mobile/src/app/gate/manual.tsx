import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Screen } from "../../components/Screen";
import { GATE_EVENT_ID } from "../../services/config";
import { messageOf } from "../../services/errors";
import { scanToken } from "../../services/gate";
import { colors, fontSize, fontWeight, space } from "../../theme";

/**
 * Paste the QR text instead of scanning it. Used when the camera cannot read the code, and
 * for the demo path (the attendee's ticket screen shows the text in demo builds).
 * The server checks the text exactly like a camera scan.
 */
export default function Manual() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    const clean = text.trim();
    if (!clean) {
      setError("Paste the QR text first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await scanToken(GATE_EVENT_ID, clean);
      router.replace({ pathname: "/gate/result", params: { status: r.status, detail: r.detail } });
    } catch (e) {
      setError(messageOf(e, "Could not check this code. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>
      <Text style={styles.heading}>Paste QR code</Text>
      <Text style={styles.body}>
        Use this when the camera cannot read the attendee's code. Check the attendee's ID and match the name before you admit.
      </Text>

      <Field
        label="QR text"
        placeholder="TT1.…"
        autoCapitalize="none"
        autoCorrect={false}
        value={text}
        onChangeText={setText}
        error={error}
        onSubmitEditing={check}
        returnKeyType="done"
        testID="manual-token"
      />
      <Text style={styles.hint}>In the demo build, the ticket screen shows this text. It expires in 10 seconds, so paste it quickly.</Text>

      <Button label="Check" onPress={check} loading={busy} style={{ marginTop: space.md }} testID="manual-check" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  heading: { color: colors.text.primary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  body: { color: colors.text.muted, fontSize: fontSize.md, lineHeight: 22, marginTop: space.xs, marginBottom: space.lg },
  hint: { color: colors.text.muted, fontSize: fontSize.xs, marginTop: space.xs, lineHeight: 18 },
});
