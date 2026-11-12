// Minimal strict DER reader (ASN.1). Enough for X.509 certificates and Android
// KeyDescription. Strict on purpose: indefinite lengths, non-minimal lengths and
// anything that runs past the buffer are rejected. Used by attestation.ts.

export const TAG = {
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  ENUMERATED: 0x0a,
  UTF8_STRING: 0x0c,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18,
  SEQUENCE: 0x30,
  SET: 0x31,
  CONTEXT_0: 0xa0,
  CONTEXT_1: 0xa1,
  CONTEXT_2: 0xa2,
  CONTEXT_3: 0xa3,
} as const;

export interface Tlv {
  tag: number;
  /** Offset of the tag byte in the buffer. */
  offset: number;
  /** Offset of the first content byte. */
  start: number;
  /** Offset just after the last content byte. */
  end: number;
  buf: Uint8Array;
}

export class DerError extends Error {}

/** Reads one TLV at `offset`. Throws DerError on anything malformed. */
export function readTlv(buf: Uint8Array, offset: number): Tlv {
  if (offset < 0 || offset + 2 > buf.length) throw new DerError("truncated tag/length");
  const tag = buf[offset];
  if ((tag & 0x1f) === 0x1f) throw new DerError("high-tag-number form not supported");

  let len = buf[offset + 1];
  let pos = offset + 2;
  if (len === 0x80) throw new DerError("indefinite length not allowed in DER");
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4) throw new DerError("unsupported length size");
    if (pos + n > buf.length) throw new DerError("truncated length");
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[pos + i];
    if (len < 0x80 || (n > 1 && buf[pos] === 0)) throw new DerError("non-minimal length");
    pos += n;
  }
  const end = pos + len;
  if (end > buf.length) throw new DerError("length runs past the buffer");
  return { tag, offset, start: pos, end, buf };
}

/** Reads the whole buffer as exactly one TLV. Trailing bytes are an error. */
export function parseSingle(buf: Uint8Array): Tlv {
  const t = readTlv(buf, 0);
  if (t.end !== buf.length) throw new DerError("trailing bytes after the value");
  return t;
}

export function expectTag(t: Tlv, tag: number): Tlv {
  if (t.tag !== tag) throw new DerError(`expected tag 0x${tag.toString(16)}, got 0x${t.tag.toString(16)}`);
  return t;
}

/** Child TLVs of a constructed value. */
export function children(t: Tlv): Tlv[] {
  const out: Tlv[] = [];
  let pos = t.start;
  while (pos < t.end) {
    const c = readTlv(t.buf, pos);
    out.push(c);
    pos = c.end;
  }
  return out;
}

/** Content bytes (without tag and length). */
export function content(t: Tlv): Uint8Array {
  return t.buf.subarray(t.start, t.end);
}

/** The complete encoding of this TLV (tag, length and content). */
export function raw(t: Tlv): Uint8Array {
  return t.buf.subarray(t.offset, t.end);
}

/** Dotted OID, for example "1.2.840.113549.1.1.11". */
export function oidToString(t: Tlv): string {
  expectTag(t, TAG.OID);
  const b = content(t);
  if (b.length === 0) throw new DerError("empty OID");
  const parts: number[] = [];
  const first = b[0];
  parts.push(Math.floor(first / 40), first % 40);
  let value = 0;
  for (let i = 1; i < b.length; i++) {
    value = value * 128 + (b[i] & 0x7f);
    if ((b[i] & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }
  if (b[b.length - 1] & 0x80) throw new DerError("OID ends mid-arc");
  return parts.join(".");
}

/** Integer content bytes, with the leading sign byte removed when it is 0x00. */
export function integerBytes(t: Tlv): Uint8Array {
  expectTag(t, TAG.INTEGER);
  const b = content(t);
  if (b.length === 0) throw new DerError("empty INTEGER");
  return b[0] === 0 && b.length > 1 ? b.subarray(1) : b;
}

/** Small non-negative INTEGER or ENUMERATED as a JS number. */
export function smallInt(t: Tlv): number {
  if (t.tag !== TAG.INTEGER && t.tag !== TAG.ENUMERATED) throw new DerError("expected an integer");
  const b = content(t);
  if (b.length === 0 || b.length > 4) throw new DerError("integer out of range");
  if (b[0] & 0x80) throw new DerError("negative integer not allowed here");
  let v = 0;
  for (const x of b) v = v * 256 + x;
  return v;
}

/** BIT STRING payload. Requires zero unused bits (true for keys and signatures). */
export function bitStringBytes(t: Tlv): Uint8Array {
  expectTag(t, TAG.BIT_STRING);
  const b = content(t);
  if (b.length < 1 || b[0] !== 0) throw new DerError("BIT STRING with unused bits");
  return b.subarray(1);
}

/** Parses an X.509 UTCTime or GeneralizedTime (always Z-terminated in DER). */
export function timeToDate(t: Tlv): Date {
  const s = new TextDecoder().decode(content(t));
  let m: RegExpMatchArray | null;
  if (t.tag === TAG.UTC_TIME) {
    m = s.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
    if (!m) throw new DerError("bad UTCTime");
    const yy = Number(m[1]);
    const year = yy >= 50 ? 1900 + yy : 2000 + yy;
    return new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])));
  }
  if (t.tag === TAG.GENERALIZED_TIME) {
    m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
    if (!m) throw new DerError("bad GeneralizedTime");
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])));
  }
  throw new DerError("expected a time");
}

export function bytesToBase64(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

export function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
