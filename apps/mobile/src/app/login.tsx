import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../components/Button";
import { Logo } from "../components/Logo";
import { Screen } from "../components/Screen";
import { DEMO_EMAIL, DEMO_MODE, requestEmailOtp, signInWithGoogle } from "../auth/session";
import { colors, fontSize, space } from "../theme";

/**
 * Login. Phase 1 rules:
 * - Google One-Tap and Email OTP are the free login methods.
 * - Apple Sign-In is NOT rendered until Launch (needs Apple Developer account).
 * - Browsing is free; buying asks for a verified email (see verify-gate).
 */
export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onGoogle() {
    setBusy(true);
    setError(null);
    const res = await signInWithGoogle();
    setBusy(false);
    if (res.ok) router.replace("/(tabs)");
    else setError(res.error);
  }

  async function onDemo() {
    setBusy(true);
    setError(null);
    // Demo account: sends the demo code like any other email. The server only accepts the
    // demo code for demo emails on the DEV project.
    const res = await requestEmailOtp(DEMO_EMAIL);
    setBusy(false);
    if (res.ok) router.push({ pathname: "/login/otp", params: { email: DEMO_EMAIL } });
    else setError(res.error);
  }

  return (
    <Screen>
      <View style={styles.top}>
        <Logo size="lg" />
        <Text style={styles.title}>Welcome to TruTicket</Text>
        <Text style={styles.subtitle}>
          Sign in to discover and book amazing events.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Continue with Google"
          variant="social"
          onPress={onGoogle}
          loading={busy}
          testID="login-google"
        />

        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <Text style={styles.or}>OR</Text>
          <View style={styles.line} />
        </View>

        <Button
          label="Continue with Email"
          variant="primary"
          onPress={() => router.push("/login/email")}
          testID="login-email"
        />

        {DEMO_MODE ? (
          <Button
            label="Use demo account"
            variant="secondary"
            onPress={onDemo}
            disabled={busy}
            testID="login-demo"
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Text style={styles.legal}>
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: "center", paddingTop: space.xxl, gap: space.sm },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: "700",
    marginTop: space.lg,
  },
  subtitle: {
    color: colors.text.muted,
    fontSize: fontSize.md,
    textAlign: "center",
  },
  actions: { flex: 1, justifyContent: "center", gap: space.md },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.bg.border },
  or: { color: colors.text.muted, fontSize: fontSize.sm },
  error: {
    color: colors.status.danger,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  legal: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
    textAlign: "center",
    paddingBottom: space.md,
  },
});
