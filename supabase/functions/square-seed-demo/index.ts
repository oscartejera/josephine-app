/**
 * Square Seed Demo Data
 * Creates catalog items, orders, and payments in Square Production.
 *
 * Options (POST body):
 *   - clean_catalog: true  → Delete ALL existing catalog before recreating
 *   - skip_catalog: true   → Use existing catalog items
 *   - days_back: number    → How many days of orders to create (default 0)
 *   - orders_per_day: number → Base orders per day (default 15)
 */

import { corsHeaders } from '../_shared/cors.ts';

const SQUARE_BASE = 'https://connect.squareup.com/v2';

// ─── Full restaurant menu with categories ──────────────────────────────
const MENU: Record<string, Array<{ name: string; price: number }>> = {
  Entrantes: [
    { name: 'Patatas Bravas', price: 650 },
    { name: 'Croquetas de Jamón', price: 850 },
    { name: 'Nachos con Guacamole', price: 950 },
    { name: 'Tabla de Quesos', price: 1250 },
    { name: 'Gambas al Ajillo', price: 1350 },
  ],
  Ensaladas: [
    { name: 'Ensalada César', price: 1100 },
    { name: 'Ensalada Mediterránea', price: 1050 },
    { name: 'Ensalada de Burrata', price: 1250 },
  ],
  Principales: [
    { name: 'Hamburguesa Clásica', price: 1350 },
    { name: 'Hamburguesa Gourmet', price: 1650 },
    { name: 'Pizza Margherita', price: 1200 },
    { name: 'Pizza Pepperoni', price: 1400 },
    { name: 'Pasta Carbonara', price: 1250 },
    { name: 'Pasta Boloñesa', price: 1150 },
    { name: 'Salmón a la Plancha', price: 1890 },
    { name: 'Pollo al Horno', price: 1450 },
    { name: 'Tacos de Ternera', price: 1200 },
    { name: 'Wrap de Pollo', price: 1050 },
    { name: 'Bowl de Poké', price: 1450 },
    { name: 'Risotto de Setas', price: 1350 },
  ],
  Bebidas: [
    { name: 'Coca-Cola', price: 300 },
    { name: 'Agua Mineral', price: 250 },
    { name: 'Cerveza Artesana', price: 550 },
    { name: 'Copa de Vino Tinto', price: 650 },
    { name: 'Copa de Vino Blanco', price: 650 },
    { name: 'Limonada Natural', price: 450 },
    { name: 'Zumo de Naranja', price: 400 },
    { name: 'Café Espresso', price: 250 },
    { name: 'Café Latte', price: 380 },
    { name: 'Té / Infusión', price: 280 },
  ],
  Postres: [
    { name: 'Tarta de Queso', price: 700 },
    { name: 'Brownie con Helado', price: 750 },
    { name: 'Helado Artesano (2 bolas)', price: 550 },
    { name: 'Crema Catalana', price: 650 },
  ],
};

// Flat product list for order generation
const PRODUCTS = Object.values(MENU).flat();

const DOW_MULT = [1.10, 0.80, 0.92, 0.95, 1.00, 1.35, 1.45];
const HOUR_WEIGHTS: Record<number, number> = {
  10: 2, 11: 5, 12: 8, 13: 8, 14: 8, 15: 4, 16: 5, 17: 5, 18: 7, 19: 9, 20: 9, 21: 9, 22: 3,
};

function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }

function pickHour(): number {
  const hrs = Object.keys(HOUR_WEIGHTS).map(Number);
  const wts = hrs.map(h => HOUR_WEIGHTS[h]);
  const total = wts.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < hrs.length; i++) {
    r -= wts[i];
    if (r <= 0) return hrs[i];
  }
  return hrs[hrs.length - 1];
}

