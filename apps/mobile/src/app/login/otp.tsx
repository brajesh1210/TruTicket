import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../../components/Button";
import { OtpInput } from "../../components/OtpInput";
import { Screen } from "../../components/Screen";
import { requestEmailOtp, verifyEmailOtp, useAuth } from "../../auth/session";
import { colors, fontSize, space } from "../../theme";

const RESEND_SECONDS = 60;

export default function OtpEntry() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resendAvailableAt, session } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Tick once a second for the resend countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Signed in (demo or real) -> leave the auth flow.
  useEffect(() => {
    if (session) router.replace("/(tabs)");
  }, [session]);

  const resendIn = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  async function verify(value: string) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const res = await verifyEmailOtp(value);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setCode("");
    }
  }

  async function resend() {
    setError(null);
    const res = await requestEmailOtp(email ?? "");
    if (!res.ok) setError(res.error);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
          ← Back
        </Text>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{"\n"}
          <Text style={styles.email}>{email}</Text>
        </Text>
      </View>

      <View style={styles.form}>
        <OtpInput value={code} onChange={setCode} onComplete={verify} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Verify"
          onPress={() => verify(code)}
          loading={busy}
          disabled={code.length !== 6}
          testID="otp-verify"
        />

        <View style={styles.resendRow}>
          <Text style={styles.muted}>Didn't get it? </Text>
          {resendIn > 0 ? (
            <Text style={styles.muted}>Resend in {resendIn}s</Text>
          ) : (
            <Text style={styles.link} onPress={resend} accessibilityRole="button">
              Resend code
            </Text>
          )}
        </View>
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
  email: { color: colors.text.primary, fontWeight: "600" },
  form: { flex: 1, justifyContent: "center", gap: space.lg },
  error: { color: colors.status.danger, fontSize: fontSize.sm, textAlign: "center" },
  resendRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  muted: { color: colors.text.muted, fontSize: fontSize.sm },
  link: { color: colors.brand.purple, fontSize: fontSize.sm, fontWeight: "600" },
});
