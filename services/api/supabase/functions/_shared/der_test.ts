import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { bitStringBytes, DerError, oidToString, readTlv, parseSingle, TAG, children, content } from "./der.ts";

Deno.test("reads short and long definite lengths", () => {
  const short = new Uint8Array([0x04, 0x03, 1, 2, 3]);
  const t1 = parseSingle(short);
  assertEquals(t1.tag, TAG.OCTET_STRING);
  assertEquals(Array.from(content(t1)), [1, 2, 3]);

  const body = new Uint8Array(200).fill(7);
  const long = new Uint8Array([0x04, 0x81, 200, ...body]);
  const t2 = parseSingle(long);
  assertEquals(t2.end - t2.start, 200);
});

Deno.test("rejects truncated values, trailing bytes, indefinite and non-minimal lengths", () => {
  assertThrows(() => readTlv(new Uint8Array([0x04, 0x05, 1, 2]), 0), DerError, "past the buffer");
  assertThrows(() => parseSingle(new Uint8Array([0x05, 0x00, 0x00])), DerError, "trailing");
  assertThrows(() => readTlv(new Uint8Array([0x30, 0x80, 0x00, 0x00]), 0), DerError, "indefinite");
  assertThrows(() => readTlv(new Uint8Array([0x04, 0x81, 0x05, 1, 2, 3, 4, 5]), 0), DerError, "non-minimal");
});

Deno.test("decodes OIDs and BIT STRING payloads", () => {
  // 1.2.840.113549.1.1.11 (sha256WithRSAEncryption)
  const oid = parseSingle(new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]));
  assertEquals(oidToString(oid), "1.2.840.113549.1.1.11");

  const bits = parseSingle(new Uint8Array([0x03, 0x03, 0x00, 0xaa, 0xbb]));
  assertEquals(Array.from(bitStringBytes(bits)), [0xaa, 0xbb]);
  assertThrows(() => bitStringBytes(parseSingle(new Uint8Array([0x03, 0x02, 0x04, 0xaa]))), DerError);
});

Deno.test("reads nested SEQUENCE children in order", () => {
  // SEQUENCE { INTEGER 5, NULL }
  const seq = parseSingle(new Uint8Array([0x30, 0x05, 0x02, 0x01, 0x05, 0x05, 0x00]));
  const kids = children(seq);
  assertEquals(kids.length, 2);
  assertEquals(kids[0].tag, TAG.INTEGER);
  assertEquals(kids[1].tag, TAG.NULL);
});
