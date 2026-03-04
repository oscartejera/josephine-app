-- =============================================================================
-- Migration: Fix Inventory + Menu Engineering data pipeline
-- Date: 2024-02-24
-- Description: 
--   1. Fix product_sales_daily_unified_mv — use cdm_items categories + COGS
--   2. Add category_name to inventory_items (from inventory_categories FK)
--   3. Create menu_engineering_actions table
--   4. Rewrite menu_engineering_summary RPC (Kasavana-Smith with real data)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Recreate product_sales_daily_unified_mv with real categories + COGS
-- ---------------------------------------------------------------------------

-- Drop the view that wraps the MV (if it exists)
DROP VIEW IF EXISTS product_sales_daily_unified;

-- Recreate the materialized view with cdm_items categories and estimated COGS
DROP MATERIALIZED VIEW IF EXISTS product_sales_daily_unified_mv;

CREATE MATERIALIZED VIEW product_sales_daily_unified_mv AS
SELECT
  o.org_id,
  o.location_id,
  (o.closed_at AT TIME ZONE COALESCE(l.timezone, 'Europe/Madrid'))::date AS day,
  COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
  COALESCE(ci.name, 'Unknown') AS product_name,
  COALESCE(ci.category, 'Other') AS product_category,
  COALESCE(SUM(ol.qty), 0)::integer AS units_sold,
  COALESCE(SUM(ol.gross), 0) AS net_sales,
  -- Estimated COGS by category
  ROUND(
    COALESCE(SUM(ol.gross), 0) *
    CASE COALESCE(ci.category, 'Other')
      WHEN 'Bebidas' THEN 0.25
      WHEN 'Postres' THEN 0.28
      WHEN 'Entrantes' THEN 0.30
      WHEN 'Pastas' THEN 0.30
      WHEN 'Carnes' THEN 0.35
      WHEN 'Pescados' THEN 0.38
      ELSE 0.32
    END, 2
  ) AS cogs,
  ROUND(
    COALESCE(SUM(ol.gross), 0) * (1 -
    CASE COALESCE(ci.category, 'Other')
      WHEN 'Bebidas' THEN 0.25
      WHEN 'Postres' THEN 0.28
      WHEN 'Entrantes' THEN 0.30
      WHEN 'Pastas' THEN 0.30
      WHEN 'Carnes' THEN 0.35
      WHEN 'Pescados' THEN 0.38
      ELSE 0.32
    END), 2
  ) AS gross_profit,
  ROUND(
    (1 - CASE COALESCE(ci.category, 'Other')
      WHEN 'Bebidas' THEN 0.25
      WHEN 'Postres' THEN 0.28
      WHEN 'Entrantes' THEN 0.30
      WHEN 'Pastas' THEN 0.30
      WHEN 'Carnes' THEN 0.35
      WHEN 'Pescados' THEN 0.38
      ELSE 0.32
    END) * 100, 1
  ) AS margin_pct,
  'simulated' AS data_source
FROM cdm_orders o
JOIN cdm_order_lines ol ON ol.order_id = o.id
LEFT JOIN cdm_items ci ON ci.id = ol.item_id
LEFT JOIN locations l ON l.id = o.location_id
WHERE o.closed_at IS NOT NULL
GROUP BY o.org_id, o.location_id, day, ol.item_id, ci.name, ci.category, l.timezone;

-- Recreate the convenience view on top
CREATE OR REPLACE VIEW product_sales_daily_unified AS
SELECT * FROM product_sales_daily_unified_mv;


-- ---------------------------------------------------------------------------
-- 2. Add category_name to inventory_items
-- ---------------------------------------------------------------------------

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS category_name text;

-- Populate from inventory_categories FK
UPDATE inventory_items ii
SET category_name = ic.name
FROM inventory_categories ic
WHERE ii.category_id = ic.id
  AND ii.category_name IS NULL;


