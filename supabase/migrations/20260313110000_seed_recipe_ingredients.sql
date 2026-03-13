-- Seed realistic recipe ingredients for all 30 recipes (Escandallos).
--
-- Design goals:
--   1. Each recipe gets 2-5 real ingredients from inventory_items
--   2. qty_gross values produce food cost % between 18% and 55%
--   3. Diverse food cost % across categories = diverse Kasavana-Smith matrix
--   4. Selling prices updated to realistic levels (many were placeholder €12)
--
-- Inventory items available (with last_cost):
--   Aceite oliva (L)      = €12.60   | Arroz (kg)          = €10.65
--   Cafe en grano (kg)    = €8.58    | Cebollas (kg)       = €5.81
--   Cerveza barril (L)    = €13.75   | Chocolate (kg)      = €11.23
--   Gambas (kg)           = €8.73    | Harina (kg)         = €10.44
--   Jamon iberico (kg)    = €6.73    | Leche entera (L)    = €11.94
--   Lechugas (ud)         = €5.65    | Merluza (kg)        = €5.74
--   Nata (L)              = €10.00   | Pasta seca (kg)     = €14.61
--   Patatas (kg)          = €7.44    | Pimientos (kg)      = €6.23
--   Pollo (kg)            = €9.62    | Pulpo (kg)          = €10.27
--   Queso manchego (kg)   = €6.52    | Ternera (kg)        = €10.37
--   Tomates (kg)          = €4.35    | Vino tinto Rioja    = €4.49

-- =====================================================
-- Step 0a: Fix get_recipe_food_cost() to use menu_item_id
-- (baseline used ri.recipe_id which doesn't exist)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_recipe_food_cost(p_recipe_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_cost numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    COALESCE(ri.qty_gross, ri.quantity, 0) * COALESCE(ii.last_cost, ii.price, 0)
  ), 0)
  INTO v_cost
  FROM recipe_ingredients ri
  JOIN inventory_items ii ON ii.id = ri.inventory_item_id
  WHERE ri.menu_item_id = p_recipe_id;

  RETURN ROUND(v_cost, 2);
END;
$$;

-- =====================================================
-- Step 0: Fix selling prices from placeholder €12 to realistic values
-- =====================================================
UPDATE recipes SET selling_price = 16.50 WHERE menu_item_name = 'Cafe solo';
UPDATE recipes SET selling_price = 4.50  WHERE menu_item_name = 'Cerveza cana';
UPDATE recipes SET selling_price = 7.00  WHERE menu_item_name = 'Copa de cava';
UPDATE recipes SET selling_price = 6.50  WHERE menu_item_name = 'Copa de sangria';
UPDATE recipes SET selling_price = 5.50  WHERE menu_item_name = 'Copa de vino tinto';
UPDATE recipes SET selling_price = 12.00 WHERE menu_item_name = 'Gin tonic premium';
UPDATE recipes SET selling_price = 28.00 WHERE menu_item_name = 'Chuleton de ternera';
UPDATE recipes SET selling_price = 16.50 WHERE menu_item_name = 'Costillas BBQ';
UPDATE recipes SET selling_price = 14.50 WHERE menu_item_name = 'Hamburguesa gourmet';
UPDATE recipes SET selling_price = 15.00 WHERE menu_item_name = 'Pollo al ajillo';
UPDATE recipes SET selling_price = 24.00 WHERE menu_item_name = 'Solomillo iberico';
UPDATE recipes SET selling_price = 13.50 WHERE menu_item_name = 'Calamares a la romana';
UPDATE recipes SET selling_price = 16.00 WHERE menu_item_name = 'Lasana casera';
UPDATE recipes SET selling_price = 14.00 WHERE menu_item_name = 'Pasta carbonara';
UPDATE recipes SET selling_price = 18.00 WHERE menu_item_name = 'Bacalao al pil-pil';
UPDATE recipes SET selling_price = 14.50 WHERE menu_item_name = 'Gambas al ajillo';
UPDATE recipes SET selling_price = 16.00 WHERE menu_item_name = 'Merluza a la plancha';
UPDATE recipes SET selling_price = 19.00 WHERE menu_item_name = 'Pulpo a la gallega';
UPDATE recipes SET selling_price = 8.50  WHERE menu_item_name = 'Coulant de chocolate';
UPDATE recipes SET selling_price = 20.00 WHERE menu_item_name = 'Paella Valenciana';

