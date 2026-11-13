// Renders the Razorpay hosted checkout page for one order (PHASE2_PLAN §2.9).
// Pure function: no secrets in here. The key id is public. The amount is NOT in the page:
// Razorpay takes it from the order on its side.

export type CheckoutPageInput = {
  keyId: string;
  orderId: string;
  nonce: string;
};

/** JSON that is safe to place inside a <script> tag. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function renderCheckoutPage(input: CheckoutPageInput): string {
  const cfg = scriptJson({ key: input.keyId, order_id: input.orderId });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TruTicket payment</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #0B0B0B; color: #F5F5F5; font-family: system-ui, -apple-system, sans-serif; }
  main { text-align: center; padding: 24px; max-width: 360px; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { color: #A3A3A3; line-height: 1.5; }
  button { margin-top: 16px; padding: 12px 20px; border: 0; border-radius: 10px;
           background: #0ACBDB; color: #041014; font-weight: 600; font-size: 16px; }
</style>
</head>
<body>
<main>
  <h1 id="title">Opening secure payment…</h1>
  <p id="msg">Pay with UPI, card, or netbanking. Keep this page open until you see the result.</p>
  <button id="retry" type="button" hidden>Pay now</button>
</main>
<script nonce="${input.nonce}" src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script nonce="${input.nonce}">
(function () {
  var cfg = ${cfg};
  var title = document.getElementById("title");
  var msg = document.getElementById("msg");
  var retry = document.getElementById("retry");

  function done(t, m) {
    title.textContent = t;
    msg.textContent = m;
    retry.hidden = true;
  }

  function open() {
    if (typeof Razorpay === "undefined") {
      done("Could not load payment", "Check your connection, then go back to TruTicket and try again.");
      return;
    }
    var rzp = new Razorpay({
      key: cfg.key,
      order_id: cfg.order_id,
      name: "TruTicket",
      description: "Event tickets",
      theme: { color: "#0ACBDB" },
      handler: function () {
        done("Payment received", "Go back to the TruTicket app. Your tickets appear in a few seconds.");
      },
      modal: {
        ondismiss: function () {
          title.textContent = "Payment not finished";
          msg.textContent = "You can pay again from the app or tap Pay now.";
          retry.hidden = false;
        }
      }
    });
    rzp.on("payment.failed", function () {
      title.textContent = "Payment failed";
      msg.textContent = "No money was taken for a failed payment. Go back to TruTicket and try again.";
      retry.hidden = false;
    });
    rzp.open();
  }

  retry.addEventListener("click", function () { retry.hidden = true; open(); });
  open();
})();
</script>
</body>
</html>`;
}
