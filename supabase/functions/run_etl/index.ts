import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * ETL Pipeline: tickets + ticket_lines + payments → facts tables
 *
 * Calls the Postgres function `etl_tickets_to_facts` which:
 * 1. Aggregates closed tickets into 15-min buckets → facts_sales_15m
 * 2. Aggregates ticket_lines per product per day → product_sales_daily
 * 3. Aggregates daily finance (payments breakdown) → pos_daily_finance
 *
 * Body params (all optional):
 *   date_from: "YYYY-MM-DD" (default: earliest ticket)
 *   date_to:   "YYYY-MM-DD" (default: latest ticket)
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const dateFrom = body.date_from || null;
    const dateTo = body.date_to || null;

    console.log(`[ETL] Running tickets→facts ETL: ${dateFrom || "earliest"} to ${dateTo || "latest"}`);

    const { data, error } = await supabase.rpc("etl_tickets_to_facts", {
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) {
      console.error("[ETL] RPC error:", error.message);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ETL] Result:", JSON.stringify(data));

    return new Response(
      JSON.stringify({
        success: true,
        pipeline: "tickets → facts_sales_15m + product_sales_daily + pos_daily_finance",
        result: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[ETL] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
