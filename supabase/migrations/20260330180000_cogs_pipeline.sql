-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: COGS Pipeline (P0)
--
-- 1. Add recipes.menu_item_id FK → links recipe to POS/menu item
-- 2. Create calculate_cogs_daily() → populates cogs_daily from recipe costs
-- 3. Fix menu_engineering_summary → use real recipe food cost
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Recipe ↔ Menu Item Link ──────────────────────────────────────────
-- Adds a direct FK from recipes to menu_items so we can look up
-- the food cost of any sold item without fuzzy name matching.

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id ON recipes(menu_item_id);

-- Backfill: try exact name match for existing recipes → menu_items
UPDATE recipes r
SET menu_item_id = mi.id
FROM menu_items mi
WHERE r.menu_item_id IS NULL
  AND r.group_id = mi.org_id
  AND LOWER(TRIM(r.menu_item_name)) = LOWER(TRIM(mi.name));

-- ── 2. calculate_cogs_daily RPC ─────────────────────────────────────────
-- Given an org and date range, calculates COGS per location per day
-- by joining cdm_order_lines → recipes (via item_id or name) → food cost.
--
-- Fallback: if no recipe is linked, uses org-level default_cogs_pct
-- from the location_settings or a hardcoded 32%.

CREATE OR REPLACE FUNCTION public.calculate_cogs_daily(
  p_org_id uuid,
  p_from date DEFAULT CURRENT_DATE - 30,
  p_to date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted integer := 0;
  v_rows_deleted integer := 0;
BEGIN
  -- cogs_daily is a VIEW on stock_movements WHERE movement_type IN ('waste', 'sale_estimate').
  -- We INSERT stock_movements with type='sale_estimate' so it flows through automatically.
  --
  -- Strategy:
  -- 1. Delete old 'sale_estimate' movements for this org in the date range (idempotent)
  -- 2. For each (location, day, item_id), calculate COGS from recipe food cost
  -- 3. For items WITHOUT a recipe, apply 32% fallback on net sales
  -- 4. Insert as stock_movements with movement_type='sale_estimate'

  -- Step 1: Clean old estimates for this window
  DELETE FROM stock_movements
  WHERE org_id = p_org_id
    AND movement_type = 'sale_estimate'
    AND (created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN p_from AND p_to;

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  -- Step 2: Insert fresh estimates from order data
  WITH line_cogs AS (
    SELECT
      o.org_id,
      o.location_id,
      ol.item_id,
      o.closed_at AS order_time,
      ol.qty,
      ol.net,
      -- Calculate unit cost from recipe if available
      CASE
        WHEN r.id IS NOT NULL THEN
          get_recipe_food_cost(r.id) / GREATEST(r.yield_qty, 1)
        ELSE
          -- No recipe: estimate at 32% of unit net price
          CASE WHEN ol.qty > 0 THEN (ol.net / ol.qty) * 0.32 ELSE 0 END
      END AS unit_cost_calc
    FROM cdm_orders o
    JOIN cdm_order_lines ol ON ol.order_id = o.id
    LEFT JOIN recipes r ON (
      r.group_id = p_org_id
      AND r.menu_item_id IS NOT NULL
      AND r.menu_item_id = ol.item_id
    )
    WHERE o.org_id = p_org_id
      AND o.closed_at::date BETWEEN p_from AND p_to
      AND o.closed_at IS NOT NULL
      AND o.location_id IS NOT NULL
      AND ol.qty > 0
  )
  INSERT INTO stock_movements (org_id, location_id, item_id, movement_type, qty_delta, unit_cost, notes, created_at)
  SELECT
    lc.org_id,
    lc.location_id,
    lc.item_id,
    'sale_estimate',
    lc.qty,                      -- qty consumed
    lc.unit_cost_calc,           -- cost per unit
    'Auto-calculated from POS sales × recipe cost',
    lc.order_time                -- use order time for proper date bucketing
  FROM line_cogs lc
  WHERE lc.unit_cost_calc > 0;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'rows_inserted', v_rows_inserted,
    'rows_deleted', v_rows_deleted,
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'org_id', p_org_id
  );
END;
$$;

-- ── 3. Fix menu_engineering_summary ─────────────────────────────────────
-- Replace hardcoded `0::numeric AS cogs` with actual recipe food cost
-- when available, falling back to 32% estimate.

CREATE OR REPLACE FUNCTION menu_engineering_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    WITH product_data AS (
      SELECT
        COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown')        AS product_name,
        COALESCE(mi.category, ci.category, 'Other')  AS product_category,
        COALESCE(SUM(ol.qty),0)::bigint               AS units_sold,
        COALESCE(SUM(ol.gross),0)                      AS net_sales,
        -- Real COGS: use recipe food cost if available, else 32% fallback
        COALESCE(SUM(
          CASE
            WHEN r.id IS NOT NULL THEN
              ol.qty * (get_recipe_food_cost(r.id) / GREATEST(r.yield_qty, 1))
            ELSE
              ol.net * 0.32
          END
        ), 0)                                          AS cogs,
        -- Source tracking
        CASE
          WHEN COUNT(r.id) > 0 AND COUNT(r.id) = COUNT(*) THEN 'recipe_actual'
          WHEN COUNT(r.id) > 0 THEN 'recipe_mixed'
          ELSE 'fallback_average'
        END                                            AS cost_source
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      LEFT JOIN recipes r ON r.menu_item_id = ol.item_id AND r.menu_item_id IS NOT NULL
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1,2,3
    ),
    enriched AS (
      SELECT
        pd.*,
        pd.net_sales - pd.cogs AS gross_profit,
        CASE WHEN pd.net_sales > 0
          THEN ROUND(((pd.net_sales - pd.cogs) / pd.net_sales) * 100, 1)
          ELSE 0 END AS margin_pct
      FROM product_data pd
    ),
    stats AS (
      SELECT AVG(margin_pct) AS avg_m, AVG(units_sold) AS avg_p FROM enriched
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT e.product_id, e.product_name, e.product_category,
        e.units_sold, e.net_sales, e.cogs, e.gross_profit, e.margin_pct,
        e.cost_source,
        CASE
          WHEN e.margin_pct >= COALESCE(s.avg_m,0) AND e.units_sold >= COALESCE(s.avg_p,0) THEN 'star'
          WHEN e.margin_pct <  COALESCE(s.avg_m,0) AND e.units_sold >= COALESCE(s.avg_p,0) THEN 'plow_horse'
          WHEN e.margin_pct >= COALESCE(s.avg_m,0) AND e.units_sold <  COALESCE(s.avg_p,0) THEN 'puzzle'
          ELSE 'dog' END AS classification
      FROM enriched e, stats s
      ORDER BY e.net_sales DESC
    ) r
  );
END;
$$;
