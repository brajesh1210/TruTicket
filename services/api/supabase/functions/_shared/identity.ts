// Email helpers. emailKey() MUST match public.normalise_email_key() in
// supabase/migrations/002_auth_sessions.sql. The parity test checks this.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim and lowercase. The original address is kept for sending. */
export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Duplicate-check key. Gmail and Googlemail: drop +tags and dots.
 * Other providers: lowercase only (open question in PHASE2_PLAN §6).
 */
export function emailKey(input: string): string {
  const email = normaliseEmail(input);
  const at = email.indexOf("@");
  let local = at === -1 ? email : email.slice(0, at);
  let domain = at === -1 ? "" : email.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.split("+")[0].replaceAll(".", "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

export function isValidEmail(input: string): boolean {
  const email = normaliseEmail(input);
  return email.length <= 254 && EMAIL_RE.test(email);
}
