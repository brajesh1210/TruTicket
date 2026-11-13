/** Events: list, detail, and the hooks screens use. Source: the `events` Edge Function. */
import { useCallback, useEffect, useState } from "react";
import { callFunction } from "./api";
import { ApiError, messageOf } from "./errors";
import { toAppEvent, type RawEvent } from "./mappers";
import type { AppEvent } from "./types";

export async function fetchEvents(): Promise<AppEvent[]> {
  const res = await callFunction<{ events: RawEvent[] }>("events", { action: "list" });
  return res.events.map(toAppEvent);
}

export async function fetchEvent(eventId: string): Promise<AppEvent> {
  const res = await callFunction<{ event: RawEvent }>("events", { action: "get", event_id: eventId });
  return toAppEvent(res.event);
}

type Loadable<T> = { data: T | null; loading: boolean; error: string | null; reload: () => void };

function useLoadable<T>(load: () => Promise<T>, deps: readonly unknown[]): Loadable<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    load()
      .then((d) => alive && setData(d))
      .catch((e) => {
        if (!alive) return;
        setError(messageOf(e, "Could not load. Check your connection and try again."));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

export function useEvents(): Loadable<AppEvent[]> {
  return useLoadable(fetchEvents, []);
}

export function useEvent(eventId: string | undefined): Loadable<AppEvent> {
  return useLoadable(
    () => {
      if (!eventId) return Promise.reject(new ApiError("NOT_FOUND", "Event not found."));
      return fetchEvent(eventId);
    },
    [eventId],
  );
}
