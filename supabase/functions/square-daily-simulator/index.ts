/**
 * Square Daily Simulator — Intraday Mode
 *
 * Runs every 15 minutes during business hours (10:00–23:00 Madrid) via pg_cron.
 * Each invocation creates a small batch of orders matching that time slot's
 * expected demand, simulating a real restaurant's order flow throughout the day.
 *
 * How it works:
 *   1. Calculates today's total order target (70-90 base × dow × seasonal × noise)
 *      using a deterministic seed per day so every 15-min invocation agrees on the target.
 *   2. Distributes orders across 52 fifteen-minute slots using hourly demand weights
 *      (lunch peak 13-14h, dinner peak 20-21h, quiet mornings).
 *   3. Creates only the orders for the CURRENT 15-min slot, then triggers square-sync.
 *
 * Invocation:
 *   - Cron (default): no body needed, auto-detects current Madrid time slot
 *   - Manual test:    POST { "slot_hour": 13, "slot_quarter": 2, "dry_run": true }
 *   - Full day:       POST { "full_day": true } — creates all remaining slots at once
 *
 * Business hours: 10:00–23:00 Madrid (09:00–22:00 UTC in winter, 08:00–21:00 in summer)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

const SQUARE_BASE = 'https://connect.squareup.com/v2';

// ─── Product catalog with Pareto popularity weights ────────────────────
// Must match the catalog created by square-seed-demo (same order & count)
const PRODUCTS = [
  // Entrantes
  { name: 'Patatas Bravas', category: 'Entrantes', price: 650, weight: 7 },
  { name: 'Croquetas de Jamón', category: 'Entrantes', price: 850, weight: 6 },
  { name: 'Nachos con Guacamole', category: 'Entrantes', price: 950, weight: 4 },
  { name: 'Tabla de Quesos', category: 'Entrantes', price: 1250, weight: 3 },
  { name: 'Gambas al Ajillo', category: 'Entrantes', price: 1350, weight: 3 },
  // Ensaladas
  { name: 'Ensalada César', category: 'Ensaladas', price: 1100, weight: 5 },
  { name: 'Ensalada Mediterránea', category: 'Ensaladas', price: 1050, weight: 3 },
  { name: 'Ensalada de Burrata', category: 'Ensaladas', price: 1250, weight: 2 },
  // Principales
  { name: 'Hamburguesa Clásica', category: 'Principales', price: 1350, weight: 10 },
  { name: 'Hamburguesa Gourmet', category: 'Principales', price: 1650, weight: 7 },
  { name: 'Pizza Margherita', category: 'Principales', price: 1200, weight: 9 },
  { name: 'Pizza Pepperoni', category: 'Principales', price: 1400, weight: 6 },
  { name: 'Pasta Carbonara', category: 'Principales', price: 1250, weight: 8 },
  { name: 'Pasta Boloñesa', category: 'Principales', price: 1150, weight: 3 },
  { name: 'Salmón a la Plancha', category: 'Principales', price: 1890, weight: 3 },
  { name: 'Pollo al Horno', category: 'Principales', price: 1450, weight: 6 },
  { name: 'Tacos de Ternera', category: 'Principales', price: 1200, weight: 4 },
  { name: 'Wrap de Pollo', category: 'Principales', price: 1050, weight: 3 },
  { name: 'Bowl de Poké', category: 'Principales', price: 1450, weight: 2 },
  { name: 'Risotto de Setas', category: 'Principales', price: 1350, weight: 2 },
  // Bebidas
  { name: 'Coca-Cola', category: 'Bebidas', price: 300, weight: 8 },
  { name: 'Agua Mineral', category: 'Bebidas', price: 250, weight: 7 },
  { name: 'Cerveza Artesana', category: 'Bebidas', price: 550, weight: 7 },
  { name: 'Copa de Vino Tinto', category: 'Bebidas', price: 650, weight: 5 },
  { name: 'Copa de Vino Blanco', category: 'Bebidas', price: 650, weight: 3 },
  { name: 'Limonada Natural', category: 'Bebidas', price: 450, weight: 2 },
  { name: 'Zumo de Naranja', category: 'Bebidas', price: 400, weight: 2 },
  { name: 'Café Espresso', category: 'Bebidas', price: 250, weight: 6 },
  { name: 'Café Latte', category: 'Bebidas', price: 380, weight: 3 },
  { name: 'Té / Infusión', category: 'Bebidas', price: 280, weight: 1 },
  // Postres
  { name: 'Tarta de Queso', category: 'Postres', price: 700, weight: 3 },
  { name: 'Brownie con Helado', category: 'Postres', price: 750, weight: 2 },
  { name: 'Helado Artesano (2 bolas)', category: 'Postres', price: 550, weight: 1 },
  { name: 'Crema Catalana', category: 'Postres', price: 650, weight: 2 },
];

const TOTAL_PRODUCT_WEIGHT = PRODUCTS.reduce((s, p) => s + p.weight, 0);

// Day-of-week multipliers (0=Sun ... 6=Sat)
const DOW_MULT = [1.10, 0.80, 0.92, 0.95, 1.00, 1.35, 1.45];

// Hourly demand weights (Madrid local time, 10:00–22:59)
// Reflects a typical Spanish restaurant: late lunch peak + strong dinner peak
const HOUR_WEIGHTS: Record<number, number> = {
  10: 2,  // Morning coffee / desayuno tardío
  11: 3,  // Brunch
  12: 5,  // Pre-lunch
  13: 9,  // Lunch peak
  14: 9,  // Lunch peak
  15: 4,  // Sobremesa
  16: 3,  // Merienda
  17: 3,  // Transition
  18: 4,  // Early tapas
  19: 7,  // Tapas / early dinner
  20: 9,  // Dinner peak
  21: 9,  // Dinner peak
  22: 4,  // Late dinner / copas
};

const TOTAL_HOUR_WEIGHT = Object.values(HOUR_WEIGHTS).reduce((a, b) => a + b, 0);

// ─── Deterministic seeded random ───────────────────────────────────────
// Simple mulberry32 PRNG so that all 15-min invocations in a day
// agree on the same daily target without needing shared state.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(date: Date): number {
  // YYYYMMDD as integer — same seed for all invocations on the same day
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return y * 10000 + m * 100 + d;
}

// Seasonal multiplier: sine wave over the year (±15%)
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
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pickProduct(): number {
  let r = Math.random() * TOTAL_PRODUCT_WEIGHT;
  for (let i = 0; i < PRODUCTS.length; i++) {
    r -= PRODUCTS[i].weight;
    if (r <= 0) return i;
  }
  return PRODUCTS.length - 1;
}

/** Get current Madrid time (handles CET/CEST automatically) */
function getMadridTime(utcDate: Date): Date {
  const madrid = new Date(
    utcDate.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }),
  );
  return madrid;
}

