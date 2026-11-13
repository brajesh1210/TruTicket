// Function configuration, read from Edge Function secrets.
// Secrets are set in the Supabase dashboard or with the deploy script. Never commit values.
import { ApiError } from "./http.ts";
import { emailKey } from "./identity.ts";

export interface Config {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  googleClientIds: string[];
  otpSecret: string;
  brevoKey: string;
  emailFrom: string;
  emailFromName: string;
  demoMode: boolean;
  demoEmailKeys: string[];
  demoOtpCode: string;
  /** False only when ATTESTATION_REQUIRED=false (dev tests without a phone). Default true. */
  attestationRequired: boolean;
  /** Razorpay (2.6). Empty until the keys are set. Orders refuse to run without them. */
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  /** Signs the rotating ticket QR (2.7). Empty means QR issue and scan refuse to run. */
  qrHmacKey: string;
}

function required(name: string): string {
  const v = Deno.env.get(name);
  if (!v) {
    console.error(`config missing: ${name}`);
    throw new ApiError(500, "CONFIG_MISSING", "Service is not configured.");
  }
  return v;
}

function list(name: string): string[] {
  return (Deno.env.get(name) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function loadConfig(): Config {
  const otpSecret = required("OTP_HMAC_KEY");
  if (otpSecret.length < 32) {
    console.error("config invalid: OTP_HMAC_KEY is shorter than 32 characters");
    throw new ApiError(500, "CONFIG_INVALID", "Service is not configured.");
  }

  // DEMO_MODE is off unless set to exactly "true". Never set it on the production project.
  const demoMode = Deno.env.get("DEMO_MODE") === "true";
  const demoOtpCode = Deno.env.get("DEMO_OTP_CODE") ?? "";
  if (demoMode && !/^\d{6}$/.test(demoOtpCode)) {
    console.error("config invalid: DEMO_MODE is on but DEMO_OTP_CODE is not 6 digits");
    throw new ApiError(500, "CONFIG_INVALID", "Service is not configured.");
  }

  return {
    supabaseUrl: required("SUPABASE_URL"),
    anonKey: required("SUPABASE_ANON_KEY"),
    serviceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    googleClientIds: list("GOOGLE_CLIENT_IDS"),
    otpSecret,
    brevoKey: Deno.env.get("BREVO_API_KEY") ?? "",
    emailFrom: Deno.env.get("EMAIL_FROM") ?? "",
    emailFromName: Deno.env.get("EMAIL_FROM_NAME") || "TruTicket",
    demoMode,
    demoEmailKeys: list("DEMO_EMAILS").map(emailKey),
    demoOtpCode,
    attestationRequired: Deno.env.get("ATTESTATION_REQUIRED") !== "false",
    razorpayKeyId: Deno.env.get("RAZORPAY_KEY_ID") ?? "",
    razorpayKeySecret: Deno.env.get("RAZORPAY_KEY_SECRET") ?? "",
    razorpayWebhookSecret: Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "",
    qrHmacKey: Deno.env.get("QR_HMAC_KEY") ?? "",
  };
}
