// Finds and creates accounts. The database unique indexes are the final guard:
//   user_emails:  one verified emailKey per account (uq_verified_email_key)
//   user_identities: one (provider, subject) per account
// A race that breaks a unique index returns EMAIL_LINKED, not a 500.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ApiError } from "./http.ts";

const UNIQUE_VIOLATION = "23505";

export const EMAIL_LINKED_MESSAGE =
  "This email is already linked to a TruTicket account. Sign in with the email code instead, or contact support if you no longer have access.";

/** The account that holds this verified email key, or null. */
export async function findVerifiedOwner(
  admin: SupabaseClient,
  key: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("user_emails")
    .select("user_id")
    .eq("email_key", key)
    .not("verified_at", "is", null)
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? (data[0].user_id as string) : null;
}

/** The account that owns this login identity, or null. */
export async function findIdentity(
  admin: SupabaseClient,
  provider: "google" | "email",
  subject: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("user_identities")
    .select("user_id")
    .eq("provider", provider)
    .eq("provider_subject", subject)
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? (data[0].user_id as string) : null;
}

/**
 * Creates a new auth user with a verified email and one identity.
 * If any step fails, the auth user is removed so no half-made account stays.
 */
export async function createAccount(
  admin: SupabaseClient,
  args: { email: string; key: string; provider: "google" | "email"; subject: string },
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: args.email,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  const userId = data.user.id;

  const rollback = async () => {
    await admin.auth.admin.deleteUser(userId);
  };

  const emailInsert = await admin.from("user_emails").insert({
    user_id: userId,
    email: args.email,
    email_key: args.key,
    verified_at: new Date().toISOString(),
  });
  if (emailInsert.error) {
    await rollback();
    if (emailInsert.error.code === UNIQUE_VIOLATION) {
      throw new ApiError(409, "EMAIL_LINKED", EMAIL_LINKED_MESSAGE);
    }
    throw emailInsert.error;
  }

  const identityInsert = await admin.from("user_identities").insert({
    user_id: userId,
    provider: args.provider,
    provider_subject: args.subject,
  });
  if (identityInsert.error) {
    await rollback();
    if (identityInsert.error.code === UNIQUE_VIOLATION) {
      throw new ApiError(409, "EMAIL_LINKED", EMAIL_LINKED_MESSAGE);
    }
    throw identityInsert.error;
  }

  return userId;
}

/** Adds an identity to an existing account. Does nothing if it is already there. */
export async function ensureIdentity(
  admin: SupabaseClient,
  userId: string,
  provider: "google" | "email",
  subject: string,
): Promise<void> {
  const { error } = await admin.from("user_identities").insert({
    user_id: userId,
    provider,
    provider_subject: subject,
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}
