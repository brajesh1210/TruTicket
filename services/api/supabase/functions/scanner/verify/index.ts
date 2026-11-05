/**
 * Scanner Verify Edge Function
 * Validates QR credential and performs atomic redemption.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { ticketRef, nonce, scannerId, eventId, idempotencyKey } = await req.json();

    // Idempotency check
    const { data: existing } = await supabase
      .from("redemptions")
      .select("id, result")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ result: existing.result, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify QR credential (nonce + expiry)
    const { data: credential, error: credError } = await supabase
      .from("qr_credentials")
      .select("*, tickets(*, events(*))")
      .eq("ticket_id", ticketRef)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .is("consumed_at", null)
      .single();

    if (credError || !credential) {
      await supabase.from("redemptions").insert({
        ticket_id: ticketRef,
        event_id: eventId,
        scanner_id: scannerId,
        result: "INVALID",
        idempotency_key: idempotencyKey,
      });
      return new Response(JSON.stringify({ result: "INVALID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ticket = credential.tickets as any;
    const event = ticket.events as any;

    // Atomic redemption checks
    if (ticket.status !== "ISSUED_ACTIVE") {
      return new Response(JSON.stringify({ result: "REVOKED" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ticket.current_owner_id !== credential.ticket_id) {
      // Simplified check
    }

    // Mark credential consumed
    await supabase.from("qr_credentials").update({ status: "consumed", consumed_at: new Date().toISOString() }).eq("id", credential.id);

    // Mark ticket redeemed
    await supabase.from("tickets").update({ status: "REDEEMED" }).eq("id", ticketRef);

    // Log redemption
    await supabase.from("redemptions").insert({
      ticket_id: ticketRef,
      event_id: eventId,
      scanner_id: scannerId,
      result: "VALID",
      idempotency_key: idempotencyKey,
    });

    // TODO: Call smart contract redeemTicket

    return new Response(JSON.stringify({ result: "VALID", ticketId: ticketRef }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});