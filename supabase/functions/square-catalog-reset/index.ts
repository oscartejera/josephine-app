/**
 * Square Catalog Reset
 * Deletes all existing catalog items and recreates a clean catalog with categories.
 * TEMPORARY: Delete after cleanup.
 */

import { corsHeaders } from '../_shared/cors.ts';

const SQUARE_BASE = 'https://connect.squareup.com/v2';

// Full restaurant menu with categories and realistic pricing (amounts in cents EUR)
const MENU = {
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
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(msg); };

  try {
    const token = Deno.env.get('SQUARE_PRODUCTION_ACCESS_TOKEN');
    if (!token) throw new Error('SQUARE_PRODUCTION_ACCESS_TOKEN not set');

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dry_run ?? false;

    // Step 1: Get location
    log('Fetching location...');
    const locData = await sq('/locations', token);
    const loc = locData.locations?.[0];
    if (!loc) throw new Error('No locations found');
    log(`Location: ${loc.name} (${loc.id}), currency: ${loc.currency}`);

    // Step 2: List ALL existing catalog objects
    log('Listing existing catalog...');
    const allObjectIds: string[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ types: 'ITEM,CATEGORY,ITEM_VARIATION' });
      if (cursor) params.append('cursor', cursor);
      const catList = await sq(`/catalog/list?${params}`, token);
      const objects = catList.objects || [];
      for (const obj of objects) {
        allObjectIds.push(obj.id);
      }
      cursor = catList.cursor;
    } while (cursor);

    log(`Found ${allObjectIds.length} existing catalog objects`);

    if (dryRun) {
      const totalItems = Object.values(MENU).flat().length;
      const categories = Object.keys(MENU);
      return new Response(JSON.stringify({
        dry_run: true,
        existing_objects_to_delete: allObjectIds.length,
        new_categories: categories,
        new_items: totalItems,
        menu: MENU,
        logs,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 3: Delete all existing catalog objects in batches of 200
    if (allObjectIds.length > 0) {
      log(`Deleting ${allObjectIds.length} catalog objects...`);
      for (let i = 0; i < allObjectIds.length; i += 200) {
        const batch = allObjectIds.slice(i, i + 200);
        await sq('/catalog/batch-delete', token, 'POST', {
          object_ids: batch,
        });
        log(`  Deleted batch ${Math.floor(i / 200) + 1} (${batch.length} objects)`);
      }
      log('All existing catalog deleted');
    }

    // Step 4: Create fresh catalog with proper categories
    log('Creating new catalog...');
    const categories = Object.keys(MENU);
    const catObjs = categories.map((cat, i) => ({
      type: 'CATEGORY',
      id: `#cat_${i}`,
      category_data: { name: cat },
    }));

    const itemObjs: unknown[] = [];
    let itemIdx = 0;
    for (let ci = 0; ci < categories.length; ci++) {
      const cat = categories[ci];
      for (const item of MENU[cat as keyof typeof MENU]) {
        itemObjs.push({
          type: 'ITEM',
          id: `#item_${itemIdx}`,
          item_data: {
            name: item.name,
            category_id: `#cat_${ci}`,
            variations: [{
              type: 'ITEM_VARIATION',
              id: `#var_${itemIdx}`,
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

    const totalItems = Object.values(MENU).flat().length;
    log(`Created: ${categories.length} categories, ${totalItems} items, ${Object.keys(idMap).length} ID mappings`);

    // Summarize
    const summary: Record<string, string[]> = {};
    itemIdx = 0;
    for (const cat of categories) {
      summary[cat] = [];
      for (const item of MENU[cat as keyof typeof MENU]) {
        const realId = idMap[`#var_${itemIdx}`] || 'unknown';
        summary[cat].push(`${item.name} (€${(item.price / 100).toFixed(2)}) → ${realId}`);
        itemIdx++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      location: { id: loc.id, name: loc.name },
      deleted_objects: allObjectIds.length,
      created_categories: categories.length,
      created_items: totalItems,
      id_mappings: Object.keys(idMap).length,
      catalog_summary: summary,
      logs,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      logs,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
