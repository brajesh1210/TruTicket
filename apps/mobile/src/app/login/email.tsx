import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Screen } from "../../components/Screen";
import { requestEmailOtp } from "../../auth/session";
import { colors, fontSize, space } from "../../theme";

export default function EmailEntry() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSend() {
    setBusy(true);
    setError(null);
    const res = await requestEmailOtp(email);
    setBusy(false);
    if (res.ok) {
      router.push({ pathname: "/login/otp", params: { email: email.trim() } });
    } else {
      setError(res.error);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
          ← Back
        </Text>
        <Text style={styles.title}>Enter your email</Text>
        <Text style={styles.subtitle}>
          We will send a 6-digit code. You need a verified email to buy tickets.
        </Text>
      </View>

      <View style={styles.form}>
        <Field
          label="Email address"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoCorrect={false}
          error={error}
          testID="email-input"
        />
        <Button
          label="Send code"
          onPress={onSend}
          loading={busy}
          disabled={!email.trim()}
          testID="email-send"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: space.md, gap: space.sm },
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.xs },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.xxl,
    fontWeight: "700",
    marginTop: space.md,
  },
  subtitle: { color: colors.text.muted, fontSize: fontSize.md, lineHeight: 22 },
  form: { flex: 1, justifyContent: "center", gap: space.lg },
});
