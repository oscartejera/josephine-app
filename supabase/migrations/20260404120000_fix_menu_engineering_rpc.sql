-- ============================================================
-- FIX: menu_engineering_summary — add p_category parameter
-- The frontend passes p_category but the v2 RPC didn't accept it.
-- This makes PostgREST reject the call with 404.
-- ============================================================

-- Drop old 4-param version to avoid overload conflicts
DROP FUNCTION IF EXISTS menu_engineering_summary(date, date, uuid, text);

CREATE OR REPLACE FUNCTION menu_engineering_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo',
  p_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    WITH product_data AS (
      SELECT
        COALESCE(ol.item_id,'00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown')           AS product_name,
        COALESCE(mi.category, ci.category, 'Other')      AS product_category,
        COALESCE(SUM(ol.qty),0)::bigint                  AS units_sold,
        COALESCE(SUM(ol.gross),0)                        AS net_sales,
        0::numeric                                        AS cogs,
        COALESCE(SUM(ol.gross),0)                        AS gross_profit,
        100::numeric                                      AS margin_pct
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
        AND (p_category IS NULL OR COALESCE(mi.category, ci.category, 'Other') = p_category)
      GROUP BY 1,2,3
    ),
    stats AS (
      SELECT AVG(margin_pct) AS avg_m, AVG(units_sold) AS avg_p FROM product_data
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT pd.product_id, pd.product_name, pd.product_category,
        pd.units_sold, pd.net_sales, pd.cogs, pd.gross_profit, pd.margin_pct,
        CASE
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'star'
          WHEN pd.margin_pct <  COALESCE(s.avg_m,0) AND pd.units_sold >= COALESCE(s.avg_p,0) THEN 'plow_horse'
          WHEN pd.margin_pct >= COALESCE(s.avg_m,0) AND pd.units_sold <  COALESCE(s.avg_p,0) THEN 'puzzle'
          ELSE 'dog' END AS classification
      FROM product_data pd, stats s
      ORDER BY pd.net_sales DESC
    ) r
  );
END;
$$;

-- Grant access to the new 5-param version
GRANT EXECUTE ON FUNCTION menu_engineering_summary(date, date, uuid, text, text) TO anon, authenticated;

-- Notify PostgREST to reload
NOTIFY pgrst, 'reload schema';