-- ---------------------------------------------------------------------------
-- 3. Create menu_engineering_actions table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS menu_engineering_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  location_id uuid REFERENCES locations(id),
  date_from date NOT NULL,
  date_to date NOT NULL,
  product_id uuid,
  action_type text NOT NULL,
  classification text NOT NULL,
  estimated_impact_eur numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE menu_engineering_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'menu_engineering_actions'
      AND policyname = 'Users can manage their own actions'
  ) THEN
    CREATE POLICY "Users can manage their own actions"
      ON menu_engineering_actions
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 4. Rewrite menu_engineering_summary RPC (Kasavana-Smith methodology)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.menu_engineering_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'simulated'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    WITH product_data AS (
      SELECT
        COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(ci.name, 'Unknown') AS product_name,
        COALESCE(ci.category, 'Other') AS product_category,
        COALESCE(SUM(ol.qty), 0)::bigint AS units_sold,
        COALESCE(SUM(ol.gross), 0)::numeric AS net_sales,
        -- COGS estimated by category
        ROUND(
          COALESCE(SUM(ol.gross), 0) *
          CASE COALESCE(ci.category, 'Other')
            WHEN 'Bebidas' THEN 0.25
            WHEN 'Postres' THEN 0.28
            WHEN 'Entrantes' THEN 0.30
            WHEN 'Pastas' THEN 0.30
            WHEN 'Carnes' THEN 0.35
            WHEN 'Pescados' THEN 0.38
            ELSE 0.32
          END, 2
        )::numeric AS cogs
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1, 2, 3
    ),
    enriched AS (
      SELECT
        product_id,
        product_name,
        product_category,
        units_sold,
        net_sales,
        cogs,
        (net_sales - cogs) AS gross_profit,
        CASE WHEN net_sales > 0 THEN ROUND(((net_sales - cogs) / net_sales) * 100, 1) ELSE 0 END AS margin_pct,
        CASE WHEN units_sold > 0 THEN ROUND((net_sales - cogs) / units_sold, 2) ELSE 0 END AS cm_per_unit,
        CASE WHEN SUM(units_sold) OVER () > 0
          THEN ROUND((units_sold::numeric / SUM(units_sold) OVER ()) * 100, 2)
          ELSE 0 END AS popularity_share,
        CASE WHEN SUM(net_sales) OVER () > 0
          THEN ROUND((net_sales / SUM(net_sales) OVER ()) * 100, 2)
          ELSE 0 END AS sales_share
      FROM product_data
      WHERE units_sold > 0
    ),
    thresholds AS (
      SELECT
        -- Kasavana-Smith 70% rule for popularity
        CASE WHEN COUNT(*) > 0
          THEN (1.0 / COUNT(*)::numeric) * 0.7 * 100
          ELSE 0 END AS pop_threshold,
        -- Weighted average contribution margin (€/unit)
        CASE WHEN SUM(units_sold) > 0
          THEN SUM(cm_per_unit * units_sold) / SUM(units_sold)
          ELSE 0 END AS cm_threshold
      FROM enriched
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        e.product_id,
        e.product_name AS name,
        e.product_category AS category,
        e.units_sold AS units,
        e.net_sales AS sales,
        e.cogs,
        e.gross_profit AS profit_eur,
        e.margin_pct,
        e.cm_per_unit AS profit_per_sale,
        e.popularity_share,
        e.sales_share,
        CASE
          WHEN e.popularity_share >= t.pop_threshold AND e.cm_per_unit >= t.cm_threshold THEN 'star'
          WHEN e.popularity_share >= t.pop_threshold AND e.cm_per_unit < t.cm_threshold THEN 'plow_horse'
          WHEN e.popularity_share < t.pop_threshold AND e.cm_per_unit >= t.cm_threshold THEN 'puzzle'
          ELSE 'dog'
        END AS classification,
        CASE
          WHEN e.popularity_share >= t.pop_threshold AND e.cm_per_unit >= t.cm_threshold THEN 'Mantener'
          WHEN e.popularity_share >= t.pop_threshold AND e.cm_per_unit < t.cm_threshold THEN 'Subir precio'
          WHEN e.popularity_share < t.pop_threshold AND e.cm_per_unit >= t.cm_threshold THEN 'Promocionar'
          ELSE 'Revisar'
        END AS action_tag,
        ARRAY[]::text[] AS badges
      FROM enriched e, thresholds t
      ORDER BY e.net_sales DESC
    ) r
  );