/** Calculate how many orders this 15-min slot should get */
function getSlotOrders(
  dailyTarget: number,
  hour: number,
  _quarter: number,
): number {
  const hourWeight = HOUR_WEIGHTS[hour] ?? 0;
  if (hourWeight === 0) return 0;

  // This hour's share of the daily total
  const hourOrders = (dailyTarget * hourWeight) / TOTAL_HOUR_WEIGHT;
  // Split across 4 quarters with slight randomness
  const quarterBase = hourOrders / 4;
  // Add ±30% noise per quarter for realism
  return Math.max(0, Math.round(quarterBase * rand(0.7, 1.3)));
}

/** Calculate deterministic daily target for a given date */
function getDailyTarget(date: Date, overrideBase?: number): { target: number; base: number; dow: number; seasonal: number; noise: number } {
  const rng = mulberry32(dateSeed(date));
  const dow = date.getDay();
  const base = overrideBase ?? Math.floor(70 + rng() * 21); // 70-90, deterministic
  const noise = 0.92 + rng() * 0.16; // ±8%, deterministic
  const seasonal = seasonalMult(date);
  const target = Math.round(base * DOW_MULT[dow] * seasonal * noise);
  return { target, base, dow, seasonal, noise };
}

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

    // Determine current time slot in Madrid timezone
    const now = new Date();
    const madrid = getMadridTime(now);
    const madridHour = body.slot_hour ?? madrid.getHours();
    const madridQuarter = body.slot_quarter ?? Math.floor(madrid.getMinutes() / 15);
    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Calculate deterministic daily target
    const daily = getDailyTarget(madrid, body.orders_target);

    log(
      `${madrid.toISOString().split('T')[0]} (${dowNames[daily.dow]}) ` +
        `— Daily target: ${daily.target} (base=${daily.base}, dow=${DOW_MULT[daily.dow].toFixed(2)}, ` +
        `seasonal=${daily.seasonal.toFixed(2)}, noise=${daily.noise.toFixed(2)})`,
    );

    // Determine orders for this slot
    let slotOrders: number;
    let slotLabel: string;

    if (body.full_day) {
      // Create all remaining orders for the day at once (manual catch-up mode)
      slotOrders = daily.target;
      slotLabel = 'full_day';
      log(`Full day mode: creating all ${slotOrders} orders`);
    } else {
      slotOrders = getSlotOrders(daily.target, madridHour, madridQuarter);
      slotLabel = `${String(madridHour).padStart(2, '0')}:${String(madridQuarter * 15).padStart(2, '0')}`;
      log(`Slot ${slotLabel} (hour weight=${HOUR_WEIGHTS[madridHour] ?? 0}) → ${slotOrders} orders`);
    }

    if (slotOrders === 0) {
      log('No orders for this slot (outside business hours or zero weight)');
      return new Response(
        JSON.stringify({
          success: true, slot: slotLabel, orders_created: 0,
          daily_target: daily.target, message: 'Outside business hours', logs,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (dryRun) {
      // Show what would happen for every slot today
      const slotPlan: Record<string, number> = {};
      let planTotal = 0;
      for (const h of Object.keys(HOUR_WEIGHTS).map(Number)) {
        for (let q = 0; q < 4; q++) {
          const n = getSlotOrders(daily.target, h, q);
          slotPlan[`${String(h).padStart(2, '0')}:${String(q * 15).padStart(2, '0')}`] = n;
          planTotal += n;
        }
      }
      return new Response(
        JSON.stringify({
          dry_run: true, daily_target: daily.target,
          current_slot: slotLabel, current_slot_orders: slotOrders,
          plan_total_approx: planTotal, slot_plan: slotPlan, logs,
        }),
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

    // Create orders in parallel batches of 5
    let totalOrders = 0;
    let totalPayments = 0;
    const BATCH_SIZE = 5;

    for (let batch = 0; batch < slotOrders; batch += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, slotOrders - batch);
      const promises = [];

      for (let i = 0; i < batchCount; i++) {
        promises.push(
          (async () => {
            const numItems = randInt(1, 4);
            const lineItems = [];
            const usedIndices = new Set<number>();

            for (let li = 0; li < numItems; li++) {
              let idx = pickProduct();
              if (usedIndices.has(idx)) idx = randInt(0, PRODUCTS.length - 1);
              usedIndices.add(idx);

              const varIdx = idx % variationIds.length;
              lineItems.push({
                catalog_object_id: variationIds[varIdx],
                quantity: String(randInt(1, 2)),
              });
            }

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
      if (batch + BATCH_SIZE < slotOrders) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    log(`Created: ${totalOrders} orders, ${totalPayments} payments`);

    // Trigger square-sync
    let syncResult = 'not triggered';
    if (totalOrders > 0) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: account } = await supabase
          .from('integration_accounts')
          .select('id')
          .eq('environment', 'production')
          .eq('provider', 'square')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (account) {
          log(`Triggering square-sync for account ${account.id}...`);
          try {
            await fetch(`${supabaseUrl}/functions/v1/square-sync`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ accountId: account.id }),
              signal: AbortSignal.timeout(10000),
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
    }

    log(`Sync: ${syncResult}`);

    // Run ETL: CDM orders → facts_sales_15m (so Prophet picks up the data)
    let etlResult = 'not run';
    if (totalOrders > 0) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        // Wait a few seconds for square-sync to finish importing CDM orders
        await new Promise((r) => setTimeout(r, 3000));

        const todayStr = madrid.toISOString().split('T')[0];
        const etlResp = await fetch(
          `${supabaseUrl}/rest/v1/rpc/etl_cdm_to_facts_sales_15m`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              p_date_from: todayStr,
              p_date_to: todayStr,
            }),
            signal: AbortSignal.timeout(10000),
          },
        );
        const etlData = await etlResp.json();
        etlResult = `${etlData?.facts_rows_upserted ?? 0} rows`;
        log(`ETL cdm→facts: ${etlResult}`);
      } catch (etlErr) {
        etlResult = `error: ${etlErr.message}`;
        log(`ETL error: ${etlResult}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: madrid.toISOString().split('T')[0],
        day: dowNames[daily.dow],
        slot: slotLabel,
        daily_target: daily.target,
        slot_target: slotOrders,
        orders_created: totalOrders,
        payments_created: totalPayments,
        sync: syncResult,
        etl: etlResult,
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
