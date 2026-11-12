// Android Keystore key attestation (PHASE2_PLAN §2.3). Pure checks, no database.
//
// A phone sends its key's certificate chain. We accept it only when ALL of these hold:
//   1. the chain ends at one of our pinned Google roots (attestation_roots.ts);
//   2. every signature in the chain verifies, and each certificate is in its validity period;
//   3. no certificate in the chain is on Google's revocation list (fails closed if the list
//      cannot be loaded);
//   4. the leaf's KeyDescription says TrustedEnvironment (1) or StrongBox (2), not Software (0);
//   5. the attestation challenge is the nonce we issued, and the leaf key is the key being registered.
import { ATTESTATION_ROOT_PEMS } from "./attestation_roots.ts";
import {
  base64ToBytes,
  bitStringBytes,
  bytesEqual,
  children,
  content,
  DerError,
  expectTag,
  integerBytes,
  oidToString,
  parseSingle,
  raw,
  smallInt,
  TAG,
  timeToDate,
} from "./der.ts";

export const KEY_DESCRIPTION_OID = "1.3.6.1.4.1.11129.2.1.17";
export const REVOCATION_URL = "https://android.googleapis.com/attestation/status";
export const REVOCATION_TTL_MS = 60 * 60 * 1000;
const MAX_CHAIN_LENGTH = 10;

const OID_RSA_ENCRYPTION = "1.2.840.113549.1.1.1";
const OID_EC_PUBLIC_KEY = "1.2.840.10045.2.1";
const OID_SHA256_WITH_RSA = "1.2.840.113549.1.1.11";
const OID_ECDSA_SHA256 = "1.2.840.10045.4.3.2";
const OID_ECDSA_SHA384 = "1.2.840.10045.4.3.3";
const OID_P256 = "1.2.840.10045.3.1.7";
const OID_P384 = "1.3.132.0.34";

/** Thrown for any failed attestation check. `reason` is for logs, never shown to the client. */
export class AttestationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

/** Google's revocation list could not be loaded. Registration must fail closed. */
export class RevocationUnavailableError extends Error {}

