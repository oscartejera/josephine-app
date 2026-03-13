-- =====================================================
-- Phase 1: Canonical FK Architecture
-- =====================================================
-- 
-- Goal: Add a proper FK from recipes → menu_items so we
-- stop relying on fragile name-matching bridges.
--
-- Steps:
-- 1. Add menu_item_id column to recipes if not exists
-- 2. Backfill from name matching
-- 3. Update get_recipe_food_cost to use FK first
-- 4. Update get_recipe_ingredient_count to use FK
-- 5. Update get_recipe_ingredients to use FK
-- 6. Create get_setup_completeness RPC (Phase 2)

-- =====================================================
-- Step 1: Add menu_item_id to recipes
-- =====================================================
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id ON recipes(menu_item_id);

-- =====================================================
-- Step 2: Backfill from name matching
-- =====================================================
UPDATE recipes r
SET menu_item_id = mi.id
FROM menu_items mi
WHERE r.menu_item_id IS NULL
  AND LOWER(TRIM(r.menu_item_name)) = LOWER(TRIM(mi.name));

-- =====================================================
-- Step 3: Rewrite get_recipe_food_cost — FK first
-- =====================================================
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
  -- Method 1: Get menu_item_id from the recipe's FK
  SELECT menu_item_id INTO v_menu_item_id
  FROM recipes WHERE id = p_recipe_id;

  -- Method 2: direct match (caller might pass a menu_items.id)
  IF v_menu_item_id IS NULL THEN
    v_menu_item_id := p_recipe_id;
  END IF;

  SELECT COALESCE(SUM(
    COALESCE(ri.qty_gross, ri.qty_base_units, 0) * COALESCE(ii.last_cost, ii.price, 0)
  ), 0)
  INTO v_cost
  FROM recipe_ingredients ri
  JOIN inventory_items ii ON ii.id = ri.inventory_item_id
  WHERE ri.menu_item_id = v_menu_item_id;

  -- Fallback: name bridge (backward compat)
  IF v_cost = 0 AND v_menu_item_id = p_recipe_id THEN
    SELECT mi.id INTO v_menu_item_id
    FROM recipes r
    JOIN menu_items mi ON LOWER(TRIM(mi.name)) = LOWER(TRIM(r.menu_item_name))
    WHERE r.id = p_recipe_id
    LIMIT 1;

    IF v_menu_item_id IS NOT NULL THEN
      SELECT COALESCE(SUM(
        COALESCE(ri.qty_gross, ri.qty_base_units, 0) * COALESCE(ii.last_cost, ii.price, 0)
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

-- =====================================================
-- Step 4: Rewrite get_recipe_ingredient_count — FK first
-- =====================================================
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
  -- FK first
  SELECT menu_item_id INTO v_menu_item_id
  FROM recipes WHERE id = p_recipe_id;

  IF v_menu_item_id IS NULL THEN
    v_menu_item_id := p_recipe_id;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM recipe_ingredients
  WHERE menu_item_id = v_menu_item_id;

  -- Fallback name bridge
  IF v_count = 0 AND v_menu_item_id = p_recipe_id THEN
    SELECT mi.id INTO v_menu_item_id
    FROM recipes r
    JOIN menu_items mi ON LOWER(TRIM(mi.name)) = LOWER(TRIM(r.menu_item_name))
    WHERE r.id = p_recipe_id
    LIMIT 1;

    IF v_menu_item_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count
      FROM recipe_ingredients
      WHERE menu_item_id = v_menu_item_id;
    END IF;
  END IF;

  RETURN v_count;
END;
$$;

-- =====================================================
-- Step 5: Rewrite get_recipe_ingredients — FK first
-- =====================================================
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
  -- FK first
  SELECT r.menu_item_id INTO v_resolved_id
  FROM recipes r WHERE r.id = p_recipe_id;

  -- Direct match fallback
  IF v_resolved_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM recipe_ingredients WHERE recipe_ingredients.menu_item_id = p_recipe_id) THEN
      v_resolved_id := p_recipe_id;
    ELSE
      -- Name bridge fallback
      SELECT mi.id INTO v_resolved_id
      FROM recipes r2
      JOIN menu_items mi ON LOWER(TRIM(mi.name)) = LOWER(TRIM(r2.menu_item_name))
      WHERE r2.id = p_recipe_id
      LIMIT 1;
    END IF;
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

-- =====================================================
-- Step 6: Setup Completeness RPC (Phase 2)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_setup_completeness(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_inv_count integer;
  v_recipe_count integer;
  v_recipes_with_ing integer;
  v_menu_items_count integer;
  v_menu_items_with_recipe integer;
  v_has_pos_data boolean;
  v_completeness_pct integer;
  v_missing_steps jsonb;
BEGIN
  -- Count inventory items
  SELECT COUNT(*) INTO v_inv_count
  FROM inventory_items WHERE org_id = p_org_id AND is_active = true;

  -- Count recipes
  SELECT COUNT(*) INTO v_recipe_count
  FROM recipes WHERE group_id = p_org_id;

  -- Count recipes with ingredients (via menu_item_id FK)
  SELECT COUNT(DISTINCT r.id) INTO v_recipes_with_ing
  FROM recipes r
  JOIN menu_items mi ON mi.id = r.menu_item_id
  JOIN recipe_ingredients ri ON ri.menu_item_id = mi.id
  WHERE r.group_id = p_org_id;

  -- Count menu items
  SELECT COUNT(*) INTO v_menu_items_count
  FROM menu_items WHERE org_id = p_org_id;

  -- Menu items that have a recipe
  SELECT COUNT(DISTINCT mi.id) INTO v_menu_items_with_recipe
  FROM menu_items mi
  JOIN recipes r ON r.menu_item_id = mi.id
  WHERE mi.org_id = p_org_id;

  -- Has POS data?
  SELECT EXISTS(
    SELECT 1 FROM cdm_orders WHERE org_id = p_org_id LIMIT 1
  ) INTO v_has_pos_data;

  -- Calculate completeness
  v_completeness_pct := 0;
  IF v_inv_count > 0 THEN v_completeness_pct := v_completeness_pct + 25; END IF;
  IF v_recipe_count > 0 THEN v_completeness_pct := v_completeness_pct + 25; END IF;
  IF v_recipes_with_ing > 0 THEN v_completeness_pct := v_completeness_pct + 25; END IF;
  IF v_has_pos_data THEN v_completeness_pct := v_completeness_pct + 25; END IF;

  -- Build missing steps
  v_missing_steps := '[]'::jsonb;
  IF v_inv_count = 0 THEN
    v_missing_steps := v_missing_steps || '["Añade materias primas en Inventory Setup"]'::jsonb;
  END IF;
  IF v_recipe_count = 0 THEN
    v_missing_steps := v_missing_steps || '["Crea escandallos para tus platos"]'::jsonb;
  END IF;
  IF v_recipe_count > 0 AND v_recipes_with_ing = 0 THEN
    v_missing_steps := v_missing_steps || '["Añade ingredientes a tus escandallos"]'::jsonb;
  END IF;
  IF NOT v_has_pos_data THEN
    v_missing_steps := v_missing_steps || '["Conecta tu POS o importa datos de ventas"]'::jsonb;
  END IF;
  IF v_menu_items_count > v_menu_items_with_recipe THEN
    v_missing_steps := v_missing_steps || jsonb_build_array(
      (v_menu_items_count - v_menu_items_with_recipe) || ' platos sin escandallo'
    );
  END IF;

  RETURN jsonb_build_object(
    'inventory_items_count', v_inv_count,
    'recipes_count', v_recipe_count,
    'recipes_with_ingredients_count', v_recipes_with_ing,
    'menu_items_count', v_menu_items_count,
    'menu_items_with_recipe', v_menu_items_with_recipe,
    'has_pos_data', v_has_pos_data,
    'completeness_pct', v_completeness_pct,
    'missing_steps', v_missing_steps
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_setup_completeness(uuid) TO anon, authenticated;
