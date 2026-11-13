// TruTicket checkout page (PHASE2_PLAN §2.9). Opened in the phone's browser from the app.
//   GET ?order=<razorpay order id>  -> HTML with Razorpay's hosted checkout for that order.
// No sign-in: the page only shows a payment for an order the app created. The amount and
// the payment result come from Razorpay and from the webhook, not from this page.
import { loadConfig } from "../_shared/env.ts";
import { ApiError, errorResponse } from "../_shared/http.ts";
import { renderCheckoutPage } from "./page.ts";

const ORDER_ID = /^order_[A-Za-z0-9]{6,64}$/;

Deno.serve((req) => {
  if (req.method !== "GET") return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Use GET."));
  try {
    const cfg = loadConfig();
    const orderId = new URL(req.url).searchParams.get("order") ?? "";
    if (!ORDER_ID.test(orderId)) throw new ApiError(400, "INVALID_INPUT", "Missing or bad order id.");
    if (!cfg.razorpayKeyId) throw new ApiError(500, "CONFIG_MISSING", "Payments are not configured yet.");

    const nonce = crypto.randomUUID().replace(/-/g, "");
    const html = renderCheckoutPage({ keyId: cfg.razorpayKeyId, orderId, nonce });
    const csp = [
      "default-src 'none'",
      `script-src 'nonce-${nonce}' https://checkout.razorpay.com`,
      "style-src 'unsafe-inline'",
      "img-src https: data:",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "connect-src https://api.razorpay.com https://lumberjack.razorpay.com",
      "base-uri 'none'",
      "form-action https://api.razorpay.com",
    ].join("; ");
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": csp,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
});
