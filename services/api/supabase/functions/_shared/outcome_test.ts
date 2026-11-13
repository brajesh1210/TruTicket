import { assertEquals } from "jsr:@std/assert@1";
import { ApiError } from "./http.ts";
import { refuse, resultOf, rowOf } from "./outcome.ts";

Deno.test("a table result reads out_result from the first row", () => {
  assertEquals(resultOf([{ out_result: "OK", out_listing_id: null }]), "OK");
  assertEquals(resultOf({ out_result: "OVER_CAP" }), "OVER_CAP");
  assertEquals(resultOf("CLAIMED"), "CLAIMED");
});

Deno.test("an empty rpc result is an error, not a silent pass", () => {
  let thrown = false;
  try { rowOf([]); } catch { thrown = true; }
  assertEquals(thrown, true);
});

Deno.test("a known refusal maps to its status and code; an unknown one is retryable", () => {
  const table = { OVER_CAP: [422, "OVER_CAP", "Too high."] as [number, string, string] };
  const known = refuse("OVER_CAP", table);
  assertEquals(known instanceof ApiError, true);
  assertEquals(known.status, 422);
  assertEquals(known.code, "OVER_CAP");
  const unknown = refuse("SOMETHING_NEW", table);
  assertEquals(unknown.status, 500);
  assertEquals(unknown.code, "TRY_AGAIN");
});
