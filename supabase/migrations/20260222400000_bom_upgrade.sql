-- ============================================================
-- BOM Upgrade: Sub-recipes, Yield Management, Food Cost RPCs
-- MarketMan-style Bill of Materials
-- ============================================================

-- ============================================================
-- SECTION 1: Upgrade recipes table
-- ============================================================

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Main',
  ADD COLUMN IF NOT EXISTS yield_qty numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS yield_unit text DEFAULT 'portion',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_sub_recipe boolean DEFAULT false;

-- ============================================================
-- SECTION 2: Upgrade recipe_ingredients table
-- ============================================================

-- Allow inventory_item_id to be NULL (for sub-recipe rows)
ALTER TABLE recipe_ingredients
  ALTER COLUMN inventory_item_id DROP NOT NULL;

-- Add sub-recipe + yield columns
ALTER TABLE recipe_ingredients
  ADD COLUMN IF NOT EXISTS sub_recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS qty_gross numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_net numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS yield_pct numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Back-fill qty_gross from existing quantity column
UPDATE recipe_ingredients
  SET qty_gross = quantity, qty_net = quantity
  WHERE qty_gross = 0 AND quantity > 0;

-- Constraint: each row must have EITHER inventory_item_id OR sub_recipe_id
ALTER TABLE recipe_ingredients
  DROP CONSTRAINT IF EXISTS chk_ingredient_or_subrecipe;

ALTER TABLE recipe_ingredients
  ADD CONSTRAINT chk_ingredient_or_subrecipe
  CHECK (
    (inventory_item_id IS NOT NULL AND sub_recipe_id IS NULL)
    OR
    (inventory_item_id IS NULL AND sub_recipe_id IS NOT NULL)
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
  ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_sub_recipe_id
  ON recipe_ingredients(sub_recipe_id);

-- ============================================================
-- SECTION 3: RPC — get_recipe_food_cost (recursive)
-- Returns the total cost for one yield_qty of a recipe
-- ============================================================

CREATE OR REPLACE FUNCTION get_recipe_food_cost(p_recipe_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_total numeric := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT
      ri.inventory_item_id,
      ri.sub_recipe_id,
      ri.qty_gross,
      ri.yield_pct,
      COALESCE(ii.last_cost, 0) AS unit_cost,
      sr.yield_qty AS sub_yield_qty
    FROM recipe_ingredients ri
    LEFT JOIN inventory_items ii ON ii.id = ri.inventory_item_id
    LEFT JOIN recipes sr ON sr.id = ri.sub_recipe_id
    WHERE ri.recipe_id = p_recipe_id
  LOOP
    IF v_row.inventory_item_id IS NOT NULL THEN
      -- Direct ingredient: cost = qty_gross * unit_cost
      v_total := v_total + (v_row.qty_gross * v_row.unit_cost);
    ELSIF v_row.sub_recipe_id IS NOT NULL THEN
      -- Sub-recipe: recursive call, scaled by qty_gross / sub_recipe yield
      v_total := v_total + (
        v_row.qty_gross / GREATEST(COALESCE(v_row.sub_yield_qty, 1), 0.001)
        * get_recipe_food_cost(v_row.sub_recipe_id)
      );
    END IF;
  END LOOP;

  RETURN ROUND(v_total, 4);
END;
$$;

-- ============================================================
-- SECTION 4: RPC — deduct_recipe_from_inventory (cascading)
-- Deducts physical ingredients from inventory_item_location
-- ============================================================

CREATE OR REPLACE FUNCTION deduct_recipe_from_inventory(
  p_recipe_id uuid,
  p_location_id uuid,
  p_qty numeric DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_row record;
  v_recipe_yield numeric;
  v_scale numeric;
BEGIN
  -- Get recipe yield
  SELECT COALESCE(yield_qty, 1) INTO v_recipe_yield FROM recipes WHERE id = p_recipe_id;
  v_scale := p_qty / GREATEST(v_recipe_yield, 0.001);

  FOR v_row IN
    SELECT
      ri.inventory_item_id,
      ri.sub_recipe_id,
      ri.qty_gross,
      ri.yield_pct,
      sr.yield_qty AS sub_yield_qty
    FROM recipe_ingredients ri
    LEFT JOIN recipes sr ON sr.id = ri.sub_recipe_id
    WHERE ri.recipe_id = p_recipe_id
  LOOP
    IF v_row.inventory_item_id IS NOT NULL THEN
      -- Deduct from inventory_item_location
      UPDATE inventory_item_location
        SET on_hand = GREATEST(on_hand - (v_row.qty_gross * v_scale), 0)
        WHERE item_id = v_row.inventory_item_id
          AND location_id = p_location_id;

      -- Record stock_movement
      INSERT INTO stock_movements (
        org_id, location_id, inventory_item_id,
        movement_type, qty_delta, unit_cost, notes
      )
      SELECT
        l.org_id, p_location_id, v_row.inventory_item_id,
        'sale_estimate',
        -(v_row.qty_gross * v_scale),
        COALESCE(ii.last_cost, 0),
        'BOM auto-deduction: recipe ' || p_recipe_id::text
      FROM locations l
      CROSS JOIN inventory_items ii
      WHERE l.id = p_location_id AND ii.id = v_row.inventory_item_id;

    ELSIF v_row.sub_recipe_id IS NOT NULL THEN
      -- Recurse into sub-recipe
      PERFORM deduct_recipe_from_inventory(
        v_row.sub_recipe_id,
        p_location_id,
        v_row.qty_gross * v_scale
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- SECTION 5: View — recipe_summary (for list page)
-- ============================================================

CREATE OR REPLACE VIEW recipe_summary AS
SELECT
  r.id,
  r.group_id,
  r.menu_item_name,
  r.selling_price,
  r.category,
  r.yield_qty,
  r.yield_unit,
  r.is_sub_recipe,
  r.created_at,
  COUNT(ri.id)::integer AS ingredient_count,
  get_recipe_food_cost(r.id) AS food_cost,
  CASE WHEN COALESCE(r.selling_price, 0) > 0
    THEN ROUND(get_recipe_food_cost(r.id) / r.selling_price * 100, 1)
    ELSE 0 END AS food_cost_pct
FROM recipes r
LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
GROUP BY r.id;

GRANT SELECT ON recipe_summary TO anon, authenticated;