END;
$function$;


-- ---------------------------------------------------------------------------
-- 5. Notify PostgREST to reload schema cache
-- ---------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- 6. Rewrite get_instant_pnl_unified RPC (use same data sources as Sales/Dashboard)
--    COGS: ratio from product_sales_daily_unified applied to sales_daily_unified
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_instant_pnl_unified(
  p_org_id uuid,
  p_location_ids uuid[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE v_ds jsonb; v_locs jsonb;
BEGIN
  v_ds := resolve_data_source(p_org_id);

  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) INTO v_locs
  FROM (
    SELECT
      l.id AS location_id,
      l.name AS location_name,
      COALESCE(s.net_sales, 0)::numeric       AS actual_sales,
      COALESCE(f.forecast_sales, 0)::numeric   AS forecast_sales,
      ROUND(COALESCE(s.net_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)::numeric AS actual_cogs,
      ROUND(COALESCE(f.forecast_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)::numeric AS forecast_cogs,
      COALESCE(lab.actual_cost, 0)::numeric    AS actual_labour,
      COALESCE(lab.actual_hours, 0)::numeric   AS actual_labour_hours,
      COALESCE(f.planned_labor_cost, 0)::numeric AS forecast_labour,
      COALESCE(f.planned_labor_hours, 0)::numeric AS forecast_labour_hours,
      (COALESCE(s.net_sales, 0)
        - ROUND(COALESCE(s.net_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)
        - COALESCE(lab.actual_cost, 0))::numeric AS actual_gp,
      (COALESCE(f.forecast_sales, 0)
        - ROUND(COALESCE(f.forecast_sales, 0) * COALESCE(cg.cogs_pct, 0.32), 2)
        - COALESCE(f.planned_labor_cost, 0))::numeric AS forecast_gp,
      true AS estimated_cogs,
      CASE WHEN COALESCE(lab.actual_cost, 0) = 0 AND COALESCE(s.net_sales, 0) > 0
        THEN true ELSE false END AS estimated_labour
    FROM locations l
    LEFT JOIN (
      SELECT location_id, SUM(net_sales) AS net_sales
      FROM sales_daily_unified
      WHERE org_id = p_org_id AND date BETWEEN p_from AND p_to
      GROUP BY 1
    ) s ON s.location_id = l.id
    LEFT JOIN (
      SELECT location_id,
        SUM(forecast_sales) AS forecast_sales,
        SUM(planned_labor_cost) AS planned_labor_cost,
        SUM(planned_labor_hours) AS planned_labor_hours
      FROM forecast_daily_unified
      WHERE org_id = p_org_id AND day BETWEEN p_from AND p_to
      GROUP BY 1
    ) f ON f.location_id = l.id
    LEFT JOIN (
      SELECT location_id, SUM(actual_cost) AS actual_cost, SUM(actual_hours) AS actual_hours
      FROM labour_daily_unified
      WHERE org_id = p_org_id AND day BETWEEN p_from AND p_to
      GROUP BY 1
    ) lab ON lab.location_id = l.id
    LEFT JOIN (
      SELECT location_id,
        CASE WHEN SUM(net_sales) > 0 THEN SUM(cogs) / SUM(net_sales) ELSE 0.32 END AS cogs_pct
      FROM product_sales_daily_unified
      WHERE org_id = p_org_id AND day BETWEEN p_from AND p_to
      GROUP BY 1
    ) cg ON cg.location_id = l.id
    WHERE l.id = ANY(p_location_ids) AND l.active = true
  ) r;

  RETURN jsonb_build_object(
    'data_source', v_ds->>'data_source',
    'mode', v_ds->>'mode',
    'reason', v_ds->>'reason',
    'last_synced_at', v_ds->>'last_synced_at',
    'locations', v_locs,
    'flags', jsonb_build_object('estimated_cogs', true, 'cogs_note', 'COGS from product mix ratio')
  );
END;
$function$;