-- =====================================================
-- Step 1: Clean existing recipe_ingredients (demo reset)
-- =====================================================
DELETE FROM recipe_ingredients
WHERE menu_item_id IN (SELECT id FROM menu_items);

-- =====================================================
-- Step 2: Insert recipe ingredients
-- =====================================================
-- Food cost targets per dish (designed for diverse matrix):
--
-- GOAL: Within each category, create a spread of food costs so the matrix
-- shows stars, plow horses, puzzles, AND dogs when combined with units_sold.
--
-- Low food cost % (18-25%) → high GP → more likely star/puzzle
-- Medium food cost % (26-35%) → mid GP → borderline
-- High food cost % (36-55%) → low GP → more likely plow_horse/dog

-- === BEBIDAS (8 items) ===
-- Target: diverse mix. Beverages typically have 15-35% food cost.

-- Agua mineral (PVP €2.50) → target ~20% food cost = €0.50
-- Ingredient: Agua mineral (ud) at €3.40 per ud... too high for water
-- We need a cheap ingredient. Let's use it directly with low qty.
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.15, 0.15, 'ud', 100, 1, 0.15
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Agua mineral' AND ii.name = 'Agua mineral (ud)';

-- Cafe solo (PVP €16.50) → target ~15% = €2.48
-- Cafe en grano €8.58/kg → 0.280 kg = €2.40
-- Leche €11.94/L → 0.01L = €0.12
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.280, 0.280, 'kg', 100, 1, 0.280
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Cafe solo' AND ii.name = 'Cafe en grano (kg)';

-- Cerveza cana (PVP €4.50) → target ~30% = €1.35
-- Cerveza barril €13.75/L → 0.10L = €1.38
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.10, 0.10, 'L', 100, 1, 0.10
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Cerveza cana' AND ii.name = 'Cerveza barril (L)';

-- Copa de cava (PVP €7.00) → target ~22% = €1.54
-- Vino Rioja €4.49/bot → 0.33 = €1.48 (reusing wine ingredient as proxy)
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.33, 0.33, 'bot', 100, 1, 0.33
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Copa de cava' AND ii.name = 'Vino tinto Rioja (bot)';

-- Copa de sangria (PVP €6.50) → target ~35% = €2.28
-- Vino Rioja €4.49/bot → 0.30 = €1.35
-- Refrescos €13.76/ud → 0.05 = €0.69
-- Lechugas (as fruit proxy) €5.65/ud → 0.05 = €0.28
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.30, 0.30, 'bot', 100, 1, 0.30
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Copa de sangria' AND ii.name = 'Vino tinto Rioja (bot)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.05, 0.05, 'ud', 100, 2, 0.05
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Copa de sangria' AND ii.name = 'Refrescos (ud)';

-- Copa de vino tinto (PVP €5.50) → target ~25% = €1.38
-- Vino Rioja €4.49/bot → 0.30 = €1.35
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.30, 0.30, 'bot', 100, 1, 0.30
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Copa de vino tinto' AND ii.name = 'Vino tinto Rioja (bot)';

-- Gin tonic premium (PVP €12.00) → target ~18% = €2.16
-- Refrescos €13.76/ud → 0.15 = €2.06
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.15, 0.15, 'ud', 100, 1, 0.15
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Gin tonic premium' AND ii.name = 'Refrescos (ud)';

-- Refresco (PVP €2.80) → target ~45% = €1.26
-- Refrescos €13.76/ud → 0.09 = €1.24
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.09, 0.09, 'ud', 100, 1, 0.09
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Refresco' AND ii.name = 'Refrescos (ud)';


-- === CARNES (5 items) ===
-- Target: 25-50% food cost (protein is expensive)

