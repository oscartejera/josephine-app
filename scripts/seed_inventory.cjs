/**
 * Seed realistic Spanish restaurant inventory items + recipes + ingredients.
 * Targets group_id 747d5c56-... (main demo group with locations).
 * Also updates existing items (group_id e54e12d7-...) to match.
 */
const TOKEN = 'sbp_af50423d177b8b18c51d70ae4ed72e4a2d269020';
const PROJECT = 'qzrbvjklgorfoqersdpx';
const URL = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`;

const GROUP = '747d5c56-6a90-4913-9a7a-a497a3aa02e1';

async function sql(query) {
    const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });
    if (res.status >= 400) {
        const t = await res.text();
        throw new Error(`SQL error ${res.status}: ${t.substring(0, 300)}`);
    }
    return res.json();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Inventory Items ─────────────────────────────────────────
// [name, unit, order_unit, par_level, current_stock, last_cost, price, category, category_name, type, vat_rate]
const ITEMS = [
    // CARNES
    ['Solomillo de Ternera', 'kg', 'kg', 8, 5.2, 28.50, 28.50, 'food', 'Carnes', 'Food', 10],
    ['Cordero Lechal', 'kg', 'kg', 6, 4.1, 22.00, 22.00, 'food', 'Carnes', 'Food', 10],
    ['Pollo Campero', 'kg', 'kg', 15, 10.5, 6.80, 6.80, 'food', 'Carnes', 'Food', 10],
    ['Cerdo Ibérico (secreto)', 'kg', 'kg', 8, 6.0, 18.50, 18.50, 'food', 'Carnes', 'Food', 10],
    ['Chuletón de Buey', 'kg', 'kg', 5, 3.8, 35.00, 35.00, 'food', 'Carnes', 'Food', 10],
    ['Pato (magret)', 'kg', 'kg', 3, 2.0, 24.00, 24.00, 'food', 'Carnes', 'Food', 10],
    ['Costillas Cerdo', 'kg', 'kg', 10, 7.5, 8.50, 8.50, 'food', 'Carnes', 'Food', 10],
    ['Chorizo Fresco', 'kg', 'kg', 5, 3.2, 12.00, 12.00, 'food', 'Carnes', 'Food', 10],
    ['Morcilla', 'kg', 'kg', 4, 2.8, 9.00, 9.00, 'food', 'Carnes', 'Food', 10],
    ['Jamón Ibérico', 'kg', 'kg', 3, 1.5, 85.00, 85.00, 'food', 'Carnes', 'Food', 10],

    // PESCADOS Y MARISCOS
    ['Lubina (salvaje)', 'kg', 'kg', 6, 4.0, 18.00, 18.00, 'food', 'Pescados', 'Food', 10],
    ['Gambas Rojas', 'kg', 'kg', 5, 2.0, 32.00, 32.00, 'food', 'Pescados', 'Food', 10],
    ['Pulpo', 'kg', 'kg', 8, 5.5, 16.50, 16.50, 'food', 'Pescados', 'Food', 10],
    ['Bacalao Fresco', 'kg', 'kg', 6, 4.2, 14.00, 14.00, 'food', 'Pescados', 'Food', 10],
    ['Merluza', 'kg', 'kg', 8, 5.8, 12.50, 12.50, 'food', 'Pescados', 'Food', 10],
    ['Calamar', 'kg', 'kg', 6, 3.5, 10.00, 10.00, 'food', 'Pescados', 'Food', 10],
    ['Mejillones', 'kg', 'kg', 10, 7.0, 3.50, 3.50, 'food', 'Pescados', 'Food', 10],
    ['Almejas', 'kg', 'kg', 4, 2.5, 18.00, 18.00, 'food', 'Pescados', 'Food', 10],
    ['Langostinos', 'kg', 'kg', 5, 3.0, 22.00, 22.00, 'food', 'Pescados', 'Food', 10],
    ['Atún Rojo', 'kg', 'kg', 3, 1.8, 42.00, 42.00, 'food', 'Pescados', 'Food', 10],

    // VERDURAS Y HORTALIZAS
    ['Tomate', 'kg', 'kg', 20, 14.5, 2.80, 2.80, 'food', 'Verduras', 'Food', 4],
    ['Pimiento Rojo', 'kg', 'kg', 10, 7.0, 3.20, 3.20, 'food', 'Verduras', 'Food', 4],
    ['Pimiento Verde', 'kg', 'kg', 10, 8.0, 2.50, 2.50, 'food', 'Verduras', 'Food', 4],
    ['Cebolla', 'kg', 'kg', 25, 18.0, 1.50, 1.50, 'food', 'Verduras', 'Food', 4],
    ['Ajo', 'kg', 'kg', 5, 3.5, 6.00, 6.00, 'food', 'Verduras', 'Food', 4],
    ['Patata', 'kg', 'kg', 30, 22.0, 1.20, 1.20, 'food', 'Verduras', 'Food', 4],
    ['Lechuga', 'ud', 'ud', 20, 12.0, 1.00, 1.00, 'food', 'Verduras', 'Food', 4],
    ['Espárrago Verde', 'kg', 'kg', 5, 3.0, 8.50, 8.50, 'food', 'Verduras', 'Food', 4],
    ['Alcachofa', 'kg', 'kg', 6, 4.0, 5.50, 5.50, 'food', 'Verduras', 'Food', 4],
    ['Champiñón', 'kg', 'kg', 8, 5.5, 4.80, 4.80, 'food', 'Verduras', 'Food', 4],
    ['Zanahoria', 'kg', 'kg', 15, 10.0, 1.80, 1.80, 'food', 'Verduras', 'Food', 4],
    ['Calabacín', 'kg', 'kg', 10, 7.0, 2.20, 2.20, 'food', 'Verduras', 'Food', 4],
    ['Berenjena', 'kg', 'kg', 8, 5.5, 2.50, 2.50, 'food', 'Verduras', 'Food', 4],
    ['Limón', 'kg', 'kg', 8, 6.0, 2.00, 2.00, 'food', 'Verduras', 'Food', 4],
    ['Perejil', 'manojo', 'manojo', 10, 6.0, 0.60, 0.60, 'food', 'Verduras', 'Food', 4],

    // LÁCTEOS
    ['Nata 35% MG', 'L', 'L', 10, 6.0, 3.50, 3.50, 'food', 'Lácteos', 'Food', 4],
    ['Queso Manchego Curado', 'kg', 'kg', 4, 2.5, 16.00, 16.00, 'food', 'Lácteos', 'Food', 4],
    ['Mantequilla', 'kg', 'kg', 5, 3.0, 8.50, 8.50, 'food', 'Lácteos', 'Food', 4],
    ['Leche Entera', 'L', 'L', 20, 12.0, 0.95, 0.95, 'food', 'Lácteos', 'Food', 4],
    ['Mozzarella Fresca', 'kg', 'kg', 5, 3.0, 12.00, 12.00, 'food', 'Lácteos', 'Food', 4],
    ['Huevos Camperos', 'docena', 'docena', 15, 10.0, 3.80, 3.80, 'food', 'Lácteos', 'Food', 4],
    ['Queso Parmesano', 'kg', 'kg', 3, 1.8, 22.00, 22.00, 'food', 'Lácteos', 'Food', 4],

    // SECOS Y DESPENSA
    ['Arroz Bomba', 'kg', 'kg', 20, 15.0, 3.50, 3.50, 'food', 'Despensa', 'Food', 10],
    ['Pasta Seca', 'kg', 'kg', 15, 10.0, 2.20, 2.20, 'food', 'Despensa', 'Food', 10],
    ['Pan Artesano', 'kg', 'kg', 10, 8.0, 3.80, 3.80, 'food', 'Despensa', 'Food', 4],
    ['Harina de Trigo', 'kg', 'kg', 15, 12.0, 1.20, 1.20, 'food', 'Despensa', 'Food', 4],
    ['Azúcar', 'kg', 'kg', 10, 8.0, 1.10, 1.10, 'food', 'Despensa', 'Food', 10],
    ['Sal', 'kg', 'kg', 10, 8.0, 0.40, 0.40, 'food', 'Despensa', 'Food', 10],
    ['Pimienta Negra', 'kg', 'kg', 2, 1.5, 18.00, 18.00, 'food', 'Despensa', 'Food', 10],
    ['Pimentón de la Vera', 'kg', 'kg', 2, 1.2, 25.00, 25.00, 'food', 'Despensa', 'Food', 10],
    ['Azafrán', 'g', 'g', 50, 30.0, 0.80, 0.80, 'food', 'Despensa', 'Food', 10],
    ['Caldo de Pollo (concentrado)', 'L', 'L', 10, 6.0, 4.50, 4.50, 'food', 'Despensa', 'Food', 10],
    ['Tomate Triturado (lata)', 'kg', 'kg', 15, 10.0, 1.80, 1.80, 'food', 'Despensa', 'Food', 10],

    // ACEITES Y ADEREZOS
    ['Aceite de Oliva Virgen Extra', 'L', 'L', 15, 8.0, 8.50, 8.50, 'food', 'Aceites', 'Food', 10],
    ['Vinagre de Jerez', 'L', 'L', 5, 3.0, 5.50, 5.50, 'food', 'Aceites', 'Food', 10],
    ['Aceite de Girasol', 'L', 'L', 20, 14.0, 2.20, 2.20, 'food', 'Aceites', 'Food', 10],

    // BEBIDAS
    ['Cerveza (barril 30L)', 'L', 'barril', 60, 40.0, 1.80, 54.00, 'beverage', 'Bebidas', 'Beverage', 21],
    ['Vino Tinto Rioja (botella)', 'ud', 'ud', 40, 25.0, 6.50, 6.50, 'beverage', 'Bebidas', 'Beverage', 21],
    ['Vino Blanco Albariño (botella)', 'ud', 'ud', 30, 18.0, 7.80, 7.80, 'beverage', 'Bebidas', 'Beverage', 21],
    ['Coca-Cola 330ml', 'ud', 'ud', 100, 60.0, 0.55, 0.55, 'beverage', 'Bebidas', 'Beverage', 21],
    ['Agua Mineral 500ml', 'ud', 'ud', 120, 80.0, 0.25, 0.25, 'beverage', 'Bebidas', 'Beverage', 10],
    ['Zumo de Naranja', 'L', 'L', 15, 10.0, 3.20, 3.20, 'beverage', 'Bebidas', 'Beverage', 10],
    ['Gin Tonic (ginebra)', 'L', 'botella', 5, 3.0, 18.00, 18.00, 'beverage', 'Bebidas', 'Beverage', 21],
    ['Tónica 200ml', 'ud', 'ud', 60, 35.0, 0.65, 0.65, 'beverage', 'Bebidas', 'Beverage', 21],
    ['Té Verde (bolsitas)', 'ud', 'caja', 50, 30.0, 0.12, 6.00, 'beverage', 'Bebidas', 'Beverage', 10],
    ['Café en Grano', 'kg', 'kg', 8, 5.0, 14.00, 14.00, 'beverage', 'Bebidas', 'Beverage', 10],
    ['Limonada Casera', 'L', 'L', 10, 6.0, 2.50, 2.50, 'beverage', 'Bebidas', 'Beverage', 10],

    // LIMPIEZA Y OTROS
    ['Servilletas (paquete 1000)', 'ud', 'paquete', 5, 3.0, 12.00, 12.00, 'supply', 'Limpieza', 'Supply', 21],
    ['Film Transparente', 'ud', 'rollo', 10, 6.0, 8.50, 8.50, 'supply', 'Limpieza', 'Supply', 21],
    ['Guantes Nitrilo (caja 100)', 'ud', 'caja', 5, 3.0, 9.00, 9.00, 'supply', 'Limpieza', 'Supply', 21],
    ['Lavavajillas Industrial', 'L', 'garrafa', 10, 6.0, 4.50, 22.50, 'supply', 'Limpieza', 'Supply', 21],
    ['Bolsas Basura 100L', 'ud', 'rollo', 10, 5.0, 0.15, 7.50, 'supply', 'Limpieza', 'Supply', 21],
    ['Papel Cocina', 'ud', 'rollo', 10, 6.0, 3.50, 3.50, 'supply', 'Limpieza', 'Supply', 21],
];

// ─── Recipes with ingredients ────────────────────────────────
// Each recipe: [menu_item_name, selling_price, category, ingredients: [[item_name, quantity, unit]]]
const RECIPES = [
    ['Paella Valenciana', 24.50, 'Main', [
        ['Arroz Bomba', 0.120, 'kg'], ['Pollo Campero', 0.150, 'kg'], ['Tomate', 0.050, 'kg'],
        ['Pimiento Verde', 0.040, 'kg'], ['Aceite de Oliva Virgen Extra', 0.030, 'L'],
        ['Azafrán', 0.200, 'g'], ['Sal', 0.005, 'kg'], ['Caldo de Pollo (concentrado)', 0.200, 'L'],
    ]],
    ['Risotto Setas', 22.00, 'Main', [
        ['Arroz Bomba', 0.100, 'kg'], ['Champiñón', 0.120, 'kg'], ['Cebolla', 0.050, 'kg'],
        ['Mantequilla', 0.025, 'kg'], ['Queso Parmesano', 0.030, 'kg'], ['Nata 35% MG', 0.050, 'L'],
        ['Aceite de Oliva Virgen Extra', 0.020, 'L'], ['Sal', 0.003, 'kg'],
    ]],
    ['Cordero Lechal Asado', 28.00, 'Main', [
        ['Cordero Lechal', 0.300, 'kg'], ['Patata', 0.150, 'kg'], ['Cebolla', 0.060, 'kg'],
        ['Ajo', 0.010, 'kg'], ['Aceite de Oliva Virgen Extra', 0.030, 'L'], ['Sal', 0.005, 'kg'],
        ['Pimienta Negra', 0.002, 'kg'],
    ]],
    ['Lubina a la Sal', 26.00, 'Main', [
        ['Lubina (salvaje)', 0.350, 'kg'], ['Sal', 0.500, 'kg'], ['Limón', 0.050, 'kg'],
        ['Aceite de Oliva Virgen Extra', 0.020, 'L'], ['Perejil', 0.100, 'manojo'],
    ]],
    ['Chuletón de Buey', 38.50, 'Main', [
        ['Chuletón de Buey', 0.400, 'kg'], ['Patata', 0.150, 'kg'], ['Pimiento Rojo', 0.080, 'kg'],
        ['Aceite de Oliva Virgen Extra', 0.020, 'L'], ['Sal', 0.008, 'kg'],
    ]],
    ['Pulpo a la Gallega', 22.80, 'Main', [
        ['Pulpo', 0.250, 'kg'], ['Patata', 0.120, 'kg'], ['Pimentón de la Vera', 0.005, 'kg'],
        ['Aceite de Oliva Virgen Extra', 0.030, 'L'], ['Sal', 0.005, 'kg'],
    ]],
    ['Bacalao Pil-Pil', 26.50, 'Main', [
        ['Bacalao Fresco', 0.250, 'kg'], ['Aceite de Oliva Virgen Extra', 0.100, 'L'],
        ['Ajo', 0.020, 'kg'], ['Pimienta Negra', 0.002, 'kg'],
    ]],
    ['Secreto Ibérico', 24.00, 'Main', [
        ['Cerdo Ibérico (secreto)', 0.250, 'kg'], ['Patata', 0.150, 'kg'], ['Pimiento Verde', 0.060, 'kg'],
        ['Aceite de Oliva Virgen Extra', 0.020, 'L'], ['Sal', 0.005, 'kg'],
    ]],
    ['Merluza en Salsa Verde', 22.00, 'Main', [
        ['Merluza', 0.250, 'kg'], ['Ajo', 0.015, 'kg'], ['Perejil', 0.200, 'manojo'],
        ['Harina de Trigo', 0.020, 'kg'], ['Aceite de Oliva Virgen Extra', 0.040, 'L'],
        ['Almejas', 0.060, 'kg'], ['Espárrago Verde', 0.050, 'kg'],
    ]],
    ['Cochinillo Asado', 32.00, 'Main', [
        ['Costillas Cerdo', 0.350, 'kg'], ['Patata', 0.200, 'kg'], ['Cebolla', 0.080, 'kg'],
        ['Ajo', 0.010, 'kg'], ['Aceite de Oliva Virgen Extra', 0.030, 'L'], ['Sal', 0.008, 'kg'],
    ]],

    // STARTERS
    ['Ensalada Mixta', 12.00, 'Starter', [
        ['Lechuga', 0.250, 'ud'], ['Tomate', 0.100, 'kg'], ['Cebolla', 0.030, 'kg'],
        ['Aceite de Oliva Virgen Extra', 0.020, 'L'], ['Vinagre de Jerez', 0.010, 'L'],
        ['Sal', 0.002, 'kg'],
    ]],
    ['Gambas al Ajillo', 18.50, 'Starter', [
        ['Gambas Rojas', 0.180, 'kg'], ['Ajo', 0.020, 'kg'], ['Aceite de Oliva Virgen Extra', 0.040, 'L'],
        ['Pimienta Negra', 0.001, 'kg'], ['Perejil', 0.100, 'manojo'],
    ]],
    ['Patatas Bravas', 9.50, 'Starter', [
        ['Patata', 0.250, 'kg'], ['Tomate Triturado (lata)', 0.080, 'kg'],
        ['Aceite de Girasol', 0.200, 'L'], ['Pimentón de la Vera', 0.003, 'kg'],
        ['Ajo', 0.005, 'kg'], ['Sal', 0.005, 'kg'],
    ]],
    ['Jamón Ibérico', 18.90, 'Starter', [
        ['Jamón Ibérico', 0.080, 'kg'],
    ]],
    ['Boquerones Fritos', 14.00, 'Starter', [
        ['Calamar', 0.200, 'kg'], ['Harina de Trigo', 0.050, 'kg'],
        ['Aceite de Girasol', 0.150, 'L'], ['Limón', 0.050, 'kg'], ['Sal', 0.003, 'kg'],
    ]],
    ['Croquetas Jamón', 13.50, 'Starter', [
        ['Jamón Ibérico', 0.040, 'kg'], ['Harina de Trigo', 0.030, 'kg'],
        ['Leche Entera', 0.150, 'L'], ['Mantequilla', 0.020, 'kg'],
        ['Aceite de Girasol', 0.100, 'L'], ['Huevos Camperos', 0.083, 'docena'],
    ]],

    // DESSERTS
    ['Crema Catalana', 10.50, 'Dessert', [
        ['Leche Entera', 0.200, 'L'], ['Nata 35% MG', 0.050, 'L'],
        ['Huevos Camperos', 0.167, 'docena'], ['Azúcar', 0.050, 'kg'], ['Limón', 0.020, 'kg'],
    ]],
    ['Tarta de Queso', 11.00, 'Dessert', [
        ['Mozzarella Fresca', 0.100, 'kg'], ['Nata 35% MG', 0.100, 'L'],
        ['Huevos Camperos', 0.125, 'docena'], ['Azúcar', 0.040, 'kg'], ['Harina de Trigo', 0.020, 'kg'],
    ]],

    // BEVERAGES
    ['Zumo Naranja', 5.50, 'Beverage', [
        ['Zumo de Naranja', 0.250, 'L'],
    ]],
    ['Pizza Margherita', 14.50, 'Main', [
        ['Harina de Trigo', 0.150, 'kg'], ['Tomate Triturado (lata)', 0.080, 'kg'],
        ['Mozzarella Fresca', 0.120, 'kg'], ['Aceite de Oliva Virgen Extra', 0.015, 'L'],
        ['Sal', 0.003, 'kg'],
    ]],
];

async function main() {
    console.log('=== Seeding Inventory Items ===');

    // First, delete old items from wrong group_id and insert fresh
    // Move existing items to correct group
    await sql(`UPDATE inventory_items SET group_id = '${GROUP}' WHERE group_id = 'e54e12d7-018e-434e-a166-d041a97854c2'`);
    console.log('  Moved existing items to correct group');

    // Build bulk insert for all items
    const itemValues = ITEMS.map(([name, unit, order_unit, par_level, current_stock, last_cost, price, category, category_name, type, vat_rate]) => {
        const esc = s => String(s).replace(/'/g, "''");
        return `(gen_random_uuid(), '${GROUP}', '${esc(name)}', '${esc(unit)}', ${par_level}, ${current_stock}, ${last_cost}, NOW(), '${category}', true, '${type}', '${esc(category_name)}', '${esc(order_unit)}', 1, ${price}, ${vat_rate})`;
    }).join(',\n');

    await sql(`
    INSERT INTO inventory_items (id, group_id, name, unit, par_level, current_stock, last_cost, created_at, category, is_active, type, category_name, order_unit, order_unit_qty, price, vat_rate)
    VALUES ${itemValues}
    ON CONFLICT DO NOTHING
  `);
    console.log(`  Inserted ${ITEMS.length} inventory items`);

    await sleep(2000);

    // Get item ID lookup
    const items = await sql(`SELECT id, name FROM inventory_items WHERE group_id = '${GROUP}'`);
    const itemMap = {};
    items.forEach(i => { itemMap[i.name] = i.id; });
    console.log(`  Got ${items.length} items from DB`);

    console.log('\n=== Seeding Recipes ===');

    // Update existing recipes to correct group and add missing columns
    await sql(`UPDATE recipes SET group_id = '${GROUP}' WHERE group_id != '${GROUP}'`);

    for (const [name, price, category, ingredients] of RECIPES) {
        const esc = s => String(s).replace(/'/g, "''");

        // Check if recipe already exists
        const existing = await sql(`SELECT id FROM recipes WHERE menu_item_name = '${esc(name)}' AND group_id = '${GROUP}' LIMIT 1`);

        let recipeId;
        if (existing.length > 0) {
            recipeId = existing[0].id;
            // Update existing recipe
            await sql(`UPDATE recipes SET selling_price = ${price}, category = '${category}', yield_qty = 1, yield_unit = 'portion', is_sub_recipe = false WHERE id = '${recipeId}'`);
            console.log(`  Updated recipe: ${name} (${recipeId})`);
        } else {
            // Insert new recipe
            const result = await sql(`
        INSERT INTO recipes (id, group_id, menu_item_name, selling_price, category, yield_qty, yield_unit, is_sub_recipe, created_at)
        VALUES (gen_random_uuid(), '${GROUP}', '${esc(name)}', ${price}, '${category}', 1, 'portion', false, NOW())
        RETURNING id
      `);
            recipeId = result[0].id;
            console.log(`  Created recipe: ${name} (${recipeId})`);
        }

        // Delete old ingredients and insert new ones
        await sql(`DELETE FROM recipe_ingredients WHERE recipe_id = '${recipeId}'`);

        const ingValues = [];
        for (const [itemName, qty, unit] of ingredients) {
            const itemId = itemMap[itemName];
            if (!itemId) {
                console.log(`    ⚠️ Item not found: ${itemName}`);
                continue;
            }
            ingValues.push(`(gen_random_uuid(), '${recipeId}', '${itemId}', ${qty}, ${qty}, 100, '${unit}')`);
        }

        if (ingValues.length > 0) {
            await sql(`
        INSERT INTO recipe_ingredients (id, recipe_id, inventory_item_id, quantity, qty_gross, yield_pct, unit)
        VALUES ${ingValues.join(',\n')}
      `);
            console.log(`    Added ${ingValues.length} ingredients`);
        }

        await sleep(500); // light rate limiting
    }

    // Verify
    await sleep(1000);
    const counts = await sql(`
    SELECT 
      (SELECT COUNT(*)::int FROM inventory_items WHERE group_id = '${GROUP}') as items,
      (SELECT COUNT(*)::int FROM recipes WHERE group_id = '${GROUP}') as recipes,
      (SELECT COUNT(*)::int FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id WHERE r.group_id = '${GROUP}') as ingredients
  `);
    console.log('\n=== Verification ===');
    console.log(JSON.stringify(counts[0]));

    // Test food cost calculation
    const costs = await sql(`
    SELECT r.menu_item_name, r.selling_price, get_recipe_food_cost(r.id) as food_cost,
      ROUND((get_recipe_food_cost(r.id) / NULLIF(r.selling_price, 0)) * 100, 1) as food_cost_pct
    FROM recipes r WHERE r.group_id = '${GROUP}' ORDER BY r.menu_item_name LIMIT 10
  `);
    console.log('\n=== Sample Food Costs ===');
    costs.forEach(c => console.log(`  ${c.menu_item_name}: €${c.food_cost} / €${c.selling_price} = ${c.food_cost_pct}%`));
}

main().catch(e => console.error('ERROR:', e));
