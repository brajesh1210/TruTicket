/**
 * Email helpers.
 *
 * - normalizeEmail: what we store and send to (trimmed, lowercase).
 * - duplicateKey:   used ONLY to detect duplicate accounts. Gmail ignores dots
 *                   and "+tag" parts, so "a.b+x@gmail.com" and "ab@gmail.com"
 *                   are the same mailbox. We never send to the duplicate key.
 */

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

export function duplicateKey(email: string): string {
  const e = normalizeEmail(email);
  const at = e.lastIndexOf("@");
  if (at < 0) return e;

  let local = e.slice(0, at);
  let domain = e.slice(at + 1);

  if (GMAIL_DOMAINS.has(domain)) {
    local = local.split("+")[0].replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}
