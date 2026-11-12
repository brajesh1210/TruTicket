// Sends emails through Brevo's transactional API (free plan: 300 emails/day).
// Needs BREVO_API_KEY (an API v3 key) and EMAIL_FROM (a sender verified in Brevo).
import type { Config } from "./env.ts";
import { ApiError } from "./http.ts";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

export type OtpPurpose = "login" | "new_device";

const OTP_TEXT: Record<OtpPurpose, { subject: string; lead: string }> = {
  login: {
    subject: "Your TruTicket sign-in code",
    lead: "Your TruTicket sign-in code is",
  },
  new_device: {
    subject: "Your TruTicket code to activate a new phone",
    lead: "Your code to activate your new phone on TruTicket is",
  },
};

async function sendBrevo(cfg: Config, to: string, subject: string, text: string): Promise<void> {
  if (!cfg.brevoKey || !cfg.emailFrom) {
    console.error("email config missing: BREVO_API_KEY or EMAIL_FROM");
    throw new ApiError(500, "CONFIG_MISSING", "Service is not configured.");
  }

  const res = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      "api-key": cfg.brevoKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: cfg.emailFrom, name: cfg.emailFromName },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!res.ok) {
    // Log the status only. The response body can echo the recipient address.
    console.error("brevo send failed", res.status);
    throw new ApiError(502, "EMAIL_SEND_FAILED", "We could not send the code. Please try again.");
  }
}

export async function sendOtpEmail(
  cfg: Config,
  to: string,
  code: string,
  purpose: OtpPurpose = "login",
): Promise<void> {
  const t = OTP_TEXT[purpose];
  await sendBrevo(
    cfg,
    to,
    t.subject,
    `${t.lead} ${code}.\n\nIt expires in 10 minutes. If you did not ask for this, ignore this email and do not share the code.`,
  );
}

/** A notice to the account owner (for example, a new phone was added). Never contains a code. */
export async function sendSecurityEmail(cfg: Config, to: string, subject: string, text: string): Promise<void> {
  await sendBrevo(cfg, to, subject, text);
}
