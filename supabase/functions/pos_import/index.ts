import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * POS Import - Universal POS data import endpoint
 *
 * Accepts standardized ticket/line data from any external POS
 * (Square, Revo, Lightspeed, GLOP, CSV) and stores it in the
 * canonical tickets + ticket_lines + payments tables.
 *
 * After import, optionally runs the ETL to update facts tables.
 *
 * Body:
 *   location_id: uuid (required)
 *   provider: "square" | "revo" | "glop" | "lightspeed" | "csv"
 *   run_etl: boolean (default true) - auto-run ETL after import
 *   tickets: Array<{
 *     external_id: string
 *     opened_at: string (ISO)
 *     closed_at: string (ISO)
 *     covers: number
 *     table_name?: string
 *     channel: "dine_in" | "takeaway" | "delivery" | "online"
 *     gross_total: number
 *     net_total: number
 *     tax_total: number
 *     discount_total: number
 *     tip_total?: number
 *     lines: Array<{
 *       external_line_id?: string
 *       item_name: string
 *       category_name?: string
 *       quantity: number
 *       unit_price: number
 *       gross_line_total: number
 *       discount_line_total?: number
 *       tax_rate?: number
 *       voided?: boolean
 *     }>
 *     payments: Array<{
 *       method: "cash" | "card" | "transfer" | "other"
 *       amount: number
 *       tip_amount?: number
 *     }>
 *   }>
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { location_id, provider, tickets: importTickets, run_etl = true } = body;

    if (!location_id) {
      return new Response(
        JSON.stringify({ error: "location_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!importTickets || !Array.isArray(importTickets) || importTickets.length === 0) {
      return new Response(
        JSON.stringify({ error: "tickets array is required and must not be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[POS_IMPORT] ${provider || "unknown"}: ${importTickets.length} tickets for ${location_id}`);

    // Update pos_connection status
    if (provider) {
      await supabase
        .from("pos_connections")
        .upsert({
          location_id,
          provider,
          status: "syncing",
          last_sync_at: new Date().toISOString(),
        }, { onConflict: "location_id,provider" })
        .select();
    }

    let ticketsInserted = 0;
    let linesInserted = 0;
    let paymentsInserted = 0;
    let skipped = 0;
    let minDate: string | null = null;
    let maxDate: string | null = null;

    for (const t of importTickets) {
      // Skip if duplicate external_id
      if (t.external_id) {
        const { data: existing } = await supabase
          .from("tickets")
          .select("id")
          .eq("location_id", location_id)
          .eq("external_id", t.external_id)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }
      }

      // Insert ticket
      const { data: ticketData, error: ticketErr } = await supabase
        .from("tickets")
        .insert({
          location_id,
          external_id: t.external_id || null,
          opened_at: t.opened_at,
          closed_at: t.closed_at,
          status: "closed",
          covers: t.covers || 1,
          table_name: t.table_name || null,
          channel: t.channel || "dine_in",
          gross_total: t.gross_total,
          net_total: t.net_total,
          tax_total: t.tax_total || 0,
          discount_total: t.discount_total || 0,
          tip_total: t.tip_total || 0,
        })
        .select("id")
        .single();

      if (ticketErr) {
        console.error(`[POS_IMPORT] ticket insert error: ${ticketErr.message}`);
        continue;
      }

      ticketsInserted++;
      const ticketId = ticketData.id;

      // Track date range
      const closedDate = t.closed_at?.split("T")[0];
      if (closedDate) {
        if (!minDate || closedDate < minDate) minDate = closedDate;
        if (!maxDate || closedDate > maxDate) maxDate = closedDate;
      }

      // Insert ticket lines
      if (t.lines && Array.isArray(t.lines) && t.lines.length > 0) {
        const lineRows = t.lines.map((l: Record<string, unknown>) => ({
          ticket_id: ticketId,
          external_line_id: l.external_line_id || null,
          item_name: l.item_name,
          category_name: l.category_name || null,
          quantity: l.quantity || 1,
          unit_price: l.unit_price || 0,
          gross_line_total: l.gross_line_total || (Number(l.quantity || 1) * Number(l.unit_price || 0)),
          discount_line_total: l.discount_line_total || 0,
          tax_rate: l.tax_rate || 10,
          voided: l.voided || false,
        }));

        const { error: lineErr } = await supabase
          .from("ticket_lines")
          .insert(lineRows);

        if (lineErr) {
          console.error(`[POS_IMPORT] lines insert error: ${lineErr.message}`);
        } else {
          linesInserted += lineRows.length;
        }
      }

      // Insert payments
      if (t.payments && Array.isArray(t.payments) && t.payments.length > 0) {
        const payRows = t.payments.map((p: Record<string, unknown>) => ({
          ticket_id: ticketId,
          method: p.method || "card",
          amount: p.amount,
          tip_amount: p.tip_amount || 0,
          paid_at: t.closed_at,
        }));

        const { error: payErr } = await supabase
          .from("payments")
          .insert(payRows);

        if (payErr) {
          console.error(`[POS_IMPORT] payments insert error: ${payErr.message}`);
        } else {
          paymentsInserted += payRows.length;
        }
      }
    }

    // Update pos_connection status
    if (provider) {
      await supabase
        .from("pos_connections")
        .update({ status: "connected", last_sync_at: new Date().toISOString() })
        .eq("location_id", location_id)
        .eq("provider", provider);
    }

    // Run ETL if requested
    let etlResult = null;
    if (run_etl && minDate && maxDate) {
      console.log(`[POS_IMPORT] Running ETL for ${minDate} to ${maxDate}...`);
      const { data: etlData, error: etlErr } = await supabase.rpc("etl_tickets_to_facts", {
        p_date_from: minDate,
        p_date_to: maxDate,
      });

      if (etlErr) {
        console.error(`[POS_IMPORT] ETL error: ${etlErr.message}`);
        etlResult = { error: etlErr.message };
      } else {
        etlResult = etlData;
      }
    }

    console.log(`[POS_IMPORT] Done: ${ticketsInserted} tickets, ${linesInserted} lines, ${paymentsInserted} payments, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        provider: provider || "unknown",
        location_id,
        imported: {
          tickets: ticketsInserted,
          lines: linesInserted,
          payments: paymentsInserted,
          skipped_duplicates: skipped,
        },
        date_range: { from: minDate, to: maxDate },
        etl: etlResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POS_IMPORT] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
