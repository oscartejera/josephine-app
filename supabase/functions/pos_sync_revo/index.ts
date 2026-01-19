import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { generateMockBatch } from '../_shared/mock-generator.ts';
import { normalizeTicket, normalizeTicketLine, normalizePayment, createExternalId } from '../_shared/normalize.ts';
import { upsertTickets, upsertTicketLines, upsertPayments, getTicketIdByExternalId, updateConnectionStatus } from '../_shared/db-operations.ts';
import { createErrorResponse } from '../_shared/error-handler.ts';

const PROVIDER = 'revo';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Check for Revo API credentials
    const revoApiKey = Deno.env.get('REVO_API_KEY');
    const revoApiSecret = Deno.env.get('REVO_API_SECRET');
    
    const { connection_id, location_id, mode = 'incremental' } = await req.json();
    
    if (!connection_id || !location_id) {
      return new Response(
        JSON.stringify({ error: 'Missing connection_id or location_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update status to syncing
    await updateConnectionStatus(supabaseUrl, serviceRoleKey, connection_id, 'syncing');
    
    let ticketData;
    
    if (revoApiKey && revoApiSecret) {
      // TODO: Real Revo API integration
      // const revoClient = new RevoClient(revoApiKey, revoApiSecret);
      // ticketData = await revoClient.getTickets(mode === 'full' ? null : lastSyncDate);
      
      // For now, fall back to mock data
      ticketData = generateMockBatch(PROVIDER, mode === 'full' ? 50 : 15, 7);
    } else {
      // Generate mock data
      ticketData = generateMockBatch(PROVIDER, mode === 'full' ? 50 : 15, 7);
    }
    
    // Normalize and upsert tickets
    const normalizedTickets = ticketData.map(t => ({
      ...normalizeTicket(t.ticket, location_id),
      external_id: createExternalId(PROVIDER, location_id, t.ticket.external_id),
    }));
    
    const ticketResult = await upsertTickets(supabaseUrl, serviceRoleKey, normalizedTickets);
    
    // Get ticket IDs and upsert lines
    const allLines = [];
    const allPayments = [];
    
    for (const data of ticketData) {
      const externalId = createExternalId(PROVIDER, location_id, data.ticket.external_id);
      const ticketId = await getTicketIdByExternalId(supabaseUrl, serviceRoleKey, externalId, location_id);
      
      if (ticketId) {
        for (let i = 0; i < data.lines.length; i++) {
          allLines.push(normalizeTicketLine(data.lines[i], ticketId, i));
        }
        for (const payment of data.payments) {
          allPayments.push(normalizePayment(payment, ticketId));
        }
      }
    }
    
    const linesResult = await upsertTicketLines(supabaseUrl, serviceRoleKey, allLines);
    const paymentsResult = await upsertPayments(supabaseUrl, serviceRoleKey, allPayments);
    
    // Update connection status
    const hasErrors = ticketResult.errors.length > 0 || linesResult.errors.length > 0 || paymentsResult.errors.length > 0;
    await updateConnectionStatus(
      supabaseUrl, 
      serviceRoleKey, 
      connection_id, 
      hasErrors ? 'error' : 'connected',
      new Date().toISOString()
    );
    
    return new Response(
      JSON.stringify({
        provider: PROVIDER,
        mode,
        using_mock: !revoApiKey,
        tickets: ticketResult,
        lines: linesResult,
        payments: paymentsResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    return createErrorResponse(PROVIDER, 'sync', error, { mode: 'sync' });
  }
});
