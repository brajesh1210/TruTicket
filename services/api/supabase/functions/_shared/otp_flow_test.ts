// Brute-force check for the email code (PHASE2_PLAN §2.4 "done when"): wrong codes are
// counted, and after 5 wrong tries the code is locked, even if the right one is sent next.
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ApiError } from "./http.ts";
import { hashOtp, OTP_MAX_ATTEMPTS } from "./otp.ts";

// The spec says 5 wrong tries (PHASE2_PLAN §2.2 and §2.4). Pin it here, so changing the constant fails this test.
assertEquals(OTP_MAX_ATTEMPTS, 5);
import { checkCode } from "./otp_flow.ts";
import type { Config } from "./env.ts";

const SECRET = "test-otp-secret";
const KEY = "ansh@example.com";
const PURPOSE = "login" as const;
const RIGHT = "482913";

type Row = Record<string, unknown>;

// A tiny in-memory stand-in for the parts of supabase-js that checkCode uses.
function fakeAdmin(table: Row[]) {
  class Query {
    private filters: Array<(r: Row) => boolean> = [];
    private patch: Row | null = null;
    constructor(private rows: Row[]) {}
    eq(col: string, val: unknown) {
      this.filters.push((r) => r[col] === val);
      return this;
    }
    is(col: string, val: unknown) {
      this.filters.push((r) => (r[col] ?? null) === val);
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    select() {
      return this;
    }
    update(p: Row) {
      this.patch = p;
      return this;
    }
    then<T>(resolve: (v: unknown) => T, reject?: (e: unknown) => T) {
      try {
        const hit = this.rows.filter((r) => this.filters.every((f) => f(r)));
        if (this.patch) hit.forEach((r) => Object.assign(r, this.patch));
        return Promise.resolve({ data: hit.map((r) => ({ ...r })), error: null }).then(resolve, reject);
      } catch (e) {
        return Promise.resolve({ data: null, error: e }).then(resolve, reject);
      }
    }
  }
  const admin = {
    rpc: () => Promise.resolve({ data: true, error: null }), // never the limit in this test
    from: (name: string) => {
      if (name !== "otp_codes") throw new Error(`unexpected table ${name}`);
      return {
        select: () => new Query(table),
        update: (p: Row) => new Query(table).update(p),
      };
    },
  };
  return admin as unknown as SupabaseClient;
}

async function freshCode(): Promise<Row[]> {
  return [{
    id: "c1",
    email_key: KEY,
    purpose: PURPOSE,
    code_hash: await hashOtp(SECRET, KEY, PURPOSE, RIGHT),
    attempts: 0,
    max_attempts: OTP_MAX_ATTEMPTS,
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    consumed_at: null,
    created_at: new Date().toISOString(),
  }];
}

const cfg = { otpSecret: SECRET } as unknown as Config;
const WRONG = "000000";

Deno.test("5 wrong codes are refused, then the 6th try is locked even with the right code", async () => {
  const table = await freshCode();
  const admin = fakeAdmin(table);
  for (let i = 1; i <= 5; i++) {
    const err = await assertRejects(
      () => checkCode(cfg, admin, { key: KEY, purpose: PURPOSE, code: WRONG }),
      ApiError,
    );
    assertEquals(err.code, "OTP_INVALID", `wrong try ${i}`);
  }
  const locked = await assertRejects(
    () => checkCode(cfg, admin, { key: KEY, purpose: PURPOSE, code: RIGHT }),
    ApiError,
  );
  assertEquals(locked.status, 429);
  assertEquals(locked.code, "OTP_LOCKED");
  assertEquals(table[0].attempts, 5);
  assertEquals(table[0].consumed_at, null, "a locked code is not consumed");
});

Deno.test("4 wrong codes then the right one still works, and the code works only once", async () => {
  const table = await freshCode();
  const admin = fakeAdmin(table);
  for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) {
    await assertRejects(() => checkCode(cfg, admin, { key: KEY, purpose: PURPOSE, code: WRONG }), ApiError);
  }
  await checkCode(cfg, admin, { key: KEY, purpose: PURPOSE, code: RIGHT }); // passes
  const again = await assertRejects(
    () => checkCode(cfg, admin, { key: KEY, purpose: PURPOSE, code: RIGHT }),
    ApiError,
  );
  assertEquals(again.code, "OTP_INVALID", "a used code cannot be used again");
});

Deno.test("a malformed code is refused before any attempt is counted", async () => {
  const table = await freshCode();
  const admin = fakeAdmin(table);
  const err = await assertRejects(
    () => checkCode(cfg, admin, { key: KEY, purpose: PURPOSE, code: "12ab" }),
    ApiError,
  );
  assertEquals(err.code, "INVALID_INPUT");
  assertEquals(table[0].attempts, 0);
});
