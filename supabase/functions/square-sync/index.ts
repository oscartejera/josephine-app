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

      // 5) Aggregate CDM orders → pos_daily_finance (data_source = 'pos')
      // Map CDM locations to Josephine locations
      const { data: josephineLocations } = await supabase
        .from('locations')
        .select('id, name, group_id')
        .eq('active', true)
        .limit(10);

      const { data: cdmLocations } = await supabase
        .from('cdm_locations')
        .select('id, name, external_id')
        .eq('org_id', orgId);

      // Build CDM location → Josephine location mapping
      // Match by name similarity or use first Josephine location as fallback
      const cdmToJosephineMap = new Map<string, string>();
      for (const cdmLoc of (cdmLocations || [])) {
        // Try to find matching Josephine location by name
        const match = (josephineLocations || []).find(jl =>
          jl.name.toLowerCase().includes(cdmLoc.name.toLowerCase()) ||
          cdmLoc.name.toLowerCase().includes(jl.name.toLowerCase())
        );
        cdmToJosephineMap.set(
          cdmLoc.id,
          match?.id || (josephineLocations?.[0]?.id ?? '')
        );
      }

      // Fetch all CDM orders for aggregation
      const { data: cdmOrders } = await supabase
        .from('cdm_orders')
        .select('id, location_id, closed_at, gross_total, net_total, status')
        .eq('org_id', orgId)
        .not('closed_at', 'is', null);

      if (cdmOrders && cdmOrders.length > 0 && josephineLocations && josephineLocations.length > 0) {
        // Group orders by date + josephine location
        const dailyAgg = new Map<string, {
          date: string;
          location_id: string;
          gross_sales: number;
          net_sales: number;
          orders_count: number;
          payments_card: number;
        }>();

        for (const order of cdmOrders) {
          const jLocId = cdmToJosephineMap.get(order.location_id) || josephineLocations[0].id;
          const orderDate = new Date(order.closed_at).toISOString().split('T')[0];
          const key = `${orderDate}|${jLocId}`;

          const existing = dailyAgg.get(key) || {
            date: orderDate,
            location_id: jLocId,
            gross_sales: 0,
            net_sales: 0,
            orders_count: 0,
            payments_card: 0,
          };

          existing.gross_sales += Number(order.gross_total || 0);
          existing.net_sales += Number(order.net_total || order.gross_total || 0);
          existing.orders_count += 1;
          existing.payments_card += Number(order.net_total || order.gross_total || 0);
          dailyAgg.set(key, existing);
        }

        // Build aggregated rows
        const rows = Array.from(dailyAgg.values()).map(d => ({
          date: d.date,
          location_id: d.location_id,
          gross_sales: d.gross_sales,
          net_sales: d.net_sales,
          orders_count: d.orders_count,
          payments_cash: 0,
          payments_card: d.payments_card,
          payments_other: 0,
          refunds_amount: 0,
          refunds_count: 0,
          discounts_amount: 0,
          comps_amount: 0,
          voids_amount: 0,
          data_source: 'pos',
        }));

        if (rows.length > 0) {
          // Collect synced dates to replace simulated data
          const syncedDates = [...new Set(rows.map(r => r.date))];

          // Delete ALL existing rows (simulated + pos) for synced dates
          // The unique constraint is (date, location_id) without data_source,
          // so we must remove existing rows before inserting POS replacements.
          await supabase
            .from('pos_daily_finance')
            .delete()
            .in('date', syncedDates)
            .in('location_id', [...new Set(rows.map(r => r.location_id))]);

          await supabase
            .from('pos_daily_finance')
            .insert(rows);
        }

        (stats as any).daily_finance_rows = rows.length;

        // 6) Aggregate CDM orders → pos_daily_metrics (for Labour page)
        //    Labour RPCs read from sales_daily_unified which joins pos_daily_metrics.
        //    Square orders provide net_sales + orders; labor_hours/cost = 0
        //    (Square doesn't include labor data in orders).
        const metricsRows = Array.from(dailyAgg.values()).map(d => ({
          date: d.date,
          location_id: d.location_id,
          net_sales: d.net_sales,
          orders: d.orders_count,
          labor_hours: 0,
          labor_cost: 0,
          data_source: 'pos',
        }));

        if (metricsRows.length > 0) {
          // Delete existing rows (simulated + pos) for synced dates.
          // Unique constraint is (date, location_id) without data_source.
          const metricsDates = [...new Set(metricsRows.map(r => r.date))];
          await supabase
            .from('pos_daily_metrics')
            .delete()
            .in('date', metricsDates)
            .in('location_id', [...new Set(metricsRows.map(r => r.location_id))]);

          await supabase
            .from('pos_daily_metrics')
            .insert(metricsRows);
        }
        (stats as any).daily_metrics_rows = metricsRows.length;

        // 7) Sync CDM items → products table (for Menu Engineering)
        //    Menu Engineering RPCs read from product_sales_daily JOIN products.
        //    We need products to exist before we can write product_sales_daily.
        const groupId = (josephineLocations as any[])[0]?.group_id;

        const { data: cdmItemsList } = await supabase
          .from('cdm_items')
          .select('name, category_name, is_active')
          .eq('org_id', orgId);

        const productNameToId = new Map<string, string>();

        if (cdmItemsList && groupId) {
          // Fetch all existing products for this group in one query
          const { data: existingProducts } = await supabase
            .from('products')
            .select('id, name')
            .eq('group_id', groupId);

          for (const p of (existingProducts || [])) {
            productNameToId.set(p.name, p.id);
          }

          // Insert only new products (not already in the products table)
          const newProducts = cdmItemsList
            .filter(item => !productNameToId.has(item.name))
            .map(item => ({
              name: item.name,
              category: item.category_name || 'Other',
              is_active: item.is_active,
              group_id: groupId,
              location_id: josephineLocations[0].id,
            }));

          if (newProducts.length > 0) {
            const { data: inserted } = await supabase
              .from('products')
              .insert(newProducts)
              .select('id, name');

            for (const p of (inserted || [])) {
              productNameToId.set(p.name, p.id);
            }
          }
        }
        (stats as any).products_synced = productNameToId.size;

        // 8) Aggregate CDM order lines → product_sales_daily (for Menu Engineering)
        //    Groups line items by (date, location, product) and writes daily aggregates.
        const cdmOrderIds = cdmOrders.map((o: any) => o.id);

        if (cdmOrderIds.length > 0 && productNameToId.size > 0) {
          // Fetch all order lines for synced orders
          const { data: allLines } = await supabase
            .from('cdm_order_lines')
            .select('order_id, name, quantity, gross_line_total')
            .in('order_id', cdmOrderIds);

          // Build order_id → {date, location_id} lookup
          const orderInfoMap = new Map<string, { date: string; location_id: string }>();
          for (const order of cdmOrders) {
            const jLocId = cdmToJosephineMap.get(order.location_id) || josephineLocations[0].id;
            const orderDate = new Date(order.closed_at).toISOString().split('T')[0];
            orderInfoMap.set(order.id, { date: orderDate, location_id: jLocId });
          }

          // Group by (date, location, product)
          const productDailyAgg = new Map<string, {
            date: string;
            location_id: string;
            product_id: string;
            units_sold: number;
            net_sales: number;
            cogs: number;
          }>();

          for (const line of (allLines || [])) {
            const orderInfo = orderInfoMap.get(line.order_id);
            if (!orderInfo) continue;

            const productId = productNameToId.get(line.name);
            if (!productId) continue;

            const key = `${orderInfo.date}|${orderInfo.location_id}|${productId}`;
            const existing = productDailyAgg.get(key) || {
              date: orderInfo.date,
              location_id: orderInfo.location_id,
              product_id: productId,
              units_sold: 0,
              net_sales: 0,
              cogs: 0,
            };

            existing.units_sold += Number(line.quantity || 0);
            existing.net_sales += Number(line.gross_line_total || 0);
            productDailyAgg.set(key, existing);
          }

          // Delete existing POS product_sales_daily
          await supabase
            .from('product_sales_daily')
            .delete()
            .eq('data_source', 'pos');

          // Delete simulated rows for synced dates to avoid double-counting
          const syncedDates = [...new Set(
            Array.from(productDailyAgg.values()).map(d => d.date)
          )];
          if (syncedDates.length > 0) {
            await supabase
              .from('product_sales_daily')
              .delete()
              .eq('data_source', 'simulated')
              .in('date', syncedDates);
          }

          // Insert fresh POS rows
          const productRows = Array.from(productDailyAgg.values()).map(d => ({
            ...d,
            data_source: 'pos',
          }));

          if (productRows.length > 0) {
            await supabase.from('product_sales_daily').insert(productRows);
          }
          (stats as any).product_sales_rows = productRows.length;
        }
      }

      // Complete sync
      await supabase.rpc('complete_sync_run', {
        p_run_id: run.id,
        p_status: 'ok',
        p_stats: stats,
      });

      // Mark integration as synced so the frontend can detect POS connection
      // without needing to query integration_sync_runs (blocked by RLS).
      await supabase
        .from('integrations')
        .update({
          metadata: {
            ...account.integration.metadata,
            last_synced_at: new Date().toISOString(),
          },
        })
        .eq('id', account.integration.id);

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
