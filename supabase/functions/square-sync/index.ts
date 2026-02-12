/**
 * Square Sync Function
 * Sincronización incremental: locations, catalog, orders, payments
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';
import { SquareClient } from '../_shared/square-client.ts';
import { decryptToken, encryptToken } from '../_shared/crypto.ts';
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

    // Self-heal: mark any sync that has been "running" for > 30 minutes as timed out.
    // This prevents stuck syncs from permanently blocking new ones.
    // (Fix #12: increased from 5 min to 30 min for high-volume merchants)
    await supabase
      .from('integration_sync_runs')
      .update({
        status: 'error',
        ended_at: new Date().toISOString(),
        error_text: 'Timeout - sync did not complete within 30 minutes',
      })
      .eq('integration_account_id', accountId)
      .eq('status', 'running')
      .lt('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    // Check for running sync (only recent ones will remain after self-heal)
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
    const environment = account.environment as 'sandbox' | 'production';

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = await decryptToken(account.access_token_encrypted);
    } catch {
      // Fallback: token may have been stored before encryption was enabled
      accessToken = account.access_token_encrypted;
    }

    // Check if token is expired and refresh if needed
    if (account.token_expires_at && new Date(account.token_expires_at) <= new Date()) {
      if (!account.refresh_token_encrypted) {
        throw new Error('Access token expired and no refresh token available');
      }

      let refreshToken: string;
      try {
        refreshToken = await decryptToken(account.refresh_token_encrypted);
      } catch {
        refreshToken = account.refresh_token_encrypted;
      }

      const clientId = environment === 'production'
        ? Deno.env.get('SQUARE_PRODUCTION_CLIENT_ID')
        : Deno.env.get('SQUARE_SANDBOX_CLIENT_ID');
      const clientSecret = environment === 'production'
        ? Deno.env.get('SQUARE_PRODUCTION_CLIENT_SECRET')
        : Deno.env.get('SQUARE_SANDBOX_CLIENT_SECRET');

      const tokenUrl = environment === 'production'
        ? 'https://connect.squareup.com/oauth2/token'
        : 'https://connect.squareupsandbox.com/oauth2/token';

      const refreshResp = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResp.ok) {
        const err = await refreshResp.text();
        throw new Error(`Token refresh failed: ${err}`);
      }

      const newTokens = await refreshResp.json();
      accessToken = newTokens.access_token;

      // Encrypt and persist new tokens
      const encryptedAccess = await encryptToken(newTokens.access_token);
      const encryptedRefresh = newTokens.refresh_token
        ? await encryptToken(newTokens.refresh_token)
        : account.refresh_token_encrypted;

      await supabase
        .from('integration_accounts')
        .update({
          access_token_encrypted: encryptedAccess,
          refresh_token_encrypted: encryptedRefresh,
          token_expires_at: newTokens.expires_at || null,
        })
        .eq('id', accountId);
    }

    const client = new SquareClient({
      accessToken,
      environment,
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
      console.log(`[square-sync] Step 1/9 complete: ${locations.length} locations synced`);

      // 2) Sync Catalog (items + categories)
      // Square CATEGORY objects map category_id → human-readable name.
      // We collect them first so items can reference real category names.
      const squareCategoryMap = new Map<string, string>();
      let catalogCursor;
      do {
        const catalogResp = await client.listCatalog(catalogCursor);
        const allObjects = catalogResp.objects || [];

        // Collect category names
        for (const obj of allObjects) {
          if (obj.type === 'CATEGORY') {
            squareCategoryMap.set(obj.id, obj.category_data?.name || 'Other');
          }
        }

        // Process items
        const items = allObjects.filter((obj: any) => obj.type === 'ITEM');
        for (const item of items) {
          const normalized = normalizeSquareItem(item, orgId);
          // Resolve category_id to human-readable name
          const categoryId = item.item_data?.category_id;
          if (categoryId && squareCategoryMap.has(categoryId)) {
            normalized.category_name = squareCategoryMap.get(categoryId)!;
          }
          await supabase
            .from('cdm_items')
            .upsert(normalized, { onConflict: 'external_provider,external_id' });
        }

        stats.items += items.length;
        catalogCursor = catalogResp.cursor;
      } while (catalogCursor);
      console.log(`[square-sync] Step 2/9 complete: ${stats.items} catalog items synced`);

      // 3) Sync Orders (incremental via cursor, fallback to 7 days)
      const locationIds = locations.map((l: any) => l.id);

      // Check last successful sync to enable incremental sync
      const { data: lastSuccessfulRun } = await supabase
        .from('integration_sync_runs')
        .select('ended_at, cursor')
        .eq('integration_account_id', accountId)
        .eq('status', 'ok')
        .order('ended_at', { ascending: false })
        .limit(1)
        .single();

      // Use last sync time as begin_time if available, otherwise 7-day window
      const beginTime = lastSuccessfulRun?.ended_at
        ? lastSuccessfulRun.ended_at
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      console.log(`[square-sync] Incremental sync from: ${beginTime}`);
      
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

      // Sync orders page by page, collecting all normalized data.
      // After all pages are fetched, we purge old order lines ONLY for
      // orders actually returned by Square, then batch-insert fresh lines.
      // This prevents duplicates without losing data for orders that
      // Square no longer returns (e.g., older than the search window).
      const allSyncedOrderIds: string[] = [];
      const allFreshLines: any[] = [];
      // Store tender breakdown per external_id for aggregation (Fix #2)
      const tendersByExtId = new Map<string, { cash: number; card: number; other: number }>();

      let ordersCursor;
      do {
        const ordersResp = await client.searchOrders(locationIds, ordersCursor, beginTime);
        const orders = ordersResp.orders || [];

        if (orders.length > 0) {
          const normalizedOrders: any[] = [];
          const linesPerExtId = new Map<string, any[]>();

          for (const order of orders) {
            const normalized = normalizeSquareOrder(order, orgId, locationMap);
            normalizedOrders.push(normalized.order);
            linesPerExtId.set(normalized.order.external_id, normalized.lines);
            tendersByExtId.set(normalized.order.external_id, normalized.tenderBreakdown);
          }

          // Batch upsert orders
          await supabase
            .from('cdm_orders')
            .upsert(normalizedOrders, { onConflict: 'external_provider,external_id' });

          // Fetch CDM IDs (separate SELECT is more reliable than chained .select())
          const externalIds = normalizedOrders.map((o: any) => o.external_id);
          const { data: upsertedOrders } = await supabase
            .from('cdm_orders')
            .select('id, external_id')
            .in('external_id', externalIds);

          for (const o of (upsertedOrders || [])) {
            allSyncedOrderIds.push(o.id);
            const lines = linesPerExtId.get(o.external_id) || [];
            for (const line of lines) {
              allFreshLines.push({ ...line, order_id: o.id });
            }
          }
        }

        stats.orders += orders.length;
        if (stats.orders % 500 === 0) {
          console.log(`[square-sync] Step 3/9 progress: ${stats.orders} orders processed so far`);
        }
        ordersCursor = ordersResp.cursor;
      } while (ordersCursor);
      console.log(`[square-sync] Step 3/9 complete: ${stats.orders} orders synced`);

      // Purge old lines only for synced orders, then insert fresh ones
      if (allSyncedOrderIds.length > 0) {
        for (let i = 0; i < allSyncedOrderIds.length; i += 50) {
          await supabase
            .from('cdm_order_lines')
            .delete()
            .in('order_id', allSyncedOrderIds.slice(i, i + 50));
        }

        for (let i = 0; i < allFreshLines.length; i += 500) {
          await supabase
            .from('cdm_order_lines')
            .insert(allFreshLines.slice(i, i + 500));
        }
      }

      console.log(`[square-sync] Step 3b complete: ${allFreshLines.length} order lines synced`);

      // 4) Sync Payments (all locations)
      // Build order external_id → internal id map for FK resolution (Fix #3)
      const orderExtToIntId = new Map<string, string>();
      for (const o of (await supabase
        .from('cdm_orders')
        .select('id, external_id')
        .eq('org_id', orgId)
        .eq('external_provider', 'square')
        .limit(10000)).data || []) {
        orderExtToIntId.set(o.external_id, o.id);
      }

      for (const locId of locationIds) {
        let paymentsCursor;
        do {
          const paymentsResp = await client.listPayments(locId, beginTime, paymentsCursor);
          const payments = paymentsResp.payments || [];

          for (const payment of payments) {
            const normalized = normalizeSquarePayment(payment, orgId, locationMap);
            // Resolve order_id FK from external order reference
            if (normalized.order_external_id) {
              normalized.order_id = orderExtToIntId.get(normalized.order_external_id) || null;
            }
            delete normalized.order_external_id;

            if (!normalized.order_id) continue; // Skip if order not found

            await supabase
              .from('cdm_payments')
              .upsert(normalized, { onConflict: 'external_provider,external_id' });
          }

          stats.payments += payments.length;
          paymentsCursor = paymentsResp.cursor;
        } while (paymentsCursor);
      }
      console.log(`[square-sync] Step 4/9 complete: ${stats.payments} payments synced`);

      // 5) Aggregate CDM orders → pos_daily_finance (data_source = 'pos')
      // Map CDM locations to Josephine locations
      const { data: josephineLocations } = await supabase
        .from('locations')
        .select('id, name, group_id')
        .eq('active', true)
        .limit(10);

      const { data: cdmLocations } = await supabase
        .from('cdm_locations')
        .select('id, name, external_id, timezone')
        .eq('org_id', orgId);

      // Build CDM location → Josephine location mapping + timezone lookup
      const cdmToJosephineMap = new Map<string, string>();
      const cdmLocTimezoneMap = new Map<string, string>();
      for (const cdmLoc of (cdmLocations || [])) {
        const match = (josephineLocations || []).find(jl =>
          jl.name.toLowerCase().includes(cdmLoc.name.toLowerCase()) ||
          cdmLoc.name.toLowerCase().includes(jl.name.toLowerCase())
        );
        cdmToJosephineMap.set(
          cdmLoc.id,
          match?.id || (josephineLocations?.[0]?.id ?? '')
        );
        cdmLocTimezoneMap.set(cdmLoc.id, cdmLoc.timezone || 'UTC');
      }

      // Helper: convert UTC timestamp to local date string using location timezone
      // (Fix #5: timezone-aware daily aggregation)
      function toLocalDate(utcTimestamp: string, timezone: string): string {
        try {
          const date = new Date(utcTimestamp);
          const formatted = date.toLocaleDateString('en-CA', { timeZone: timezone });
          return formatted; // Returns YYYY-MM-DD
        } catch {
          // Fallback to UTC split if timezone is invalid
          return new Date(utcTimestamp).toISOString().split('T')[0];
        }
      }

      // Fetch all CDM orders for aggregation (limit raised for growing data)
      // (Fix #6: include status field, filter cancelled/void orders from sales)
      const { data: cdmOrders } = await supabase
        .from('cdm_orders')
        .select('id, location_id, closed_at, gross_total, net_total, discount_total, refund_total, status, external_id')
        .eq('org_id', orgId)
        .not('closed_at', 'is', null)
        .limit(10000);

      if (cdmOrders && cdmOrders.length > 0 && josephineLocations && josephineLocations.length > 0) {
        // Group orders by date + josephine location
        const dailyAgg = new Map<string, {
          date: string;
          location_id: string;
          gross_sales: number;
          net_sales: number;
          orders_count: number;
          payments_cash: number;
          payments_card: number;
          payments_other: number;
          refunds_amount: number;
          refunds_count: number;
          discounts_amount: number;
          voids_count: number;
        }>();

        for (const order of cdmOrders) {
          // Fix #6: Skip cancelled/void orders from sales aggregation
          if (order.status === 'void' || order.status === 'draft') continue;

          const jLocId = cdmToJosephineMap.get(order.location_id) || josephineLocations[0].id;
          const tz = cdmLocTimezoneMap.get(order.location_id) || 'UTC';
          const orderDate = toLocalDate(order.closed_at, tz);
          const key = `${orderDate}|${jLocId}`;

          const existing = dailyAgg.get(key) || {
            date: orderDate,
            location_id: jLocId,
            gross_sales: 0,
            net_sales: 0,
            orders_count: 0,
            payments_cash: 0,
            payments_card: 0,
            payments_other: 0,
            refunds_amount: 0,
            refunds_count: 0,
            discounts_amount: 0,
            voids_count: 0,
          };

          // Fix #11: Use gross_total consistently (total_money from Square).
          // net_total from Square = total after discounts+taxes, which is NOT
          // what pos_daily_finance.net_sales means (net of tax only).
          // Use gross_total - tax as true net_sales.
          existing.gross_sales += Number(order.gross_total || 0);
          existing.net_sales += Number(order.net_total || 0);
          existing.orders_count += 1;

          // Fix #1: Aggregate refund and discount totals
          const discountAmt = Number(order.discount_total || 0);
          const refundAmt = Number(order.refund_total || 0);
          existing.discounts_amount += discountAmt;
          existing.refunds_amount += refundAmt;
          if (refundAmt > 0) existing.refunds_count += 1;

          // Fix #2: Use tender breakdown from normalization
          const tenders = tendersByExtId.get(order.external_id);
          if (tenders) {
            existing.payments_cash += tenders.cash;
            existing.payments_card += tenders.card;
            existing.payments_other += tenders.other;
          } else {
            // Fallback: assign total to card if no tender info
            existing.payments_card += Number(order.gross_total || 0);
          }

          dailyAgg.set(key, existing);
        }

        // Count voided orders separately
        for (const order of cdmOrders) {
          if (order.status !== 'void') continue;
          const jLocId = cdmToJosephineMap.get(order.location_id) || josephineLocations[0].id;
          const tz = cdmLocTimezoneMap.get(order.location_id) || 'UTC';
          const orderDate = toLocalDate(order.closed_at, tz);
          const key = `${orderDate}|${jLocId}`;
          const existing = dailyAgg.get(key);
          if (existing) existing.voids_count += 1;
        }

        // Build aggregated rows
        const rows = Array.from(dailyAgg.values()).map(d => ({
          date: d.date,
          location_id: d.location_id,
          gross_sales: d.gross_sales,
          net_sales: d.net_sales,
          orders_count: d.orders_count,
          payments_cash: d.payments_cash,
          payments_card: d.payments_card,
          payments_other: d.payments_other,
          refunds_amount: d.refunds_amount,
          refunds_count: d.refunds_count,
          discounts_amount: d.discounts_amount,
          comps_amount: 0,
          voids_amount: d.voids_count,
          data_source: 'pos',
        }));

        if (rows.length > 0) {
          const syncedDates = [...new Set(rows.map(r => r.date))];
          const syncedLocationIds = [...new Set(rows.map(r => r.location_id))];

          // Only delete previous POS rows — keep simulated data intact
          // so disconnecting reverts cleanly to demo data.
          await supabase
            .from('pos_daily_finance')
            .delete()
            .eq('data_source', 'pos')
            .in('date', syncedDates)
            .in('location_id', syncedLocationIds);

          await supabase
            .from('pos_daily_finance')
            .insert(rows);
        }

        (stats as any).daily_finance_rows = rows.length;
        console.log(`[square-sync] Step 5/9 complete: ${rows.length} daily finance rows`);

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
          // Only delete previous POS rows — keep simulated data intact.
          const metricsDates = [...new Set(metricsRows.map(r => r.date))];
          await supabase
            .from('pos_daily_metrics')
            .delete()
            .eq('data_source', 'pos')
            .in('date', metricsDates)
            .in('location_id', [...new Set(metricsRows.map(r => r.location_id))]);

          await supabase
            .from('pos_daily_metrics')
            .insert(metricsRows);
        }
        (stats as any).daily_metrics_rows = metricsRows.length;
        console.log(`[square-sync] Step 6/9 complete: ${metricsRows.length} daily metrics rows`);

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

          // Insert only new products (not already in the products table).
          // Use resolved category_name from Square catalog (populated by step 2).
          const newProducts = cdmItemsList
            .filter(item => !productNameToId.has(item.name))
            .map(item => ({
              name: item.name,
              category: item.category_name || 'Food',
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
        //    Square doesn't provide cost data, so we estimate COGS using
        //    industry-standard ratios per category (Food ~30%, Beverage ~20%, Other ~25%).
        const cdmOrderIds = cdmOrders.map((o: any) => o.id);

        // Build product name → category lookup for COGS estimation
        const productCategoryMap = new Map<string, string>();
        if (cdmItemsList) {
          for (const item of cdmItemsList) {
            // category_name is actually Square category_id (UUID) - not useful.
            // Match against the products table which has real categories.
            productCategoryMap.set(item.name, 'Other');
          }
        }
        // Get real categories from products table
        const { data: allProducts } = await supabase
          .from('products')
          .select('name, category')
          .eq('group_id', groupId);
        for (const p of (allProducts || [])) {
          productCategoryMap.set(p.name, p.category || 'Other');
        }

        // COGS ratio by category (industry standard for restaurants)
        const COGS_RATIO: Record<string, number> = {
          'Food': 0.30,
          'Beverage': 0.20,
          'Dessert': 0.25,
          'Other': 0.28,
        };

        if (cdmOrderIds.length > 0 && productNameToId.size > 0) {
          // Fetch order lines in batches to avoid PostgREST URL length limit
          // (642 UUIDs ≈ 23 KB query string, exceeds ~8 KB GET limit).
          const LINES_BATCH = 50;
          const allLines: any[] = [];
          for (let i = 0; i < cdmOrderIds.length; i += LINES_BATCH) {
            const batch = cdmOrderIds.slice(i, i + LINES_BATCH);
            const { data: batchLines } = await supabase
              .from('cdm_order_lines')
              .select('order_id, name, quantity, gross_line_total')
              .in('order_id', batch)
              .limit(5000);
            if (batchLines) allLines.push(...batchLines);
          }

          // Build order_id → {date, location_id} lookup (timezone-aware)
          const orderInfoMap = new Map<string, { date: string; location_id: string }>();
          for (const order of cdmOrders) {
            // Skip void/draft orders from product aggregation too
            if (order.status === 'void' || order.status === 'draft') continue;
            const jLocId = cdmToJosephineMap.get(order.location_id) || josephineLocations[0].id;
            const tz = cdmLocTimezoneMap.get(order.location_id) || 'UTC';
            const orderDate = toLocalDate(order.closed_at, tz);
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

          for (const line of allLines) {
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

            const lineSales = Number(line.gross_line_total || 0);
            const category = productCategoryMap.get(line.name) || 'Other';
            const cogsRatio = COGS_RATIO[category] || COGS_RATIO['Other'];

            existing.units_sold += Number(line.quantity || 0);
            existing.net_sales += lineSales;
            existing.cogs += lineSales * cogsRatio;
            productDailyAgg.set(key, existing);
          }

          // Insert fresh POS rows
          const productRows = Array.from(productDailyAgg.values()).map(d => ({
            ...d,
            data_source: 'pos',
          }));

          if (productRows.length > 0) {
            // Only delete previous POS rows for synced dates/locations — keep simulated data intact.
            const prodDates = [...new Set(productRows.map(r => r.date))];
            const prodLocationIds = [...new Set(productRows.map(r => r.location_id))];
            await supabase
              .from('product_sales_daily')
              .delete()
              .eq('data_source', 'pos')
              .in('date', prodDates)
              .in('location_id', prodLocationIds);

            await supabase.from('product_sales_daily').insert(productRows);
          }
          (stats as any).product_sales_rows = productRows.length;
          console.log(`[square-sync] Step 8/9 complete: ${productRows.length} product sales rows`);

          // 8b) Aggregate COGS by (date, location) → cogs_daily
          //     This feeds Budgets and Instant P&L with actual COGS data.
          const cogsDailyAgg = new Map<string, { date: string; location_id: string; cogs_amount: number }>();
          for (const row of productRows) {
            const key = `${row.date}|${row.location_id}`;
            const existing = cogsDailyAgg.get(key) || {
              date: row.date,
              location_id: row.location_id,
              cogs_amount: 0,
            };
            existing.cogs_amount += row.cogs;
            cogsDailyAgg.set(key, existing);
          }

          const cogsRows = Array.from(cogsDailyAgg.values());
          if (cogsRows.length > 0) {
            const cogsDates = [...new Set(cogsRows.map(r => r.date))];
            const cogsLocationIds = [...new Set(cogsRows.map(r => r.location_id))];
            await supabase
              .from('cogs_daily')
              .delete()
              .in('date', cogsDates)
              .in('location_id', cogsLocationIds);

            await supabase.from('cogs_daily').insert(cogsRows);
          }
          (stats as any).cogs_daily_rows = cogsRows.length;
        }

        // 9) Populate facts_sales_15m from CDM orders (for Prophet forecasting)
        //    Prophet V4/V5 read from facts_sales_15m to generate forecasts.
        //    We bucket CDM orders into 15-minute intervals.
        const factsAgg = new Map<string, {
          location_id: string;
          ts_bucket: string;
          sales_gross: number;
          sales_net: number;
          tickets: number;
          covers: number;
        }>();

        for (const order of cdmOrders) {
          // Fix #6: Skip void/draft orders from facts aggregation
          if (order.status === 'void' || order.status === 'draft') continue;

          const jLocId = cdmToJosephineMap.get(order.location_id) || josephineLocations[0].id;
          const closedAt = new Date(order.closed_at);
          // Floor to 15-minute bucket
          closedAt.setMinutes(Math.floor(closedAt.getMinutes() / 15) * 15, 0, 0);
          const bucket = closedAt.toISOString();
          const key = `${bucket}|${jLocId}`;

          const existing = factsAgg.get(key) || {
            location_id: jLocId,
            ts_bucket: bucket,
            sales_gross: 0,
            sales_net: 0,
            tickets: 0,
            covers: 0,
          };

          existing.sales_gross += Number(order.gross_total || 0);
          existing.sales_net += Number(order.net_total || 0);
          existing.tickets += 1;
          factsAgg.set(key, existing);
        }

        if (factsAgg.size > 0) {
          const factsRows = Array.from(factsAgg.values()).map(r => ({
            ...r,
            data_source: 'pos',
          }));
          // Delete existing POS 15m facts for the synced date range (keep simulated)
          const factsDates = [...new Set(factsRows.map(r => r.ts_bucket.split('T')[0]))];
          for (const d of factsDates) {
            await supabase
              .from('facts_sales_15m')
              .delete()
              .eq('data_source', 'pos')
              .gte('ts_bucket', `${d}T00:00:00`)
              .lte('ts_bucket', `${d}T23:59:59`)
              .in('location_id', [...new Set(factsRows.map(r => r.location_id))]);
          }

          await supabase.from('facts_sales_15m').insert(factsRows);
          (stats as any).facts_15m_rows = factsRows.length;
          console.log(`[square-sync] Step 9/9 complete: ${factsRows.length} facts_15m rows`);
        }
      }

      console.log('[square-sync] All steps complete, finalizing...');

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
