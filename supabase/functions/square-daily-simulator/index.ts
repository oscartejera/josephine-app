/**
 * Square Daily Simulator
 *
 * Runs on a daily cron schedule (22:30 Madrid time) and creates realistic
 * orders + payments in Square Production, simulating a full day of restaurant
 * activity. After creating orders, it triggers square-sync to import the data
 * into Josephine's CDM and aggregated tables.
 *
 * Invocation modes:
 *   - Scheduled (cron): no body needed, simulates "today"
 *   - Manual:          POST { "orders_target": 80, "dry_run": true }
 *
 * Designed to run within the 60s Edge Function timeout by batching
 * order+payment creation in parallel groups.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

const SQUARE_BASE = 'https://connect.squareup.com/v2';

// ─── Product catalog (must match items already in Square) ──────────────
// Popularity weight: higher = more frequently ordered (Pareto distribution)
const PRODUCTS = [
  // Top sellers (weight 10) — ~40% of orders
  { name: 'Hamburguesa Clasica', category: 'Food', price: 1250, weight: 10 },
  { name: 'Pizza Margherita', category: 'Food', price: 1400, weight: 9 },
  { name: 'Pasta Carbonara', category: 'Food', price: 1350, weight: 8 },
  // High sellers (weight 6-7) — ~25% of orders
  { name: 'Hamburguesa Gourmet', category: 'Food', price: 1650, weight: 7 },
  { name: 'Cerveza Artesana', category: 'Beverage', price: 550, weight: 7 },
  { name: 'Coca-Cola', category: 'Beverage', price: 300, weight: 7 },
  { name: 'Pizza Pepperoni', category: 'Food', price: 1550, weight: 6 },
  { name: 'Pollo al Horno', category: 'Food', price: 1450, weight: 6 },
  // Medium sellers (weight 3-5) — ~20% of orders
  { name: 'Ensalada Caesar', category: 'Food', price: 950, weight: 5 },
  { name: 'Patatas Bravas', category: 'Food', price: 650, weight: 5 },
  { name: 'Agua Mineral', category: 'Beverage', price: 250, weight: 5 },
  { name: 'Cafe Espresso', category: 'Beverage', price: 200, weight: 5 },
  { name: 'Nachos con Guacamole', category: 'Food', price: 850, weight: 4 },
  { name: 'Croquetas Jamon', category: 'Food', price: 750, weight: 4 },
  { name: 'Tacos de Ternera', category: 'Food', price: 1100, weight: 4 },
  { name: 'Vino Tinto Copa', category: 'Beverage', price: 650, weight: 4 },
  // Low sellers (weight 1-3) — ~15% of orders
  { name: 'Pasta Bolognesa', category: 'Food', price: 1250, weight: 3 },
  { name: 'Ensalada Mediterranea', category: 'Food', price: 1050, weight: 3 },
  { name: 'Salmon a la Plancha', category: 'Food', price: 1890, weight: 3 },
  { name: 'Wrap de Pollo', category: 'Food', price: 1050, weight: 3 },
  { name: 'Bowl de Poke', category: 'Food', price: 1450, weight: 2 },
  { name: 'Limonada Natural', category: 'Beverage', price: 450, weight: 2 },
  { name: 'Zumo de Naranja', category: 'Beverage', price: 400, weight: 2 },
  { name: 'Tarta de Queso', category: 'Dessert', price: 700, weight: 2 },
  { name: 'Brownie con Helado', category: 'Dessert', price: 750, weight: 1 },
  { name: 'Helado Artesano', category: 'Dessert', price: 550, weight: 1 },
];

const TOTAL_WEIGHT = PRODUCTS.reduce((s, p) => s + p.weight, 0);

// Day-of-week multipliers (0=Sun, 6=Sat)
const DOW_MULT = [1.10, 0.80, 0.92, 0.95, 1.00, 1.35, 1.45];

// Seasonal multiplier: uses day-of-year sine wave (±15%)
function seasonalMult(date: Date): number {
  const doy = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return 1.0 + 0.15 * Math.sin((doy * 2 * Math.PI) / 365);
}

// ─── Helpers ───────────────────────────────────────────────────────────
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

/** Pick a product index weighted by popularity */
function pickProduct(): number {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < PRODUCTS.length; i++) {
    r -= PRODUCTS[i].weight;
    if (r <= 0) return i;
  }
  return PRODUCTS.length - 1;
}

