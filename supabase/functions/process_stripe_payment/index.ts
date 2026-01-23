import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  amount: number; // in cents
  currency?: string;
  ticket_id: string;
  location_id: string;
  metadata?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[STRIPE_PAYMENT] Missing STRIPE_SECRET_KEY");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: PaymentRequest = await req.json();
    const { amount, currency = "eur", ticket_id, location_id, metadata = {} } = body;

    // Validate amount
    if (!amount || amount < 50) { // Stripe minimum is 50 cents
      return new Response(
        JSON.stringify({ error: "Invalid amount. Minimum is 0.50€" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[STRIPE_PAYMENT] Creating Payment Intent", { amount, currency, ticket_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Create Payment Intent with explicit payment method types
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Ensure integer
      currency: currency.toLowerCase(),
      payment_method_types: ["card"], // Explicitly specify card payments
      metadata: {
        ticket_id,
        location_id,
        ...metadata,
      },
    });

    console.log("[STRIPE_PAYMENT] Payment Intent created", { 
      id: paymentIntent.id, 
      status: paymentIntent.status 
    });

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[STRIPE_PAYMENT] Error:", error);
    
    // Return safe error message
    let message = "Payment processing failed. Please try again.";
    if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as { message: string }).message);
    }
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
