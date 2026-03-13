-- Fix get_recipe_food_cost() to bridge recipes → menu_items → recipe_ingredients
-- 
-- Problem: recipe_ingredients.menu_item_id FK → menu_items.id (NOT recipes.id)
-- But the ME RPC calls get_recipe_food_cost(r.id) where r is from recipes table
-- Solution: look up menu_item by matching name, then find ingredients

CREATE OR REPLACE FUNCTION public.get_recipe_food_cost(p_recipe_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_cost numeric := 0;
  v_recipe_name text;
BEGIN
  -- First try direct lookup (recipe_ingredients.menu_item_id = p_recipe_id)
  SELECT COALESCE(SUM(
    COALESCE(ri.qty_gross, 0) * COALESCE(ii.last_cost, 0)
  ), 0)
  INTO v_cost
  FROM recipe_ingredients ri
  JOIN inventory_items ii ON ii.id = ri.inventory_item_id
  WHERE ri.menu_item_id = p_recipe_id;

  -- If nothing found, try bridge via recipe name → menu_item name
  IF v_cost = 0 THEN
    SELECT LOWER(TRIM(r.menu_item_name)) INTO v_recipe_name
    FROM recipes r WHERE r.id = p_recipe_id;

    IF v_recipe_name IS NOT NULL THEN
      SELECT COALESCE(SUM(
        COALESCE(ri.qty_gross, 0) * COALESCE(ii.last_cost, 0)
      ), 0)
      INTO v_cost
      FROM recipe_ingredients ri
      JOIN inventory_items ii ON ii.id = ri.inventory_item_id
      JOIN menu_items mi ON mi.id = ri.menu_item_id
      WHERE LOWER(TRIM(mi.name)) = v_recipe_name;
    END IF;
  END IF;

  RETURN ROUND(v_cost, 2);
END;
$$;
