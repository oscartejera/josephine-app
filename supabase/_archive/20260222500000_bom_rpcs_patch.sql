-- ============================================================
-- BOM Complete Patch: ALL DDLs + RPCs + View
-- Covers everything from 20260222400000 that was rolled back
-- Uses actual column names: menu_item_id (not recipe_id),
-- qty_base_units (not quantity)
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
-- Note: inventory_item_id stays NOT NULL (part of PK)
-- sub_recipe_id is nullable — when set, the ingredient IS a sub-recipe
-- ============================================================
ALTER TABLE recipe_ingredients
  ADD COLUMN IF NOT EXISTS sub_recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS qty_gross numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_net numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS yield_pct numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Back-fill qty_gross from existing qty_base_units column
UPDATE recipe_ingredients
  SET qty_gross = qty_base_units, qty_net = qty_base_units
  WHERE qty_gross = 0 AND qty_base_units > 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ri_menu_item_id ON recipe_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_ri_sub_recipe_id ON recipe_ingredients(sub_recipe_id);

-- ============================================================
-- SECTION 3: RPC — get_recipe_food_cost (recursive)
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
      COALESCE(ii.last_cost, 0) AS unit_cost,
      sr.yield_qty AS sub_yield_qty
    FROM recipe_ingredients ri
    LEFT JOIN inventory_items ii ON ii.id = ri.inventory_item_id
    LEFT JOIN recipes sr ON sr.id = ri.sub_recipe_id
    WHERE ri.menu_item_id = p_recipe_id
  LOOP
    IF v_row.sub_recipe_id IS NOT NULL THEN
      v_total := v_total + (
        v_row.qty_gross / GREATEST(COALESCE(v_row.sub_yield_qty, 1), 0.001)
        * get_recipe_food_cost(v_row.sub_recipe_id)
      );
    ELSE
      v_total := v_total + (v_row.qty_gross * v_row.unit_cost);
    END IF;
  END LOOP;
  RETURN ROUND(v_total, 4);
END;
$$;

-- ============================================================
-- SECTION 4: RPC — deduct_recipe_from_inventory (cascading)
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
  SELECT COALESCE(yield_qty, 1) INTO v_recipe_yield FROM recipes WHERE id = p_recipe_id;
  v_scale := p_qty / GREATEST(v_recipe_yield, 0.001);

  FOR v_row IN
    SELECT ri.inventory_item_id, ri.sub_recipe_id, ri.qty_gross
    FROM recipe_ingredients ri
    WHERE ri.menu_item_id = p_recipe_id
  LOOP
    IF v_row.sub_recipe_id IS NOT NULL THEN
      PERFORM deduct_recipe_from_inventory(
        v_row.sub_recipe_id, p_location_id, v_row.qty_gross * v_scale
      );
    ELSE
      UPDATE inventory_item_location
        SET on_hand = GREATEST(on_hand - (v_row.qty_gross * v_scale), 0)
        WHERE item_id = v_row.inventory_item_id AND location_id = p_location_id;

      INSERT INTO stock_movements (
        org_id, location_id, inventory_item_id,
        movement_type, qty_delta, unit_cost, notes
      )
      SELECT l.org_id, p_location_id, v_row.inventory_item_id,
        'sale_estimate', -(v_row.qty_gross * v_scale),
        COALESCE(ii.last_cost, 0),
        'BOM auto-deduction: recipe ' || p_recipe_id::text
      FROM locations l
      CROSS JOIN inventory_items ii
      WHERE l.id = p_location_id AND ii.id = v_row.inventory_item_id;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- SECTION 5: View — recipe_summary
-- ============================================================
DROP VIEW IF EXISTS recipe_summary;
CREATE VIEW recipe_summary AS
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
  COALESCE(ic.cnt, 0)::integer AS ingredient_count,
  get_recipe_food_cost(r.id) AS food_cost,
  CASE WHEN COALESCE(r.selling_price, 0) > 0
    THEN ROUND(get_recipe_food_cost(r.id) / r.selling_price * 100, 1)
    ELSE 0 END AS food_cost_pct
FROM recipes r
LEFT JOIN LATERAL (
  SELECT COUNT(*)::integer AS cnt
  FROM recipe_ingredients ri2
  WHERE ri2.menu_item_id = r.id
) ic ON true;

GRANT SELECT ON recipe_summary TO anon, authenticated;