-- Chuleton de ternera (PVP €28.00) → target ~38% = €10.64
-- Ternera €10.37/kg → 0.400 kg = €4.15
-- Patatas €7.44/kg → 0.250 kg = €1.86
-- Aceite oliva €12.60/L → 0.050 L = €0.63
-- Pimientos €6.23/kg → 0.150 kg = €0.93
-- Cebollas €5.81/kg → 0.100 kg = €0.58
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.400, 0.360, 'kg', 90, 1, 0.400
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Chuleton de ternera' AND ii.name = 'Ternera (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.250, 0.250, 'kg', 100, 2, 0.250
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Chuleton de ternera' AND ii.name = 'Patatas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.050, 'L', 100, 3, 0.050
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Chuleton de ternera' AND ii.name = 'Aceite oliva (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.150, 0.135, 'kg', 90, 4, 0.150
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Chuleton de ternera' AND ii.name = 'Pimientos (kg)';

-- Costillas BBQ (PVP €16.50) → target ~42% = €6.93
-- Ternera (as pork proxy) €10.37/kg → 0.450 kg = €4.67
-- Cebollas €5.81/kg → 0.150 kg = €0.87
-- Tomates €4.35/kg → 0.200 kg = €0.87
-- Aceite oliva €12.60/L → 0.040 L = €0.50
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.450, 0.400, 'kg', 89, 1, 0.450
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Costillas BBQ' AND ii.name = 'Ternera (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.150, 0.135, 'kg', 90, 2, 0.150
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Costillas BBQ' AND ii.name = 'Cebollas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.200, 0.200, 'kg', 100, 3, 0.200
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Costillas BBQ' AND ii.name = 'Tomates (kg)';

-- Hamburguesa gourmet (PVP €14.50) → target ~32% = €4.64
-- Ternera €10.37/kg → 0.200 kg = €2.07
-- Queso €6.52/kg → 0.050 kg = €0.33
-- Lechugas €5.65/ud → 0.10 = €0.57
-- Tomates €4.35/kg → 0.080 kg = €0.35
-- Harina (bun proxy) €10.44/kg → 0.120 kg = €1.25
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.200, 0.180, 'kg', 90, 1, 0.200
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Hamburguesa gourmet' AND ii.name = 'Ternera (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.050, 'kg', 100, 2, 0.050
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Hamburguesa gourmet' AND ii.name = 'Queso manchego (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.10, 0.10, 'ud', 100, 3, 0.10
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Hamburguesa gourmet' AND ii.name = 'Lechugas (ud)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.120, 0.120, 'kg', 100, 4, 0.120
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Hamburguesa gourmet' AND ii.name = 'Harina (kg)';

-- Pollo al ajillo (PVP €15.00) → target ~28% = €4.20
-- Pollo €9.62/kg → 0.300 kg = €2.89
-- Aceite oliva €12.60/L → 0.060 L = €0.76
-- Patatas €7.44/kg → 0.080 kg = €0.60
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.300, 0.270, 'kg', 90, 1, 0.300
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pollo al ajillo' AND ii.name = 'Pollo (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.060, 0.060, 'L', 100, 2, 0.060
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pollo al ajillo' AND ii.name = 'Aceite oliva (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.080, 'kg', 100, 3, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pollo al ajillo' AND ii.name = 'Patatas (kg)';

-- Solomillo iberico (PVP €24.00) → target ~35% = €8.40
-- Ternera (ibérico proxy) €10.37/kg → 0.350 kg = €3.63
-- Patatas €7.44/kg → 0.200 kg = €1.49
-- Aceite oliva €12.60/L → 0.080 L = €1.01
-- Pimientos €6.23/kg → 0.200 kg = €1.25
-- Cebollas €5.81/kg → 0.150 kg = €0.87
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.350, 0.315, 'kg', 90, 1, 0.350
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Solomillo iberico' AND ii.name = 'Ternera (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.200, 0.200, 'kg', 100, 2, 0.200
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Solomillo iberico' AND ii.name = 'Patatas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.080, 'L', 100, 3, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Solomillo iberico' AND ii.name = 'Aceite oliva (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.200, 0.180, 'kg', 90, 4, 0.200
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Solomillo iberico' AND ii.name = 'Pimientos (kg)';


-- === ENTRANTES (6 items) ===

-- Calamares a la romana (PVP €13.50) → target ~30% = €4.05
-- Gambas (as calamari proxy) €8.73/kg → 0.250 kg = €2.18
-- Harina €10.44/kg → 0.100 kg = €1.04
-- Aceite oliva €12.60/L → 0.060 L = €0.76
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.250, 0.225, 'kg', 90, 1, 0.250
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Calamares a la romana' AND ii.name = 'Gambas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.100, 'kg', 100, 2, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Calamares a la romana' AND ii.name = 'Harina (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.060, 0.060, 'L', 100, 3, 0.060
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Calamares a la romana' AND ii.name = 'Aceite oliva (L)';

-- Croquetas de jamon (PVP €9.00) → target ~33% = €2.97
-- Jamon iberico €6.73/kg → 0.120 kg = €0.81
-- Harina €10.44/kg → 0.080 kg = €0.84
-- Leche €11.94/L → 0.100 L = €1.19
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.120, 0.120, 'kg', 100, 1, 0.120
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Croquetas de jamon' AND ii.name = 'Jamon iberico (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.080, 'kg', 100, 2, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Croquetas de jamon' AND ii.name = 'Harina (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.100, 'L', 100, 3, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Croquetas de jamon' AND ii.name = 'Leche entera (L)';

-- Ensalada mixta (PVP €8.50) → target ~22% = €1.87
-- Lechugas €5.65/ud → 0.15 = €0.85
-- Tomates €4.35/kg → 0.120 kg = €0.52
-- Aceite oliva €12.60/L → 0.030 L = €0.38
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.15, 0.15, 'ud', 100, 1, 0.15
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Ensalada mixta' AND ii.name = 'Lechugas (ud)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.120, 0.120, 'kg', 100, 2, 0.120
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Ensalada mixta' AND ii.name = 'Tomates (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.030, 0.030, 'L', 100, 3, 0.030
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Ensalada mixta' AND ii.name = 'Aceite oliva (L)';

-- Gazpacho andaluz (PVP €7.00) → target ~25% = €1.75
-- Tomates €4.35/kg → 0.250 kg = €1.09
-- Pimientos €6.23/kg → 0.050 kg = €0.31
-- Aceite oliva €12.60/L → 0.020 L = €0.25
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.250, 0.250, 'kg', 100, 1, 0.250
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Gazpacho andaluz' AND ii.name = 'Tomates (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.050, 'kg', 100, 2, 0.050
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Gazpacho andaluz' AND ii.name = 'Pimientos (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.020, 0.020, 'L', 100, 3, 0.020
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Gazpacho andaluz' AND ii.name = 'Aceite oliva (L)';

-- Patatas bravas (PVP €7.50) → target ~28% = €2.10
-- Patatas €7.44/kg → 0.200 kg = €1.49
-- Aceite oliva €12.60/L → 0.030 L = €0.38
-- Tomates €4.35/kg → 0.050 kg = €0.22
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.200, 0.180, 'kg', 90, 1, 0.200
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Patatas bravas' AND ii.name = 'Patatas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.030, 0.030, 'L', 100, 2, 0.030
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Patatas bravas' AND ii.name = 'Aceite oliva (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.050, 'kg', 100, 3, 0.050
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Patatas bravas' AND ii.name = 'Tomates (kg)';

-- Tortilla espanola (PVP €8.00) → target ~30% = €2.40
-- Patatas €7.44/kg → 0.200 kg = €1.49
-- Cebollas €5.81/kg → 0.080 kg = €0.46
-- Aceite oliva €12.60/L → 0.035 L = €0.44
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.200, 0.180, 'kg', 90, 1, 0.200
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tortilla espanola' AND ii.name = 'Patatas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.072, 'kg', 90, 2, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tortilla espanola' AND ii.name = 'Cebollas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.035, 0.035, 'L', 100, 3, 0.035
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tortilla espanola' AND ii.name = 'Aceite oliva (L)';


-- === PASTAS (3 items) ===

-- Lasana casera (PVP €16.00) → target ~30% = €4.80
-- Pasta seca €14.61/kg → 0.150 kg = €2.19
-- Ternera €10.37/kg → 0.120 kg = €1.24
-- Queso €6.52/kg → 0.080 kg = €0.52
-- Tomates €4.35/kg → 0.150 kg = €0.65
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.150, 0.150, 'kg', 100, 1, 0.150
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Lasana casera' AND ii.name = 'Pasta seca (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.120, 0.108, 'kg', 90, 2, 0.120
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Lasana casera' AND ii.name = 'Ternera (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.080, 'kg', 100, 3, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Lasana casera' AND ii.name = 'Queso manchego (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.150, 0.150, 'kg', 100, 4, 0.150
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Lasana casera' AND ii.name = 'Tomates (kg)';

-- Pasta carbonara (PVP €14.00) → target ~26% = €3.64
-- Pasta seca €14.61/kg → 0.130 kg = €1.90
-- Nata €10.00/L → 0.080 L = €0.80
-- Queso €6.52/kg → 0.060 kg = €0.39
-- Jamon iberico €6.73/kg → 0.080 kg = €0.54
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.130, 0.130, 'kg', 100, 1, 0.130
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pasta carbonara' AND ii.name = 'Pasta seca (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.080, 'L', 100, 2, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pasta carbonara' AND ii.name = 'Nata (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.060, 0.060, 'kg', 100, 3, 0.060
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pasta carbonara' AND ii.name = 'Queso manchego (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.080, 'kg', 100, 4, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pasta carbonara' AND ii.name = 'Jamon iberico (kg)';

-- Risotto de setas (PVP €14.50) → target ~35% = €5.08
-- Arroz €10.65/kg → 0.180 kg = €1.92
-- Queso €6.52/kg → 0.060 kg = €0.39
-- Nata €10.00/L → 0.100 L = €1.00
-- Cebollas €5.81/kg → 0.080 kg = €0.46
-- Aceite oliva €12.60/L → 0.040 L = €0.50
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.180, 0.180, 'kg', 100, 1, 0.180
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Risotto de setas' AND ii.name = 'Arroz (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.060, 0.060, 'kg', 100, 2, 0.060
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Risotto de setas' AND ii.name = 'Queso manchego (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.100, 'L', 100, 3, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Risotto de setas' AND ii.name = 'Nata (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.072, 'kg', 90, 4, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Risotto de setas' AND ii.name = 'Cebollas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.040, 0.040, 'L', 100, 5, 0.040
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Risotto de setas' AND ii.name = 'Aceite oliva (L)';


-- === PESCADOS (4 items) ===

-- Bacalao al pil-pil (PVP €18.00) → target ~32% = €5.76
-- Merluza (as bacalao proxy) €5.74/kg → 0.350 kg = €2.01
-- Aceite oliva €12.60/L → 0.120 L = €1.51
-- Patatas €7.44/kg → 0.180 kg = €1.34
-- Pimientos €6.23/kg → 0.100 kg = €0.62
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.350, 0.315, 'kg', 90, 1, 0.350
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Bacalao al pil-pil' AND ii.name = 'Merluza (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.120, 0.120, 'L', 100, 2, 0.120
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Bacalao al pil-pil' AND ii.name = 'Aceite oliva (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.180, 0.180, 'kg', 100, 3, 0.180
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Bacalao al pil-pil' AND ii.name = 'Patatas (kg)';

-- Gambas al ajillo (PVP €14.50) → target ~38% = €5.51
-- Gambas €8.73/kg → 0.300 kg = €2.62
-- Aceite oliva €12.60/L → 0.100 L = €1.26
-- Pimientos €6.23/kg → 0.080 kg = €0.50
-- Harina €10.44/kg → 0.050 kg = €0.52
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.300, 0.270, 'kg', 90, 1, 0.300
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Gambas al ajillo' AND ii.name = 'Gambas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.100, 'L', 100, 2, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Gambas al ajillo' AND ii.name = 'Aceite oliva (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.072, 'kg', 90, 3, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Gambas al ajillo' AND ii.name = 'Pimientos (kg)';

-- Merluza a la plancha (PVP €16.00) → target ~25% = €4.00
-- Merluza €5.74/kg → 0.350 kg = €2.01
-- Patatas €7.44/kg → 0.150 kg = €1.12
-- Aceite oliva €12.60/L → 0.050 L = €0.63
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.350, 0.315, 'kg', 90, 1, 0.350
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Merluza a la plancha' AND ii.name = 'Merluza (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.150, 0.150, 'kg', 100, 2, 0.150
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Merluza a la plancha' AND ii.name = 'Patatas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.050, 'L', 100, 3, 0.050
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Merluza a la plancha' AND ii.name = 'Aceite oliva (L)';

-- Pulpo a la gallega (PVP €19.00) → target ~40% = €7.60
-- Pulpo €10.27/kg → 0.400 kg = €4.11
-- Patatas €7.44/kg → 0.200 kg = €1.49
-- Aceite oliva €12.60/L → 0.100 L = €1.26
-- Pimientos €6.23/kg → 0.100 kg = €0.62
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.400, 0.360, 'kg', 90, 1, 0.400
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pulpo a la gallega' AND ii.name = 'Pulpo (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.200, 0.200, 'kg', 100, 2, 0.200
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pulpo a la gallega' AND ii.name = 'Patatas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.100, 'L', 100, 3, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pulpo a la gallega' AND ii.name = 'Aceite oliva (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.090, 'kg', 90, 4, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Pulpo a la gallega' AND ii.name = 'Pimientos (kg)';


-- === POSTRES (4 items) ===

-- Coulant de chocolate (PVP €8.50) → target ~30% = €2.55
-- Chocolate €11.23/kg → 0.100 kg = €1.12
-- Harina €10.44/kg → 0.050 kg = €0.52
-- Nata €10.00/L → 0.060 L = €0.60
-- Leche €11.94/L → 0.030 L = €0.36
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.100, 'kg', 100, 1, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Coulant de chocolate' AND ii.name = 'Chocolate (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.050, 0.050, 'kg', 100, 2, 0.050
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Coulant de chocolate' AND ii.name = 'Harina (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.060, 0.060, 'L', 100, 3, 0.060
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Coulant de chocolate' AND ii.name = 'Nata (L)';

-- Crema catalana (PVP €6.50) → target ~25% = €1.63
-- Leche €11.94/L → 0.080 L = €0.96
-- Nata €10.00/L → 0.040 L = €0.40
-- Harina €10.44/kg → 0.020 kg = €0.21
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.080, 'L', 100, 1, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Crema catalana' AND ii.name = 'Leche entera (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.040, 0.040, 'L', 100, 2, 0.040
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Crema catalana' AND ii.name = 'Nata (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.020, 0.020, 'kg', 100, 3, 0.020
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Crema catalana' AND ii.name = 'Harina (kg)';

-- Helado artesanal (PVP €5.00) → target ~40% = €2.00
-- Leche €11.94/L → 0.100 L = €1.19
-- Nata €10.00/L → 0.060 L = €0.60
-- Chocolate €11.23/kg → 0.020 kg = €0.22
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.100, 'L', 100, 1, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Helado artesanal' AND ii.name = 'Leche entera (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.060, 0.060, 'L', 100, 2, 0.060
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Helado artesanal' AND ii.name = 'Nata (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.020, 0.020, 'kg', 100, 3, 0.020
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Helado artesanal' AND ii.name = 'Chocolate (kg)';

-- Tarta de queso (PVP €7.00) → target ~33% = €2.31
-- Queso €6.52/kg → 0.150 kg = €0.98
-- Nata €10.00/L → 0.080 L = €0.80
-- Harina €10.44/kg → 0.040 kg = €0.42
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.150, 0.150, 'kg', 100, 1, 0.150
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tarta de queso' AND ii.name = 'Queso manchego (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.080, 0.080, 'L', 100, 2, 0.080
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tarta de queso' AND ii.name = 'Nata (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.040, 0.040, 'kg', 100, 3, 0.040
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Tarta de queso' AND ii.name = 'Harina (kg)';


-- === PAELLA VALENCIANA (Principales, PVP €20.00) → target ~35% = €7.00 ===
-- Arroz €10.65/kg → 0.200 kg = €2.13
-- Pollo €9.62/kg → 0.150 kg = €1.44
-- Gambas €8.73/kg → 0.120 kg = €1.05
-- Pimientos €6.23/kg → 0.100 kg = €0.62
-- Aceite oliva €12.60/L → 0.060 L = €0.76
-- Tomates €4.35/kg → 0.100 kg = €0.44
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.200, 0.200, 'kg', 100, 1, 0.200
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Paella Valenciana' AND ii.name = 'Arroz (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.150, 0.135, 'kg', 90, 2, 0.150
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Paella Valenciana' AND ii.name = 'Pollo (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.120, 0.108, 'kg', 90, 3, 0.120
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Paella Valenciana' AND ii.name = 'Gambas (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.090, 'kg', 90, 4, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Paella Valenciana' AND ii.name = 'Pimientos (kg)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.060, 0.060, 'L', 100, 5, 0.060
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Paella Valenciana' AND ii.name = 'Aceite oliva (L)';
INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty_gross, qty_net, unit, yield_pct, sort_order, qty_base_units)
SELECT mi.id, ii.id, 0.100, 0.100, 'kg', 100, 6, 0.100
FROM menu_items mi, inventory_items ii
WHERE mi.name = 'Paella Valenciana' AND ii.name = 'Tomates (kg)';
