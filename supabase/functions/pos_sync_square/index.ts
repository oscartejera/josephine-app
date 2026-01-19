import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { generateMockBatch } from '../_shared/mock-generator.ts';
import { normalizeTicket, normalizeTicketLine, normalizePayment, createExternalId } from '../_shared/normalize.ts';
import { upsertTickets, upsertTicketLines, upsertPayments, getTicketIdByExternalId, updateConnectionStatus } from '../_shared/db-operations.ts';

const PROVIDER = 'square';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Check for Square API credentials
    const squareAccessToken = Deno.env.get('SQUARE_ACCESS_TOKEN');
    const squareEnvironment = Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox';
    
    const { connection_id, location_id, mode = 'incremental' } = await req.json();
    
    if (!connection_id || !location_id) {
      return new Response(
        JSON.stringify({ error: 'Missing connection_id or location_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    await updateConnectionStatus(supabaseUrl, serviceRoleKey, connection_id, 'syncing');
    
    let ticketData;
    
    if (squareAccessToken) {
      // TODO: Real Square API integration
      // const squareClient = new Client({
      //   accessToken: squareAccessToken,
      //   environment: squareEnvironment === 'production' ? Environment.Production : Environment.Sandbox,
      // });
      // const ordersApi = squareClient.ordersApi;
      // const orders = await ordersApi.searchOrders({ ... });
      
      ticketData = generateMockBatch(PROVIDER, mode === 'full' ? 50 : 15, 7);
    } else {
      ticketData = generateMockBatch(PROVIDER, mode === 'full' ? 50 : 15, 7);
    }
    
    const normalizedTickets = ticketData.map(t => ({
      ...normalizeTicket(t.ticket, location_id),
      external_id: createExternalId(PROVIDER, location_id, t.ticket.external_id),
    }));
    
    const ticketResult = await upsertTickets(supabaseUrl, serviceRoleKey, normalizedTickets);
    
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
        using_mock: !squareAccessToken,
        tickets: ticketResult,
        lines: linesResult,
        payments: paymentsResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('Square sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
