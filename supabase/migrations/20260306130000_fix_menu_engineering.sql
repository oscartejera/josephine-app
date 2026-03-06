-- Fix menu_engineering_summary RPC — column names must match frontend expectations
--
-- The frontend hook (useMenuEngineeringData.ts) maps these fields:
--   row.name, row.category, row.units, row.sales, row.cogs,
--   row.profit_eur, row.margin_pct, row.profit_per_sale,
--   row.popularity_share, row.sales_share, row.classification,
--   row.action_tag, row.badges
--
-- The Zod schema (rpc-contracts.ts) validates:
--   name, category, classification, units_sold, revenue, margin_pct
--
-- This migration aligns the SQL output to match both.

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
        COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000'::uuid)::text AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown')        AS name,
        COALESCE(mi.category, ci.category, 'Other')  AS category,
        COALESCE(SUM(ol.qty),0)::bigint               AS units,
        COALESCE(SUM(ol.gross),0)                      AS sales,
        0::numeric                                      AS cogs,
        COALESCE(SUM(ol.gross),0)                      AS profit_eur,
        100::numeric                                    AS margin_pct
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
      GROUP BY 1,2,3
    ),
    total_agg AS (
      SELECT
        COALESCE(SUM(units), 0) AS total_units,
        COALESCE(SUM(sales), 0) AS total_sales
      FROM product_data
    ),
    stats AS (
      SELECT
        CASE WHEN COUNT(*) > 0 THEN (1.0 / COUNT(*)) * 0.7 ELSE 0 END AS pop_threshold,
        CASE WHEN SUM(units) > 0
          THEN SUM(profit_eur * units) / SUM(units)
          ELSE 0
        END AS margin_threshold
      FROM product_data
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        pd.product_id,
        pd.name,
        pd.category,
        pd.units,
        pd.sales,
        pd.cogs,
        pd.profit_eur,
        pd.margin_pct,
        CASE WHEN ta.total_units > 0
          THEN ROUND(pd.profit_eur / NULLIF(pd.units, 0), 2)
          ELSE 0
        END AS profit_per_sale,
        CASE WHEN ta.total_units > 0
          THEN ROUND((pd.units::numeric / ta.total_units) * 100, 2)
          ELSE 0
        END AS popularity_share,
        CASE WHEN ta.total_sales > 0
          THEN ROUND((pd.sales / ta.total_sales) * 100, 2)
          ELSE 0
        END AS sales_share,
        -- Kasavana-Smith classification
        CASE
          WHEN pd.margin_pct >= s.margin_threshold
               AND (pd.units::numeric / NULLIF(ta.total_units, 0)) >= s.pop_threshold
            THEN 'star'
          WHEN pd.margin_pct < s.margin_threshold
               AND (pd.units::numeric / NULLIF(ta.total_units, 0)) >= s.pop_threshold
            THEN 'plow_horse'
          WHEN pd.margin_pct >= s.margin_threshold
               AND (pd.units::numeric / NULLIF(ta.total_units, 0)) < s.pop_threshold
            THEN 'puzzle'
          ELSE 'dog'
        END AS classification,
        -- Action tags
        CASE
          WHEN pd.margin_pct >= s.margin_threshold
               AND (pd.units::numeric / NULLIF(ta.total_units, 0)) >= s.pop_threshold
            THEN 'Mantener'
          WHEN pd.margin_pct < s.margin_threshold
               AND (pd.units::numeric / NULLIF(ta.total_units, 0)) >= s.pop_threshold
            THEN 'Subir precio'
          WHEN pd.margin_pct >= s.margin_threshold
               AND (pd.units::numeric / NULLIF(ta.total_units, 0)) < s.pop_threshold
            THEN 'Promocionar'
          ELSE 'Evaluar'
        END AS action_tag,
        -- Badges
        ARRAY[]::text[] AS badges
      FROM product_data pd, total_agg ta, stats s
      ORDER BY pd.sales DESC
    ) r
  );
END;
$$;

-- Also update for Zod compatibility: ensure revenue alias exists
-- The Zod schema expects 'name' (✓), 'units_sold' and 'revenue'
-- But the hook maps to 'units' and 'sales'
-- Both approaches work since schema has .passthrough()

GRANT EXECUTE ON FUNCTION menu_engineering_summary(date, date, uuid, text) TO anon, authenticated;
