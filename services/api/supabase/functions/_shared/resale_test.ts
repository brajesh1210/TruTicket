import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { formatInr, maxResalePriceMinor, parseAskMinor } from "./resale.ts";

Deno.test("the cap is face × capBps / 10000, rounded down", () => {
  assertEquals(maxResalePriceMinor(49900, 11000), 54890); // ₹499 at 110%
  assertEquals(maxResalePriceMinor(999, 11000), 1098); // 1098.9 -> 1098, never up
  assertEquals(maxResalePriceMinor(200000, 11000), 220000); // ₹2000 group ticket at 110%
  assertEquals(maxResalePriceMinor(1, 11000), 1);
});

Deno.test("a no-profit cap resells at face value at most", () => {
  assertEquals(maxResalePriceMinor(49900, 10000), 49900);
});

Deno.test("cap and face value must be in range", () => {
  assertThrows(() => maxResalePriceMinor(49900, 9999));
  assertThrows(() => maxResalePriceMinor(49900, 20001));
  assertThrows(() => maxResalePriceMinor(-1, 11000));
  assertThrows(() => maxResalePriceMinor(499.5, 11000));
});

Deno.test("an ask must be a whole number of paise above zero", () => {
  assertEquals(parseAskMinor(54890), 54890);
  assertEquals(parseAskMinor(1), 1);
  assertEquals(parseAskMinor(0), null);
  assertEquals(parseAskMinor(-5), null);
  assertEquals(parseAskMinor(548.9), null);
  assertEquals(parseAskMinor("54890"), null);
  assertEquals(parseAskMinor(undefined), null);
});

Deno.test("prices show as rupees with two decimals when needed", () => {
  assertEquals(formatInr(54890), "₹548.90");
  assertEquals(formatInr(49900), "₹499");
});