async function sq(endpoint: string, token: string, method = 'GET', body?: unknown) {
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
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const errors: string[] = [];
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(msg); };

  try {
    const token = Deno.env.get('SQUARE_PRODUCTION_ACCESS_TOKEN');
    if (!token) throw new Error('SQUARE_PRODUCTION_ACCESS_TOKEN not set');

    const body = await req.json().catch(() => ({}));
    const daysBack: number = body.days_back ?? 0;
    const ordersPerDay: number = body.orders_per_day ?? 15;
    const skipCatalog: boolean = body.skip_catalog ?? false;
    const cleanCatalog: boolean = body.clean_catalog ?? false;

    // Step 0: Locations
    log('Fetching locations...');
    const locData = await sq('/locations', token);
    const loc = locData.locations?.[0];
    if (!loc) throw new Error('No locations found');
    log(`Location: ${loc.name} (${loc.id}), currency: ${loc.currency}`);

    // Step 0.5: Clean existing catalog if requested
    if (cleanCatalog) {
      log('Cleaning existing catalog...');
      const allObjectIds: string[] = [];
      let cursor: string | undefined;

      do {
        const params = new URLSearchParams({ types: 'ITEM,CATEGORY' });
        if (cursor) params.append('cursor', cursor);
        const catList = await sq(`/catalog/list?${params}`, token);
        const objects = catList.objects || [];
        for (const obj of objects) {
          allObjectIds.push(obj.id);
        }
        cursor = catList.cursor;
      } while (cursor);

      log(`Found ${allObjectIds.length} existing catalog objects to delete`);

      if (allObjectIds.length > 0) {
        for (let i = 0; i < allObjectIds.length; i += 200) {
          const batch = allObjectIds.slice(i, i + 200);
          await sq('/catalog/batch-delete', token, 'POST', { object_ids: batch });
          log(`  Deleted batch ${Math.floor(i / 200) + 1} (${batch.length} objects)`);
        }
        log('All existing catalog deleted');
      }
    }

    // Step 1: Catalog
    let variationIds: string[] = [];

    if (!skipCatalog) {
      log('Creating catalog with categories...');
      const categories = Object.keys(MENU);
      const catObjs = categories.map((cat, i) => ({
        type: 'CATEGORY', id: `#cat_${i}`,
        category_data: { name: cat },
      }));

      const itemObjs: unknown[] = [];
      let itemIdx = 0;
      for (let ci = 0; ci < categories.length; ci++) {
        const cat = categories[ci];
        for (const item of MENU[cat]) {
          itemObjs.push({
            type: 'ITEM', id: `#item_${itemIdx}`,
            item_data: {
              name: item.name,
              categories: [{ id: `#cat_${ci}` }],
              variations: [{
                type: 'ITEM_VARIATION', id: `#var_${itemIdx}`,
                item_variation_data: {
                  name: 'Regular',
                  pricing_type: 'FIXED_PRICING',
                  price_money: { amount: item.price, currency: loc.currency || 'EUR' },
                },
              }],
            },
          });
          itemIdx++;
        }
      }

      const catResult = await sq('/catalog/batch-upsert', token, 'POST', {
        idempotency_key: crypto.randomUUID(),
        batches: [{ objects: [...catObjs, ...itemObjs] }],
      });

      const idMap: Record<string, string> = {};
      for (const m of (catResult.id_mappings || [])) {
        idMap[m.client_object_id] = m.object_id;
      }
      variationIds = PRODUCTS.map((_, i) => idMap[`#var_${i}`] || '');
      log(`Catalog: ${categories.length} categories, ${PRODUCTS.length} items, ${Object.keys(idMap).length} mappings`);
    } else {
      // Fetch existing catalog to get variation IDs
      log('Fetching existing catalog...');
      const catList = await sq('/catalog/list?types=ITEM', token);
      const items = catList.objects || [];
      for (const item of items) {
        const vars = item.item_data?.variations || [];
        for (const v of vars) {
          variationIds.push(v.id);
        }
      }
      log(`Found ${variationIds.length} existing variations`);
    }

    if (variationIds.length === 0 || variationIds.some(v => !v)) {
      throw new Error(`Invalid variation IDs: ${JSON.stringify(variationIds.slice(0, 3))}`);
    }

    // Step 2: Create orders + payments
    let totalOrders = 0;
    let totalPayments = 0;
    const now = new Date();

    for (let d = daysBack; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      const dow = date.getDay();
      const count = Math.round(ordersPerDay * DOW_MULT[dow]);

      for (let o = 0; o < count; o++) {
        try {
          const numItems = randInt(1, 4);
          const lineItems = [];
          for (let li = 0; li < numItems; li++) {
            const idx = randInt(0, variationIds.length - 1);
            lineItems.push({
              catalog_object_id: variationIds[idx],
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
            try {
              const payType = Math.random() < 0.7 ? 'CARD' : 'CHECK';
              await sq('/payments', token, 'POST', {
                idempotency_key: crypto.randomUUID(),
                source_id: 'EXTERNAL',
                external_details: { type: payType, source: 'Josephine Demo' },
                amount_money: order.total_money,
                order_id: order.id,
                location_id: loc.id,
              });
              totalPayments++;
            } catch (pe) {
              errors.push(`Payment err: ${pe.message.slice(0, 200)}`);
            }
          }

          if (o % 5 === 4) await new Promise(r => setTimeout(r, 500));
        } catch (oe) {
          errors.push(`Order err day-${d} #${o}: ${oe.message.slice(0, 200)}`);
          if (totalOrders === 0 && o >= 2) {
            log('First orders failing, stopping early');
            break;
          }
        }
      }
      log(`Day ${date.toISOString().split('T')[0]} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}): ${count} planned, ${totalOrders} total so far`);
    }

    return new Response(JSON.stringify({
      success: true,
      location: { id: loc.id, name: loc.name },
      catalog_items: PRODUCTS.length,
      catalog_cleaned: cleanCatalog,
      orders_created: totalOrders,
      payments_created: totalPayments,
      days_seeded: daysBack + 1,
      errors: errors.slice(0, 20),
      logs,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      errors: errors.slice(0, 10),
      logs,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
