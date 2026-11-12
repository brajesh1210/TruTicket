// Attestation tests use a small synthetic PKI (ECDSA P-256 keys generated at run time), so
// every chain rule is exercised without network access. The pinned Google roots are only
// used by the production path; these tests inject their own root through `roots`.
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  AttestationError,
  fetchRevokedSerials,
  KEY_DESCRIPTION_OID,
  normalizeSerial,
  parseCertificate,
  pinnedRoots,
  RevocationUnavailableError,
  toArrayBuffer,
  verifyKeyAttestation,
  type AttestationInput,
} from "./attestation.ts";
import { bytesToBase64 } from "./der.ts";

const enc = new TextEncoder();

// ---------- tiny DER builder (test only) ----------

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function encLen(n: number): Uint8Array {
  if (n < 0x80) return Uint8Array.of(n);
  const bytes: number[] = [];
  let v = n;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function tlv(tag: number, body: Uint8Array): Uint8Array {
  return concat([Uint8Array.of(tag), encLen(body.length), body]);
}

const seq = (...p: Uint8Array[]) => tlv(0x30, concat(p));
const set = (...p: Uint8Array[]) => tlv(0x31, concat(p));
const octet = (b: Uint8Array) => tlv(0x04, b);
const bitstr = (b: Uint8Array) => tlv(0x03, concat([Uint8Array.of(0), b]));
const explicit = (n: number, b: Uint8Array) => tlv(0xa0 | n, b);
const utf8 = (s: string) => tlv(0x0c, enc.encode(s));
const enumerated = (v: number) => tlv(0x0a, Uint8Array.of(v));

/** INTEGER from a non-negative number. */
function int(n: number): Uint8Array {
  const bytes: number[] = [];
  let v = n;
  do {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  } while (v > 0);
  if (bytes[0] & 0x80) bytes.unshift(0);
  return tlv(0x02, Uint8Array.from(bytes));
}

/** INTEGER from raw unsigned bytes. */
function intRaw(b: Uint8Array): Uint8Array {
  let start = 0;
  while (start < b.length - 1 && b[start] === 0) start++;
  const body = b.subarray(start);
  return tlv(0x02, body[0] & 0x80 ? concat([Uint8Array.of(0), body]) : body);
}

function oid(dotted: string): Uint8Array {
  const parts = dotted.split(".").map(Number);
  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (const p of parts.slice(2)) {
    const stack: number[] = [];
    let v = p;
    do {
      stack.unshift(v & 0x7f);
      v = Math.floor(v / 128);
    } while (v > 0);
    for (let i = 0; i < stack.length - 1; i++) stack[i] |= 0x80;
    bytes.push(...stack);
  }
  return tlv(0x06, Uint8Array.from(bytes));
}

const OID_ECDSA_SHA256 = "1.2.840.10045.4.3.2";
const algEcdsa = () => seq(oid(OID_ECDSA_SHA256));
const name = (cn: string) => seq(set(seq(oid("2.5.4.3"), utf8(cn))));

function utcTime(d: Date): Uint8Array {
  const p = (n: number) => String(n).padStart(2, "0");
  const s = `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return tlv(0x17, enc.encode(s));
}

/** KeyDescription with the given security level and challenge (Android attestation schema). */
function keyDescription(level: number, challenge: string): Uint8Array {
  return seq(
    int(4), // attestationVersion
    enumerated(level), // attestationSecurityLevel
    int(4), // keymintVersion
    enumerated(level), // keymintSecurityLevel
    octet(enc.encode(challenge)), // attestationChallenge
    octet(new Uint8Array()), // uniqueId
    seq(), // softwareEnforced
    seq(), // teeEnforced
  );
}

/** ECDSA raw r||s (64 bytes for P-256) to DER SEQUENCE { r, s }. */
function rawToDerSig(raw: Uint8Array): Uint8Array {
  return seq(intRaw(raw.subarray(0, 32)), intRaw(raw.subarray(32, 64)));
}

interface CertOpts {
  serial: number;
  subject: string;
  issuer: string;
  subjectPub: CryptoKey;
  signer: CryptoKey;
  notBefore?: Date;
  notAfter?: Date;
  keyDesc?: Uint8Array;
}

async function makeCert(o: CertOpts): Promise<Uint8Array> {
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", o.subjectPub));
  const notBefore = o.notBefore ?? new Date("2020-01-01T00:00:00Z");
  const notAfter = o.notAfter ?? new Date("2040-01-01T00:00:00Z");
  const exts = o.keyDesc
    ? explicit(3, seq(seq(oid(KEY_DESCRIPTION_OID), octet(o.keyDesc))))
    : new Uint8Array();
  const tbs = seq(
    explicit(0, int(2)),
    int(o.serial),
    algEcdsa(),
    name(o.issuer),
    seq(utcTime(notBefore), utcTime(notAfter)),
    name(o.subject),
    spki,
    exts,
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, o.signer, toArrayBuffer(tbs)),
  );
  return seq(tbs, algEcdsa(), bitstr(rawToDerSig(sig)));
}

async function newKey(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
}

interface Pki {
  rootDer: Uint8Array;
  otherRootDer: Uint8Array;
  interDer: Uint8Array;
  leafKey: CryptoKeyPair;
  interKey: CryptoKeyPair;
  rootKey: CryptoKeyPair;
  leafFor(level: number, challenge: string, opts?: Partial<CertOpts>): Promise<Uint8Array>;
}

/** root (self-signed) -> intermediate -> leaf. `otherRoot` is a second root nobody pins. */
async function buildPki(): Promise<Pki> {
  const rootKey = await newKey();
  const otherKey = await newKey();
  const interKey = await newKey();
  const leafKey = await newKey();

  const rootDer = await makeCert({
    serial: 1,
    subject: "Test Root",
    issuer: "Test Root",
    subjectPub: rootKey.publicKey,
    signer: rootKey.privateKey,
  });
  const otherRootDer = await makeCert({
    serial: 9,
    subject: "Other Root",
    issuer: "Other Root",
    subjectPub: otherKey.publicKey,
    signer: otherKey.privateKey,
  });

  const interDer = await makeCert({
    serial: 2,
    subject: "Test Intermediate",
    issuer: "Test Root",
    subjectPub: interKey.publicKey,
    signer: rootKey.privateKey,
  });

  return {
    rootDer,
    otherRootDer,
    interDer,
    leafKey,
    interKey,
    rootKey,
    async leafFor(level, challenge, opts = {}) {
      return await makeCert({
        serial: 0x1234,
        subject: "Test Leaf",
        issuer: "Test Intermediate",
        subjectPub: leafKey.publicKey,
        signer: interKey.privateKey,
        keyDesc: keyDescription(level, challenge),
        ...opts,
      });
    },
  };
}

async function scenario(
  level = 1,
  opts: Partial<AttestationInput> & { leafOpts?: Partial<CertOpts> } = {},
) {
  const { leafOpts, ...inputOverrides } = opts;
  const pki = await buildPki();
  const interDer = pki.interDer;
  const leafDer = await pki.leafFor(level, "nonce-1", leafOpts);
  const leafPub = new Uint8Array(await crypto.subtle.exportKey("spki", pki.leafKey.publicKey));
  const input: AttestationInput = {
    chainB64: [bytesToBase64(leafDer), bytesToBase64(interDer)],
    publicKeyB64: bytesToBase64(leafPub),
    challenge: "nonce-1",
    revoked: new Set(),
    roots: [parseCertificate(pki.rootDer)],
    now: new Date("2026-11-11T00:00:00Z"),
    ...inputOverrides,
  };
  return { pki, input, leafDer, interDer };
}

async function expectReason(p: Promise<unknown>, reason: string) {
  await assertRejects(() => p, AttestationError, reason);
}

// ---------- tests ----------

Deno.test("parseCertificate reads serial, names and the KeyDescription extension", async () => {
  const pki = await buildPki();
  const der = await pki.leafFor(1, "nonce-1");
  const c = parseCertificate(der);
  assertEquals(c.serialHex, "1234");
  assertEquals(c.extensions.has(KEY_DESCRIPTION_OID), true);
  assertEquals(c.sigAlgOid, OID_ECDSA_SHA256);
});

Deno.test("accepts a valid chain at TrustedEnvironment level", async () => {
  const { input } = await scenario(1);
  const r = await verifyKeyAttestation(input);
  assertEquals(r.securityLevel, "TrustedEnvironment");
});

Deno.test("accepts a valid chain at StrongBox level", async () => {
  const { input } = await scenario(2);
  const r = await verifyKeyAttestation(input);
  assertEquals(r.securityLevel, "StrongBox");
});

Deno.test("rejects a software-only key", async () => {
  const { input } = await scenario(0);
  await expectReason(verifyKeyAttestation(input), "software_only");
});

Deno.test("rejects a challenge that is not the nonce we issued", async () => {
  const { input } = await scenario(1);
  await expectReason(verifyKeyAttestation({ ...input, challenge: "other-nonce" }), "challenge_mismatch");
});

Deno.test("rejects a registered key that is not the attested leaf key", async () => {
  const { input } = await scenario(1);
  const otherPub = new Uint8Array(await crypto.subtle.exportKey("spki", (await newKey()).publicKey));
  await expectReason(
    verifyKeyAttestation({ ...input, publicKeyB64: bytesToBase64(otherPub) }),
    "key_mismatch",
  );
});

Deno.test("rejects a leaf without the attestation extension", async () => {
  const { input } = await scenario(1, { leafOpts: { keyDesc: undefined } });
  await expectReason(verifyKeyAttestation(input), "no_extension");
});

Deno.test("rejects a chain that ends at a root we do not pin", async () => {
  const { input, pki } = await scenario(1);
  await expectReason(
    verifyKeyAttestation({ ...input, roots: [parseCertificate(pki.otherRootDer)] }),
    "chain_untrusted",
  );
});

Deno.test("rejects a leaf whose signature does not come from its issuer", async () => {
  const { input, pki, interDer } = await scenario(1);
  const forged = await makeCert({
    serial: 0x1234,
    subject: "Test Leaf",
    issuer: "Test Intermediate",
    subjectPub: pki.leafKey.publicKey,
    signer: (await newKey()).privateKey,
    keyDesc: keyDescription(1, "nonce-1"),
  });
  await expectReason(
    verifyKeyAttestation({ ...input, chainB64: [bytesToBase64(forged), bytesToBase64(interDer)] }),
    "chain_signature",
  );
});

Deno.test("rejects an expired certificate in the chain", async () => {
  const { input } = await scenario(1, {
    leafOpts: { notBefore: new Date("2020-01-01T00:00:00Z"), notAfter: new Date("2021-01-01T00:00:00Z") },
  });
  await expectReason(verifyKeyAttestation(input), "chain_expired");
});

Deno.test("rejects a chain with a revoked serial number", async () => {
  const { input } = await scenario(1);
  await expectReason(verifyKeyAttestation({ ...input, revoked: new Set(["1234"]) }), "chain_revoked");
});

Deno.test("rejects an empty chain", async () => {
  const { input } = await scenario(1);
  await expectReason(verifyKeyAttestation({ ...input, chainB64: [] }), "chain_empty");
});

Deno.test("rejects a chain that is not valid base64 DER", async () => {
  const { input } = await scenario(1);
  await expectReason(verifyKeyAttestation({ ...input, chainB64: ["not-a-certificate"] }), "chain_parse");
});

Deno.test("rejects a chain longer than the limit", async () => {
  const { input } = await scenario(1);
  const many = Array.from({ length: 11 }, () => input.chainB64 as string[]).flat();
  await expectReason(verifyKeyAttestation({ ...input, chainB64: many }), "chain_too_long");
});

Deno.test("normalises serial numbers for comparison", () => {
  assertEquals(normalizeSerial("00AB"), "ab");
  assertEquals(normalizeSerial("0000"), "0");
});

Deno.test("revocation list: keys become normalised serials", async () => {
  const fake = (async () =>
    new Response(JSON.stringify({ keys: { "00AB": { status: "REVOKED" }, "1F": {} } }), { status: 200 })) as typeof fetch;
  const set = await fetchRevokedSerials(fake);
  assertEquals(set.has("ab"), true);
  assertEquals(set.has("1f"), true);
});

Deno.test("revocation list: fails closed when it cannot be loaded", async () => {
  const down = (async () => new Response("nope", { status: 503 })) as typeof fetch;
  await assertRejects(() => fetchRevokedSerials(down), RevocationUnavailableError);
  const empty = (async () => new Response(JSON.stringify({ keys: {} }), { status: 200 })) as typeof fetch;
  await assertRejects(() => fetchRevokedSerials(empty), RevocationUnavailableError);
});

Deno.test("the five pinned Google roots parse and include the two known keys", async () => {
  const roots = pinnedRoots();
  assertEquals(roots.length, 5);
  const hashes = await Promise.all(
    roots.map(async (r) => {
      const d = new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(r.spkiDer)));
      return Array.from(d.slice(0, 3), (x) => x.toString(16).padStart(2, "0")).join("");
    }),
  );
  assertEquals(hashes.filter((h) => h === "feb2ea").length, 4); // RSA roots
  assertEquals(hashes.filter((h) => h === "3ee445").length, 1); // Key Attestation CA1 (ECDSA)
});
