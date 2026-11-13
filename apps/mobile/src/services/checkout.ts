/** Buying: hold seats, create a Razorpay order, then pay on the hosted checkout page. */
import { callFunction } from "./api";
import { FUNCTIONS_URL } from "./config";

export type Reservation = { reservation_id: string; expires_at: string; quantity: number };

export async function reserveTickets(ticketTypeId: string, quantity: number): Promise<Reservation> {
  return callFunction<Reservation>(
    "events",
    { action: "reserve", ticket_type_id: ticketTypeId, quantity },
    { auth: true },
  );
}

export type OrderCreated = {
  order_id: string;
  razorpay_order_id: string;
  amount: number; // paise
  currency: string;
  key_id: string;
};

export async function createOrder(reservationId: string): Promise<OrderCreated> {
  return callFunction<OrderCreated>("orders", { action: "create", reservation_id: reservationId }, { auth: true });
}

/**
 * The hosted payment page (served by the `checkout` function). It only needs the Razorpay
 * order id. The amount comes from the order on Razorpay's side, not from the URL.
 */
export function checkoutPageUrl(razorpayOrderId: string): string {
  return `${FUNCTIONS_URL}/checkout?order=${encodeURIComponent(razorpayOrderId)}`;
}