/** Square API request with error handling */
async function sq(
  endpoint: string,
  token: string,
  method = 'GET',
  body?: unknown,
) {
  const res = await fetch(`${SQUARE_BASE}${endpoint}`, {
    method,
    headers: {
      'Square-Version': '2024-01-18',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(`${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

// ─── Main ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: corsHeaders });

  const errors: string[] = [];
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    console.log(msg);
  };

  try {
    const token = Deno.env.get('SQUARE_PRODUCTION_ACCESS_TOKEN');
    if (!token) throw new Error('SQUARE_PRODUCTION_ACCESS_TOKEN not set');

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dry_run ?? false;

    // Calculate today's order target
    const now = new Date();
    const dow = now.getDay();
    const baseOrders = body.orders_target ?? randInt(70, 90);
    const ordersTarget = Math.round(
      baseOrders * DOW_MULT[dow] * seasonalMult(now) * rand(0.92, 1.08),
    );

    log(
      `${now.toISOString().split('T')[0]} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow]})` +
        ` — Target: ${ordersTarget} orders (base=${baseOrders}, dow=${DOW_MULT[dow].toFixed(2)}, seasonal=${seasonalMult(now).toFixed(2)})`,
    );

    if (dryRun) {
      return new Response(
        JSON.stringify({ dry_run: true, orders_target: ordersTarget, logs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch location
    const locData = await sq('/locations', token);
    const loc = locData.locations?.[0];
    if (!loc) throw new Error('No locations found');
    log(`Location: ${loc.name} (${loc.id})`);

    // Fetch existing catalog variation IDs
    const catList = await sq('/catalog/list?types=ITEM', token);
    const catalogItems = catList.objects || [];
    const variationIds: string[] = [];
    for (const item of catalogItems) {
      for (const v of item.item_data?.variations || []) {
        variationIds.push(v.id);
      }
    }

    if (variationIds.length === 0) {
      throw new Error('No catalog items found — run square-seed-demo first');
    }
    log(`Catalog: ${variationIds.length} variations`);

    // Create orders in parallel batches of 5
    let totalOrders = 0;
    let totalPayments = 0;
    const BATCH_SIZE = 5;

    for (let batch = 0; batch < ordersTarget; batch += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, ordersTarget - batch);
      const promises = [];

      for (let i = 0; i < batchCount; i++) {
        promises.push(
          (async () => {
            // Build line items with weighted product selection
            const numItems = randInt(1, 4);
            const lineItems = [];
            const usedIndices = new Set<number>();

            for (let li = 0; li < numItems; li++) {
              let idx = pickProduct();
              // Avoid exact duplicates in the same order, map to variation
              if (usedIndices.has(idx)) idx = randInt(0, PRODUCTS.length - 1);
              usedIndices.add(idx);

              // Map product index to variation (may have duplicates from multiple catalog uploads)
              const varIdx = idx % variationIds.length;
              lineItems.push({
                catalog_object_id: variationIds[varIdx],
                quantity: String(randInt(1, 2)),
              });
            }

            // Create order
            const orderRes = await sq('/orders', token, 'POST', {
              idempotency_key: crypto.randomUUID(),
              order: {
                location_id: loc.id,
                line_items: lineItems,
                state: 'OPEN',
              },
            });

            const order = orderRes.order;
            totalOrders++;

            // Create payment (auto-completes the order)
            if (order?.total_money?.amount > 0) {
              const payType = Math.random() < 0.7 ? 'CARD' : 'CHECK';
              await sq('/payments', token, 'POST', {
                idempotency_key: crypto.randomUUID(),
                source_id: 'EXTERNAL',
                external_details: {
                  type: payType,
                  source: 'Josephine Demo',
                },
                amount_money: order.total_money,
                order_id: order.id,
                location_id: loc.id,
              });
              totalPayments++;
            }
          })().catch((err) => {
            errors.push(err.message.slice(0, 200));
          }),
        );
      }

      await Promise.all(promises);

      // Brief pause between batches for rate limiting
      if (batch + BATCH_SIZE < ordersTarget) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    log(`Created: ${totalOrders} orders, ${totalPayments} payments`);

    // Trigger square-sync to import data into Josephine
    let syncResult = 'not triggered';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Find the production integration account
      const { data: account } = await supabase
        .from('integration_accounts')
        .select('id')
        .eq('environment', 'production')
        .eq('provider', 'square')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (account) {
        // Trigger sync (fire-and-forget via pg_net if available, else direct)
        log(`Triggering square-sync for account ${account.id}...`);
        try {
          await fetch(`${supabaseUrl}/functions/v1/square-sync`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ accountId: account.id }),
            signal: AbortSignal.timeout(10000), // 10s max wait
          });
          syncResult = 'triggered';
        } catch {
          syncResult = 'triggered (async)';
        }
      } else {
        syncResult = 'no production account found';
      }
    } catch (syncErr) {
      syncResult = `error: ${syncErr.message}`;
    }

    log(`Sync: ${syncResult}`);

    return new Response(
      JSON.stringify({
        success: true,
        date: now.toISOString().split('T')[0],
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow],
        location: { id: loc.id, name: loc.name },
        orders_target: ordersTarget,
        orders_created: totalOrders,
        payments_created: totalPayments,
        sync: syncResult,
        errors_count: errors.length,
        errors: errors.slice(0, 10),
        logs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Simulator error:', error);
    return new Response(
      JSON.stringify({ error: error.message, errors, logs }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
