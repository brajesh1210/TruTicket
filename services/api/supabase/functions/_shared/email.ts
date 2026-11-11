// Sends the sign-in code through Brevo's transactional email API (free plan: 300 emails/day).
// Needs BREVO_API_KEY (an API v3 key) and EMAIL_FROM (a sender verified in Brevo).
import type { Config } from "./env.ts";
import { ApiError } from "./http.ts";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendOtpEmail(cfg: Config, to: string, code: string): Promise<void> {
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
      subject: "Your TruTicket sign-in code",
      textContent:
        `Your TruTicket sign-in code is ${code}.\n\n` +
        "It expires in 10 minutes. If you did not ask for this, you can ignore this email.",
    }),
  });

  if (!res.ok) {
    // Log the status only. The response body can echo the recipient address.
    console.error("brevo send failed", res.status);
    throw new ApiError(502, "EMAIL_SEND_FAILED", "We could not send the code. Please try again.");
  }
}
