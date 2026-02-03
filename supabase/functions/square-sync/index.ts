/**
 * Square Sync Function
 * Sincronización incremental: locations, catalog, orders, payments
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';
import { SquareClient } from '../_shared/square-client.ts';
import { 
  normalizeSquareLocation,
  normalizeSquareItem,
  normalizeSquareOrder,
  normalizeSquarePayment 
} from '../_shared/cdm-normalizer.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { accountId } = await req.json();

    // Check for running sync
    const { data: hasRunning } = await supabase.rpc('has_running_sync', {
      p_account_id: accountId
    });

    if (hasRunning) {
      return new Response(
        JSON.stringify({ message: 'Sync already running' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get account
    const { data: account } = await supabase
      .from('integration_accounts')
      .select('*, integration:integrations(*)')
      .eq('id', accountId)
      .single();

    if (!account) {
      throw new Error('Account not found');
    }

    // Create sync run
    const { data: run } = await supabase
      .from('integration_sync_runs')
      .insert({
        integration_account_id: accountId,
        status: 'running',
        cursor: {},
        stats: {},
      })
      .select()
      .single();

    const orgId = account.integration.org_id;
    const client = new SquareClient({
      accessToken: account.access_token_encrypted, // TODO: Decrypt
      environment: account.environment as 'sandbox' | 'production',
    });

    const stats = {
      locations: 0,
      items: 0,
      orders: 0,
      payments: 0,
    };

    try {
      // 1) Sync Locations
      const locationsResp = await client.listLocations();
      const locations = locationsResp.locations || [];
      
      for (const loc of locations) {
        const normalized = normalizeSquareLocation(loc, orgId);
        await supabase
          .from('cdm_locations')
          .upsert(normalized, { onConflict: 'external_provider,external_id' });
      }
      stats.locations = locations.length;

      // 2) Sync Catalog
      let catalogCursor;
      do {
        const catalogResp = await client.listCatalog(catalogCursor);
        const items = (catalogResp.objects || []).filter((obj: any) => obj.type === 'ITEM');
        
        for (const item of items) {
          const normalized = normalizeSquareItem(item, orgId);
          await supabase
            .from('cdm_items')
            .upsert(normalized, { onConflict: 'external_provider,external_id' });
        }
        
        stats.items += items.length;
        catalogCursor = catalogResp.cursor;
      } while (catalogCursor);

      // 3) Sync Orders (last 7 days)
      const locationIds = locations.map((l: any) => l.id);
      const beginTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      // Build location map
      const locationMap = new Map();
      for (const loc of locations) {
        const { data: cdmLoc } = await supabase
          .from('cdm_locations')
          .select('id')
          .eq('external_id', loc.id)
          .single();
        if (cdmLoc) locationMap.set(loc.id, cdmLoc.id);
      }

      let ordersCursor;
      do {
        const ordersResp = await client.searchOrders(locationIds, ordersCursor, beginTime);
        const orders = ordersResp.orders || [];
        
        for (const order of orders) {
          const normalized = normalizeSquareOrder(order, orgId, locationMap);
          
          // Upsert order
          const { data: cdmOrder } = await supabase
            .from('cdm_orders')
            .upsert(normalized.order, { onConflict: 'external_provider,external_id' })
            .select()
            .single();

          // Upsert lines
          for (const line of normalized.lines) {
            await supabase
              .from('cdm_order_lines')
              .upsert({
                ...line,
                order_id: cdmOrder.id,
              });
          }
        }
        
        stats.orders += orders.length;
        ordersCursor = ordersResp.cursor;
      } while (ordersCursor);

      // 4) Sync Payments (simplified)
      for (const locId of locationIds.slice(0, 1)) { // First location only for MVP
        const paymentsResp = await client.listPayments(locId, beginTime);
        const payments = paymentsResp.payments || [];
        stats.payments = payments.length;
        // TODO: Full payment normalization
      }

      // Complete sync
      await supabase.rpc('complete_sync_run', {
        p_run_id: run.id,
        p_status: 'ok',
        p_stats: stats,
      });

      return new Response(
        JSON.stringify({ success: true, stats }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (syncError) {
      // Mark run as error
      await supabase.rpc('complete_sync_run', {
        p_run_id: run.id,
        p_status: 'error',
        p_stats: stats,
        p_error: syncError.message,
      });

      throw syncError;
    }
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
