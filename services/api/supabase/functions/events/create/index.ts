/**
 * Create Event Edge Function
 * Organizer creates event + ticket types + resale policy.
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
    const authHeader = req.headers.get("authorization")!;
    const token = authHeader.replace("Bearer ", "");

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const {
      title, description, venue, timezone, startAt, endAt,
      coverImageUrl, categories, terms,
      ticketTypes, resalePolicy
    } = await req.json();

    // Create event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        organizer_id: user.user_metadata.organizer_id,
        title, description, venue, timezone,
        start_at: startAt, end_at: endAt,
        cover_image_url: coverImageUrl,
        categories, terms,
        status: "published",
      })
      .select()
      .single();

    if (eventError) throw eventError;

    // Create ticket types
    for (const tt of ticketTypes) {
      await supabase.from("ticket_types").insert({
        event_id: event.id,
        name: tt.name,
        face_value_minor: tt.faceValueMinor,
        currency: tt.currency || "INR",
        quantity: tt.quantity,
        sale_start: tt.saleStart,
        sale_end: tt.saleEnd,
        per_account_limit: tt.perAccountLimit || 4,
        refund_rules: tt.refundRules,
      });
    }

    // TODO: Call smart contract createEventPolicy via ethers.js

    return new Response(JSON.stringify({ event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});