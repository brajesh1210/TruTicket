import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { QrView } from "../../components/QrView";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { DEMO_MODE } from "../../services/config";
import { formatWhen } from "../../services/format";
import { messageOf } from "../../services/errors";
import { fetchTicketQr, useMyTickets, type GateQr } from "../../services/tickets";
import { colors, fontSize, fontWeight, radius, space } from "../../theme";

/** How long before expiry we ask for the next QR (the QR is valid for 10 seconds). */
const REFRESH_LEAD_MS = 2000;
const RETRY_MS = 5000;

/**
 * One ticket with its gate QR. The server signs the QR and it expires after 10 seconds,
 * so the app asks for a new one just before that (PRD §6.4).
 */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tickets, loading, error } = useMyTickets();
  const ticket = tickets?.find((t) => t.id === id);

  const [qr, setQr] = useState<GateQr | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const live = !!ticket && ticket.status === "upcoming";
  const ticketId = ticket?.id;

  useEffect(() => {
    if (!ticketId || !live) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      try {
        const next = await fetchTicketQr(ticketId as string);
        if (!alive) return;
        setQr(next);
        setQrError(null);
        const wait = Math.max(1000, next.expiresAt - Date.now() - REFRESH_LEAD_MS);
        timer = setTimeout(refresh, wait);
      } catch (e) {
        if (!alive) return;
        setQrError(messageOf(e, "Could not get the QR. Retrying…"));
        timer = setTimeout(refresh, RETRY_MS);
      }
    }

    refresh();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      clearInterval(clock);
    };
  }, [ticketId, live]);

  if (!ticket) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missing}>{loading ? "Loading…" : error ?? "Ticket not found."}</Text>
        <Button label="Go back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const secondsLeft = qr ? Math.max(0, Math.ceil((qr.expiresAt - now) / 1000)) : 0;
  const statusLine =
    ticket.status === "listed"
      ? "Listed for resale. The QR is hidden while listed."
      : ticket.status === "past"
        ? "This ticket has been used or the event is over."
        : null;

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        ← Back
      </Text>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { borderTopColor: ticket.tierColor }]}>
          <Text style={styles.event}>{ticket.eventTitle}</Text>
          <Text style={styles.meta}>{formatWhen(ticket.startAt)}</Text>
          <Text style={styles.meta}>{ticket.venue}</Text>
          <Text style={styles.meta}>
            1 × {ticket.tierName} · ₹{ticket.faceValue.toLocaleString("en-IN")}
          </Text>

          <View style={styles.qrWrap}>
            {statusLine ? (
              <View style={styles.listed}>
                <Text style={styles.listedText}>{ticket.status === "listed" ? "Listed" : "Not valid"}</Text>
                <Text style={styles.meta}>{statusLine}</Text>
              </View>
            ) : qr ? (
              <QrView value={qr.token} size={220} color="#000000" backgroundColor="#FFFFFF" />
            ) : (
              <Text style={styles.meta}>{qrError ?? "Getting your QR…"}</Text>
            )}
          </View>

          {live && qr ? (
            <Text style={styles.refresh}>
              Refreshes automatically. Current code expires in {secondsLeft}s.
            </Text>
          ) : null}
          {live && qr && qrError ? <Text style={styles.warn}>{qrError}</Text> : null}
        </View>

        {DEMO_MODE && qr && live ? (
          <View style={styles.demo}>
            <Text style={styles.demoTitle}>Demo gate path</Text>
            <Text style={styles.demoText} selectable>
              {qr.token}
            </Text>
            <Text style={styles.demoHint}>
              If the gate camera cannot scan, copy this text into Gate → Paste QR code. It expires in 10 seconds.
            </Text>
          </View>
        ) : null}

        <View style={styles.dna}>
          <Detail label="Ticket ref" value={ticket.id.slice(0, 8).toUpperCase()} />
          <Detail label="Status" value={ticket.statusRaw.replace(/_/g, " ").toLowerCase()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.brand.cyan, fontSize: fontSize.md, paddingVertical: space.md },
  body: { paddingBottom: space.xl, gap: space.md },
  card: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.border,
    borderTopWidth: 4,
    gap: space.xxs,
  },
  event: { color: colors.text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  meta: { color: colors.text.secondary, fontSize: fontSize.sm },
  qrWrap: { alignItems: "center", justifyContent: "center", minHeight: 240, marginTop: space.md },
  listed: { alignItems: "center", gap: space.xs, padding: space.lg },
  listedText: { color: colors.status.warning, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  refresh: { color: colors.text.muted, fontSize: fontSize.xs, textAlign: "center", marginTop: space.sm },
  warn: { color: colors.status.warning, fontSize: fontSize.xs, textAlign: "center" },
  demo: {
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bg.border,
    backgroundColor: colors.bg.card,
    gap: space.xs,
  },
  demoTitle: { color: colors.text.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  demoText: { color: colors.brand.cyan, fontSize: fontSize.xs },
  demoHint: { color: colors.text.muted, fontSize: fontSize.xs, lineHeight: 18 },
  dna: { gap: space.xs },
  detail: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { color: colors.text.muted, fontSize: fontSize.sm },
  detailValue: { color: colors.text.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  missing: { color: colors.text.primary, fontSize: fontSize.lg, marginTop: space.xl, textAlign: "center" },
});