/** Copies a Uint8Array into a standalone ArrayBuffer (WebCrypto and x509 typings need this). */
export function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export interface ParsedCert {
  der: Uint8Array;
  serialHex: string;
  issuerDer: Uint8Array;
  subjectDer: Uint8Array;
  spkiDer: Uint8Array;
  tbsDer: Uint8Array;
  sigAlgOid: string;
  signature: Uint8Array;
  notBefore: Date;
  notAfter: Date;
  extensions: Map<string, Uint8Array>;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Lowercase hex without leading zeros. Used to compare serial numbers. */
export function normalizeSerial(hex: string): string {
  const s = hex.trim().toLowerCase().replace(/^0+/, "");
  return s === "" ? "0" : s;
}

/** Parses one X.509 certificate (DER). Throws DerError on malformed input. */
export function parseCertificate(der: Uint8Array): ParsedCert {
  const cert = expectTag(parseSingle(der), TAG.SEQUENCE);
  const parts = children(cert);
  if (parts.length !== 3) throw new DerError("certificate must have 3 parts");
  const [tbs, outerAlg, sigBits] = parts;
  expectTag(tbs, TAG.SEQUENCE);
  expectTag(outerAlg, TAG.SEQUENCE);

  const f = children(tbs);
  let i = 0;
  if (f[0] && f[0].tag === TAG.CONTEXT_0) i++; // version (optional)
  const serial = expectTag(f[i++], TAG.INTEGER);
  const innerAlg = expectTag(f[i++], TAG.SEQUENCE);
  const issuer = expectTag(f[i++], TAG.SEQUENCE);
  const validity = children(expectTag(f[i++], TAG.SEQUENCE));
  const subject = expectTag(f[i++], TAG.SEQUENCE);
  const spki = expectTag(f[i++], TAG.SEQUENCE);
  if (validity.length !== 2) throw new DerError("validity must have 2 times");

  const sigAlgOid = oidToString(children(outerAlg)[0]);
  // The signature algorithm is stated twice. A mismatch means the certificate was altered.
  if (oidToString(children(innerAlg)[0]) !== sigAlgOid) throw new DerError("signature algorithm mismatch");

  const extensions = new Map<string, Uint8Array>();
  for (; i < f.length; i++) {
    if (f[i].tag !== TAG.CONTEXT_3) continue;
    const extList = expectTag(children(f[i])[0], TAG.SEQUENCE);
    for (const ext of children(extList)) {
      const kids = children(expectTag(ext, TAG.SEQUENCE));
      const oid = oidToString(kids[0]);
      const value = expectTag(kids[kids.length - 1], TAG.OCTET_STRING);
      extensions.set(oid, content(value));
    }
  }

  return {
    der,
    serialHex: normalizeSerial(bytesToHex(integerBytes(serial))),
    issuerDer: raw(issuer),
    subjectDer: raw(subject),
    spkiDer: raw(spki),
    tbsDer: raw(tbs),
    sigAlgOid,
    signature: bitStringBytes(sigBits),
    notBefore: timeToDate(validity[0]),
    notAfter: timeToDate(validity[1]),
    extensions,
  };
}

/** Converts a DER-encoded ECDSA signature to the raw r||s form WebCrypto expects. */
function ecdsaDerToRaw(sig: Uint8Array, size: number): Uint8Array {
  const seq = expectTag(parseSingle(sig), TAG.SEQUENCE);
  const [r, s] = children(seq);
  if (!r || !s) throw new DerError("ECDSA signature must have r and s");
  const rb = integerBytes(expectTag(r, TAG.INTEGER));
  const sb = integerBytes(expectTag(s, TAG.INTEGER));
  if (rb.length > size || sb.length > size) throw new DerError("ECDSA value too large");
  const out = new Uint8Array(size * 2);
  out.set(rb, size - rb.length);
  out.set(sb, size * 2 - sb.length);
  return out;
}

/** True only if `sig` is a valid signature of `data` by the key in `spkiDer`. Unknown algorithms are false. */
export async function verifySignature(
  spkiDer: Uint8Array,
  data: Uint8Array,
  sigAlgOid: string,
  sig: Uint8Array,
): Promise<boolean> {
  try {
    const spki = expectTag(parseSingle(spkiDer), TAG.SEQUENCE);
    const [algId] = children(spki);
    const algKids = children(expectTag(algId, TAG.SEQUENCE));
    const keyOid = oidToString(algKids[0]);

    if (keyOid === OID_RSA_ENCRYPTION) {
      if (sigAlgOid !== OID_SHA256_WITH_RSA) return false;
      const key = await crypto.subtle.importKey(
        "spki",
        toArrayBuffer(spkiDer),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, toArrayBuffer(sig), toArrayBuffer(data));
    }

    if (keyOid === OID_EC_PUBLIC_KEY) {
      let namedCurve: string;
      let size: number;
      const curve = oidToString(algKids[1]);
      if (curve === OID_P256) {
        namedCurve = "P-256";
        size = 32;
      } else if (curve === OID_P384) {
        namedCurve = "P-384";
        size = 48;
      } else {
        return false;
      }
      let hash: string;
      if (sigAlgOid === OID_ECDSA_SHA256) hash = "SHA-256";
      else if (sigAlgOid === OID_ECDSA_SHA384) hash = "SHA-384";
      else return false;

      const key = await crypto.subtle.importKey(
        "spki",
        toArrayBuffer(spkiDer),
        { name: "ECDSA", namedCurve },
        false,
        ["verify"],
      );
      return await crypto.subtle.verify(
        { name: "ECDSA", hash },
        key,
        toArrayBuffer(ecdsaDerToRaw(sig, size)),
        toArrayBuffer(data),
      );
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks that `chain` (leaf first) leads to one of `roots`, that every signature
 * verifies, and that each non-root certificate is valid at `now`.
 * Returns the full path, ending at the pinned root.
 */
export async function verifyChain(
  chain: ParsedCert[],
  roots: ParsedCert[],
  now: Date,
): Promise<ParsedCert[]> {
  if (chain.length === 0) throw new AttestationError("chain_empty");
  const top = chain[chain.length - 1];

  // The top must be a pinned root, or be issued by one.
  let anchor = roots.find((r) => bytesEqual(r.der, top.der));
  if (!anchor) {
    anchor = roots.find((r) => bytesEqual(r.subjectDer, top.issuerDer));
    if (!anchor) throw new AttestationError("chain_untrusted");
  }
  const full = bytesEqual(top.der, anchor.der) ? [...chain] : [...chain, anchor];

  for (let i = 0; i < full.length - 1; i++) {
    const child = full[i];
    const parent = full[i + 1];
    if (!bytesEqual(child.issuerDer, parent.subjectDer)) throw new AttestationError("chain_untrusted");
    const ok = await verifySignature(parent.spkiDer, child.tbsDer, child.sigAlgOid, child.signature);
    if (!ok) throw new AttestationError("chain_signature");
  }

  for (const c of chain) {
    if (now < c.notBefore || now > c.notAfter) throw new AttestationError("chain_expired");
  }
  return full;
}

let pinned: ParsedCert[] | null = null;

/** Parses the pinned roots once. */
export function pinnedRoots(): ParsedCert[] {
  if (!pinned) {
    pinned = ATTESTATION_ROOT_PEMS.map((pem) => {
      const b64 = pem
        .replace("-----BEGIN CERTIFICATE-----", "")
        .replace("-----END CERTIFICATE-----", "")
        .replace(/\s+/g, "");
      return parseCertificate(base64ToBytes(b64));
    });
  }
  return pinned;
}

export interface AttestationInput {
  /** Base64 DER certificates, leaf first. */
  chainB64: unknown;
  /** Base64 SPKI of the key being registered. */
  publicKeyB64: string;
  /** The nonce we issued. It must be the attestation challenge. */
  challenge: string;
  /** Serial numbers on Google's revocation list (normalised). */
  revoked: Set<string>;
  roots?: ParsedCert[];
  now?: Date;
}

export interface AttestationResult {
  securityLevel: "TrustedEnvironment" | "StrongBox";
}

/** Full attestation check. Throws AttestationError with a short reason. */
export async function verifyKeyAttestation(input: AttestationInput): Promise<AttestationResult> {
  const chainB64 = input.chainB64;
  if (!Array.isArray(chainB64) || chainB64.length === 0) throw new AttestationError("chain_empty");
  if (chainB64.length > MAX_CHAIN_LENGTH) throw new AttestationError("chain_too_long");

  let chain: ParsedCert[];
  try {
    chain = chainB64.map((c) => {
      if (typeof c !== "string") throw new Error("not a string");
      return parseCertificate(base64ToBytes(c));
    });
  } catch {
    throw new AttestationError("chain_parse");
  }

  const full = await verifyChain(chain, input.roots ?? pinnedRoots(), input.now ?? new Date());

  for (const c of full) {
    if (input.revoked.has(c.serialHex)) throw new AttestationError("chain_revoked");
  }

  const leaf = chain[0];
  const ext = leaf.extensions.get(KEY_DESCRIPTION_OID);
  if (!ext) throw new AttestationError("no_extension");

  let level: number;
  let challenge: Uint8Array;
  try {
    const kids = children(expectTag(parseSingle(ext), TAG.SEQUENCE));
    if (kids.length < 5) throw new DerError("KeyDescription too short");
    level = smallInt(kids[1]);
    challenge = content(expectTag(kids[4], TAG.OCTET_STRING));
  } catch {
    throw new AttestationError("parse");
  }

  if (level === 0) throw new AttestationError("software_only");
  if (level !== 1 && level !== 2) throw new AttestationError("parse");

  if (!bytesEqual(challenge, new TextEncoder().encode(input.challenge))) {
    throw new AttestationError("challenge_mismatch");
  }

  let keyDer: Uint8Array;
  try {
    keyDer = base64ToBytes(input.publicKeyB64);
  } catch {
    throw new AttestationError("key_mismatch");
  }
  if (!bytesEqual(leaf.spkiDer, keyDer)) throw new AttestationError("key_mismatch");

  return { securityLevel: level === 2 ? "StrongBox" : "TrustedEnvironment" };
}

// ---------- Revocation list (Google's status file) ----------

let revocationCache: { at: number; serials: Set<string> } | null = null;

/** Downloads the list. Throws RevocationUnavailableError on any problem (never returns a partial list). */
export async function fetchRevokedSerials(fetchFn: typeof fetch = fetch): Promise<Set<string>> {
  let body: unknown;
  try {
    const res = await fetchFn(REVOCATION_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`status ${res.status}`);
    body = await res.json();
  } catch {
    throw new RevocationUnavailableError("revocation list could not be loaded");
  }
  const keys = (body as { keys?: unknown } | null)?.keys;
  if (!keys || typeof keys !== "object") throw new RevocationUnavailableError("revocation list malformed");
  const serials = new Set(Object.keys(keys).map(normalizeSerial));
  if (serials.size === 0) throw new RevocationUnavailableError("revocation list is empty");
  return serials;
}

/** Cached for one hour. If the list is stale and cannot be reloaded, this throws. */
export async function loadRevokedSerials(
  fetchFn: typeof fetch = fetch,
  nowMs: number = Date.now(),
): Promise<Set<string>> {
  if (revocationCache && nowMs - revocationCache.at < REVOCATION_TTL_MS) {
    return revocationCache.serials;
  }
  const serials = await fetchRevokedSerials(fetchFn);
  revocationCache = { at: nowMs, serials };
  return serials;
}

export function resetRevocationCache(): void {
  revocationCache = null;
}
