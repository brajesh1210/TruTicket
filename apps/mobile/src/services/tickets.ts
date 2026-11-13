/** Buyer tickets and the rotating gate QR. Source: the `tickets` Edge Function. */
import { useCallback, useEffect, useState } from "react";
import { callFunction } from "./api";
import { messageOf } from "./errors";
import { toAppTicket, type RawTicket } from "./mappers";
import type { AppTicket } from "./types";

export async function fetchMyTickets(): Promise<AppTicket[]> {
  const res = await callFunction<{ tickets: RawTicket[] }>("tickets", { action: "mine" }, { auth: true });
  return res.tickets.map((t) => toAppTicket(t)).filter((t): t is AppTicket => t !== null);
}

export type GateQr = { token: string; expiresAt: number; ttlSeconds: number };

/** A fresh gate token. It is valid for 10 seconds, so call again before it expires. */
export async function fetchTicketQr(ticketId: string): Promise<GateQr> {
  const res = await callFunction<{ token: string; expires_at: string; ttl_seconds: number }>(
    "tickets",
    { action: "qr", ticket_id: ticketId },
    { auth: true },
  );
  return {
    token: res.token,
    expiresAt: new Date(res.expires_at).getTime(),
    ttlSeconds: res.ttl_seconds,
  };
}

export function useMyTickets() {
  const [tickets, setTickets] = useState<AppTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchMyTickets()
      .then((t) => alive && setTickets(t))
      .catch((e) => alive && setError(messageOf(e, "Could not load your tickets.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { tickets, error, loading, reload };
}
