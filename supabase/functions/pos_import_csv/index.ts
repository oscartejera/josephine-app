import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { normalizeChannel, normalizePaymentMethod, toUTC, createExternalId } from '../_shared/normalize.ts';
import { updateConnectionStatus } from '../_shared/db-operations.ts';

const PROVIDER = 'csv';

interface CsvMapping {
  ticket_id: string;
  closed_at: string;
  gross_total: string;
  item_name: string;
  quantity: string;
  unit_price: string;
  payment_method: string;
  payment_amount: string;
  // Optional
  category?: string;
  channel?: string;
  table_name?: string;
  covers?: string;
  discount?: string;
  tax_rate?: string;
}

interface CsvRow {
  [key: string]: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { connection_id, location_id, data, mapping } = await req.json() as {
      connection_id?: string;
      location_id: string;
      data: CsvRow[];
      mapping: CsvMapping;
    };
    
    if (!location_id || !data || !mapping) {
      return new Response(
        JSON.stringify({ error: 'Missing location_id, data, or mapping' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (connection_id) {
      await updateConnectionStatus(supabaseUrl, serviceRoleKey, connection_id, 'syncing');
    }
    
    // Group rows by ticket_id
    const ticketMap = new Map<string, CsvRow[]>();
    for (const row of data) {
      const ticketId = row[mapping.ticket_id];
      if (!ticketId) continue;
      
      if (!ticketMap.has(ticketId)) {
        ticketMap.set(ticketId, []);
      }
      ticketMap.get(ticketId)!.push(row);
    }
    
    const results = {
      tickets: { inserted: 0, updated: 0, errors: [] as string[] },
      lines: { inserted: 0, errors: [] as string[] },
      payments: { inserted: 0, errors: [] as string[] },
    };
    
    for (const [originalTicketId, rows] of ticketMap) {
      const firstRow = rows[0];
      const externalId = createExternalId(PROVIDER, location_id, originalTicketId);
      
      // Calculate totals from lines
      let grossTotal = 0;
      let discountTotal = 0;
      
      for (const row of rows) {
        const qty = parseFloat(row[mapping.quantity]) || 1;
        const price = parseFloat(row[mapping.unit_price]) || 0;
        grossTotal += qty * price;
        
        if (mapping.discount) {
          discountTotal += parseFloat(row[mapping.discount]) || 0;
        }
      }
      
      // Override with explicit gross_total if provided
      if (mapping.gross_total && firstRow[mapping.gross_total]) {
        grossTotal = parseFloat(firstRow[mapping.gross_total]) || grossTotal;
      }
      
      // Check if ticket exists
      const { data: existingTicket } = await supabase
        .from('tickets')
        .select('id')
        .eq('external_id', externalId)
        .eq('location_id', location_id)
        .maybeSingle();
      
      let ticketDbId: string;
      
      if (existingTicket) {
        // Update existing ticket
        const { error } = await supabase
          .from('tickets')
          .update({
            closed_at: toUTC(firstRow[mapping.closed_at]),
            gross_total: grossTotal,
            net_total: grossTotal - discountTotal,
            discount_total: discountTotal,
            channel: mapping.channel ? normalizeChannel(firstRow[mapping.channel]) : 'unknown',
            table_name: mapping.table_name ? firstRow[mapping.table_name] : null,
            covers: mapping.covers ? parseInt(firstRow[mapping.covers]) || null : null,
            status: 'closed',
          })
          .eq('id', existingTicket.id);
        
        if (error) {
          results.tickets.errors.push(`Update ${originalTicketId}: ${error.message}`);
          continue;
        }
        results.tickets.updated++;
        ticketDbId = existingTicket.id;
      } else {
        // Insert new ticket
        const { data: newTicket, error } = await supabase
          .from('tickets')
          .insert({
            external_id: externalId,
            location_id,
            opened_at: toUTC(firstRow[mapping.closed_at]) || new Date().toISOString(),
            closed_at: toUTC(firstRow[mapping.closed_at]),
            gross_total: grossTotal,
            net_total: grossTotal - discountTotal,
            discount_total: discountTotal,
            channel: mapping.channel ? normalizeChannel(firstRow[mapping.channel]) : 'unknown',
            table_name: mapping.table_name ? firstRow[mapping.table_name] : null,
            covers: mapping.covers ? parseInt(firstRow[mapping.covers]) || null : null,
            status: 'closed',
          })
          .select('id')
          .single();
        
        if (error || !newTicket) {
          results.tickets.errors.push(`Insert ${originalTicketId}: ${error?.message}`);
          continue;
        }
        results.tickets.inserted++;
        ticketDbId = newTicket.id;
      }
      
      // Delete existing lines for this ticket (for clean upsert)
      await supabase.from('ticket_lines').delete().eq('ticket_id', ticketDbId);
      
      // Insert lines
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const qty = parseFloat(row[mapping.quantity]) || 1;
        const unitPrice = parseFloat(row[mapping.unit_price]) || 0;
        const lineDiscount = mapping.discount ? parseFloat(row[mapping.discount]) || 0 : 0;
        
        const { error } = await supabase
          .from('ticket_lines')
          .insert({
            ticket_id: ticketDbId,
            external_line_id: `${externalId}-L${i + 1}`,
            item_name: row[mapping.item_name] || 'Unknown Item',
            category_name: mapping.category ? row[mapping.category] : null,
            quantity: qty,
            unit_price: unitPrice,
            gross_line_total: qty * unitPrice,
            discount_line_total: lineDiscount,
            tax_rate: mapping.tax_rate ? parseFloat(row[mapping.tax_rate]) : null,
            voided: false,
            comped: false,
          });
        
        if (error) {
          results.lines.errors.push(`Line ${i}: ${error.message}`);
        } else {
          results.lines.inserted++;
        }
      }
      
      // Insert payment (aggregate per ticket)
      const paymentAmount = parseFloat(firstRow[mapping.payment_amount]) || grossTotal - discountTotal;
      const paymentMethod = normalizePaymentMethod(firstRow[mapping.payment_method]);
      
      // Check for existing payment
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('ticket_id', ticketDbId)
        .maybeSingle();
      
      if (!existingPayment) {
        const { error } = await supabase
          .from('payments')
          .insert({
            ticket_id: ticketDbId,
            amount: paymentAmount,
            method: paymentMethod,
            paid_at: toUTC(firstRow[mapping.closed_at]) || new Date().toISOString(),
          });
        
        if (error) {
          results.payments.errors.push(`Payment for ${originalTicketId}: ${error.message}`);
        } else {
          results.payments.inserted++;
        }
      }
    }
    
    if (connection_id) {
      const hasErrors = results.tickets.errors.length > 0 || results.lines.errors.length > 0;
      await updateConnectionStatus(
        supabaseUrl, 
        serviceRoleKey, 
        connection_id, 
        hasErrors ? 'error' : 'connected',
        new Date().toISOString()
      );
    }
    
    return new Response(
      JSON.stringify({
        provider: PROVIDER,
        results,
        total_rows: data.length,
        unique_tickets: ticketMap.size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('CSV import error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
