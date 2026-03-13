-- =====================================================
-- Data coherence: fill gaps so Escandallo page shows
-- the same items as Menu Engineering
-- =====================================================
-- 
-- menu_items schema: (id, org_id, name, category, is_active, ...)
-- recipes schema: (id, menu_item_name, selling_price, category, business_id, ...)
-- recipe_ingredients schema: (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
--
-- This migration:
-- 1. Inserts missing menu_items from cdm_items
-- 2. Creates recipe entries for all menu_items without one
-- 3. Seeds recipe_ingredients for items missing them

-- =====================================================
-- Step 1: Insert missing menu_items from cdm_items
-- =====================================================
INSERT INTO menu_items (name, category, org_id, is_active)
SELECT DISTINCT ON (LOWER(TRIM(ci.name)))
  ci.name,
  ci.category,
  ci.org_id,
  true
FROM cdm_items ci
WHERE ci.name IS NOT NULL
  AND ci.name != ''
  AND ci.name != 'Unknown'
  AND NOT EXISTS (
    SELECT 1 FROM menu_items mi
    WHERE LOWER(TRIM(mi.name)) = LOWER(TRIM(ci.name))
      AND mi.org_id = ci.org_id
  )
ON CONFLICT DO NOTHING;


-- =====================================================
-- Step 2: Create recipe entries for menu_items without one
-- =====================================================
INSERT INTO recipes (
  menu_item_name,
  selling_price,
  category,
  yield_qty,
  yield_unit,
  is_sub_recipe,
  group_id
)
SELECT 
  mi.name,
  COALESCE(
    (SELECT AVG(col.gross / NULLIF(col.qty, 0))
     FROM cdm_order_lines col 
     JOIN cdm_items ci2 ON ci2.id = col.item_id
     WHERE LOWER(TRIM(ci2.name)) = LOWER(TRIM(mi.name))
       AND col.qty > 0
       AND col.gross > 0),
    12.00
  ),
  CASE 
    WHEN mi.category IN ('Entrantes') THEN 'Starter'
    WHEN mi.category IN ('Principales', 'Carnes', 'Pescados', 'Pastas') THEN 'Main'
    WHEN mi.category IN ('Postres') THEN 'Dessert'
    WHEN mi.category IN ('Bebidas', 'Vinos') THEN 'Beverage'
    ELSE 'Other'
  END,
  1,
  'portion',
  false,
  mi.org_id
FROM menu_items mi
WHERE NOT EXISTS (
  SELECT 1 FROM recipes r
  WHERE LOWER(TRIM(r.menu_item_name)) = LOWER(TRIM(mi.name))
)
AND mi.name IS NOT NULL
AND mi.name != ''
AND mi.name != 'Unknown';


-- =====================================================
-- Step 3: Seed recipe_ingredients for items with none
-- =====================================================
-- Only insert if no ingredients exist (NOT EXISTS guard)

-- Gazpacho (€11.82 / target FC ~21%)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.300, 0.300, 'kg', 100, 1, 0.300
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'gazpacho' AND ii.name = 'Tomates (kg)'
AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = mi.id);

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.080, 'kg', 100, 2, 0.080
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'gazpacho' AND ii.name = 'Pimientos (kg)';

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.030, 0.030, 'L', 100, 3, 0.030
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'gazpacho' AND ii.name = 'Aceite oliva (L)';

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.050, 'kg', 100, 4, 0.050
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'gazpacho' AND ii.name = 'Cebollas (kg)';


-- Cerveza Estrella Galicia (€22.73 / target FC ~7%)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.115, 0.115, 'L', 100, 1, 0.115
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'cerveza estrella galicia' AND ii.name = 'Cerveza barril (L)'
AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = mi.id);


-- Tinto de Verano (€7.27 / target FC ~21%)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.20, 0.20, 'bot', 100, 1, 0.20
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'tinto de verano' AND ii.name = 'Vino tinto Rioja (bot)'
AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = mi.id);

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.045, 0.045, 'ud', 100, 2, 0.045
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'tinto de verano' AND ii.name = 'Refrescos (ud)';


-- Ribera del Duero (€8.18 / target FC ~30%)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.55, 0.55, 'bot', 100, 1, 0.55
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'ribera del duero' AND ii.name = 'Vino tinto Rioja (bot)'
AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = mi.id);


-- Chuleton de Buey (€13.64 / target FC ~46%)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.400, 0.360, 'kg', 90, 1, 0.400
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'chuleton de buey' AND ii.name = 'Ternera (kg)'
AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = mi.id);

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.150, 0.150, 'kg', 100, 2, 0.150
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'chuleton de buey' AND ii.name = 'Patatas (kg)';

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.050, 'L', 100, 3, 0.050
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'chuleton de buey' AND ii.name = 'Aceite oliva (L)';

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.060, 0.054, 'kg', 90, 4, 0.060
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'chuleton de buey' AND ii.name = 'Cebollas (kg)';


-- Cochinillo Asado (€21.82 / target FC ~29%)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.380, 0.340, 'kg', 90, 1, 0.380
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'cochinillo asado' AND ii.name = 'Ternera (kg)'
AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = mi.id);

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.180, 0.180, 'kg', 100, 2, 0.180
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'cochinillo asado' AND ii.name = 'Patatas (kg)';

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.060, 0.060, 'L', 100, 3, 0.060
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'cochinillo asado' AND ii.name = 'Aceite oliva (L)';

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.045, 'kg', 90, 4, 0.050
FROM menu_items mi, inventory_items ii
WHERE LOWER(TRIM(mi.name)) = 'cochinillo asado' AND ii.name = 'Cebollas (kg)';


-- Pulpo a la Gallega (Principales, €15.45 / target FC ~48%)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.450, 0.405, 'kg', 90, 1, 0.450
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pulpo a la Gallega' AND ii.name = 'Pulpo (kg)'
AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = mi.id);

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.220, 0.220, 'kg', 100, 2, 0.220
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pulpo a la Gallega' AND ii.name = 'Patatas (kg)';

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.060, 0.060, 'L', 100, 3, 0.060
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pulpo a la Gallega' AND ii.name = 'Aceite oliva (L)';


-- Bacalao al Pil-Pil (Principales, €14.55 / target FC ~33%)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.350, 0.315, 'kg', 90, 1, 0.350
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Bacalao al Pil-Pil' AND ii.name = 'Merluza (kg)'
AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = mi.id);

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.100, 'L', 100, 2, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Bacalao al Pil-Pil' AND ii.name = 'Aceite oliva (L)';

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.150, 0.150, 'kg', 100, 3, 0.150
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Bacalao al Pil-Pil' AND ii.name = 'Patatas (kg)';


-- Tortilla Espanola (duplicate, €10.91 / target FC ~22%)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.180, 0.162, 'kg', 90, 1, 0.180
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tortilla Espanola' AND ii.name = 'Patatas (kg)'
AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = mi.id);

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.070, 0.063, 'kg', 90, 2, 0.070
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tortilla Espanola' AND ii.name = 'Cebollas (kg)';

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.050, 'L', 100, 3, 0.050
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tortilla Espanola' AND ii.name = 'Aceite oliva (L)';


-- Tarta de Queso (duplicate, €9.09 / target FC ~24%)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.140, 0.140, 'kg', 100, 1, 0.140
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tarta de Queso' AND ii.name = 'Queso manchego (kg)'
AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.menu_item_id = mi.id);

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.070, 0.070, 'L', 100, 2, 0.070
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tarta de Queso' AND ii.name = 'Nata (L)';

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.050, 'kg', 100, 3, 0.050
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tarta de Queso' AND ii.name = 'Harina (kg)';
