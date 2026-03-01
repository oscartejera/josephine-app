/**
 * Square Sync Edge Function
 *
 * Input: POST { org_id: uuid, lookback_days?: number }
 *
 * 1. Finds the Square integration + account + tokens
 * 2. Creates a sync run (status='running')
 * 3. Pulls Locations, Orders, and Payments from Square API
 * 4. Writes raw payloads to staging tables
 * 5. Idempotent window refresh: deletes CDM data for the lookback window, then inserts fresh
 * 6. On success: sets integrations.metadata.last_synced_at → drives PR4 auto-switch
 * 7. On failure: records error in integration_sync_runs
 *
 * DB SCHEMA (verified):
 *   cdm_orders        (id, org_id, location_id, external_id, opened_at, closed_at,
 *                      net_sales, tax, tips, discounts, comps, voids, refunds, payments_total,
 *                      gross_sales, metadata, provider, integration_account_id)
 *   cdm_order_lines   (id, org_id, order_id, item_id, name, qty, gross, net, discount, tax,
 *                      metadata, provider, integration_account_id)
 *   cdm_payments      (id, org_id, order_id, method, amount, metadata, provider, integration_account_id)
 *   cdm_items         (id, org_id, external_id, name, category, is_active, metadata, provider, integration_account_id)
 *   staging_square_orders / staging_square_payments / staging_square_catalog_items
 *   integration_sync_runs  (id, integration_id, status, started_at, finished_at, error, cursor, created_at)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';
import { SquareClient } from '../_shared/square-client.ts';

// Limits to avoid Edge Function timeout (max ~60s for Deno Deploy)
const MAX_ORDER_PAGES = 5;   // 5 × 100 = 500 orders max
const MAX_PAYMENT_PAGES = 5; // 5 × 100 = 500 payments max

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let runId: string | null = null;
  let integrationId: string | null = null;

  // ── Helper: finalize run on exit ────────────────────────────────────
  async function finalizeRun(
    status: 'success' | 'failed',
    stats: Record<string, number>,
    errorMsg?: string,
  ) {
    if (!runId) return;
    await supabase
      .from('integration_sync_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        error: errorMsg || null,
        cursor: stats,
      })
      .eq('id', runId);
  }

  try {
    const body = await req.json();
    const orgId: string = body.org_id;
    const lookbackDays: number = body.lookback_days ?? 7;

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'Missing org_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 1. Find integration ───────────────────────────────────────────
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('org_id', orgId)
      .eq('provider', 'square')
      .eq('is_enabled', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!integration) {
      return new Response(
        JSON.stringify({ error: 'Square not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    integrationId = integration.id;

    // ── 2. Find integration account ───────────────────────────────────
    const { data: account } = await supabase
      .from('integration_accounts')
      .select('*')
      .eq('integration_id', integration.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!account) {
      return new Response(
        JSON.stringify({ error: 'No integration account (OAuth not completed)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Read tokens ────────────────────────────────────────────────
    const { data: secrets } = await supabase
      .from('integration_secrets')
      .select('access_token, refresh_token, token_expires_at')
      .eq('integration_account_id', account.id)
      .maybeSingle();

    if (!secrets?.access_token) {
      return new Response(
        JSON.stringify({ error: 'No tokens saved (re-authenticate with Square)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 4. Create sync run ────────────────────────────────────────────
    const { data: run, error: runErr } = await supabase
      .from('integration_sync_runs')
      .insert({
        integration_id: integration.id,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (runErr || !run) {
      throw new Error(`Failed to create sync run: ${runErr?.message}`);
    }
    runId = run.id;

    // ── 5. Build Square API client ────────────────────────────────────
    const environment = (account.metadata as any)?.environment === 'sandbox'
      ? 'sandbox' as const
      : 'production' as const;

    const client = new SquareClient({
      accessToken: secrets.access_token,
      environment,
    });

    const stats = { locations: 0, orders: 0, payments: 0, items: 0, order_lines: 0 };
    const beginTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const accountId = account.id;

    // ── 5a. Fetch Locations ───────────────────────────────────────────
    const locationsResp = await client.listLocations();
    const squareLocations: any[] = locationsResp.locations || [];
    const locationIds = squareLocations.map((l: any) => l.id);
    stats.locations = squareLocations.length;

    // ── 5a-ii. Map Square locations → Josephine locations ────────────
    // Query this org's locations and build a best-effort mapping.
    // Strategy: match by Square location name ↔ Josephine location name.
    // Fallback: if only 1 org location, map all Square locations to it.
    const { data: orgLocations } = await supabase
      .from('locations')
      .select('id, name')
      .eq('org_id', orgId);

    const squareToJosephineLocMap = new Map<string, string>();
    if (orgLocations && orgLocations.length > 0) {
      for (const sqLoc of squareLocations) {
        // Try exact name match first
        const match = orgLocations.find(
          (jl: any) => jl.name?.toLowerCase().trim() === sqLoc.name?.toLowerCase().trim()
        );
        if (match) {
          squareToJosephineLocMap.set(sqLoc.id, match.id);
        } else if (orgLocations.length === 1) {
          // Single-location org: map everything to it
          squareToJosephineLocMap.set(sqLoc.id, orgLocations[0].id);
        } else {
          // Fallback: use the first location
          squareToJosephineLocMap.set(sqLoc.id, orgLocations[0].id);
          console.warn(`No name match for Square location "${sqLoc.name}" (${sqLoc.id}), defaulting to ${orgLocations[0].name}`);
        }
      }
    }

    if (locationIds.length === 0) {
      await finalizeRun('success', stats);
      return new Response(
        JSON.stringify({ run_id: runId, ...stats, message: 'No Square locations found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 5b. Fetch Orders (paginated, capped) ──────────────────────────
    const allSquareOrders: any[] = [];
    let ordersCursor: string | undefined;
    let orderPages = 0;
    do {
      const ordersResp = await client.searchOrders(locationIds, ordersCursor, beginTime);
      const orders = ordersResp.orders || [];
      allSquareOrders.push(...orders);
      ordersCursor = ordersResp.cursor;
      orderPages++;
    } while (ordersCursor && orderPages < MAX_ORDER_PAGES);
    stats.orders = allSquareOrders.length;

    // ── 5c. Fetch Payments (paginated, capped) ────────────────────────
    const allSquarePayments: any[] = [];
    for (const locId of locationIds) {
      let paymentsCursor: string | undefined;
      let paymentPages = 0;
      do {
        const paymentsResp = await client.listPayments(locId, beginTime, paymentsCursor);
        const payments = paymentsResp.payments || [];
        allSquarePayments.push(...payments);
        paymentsCursor = paymentsResp.cursor;
        paymentPages++;
      } while (paymentsCursor && paymentPages < MAX_PAYMENT_PAGES);
    }
    stats.payments = allSquarePayments.length;

    // ── 6. Write to staging tables ────────────────────────────────────
    // Orders staging
    if (allSquareOrders.length > 0) {
      const stagingOrders = allSquareOrders.map((o: any) => ({
        org_id: orgId,
        integration_account_id: accountId,
        square_order_id: o.id,
        square_location_id: o.location_id,
        square_updated_at: o.updated_at || o.created_at,
        payload: o,
        received_at: new Date().toISOString(),
        status: 'new',
      }));
      for (let i = 0; i < stagingOrders.length; i += 200) {
        await supabase.from('staging_square_orders').insert(stagingOrders.slice(i, i + 200));
      }
    }

    // Payments staging
    if (allSquarePayments.length > 0) {
      const stagingPayments = allSquarePayments.map((p: any) => ({
        org_id: orgId,
        integration_account_id: accountId,
        square_payment_id: p.id,
        square_order_id: p.order_id || null,
        square_location_id: p.location_id,
        square_created_at: p.created_at,
        payload: p,
        received_at: new Date().toISOString(),
        status: 'new',
      }));
      for (let i = 0; i < stagingPayments.length; i += 200) {
        await supabase.from('staging_square_payments').insert(stagingPayments.slice(i, i + 200));
      }
    }

    // ── 7. Idempotent window refresh: CDM tables ──────────────────────
    // 7a. Delete existing Square data for the lookback window
    //     Order: lines → payments → orders (FK safety)
    const windowStart = beginTime;

    // Get IDs of orders we're about to replace
    const { data: existingOrders } = await supabase
      .from('cdm_orders')
      .select('id')
      .eq('org_id', orgId)
      .eq('provider', 'square')
      .gte('closed_at', windowStart);

    const existingOrderIds = (existingOrders || []).map((o: any) => o.id);

    if (existingOrderIds.length > 0) {
      // Delete order lines for these orders (batch to avoid URL length limits)
      for (let i = 0; i < existingOrderIds.length; i += 50) {
        const batch = existingOrderIds.slice(i, i + 50);
        await supabase.from('cdm_order_lines').delete().in('order_id', batch);
        await supabase.from('cdm_payments').delete().in('order_id', batch);
      }
      // Delete the orders themselves
      for (let i = 0; i < existingOrderIds.length; i += 50) {
        const batch = existingOrderIds.slice(i, i + 50);
        await supabase.from('cdm_orders').delete().in('id', batch);
      }
    }

    // 7b. Also delete items from this provider (full refresh for catalog)
    await supabase
      .from('cdm_items')
      .delete()
      .eq('org_id', orgId)
      .eq('provider', 'square');

    // ── 7c. Insert fresh CDM orders ───────────────────────────────────
    const squareIdToCdmId = new Map<string, string>(); // external_id → cdm_orders.id

    for (let i = 0; i < allSquareOrders.length; i += 100) {
      const batch = allSquareOrders.slice(i, i + 100);
      const rows = batch.map((o: any) => {
        const grossCents = o.total_money?.amount ?? 0;
        const netCents = o.net_amounts?.total_money?.amount ?? grossCents;
        const taxCents = o.total_tax_money?.amount ?? 0;
        const tipCents = o.total_tip_money?.amount ?? 0;
        const discountCents = o.total_discount_money?.amount ?? 0;

        return {
          org_id: orgId,
          location_id: squareToJosephineLocMap.get(o.location_id) || null,
          external_id: o.id,
          opened_at: o.created_at || null,
          closed_at: o.closed_at || null,
          gross_sales: grossCents / 100,
          net_sales: netCents / 100,
          tax: taxCents / 100,
          tips: tipCents / 100,
          discounts: discountCents / 100,
          comps: 0,
          voids: 0,
          refunds: 0,
          payments_total: grossCents / 100,
          provider: 'square',
          integration_account_id: accountId,
          metadata: { state: o.state, source: o.source?.name, location_id: o.location_id },
        };
      });

      const { data: inserted } = await supabase
        .from('cdm_orders')
        .insert(rows)
        .select('id, external_id');

      for (const r of (inserted || [])) {
        squareIdToCdmId.set(r.external_id, r.id);
      }
    }

    // ── 7d. Insert CDM order lines ────────────────────────────────────
    const allLines: any[] = [];

    for (const order of allSquareOrders) {
      const cdmOrderId = squareIdToCdmId.get(order.id);
      if (!cdmOrderId) continue;

      for (const line of (order.line_items || [])) {
        const grossCents = line.gross_sales_money?.amount ?? line.total_money?.amount ?? 0;
        const netCents = line.total_money?.amount ?? grossCents;
        const discountCents = line.total_discount_money?.amount ?? 0;
        const taxCents = line.total_tax_money?.amount ?? 0;

        allLines.push({
          org_id: orgId,
          order_id: cdmOrderId,
          name: line.name || 'Unknown',
          qty: Number(line.quantity || 0),
          gross: grossCents / 100,
          net: netCents / 100,
          discount: discountCents / 100,
          tax: taxCents / 100,
          provider: 'square',
          integration_account_id: accountId,
          metadata: {
            uid: line.uid,
            catalog_object_id: line.catalog_object_id,
            variation_name: line.variation_name,
          },
        });
      }
    }

    stats.order_lines = allLines.length;
    for (let i = 0; i < allLines.length; i += 200) {
      await supabase.from('cdm_order_lines').insert(allLines.slice(i, i + 200));
    }

    // ── 7e. Insert CDM payments ───────────────────────────────────────
    // Extract tenders from orders (more reliable than Payments API for order→payment link)
    const allCdmPayments: any[] = [];

    for (const order of allSquareOrders) {
      const cdmOrderId = squareIdToCdmId.get(order.id);
      if (!cdmOrderId) continue;

      for (const tender of (order.tenders || [])) {
        const amountCents = tender.amount_money?.amount ?? 0;
        let method = 'other';
        if (tender.type === 'CARD') method = 'card';
        else if (tender.type === 'CASH') method = 'cash';
        else if (tender.type === 'SQUARE_GIFT_CARD') method = 'gift_card';

        allCdmPayments.push({
          org_id: orgId,
          order_id: cdmOrderId,
          method,
          amount: amountCents / 100,
          provider: 'square',
          integration_account_id: accountId,
          metadata: {
            tender_id: tender.id,
            type: tender.type,
            card_brand: tender.card_details?.card?.card_brand,
          },
        });
      }
    }

    for (let i = 0; i < allCdmPayments.length; i += 200) {
      await supabase.from('cdm_payments').insert(allCdmPayments.slice(i, i + 200));
    }

    // ── 7f. Insert CDM items (from order line catalog refs) ───────────
    // Collect unique item names from line items
    const seenItemNames = new Set<string>();
    const cdmItems: any[] = [];

    for (const order of allSquareOrders) {
      for (const line of (order.line_items || [])) {
        const name = line.name || 'Unknown';
        if (seenItemNames.has(name)) continue;
        seenItemNames.add(name);

        cdmItems.push({
          org_id: orgId,
          external_id: line.catalog_object_id || `line-${line.uid}`,
          name,
          category: line.variation_name || null,
          is_active: true,
          provider: 'square',
          integration_account_id: accountId,
          metadata: { catalog_object_id: line.catalog_object_id },
        });
      }
    }

    stats.items = cdmItems.length;
    for (let i = 0; i < cdmItems.length; i += 200) {
      await supabase.from('cdm_items').insert(cdmItems.slice(i, i + 200));
    }

    // ── 8. Success: update integration metadata + finalize run ────────
    await supabase
      .from('integrations')
      .update({
        metadata: {
          ...(integration.metadata || {}),
          last_synced_at: new Date().toISOString(),
        },
      })
      .eq('id', integration.id);

    await finalizeRun('success', stats);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        imported_orders: stats.orders,
        imported_order_lines: stats.order_lines,
        imported_payments: allCdmPayments.length,
        imported_items: stats.items,
        locations: stats.locations,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('Sync error:', error);

    await finalizeRun('failed', {}, error.message);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
