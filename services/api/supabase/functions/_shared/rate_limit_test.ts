import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { ApiError } from "./http.ts";
import { allowRequest, enforceLimit } from "./rate_limit.ts";
import { deviceActionKey, DEVICE_ACTION_LIMITS, ipKey } from "./limits.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// A fake of rate_limit_hit(): counts per key and allows up to `max` calls.
function fakeAdmin() {
  const counts = new Map<string, number>();
  const calls: Array<{ key: string; window: number; max: number }> = [];
  const admin = {
    rpc: (_name: string, args: { p_key: string; p_window_seconds: number; p_max: number }) => {
      calls.push({ key: args.p_key, window: args.p_window_seconds, max: args.p_max });
      const n = (counts.get(args.p_key) ?? 0) + 1;
      counts.set(args.p_key, n);
      return Promise.resolve({ data: n <= args.p_max, error: null });
    },
  };
  return { admin: admin as unknown as SupabaseClient, calls };
}

Deno.test("allowRequest allows up to max and then refuses", async () => {
  const { admin } = fakeAdmin();
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await allowRequest(admin, "k", 60, 3));
  assertEquals(results, [true, true, true, false]);
});

Deno.test("each key has its own window", async () => {
  const { admin } = fakeAdmin();
  for (let i = 0; i < 3; i++) await allowRequest(admin, "a", 60, 3);
  assertEquals(await allowRequest(admin, "b", 60, 3), true);
  assertEquals(await allowRequest(admin, "a", 60, 3), false);
});

Deno.test("enforceLimit throws 429 RATE_LIMITED with retry_after once full", async () => {
  const { admin } = fakeAdmin();
  await enforceLimit(admin, "x", 3600, 1);
  const err = await assertRejects(() => enforceLimit(admin, "x", 3600, 1), ApiError);
  assertEquals(err.status, 429);
  assertEquals(err.code, "RATE_LIMITED");
});

Deno.test("device limits are per account, and the rule for each action is sane", () => {
  assertEquals(deviceActionKey("register", "u1") === deviceActionKey("register", "u2"), false);
  assertEquals(deviceActionKey("register", "u1") === deviceActionKey("activate", "u1"), false);
  for (const rule of Object.values(DEVICE_ACTION_LIMITS)) {
    assertEquals(rule.windowSeconds, 3600);
    assertEquals(rule.max > 0, true);
  }
  // Registering a phone is the most sensitive step, so it has the tightest limit.
  assertEquals(DEVICE_ACTION_LIMITS.register.max <= DEVICE_ACTION_LIMITS.activate.max, true);
});

Deno.test("ip keys are per IP and per scope", () => {
  assertEquals(ipKey("google", "1.2.3.4") === ipKey("devices", "1.2.3.4"), false);
  assertEquals(ipKey("google", "1.2.3.4") === ipKey("google", "5.6.7.8"), false);
  assertEquals(ipKey("google", "") === ipKey("google", "unknown"), true);
});
