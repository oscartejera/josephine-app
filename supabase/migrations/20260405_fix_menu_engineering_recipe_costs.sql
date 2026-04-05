-- ============================================================
-- FIX: menu_engineering_summary — integrate real recipe costs
-- Items WITHOUT a recipe are EXCLUDED from classification.
-- ============================================================

DROP FUNCTION IF EXISTS menu_engineering_summary(date, date, uuid, text, text);

CREATE OR REPLACE FUNCTION menu_engineering_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid DEFAULT NULL,
  p_data_source text DEFAULT 'demo',
  p_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $fn$
BEGIN
  RETURN (
    WITH recipe_costs AS (
      -- Calculate plate cost from recipe_ingredients × inventory_items
      SELECT
        r.id AS recipe_id,
        r.menu_item_name,
        r.selling_price AS recipe_selling_price,
        r.category AS recipe_category,
        COALESCE(SUM(
          CASE
            WHEN ri.inventory_item_id IS NOT NULL THEN
              ri.quantity * COALESCE(ii.last_cost, ii.price, 0) / NULLIF(ri.yield_pct, 0) * 100
            ELSE 0
          END
        ), 0) AS plate_cost
      FROM recipes r
      LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
      LEFT JOIN inventory_items ii ON ii.id = ri.inventory_item_id
      WHERE r.group_id IN (
        SELECT COALESCE(p.group_id, om.org_id)
        FROM profiles p
        LEFT JOIN org_memberships om ON om.user_id = p.id
        WHERE p.id = auth.uid()
        LIMIT 1
      )
      GROUP BY r.id, r.menu_item_name, r.selling_price, r.category
    ),
    product_sales AS (
      SELECT
        COALESCE(ol.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS product_id,
        COALESCE(mi.name, ci.name, 'Unknown') AS product_name,
        COALESCE(mi.category, ci.category, 'Other') AS product_category,
        COALESCE(SUM(ol.qty), 0)::bigint AS units_sold,
        COALESCE(SUM(ol.gross), 0) AS total_revenue
      FROM cdm_orders o
      JOIN cdm_order_lines ol ON ol.order_id = o.id
      LEFT JOIN cdm_items ci ON ci.id = ol.item_id
      LEFT JOIN menu_items mi ON mi.id = ol.item_id
      WHERE o.closed_at::date BETWEEN p_date_from AND p_date_to
        AND o.closed_at IS NOT NULL
        AND (p_location_id IS NULL OR o.location_id = p_location_id)
        AND (p_category IS NULL OR COALESCE(mi.category, ci.category, 'Other') = p_category)
      GROUP BY 1, 2, 3
    ),
    -- Join sales with recipes (match by name, case-insensitive)
    product_data AS (
      SELECT
        ps.product_id,
        ps.product_name,
        ps.product_category,
        ps.units_sold,
        ps.total_revenue,
        rc.plate_cost AS unit_food_cost,
        (ps.total_revenue / GREATEST(ps.units_sold, 1)) - COALESCE(rc.plate_cost, 0) AS unit_gross_profit,
        ps.total_revenue - (COALESCE(rc.plate_cost, 0) * ps.units_sold) AS total_gross_profit,
        CASE
          WHEN ps.total_revenue > 0
          THEN ((ps.total_revenue - (COALESCE(rc.plate_cost, 0) * ps.units_sold)) / ps.total_revenue) * 100
          ELSE 0
        END AS margin_pct,
        CASE WHEN rc.recipe_id IS NOT NULL THEN 'recipe_actual' ELSE 'unknown' END AS cost_source,
        CASE WHEN rc.recipe_id IS NOT NULL THEN 'high' ELSE 'low' END AS data_confidence
      FROM product_sales ps
      INNER JOIN recipe_costs rc ON LOWER(TRIM(rc.menu_item_name)) = LOWER(TRIM(ps.product_name))
      WHERE ps.units_sold > 0
    ),
    stats AS (
      SELECT
        AVG(unit_gross_profit) AS avg_gp,
        COUNT(*)::numeric AS item_count,
        SUM(units_sold) AS total_units
      FROM product_data
    )
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        pd.product_id,
        pd.product_name AS name,
        pd.product_category AS category,
        pd.units_sold,
        pd.total_revenue AS sales,
        pd.unit_food_cost AS cogs,
        pd.unit_food_cost,
        pd.unit_gross_profit,
        pd.total_gross_profit,
        (pd.total_revenue / GREATEST(pd.units_sold, 1)) AS selling_price_ex_vat,
        pd.margin_pct,
        -- Popularity metrics
        CASE WHEN s.total_units > 0
          THEN (pd.units_sold::numeric / s.total_units * 100)
          ELSE 0
        END AS popularity_pct,
        CASE WHEN s.item_count > 0
          THEN (100.0 / s.item_count) * 0.70
          ELSE 0
        END AS ideal_average_popularity,
        COALESCE(s.avg_gp, 0) AS average_gross_profit,
        -- Classification
        CASE WHEN pd.units_sold::numeric / GREATEST(s.total_units, 1) * 100 >= (100.0 / GREATEST(s.item_count, 1)) * 0.70
          THEN 'high' ELSE 'low'
        END AS popularity_class,
        CASE WHEN pd.unit_gross_profit >= COALESCE(s.avg_gp, 0)
          THEN 'high' ELSE 'low'
        END AS profitability_class,
        CASE
          WHEN pd.unit_gross_profit >= COALESCE(s.avg_gp, 0)
            AND pd.units_sold::numeric / GREATEST(s.total_units, 1) * 100 >= (100.0 / GREATEST(s.item_count, 1)) * 0.70
          THEN 'star'
          WHEN pd.unit_gross_profit < COALESCE(s.avg_gp, 0)
            AND pd.units_sold::numeric / GREATEST(s.total_units, 1) * 100 >= (100.0 / GREATEST(s.item_count, 1)) * 0.70
          THEN 'plow_horse'
          WHEN pd.unit_gross_profit >= COALESCE(s.avg_gp, 0)
            AND pd.units_sold::numeric / GREATEST(s.total_units, 1) * 100 < (100.0 / GREATEST(s.item_count, 1)) * 0.70
          THEN 'puzzle'
          ELSE 'dog'
        END AS classification,
        'Kasavana-Smith with recipe costs' AS classification_reason,
        pd.cost_source,
        pd.data_confidence,
        CASE
          WHEN pd.unit_gross_profit >= COALESCE(s.avg_gp, 0)
            AND pd.units_sold::numeric / GREATEST(s.total_units, 1) * 100 >= (100.0 / GREATEST(s.item_count, 1)) * 0.70
          THEN 'Proteger'
          WHEN pd.unit_gross_profit < COALESCE(s.avg_gp, 0)
            AND pd.units_sold::numeric / GREATEST(s.total_units, 1) * 100 >= (100.0 / GREATEST(s.item_count, 1)) * 0.70
          THEN 'Optimizar coste'
          WHEN pd.unit_gross_profit >= COALESCE(s.avg_gp, 0)
            AND pd.units_sold::numeric / GREATEST(s.total_units, 1) * 100 < (100.0 / GREATEST(s.item_count, 1)) * 0.70
          THEN 'Promocionar'
          ELSE 'Evaluar'
        END AS action_tag,
        '[]'::jsonb AS badges,
        true AS is_canonical,
        s.item_count::int,
        s.total_units::bigint AS total_units,
        pd.total_revenue AS total_sales,
        pd.total_revenue AS sales_ex_vat
      FROM product_data pd, stats s
      ORDER BY pd.total_revenue DESC
    ) r
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION menu_engineering_summary(date, date, uuid, text, text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
