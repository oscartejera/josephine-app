-- =====================================================
-- Fix recipe_ingredients bridge: recipes ↔ menu_items
-- =====================================================
-- 
-- Problem: recipe_ingredients.menu_item_id references menu_items.id,
-- but the app passes recipes.id everywhere. These are different tables
-- with different UUIDs, so ingredient queries always return 0 results.
--
-- Solution: Create a bridge function that resolves recipe.id → 
-- menu_items.id via name matching.

-- 1. Helper: resolve menu_item_id from a recipe_id
CREATE OR REPLACE FUNCTION public.get_menu_item_id_for_recipe(p_recipe_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_recipe_name text;
  v_menu_item_id uuid;
BEGIN
  -- Get the recipe name
  SELECT menu_item_name INTO v_recipe_name
  FROM recipes WHERE id = p_recipe_id;

  IF v_recipe_name IS NULL THEN RETURN NULL; END IF;

  -- Find matching menu_items row
  SELECT id INTO v_menu_item_id
  FROM menu_items
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_recipe_name))
  LIMIT 1;

  RETURN v_menu_item_id;
END;
$$;


-- 2. Fix get_recipe_food_cost to bridge through name
CREATE OR REPLACE FUNCTION public.get_recipe_food_cost(p_recipe_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_cost numeric := 0;
  v_menu_item_id uuid;
BEGIN
  -- First try direct menu_item_id match (works when p_recipe_id IS a menu_items.id)
  SELECT COALESCE(SUM(
    COALESCE(ri.qty_gross, ri.quantity, 0) * COALESCE(ii.last_cost, ii.price, 0)
  ), 0)
  INTO v_cost
  FROM recipe_ingredients ri
  JOIN inventory_items ii ON ii.id = ri.inventory_item_id
  WHERE ri.menu_item_id = p_recipe_id;

  -- If no results, try bridging through recipe name → menu_items
  IF v_cost = 0 THEN
    v_menu_item_id := public.get_menu_item_id_for_recipe(p_recipe_id);
    IF v_menu_item_id IS NOT NULL THEN
      SELECT COALESCE(SUM(
        COALESCE(ri.qty_gross, ri.quantity, 0) * COALESCE(ii.last_cost, ii.price, 0)
      ), 0)
      INTO v_cost
      FROM recipe_ingredients ri
      JOIN inventory_items ii ON ii.id = ri.inventory_item_id
      WHERE ri.menu_item_id = v_menu_item_id;
    END IF;
  END IF;

  RETURN ROUND(v_cost, 2);
END;
$$;


-- 3. New RPC: get ingredient count for a recipe (bridging through name)
CREATE OR REPLACE FUNCTION public.get_recipe_ingredient_count(p_recipe_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_count integer := 0;
  v_menu_item_id uuid;
BEGIN
  -- Try direct match first
  SELECT COUNT(*) INTO v_count
  FROM recipe_ingredients
  WHERE menu_item_id = p_recipe_id;

  -- If 0, bridge through name
  IF v_count = 0 THEN
    v_menu_item_id := public.get_menu_item_id_for_recipe(p_recipe_id);
    IF v_menu_item_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count
      FROM recipe_ingredients
      WHERE menu_item_id = v_menu_item_id;
    END IF;
  END IF;

  RETURN v_count;
END;
$$;


-- 4. New RPC: get ingredients for a recipe (bridging through name)
-- Returns full ingredient data for the RecipeDetail page
CREATE OR REPLACE FUNCTION public.get_recipe_ingredients(p_recipe_id uuid)
RETURNS TABLE (
  menu_item_id uuid,
  inventory_item_id uuid,
  sub_recipe_id uuid,
  qty_base_units numeric,
  qty_gross numeric,
  qty_net numeric,
  unit text,
  yield_pct numeric,
  sort_order integer,
  item_name text,
  item_unit text,
  last_cost numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_resolved_id uuid;
BEGIN
  -- Try direct match first
  IF EXISTS (SELECT 1 FROM recipe_ingredients WHERE recipe_ingredients.menu_item_id = p_recipe_id) THEN
    v_resolved_id := p_recipe_id;
  ELSE
    -- Bridge through name
    v_resolved_id := public.get_menu_item_id_for_recipe(p_recipe_id);
  END IF;

  IF v_resolved_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT 
    ri.menu_item_id,
    ri.inventory_item_id,
    ri.sub_recipe_id,
    COALESCE(ri.qty_base_units, 0),
    COALESCE(ri.qty_gross, ri.qty_base_units, 0),
    COALESCE(ri.qty_net, ri.qty_base_units, 0),
    COALESCE(ri.unit, 'kg'),
    COALESCE(ri.yield_pct, 100),
    COALESCE(ri.sort_order, 0),
    COALESCE(ii.name, ''),
    COALESCE(ii.unit, ii.base_unit, ''),
    COALESCE(ii.last_cost, ii.price, 0)
  FROM recipe_ingredients ri
  LEFT JOIN inventory_items ii ON ii.id = ri.inventory_item_id
  WHERE ri.menu_item_id = v_resolved_id
  ORDER BY ri.sort_order;
END;
$$;
